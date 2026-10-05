import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Miniflare} from 'miniflare';
import {HealthyStore} from '../../src/adapters/d1/healthy-store.ts';
import {drawReward} from '../../src/domain/healthy.ts';
import type {Database} from '../../src/adapters/d1/database.ts';

test('daily rewards atomically persist balances, audit and retry receipts across concurrent clients',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new HealthyStore(db),now=Date.parse('2026-10-05T09:00:00+07:00'),input={operation:'checkin'};
  const first=await store.checkIn('123','checkin-001',input,now);
  assert.deepEqual(await store.checkIn('123','checkin-001',input,now+32*86400000),first,'lost response replays its original reward, not a new cycle');
  await assert.rejects(store.checkIn('123','checkin-002',input,now),/ALREADY_CHECKED_IN/);
  await assert.rejects(store.checkIn('123','checkin-001',{different:true},now),/REQUEST_ID_REUSED/);
  assert.equal((await store.read('123')).state.qi,1);
  const race=await Promise.allSettled([store.checkIn('999','chrome-race',input,now),store.checkIn('999','telegram-race',input,now)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await store.read('999')).state.qi,1);assert.equal((await store.read('999')).state.checkin!.count,1);
  const rows=await db.prepare('SELECT COUNT(*) AS n FROM daily_checkins').first<{n:number}>();assert.equal(rows!.n,2);
  for(let i=1;i<32;i++){if(i===5||i===17)continue;await store.checkIn('123','day-'+i,input,now+i*86400000);}
  const complete=(await store.read('123')).state;
  assert.equal(complete.checkin!.count,30);assert.equal(complete.inventory.supreme,1);
  assert.equal(complete.inventory.basic,3);assert.equal(complete.inventory.middle,3);assert.equal(complete.inventory.high,3);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM daily_checkins WHERE owner='123'").first<{n:number}>())!.n,30);
  await store.checkIn('123','new-cycle',input,now+32*86400000);
  const reset=(await store.read('123')).state;assert.equal(reset.checkin!.count,1);assert.equal(reset.qi,complete.qi+1);assert.equal(reset.inventory.supreme,1);
 }finally{await mf.dispose();}
});
test('inactive mode blocks all proactive outbox deliveries while replies still send',async()=>{
 const {flushOutbox}=await import('../../src/adapters/d1/outbox.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-05T10:00:00+07:00'),healthy=new HealthyStore(db);
  await healthy.mutate('123','suspend-fixture','fixture',{},now,s=>({state:{...s,suspended:true,inactiveDays:3},result:{}}));
  const ids=['task-summary:123:old','achievement:123:new','reply:123:direct','unclassified:123:old'];
  for(const id of ids)await db.prepare('INSERT INTO outbox(id,payload,available) VALUES(?,?,?)').bind(id,JSON.stringify({method:'sendMessage',chat_id:123,text:id}),now).run();
  const sent:string[]=[];
  const transport=(async(_url:unknown,init?:RequestInit)=>{sent.push(JSON.parse(String(init?.body)).text);return Response.json({ok:true,result:{message_id:42}});}) as typeof fetch;
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',AI_MODE:'off',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('asset')}};
  await flushOutbox(env,transport,now,()=>now);
  assert.deepEqual(sent,['reply:123:direct']);
  for(const id of ids.filter(id=>!id.startsWith('reply:')))assert.equal((await db.prepare('SELECT state FROM outbox WHERE id=?').bind(id).first<{state:string}>())?.state,'failed');
  await healthy.mutate('123','race-resume','fixture',{},now,s=>({state:{...s,suspended:false},result:{}}));
  await db.prepare('INSERT INTO outbox(id,payload,available) VALUES(?,?,?)').bind('unclassified:123:race',JSON.stringify({method:'sendMessage',chat_id:123,text:'race'}),now).run();
  const guarded:Database={batch:statements=>db.batch(statements),prepare:sql=>{
   const statement=db.prepare(sql);
   if(!sql.includes("SET state='sending',attempts"))return statement;
   const wrap=(bound:typeof statement):typeof statement=>({bind:(...values)=>wrap(bound.bind(...values)),first:()=>bound.first(),all:()=>bound.all(),run:async()=>{
    const result=await bound.run();
    if(result.meta.changes)await healthy.mutate('123','race-suspend','fixture',{},now,s=>({state:{...s,suspended:true},result:{}}));
    return result;
   }});
   return wrap(statement);
  }};
  await flushOutbox({...env,DB:guarded},transport,now,()=>now);
  assert.deepEqual(sent,['reply:123:direct']);
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='unclassified:123:race'").first<{state:string}>())?.state,'failed');
 }finally{await mf.dispose();}
});

test('cron settles inactive days before delivering previously queued notifications',async()=>{
 const {runScheduled}=await import('../../src/entrypoints/worker-scheduler.ts');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const start=Date.parse('2026-10-01T10:00:00+07:00'),now=start+4*86400000;
  await new ScheduleStore(db).configure('123','04:30','22:30',0,start);
  await db.prepare('INSERT INTO outbox(id,payload,available) VALUES(?,?,?)').bind('task-summary:123:queued',JSON.stringify({method:'sendMessage',chat_id:123,text:'Must not send'}),start).run();
  let sends=0;const transport=(async()=>{sends++;return Response.json({ok:true,result:{message_id:42}});}) as typeof fetch;
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',AI_MODE:'off',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('asset')}};
  await runScheduled(env,{cardsEnabled:false,transport,clock:{now:()=>now},chat:undefined,flushCards:async()=>{}});
  assert.equal((await new HealthyStore(db).read('123')).state.suspended,true);assert.equal(sends,0);
 }finally{await mf.dispose();}
});

test('task codes survive sorting and deletion; migration preserves old task IDs',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f<'0013').sort())db.exec(readFileSync('migrations/'+f,'utf8'));
  db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('b','123','B',2),('a','123','A',1)");
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f>='0013').sort())db.exec(readFileSync('migrations/'+f,'utf8'));
  assert.equal(db.prepare("SELECT public_code FROM tasks WHERE id='a'").get()!.public_code,1);
  db.exec("DELETE FROM tasks WHERE id='b'; INSERT INTO tasks(id,owner,title,created) VALUES('c','123','C',0)");
  assert.equal(db.prepare("SELECT public_code FROM tasks WHERE id='c'").get()!.public_code,3);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});
test('reward receipt survives retry, never draws twice, and isolates owners',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new HealthyStore(db);
  await store.mutate('123','seed','test-fixture',{},1000,s=>({state:{...s,tickets:1},result:{ok:true}}));
  let rolls=0;
  const apply=()=>store.mutate('123','draw1','draw',{},2000,s=>{rolls++;const out=drawReward(s,0);return {state:out.state,result:{reward:out.reward}};});
  assert.deepEqual(await apply(),{reward:'qi1'});assert.deepEqual(await apply(),{reward:'qi1'});
  assert.equal(rolls,1);assert.equal((await store.read('123')).state.tickets,0);
  assert.equal((await store.read('123')).state.earned,1);
  assert.equal((await store.read('999')).state.qi,0);
  await assert.rejects(store.mutate('123','draw1','draw',{different:true},2000,s=>({state:s,result:{}})),/REUSED/);
 }finally{await mf.dispose();}
});

test('recurrence generates future reminders without recreating skipped or sent instances',async()=>{
 const {RecurrenceStore}=await import('../../src/adapters/d1/recurrence-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new RecurrenceStore(db),now=Date.parse('2026-09-13T09:00:00+07:00');
  await store.save({id:'r',owner:'123',title:'water',kind:'daily',times:['09:00'],weekdays:[],startDate:'2026-09-13',endDate:null,enabled:true,version:1},0,now);
  await store.queueDue('123',now,false);await store.queueDue('123',now,false);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM outbox').first<{n:number}>())!.n,1);
  await store.queueDue('123',now+86400000,true);
  await store.queueDue('123',now+86400000,false);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM outbox').first<{n:number}>())!.n,1);
  await store.queueDue('123',now+2*86400000,false);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM outbox').first<{n:number}>())!.n,2);
 }finally{await mf.dispose();}
});

test('missed sleep scoring persists only three inactive penalties and resumption skips debt',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const schedule=new ScheduleStore(db),healthy=new HealthyStore(db);
  const now=Date.parse('2026-09-13T08:00:00+07:00');
  await schedule.configure('123','04:30','22:30',0,now);
  await healthy.mutate('123','seed','fixture',{},now,s=>({state:{...s,qi:200},result:{}}));
  await schedule.settleClosedDays('123',now+10*86400000);
  let account=await healthy.read('123');
  assert.equal(account.state.qi,140);assert.equal(account.state.suspended,true);
  await schedule.settleClosedDays('123',now+11*86400000);
  assert.equal((await healthy.read('123')).state.qi,140);
  const count=await db.prepare('SELECT COUNT(*) AS n FROM sleep_assessments').first<{n:number}>();
  assert.equal(count!.n,3);
  await schedule.chatActivity('123',now+12*86400000,'new-message');
  account=await healthy.read('123');
  assert.equal(account.state.suspended,false);assert.equal(account.state.qi,140);
 }finally{await mf.dispose();}
});

test('chat completion sync awards exactly one ticket and no historical rewards',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f<'0015').sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,status,created) VALUES('old','123','old','completed',0),('new','123','new','active',0)");
  await db.exec(readFileSync('migrations/0015_healthy.sql','utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-13T08:00:00+07:00'),store=new HealthyStore(db);
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await store.syncTaskTickets('123',now);
  assert.equal((await store.read('123')).state.tickets,0);
  await db.exec("UPDATE tasks SET status='completed' WHERE id='new'");
  await store.syncTaskTickets('123',now);await store.syncTaskTickets('123',now);
  assert.equal((await store.read('123')).state.tickets,1);
  await db.exec("UPDATE tasks SET status='active' WHERE id='new'; UPDATE tasks SET status='completed' WHERE id='new'");
  await store.syncTaskTickets('123',now);
  assert.equal((await store.read('123')).state.tickets,1);
 }finally{await mf.dispose();}
});

test('new settings apply to following days without overlapping or shortening existing rest',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  const first=await s.configure('123','04:30','22:30',0,now);
  await s.configure('123','05:30','23:30',1,now,'change-clock');
  await s.reportSleep('123',Date.parse('2026-09-13T22:00:00+07:00'));
  const gap=Date.parse('2026-09-14T05:00:00+07:00');
  await s.settleClosedDays('123',gap);
  assert.equal(await s.ensureDay('123',gap),null);
  assert.equal(await s.isResting('123',gap),true);
  const nextTime=Date.parse('2026-09-14T05:30:00+07:00');
  await s.settleClosedDays('123',nextTime);
  const next=(await s.ensureDay('123',nextTime))!;
  assert.equal(new Date(next.target_sleep).toISOString(),'2026-09-14T16:30:00.000Z');
  assert.ok(next.start_at>=first!.end_at);
  assert.equal(await s.isResting('123',nextTime),false);
 }finally{await mf.dispose();}
});

test('delayed morning and bedtime notifications expire instead of sending after their window',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),now=Date.parse('2026-09-13T04:30:00+07:00');
  const day=(await s.configure('123','04:30','22:30',0,now))!;
  const morning='healthy:morning:123:'+day.day,pre='healthy:bedtime:123:'+day.day+':pre30',post='healthy:bedtime:123:'+day.day+':post20',legacy='healthy:bedtime:123:'+day.day+':0';
  assert.equal(await s.notificationAllowed('123',morning,now),true);
  assert.equal(await s.notificationAllowed('123',morning,now+3600000),false);
  assert.equal(await s.notificationAllowed('123',pre,day.target_sleep-30*60000),true);
  assert.equal(await s.notificationAllowed('123',pre,day.target_sleep-15*60000),false);
  assert.equal(await s.notificationAllowed('123',post,day.target_sleep+20*60000),true);
  assert.equal(await s.notificationAllowed('123',post,day.target_sleep+40*60000),false);
  assert.equal(await s.notificationAllowed('123',legacy,day.target_sleep),false,'old exact-bedtime messages are invalid');
  assert.equal(await s.notificationAllowed('999',pre,day.target_sleep-30*60000),false);
 }finally{await mf.dispose();}
});

test('first setup after bedtime does not create retroactive missed-sleep penalties',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),now=Date.parse('2026-09-13T23:30:00+07:00');
  assert.equal(await s.configure('123','04:30','22:30',0,now),null);
  const report=await s.reportSleep('123',now);assert.equal(report.delta,0);
  await s.settleClosedDays('123',now+3600000);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sleep_assessments').first<{n:number}>())!.n,0);
  assert.ok(await s.ensureDay('123',Date.parse('2026-09-14T05:00:00+07:00')));
 }finally{await mf.dispose();}
});
