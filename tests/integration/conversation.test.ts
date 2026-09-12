import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {ConversationStore} from '../../src/adapters/d1/conversation-store.ts';
import {conversationChat} from '../../src/application/conversation-command.ts';
import {processInbox} from '../../src/application/process-inbox.ts';
import {GeminiTrial} from '../../src/ai/gemini.ts';
import type {ConversationIntent} from '../../src/domain/conversation.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
import {createWorker} from '../../src/entrypoints/worker.ts';

test('Worker conversation mode writes a grounded capture and consumes durable quota only once',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  let calls=0;const text='Tớ có bài tiếng Anh, dl ngày mai';
  const transport:typeof fetch=async(_url,init)=>{
   calls++;assert.equal(init?.redirect,'manual');
   return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({kind:'capture',reply:'unused',title:'bài tiếng Anh',taskId:null,deadlineText:'ngày mai',evidence:text})}]}}]});
  };
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),AI_MODE:'conversation',GEMINI_API_KEY:'fake',GEMINI_MODEL:'test-model',AI_DAILY_LIMIT:'2'};
  const send=()=>createWorker(undefined,transport,{now:()=>Date.parse('2026-09-12T08:00:00+07:00')}).fetch(new Request('https://local/telegram',{
   method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({update_id:1,message:{from:{id:123},chat:{id:123,type:'private'},text}})
  }),env);
  assert.match(await (await send()).text(),/Tớ ghi/);await send();assert.equal(calls,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ai_reservations').first<{n:number}>())!.n,1);
 }finally{await mf.dispose();}
});

test('one conversational turn saves task+date without buttons; receipt survives commit failure',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),receipts=new ConversationStore(db);let seq=0,calls=0;
  const now=Date.parse('2026-09-12T08:00:00+07:00');
  let output:ConversationIntent={kind:'capture',reply:'model reply unused',title:'bài tiếng Anh',taskId:null,deadlineText:'ngày mai',evidence:'Tớ có bài tiếng Anh, deadline ngày mai'};
  const client=new GeminiTrial({apiKey:'fake',model:'test-model',transport:async(_url,init)=>{
   calls++;const body=JSON.parse(String(init?.body));assert.ok(body.generationConfig.responseJsonSchema.properties.deadlineText);
   return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]});
  }});
  const chat=conversationChat((owner,id,time,context,turns,resolved)=>receipts.infer(owner,id,time,async()=> resolved??(await client.generateConversation(turns,context)).output));
  const run=async(text:string)=>{const id=++seq;await store.accept({owner:'123',chat:123,updateId:id,text},now,false);await processInbox(store,'123',{now:()=>now},chat);return store.result('123',id);};
  const result=await run(output.evidence!);
  assert.equal(calls,1);assert.equal(result!.buttons.length,0);assert.match(result!.text,/Tớ ghi/);
  const task=(await store.tasks('123',0))[0]!;
  assert.equal(task.deadline,'2026-09-13');
  assert.equal((await db.prepare('SELECT deadline_precision FROM tasks WHERE id=?').bind(task.id).first<{deadline_precision:string}>())!.deadline_precision,'date');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{n:number}>())!.n,0);
  await processInbox(store,'123',{now:()=>now},chat);assert.equal(calls,1);
  output={kind:'deadline',reply:'unused',title:null,taskId:task.id,deadlineText:'15/09/2026',evidence:'Đổi hạn bài tiếng Anh thành 15/09/2026'};
  const commit=store.commit.bind(store);let fail=true;
  store.commit=async(...args)=>{if(fail){fail=false;throw Error('before commit');}return commit(...args);};
  assert.equal(await run(output.evidence!),null);
  assert.equal((await store.task('123',task.id))!.deadline,'2026-09-13');
  await processInbox(store,'123',{now:()=>now},chat);
  assert.equal(calls,2);assert.equal((await store.task('123',task.id))!.deadline,'2026-09-15');
  output={kind:'capture',reply:'unused',title:'bài văn',taskId:null,deadlineText:null,evidence:'Tớ có bài văn'};
  const tentative=await run('Ví dụ: Tớ có bài văn');assert.match(tentative!.text,/phương án/);
  assert.equal((await store.tasks('123',0)).length,1);
  output={kind:'capture',reply:'unused',title:'bài văn',taskId:null,deadlineText:'thứ sáu',evidence:'Tớ có bài văn, deadline thứ sáu'};
  const unclear=await run(output.evidence!);assert.match(unclear!.text,/ngày nào/);
  assert.equal((await store.tasks('123',0)).length,1);
  const before=calls;
  const clarified=await run('18/09/2026');assert.match(clarified!.text,/Tớ ghi/);
  assert.equal(calls,before);assert.equal((await store.tasks('123',0)).length,2);
  assert.equal(await store.conversationPending('123',now),null);
  await assert.rejects(receipts.infer('123',99,now,async()=>{throw Error('provider failure');}));
  let retried=false;await assert.rejects(receipts.infer('123',99,now,async()=>{retried=true;return output;}));
  assert.equal(retried,false);
 }finally{await mf.dispose();}
});
