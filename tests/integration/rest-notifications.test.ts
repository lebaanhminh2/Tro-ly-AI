import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {executeTool} from '../../src/application/tool-executor.ts';
import {queueAppointments,appointmentAllowed} from '../../src/adapters/d1/conversation-store.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';
import {DatabaseSync} from 'node:sqlite';

test('verified legacy sleep migration restores report and only clears its matching pause',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f<'0017').sort())db.exec(readFileSync('migrations/'+f,'utf8'));
  db.exec(`INSERT INTO command_inbox(owner,update_id,payload,state,created,delivery) VALUES('7526832102',889456715,'{"text":"/ngu"}','done',1789321461968,0);
   INSERT INTO reminder_preferences(owner,quiet_start,quiet_end,pause_until) VALUES('7526832102',0,0,1789335000000),('other',0,0,1789335000000);`);
  const sql=readFileSync('migrations/0017_restore_verified_sleep.sql','utf8');
  db.exec(sql);db.exec(sql);
  assert.equal(db.prepare("SELECT reported_at FROM sleep_reports WHERE owner='7526832102'").get()!.reported_at,1789321461968);
  assert.equal(db.prepare("SELECT pause_until FROM reminder_preferences WHERE owner='7526832102'").get()!.pause_until,0);
  assert.equal(db.prepare("SELECT pause_until FROM reminder_preferences WHERE owner='other'").get()!.pause_until,1789335000000);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sleep_assessments').get()!.n,0);
 }finally{db.close();}
});

test('sleep only silences during current rest interval and never leaks into the next night',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),at=(v:string)=>Date.parse(v+'+07:00');
  const early=at('2026-09-13T20:00:00');
  await s.configure('123','04:30','22:30',0,early);
  await s.reportSleep('123',early);
  assert.equal((await s.restStatus('123',early)).reason,'active');
  assert.equal(await s.notificationsPaused('123',early),false);
  assert.equal((await s.restStatus('123',at('2026-09-13T22:29:59'))).reason,'active');
  assert.equal((await s.restStatus('123',at('2026-09-13T22:30:00'))).reason,'asleep');
  await s.configure('123','04:05','23:00',1,at('2026-09-13T22:40:00'));
  assert.equal((await s.restStatus('123',at('2026-09-13T22:40:00'))).reason,'active');
  assert.equal((await s.restStatus('123',at('2026-09-13T23:00:00'))).reason,'asleep');
  assert.equal((await s.restStatus('123',at('2026-09-14T04:04:59'))).reason,'asleep');
  assert.equal((await s.restStatus('123',at('2026-09-14T04:05:00'))).reason,'active');
  assert.equal((await s.restStatus('123',at('2026-09-14T23:00:00'))).reason,'bedtime');
  assert.equal(await s.notificationsPaused('123',at('2026-09-14T23:00:00')),false);
 }finally{await mf.dispose();}
});

test('sleep state follows current wake setting, explicit pause is separate, and blocked writes never claim success',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),work=new D1WorkStore(db),at=(time:string)=>Date.parse(time+'+07:00');
  const evening=at('2026-09-13T22:35:00');
  await s.configure('123','04:30','22:30',0,at('2026-09-13T08:00:00'));
  assert.equal((await s.restStatus('123',evening)).reason,'bedtime');
  assert.equal(await s.isResting('123',evening),true);
  assert.equal(await s.notificationsPaused('123',evening),false);
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','Work',0)");
  const crossing=await executeTool({name:'plan_work',args:{task_id:'t',expected_version:1,at:'2026-09-13T22:20:00+07:00',minutes:30}},work,'123',9,evening-3600000);
  assert.equal(crossing.changes.length,0,'work block must not cross bedtime');
  const reminder={name:'create_reminder' as const,args:{subject:'Sleep',at:'2026-09-13T22:36:00+07:00',message:'Time to sleep'}};
  assert.equal((await executeTool(reminder,work,'123',1,evening)).changes.length,1);
  await s.queueCheckIns('123',evening);
  assert.ok(await db.prepare("SELECT id FROM outbox WHERE id LIKE 'healthy:bedtime:%'").first());
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:synthetic',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sent=0;
  const transport:typeof fetch=async()=>{sent++;return Response.json({ok:true,result:{message_id:sent}});};
  await flushOutbox(env,transport,evening,()=>evening);
  assert.equal(sent,1,'bedtime prompt actually reaches transport before /ngu');
  await s.reportSleep('123',evening);
  assert.equal((await s.restStatus('123',evening)).reason,'asleep');
  assert.equal(await s.notificationsPaused('123',evening),true);
  await s.queueCheckIns('123',evening+20*60000);
  await flushOutbox(env,transport,evening+20*60000,()=>evening+20*60000);
  assert.equal(sent,1,'no further proactive sleep messages after /ngu');
  assert.equal((await executeTool(reminder,work,'123',2,evening)).changes.length,0);
  const event=await executeTool({name:'create_event',args:{title:'Sleep',start:reminder.args.at,end:null,remind_at:reminder.args.at,message:'Sleep'}},work,'123',3,evening);
  assert.equal(event.changes.length,0);
  assert.equal(event.result.status,'needs_confirmation');
  const score=await db.prepare("SELECT * FROM sleep_assessments WHERE owner='123'").first();
  await s.configure('123','01:30','22:30',1,at('2026-09-14T00:00:00'));
  assert.equal((await s.restStatus('123',at('2026-09-14T01:29:59'))).reason,'asleep');
  assert.equal((await s.restStatus('123',at('2026-09-14T01:30:00'))).reason,'active');
  await s.queueCheckIns('123',at('2026-09-14T01:30:00'));
  await flushOutbox(env,transport,at('2026-09-14T01:30:00'),()=>at('2026-09-14T01:30:00'));
  assert.equal(sent,2,'new wake setting drives morning delivery despite old scoring snapshot');
  assert.deepEqual(await db.prepare("SELECT * FROM sleep_assessments WHERE owner='123'").first(),score);
  assert.equal(await db.prepare("SELECT * FROM reminder_preferences WHERE owner='123'").first(),null);
  // First setup after bedtime must not write an unexplained pause_until.
  await s.configure('456','04:30','22:30',0,evening);
  await s.reportSleep('456',evening);
  assert.equal((await s.restStatus('456',evening)).reason,'asleep');
  assert.equal(await db.prepare("SELECT * FROM reminder_preferences WHERE owner='456'").first(),null);
  const until=at('2026-09-14T06:00:00');
  await db.prepare('INSERT INTO reminder_preferences(owner,quiet_start,quiet_end,pause_until) VALUES(?,0,0,?)').bind('456',until).run();
  assert.deepEqual(await s.restStatus('456',at('2026-09-14T05:00:00')),{reason:'paused',until});
 }finally{await mf.dispose();}
});

test('a sleeping user does not receive an appointment and rest never masquerades as cancellation',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),now=Date.parse('2026-09-13T22:35:00+07:00');
  await s.configure('123','04:30','22:30',0,now-3600000);
  await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('r','123','Sleep','Sleep',?)").bind(now).run();
  assert.equal(await appointmentAllowed(db,'appointment:r:1',now),true);
  await s.reportSleep('123',now);
  assert.equal(await appointmentAllowed(db,'appointment:r:1',now),false);
  await queueAppointments(db,'123',now);
  assert.equal((await db.prepare("SELECT status FROM task_appointments WHERE id='r'").first<{status:string}>())!.status,'active');
  assert.equal(await db.prepare("SELECT id FROM outbox WHERE reminder_id='appointment:r:1'").first(),null);
  await queueAppointments(db,'123',now+3600000);
  assert.equal((await db.prepare("SELECT status FROM task_appointments WHERE id='r'").first<{status:string}>())!.status,'expired');
 }finally{await mf.dispose();}
});
