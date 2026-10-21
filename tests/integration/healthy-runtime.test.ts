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
import {sqliteDatabase} from '../../scripts/benchmark-habit-runtime.ts';

async function ticketRecoveryFixture() {
 const raw=new DatabaseSync(':memory:');
 for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())raw.exec(readFileSync('migrations/'+file,'utf8'));
 raw.exec('PRAGMA foreign_keys=ON');
 let queries=0;
 const db=sqliteDatabase(raw,()=>queries++),now=Date.parse('2026-10-21T10:03:00+07:00');
 await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
 const seed=(id:string,owner='123',status='completed',deleted:number|null=null)=>raw.prepare('INSERT INTO tasks(id,owner,title,status,created,deleted_at) VALUES(?,?,?,?,?,?)').run(id,owner,id,status,now,deleted);
 return {raw,db,now,seed,reset:()=>{queries=0;},queries:()=>queries};
}

test('ticket recovery bounds a batch, preserves state and individual receipts, and drains without duplicates',async()=>{
 const f=await ticketRecoveryFixture();
 try{
  const store=new HealthyStore(f.db),ids=Array.from({length:27},(_,i)=>'task-'+String(i).padStart(2,'0')+'"');
  for(const id of ids)f.seed(id);
  f.seed('foreign','999');f.seed('active','123','active');f.seed('deleted','123','completed',f.now);
  await store.mutate('123','seed-balance','fixture',{},f.now,s=>({state:{...s,tickets:7,qi:42},result:{}}));
  const before=await store.read('123');f.reset();
  await store.syncTaskTickets('123',f.now);
  assert.ok(f.queries()<=8,`25 awards used ${f.queries()} queries`);
  let account=await store.read('123');
  assert.deepEqual(account,{state:{...before.state,tickets:32},version:before.version+25});
  const receipts=f.raw.prepare("SELECT * FROM cultivation_receipts WHERE operation='task-ticket' ORDER BY request_id").all();
  assert.equal(receipts.length,25);
  for(const receipt of receipts){
   assert.equal(receipt.owner,'123');assert.equal(receipt.created,f.now);
   const request=JSON.parse(String(receipt.request_json));
   assert.equal(receipt.request_id,'ticket:'+request.taskId);
   assert.deepEqual(JSON.parse(String(receipt.result_json)),{ticket:1});
  }
  assert.deepEqual(await store.awardTask('123',ids[0]!,f.now+1),{ticket:1});
  assert.deepEqual(await store.read('123'),account);
  await store.syncTaskTickets('123',f.now+2);
  account=await store.read('123');
  assert.deepEqual(account,{state:{...before.state,tickets:34},version:before.version+27});
  await store.syncTaskTickets('123',f.now+3);
  assert.deepEqual(await store.read('123'),account);
  assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM task_ticket_awards').get()!.n,27);
  assert.deepEqual(f.raw.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{f.raw.close();}
});

test('ticket recovery rolls back balance and every receipt when an award insert fails',async()=>{
 const f=await ticketRecoveryFixture();
 try{
  for(const id of ['a','b','c'])f.seed(id);
  const store=new HealthyStore(f.db),before=await store.read('123');
  f.raw.exec("CREATE TRIGGER fail_ticket BEFORE INSERT ON task_ticket_awards WHEN NEW.task_id='b' BEGIN SELECT RAISE(ABORT,'injected ticket failure'); END");
  await assert.rejects(store.syncTaskTickets('123',f.now),/injected ticket failure/);
  assert.deepEqual(await store.read('123'),before);
  for(const table of ['task_ticket_awards','cultivation_receipts','transaction_guard'])assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM '+table).get()!.n,0);
  f.raw.exec('DROP TRIGGER fail_ticket');
  await store.syncTaskTickets('123',f.now);
  assert.equal((await store.read('123')).state.tickets,3);
 }finally{f.raw.close();}
});

test('ticket recovery guards suspension, task changes and setup changes between selection and commit',async()=>{
 for(const change of [
  "UPDATE cultivation_accounts SET state_json=json_set(state_json,'$.suspended',json('true')),version=version+1 WHERE owner='123'",
  "UPDATE tasks SET status='active',version=version+1 WHERE id='a'",
  "UPDATE tasks SET deleted_at=1,version=version+1 WHERE id='a'",
  "UPDATE tasks SET title='edited',version=version+1 WHERE id='a'",
  "UPDATE schedule_settings SET sleep_minutes=NULL WHERE owner='123'",
 ]){
  const f=await ticketRecoveryFixture();
  try{
   f.seed('a');f.seed('b');
   await new HealthyStore(f.db).mutate('123','seed','fixture',{},f.now,s=>({state:{...s,qi:42},result:{}}));
   let changed=false;
   const guarded:Database={prepare:sql=>f.db.prepare(sql),batch:async statements=>{
    if(!changed){changed=true;f.raw.exec(change);}
    return f.db.batch(statements);
   }};
   await assert.rejects(new HealthyStore(guarded).syncTaskTickets('123',f.now));
   const account=await new HealthyStore(f.db).read('123');
   assert.equal(account.state.qi,42);assert.equal(account.state.tickets,0);
   assert.equal(account.state.suspended,change.includes('suspended'));
   assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM task_ticket_awards').get()!.n,0);
   assert.equal(f.raw.prepare("SELECT COUNT(*) AS n FROM cultivation_receipts WHERE operation='task-ticket'").get()!.n,0);
  }finally{f.raw.close();}
 }
});

test('concurrent D1 ticket recovery commits once and remains compatible with awardTask replay',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-21T10:03:00+07:00');
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await db.batch(Array.from({length:25},(_,i)=>db.prepare("INSERT INTO tasks(id,owner,title,status,created) VALUES(?,'123',?,'completed',?)").bind('t'+i,'Task '+i,now+i)));
  await Promise.all([new HealthyStore(db).syncTaskTickets('123',now),new HealthyStore(db).syncTaskTickets('123',now)]);
  const store=new HealthyStore(db),account=await store.read('123');
  assert.equal(account.state.tickets,25);assert.equal(account.version,25);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM task_ticket_awards').first<{n:number}>())!.n,25);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM cultivation_receipts WHERE operation='task-ticket'").first<{n:number}>())!.n,25);
  assert.deepEqual(await store.awardTask('123','t0',now+1),{ticket:1});
  assert.deepEqual(await store.read('123'),account);
 }finally{await mf.dispose();}
});

test('ticket recovery rejects reused receipt IDs before awarding any selected task',async()=>{
 const f=await ticketRecoveryFixture();
 try{
  f.seed('a');f.seed('b');
  await new HealthyStore(f.db).mutate('123','ticket:b','different-operation',{},f.now,s=>({state:s,result:{}}));
  await assert.rejects(new HealthyStore(f.db).syncTaskTickets('123',f.now),/REQUEST_ID_REUSED/);
  assert.equal((await new HealthyStore(f.db).read('123')).state.tickets,0);
  assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM task_ticket_awards').get()!.n,0);
 }finally{f.raw.close();}
});

test('rest snapshots use one read, preserve precedence and immediately reflect sleep, undo and wake',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-21T20:00:00+07:00'),schedule=new ScheduleStore(db),healthy=new HealthyStore(db);
  const day=(await schedule.configure('123','04:30','22:30',0,now))!;
  let reads=0;
  const reader=new ScheduleStore({prepare:sql=>{reads++;return db.prepare(sql);},batch:statements=>db.batch(statements)});
  const status=async(owner='123',time=now)=>{reads=0;const value=await reader.restStatus(owner,time);assert.equal(reads,1,'Rest checks must fit one D1 round trip');return value;};
  assert.deepEqual(await status(),{reason:'active',until:null});
  assert.deepEqual(await status('999'),{reason:'active',until:null});
  const report=await schedule.reportSleep('123',now,'snapshot-sleep');
  assert.deepEqual(await status(),{reason:'asleep',until:day.end_at,reportedAt:now});
  await db.prepare("INSERT INTO reminder_preferences(owner,quiet_start,quiet_end,pause_until) VALUES('123',0,0,?)").bind(now+60000).run();
  assert.deepEqual(await status(),{reason:'paused',until:now+60000});
  await healthy.mutate('123','snapshot-suspend','fixture',{},now,s=>({state:{...s,suspended:true},result:{}}));
  assert.deepEqual(await status(),{reason:'inactive',until:null});
  assert.deepEqual(await status('999'),{reason:'active',until:null});
  await healthy.mutate('123','snapshot-resume','fixture',{},now,s=>({state:{...s,suspended:false},result:{}}));
  assert.equal((await status()).reason,'paused');
  await db.prepare("UPDATE reminder_preferences SET pause_until=0 WHERE owner='123'").run();
  assert.equal((await status()).reason,'asleep');
  await schedule.undoSleep('123',now+1000,'snapshot-undo',report.generation!);
  assert.equal((await status('123',now+1000)).reason,'active');
  await schedule.reportSleep('123',now+2000,'snapshot-sleep-again');
  assert.equal((await status('123',Date.parse('2026-10-22T00:30:00+07:00'))).reason,'asleep');
  assert.equal((await status('123',day.end_at)).reason,'active');
  assert.equal((await status('123',Date.parse('2026-10-22T22:35:00+07:00'))).reason,'bedtime');
 }finally{await mf.dispose();}
});

test('chat settles an older unassessed day even when the current day already exists',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-20T12:00:00+07:00'),schedule=new ScheduleStore(db),healthy=new HealthyStore(db);
  const previous=(await schedule.configure('123','04:30','22:30',0,now))!;
  await healthy.mutate('123','settlement-seed','fixture',{},now,s=>({state:{...s,qi:100},result:{}}));
  const current=(await schedule.ensureDay('123',now+86400000))!;
  await schedule.chatActivity('123',now+86400000,'first-chat');
  assert.equal((await healthy.read('123')).state.qi,80);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sleep_assessments WHERE day=?').bind(previous.day).first<{n:number}>())!.n,1);
  assert.equal((await schedule.ensureDay('123',now+86400000))!.last_chat_at,now+86400000);
  await schedule.chatActivity('123',now+86401000,'second-chat');
  assert.equal((await healthy.read('123')).state.qi,80);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sleep_assessments WHERE day=?').bind(current.day).first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});

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

test('bounded cron catch-up holds queued notifications until inactive days are settled',async()=>{
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
  for(let tick=0;tick<4;tick++){
   await runScheduled(env,{cardsEnabled:false,transport,clock:{now:()=>now+tick*60000},chat:undefined,flushCards:async()=>{}});
   assert.equal(sends,0,'No proactive messages between bounded sleep assessments');
  }
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
