import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {changeTaskFocus,currentTaskFocus,taskFocusTarget,queuePlanConfirmation,queueWorkNudge,receiveNudgeReply,acknowledgeTaskNudge} from '../../src/adapters/d1/work-nudges.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';

async function fixture(taskIds:string[]){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
 for(const file of readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
 const now=Date.parse('2026-09-14T09:00:00+07:00'),schedule=new ScheduleStore(db);
 const day=(await schedule.configure('123','04:30','22:30',0,now))!;
 for(const id of taskIds)await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES(?,'123',?,0)").bind(id,id.toUpperCase()).run();
 const plan={items:taskIds.map(taskId=>({taskId,windows:[{start:now,end:now+8*3600000}]}))};
 await db.prepare("UPDATE schedule_days SET task_plan_status='active',task_plan_generation=1,task_plan_effective_from=? WHERE owner='123' AND day=?").bind(now,day.day).run();
 await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'x',?,?)").bind(day.day,JSON.stringify(plan),now).run();
 return {mf,db,now,day,plan};
}

test('explicit Telegram Reply cancels a queued repeat, preserves task/focus and allows the next window',async()=>{
 const {mf,db,now}=await fixture(['a']);
 try{
  const end=now+3600000,later=now+2*3600000;
  await db.prepare("UPDATE daily_plans SET plan_json=? WHERE owner='123'").bind(JSON.stringify({items:[{taskId:'a',windows:[{start:now,end},{start:later,end:later+3600000}]}]})).run();
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sends=0;const transport:typeof fetch=async()=>{sends++;return Response.json({ok:true,result:{message_id:100+sends}});};
  const tick=async(at:number)=>{await queueWorkNudge(env,at,transport);await flushOutbox(env,transport,at,()=>at);};
  await tick(now);assert.equal(sends,1);
  await queueWorkNudge(env,now+30*60000,transport);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE state='pending' AND id LIKE 'task-nudge:%'").first<{n:number}>())!.n,1);
  await receiveNudgeReply(env,500,'biết rồi nhé',now+31*60000,transport,101);
  await receiveNudgeReply(env,500,'biết rồi nhé',now+31*60000,transport,101);
  await flushOutbox(env,transport,now+32*60000,()=>now+32*60000);await tick(now+50*60000);assert.equal(sends,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM task_nudge_acknowledgments').first<{n:number}>())!.n,1);
  assert.equal((await db.prepare("SELECT status FROM tasks WHERE id='a'").first<{status:string}>())!.status,'active');
  assert.equal(await currentTaskFocus(db,'123',now+32*60000),null,'reply does not pretend the user is working');
  await tick(later);assert.equal(sends,2,'same task can be reminded in its next distinct window');
  assert.equal(await acknowledgeTaskNudge(db,'999',102,later+60000),false,'owners are isolated');
  assert.equal(await acknowledgeTaskNudge(db,'123',101,later+60000),false,'replying to an expired older window does not silence the new one');
  await tick(later+30*60000);assert.equal(sends,3);
 }finally{await mf.dispose();}
});

test('ordinary chat or Reply to unrelated messages does not acknowledge a task reminder',async()=>{
 const {mf,db,now}=await fixture(['a']);
 try{
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sends=0;const transport:typeof fetch=async()=>{sends++;return Response.json({ok:true,result:{message_id:200+sends}});};
  await queueWorkNudge(env,now,transport);await flushOutbox(env,transport,now,()=>now);
  await receiveNudgeReply(env,501,'hello',now+60000,transport);
  await receiveNudgeReply(env,502,'hello',now+2*60000,transport,999);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM task_nudge_acknowledgments').first<{n:number}>())!.n,0);
  await queueWorkNudge(env,now+30*60000,transport);await flushOutbox(env,transport,now+30*60000,()=>now+30*60000);assert.equal(sends,2);
 }finally{await mf.dispose();}
});

test('a schedule window gets at most two nudges and unanswered task nudges stop globally after three',async()=>{
 const {mf,db,now,day,plan}=await fixture(['a','b']);
 try{
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,AI_MODE:'on',GEMINI_API_KEY:'test',GEMINI_MODEL:'test',ASSETS:{fetch:async()=>new Response('')}};
  let sent=0,calls=0;
  const transport:typeof fetch=async(url,init)=>{
   if(String(url).includes('generativelanguage')){calls++;return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify({text:'Mình bắt đầu nhé cậu :>',next_minutes:15})}]}}]});}
   assert.equal(JSON.parse(String(init?.body))._taskNudge,undefined);sent++;return Response.json({ok:true,result:{message_id:sent}});
  };
  const tick=async(at:number)=>{await queueWorkNudge(env,at,transport);await flushOutbox(env,transport,at,()=>at);};
  await tick(now);await tick(now+15*60000);await tick(now+30*60000);await tick(now+45*60000);
  assert.equal(sent,3);assert.equal(calls,3);
  const state=await db.prepare("SELECT consecutive_unanswered,task_counts_json FROM task_nudge_state WHERE owner='123'").first<{consecutive_unanswered:number;task_counts_json:string}>();
  assert.equal(state!.consecutive_unanswered,3);assert.deepEqual(JSON.parse(state!.task_counts_json),{a:2,b:1});
  await db.prepare("UPDATE daily_plans SET version=version+1 WHERE owner='123'").run();
  await db.prepare("UPDATE schedule_days SET task_plan_generation=task_plan_generation+1 WHERE owner='123' AND day=?").bind(day.day).run();
  await tick(now+60*60000);assert.equal(sent,3,'replanning does not reset unanswered silence');
  await receiveNudgeReply(env,77,'tớ đây',now+61*60000,transport);
  await tick(now+62*60000);assert.equal(sent,3,'a reply never opens an immediate new nudge window');
  await tick(now+76*60000);assert.equal(sent,4,'a reply permits later follow-up without erasing per-task counts');
  const reset=await db.prepare("SELECT consecutive_unanswered FROM task_nudge_state WHERE owner='123'").first<{consecutive_unanswered:number}>();
  assert.equal(reset!.consecutive_unanswered,1);
  assert.equal((await db.prepare("SELECT status FROM tasks WHERE id='a'").first<{status:string}>())!.status,'active');
  assert.ok(plan.items.length===2);
 }finally{await mf.dispose();}
});

test('acknowledging the current scheduled block silences task nudges exactly until its dynamic end',async()=>{
 const {mf,db,now,day}=await fixture(['a']);
 try{
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let taskMessages=0,otherMessages=0;
  const transport:typeof fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));if(String(body.text).includes('unrelated'))otherMessages++;else taskMessages++;return Response.json({ok:true,result:{message_id:taskMessages+otherMessages}});};
  await queueWorkNudge(env,now,transport);
  const focus=await changeTaskFocus(db,'123','focus_start_001','start',now+60000);
  assert.equal(focus.endsAt,now+8*3600000,'end comes from the current plan window, not a fixed duration');
  assert.deepEqual(await currentTaskFocus(db,'123',now+2*60000),{taskId:'a',day:day.day,planGeneration:1,planVersion:1,startedAt:now+60000,endsAt:now+8*3600000});
  await db.prepare("INSERT INTO outbox(id,payload,available) VALUES('other-reminder',?,?)").bind(JSON.stringify({method:'sendMessage',chat_id:123,text:'unrelated personal reminder'}),now+2*60000).run();
  await flushOutbox(env,transport,now+2*60000,()=>now+2*60000);
  assert.equal(taskMessages,0,'a task nudge queued before the tap is invalidated');assert.equal(otherMessages,1,'non-task reminders are unaffected');
  await queueWorkNudge(env,now+30*60000,transport);await flushOutbox(env,transport,now+30*60000,()=>now+30*60000);
  assert.equal(taskMessages,0,'no follow-up is queued while focus is active');
  await changeTaskFocus(db,'123','focus_stop_001','stop',now+3*60000);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM task_focus_state WHERE owner='123'").first<{n:number}>().then(row=>row!.n),0);
  await changeTaskFocus(db,'123','focus_start_003','start',now+4*60000);
  assert.equal(await currentTaskFocus(db,'123',now+8*3600000),null,'focus expires at the scheduled window end');
  const replay=await changeTaskFocus(db,'123','focus_start_003','start',now+9*3600000);
  assert.equal(replay.endsAt,now+8*3600000,'a lost response can be retried after the window without changing the acknowledged end');
 }finally{await mf.dispose();}
});

test('focus acknowledgement resolves the current task on the server and is invalidated by replan',async()=>{
 const {mf,db,now}=await fixture(['a','b']);
 try{
  const after=await changeTaskFocus(db,'123','focus_after_001','start',now+8*3600000);
  assert.equal(after.taskId,null,'after the final session a day-scoped acknowledgement is allowed');
  const focus=await changeTaskFocus(db,'123','focus_start_002','start',now);
  assert.equal(focus.taskId,'a','the global action follows the first current plan item');
  await db.prepare("UPDATE daily_plans SET version=version+1 WHERE owner='123'").run();
  assert.equal(await currentTaskFocus(db,'123',now+60000),null);
 }finally{await mf.dispose();}
});

test('anytime focus selects the nearest session, survives its start, and expires before later sessions',async()=>{
 const {mf,db,now}=await fixture(['a']);
 try{
  const end=now+2*3600000,later=now+4*3600000;
  await db.prepare("UPDATE daily_plans SET plan_json=? WHERE owner='123'").bind(JSON.stringify({items:[{taskId:'a',windows:[{start:now,end},{start:later,end:later+3600000}]}]})).run();
  const target=await taskFocusTarget(db,'123',now-60000);
  const result=await changeTaskFocus(db,'123','early','start',now-60000);
  assert.equal(result.endsAt,target.endsAt);assert.equal(result.endsAt,end);
  assert.ok(await currentTaskFocus(db,'123',now+60000));
  assert.equal(await currentTaskFocus(db,'123',end),null);
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sends=0;
  const transport:typeof fetch=async()=>{sends++;return Response.json({ok:true,result:{message_id:sends}});};
  await queueWorkNudge(env,later,transport);await flushOutbox(env,transport,later,()=>later);
  assert.equal(sends,1,'later sessions can send after expiry');
  const between=await changeTaskFocus(db,'123','between','start',end+60000);
  assert.equal(between.endsAt,later+3600000);
  assert.ok(await currentTaskFocus(db,'123',end+60000));
  await changeTaskFocus(db,'123','manual-stop','stop',end+120000);
  assert.equal(await currentTaskFocus(db,'123',end+120000),null);
  await changeTaskFocus(db,'123','before-completion','start',end+180000);
  await db.prepare("UPDATE tasks SET status='completed' WHERE id='a'").run();
  assert.equal(await currentTaskFocus(db,'123',end+240000),null);
 }finally{await mf.dispose();}
});

test('no-plan focus is persisted to the day boundary and invalidated when a plan is introduced',async()=>{
 const {mf,db,now,day}=await fixture([]);
 try{
  await db.prepare("DELETE FROM daily_plans WHERE owner='123'").run();
  const started=await changeTaskFocus(db,'123','empty-day','start',now);
  assert.equal(started.taskId,null);assert.equal(started.endsAt,day.end_at);
  assert.ok(await currentTaskFocus(db,'123',now+60000));
  assert.equal(await currentTaskFocus(db,'123',day.end_at),null);
  await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'new',?,?)").bind(day.day,JSON.stringify({items:[]}),now+60000).run();
  assert.equal(await currentTaskFocus(db,'123',now+120000),null);
  const unconfigured=await changeTaskFocus(db,'456','no-settings','start',now);
  assert.equal(unconfigured.endsAt,Date.parse('2026-09-15T00:00:00+07:00'));
  assert.ok(await currentTaskFocus(db,'456',now+60000));
 }finally{await mf.dispose();}
});

test('overlapping cron claims once and queued task nudges are invalidated at final send',async()=>{
 const {mf,db,now}=await fixture(['a']);
 try{
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,AI_MODE:'on',GEMINI_API_KEY:'test',GEMINI_MODEL:'test',ASSETS:{fetch:async()=>new Response('')}};
  let calls=0,sent=0;
  const transport:typeof fetch=async url=>{if(String(url).includes('generativelanguage')){calls++;return new Response('',{status:429});}sent++;return Response.json({ok:true,result:{message_id:sent}});};
  await Promise.all([queueWorkNudge(env,now,transport),queueWorkNudge(env,now,transport)]);
  assert.equal(calls,1,'overlapping cron reserves one model attempt');
  await flushOutbox(env,transport,now,()=>now);assert.equal(sent,1);
  await receiveNudgeReply(env,10,'hello',now+60000,transport);
  await queueWorkNudge(env,now+15*60000,transport);
  await db.exec("UPDATE tasks SET status='completed' WHERE id='a'");
  await flushOutbox(env,transport,now+15*60000,()=>now+15*60000);
  assert.equal(sent,1,'completion before delivery blocks a queued task nudge');
 }finally{await mf.dispose();}
});

test('a plan summary for work happening now counts once and suppresses a duplicate start nudge',async()=>{
 const {mf,db,now,plan}=await fixture(['a']);
 try{
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sent=0;const transport:typeof fetch=async()=>{sent++;return Response.json({ok:true,result:{message_id:sent}});};
  await queuePlanConfirmation(db,'123','manual-save',plan as unknown as import('../../src/application/work-planner.ts').WorkPlan,now);
  await queueWorkNudge(env,now,transport);
  await flushOutbox(env,transport,now,()=>now);
  assert.equal(sent,1);
  const state=await db.prepare("SELECT consecutive_unanswered,task_counts_json FROM task_nudge_state WHERE owner='123'").first<{consecutive_unanswered:number;task_counts_json:string}>();
  assert.equal(state!.consecutive_unanswered,1);assert.deepEqual(JSON.parse(state!.task_counts_json),{a:1});
 }finally{await mf.dispose();}
});
