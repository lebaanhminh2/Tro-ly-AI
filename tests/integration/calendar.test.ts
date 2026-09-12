import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {CalendarService} from '../../src/adapters/google-calendar/service.ts';
import {GoogleTokenVault} from '../../src/adapters/google-calendar/vault.ts';
import {GoogleClient,SCOPES} from '../../src/adapters/google-calendar/client.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
import type {CalendarProvider,TokenProvider,EventPage} from '../../src/ports/calendar.ts';
import {CalendarError,eventInterval,slots} from '../../src/domain/calendar.ts';
import type {Interval} from '../../src/domain/calendar.ts';
import {createWorker} from '../../src/entrypoints/worker.ts';
import type {Env} from '../../src/config/env.ts';
import {reminderAllowed} from '../../src/adapters/d1/reminders.ts';

class FakeGoogle implements CalendarProvider,TokenProvider {
  exchanges=0;refreshes=0;creates=0;inserts=0;revoked=false;failRefresh=false;expireSync=false;breakPage=false;loseInsert=false;
  calls:{calendar:string;params:Record<string,string>}[]=[];
  raw:unknown[]=[{id:'series',summary:'Class',recurrence:['RRULE:FREQ=WEEKLY'],start:{dateTime:'2026-09-18T08:00:00+07:00'},end:{dateTime:'2026-09-18T09:00:00+07:00'}}];
  expanded:unknown[]=[{id:'series-instance',recurringEventId:'series',start:{dateTime:'2026-09-18T08:00:00+07:00'},end:{dateTime:'2026-09-18T09:00:00+07:00'}}];
  remote=new Map<string,Record<string,unknown>>();
  authorize(state:string){return 'https://accounts.google.com/o/oauth2/v2/auth?state='+state;}
  async exchange(_code:string){this.exchanges++;return 'synthetic-refresh-only';}
  async refresh(_token:string){this.refreshes++;if(this.failRefresh)throw new CalendarError('GOOGLE_HTTP_400');return 'synthetic-access';}
  async revoke(_token:string){this.revoked=true;}
  async calendars(_token:string){return [{id:'primary-private',summary:'Classes'}];}
  async createCalendar(_token:string){this.creates++;return 'app-calendar';}
  async events(_token:string,calendar:string,params:Record<string,string>):Promise<EventPage>{
    this.calls.push({calendar,params});
    if(params.syncToken&&this.expireSync){this.expireSync=false;throw new CalendarError('GOOGLE_HTTP_410');}
    if(this.breakPage)throw new CalendarError('GOOGLE_HTTP_503');
    const items=calendar==='app-calendar'?[...this.remote.values()]:(params.singleEvents==='true'?this.expanded:this.raw);
    if(!params.pageToken&&items.length)return {items:items.slice(0,1),nextPageToken:'page2',timeZone:'Asia/Ho_Chi_Minh'};
    return {items:params.pageToken?items.slice(1):[],...(params.singleEvents==='true'?{}:{nextSyncToken:'sync-valid'}),timeZone:'Asia/Ho_Chi_Minh'};
  }
  async getEvent(_token:string,calendar:string,id:string){assert.equal(calendar,'app-calendar');return this.remote.get(id)??null;}
  async insertEvent(_token:string,calendar:string,id:string,interval:Interval,marker:string){
    assert.equal(calendar,'app-calendar');assert.match(id,/^[a-v0-9]{5,1024}$/);this.inserts++;
    const result={id,etag:'etag1',start:{dateTime:new Date(interval.start).toISOString()},end:{dateTime:new Date(interval.end).toISOString()},extendedProperties:{private:{assistantWrite:marker}}};
    this.remote.set(id,result);if(this.loseInsert){this.loseInsert=false;throw new CalendarError('GOOGLE_RESPONSE_UNKNOWN');}return result;
  }
}

test('calendar timezone/all-day/recurring instance conflict and simple slots',()=>{
 const interval=eventInterval({start:{date:'2026-03-08'},end:{date:'2026-03-09'}},'America/New_York')!;
 assert.equal((interval.end-interval.start)/3600000,23);
 assert.equal(eventInterval({status:'cancelled'},'Asia/Ho_Chi_Minh'),null);
 assert.equal(eventInterval({transparency:'transparent'},'UTC'),null);
 assert.throws(()=>eventInterval({start:{date:'2026-02-30'},end:{date:'2026-03-01'}},'UTC'));
 const start=Date.parse('2026-09-18T08:00:00+07:00');
 const choices=slots(start,start+86400000,25,[{start,end:start+3600000}],1320,420);
 assert.equal(choices.length,3);assert.ok(choices[0]!.start>=start+3600000+600000);
});

test('AES-GCM randomized ciphertext binds owner and rejects tampering',async()=>{
 const vault=new GoogleTokenVault('ab'.repeat(32));const a=await vault.seal('123','private-refresh'),b=await vault.seal('123','private-refresh');
 assert.notEqual(a,b);assert.ok(!a.includes('private-refresh'));assert.equal(await vault.open('123',a),'private-refresh');
 await assert.rejects(vault.open('999',a));await assert.rejects(vault.open('123',a.slice(0,-2)+'zz'));
});

test('OAuth browser/state replay, scope separation, paginated sync/410, confirmed writes and remote override',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("offline")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(s:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  let now=Date.parse('2026-09-18T07:00:00+07:00');const api=new FakeGoogle();
  const service=new CalendarService({db,provider:api,tokens:api,vault:new GoogleTokenVault('ab'.repeat(32)),owner:'123',origin:'https://local.example',writes:true,now:()=>now});
  const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'synthetic-secret-long-enough',CALENDAR_MODE:'enabled',CALENDAR_WRITES:'enabled',PUBLIC_ORIGIN:'https://local.example',GOOGLE_CLIENT_ID:'fake-client',GOOGLE_CLIENT_SECRET:'fake-secret',GOOGLE_TOKEN_KEY:'ab'.repeat(32)};
  const worker=createWorker(undefined,async()=>{throw Error('Unexpected network');},{now:()=>now},service);
  assert.equal((await worker.fetch(new Request('https://local.example/oauth/google/start?ticket=abc'),{...env,CALENDAR_MODE:'off'})).status,404);
  const ticket=new URL(await service.connectLink()).searchParams.get('ticket')!;
  const start=await worker.fetch(new Request(`https://local.example/oauth/google/start?ticket=${ticket}`),env);
  assert.equal(start.status,302);assert.match(start.headers.get('set-cookie')!,/HttpOnly/);
  const cookie=start.headers.get('set-cookie')!.split(';')[0]!,state=new URL(start.headers.get('location')!).searchParams.get('state')!;
  const callback=`https://local.example/oauth/google/callback?state=${state}&code=fake-code`;
  assert.equal((await worker.fetch(new Request(callback),env)).status,400);assert.equal(api.exchanges,0);
  assert.equal((await worker.fetch(new Request(callback,{headers:{Cookie:cookie}}),env)).status,200);
  assert.equal((await worker.fetch(new Request(callback,{headers:{Cookie:cookie}}),env)).status,400);assert.equal(api.exchanges,1);
  await assert.rejects(service.start(ticket));
  const connection=await db.prepare('SELECT refresh_cipher FROM calendar_connections').first<{refresh_cipher:string}>();assert.ok(!connection!.refresh_cipher.includes('synthetic-refresh'));
  let command=0;
  const run=(text:string,cb=false)=>service.command({owner:'123',chat:123,updateId:++command,...(cb?{callback:text}:{text})});
  await assert.rejects(service.command({owner:'999',chat:999,updateId:1,text:'/calendar list'}));
  const list=(await run('/calendar list'))!;await run(list.buttons[0]![0]!.callback_data,true);
  const selectedBefore=await db.prepare('SELECT COUNT(*) AS n FROM calendars WHERE selected=1').first<{n:number}>();
  await run(list.buttons[0]![0]!.callback_data,true); // Repeated explicit selection never toggles back.
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM calendars WHERE selected=1').first<{n:number}>())!.n,selectedBefore!.n);
  const setup=(await run('/calendar setup'))!;assert.equal(api.creates,0);
  await run(setup.buttons[0]![0]!.callback_data,true);assert.equal(api.creates,1);
  await run(setup.buttons[0]![0]!.callback_data,true);assert.equal(api.creates,1);
  await service.synchronize();assert.ok(api.calls.some(c=>c.params.pageToken==='page2'));
  api.expireSync=true;await service.synchronize();
  assert.ok(api.calls.some(c=>c.params.syncToken==='sync-valid'&&!c.params.timeMin));
  api.raw=[{id:'series',status:'cancelled'}];await service.synchronize();
  assert.equal(await db.prepare("SELECT external_id FROM calendar_events WHERE external_id='series'").first(),null);
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','test',?)").bind(now).run();
  await db.prepare("INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('s','123','t',?,25,'planned',?)").bind(now+3600000,now+86400000).run();
  const offered=(await run('cal-plan:s',true))!;assert.equal(offered.buttons.length,3);assert.equal(api.inserts,0);
  const button=offered.buttons[0]![0]!.callback_data;
  const disabled=new CalendarService({db,provider:api,tokens:api,vault:new GoogleTokenVault('ab'.repeat(32)),owner:'123',origin:'https://local.example',writes:false,now:()=>now});
  assert.match((await disabled.command({owner:'123',chat:123,updateId:500,callback:button}))!.text,/WRITES_DISABLED/);
  assert.equal(api.inserts,0);
  const offeredTime=await db.prepare('SELECT start_at,end_at FROM calendar_proposals WHERE id=?').bind(button.slice('cal-write:'.length)).first<{start_at:number;end_at:number}>();
  api.expanded.push({id:'new-conflict',start:{dateTime:new Date(offeredTime!.start_at).toISOString()},end:{dateTime:new Date(offeredTime!.end_at).toISOString()}});
  assert.match((await run(button,true))!.text,/SLOT_CONFLICT/);assert.equal(api.inserts,0);
  api.expanded.pop();assert.match((await run(button,true))!.text,/đang chờ/);
  assert.match((await run(button,true))!.text,/STALE_CALENDAR_PROPOSAL/);
  api.loseInsert=true;await service.flushWrites();assert.equal(api.inserts,1);
  await service.flushWrites();assert.equal(api.inserts,1); // Reconcile existing event after lost response.
  assert.equal((await db.prepare('SELECT status FROM calendar_writes').first<{status:string}>())!.status,'synced');
  const event=[...api.remote.values()][0]!;event.etag='user-edited';
  const linkedSession=await db.prepare('SELECT start_at,generation FROM sessions WHERE id=\'s\'').first<{start_at:number;generation:number}>();
  const reminderId=`s:${linkedSession!.generation}:1`;
  await db.prepare("INSERT INTO outbox(id,payload,state,available,reminder_id) VALUES('queued-old','{}','pending',?,?)").bind(now,reminderId).run();
  await service.synchronize();assert.equal((await db.prepare('SELECT status FROM calendar_writes').first<{status:string}>())!.status,'needs_review');
  assert.equal(await reminderAllowed(db,reminderId,linkedSession!.start_at),false);
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='queued-old'").first<{state:string}>())!.state,'failed');
  assert.equal((await db.prepare("SELECT status FROM sessions WHERE id='s'").first<{status:string}>())!.status,'unknown');
  api.remote.clear();await service.synchronize();await service.flushWrites();assert.equal(api.inserts,1);
  api.breakPage=true;await assert.rejects(service.synchronize());
  assert.match((await run('cal-plan:s',true))!.text,/SESSION_NOT_AVAILABLE/);api.breakPage=false;
  api.failRefresh=true;await assert.rejects(service.synchronize());
  assert.equal((await db.prepare('SELECT status FROM calendar_connections').first<{status:string}>())!.status,'reconnect');api.failRefresh=false;
  const disconnect=(await run('/calendar disconnect'))!;await run(disconnect.buttons[0]![0]!.callback_data,true);
  assert.equal(api.revoked,true);assert.equal((await db.prepare('SELECT refresh_cipher FROM calendar_connections').first<{refresh_cipher:null}>())!.refresh_cipher,null);
  const expiredTicket=new URL(await service.connectLink()).searchParams.get('ticket')!;now+=600001;await assert.rejects(service.start(expiredTicket));
 }finally{await mf.dispose();}
});

test('Google adapter uses fixed URLs, minimal write body, no redirects, scope verification and sanitized errors',async()=>{
 const config={clientId:'client',clientSecret:'secret',redirectUri:'https://local.example/oauth/google/callback'};
 const client=new GoogleClient(config,async(url,init)=>{
  assert.equal(init?.redirect,'manual');assert.ok(String(url).startsWith('https://www.googleapis.com/calendar/v3/'));
  const body=JSON.parse(String(init?.body));assert.equal(body.attendees,undefined);assert.equal(body.reminders.useDefault,false);
  return Response.json({...body,etag:'v1'});
 });
 await client.insertEvent('access','app-calendar','abcdef',{start:1,end:600001},'marker');
 assert.ok(SCOPES.includes('https://www.googleapis.com/auth/calendar.app.created'));
 assert.ok(!SCOPES.includes('https://www.googleapis.com/auth/calendar'));
 const bad=new GoogleClient(config,async()=>Response.json({scope:'openid',refresh_token:'secret-refresh'}));
 await assert.rejects(bad.exchange('code'),/MISSING_SCOPES/);
 const broken=new GoogleClient(config,async()=>{throw Error('access-token-leak');});
 await assert.rejects(broken.refresh('private-refresh'),{message:'GOOGLE_RESPONSE_UNKNOWN'});
});

test('P4 review: retry pre-insert reads, fence stale workers and preserve disconnect on late result',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("offline")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(s:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  let now=Date.parse('2026-09-18T07:00:00+07:00');
  const initial=now,start=Date.parse('2026-09-18T10:00:00+07:00');
  const api=new FakeGoogle(),vault=new GoogleTokenVault('ab'.repeat(32));
  const service=new CalendarService({db,provider:api,tokens:api,vault,owner:'123',origin:'https://local.example',writes:true,now:()=>now});
  await db.prepare("INSERT INTO calendar_connections(owner,refresh_cipher,status,managed_id) VALUES('123',?,'ready','app-calendar')").bind(await vault.seal('123','fake-refresh')).run();
  await db.prepare("INSERT INTO calendars(id,owner,external_id,name,selected,managed,synced_at) VALUES('c','123','app-calendar','app',1,1,?)").bind(now).run();
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','test',?)").bind(now).run();
  await db.prepare("INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('s','123','t',?,25,'planned',?)").bind(start,start).run();
  await db.prepare("INSERT INTO calendar_writes(id,owner,session_id,session_version,connection_revision,calendar_id,event_id,start_at,end_at) VALUES('w','123','s',1,1,'app-calendar','abcdef',?,?)").bind(start,start+1500000).run();
  const get=api.getEvent.bind(api),insert=api.insertEvent.bind(api);
  api.getEvent=async()=>{throw new CalendarError('GOOGLE_HTTP_503');};
  await service.flushWrites();
  assert.equal((await db.prepare("SELECT status FROM calendar_writes WHERE id='w'").first<{status:string}>())!.status,'pending');
  assert.equal(api.inserts,0);
  api.getEvent=get;await service.flushWrites();assert.equal(api.inserts,1);
  assert.equal((await db.prepare("SELECT status FROM calendar_writes WHERE id='w'").first<{status:string}>())!.status,'synced');

  const reset=async()=>{
   now=initial;api.remote.clear();api.inserts=0;api.getEvent=get;api.insertEvent=insert;
   await db.prepare("UPDATE calendar_writes SET status='pending',attempts=0 WHERE id='w'").run();
   await db.prepare("UPDATE calendar_connections SET status='ready',revision=1,managed_id='app-calendar',refresh_cipher=? WHERE owner='123'").bind(await vault.seal('123','fake-refresh')).run();
   await db.prepare("DELETE FROM calendar_leases WHERE owner='123'").run();
  };
  await reset();
  api.getEvent=async()=>{
   now+=90001;
   await db.prepare("UPDATE calendar_leases SET token='new-worker',expires=? WHERE owner='123'").bind(now+90000).run();
   return null;
  };
  await assert.rejects(service.flushWrites());assert.equal(api.inserts,0);
  assert.equal((await db.prepare("SELECT token FROM calendar_leases WHERE owner='123'").first<{token:string}>())!.token,'new-worker');
  assert.equal((await db.prepare("SELECT status FROM calendar_writes WHERE id='w'").first<{status:string}>())!.status,'pending');

  await reset();
  api.insertEvent=async(...args)=>{
   const result=await insert(...args);now+=90001;
   await db.prepare("UPDATE calendar_leases SET token='replacement',expires=? WHERE owner='123'").bind(now+90000).run();
   await db.prepare("UPDATE calendar_connections SET status='disconnected',revision=2,refresh_cipher=NULL WHERE owner='123'").run();
   await db.prepare("UPDATE calendar_writes SET status='cancelled' WHERE id='w'").run();
   return result;
  };
  await assert.rejects(service.flushWrites());assert.equal(api.inserts,1);
  assert.equal((await db.prepare("SELECT status FROM calendar_writes WHERE id='w'").first<{status:string}>())!.status,'cancelled');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM transaction_guard').first<{n:number}>())!.n,0);

  await reset();api.getEvent=async()=>{throw new CalendarError('GOOGLE_HTTP_503');};
  await service.flushWrites();await service.flushWrites();await service.flushWrites();await service.flushWrites();
  const exhausted=await db.prepare("SELECT status,attempts FROM calendar_writes WHERE id='w'").first<{status:string;attempts:number}>();
  assert.equal(exhausted!.status,'failed');assert.equal(exhausted!.attempts,3);assert.equal(api.inserts,0);
 }finally{await mf.dispose();}
});
