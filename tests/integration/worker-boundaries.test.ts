import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';

const worker=readFileSync('src/entrypoints/worker.ts','utf8');
const chat=readFileSync('src/entrypoints/worker-chat.ts','utf8');
const scheduler=readFileSync('src/entrypoints/worker-scheduler.ts','utf8');
const webhook=readFileSync('src/entrypoints/telegram-webhook.ts','utf8');

test('worker entrypoint delegates chat, scheduler and webhook responsibilities',()=>{
 assert.match(worker,/createRuntimeChat/);
 assert.match(worker,/runScheduled/);
 assert.match(worker,/handleTelegramWebhook/);
 assert.doesNotMatch(worker,/from ['"]\.\.\/ai\/gemini\.ts/);
 assert.doesNotMatch(worker,/from ['"]\.\.\/adapters\/d1\/work-store\.ts/);
 assert.doesNotMatch(worker,/receiveNudgeReply/);
});

test('entrypoint modules expose explicit bounded responsibilities',()=>{
 assert.match(chat,/export function createRuntimeChat/);
 assert.match(chat,/new Gemini/);
 assert.match(scheduler,/export async function runScheduled/);
 assert.match(scheduler,/queueWorkNudge/);
 assert.match(webhook,/export async function handleTelegramWebhook/);
 assert.match(webhook,/processInbox/);
 assert.match(webhook,/receiveNudgeReply/);
});

test('Telegram webhook acknowledges a directly replied appointment even without native cards',async()=>{
 const {handleTelegramWebhook}=await import('../../src/entrypoints/telegram-webhook.ts');
 const {queueAppointments}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-05T10:00:00+07:00'),env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',ASSETS:{fetch:async()=>new Response('asset')}};
  await db.prepare("INSERT INTO task_appointments(id,owner,task_id,due,subject) VALUES('replied','123',NULL,?,'Example'),('other','123',NULL,?,'Other')").bind(now,now).run();
  await db.prepare("INSERT INTO outbox(id,payload,available,reminder_id,state,message_id,sent_at) VALUES('appointment:replied:1',?,?,'appointment:replied:1','sent',77,?)").bind(JSON.stringify({method:'sendMessage',chat_id:123,text:'Example'}),now,now).run();
  await db.prepare("INSERT INTO outbox(id,payload,available,reminder_id) VALUES('appointment:replied:2',?,?,'appointment:replied:2')").bind(JSON.stringify({method:'sendMessage',chat_id:123,text:'Repeat'}),now+15*60000).run();
  const update={update_id:900,message:{message_id:78,from:{id:123},chat:{id:123,type:'private'},text:'biết rồi',reply_to_message:{message_id:77}}};
  const response=await handleTelegramWebhook(new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(update)}),env,{cardsEnabled:false,transport:async()=>Response.json({ok:true,result:{message_id:99}}),clock:{now:()=>now+16*60000},chat:undefined,flushCards:async()=>{}});
  assert.equal(response.status,200);
  assert.equal((await db.prepare("SELECT responded FROM task_appointments WHERE id='replied'").first<{responded:number}>())!.responded,1);
  assert.equal((await db.prepare("SELECT responded FROM task_appointments WHERE id='other'").first<{responded:number}>())!.responded,0);
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='appointment:replied:2'").first<{state:string}>())!.state,'failed');
  await queueAppointments(db,'123',now+20*60000);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE reminder_id='appointment:replied:2' AND state='pending'").first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});
