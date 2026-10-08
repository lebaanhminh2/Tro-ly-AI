import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Miniflare} from 'miniflare';
import {HealthyStore} from '../../src/adapters/d1/healthy-store.ts';
import {drawReward} from '../../src/domain/healthy.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';
import {breakthrough} from '../../src/domain/healthy.ts';

test('sleep undo reverses its assessment only, preserves later rewards and allows repeated corrections with immutable retries',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const schedule=new ScheduleStore(db),healthy=new HealthyStore(db),now=Date.parse('2026-10-07T22:29:00+07:00');
  await schedule.configure('123','04:30','22:30',0,now);
  const day=(await schedule.ensureDay('123',now))!;
  await healthy.mutate('123','sleep-seed','seed',{},now,s=>({state:{...s,qi:50,earned:80,rank:3,highestRank:3,streak:5,bestStreak:8,failures:2,tickets:2,heartDay:day.day,peaceDay:day.day},result:{}}));
  const before=(await healthy.read('123')).state;
  const report=await schedule.reportSleep('123',now,'web-report-001');
  assert.equal(report.delta,5);assert.equal((await healthy.read('123')).state.streak,6);
  assert.equal((await schedule.sleepStatus('123',now)).undoUntil,now+300000);
  const duplicate=await schedule.reportSleep('123',now+120000);
  assert.equal(duplicate.applied,false);assert.equal(duplicate.reportedAt,now);
  assert.equal((await schedule.sleepStatus('123',now+120000)).undoUntil,now+300000,'Repeated /ngu cannot extend undo');
  await healthy.checkIn('123','sleep-checkin',{operation:'checkin'},now+1000);
  await db.exec("INSERT INTO tasks(id,owner,title,status,created) VALUES('sleep-completed','123','done','completed',0)");
  await healthy.awardTask('123','sleep-completed',now+2000);
  await healthy.mutate('123','sleep-draw','draw',{},now+3000,s=>{const r=drawReward(s,0);return {state:r.state,result:r.reward};});
  const undo=await schedule.undoSleep('123',now+4000,'web-undo-001',report.generation!);
  const corrected=(await healthy.read('123')).state;
  assert.deepEqual(corrected,{...before,qi:52,earned:82,checkin:corrected.checkin});
  assert.equal(corrected.checkin!.count,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sleep_assessments WHERE owner='123'").first<{n:number}>())!.n,0);
  assert.equal((await schedule.restStatus('123',now+4000)).reason,'active');
  assert.deepEqual(await schedule.undoSleep('123',now+5000,'web-undo-001',report.generation!),undo);
  assert.deepEqual(await schedule.reportSleep('123',now+5000,'web-report-001'),report,'Retry of an undone report must not put the user back to sleep');
  assert.equal((await schedule.sleepStatus('123',now+5000)).asleep,false);
  await assert.rejects(schedule.undoSleep('123',now+5000,'web-undo-stale',report.generation!),/SLEEP_CHANGED/);
  // A new report after the target bedtime scores as late, not at the old timestamp.
  const late=await schedule.reportSleep('123',now+120000,'web-report-002');
  assert.equal(late.delta,0,'Restored peace protection is used by the new assessment');
  assert.equal((await healthy.read('123')).state.streak,5,'Restored heart protection preserves the original streak');
  assert.equal((await schedule.sleepStatus('123',now+120000)).undoUntil,now+420000);
  await assert.rejects(schedule.undoSleep('123',now+120001,'undo-wrong-generation',report.generation!),/SLEEP_CHANGED/);
  await schedule.undoSleep('123',now+121000,'web-undo-002',late.generation!);
  for(let i=0;i<3;i++){
   const result=await schedule.reportSleep('123',now+130000+i*2000,'repeat-report-'+i);
   await schedule.undoSleep('123',now+131000+i*2000,'repeat-undo-'+i,result.generation!);
  }
  assert.deepEqual((await healthy.read('123')).state,corrected,'No daily limit and no reward duplication across repeated report/undo');
  await assert.rejects(schedule.reportSleep('123',now+140000,'web-undo-001'),/REQUEST_ID_REUSED/);
 }finally{await mf.dispose();}
});

test('sleep undo restores late penalties and demotion, expires at five minutes and locks after breakthrough',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const schedule=new ScheduleStore(db),healthy=new HealthyStore(db),now=Date.parse('2026-10-07T22:31:00+07:00');
  await schedule.configure('123','04:30','22:30',0,now-3600000);
  await healthy.mutate('123','late-seed','seed',{},now,s=>({state:{...s,qi:41,earned:70,rank:3,highestRank:3,streak:5,bestStreak:7,failures:2},result:{}}));
  const before=(await healthy.read('123')).state;
  const late=await schedule.reportSleep('123',now,'late-report');
  assert.equal(late.delta,-20);assert.equal(late.demoted,true);
  await schedule.undoSleep('123',now+1000,'late-undo',late.generation!);
  assert.deepEqual((await healthy.read('123')).state,before);
  assert.equal((await schedule.restStatus('123',now+1000)).reason,'bedtime');
  const last=await schedule.reportSleep('123',now+2000,'expired-report');
  assert.equal((await schedule.sleepStatus('123',now+301999)).canUndo,true);
  assert.equal((await schedule.sleepStatus('123',now+302000)).canUndo,false);
  await assert.rejects(schedule.undoSleep('123',now+302000,'expired-undo',last.generation!),/SLEEP_UNDO_EXPIRED/);
  assert.equal((await schedule.sleepStatus('123',now+86400000)).asleep,false);
  await schedule.configure('456','04:30','22:30',0,now-3600000);
  await healthy.mutate('456','breakthrough-seed','seed',{},now,s=>({state:{...s,qi:30,earned:30,streak:3},result:{}}));
  const report=await schedule.reportSleep('456',now-120000,'before-breakthrough');
  const day=(await schedule.ensureDay('456',now))!.day;
  await healthy.mutate('456','after-sleep-breakthrough','breakthrough',{},now,s=>{const r=breakthrough(s,day,now,null,0);return {state:r.state,result:r};});
  assert.equal((await schedule.sleepStatus('456',now)).canUndo,false);
  await assert.rejects(schedule.undoSleep('456',now,'locked-undo',report.generation!),/SLEEP_UNDO_LOCKED/);
  assert.equal((await healthy.read('456')).state.rank,1);
  // Late penalties clipped at zero restore the actual loss, not a fixed +20.
  await schedule.configure('789','04:30','22:30',0,now-3600000);
  await healthy.mutate('789','clipped-seed','seed',{},now,s=>({state:{...s,qi:3,earned:10},result:{}}));
  const clipped=await schedule.reportSleep('789',now,'clipped-report');assert.equal(clipped.delta,-3);
  await schedule.undoSleep('789',now+1000,'clipped-undo',clipped.generation!);
  assert.equal((await healthy.read('789')).state.qi,3);
 }finally{await mf.dispose();}
});

test('sleep reports and undo commit atomically under concurrent clients and a failed transaction',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-07T20:00:00+07:00'),schedule=new ScheduleStore(db),healthy=new HealthyStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  await db.exec("CREATE TRIGGER fail_sleep_insert BEFORE INSERT ON sleep_controls BEGIN SELECT RAISE(ABORT,'injected sleep failure'); END");
  await assert.rejects(schedule.reportSleep('123',now,'failed-sleep-report'));
  assert.equal((await healthy.read('123')).state.qi,0);
  assert.equal((await schedule.restStatus('123',now)).reason,'active');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sleep_assessments").first<{n:number}>())!.n,0);
  assert.equal((await schedule.ensureDay('123',now))!.asleep_at,null);
  await db.exec('DROP TRIGGER fail_sleep_insert');
  const race=await Promise.allSettled([schedule.reportSleep('123',now,'sleep-race-web'),schedule.reportSleep('123',now,'sleep-race-bot')]);
  assert.ok(race.some(r=>r.status==='fulfilled'));
  assert.equal((await healthy.read('123')).state.qi,5);
  const status=await schedule.sleepStatus('123',now);
  assert.equal(status.generation,1);
  const undos=await Promise.allSettled([schedule.undoSleep('123',now+1000,'undo-race-web',status.generation!),schedule.undoSleep('123',now+1000,'undo-race-other',status.generation!)]);
  assert.equal(undos.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await healthy.read('123')).state.qi,0);
  assert.equal((await schedule.sleepStatus('123',now+1000)).asleep,false);
 }finally{await mf.dispose();}
});

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
