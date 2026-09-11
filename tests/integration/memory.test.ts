import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {reserveAi,expireMemory} from '../../src/adapters/d1/memory.ts';
import {processInbox} from '../../src/application/process-inbox.ts';
import {buildContext} from '../../src/application/context-builder.ts';
import {contextualChat} from '../../src/ai/chat.ts';
import type {Turn} from '../../src/ai/contracts.ts';

test('P3 memory context, expiry, forget, owner isolation, chat capture confirmation and quotas',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(s:string):Promise<unknown>};
  for(const file of ['0001_initial.sql','0002_delivery.sql','0003_command_transactions.sql','0004_sessions_reminders.sql','0005_memory_conversation.sql','0006_review_fixes.sql'])
    await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db);let now=Date.parse('2026-09-11T08:00:00+07:00'),seq=0,calls=0;
  let seen:{turns:Turn[];context:string}|undefined;
  const client={generate:async(turns:Turn[],context:string)=>{
    calls++;seen={turns,context};const text=turns.at(-1)!.text;
    const output=text==='còn bài vẽ'?{kind:'proposal' as const,reply:'đã lưu',draft:{operation:'capture_task' as const,entityId:null,field:'title' as const,value:'bài vẽ',certainty:'confirmed' as const,evidence:text}}:
     {kind:'chat' as const,reply:'ừ, kể tớ nghe tiếp nhé',draft:null};
    return {output,metrics:{model:'mock',promptVersion:'test',requestsUsed:calls,latencyMs:0,tokens:{}}};
  }};
  const chat=contextualChat(client,(key,time)=>reserveAi(db,'test-project/model',key,time));
  const run=async(text:string,owner='123',callback=false)=>{
    const updateId=++seq;
    await store.accept({owner,chat:Number(owner),updateId,...(callback?{callback:text}:{text})},now,false);
    await processInbox(store,owner,{now:()=>now},chat);
    return store.result(owner,updateId);
  };
  await run('/remember thích cacao');await run('/mood hôm nay mệt');
  assert.equal(calls,0);assert.equal((await store.memories('123',now)).length,2);
  await run('chào');now+=16000;await run('nói tiếp câu trước');
  assert.ok(seen!.context.includes('thích cacao'));assert.ok(seen!.turns.some(t=>t.text==='chào'));
  now+=16000;await run('chào','999');assert.ok(!seen!.context.includes('cacao'));assert.equal(seen!.turns.length,1);
  now+=16000;const proposal=await run('còn bài vẽ');assert.equal((await store.tasks('123',0)).length,0);
  const yes=proposal!.buttons[0]![0]!.callback_data;await run(yes,'123',true);
  const task=(await store.tasks('123',0))[0]!;assert.equal(task.title,'bài vẽ');
  await run(`focus:${task.id}`,'123',true);
  const context=await buildContext(store,'123','cái này',now);assert.equal(JSON.parse(context.context).focus,task.id);
  const before=calls;await run('/ai off');await run('không gọi AI nhé');assert.equal(calls,before);
  await run('/ai on');await run('forget:m1','999',true);assert.equal((await store.memories('123',now)).length,2);
  await run('forget:m1','123',true);
  assert.equal((await store.history('123',now)).length,0);assert.equal(await store.focus('123',now),null);
  assert.ok(!(await buildContext(store,'123','cậu nhớ gì',now)).context.includes('cacao'));
  now=Date.parse('2026-09-12T08:00:00+07:00');await expireMemory(db,now);
  assert.equal((await store.memories('123',now)).length,0);
  const results=await Promise.all(Array.from({length:8},(_,i)=>reserveAi(db,'race',String(i),now,2)));
  assert.equal(results.filter(Boolean).length,2);
  assert.equal(await reserveAi(db,'race',String(results.findIndex(Boolean)),now+86400001,2),false); // same command cannot charge/call twice
  assert.equal(await reserveAi(db,'race','new',now+86400001,2),true);
  const limited=contextualChat(client,async()=>false);const n=calls;
  await store.accept({owner:'123',chat:123,updateId:999,text:'hỏi tiếp'},now,false);
  await processInbox(store,'123',{now:()=>now},limited);assert.equal(calls,n);
  assert.match((await store.result('123',999))!.text,/giới hạn/);
 }finally{await mf.dispose();}
});
