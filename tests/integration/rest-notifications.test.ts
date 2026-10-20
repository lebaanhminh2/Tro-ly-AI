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
import {RecurrenceStore} from '../../src/adapters/d1/recurrence-store.ts';
import {queueWorkNudge} from '../../src/adapters/d1/work-nudges.ts';

for(const scenario of ['phase-boundary','sleep-race']){
 test('bedtime delivery revalidates after claim: '+scenario,async()=>{
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
  try{
   const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
   for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
   const now=Date.parse(scenario==='phase-boundary'?'2026-10-07T22:29:59.990+07:00':'2026-10-07T22:15:00+07:00');
   const schedule=new ScheduleStore(db);await schedule.configure('123','04:30','22:30',0,now);
   await schedule.queueCheckIns('123',now);
   const row=(await db.prepare("SELECT id FROM outbox WHERE id LIKE 'healthy:bedtime:%'").first<{id:string}>())!;
   assert.ok(row);assert.equal(await schedule.notificationAllowed('123',row.id,now),true);
   let claimed=false,raced=false,current=now;
   const guarded:Database={batch:statements=>db.batch(statements),prepare:sql=>{
    const wrap=(statement:ReturnType<Database['prepare']>):ReturnType<Database['prepare']>=>({
     bind:(...values)=>wrap(statement.bind(...values)),all:()=>statement.all(),
     first:async<T>()=>{
      const result=await statement.first<T>();
      if(scenario==='sleep-race'&&claimed&&!raced&&(sql==='SELECT reported_at FROM sleep_reports WHERE owner=?'||sql.includes('FROM (SELECT ? AS owner) o'))){
       raced=true;await schedule.reportSleep('123',current);
      }
      return result;
     },run:async()=>{
      const result=await statement.run();
      if(sql.includes("SET state='sending',attempts")&&result.meta.changes){
       claimed=true;if(scenario==='phase-boundary')current=now+20;
      }
      return result;
     }
    });return wrap(db.prepare(sql));
   }};
   const env={DB:guarded,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
   const sent:string[]=[];
   const transport:typeof fetch=async(_url,init)=>{sent.push(JSON.parse(String(init?.body)).text);return Response.json({ok:true,result:{message_id:100+sent.length}});};
   await flushOutbox(env,transport,now,()=>current,row.id);
   assert.equal(claimed,true);assert.equal(raced,scenario==='sleep-race');
   assert.deepEqual(sent,[],scenario+': stale proactive sleep message must not reach transport');
   assert.equal((await db.prepare('SELECT state FROM outbox WHERE id=?').bind(row.id).first<{state:string}>())!.state,'failed');
   await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('race-personal','123','Thuốc','Uống thuốc',?)").bind(current).run();
   await queueAppointments(db,'123',current);
   await flushOutbox(env,transport,current,()=>current);
   assert.deepEqual(sent,['Uống thuốc'],'Explicit configured reminder is independent of sleep/bedtime phase');
  }finally{await mf.dispose();}
 });
}

test('undo restores current work notifications without delivering old queued prompts or cancelling personal reminders',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-07T20:00:00+07:00'),schedule=new ScheduleStore(db),day=(await schedule.configure('123','04:30','22:30',0,now))!;
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','Làm báo cáo',?)").bind(now).run();
  await db.prepare("UPDATE schedule_days SET task_plan_status='active',task_plan_generation=1 WHERE owner='123' AND day=?").bind(day.day).run();
  const plan={items:[{taskId:'t',windows:[{start:now,end:now+60000},{start:now+120000,end:now+600000}]}]};
  await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'x',?,?)").bind(day.day,JSON.stringify(plan),now).run();
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  const sent:string[]=[];
  const transport:typeof fetch=async(_url,init)=>{sent.push(JSON.parse(String(init?.body)).text);return Response.json({ok:true,result:{message_id:100+sent.length}});};
  await queueWorkNudge(env,now,transport);
  const report=await schedule.reportSleep('123',now+1000);
  await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('undo-personal','123','Thuốc','Uống thuốc',?)").bind(now+5000).run();
  await queueAppointments(db,'123',now+5000);
  await schedule.undoSleep('123',now+10000,'undo-notifications',report.generation!);
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id LIKE 'task-nudge:%'").first<{state:string}>())!.state,'failed');
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE reminder_id='appointment:undo-personal:1'").first<{state:string}>())!.state,'pending');
  await flushOutbox(env,transport,now+10000,()=>now+10000);
  assert.deepEqual(sent,['Uống thuốc']);
  await queueWorkNudge(env,now+11000,transport);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'task-nudge:%'").first<{n:number}>())!.n,1,'No burst of missed work prompts');
  await queueWorkNudge(env,now+120000,transport);
  await flushOutbox(env,transport,now+120000,()=>now+120000);
  assert.equal(sent.length,2);assert.match(sent[1]!,/Làm báo cáo/);
  assert.equal((await db.prepare("SELECT status FROM tasks WHERE id='t'").first<{status:string}>())!.status,'active');
  assert.equal((await db.prepare("SELECT plan_json FROM daily_plans WHERE owner='123'").first<{plan_json:string}>())!.plan_json,JSON.stringify(plan));
 }finally{await mf.dispose();}
});

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

test('sleep starts immediately and never leaks across the current wake boundary or into the next night',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),at=(v:string)=>Date.parse(v+'+07:00');
  const early=at('2026-09-13T20:00:00');
  await s.configure('123','04:30','22:30',0,early);
  await s.reportSleep('123',early);
  assert.equal((await s.restStatus('123',early)).reason,'asleep');
  assert.equal((await s.restStatus('123',early)).reportedAt,early);
  assert.equal(await s.notificationsPaused('123',early),true);
  assert.equal(await s.personalRemindersPaused('123',early),false);
  assert.equal((await s.restStatus('123',at('2026-09-13T22:29:59'))).reason,'asleep');
  assert.equal((await s.restStatus('123',at('2026-09-13T22:30:00'))).reason,'asleep');
  await s.configure('123','04:05','23:00',1,at('2026-09-13T22:40:00'));
  assert.equal((await s.restStatus('123',at('2026-09-13T22:40:00'))).reason,'asleep');
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
  const preSleep=at('2026-09-13T22:15:00');
  await s.queueCheckIns('123',preSleep);
  assert.ok(await db.prepare("SELECT id FROM outbox WHERE id LIKE 'healthy:bedtime:%:pre15'").first());
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:synthetic',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sent=0;
  const transport:typeof fetch=async()=>{sent++;return Response.json({ok:true,result:{message_id:sent}});};
  await flushOutbox(env,transport,preSleep,()=>preSleep);
  assert.equal(sent,1,'pre-bedtime prompt actually reaches transport before /ngu');
  await s.reportSleep('123',evening);
  assert.equal((await s.restStatus('123',evening)).reason,'asleep');
  assert.equal(await s.notificationsPaused('123',evening),true);
  await s.queueCheckIns('123',evening+20*60000);
  await flushOutbox(env,transport,evening+20*60000,()=>evening+20*60000);
  assert.equal(sent,1,'no further proactive sleep messages after /ngu');
  assert.equal((await executeTool(reminder,work,'123',2,evening)).changes.length,1,'Explicit reminders can still be created while asleep');
  const event=await executeTool({name:'create_event',args:{title:'Sleep',start:reminder.args.at,end:null,remind_at:reminder.args.at,message:'Sleep'}},work,'123',3,evening);
  assert.equal(event.changes.length,1,'Explicit event reminders keep their requested schedule');
  assert.equal(event.result.status,'planned');
  const score=await db.prepare("SELECT * FROM sleep_assessments WHERE owner='123'").first();
  await s.configure('123','01:30','22:30',1,at('2026-09-14T00:00:00'));
  assert.equal((await s.restStatus('123',at('2026-09-14T01:29:59'))).reason,'asleep');
  assert.equal((await s.restStatus('123',at('2026-09-14T01:30:00'))).reason,'active');
  await s.queueCheckIns('123',at('2026-09-14T01:30:00'));
  await flushOutbox(env,transport,at('2026-09-14T01:30:00'),()=>at('2026-09-14T01:30:00'));
  assert.equal(sent,1,'sleep check-ins do not emit the task-planning morning prompt');
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

test('explicit appointments stay deliverable during sleep without altering their expiry',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const s=new ScheduleStore(db),now=Date.parse('2026-09-13T22:35:00+07:00');
  await s.configure('123','04:30','22:30',0,now-3600000);
  await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('r','123','Sleep','Sleep',?)").bind(now).run();
  assert.equal(await appointmentAllowed(db,'appointment:r:1',now),true);
  await s.reportSleep('123',now);
  assert.equal(await appointmentAllowed(db,'appointment:r:1',now),true);
  await queueAppointments(db,'123',now);
  assert.equal((await db.prepare("SELECT status FROM task_appointments WHERE id='r'").first<{status:string}>())!.status,'active');
  assert.ok(await db.prepare("SELECT id FROM outbox WHERE reminder_id='appointment:r:1'").first());
  await queueAppointments(db,'123',now+3600000);
  assert.equal((await db.prepare("SELECT status FROM task_appointments WHERE id='r'").first<{status:string}>())!.status,'expired');
 }finally{await mf.dispose();}
});

test('early sleep blocks queued and upcoming work nudges but sends explicit one-time, task-linked and recurring reminders',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const at=(time:string)=>Date.parse('2026-10-07T'+time+':00+07:00'),now=at('20:00'),due=at('20:30');
  const schedule=new ScheduleStore(db),day=(await schedule.configure('123','04:30','22:30',0,now))!;
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','Làm báo cáo',?)").bind(now).run();
  await db.prepare("UPDATE schedule_days SET task_plan_status='active',task_plan_generation=1 WHERE owner='123' AND day=?").bind(day.day).run();
  const plan={items:[{taskId:'t',windows:[{start:now,end:at('21:00')}]}]};
  await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'x',?,?)").bind(day.day,JSON.stringify(plan),now).run();
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  const sent:string[]=[];
  const transport:typeof fetch=async(_url,init)=>{sent.push(JSON.parse(String(init?.body)).text);return Response.json({ok:true,result:{message_id:100+sent.length}});};
  await queueWorkNudge(env,now,transport);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'task-nudge:%' AND state='pending'").first<{n:number}>())!.n,1);
  await schedule.reportSleep('123',now+60000);
  await flushOutbox(env,transport,now+120000,()=>now+120000);
  assert.equal(sent.length,0,'A nudge queued before sleep must be blocked at delivery');
  await queueWorkNudge(env,due,transport);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'task-nudge:%'").first<{n:number}>())!.n,1,'No further work nudge is generated');
  await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('personal','123','Thuốc','Uống thuốc',?)").bind(due).run();
  await db.prepare("INSERT INTO task_appointments(id,owner,task_id,message,due) VALUES('manual-task','123','t','Làm báo cáo đã hẹn',?)").bind(due).run();
  const recurring=new RecurrenceStore(db);
  await recurring.save({id:'water',owner:'123',title:'Uống nước',kind:'daily',times:['20:30','23:00'],weekdays:[],startDate:'2026-10-07',endDate:null,enabled:true,version:1},0,now);
  await queueAppointments(db,'123',due);
  await recurring.queueDue('123',due,await schedule.personalRemindersPaused('123',due));
  await flushOutbox(env,transport,due,()=>due);
  assert.equal(sent.length,3);
  assert.ok(sent.includes('Uống thuốc'));assert.ok(sent.includes('Làm báo cáo đã hẹn'));assert.ok(sent.some(text=>text.startsWith('Uống nước')));
  assert.equal((await db.prepare("SELECT status FROM tasks WHERE id='t'").first<{status:string}>())!.status,'active');
  assert.equal((await db.prepare("SELECT plan_json FROM daily_plans WHERE owner='123'").first<{plan_json:string}>())!.plan_json,JSON.stringify(plan));
  // Preconfigured reminders still deliver after the target bedtime.
  await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('night','123','Night','Nhắc lúc đêm',?)").bind(at('23:00')).run();
  await queueAppointments(db,'123',at('23:00'));
  await recurring.queueDue('123',at('23:00'),false);
  await flushOutbox(env,transport,at('23:00'),()=>at('23:00'));
  assert.ok(sent.includes('Nhắc lúc đêm'));assert.equal(sent.filter(text=>text.startsWith('Uống nước')).length,2);
  // An explicit global pause still blocks both kinds, including already queued reminders.
  await db.prepare("INSERT INTO task_appointments(id,owner,subject,message,due) VALUES('paused','123','Pause','Không gửi',?)").bind(at('23:10')).run();
  await queueAppointments(db,'123',at('23:10'));
  await db.prepare("INSERT INTO reminder_preferences(owner,quiet_start,quiet_end,pause_until) VALUES('123',0,0,?)").bind(at('23:50')).run();
  const before=sent.length;
  await flushOutbox(env,transport,at('23:10'),()=>at('23:10'));
  assert.equal(sent.length,before);assert.equal(await schedule.personalRemindersPaused('123',at('23:10')),true);
  assert.equal(await appointmentAllowed(db,'appointment:paused:1',at('23:10')),false);
 }finally{await mf.dispose();}
});
