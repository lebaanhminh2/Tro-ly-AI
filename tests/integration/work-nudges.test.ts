import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {queueWorkNudge} from '../../src/adapters/d1/work-nudges.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';
import {operatingDay} from '../../src/domain/healthy.ts';
test('work nudges stop after two across tasks and replan; chat reopens without immediate flooding',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T09:00:00+07:00'),day=operatingDay(now,270);
  await db.prepare("INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES('123',270,1350,?)").bind(now).run();
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',0)");
  const plan={items:[{taskId:'a',windows:[{start:now,end:now+8*3600000}]}]};
  await db.prepare("INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES('123',?,'x',?,?)").bind(day,JSON.stringify(plan),now).run();
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(24),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('')}};
  let sent=0;const transport:typeof fetch=async(_url,init)=>{assert.equal(JSON.parse(String(init?.body))._nudge,undefined);sent++;return Response.json({ok:true,result:{message_id:sent}});};
  const tick=async(t:number)=>{await queueWorkNudge(env,t,transport);await flushOutbox(env,transport,t,()=>t);};
  await tick(now);assert.equal(sent,1);
  await tick(now+15*60000);assert.equal(sent,1);
  await tick(now+30*60000);assert.equal(sent,2);
  plan.items[0]!.taskId='b';await db.prepare("UPDATE daily_plans SET version=2,plan_json=? WHERE owner='123'").bind(JSON.stringify(plan)).run();
  await tick(now+60*60000);await tick(now+90*60000);assert.equal(sent,2);
  await db.prepare("INSERT INTO command_inbox(owner,update_id,payload,created,delivery) VALUES('123',1,?, ?,0)").bind(JSON.stringify({text:'hello'}),now+91*60000).run();
  await tick(now+92*60000);assert.equal(sent,3);
  await tick(now+93*60000);assert.equal(sent,3);
 }finally{await mf.dispose();}
});
