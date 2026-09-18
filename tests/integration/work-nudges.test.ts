import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {queuePlanConfirmation,queueWorkNudge,receiveNudgeReply} from '../../src/adapters/d1/work-nudges.ts';
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

test('a task gets at most two nudges and unanswered task nudges stop globally after three',async()=>{
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
  await tick(now+62*60000);assert.equal(sent,4,'any real user reply resets the task-only silence');
  const reset=await db.prepare("SELECT consecutive_unanswered FROM task_nudge_state WHERE owner='123'").first<{consecutive_unanswered:number}>();
  assert.equal(reset!.consecutive_unanswered,1);
  assert.equal((await db.prepare("SELECT status FROM tasks WHERE id='a'").first<{status:string}>())!.status,'active');
  assert.ok(plan.items.length===2);
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
