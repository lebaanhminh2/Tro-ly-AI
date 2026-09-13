import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {incoming} from '../../src/adapters/telegram/api.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {acknowledgeAppointments} from '../../src/adapters/d1/conversation-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';

test('Telegram preserves reply target without trusting forwarded text or another owner', () => {
 const message={message_id:51,text:'heard you',from:{id:123},chat:{id:123,type:'private'},reply_to_message:{message_id:41,text:'untrusted quoted content'}};
 const parsed=incoming({update_id:1,message});
 assert.equal(parsed?.messageId,51);
 assert.equal(parsed?.replyToMessageId,41);
 assert.equal(parsed?.text,'heard you');
 assert.equal(incoming({update_id:2,message:{...message,from:{id:999}}}),null);
 assert.equal(incoming({update_id:3,message:{...message,reply_to_message:{message_id:-1}}})?.replyToMessageId,undefined);
});

test('unrelated chat and foreign message IDs cannot silence other reminder cycles', async () => {
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try {
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(p=>p.endsWith('.sql')).sort()) await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t1','123','one',0),('t2','123','two',0),('t3','999','foreign',0)");
  for(const [id,owner,task,messageId] of [['a1','123','t1',41],['a2','123','t2',42],['a3','999','t3',43]] as const) {
   await db.prepare('INSERT INTO task_appointments(id,owner,task_id,due) VALUES(?,?,?,?)').bind(id,owner,task,1000).run();
   await db.prepare("INSERT INTO outbox(id,payload,available,state,reminder_id,message_id,sent_at) VALUES(?,?,0,'sent',?,?,1000)")
    .bind('o'+id,'{}','appointment:'+id+':1',messageId).run();
  }
  const store=new D1WorkStore(db);
  await store.accept({owner:'123',chat:123,updateId:1,text:'new unrelated topic'},2000,false);
  await acknowledgeAppointments(db,'123');
  await acknowledgeAppointments(db,'123',43);
  let rows=(await db.prepare('SELECT id,responded FROM task_appointments ORDER BY id').all<{id:string;responded:number}>()).results;
  assert.deepEqual(rows.map(r=>r.responded),[0,0,0]);
  await acknowledgeAppointments(db,'123',41);
  rows=(await db.prepare('SELECT id,responded FROM task_appointments ORDER BY id').all<{id:string;responded:number}>()).results;
  assert.deepEqual(rows.map(r=>r.responded),[1,0,0]);
  await acknowledgeAppointments(db,'123',41);
  assert.equal((await db.prepare("SELECT responded FROM task_appointments WHERE id='a2'").first<{responded:number}>())!.responded,0);
 } finally {await mf.dispose();}
});

test('batch writes create distinct tasks and linked reminder atomically and replay once', async () => {
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try {
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(p=>p.endsWith('.sql')).sort()) await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),journal=new ConversationStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  await store.accept({owner:'123',chat:123,updateId:1,text:'synthetic batch'},now,false);
  const lease=(await store.claim('123',now))!;
  const calls:import('../../src/ai/contracts.ts').ToolCall[]=[
   {name:'create_task',args:{title:'report',deadline:null}},
   {name:'create_task',args:{title:'homework',deadline:null}},
   {name:'set_reminder',args:{task_id:'@0',expected_version:1,at:'2026-09-13T09:00:00+07:00'}}
  ];
  const mutate=(changes:import('../../src/domain/work.ts').Change[],time:number)=>store.mutationStatements('123',changes,time,true);
  await assert.rejects(journal.commitBatch(lease,calls,'saved',store,(c,t)=>[...mutate(c,t),db.prepare('INSERT INTO transaction_guard VALUES(0)')],now));
  assert.equal((await store.tasks('123',0)).length,0);
  assert.equal(await journal.writeResult(lease,{batch:calls}),null);
  assert.equal(await journal.commitBatch(lease,calls,'saved',store,mutate,now),'saved');
  assert.equal(await journal.commitBatch(lease,calls,'saved',store,mutate,now),'saved');
  assert.equal((await store.tasks('123',0)).length,2);
  const appointments=(await db.prepare('SELECT task_id FROM task_appointments').all<{task_id:string}>()).results;
  assert.deepEqual(appointments,[{task_id:'tool123_1_0'}]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM tool_steps WHERE kind='write'").first<{n:number}>())!.n,1);
 } finally {await mf.dispose();}
});

test('orchestrator commits a write group without a second generation', async () => {
 const {runToolTurn}=await import('../../src/application/conversation-command.ts');
 let requests=0,commits=0;
 const calls:import('../../src/ai/contracts.ts').ToolCall[]=[
  {name:'create_task',args:{title:'one',deadline:null}},
  {name:'create_task',args:{title:'two',deadline:null}}
 ];
 const reply=await runToolTurn([{role:'user',parts:[{text:'create both'}]}],{
  model:async()=>{requests++;return {content:{role:'model',parts:[]},calls,text:'Both saved.'};},
  execute:async()=>{throw Error('must use atomic group');},
  commit:async()=>{throw Error('must use atomic group');},
  batch:async(group,message)=>{assert.deepEqual(group,calls);commits++;return message;}
 });
 assert.equal(reply,'Both saved.');assert.equal(requests,1);assert.equal(commits,1);
});

test('capture and multiple questions persist; later answers close only their own question', async () => {
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const {buildContext}=await import('../../src/application/context-builder.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try {
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(p=>p.endsWith('.sql')).sort()) await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),journal=new ConversationStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  let updateId=0;
  const run=async(calls:import('../../src/ai/contracts.ts').ToolCall[],message:string)=>{
   await store.accept({owner:'123',chat:123,updateId:++updateId,text:'synthetic'},now,false);
   const lease=(await store.claim('123',now))!;
   const reply=await journal.commitBatch(lease,calls,message,store,(changes,t)=>store.mutationStatements('123',changes,t,true),now);
   await store.commit(lease,{view:{text:reply,buttons:[]},changes:[]},now);
  };
  await run([
   {name:'create_task',args:{title:'report',deadline:{value:'2026-09-14',precision:'date'}}},
   {name:'save_clarification',args:{subject:'report reminder',question:'What time?',task_id:'@0'}},
   {name:'save_clarification',args:{subject:'study availability',question:'When are you free?',task_id:null}}
  ],'Added report. What time should I remind you?');
  let pending=await store.clarifications('123',now);
  assert.equal(pending.length,2);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM task_appointments').first<{n:number}>())!.n,0);
  const question=pending.find(p=>p.task_id!==null)!;
  const context=JSON.parse((await buildContext(store,'123','9h',now)).context);
  assert.equal(context.clarifications.length,2);
  await run([
   {name:'set_reminder',args:{task_id:question.task_id,expected_version:1,at:'2026-09-13T09:00:00+07:00'}},
   {name:'close_clarification',args:{pending_id:question.id,cancelled:false}}
  ],'Reminder set.');
  pending=await store.clarifications('123',now);
  assert.equal(pending.length,1);assert.equal(pending[0]!.subject,'study availability');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM task_appointments').first<{n:number}>())!.n,1);
  // Invalid summary metadata cannot block a clear new task.
  await run([
   {name:'create_task',args:{title:'second task',deadline:null}},
   {name:'update_summary',args:{content:'invented history',through:999,expected_version:0}}
  ],'Added second task.');
  assert.equal((await store.tasks('123',0)).length,2);
  assert.equal(await store.summary('123'),null);
  await run([
   {name:'update_summary',args:{content:'Asked report reminder time, then scheduled it. Availability still unknown.',through:3,expected_version:0}}
  ],'Okay.');
  assert.equal((await store.summary('123'))!.covered_through,3);
  const later=JSON.parse((await buildContext(store,'123','next',now)).context);
  assert.ok(later.summary.content.includes('Availability'));
  assert.equal((await store.clarifications('123',now+86400001)).length,0);
 } finally {await mf.dispose();}
});

test('standalone reminder and event survive migration and use the existing dispatcher',async()=>{
 const {ConversationStore,queueAppointments}=await import('../../src/adapters/d1/conversation-store.ts');
 const {flushOutbox}=await import('../../src/adapters/d1/outbox.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f<'0011').sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('old','123','old task',0); INSERT INTO task_appointments(id,owner,task_id,due,responded) VALUES('old-appointment','123','old',1,1)");
  await db.exec(readFileSync('migrations/0011_assistant_flow.sql','utf8').replace(/\r?\n/g,' '));
  await db.exec(readFileSync('migrations/0012_work_progress.sql','utf8').replace(/\r?\n/g,' '));
  assert.equal((await db.prepare("SELECT responded FROM task_appointments WHERE id='old-appointment'").first<{responded:number}>())!.responded,1);
  const store=new D1WorkStore(db),journal=new ConversationStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  await store.accept({owner:'123',chat:123,updateId:1,text:'synthetic'},now,false);
  const lease=(await store.claim('123',now))!;
  await journal.commitBatch(lease,[
   {name:'create_reminder',args:{subject:'cook rice',at:'2026-09-13T09:00:00+07:00',message:'Time to cook rice.'}},
   {name:'create_event',args:{title:'English meeting',start:'2026-09-13T20:00:00+07:00',end:null,remind_at:null,message:'English meeting.'}}
  ],'Saved.',store,(c,t)=>store.mutationStatements('123',c,t,true),now);
  assert.equal((await store.tasks('123',0)).length,1);
  assert.equal((await store.events('123',now,now+86400000))[0]!.title,'English meeting');
  const reminders=await store.appointmentContext('123',now);
  assert.equal(reminders.length,1);assert.equal(reminders[0]!.task_id,null);
  const texts:string[]=[];
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const};
  const transport:typeof fetch=async(_url,init)=>{texts.push(JSON.parse(String(init?.body)).text);return Response.json({ok:true,result:{message_id:texts.length}});};
  const due=now+3600000;
  await queueAppointments(db,'123',due);await flushOutbox(env,transport,due,()=>due);
  assert.deepEqual(texts,['Time to cook rice.']);
  await queueAppointments(db,'123',due+900000);await flushOutbox(env,transport,due+900000,()=>due+900000);
  assert.equal(texts.length,2);
  await queueAppointments(db,'123',due+1800000);await flushOutbox(env,transport,due+1800000,()=>due+1800000);
  assert.equal(texts.length,2);
 }finally{await mf.dispose();}
});

test('planning uses real sessions, conflicts roll back, and event cancellation invalidates linked reminders',async()=>{
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','report',0)");
  const store=new D1WorkStore(db),journal=new ConversationStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');let id=0;
  const run=async(calls:import('../../src/ai/contracts.ts').ToolCall[])=>{
   await store.accept({owner:'123',chat:123,updateId:++id,text:'test'},now,false);
   const lease=(await store.claim('123',now))!;
   try{await journal.commitBatch(lease,calls,'Saved.',store,(c,t)=>store.mutationStatements('123',c,t,true),now);await store.commit(lease,{view:{text:'Saved.',buttons:[]},changes:[]},now);}
   catch(e){await store.commit(lease,{view:{text:'Not saved.',buttons:[]},changes:[]},now);throw e;}
  };
  await run([{name:'plan_work',args:{task_id:'t',expected_version:1,at:'2026-09-13T09:00:00+07:00',minutes:25}}]);
  assert.equal((await store.sessions('123',now,now+86400000))[0]!.status,'planned');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM reminders').first<{n:number}>())!.n,2);
  await assert.rejects(run([{name:'plan_work',args:{task_id:'t',expected_version:1,at:'2026-09-13T09:10:00+07:00',minutes:25}}]),/CONFLICT/);
  assert.equal((await store.sessions('123',now,now+86400000)).length,1);
  await run([{name:'create_event',args:{title:'meeting',start:'2026-09-13T20:00:00+07:00',end:null,remind_at:'2026-09-13T19:50:00+07:00',message:'Meeting time.'}}]);
  const event=(await store.events('123',now,now+86400000))[0]!;
  await run([{name:'update_event',args:{event_id:event.id,expected_version:event.version,cancelled:true,start:'2026-09-13T20:00:00+07:00',end:null}}]);
  assert.equal((await store.events('123',now,now+86400000)).length,0);
  assert.equal((await db.prepare('SELECT status FROM task_appointments WHERE event_id=?').bind(event.id).first<{status:string}>())!.status,'cancelled');
 }finally{await mf.dispose();}
});

test('production-style deferred write commits actions, receipt and delivery intent together',async()=>{
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  await store.accept({owner:'123',chat:123,updateId:1,text:'new task'},now,true);
  const lease=(await store.claim('123',now))!;lease.pendingWrites=[];
  const journal=new ConversationStore(db,statements=>lease.pendingWrites!.push(...statements));
  const calls:import('../../src/ai/contracts.ts').ToolCall[]=[{name:'create_task',args:{title:'one',deadline:null}}];
  await journal.commitBatch(lease,calls,'saved',store,(c,t)=>store.mutationStatements('123',c,t,true),now);
  assert.equal((await store.tasks('123',0)).length,0);
  lease.pendingWrites.push(db.prepare('INSERT INTO transaction_guard VALUES(0)'));
  await assert.rejects(store.commit(lease,{view:{text:'saved',buttons:[]},changes:[]},now));
  assert.equal((await store.tasks('123',0)).length,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM tool_steps WHERE kind='write'").first<{n:number}>())!.n,0);
  lease.pendingWrites.pop();
  await store.commit(lease,{view:{text:'saved',buttons:[]},changes:[]},now);
  assert.equal((await store.tasks('123',0)).length,1);
  assert.equal((await db.prepare('SELECT state FROM outbox WHERE id=?').bind('reply:123:1').first<{state:string}>())!.state,'pending');
 }finally{await mf.dispose();}
});

test('summary covers oldest uncompressed history even when recent window has moved on',async()=>{
 const {buildContext}=await import('../../src/application/context-builder.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  for(let n=1;n<=30;n++)await db.prepare('INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES(?,?,?,?,0,999999)').bind('123',n,n===1?'Important early decision':'message '+n,'reply '+n).run();
  const context=JSON.parse((await buildContext(new D1WorkStore(db),'123','next',1000)).context);
  assert.equal(context.today,'1970-01-01');
  assert.equal(context.tomorrow,'1970-01-02');
  assert.ok(context.now.endsWith('+07:00'));
  assert.equal(context.summary_request.source_turns[0].id,1);
  assert.ok(context.summary_request.source_turns.some((t:{user:string})=>t.user.includes('Important early decision')));
 }finally{await mf.dispose();}
});

test('duplicate task batch can be confirmed as a group without partial writes',async()=>{
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('original','123','duplicate',0)");
  const store=new D1WorkStore(db),journal=new ConversationStore(db),now=100000;
  await store.accept({owner:'123',chat:123,updateId:1,text:'create two'},now,false);
  const lease=(await store.claim('123',now))!;
  const calls:import('../../src/ai/contracts.ts').ToolCall[]=[{name:'create_task',args:{title:'other',deadline:null}},{name:'create_task',args:{title:'duplicate',deadline:null}}];
  const mutate=(c:import('../../src/domain/work.ts').Change[],t:number)=>store.mutationStatements('123',c,t,true);
  const reply=await journal.commitBatch(lease,calls,'saved',store,mutate,now);
  assert.match(reply,/chưa được thực hiện/);assert.equal((await store.tasks('123',0)).length,1);
  const pending=(await journal.pending('123',now))!;
  await store.commit(lease,{view:{text:reply,buttons:[]},changes:[]},now);
  await store.accept({owner:'123',chat:123,updateId:2,text:'yes'},now,false);
  const confirmLease=(await store.claim('123',now))!;
  const call:import('../../src/ai/contracts.ts').ToolCall={name:'resolve_pending',args:{pending_id:pending.id,accept:true}};
  await journal.turn(confirmLease,[{role:'user',parts:[{text:'yes'}]}],store,mutate,async()=>({content:{role:'model',parts:[{functionCall:call}]},calls:[call],text:''}),()=>now);
  assert.equal((await store.tasks('123',0)).length,3);
  assert.equal(await journal.pending('123',now),null);
 }finally{await mf.dispose();}
});

test('today pagination mixes events and sessions without hiding or skipping entries',async()=>{
 const {sessionCommand}=await import('../../src/application/session-command.ts');
 const {dayStart}=await import('../../src/domain/session.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-13T08:00:00+07:00'),start=dayStart(now);
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','study',0)");
  for(let n=0;n<5;n++)await db.prepare('INSERT INTO local_events(id,owner,title,start_at) VALUES(?,?,?,?)').bind('e'+n,'123','event'+n,start+(9+n)*3600000).run();
  await db.prepare("INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('s','123','t',?,25,'planned',?)").bind(start+10.5*3600000,now+86400000).run();
  const store=new D1WorkStore(db);
  const first=(await sessionCommand({owner:'123',chat:123,updateId:1,text:'/today'},store,now))!;
  assert.equal(first.view.text.split('\n').length,3);
  assert.match(first.view.text,/event0/);assert.match(first.view.text,/study/);
  assert.ok(first.view.buttons.flat().some(b=>b.callback_data==='today-page:3'));
  const second=(await sessionCommand({owner:'123',chat:123,updateId:2,callback:'today-page:3'},store,now))!;
  assert.match(second.view.text,/event2/);assert.match(second.view.text,/event4/);
  assert.equal(second.view.buttons.flat().some(b=>b.text==='Trang tiếp'),false);
 }finally{await mf.dispose();}
});

test('urgent task beyond first twenty is included in overview and model context',async()=>{
 const {buildContext}=await import('../../src/application/context-builder.ts');
 const {planCommand}=await import('../../src/application/plan-command.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  for(let n=0;n<25;n++)await db.prepare('INSERT INTO tasks(id,owner,title,created) VALUES(?,?,?,?)').bind('t'+n,'123','work'+n,n).run();
  await db.prepare("UPDATE tasks SET deadline='2026-09-13T09:00:00+07:00' WHERE id='t24'").run();
  const store=new D1WorkStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  const context=JSON.parse((await buildContext(store,'123','what next',now)).context);
  assert.ok(context.tasks.some((t:{id:string})=>t.id==='t24'));
  const view=await planCommand({owner:'123',chat:123,updateId:1,text:'/tasks'},store,now);
  assert.match(view.view.text,/1\. work24/);
 }finally{await mf.dispose();}
});

test('respond preceding mutations does not shift local task references',async()=>{
 const {runToolTurn}=await import('../../src/application/conversation-command.ts');
 const calls:import('../../src/ai/contracts.ts').ToolCall[]=[
  {name:'respond',args:{message:'Saved; what time?'}},
  {name:'create_task',args:{title:'report',deadline:null}},
  {name:'save_clarification',args:{subject:'reminder',question:'What time?',task_id:'@1'}}
 ];
 let checked=false;
 await runToolTurn([{role:'user',parts:[{text:'new task'}]}],{
  model:async()=>({content:{role:'model',parts:[]},calls,text:''}),
  execute:async()=>{throw Error('batch expected');},commit:async()=>{throw Error('batch expected');},
  batch:async(group,message)=>{assert.equal(group[1]!.args.task_id,'@0');checked=true;return message;}
 });
 assert.equal(checked,true);
});
