import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {ConversationStore,queueAppointments,acknowledgeAppointments} from '../../src/adapters/d1/conversation-store.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';
import {conversationChat} from '../../src/application/conversation-command.ts';
import {processInbox} from '../../src/application/process-inbox.ts';
import {GeminiTrial} from '../../src/ai/gemini.ts';
import type {ConversationIntent} from '../../src/domain/conversation.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
import {createWorker} from '../../src/entrypoints/worker.ts';
import {buildContext} from '../../src/application/context-builder.ts';
import {executeTool} from '../../src/application/tool-executor.ts';

test('native tool executor reads scoped data and plans writes from typed args, independent of phrasing',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),now=Date.parse('2026-09-12T08:00:00+07:00');
  await db.prepare("INSERT INTO tasks(id,owner,title,deadline,deadline_precision,created) VALUES('mine','123','rửa bát','2026-09-12','date',0)").run();
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('foreign','999','private',0)").run();
  const found=await executeTool({name:'find_tasks',args:{query:'',status:'all',cursor:0}},store,'123',1,now);
  assert.ok(JSON.stringify(found.result).includes('mine'));assert.ok(!JSON.stringify(found.result).includes('private'));
  const agenda=await executeTool({name:'get_agenda',args:{from:'2026-09-12T00:00:00+07:00',to:'2026-09-13T00:00:00+07:00',cursor:0}},store,'123',1,now);
  assert.equal(agenda.result.googleCalendarIncluded,false);assert.ok(JSON.stringify(agenda.result).includes('rửa bát'));
  const duplicate=await executeTool({name:'create_task',args:{title:'rửa bát',deadline:null}},store,'123',1,now);
  assert.equal(duplicate.result.status,'needs_confirmation');assert.equal(duplicate.changes.length,0);
  const capture=await executeTool({name:'create_task',args:{title:'bài văn',deadline:{value:'2026-09-12T19:00:00+07:00',precision:'datetime'}}},store,'123',2,now);
  assert.equal(capture.result.status,'planned');assert.equal(capture.changes.length,1);
  assert.equal((await store.tasks('123',0)).length,1); // Executor plans, commit is explicit.
  const stale=await executeTool({name:'update_task',args:{task_id:'mine',expected_version:99,patch:{status:'completed'}}},store,'123',3,now);
  assert.equal(stale.result.reason,'stale_version');assert.equal(stale.changes.length,0);
  const foreign=await executeTool({name:'set_reminder',args:{task_id:'foreign',expected_version:1,at:'2026-09-12T19:00:00+07:00'}},store,'123',4,now);
  assert.equal(foreign.result.reason,'task_not_found');
  await assert.rejects(executeTool({name:'create_task',args:{title:'x',deadline:null,owner:'999'}},store,'123',5,now),/INVALID_TOOL_FIELDS/);
 }finally{await mf.dispose();}
});

test('live-smoke regressions: ambiguous completion and existing-title capture retain scoped clarification',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),receipts=new ConversationStore(db);let now=Date.parse('2026-09-12T08:00:00+07:00'),seq=0,calls=0;
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','bài tiếng Anh',0)").run();
  await db.prepare("INSERT INTO chat_focus(owner,task_id,expires) VALUES('123','t',?)").bind(now+900000).run();
  let intent:ConversationIntent={kind:'complete',reply:'unused',taskId:'t',title:null,deadlineText:null,evidence:'Xong rồi'};
  const chat=conversationChat((owner,id,time,_context,_turns,resolved)=>receipts.infer(owner,id,time,async()=>{if(resolved)return resolved;calls++;return intent;}));
  const run=async(text:string)=>{const id=++seq;await store.accept({owner:'123',chat:123,updateId:id,text},now,false);await processInbox(store,'123',{now:()=>now},chat);return (await store.result('123',id))!;};
  assert.match((await run('Xong rồi')).text,/xong cả/);
  assert.equal((await store.task('123','t'))!.status,'active');
  const before=calls;assert.match((await run('cả bài')).text,/Xong/);assert.equal(calls,before);
  assert.equal((await store.task('123','t'))!.status,'completed');
  await db.prepare("UPDATE tasks SET status='active',version=version+1 WHERE id='t'").run();
  await run('Xong rồi');await db.prepare("UPDATE tasks SET version=version+1 WHERE id='t'").run();
  assert.match((await run('cả bài')).text,/vừa thay đổi/);assert.equal((await store.task('123','t'))!.status,'active');
  intent={kind:'deadline',reply:'unused',taskId:'t',title:null,deadlineText:'ngày mai',evidence:'Tớ có bài tiếng Anh, deadline ngày mai'};
  assert.match((await run(intent.evidence!)).text,/việc cũ/);
  const n=calls;assert.match((await run('việc cũ')).text,/đổi hạn/);assert.equal(calls,n);
  assert.equal((await store.task('123','t'))!.deadline,'2026-09-13');
  await run(intent.evidence!);const n2=calls;assert.match((await run('việc mới')).text,/Tớ ghi/);assert.equal(calls,n2);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,2);
 }finally{await mf.dispose();}
});

test('task completion requires explicit scope, stops pending reminders, and undo preserves newer data',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),receipts=new ConversationStore(db);let now=100000,id=0;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','bài tiếng Anh',0); INSERT INTO task_appointments(id,owner,task_id,due) VALUES('a','123','t',150000); INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('s','123','t',150000,25,'planned',999999); INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES('r','123','s',1,1,150000);");
  let intent:ConversationIntent={kind:'complete',reply:'unused',title:null,taskId:'t',deadlineText:null,evidence:'Xong rồi'};
  const chat=conversationChat((owner,update,time,_context,_turns,resolved)=>receipts.infer(owner,update,time,async()=>resolved??intent));
  const run=async(text:string)=>{const update=++id;await store.accept({owner:'123',chat:123,updateId:update,text},now,false);await processInbox(store,'123',{now:()=>now},chat);return (await store.result('123',update))!;};
  await run(intent.evidence!);assert.equal((await store.task('123','t'))!.status,'active');
  intent={...intent,evidence:'Tớ làm xong bài tiếng Anh rồi'};
  assert.match((await run(intent.evidence!)).text,/dừng các nhắc/);
  assert.equal((await store.task('123','t'))!.status,'completed');
  assert.equal((await db.prepare("SELECT status FROM task_appointments WHERE id='a'").first<{status:string}>())!.status,'cancelled');
  assert.equal((await store.session('123','s'))!.status,'skipped');
  assert.equal((await db.prepare("SELECT status FROM reminders WHERE id='r'").first<{status:string}>())!.status,'cancelled');
  intent={...intent,kind:'reopen',evidence:'Hoàn tác việc bài tiếng Anh'};
  assert.match((await run(intent.evidence!)).text,/mở lại/);
  assert.equal((await store.task('123','t'))!.status,'active');
  assert.equal((await store.session('123','s'))!.status,'skipped');
  intent={...intent,kind:'complete',evidence:'Xong bài tiếng Anh rồi'};await run(intent.evidence!);
  await db.prepare("UPDATE tasks SET version=version+1 WHERE id='t'").run();
  intent={...intent,kind:'reopen',evidence:'Hoàn tác việc bài tiếng Anh'};
  assert.match((await run(intent.evidence!)).text,/Không thể hoàn tác/);
  assert.equal((await store.task('123','t'))!.status,'completed');
 }finally{await mf.dispose();}
});

test('spoken reminder has no invented duration, two sends per appointment, reply/rest/reschedule cancel old jobs',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),receipts=new ConversationStore(db);let now=Date.parse('2026-09-12T08:00:00+07:00'),id=0;
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','bài tiếng Anh',0)").run();
  const intent:ConversationIntent={kind:'remind',reply:'unused',title:null,taskId:'t',deadlineText:'hôm nay 9h',evidence:'Nhắc bài tiếng Anh hôm nay 9h'};
  const chat=conversationChat((owner,update,time,_context,_turns,resolved)=>receipts.infer(owner,update,time,async()=>resolved??intent));
  const run=async(text:string)=>{const update=++id;await store.accept({owner:'123',chat:123,updateId:update,text},now,false);await processInbox(store,'123',{now:()=>now},chat);return (await store.result('123',update))!;};
  assert.match((await run(intent.evidence!)).text,/hẹn nhắc/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{n:number}>())!.n,0);
  const sent:string[]=[];
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,AI_MODE:'off'};
  const flush=()=>flushOutbox(env,async(_url,init)=>{sent.push(JSON.parse(String(init?.body)).text);return Response.json({ok:true,result:{message_id:sent.length}});},now,()=>0);
  now+=3600000;await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,1);
  now+=899999;await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,1);
  now++;await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,2);
  now+=60000;await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,2);
  intent.deadlineText='hôm nay 10h';intent.evidence='Nhắc bài tiếng Anh hôm nay 10h';await run(intent.evidence);
  now=Date.parse('2026-09-12T10:00:00+07:00');await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,3);
  await acknowledgeAppointments(db,'123');now+=900000;await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,3);
  intent.deadlineText='hôm nay 11h';intent.evidence='Nhắc bài tiếng Anh hôm nay 11h';await run(intent.evidence);
  now=Date.parse('2026-09-12T11:00:00+07:00');await queueAppointments(db,'123',now);
  intent.deadlineText='hôm nay 12h';intent.evidence='Nhắc bài tiếng Anh hôm nay 12h';await run(intent.evidence);
  await flush();assert.equal(sent.length,3); // queued old time cannot send after reschedule
  await run('/rest');await run('/resume');
  now=Date.parse('2026-09-12T12:00:00+07:00');await queueAppointments(db,'123',now);await flush();assert.equal(sent.length,3);
 }finally{await mf.dispose();}
});

test('conversation finds named tasks beyond first page, confirms duplicates by voice and handles rest/overview',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  for(let n=0;n<14;n++)await db.prepare('INSERT INTO tasks(id,owner,title,created) VALUES(?,?,?,?)').bind(`t${n}`,'123',`bài số ${n}`,n).run();
  const store=new D1WorkStore(db),receipts=new ConversationStore(db),now=Date.parse('2026-09-12T08:00:00+07:00');let calls=0,id=100;
  let intent:ConversationIntent={kind:'capture',reply:'unused',title:'bài số 13',taskId:null,deadlineText:'ngày mai',evidence:'Tớ có bài số 13, hạn ngày mai'};
  const chat=conversationChat((owner,update,time,_context,_turns,resolved)=>receipts.infer(owner,update,time,async()=>{if(resolved)return resolved;calls++;return intent;}));
  const run=async(text:string)=>{const update=++id;await store.accept({owner:'123',chat:123,updateId:update,text},now,false);await processInbox(store,'123',{now:()=>now},chat);return (await store.result('123',update))!;};
  const context=await buildContext(store,'123','Đổi hạn bài số 13 thành ngày mai',now);
  assert.ok(context.tasks.some(t=>t.id==='t13'));
  const duplicate=await run(intent.evidence!);assert.match(duplicate.text,/Đã có việc/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,14);
  const before=calls;assert.match((await run('ừ, thêm đi')).text,/Tớ ghi/);assert.equal(calls,before);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,15);
  assert.equal(await store.conversationPending('123',now),null);
  intent={kind:'rest',reply:'unused',title:null,taskId:null,deadlineText:null,evidence:'Tớ mệt quá'};
  await run(intent.evidence!);assert.equal(await store.preferences('123'),null);
  intent={...intent,evidence:'Dừng nhắc hôm nay nhé'};
  assert.match((await run(intent.evidence!)).text,/dừng nhắc/);assert.ok((await store.preferences('123'))!.pause_until>now);
  intent={...intent,kind:'resume',evidence:'Mở lại nhắc nhé'};
  await run(intent.evidence!);assert.equal((await store.preferences('123'))!.pause_until,0);
  intent={...intent,kind:'overview',evidence:'Hôm nay còn việc gì?'};
  const overview=await run(intent.evidence!);assert.match(overview.text,/chưa có buổi/);assert.ok(overview.buttons.length>0);
 }finally{await mf.dispose();}
});

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
  const receipt=await db.prepare('SELECT model,prompt_version,inference_source,inference_ms FROM conversation_receipts WHERE owner=? AND update_id=1').bind('123').first<{model:string;prompt_version:string;inference_source:string;inference_ms:number}>();
  assert.equal(receipt!.model,'test-model');assert.equal(receipt!.prompt_version,'conversation-c1-v2');
  assert.equal(receipt!.inference_source,'model');assert.ok(receipt!.inference_ms>=0);
  const stopped=await createWorker(undefined,transport,{now:()=>Date.parse('2026-09-12T08:00:00+07:00')}).fetch(new Request('https://local/telegram',{
   method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({update_id:2,message:{from:{id:123},chat:{id:123,type:'private'},text}})
  }),{...env,AI_TRIAL_ENDS_AT:'2026-09-11T00:00:00Z'});
  assert.match(await stopped.text(),/gián đoạn/);assert.equal(calls,1);
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
