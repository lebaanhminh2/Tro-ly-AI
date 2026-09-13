import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {HealthyStore} from '../../src/adapters/d1/healthy-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
test('task steps use permanent codes, parent completion needs consent and awards one ticket',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),now=Date.now();
  const created=await store.mutateHierarchy('123','create001',{operation:'create',title:'Report'},now);
  const id=String(created.id);
  await store.mutateHierarchy('123','step001',{operation:'add_step',taskId:id,version:1,title:'Outline'},now);
  let task=(await store.hierarchy('123'))[0]!;
  assert.equal(task.public_code,1);assert.equal(task.steps[0]!.step_code,1);
  await assert.rejects(store.mutateHierarchy('123','complete1',{operation:'complete',taskId:id,version:2,complete:true},now),/CONFIRM_CHILDREN/);
  const args={operation:'complete',taskId:id,version:2,complete:true,confirm:true};
  await store.mutateHierarchy('123','complete2',args,now);
  await store.mutateHierarchy('123','complete2',args,now);
  assert.equal((await new HealthyStore(db).read('123')).state.tickets,1);
  task=(await store.hierarchy('123'))[0]!;
  await assert.rejects(store.mutateHierarchy('123','reopen01',{operation:'step_status',taskId:id,stepId:task.steps[0]!.id,version:task.version,complete:false},now),/CONFIRM_REOPEN_PARENT/);
  await store.mutateHierarchy('123','reopen02',{operation:'step_status',taskId:id,stepId:task.steps[0]!.id,version:task.version,complete:false,confirm:true},now);
  task=(await store.hierarchy('123'))[0]!;
  assert.equal(task.status,'active');
  await store.mutateHierarchy('123','complete3',{operation:'complete',taskId:id,version:task.version,complete:true,confirm:true},now);
  assert.equal((await new HealthyStore(db).read('123')).state.tickets,1);
  await assert.rejects(store.mutateHierarchy('999','foreign1',{operation:'edit',taskId:id,version:5,title:'Hacked'},now),/STALE_TASK/);
 }finally{await mf.dispose();}
});

test('bulk delete is all-or-nothing and retries cannot affect newly changed tasks',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',0)");
  const store=new D1WorkStore(db);
  await assert.rejects(store.deleteHierarchyGroup('123','bad-group',[{id:'a',version:1},{id:'b',version:9}],1000));
  assert.ok(await store.task('123','a'));
  const items=[{id:'a',version:1},{id:'b',version:1}];
  await store.deleteHierarchyGroup('123','good-group',items,1000);
  await store.deleteHierarchyGroup('123','good-group',items,1000);
  assert.equal(await store.task('123','a'),null);assert.equal(await store.task('123','b'),null);
 }finally{await mf.dispose();}
});

test('chat child completion shares app mutation and outer commit without parent completion or tickets',async()=>{
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new D1WorkStore(db),now=Date.now();
  const parent=await store.mutateHierarchy('123','parent001',{operation:'create',title:'Report'},now);
  await store.mutateHierarchy('123','child001',{operation:'add_step',taskId:String(parent.id),version:1,title:'Outline'},now);
  const task=(await store.hierarchy('123'))[0]!;
  await store.accept({owner:'123',chat:123,updateId:1,text:'xong #1.1'},now,false);
  const lease=(await store.claim('123',now))!;lease.pendingWrites=[];
  const journal=new ConversationStore(db,s=>lease.pendingWrites!.push(...s));
  const call:import('../../src/ai/contracts.ts').ToolCall={name:'edit_task_step',args:{operation:'step_status',task_id:task.id,expected_version:task.version,step_id:task.steps[0]!.id,title:null,complete:true}};
  const reply=await journal.turn(lease,[{role:'user',parts:[{text:'xong #1.1'}]}],store,(c,t)=>store.mutationStatements('123',c,t,true),async()=>({content:{role:'model',parts:[{functionCall:call}]},calls:[call],text:''}),()=>now);
  assert.equal((await store.hierarchy('123'))[0]!.steps[0]!.status,'active');
  await store.commit(lease,{view:{text:reply,buttons:[]},changes:[]},now);
  const updated=(await store.hierarchy('123'))[0]!;
  assert.equal(updated.steps[0]!.status,'completed');assert.equal(updated.status,'active');
  assert.equal((await new HealthyStore(db).read('123')).state.tickets,0);
 }finally{await mf.dispose();}
});
