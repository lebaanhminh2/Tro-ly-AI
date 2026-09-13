import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {boardCommand} from '../../src/application/progress-renderer.ts';
import {unlockAchievements} from '../../src/adapters/d1/progress-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
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
