import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {queueWorkNudge,receiveNudgeReply} from '../../src/adapters/d1/work-nudges.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';
import {operatingDay} from '../../src/domain/healthy.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';

test('three tasks share attention, selective replies and model timing do not reset other tasks',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T09:00:00+07:00'),day=operatingDay(now,270);
  await db.prepare("INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES('123',270,1350,?)").bind(now).run();
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',0),('c','123','C',0)");
  const plan={items:['a','b','c'].map(taskId=>({taskId,windows:[{start:now,end:now+8*3600000}]}))};
  await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'x',?,?)").bind(day,JSON.stringify(plan),now).run();
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,AI_MODE:'on',GEMINI_API_KEY:'test',GEMINI_MODEL:'test',ASSETS:{fetch:async()=>new Response('')}};
  let sent=0,calls=0;let answer:unknown={task_ids:['a','b','c'],text:'Mình làm A trước nhé? B và C để sau nha :>',next_minutes:47};
  const transport:typeof fetch=async(url,init)=>{
   if(String(url).includes('generativelanguage')){calls++;return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(answer)}]}}]});}
   assert.equal(JSON.parse(String(init?.body))._nudge,undefined);sent++;return Response.json({ok:true,result:{message_id:sent}});
  };
  const tick=async(t:number)=>{await queueWorkNudge(env,t,transport);await flushOutbox(env,transport,t,()=>t);};
  await tick(now);assert.equal(sent,1);
  await tick(now+30*60000);assert.equal(sent,1);assert.equal(calls,1);
  await tick(now+47*60000);assert.equal(sent,2);
  await tick(now+100*60000);assert.equal(sent,2);
  await db.exec("UPDATE daily_plans SET version=2 WHERE owner='123'");
  await tick(now+110*60000);assert.equal(sent,2,'replan cannot restart silence budget');
  answer={task_ids:[],next_minutes:20,done:false};
  await receiveNudgeReply(env,1,'hello',now+111*60000,transport);
  await tick(now+150*60000);assert.equal(sent,2,'unrelated greeting is not a task reply');
  answer={task_ids:['a'],next_minutes:61,done:false};
  await receiveNudgeReply(env,2,'Bài A tớ đang làm, nhắc sau nhé',now+151*60000,transport);
  const count=calls;await receiveNudgeReply(env,2,'same retry',now+152*60000,transport);assert.equal(calls,count);
  const row=await db.prepare("SELECT * FROM nudge_cycles WHERE owner='123'").first<{cycle:number;blocked_json:string}>();
  assert.equal(row!.cycle,2);assert.deepEqual(JSON.parse(row!.blocked_json),['b','c']);
  answer={task_ids:['a'],text:'Cậu làm A tới đâu rồi nè?',next_minutes:23};
  await tick(now+200*60000);assert.equal(sent,2);
  await tick(now+212*60000);assert.equal(sent,3,'new cycle has unique delivery key');
  await tick(now+220*60000);assert.equal(sent,3);
  await tick(now+235*60000);assert.equal(sent,4);
  await tick(now+300*60000);assert.equal(sent,4);
  answer={task_ids:['a'],next_minutes:20,done:true};
  await receiveNudgeReply(env,3,'A xong rồi',now+301*60000,transport);
  await tick(now+350*60000);assert.equal(sent,4);
  assert.equal((await db.prepare("SELECT status FROM tasks WHERE id='a'").first<{status:string}>())!.status,'active','user still ticks manually');
  answer={task_ids:['b'],next_minutes:18,done:false};
  await receiveNudgeReply(env,4,'Giờ tớ làm B đây',now+351*60000,transport);
  answer={task_ids:['b'],text:'Mình làm B nhé cậu :>',next_minutes:26};
  await tick(now+368*60000);assert.equal(sent,4);
  await tick(now+369*60000);assert.equal(sent,5,'explicit reply to previously blocked B reopens B only');
  // Unknown task IDs and malformed model timing have no authority.
  const prior=(await db.prepare("SELECT version FROM nudge_cycles WHERE owner='123'").first<{version:number}>())!.version;
  answer={task_ids:['foreign'],next_minutes:0,done:false};
  await receiveNudgeReply(env,5,'Một câu không rõ',now+370*60000,transport);
  assert.equal((await db.prepare("SELECT version FROM nudge_cycles WHERE owner='123'").first<{version:number}>())!.version,prior);
 }finally{await mf.dispose();}
});

test('provider failure is bounded; queued nudges are invalidated by sleep or completion',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T09:00:00+07:00'),day=operatingDay(now,270);
  await db.prepare("INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES('123',270,1350,?)").bind(now).run();
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0)");
  await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'x',?,?)").bind(day,JSON.stringify({items:[{taskId:'a',windows:[{start:now,end:now+8*3600000}]}]}),now).run();
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,AI_MODE:'on',GEMINI_API_KEY:'test',GEMINI_MODEL:'test',ASSETS:{fetch:async()=>new Response('')}};
  let calls=0,sent=0;const transport:typeof fetch=async url=>{if(String(url).includes('generativelanguage')){calls++;return new Response('',{status:429});}sent++;return Response.json({ok:true,result:{message_id:sent}});};
  await Promise.all([queueWorkNudge(env,now,transport),queueWorkNudge(env,now,transport)]);
  assert.equal(calls,1,'overlapping cron reserves one model attempt');
  await flushOutbox(env,transport,now,()=>now);assert.equal(sent,1);
  await receiveNudgeReply(env,10,'hello',now+60000,transport);
  assert.equal((await db.prepare("SELECT cycle FROM nudge_cycles WHERE owner='123'").first<{cycle:number}>())!.cycle,1);
  await queueWorkNudge(env,now+30*60000,transport);
  await db.exec("UPDATE tasks SET status='completed' WHERE id='a'");
  await flushOutbox(env,transport,now+30*60000,()=>now+30*60000);assert.equal(sent,1);
  await queueWorkNudge(env,now+60*60000,transport);assert.equal(calls,3,'failed provider is not retried every minute');
  const tomorrow=now+86400000;
  await db.exec("UPDATE tasks SET status='active' WHERE id='a'");
  await db.prepare("UPDATE daily_plans SET day=?,version=version+1,plan_json=? WHERE owner='123'").bind(day+1,JSON.stringify({items:[{taskId:'a',windows:[{start:tomorrow,end:tomorrow+3600000}]}]})).run();
  await queueWorkNudge(env,tomorrow,transport);
  assert.equal(calls,4,'a new operating day gets a fresh cycle');
  await db.exec("UPDATE schedule_settings SET sleep_minutes=540,version=version+1 WHERE owner='123'");
  await new ScheduleStore(db).reportSleep('123',tomorrow);
  await flushOutbox(env,transport,tomorrow,()=>tomorrow);assert.equal(sent,1,'sleep at final send blocks a previously queued nudge');
 }finally{await mf.dispose();}
});
