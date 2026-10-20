import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {boardCommand} from '../../src/application/progress-renderer.ts';
import {unlockAchievements} from '../../src/adapters/d1/progress-store.ts';
import type {Database,Statement} from '../../src/adapters/d1/database.ts';
import {buildContext} from '../../src/application/context-builder.ts';
import type {WorkReader} from '../../src/ports/work-store.ts';

test('conversation progress keeps exactly the previous facts with three read-only queries at scale',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-21T23:59:59+07:00'),seed:Statement[]=[];
  for(let i=0;i<250;i++){
   const id='completed-'+String(i).padStart(3,'0'),at=now-Math.floor(i/2)*86400000;
   seed.push(db.prepare("INSERT INTO tasks(id,owner,title,status,created,archived_at,deleted_at) VALUES(?,'123',?,'completed',?,?,?)").bind(id,'Completed '+i,at,i%5===0?at:null,i%7===0?at:null));
   seed.push(db.prepare("INSERT INTO task_completions(owner,task_id,completed_at,deadline,precision) VALUES('123',?,?,?,?)").bind(id,at,i%2?'2026-10-21':null,i%2?'date':null));
   seed.push(db.prepare("INSERT INTO task_progress(id,owner,task_id,content,created,source_update) VALUES(?,'123',?,?,?,?)").bind('progress-'+id,id,'Small step '+i,at,i+1));
  }
  for(let i=0;i<25;i++)seed.push(db.prepare("INSERT INTO achievements(owner,code,unlocked_at,notified) VALUES('123',?,?,?)").bind('a'+String(i).padStart(2,'0'),now-i,i%2));
  seed.push(db.prepare("INSERT INTO tasks(id,owner,title,status,created) VALUES('foreign','999','private-title','completed',0)"));
  seed.push(db.prepare("INSERT INTO task_completions(owner,task_id,completed_at) VALUES('999','foreign',?)").bind(now+1));
  seed.push(db.prepare("INSERT INTO task_progress(id,owner,task_id,content,created,source_update) VALUES('foreign-progress','999','foreign','private-note',?,999)").bind(now+1));
  seed.push(db.prepare("INSERT INTO achievements(owner,code,unlocked_at) VALUES('999','private-achievement',?)").bind(now+1));
  for(let i=0;i<seed.length;i+=100)await db.batch(seed.slice(i,i+100));
  const sqls:string[]=[];
  const wrap=(statement:Statement,sql:string):Statement=>({
   bind:(...args)=>wrap(statement.bind(...args),sql),
   first:async<T>()=>{sqls.push(sql);return statement.first<T>();},
   all:async<T>()=>{sqls.push(sql);return statement.all<T>();},
   run:async()=>{throw Error('Progress context must not write');},
  });
  const observed:Database={prepare:sql=>wrap(db.prepare(sql),sql),batch:async()=>{throw Error('Progress context must not write');}};
  const store=new D1WorkStore(observed);
  const full=await store.progress('123',now);
  assert.equal(sqls.length,6);
  sqls.length=0;
  const compact=await store.conversationProgress('123');
  assert.equal(sqls.length,3);
  assert.ok(sqls.every(sql=>sql.startsWith('SELECT ')&&!/WITH |COUNT\(|SUM\(|ROW_NUMBER|calendar/i.test(sql)));
  assert.deepEqual(compact,{completions:full.completions.slice(0,3),milestones:full.milestones.slice(0,3),achievements:full.achievements});
  assert.equal(compact.achievements.length,20);
  assert.doesNotMatch(JSON.stringify(compact),/private-/);
  assert.deepEqual(await store.conversationProgress('empty'),{completions:[],milestones:[],achievements:[]});
  // Exercise the real builder through both interfaces: history trimming and all
  // other fields must remain byte-for-byte identical, including action context.
  const reader=new D1WorkStore(db);
  const legacy=Object.create(reader) as WorkReader;
  legacy.conversationProgress=undefined;
  for(const includeSummaryRequest of [false,true]){
   const before=await buildContext(legacy,'123','Mai thì sao?',now,{includeSummaryRequest});
   const after=await buildContext(reader,'123','Mai thì sao?',now,{includeSummaryRequest});
   assert.deepEqual(after,before);
  }
  assert.ok((await reader.progress('123',now)).summary,'Full progress still has chart and streak statistics');
 }finally{await mf.dispose();}
});
test('board selection is non-destructive, confirmed deletion is scoped and preserves achievements',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),now=Date.now();let id=0;
  for(let n=0;n<7;n++)await db.prepare('INSERT INTO tasks(id,owner,title,created) VALUES(?,?,?,?)').bind('t'+n,'123','task '+n,n).run();
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('foreign','999','private',0)");
  const run=async(callback:string)=>{
   const input={owner:'123',chat:123,updateId:++id,callback};
   const plan=await boardCommand(input,store,now);assert.ok(plan);
   await db.batch([...store.mutationStatements('123',plan.changes,now),db.prepare('DELETE FROM transaction_guard')]);
   return plan;
  };
  const page=await run('board:active:0');
  assert.match(page.view.text,/7 việc/);assert.ok(!page.view.text.includes('private'));
  await run('board-select:t0:0:active:0');
  assert.ok(await store.task('123','t0'));
  await db.exec("UPDATE tasks SET status='completed' WHERE id='t0'");
  await unlockAchievements(db,'123',now+1000);
  assert.equal((await store.progress('123')).achievements.length,1);
  await db.exec("UPDATE tasks SET status='active' WHERE id='t0'");
  assert.equal((await store.progress('123')).completions.length,0);
  // Status-only SQL does not change the test version; selected snapshot still matches.
  await run('board-review');
  await run('board-delete:1');
  assert.equal(await store.task('123','t0'),null);
  assert.ok(await store.task('999','foreign'));
  assert.equal((await store.progress('123')).achievements.length,1);
  assert.equal((await store.workPage('123','all',0,now)).total,6);
  const stale=await run('board-delete:1');assert.match(stale.view.text,/Chưa có lựa chọn/);
 }finally{await mf.dispose();}
});

test('Telegram photo cards use multipart upload and edit the same photo on navigation',async()=>{
 const {D1UiStore}=await import('../../src/adapters/d1/ui-store.ts');
 const {progressView}=await import('../../src/application/progress-renderer.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const ui=new D1UiStore(db),now=Date.now(),data={completions:[],milestones:[],achievements:[]};
  const view=await progressView(data,now);
  const created=ui.create('123',123,view,now,now+900000);await db.batch(created.statements);
  const methods:string[]=[];
  const transport:typeof fetch=async(url,init)=>{
   methods.push(String(url).split('/').at(-1)!);
   assert.ok(init?.body instanceof FormData);
   const form=init.body;
   assert.equal(form.get('chat_id'),'123');
   const chart=form.get('chart');assert.ok(chart instanceof Blob);assert.equal(chart.type,'image/png');
   if(methods.length===1)assert.equal(form.get('photo'),'attach://chart');
   else {assert.equal(form.get('message_id'),'77');assert.equal(JSON.parse(String(form.get('media'))).type,'photo');}
   return Response.json({ok:true,result:{message_id:77}});
  };
  await ui.flush('123','123:fake',transport,()=>now);
  const card=(await ui.card('123',created.id))!;
  const button=JSON.parse(card.view_json).buttons[0][0].callback_data;
  const resolved=(await ui.resolve('123',123,77,button,now))!;
  await db.batch(ui.update(card,resolved.action,await progressView(data,now,true),'active',now));
  await ui.flush('123','123:fake',transport,()=>now);
  assert.deepEqual(methods,['sendPhoto','editMessageMedia']);
 }finally{await mf.dispose();}
});

test('changed selection cancels deletion; exit clears selection and achievement delivery is idempotent',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),now=Date.now();let id=0;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','original',0)");
  const run=async(callback:string)=>{
   const p=await boardCommand({owner:'123',chat:123,updateId:++id,callback},store,now);
   assert.ok(p);await db.batch([...store.mutationStatements('123',p.changes,now),db.prepare('DELETE FROM transaction_guard')]);return p;
  };
  await run('board-select:t:0:active:0');
  await db.exec("UPDATE tasks SET title='changed',version=version+1 WHERE id='t'");
  const rejected=await run('board-delete:1');
  assert.match(rejected.view.text,/chưa xóa gì/);
  assert.ok(await store.task('123','t'));
  await run('board-select:t:2:active:0');await run('board-exit');
  assert.equal((await store.boardSelection('123')).items.length,0);
  await db.exec("UPDATE tasks SET status='completed' WHERE id='t'");
  await Promise.all([unlockAchievements(db,'123',now+1000),unlockAchievements(db,'123',now+1000)]);
  const deliveries=await db.prepare("SELECT id FROM outbox WHERE id LIKE 'achievement:%'").all();
  assert.equal(deliveries.results.length,1);
 }finally{await mf.dispose();}
});

test('editing title and deadline together uses the same executor and versioned transaction',async()=>{
 const {executeTool}=await import('../../src/application/tool-executor.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','old',0)");
  const store=new D1WorkStore(db);
  const outcome=await executeTool({name:'update_task',args:{task_id:'t',expected_version:1,patch:{title:'new',deadline:{value:'2026-09-15',precision:'date'}}}},store,'123',1,1000);
  await db.exec("INSERT INTO command_inbox(owner,update_id,payload,created,delivery) VALUES('123',1,'{}',0,0); INSERT INTO tool_steps(owner,update_id,step_key,kind,state,request_json,result_json,created) VALUES('123',1,'write','write','done','{}','{}',0)");
  await db.batch([...store.mutationStatements('123',outcome.changes,1000,true),db.prepare('DELETE FROM transaction_guard')]);
  const task=(await store.task('123','t'))!;
  assert.equal(task.title,'new');assert.equal(task.deadline,'2026-09-15');assert.equal(task.version,3);
 }finally{await mf.dispose();}
});
