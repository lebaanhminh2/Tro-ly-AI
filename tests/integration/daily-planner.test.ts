import test from 'node:test';
import assert from 'node:assert/strict';
import {planDay} from '../../src/application/daily-planner.ts';
import {availableRanges} from '../../src/domain/availability.ts';
const hour=3600000;
test('availability patches subtract busy time without erasing other hours',()=>{
 assert.deepEqual(availableRanges([{start:14*hour,end:17*hour}],[{start:15*hour,end:16*hour}],0),[{start:14*hour,end:15*hour},{start:16*hour,end:17*hour}]);
});
test('planner fills realistic capacity with breaks and keeps unfinished work explicit',()=>{
 const tasks=Array.from({length:6},(_,n)=>({id:'t'+n,status:'active' as const,deleted:false,deadline:12*hour,remainingMinutes:25}));
 const result=planDay(tasks,[{start:9*hour,end:12*hour}],[],8*hour);
 assert.equal(result.blocks.length,6); // Five full blocks plus a five-minute start.
 assert.equal(result.unplanned.length,1);
 assert.equal(result.unplanned[0]!.minutes,20);
 for(let n=1;n<result.blocks.length;n++)assert.ok(result.blocks[n]!.start>=result.blocks[n-1]!.end+10*60000);
 assert.ok(result.blocks.every(b=>b.end<=12*hour));
});
test('completed/deleted work excluded; missing estimate or missed deadline not guessed away',()=>{
 const result=planDay([
  {id:'done',status:'completed',deleted:false,deadline:null,remainingMinutes:25},
  {id:'deleted',status:'active',deleted:true,deadline:null,remainingMinutes:25},
  {id:'unknown',status:'active',deleted:false,deadline:null,remainingMinutes:null},
  {id:'late',status:'active',deleted:false,deadline:7*hour,remainingMinutes:25}
 ],[{start:9*hour,end:12*hour}],[],8*hour);
 assert.equal(result.blocks.length,1);
 assert.equal(result.blocks[0]!.taskId,'late');
 assert.deepEqual(new Set(result.unplanned.map(t=>t.reason)),new Set(['needs_estimate']));
});

test('replan persists blocks and keeps omitted tasks visible as unplanned',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-13T08:00:00+07:00');
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await db.exec("INSERT INTO tasks(id,owner,title,deadline,created) VALUES('late','123','late','2026-09-12',0),('other','123','other',NULL,0)");
  const store=new D1WorkStore(db),prepared=await store.prepareSchedule('123',now,1,[{start:now+3600000,end:now+7200000}],[],[{id:'late',minutes:25}],'test-schedule');
  await db.batch(prepared.statements);
  assert.equal((await store.sessions('123',now,now+86400000)).length,1);
  assert.equal((await store.task('123','late'))!.deadline,'2026-09-12');
  assert.ok(JSON.stringify(prepared.plan.unplanned).includes('other'));
 }finally{await mf.dispose();}
});

test('/lich tool commits through outer transaction, plain chat cannot silently replan',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const {ConversationStore}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-13T08:00:00+07:00');
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','report',0)");
  const store=new D1WorkStore(db);
  const tool:import('../../src/ai/contracts.ts').ToolCall={name:'replan_day',args:{expected_version:1,free:[{start:'2026-09-13T09:00:00+07:00',end:'2026-09-13T10:00:00+07:00'}],busy:[],estimates:[{id:'t',minutes:25}]}};
  for(const [updateId,text,allowed] of [[1,'tớ bận',false],[2,'/lich rảnh 9–10h',true]] as const){
   await store.accept({owner:'123',chat:123,updateId,text},now,false);
   const lease=(await store.claim('123',now))!;lease.pendingWrites=[];
   const journal=new ConversationStore(db,s=>lease.pendingWrites!.push(...s));
   const reply=await journal.turn(lease,[{role:'user',parts:[{text}]}],store,(c,t)=>store.mutationStatements('123',c,t,true),async()=>({content:{role:'model',parts:[{functionCall:tool}]},calls:[tool],text:''}),()=>now);
   assert.equal((await store.sessions('123',now,now+86400000)).length,0);
   await store.commit(lease,{view:{text:reply,buttons:[]},changes:[]},now);
   assert.equal((await store.sessions('123',now,now+86400000)).length,allowed?1:0);
  }
 }finally{await mf.dispose();}
});

test('morning reply permission is bound to owner, sent message and current operating day',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new ScheduleStore(db),now=Date.parse('2026-09-13T04:30:00+07:00');
  await store.configure('123','04:30','22:30',0,now);
  await store.queueCheckIns('123',now);
  await db.prepare("UPDATE outbox SET state='sent',message_id=77 WHERE id LIKE 'healthy:morning:123:%'").run();
  assert.equal(await store.isMorningReply('123',77,now+3600000),true);
  assert.equal(await store.isMorningReply('999',77,now+3600000),false);
  assert.equal(await store.isMorningReply('123',78,now+3600000),false);
  assert.equal(await store.isMorningReply('123',77,now+86400000),false);
  await store.reportSleep('123',now+20*3600000);
  assert.equal(await store.isMorningReply('123',77,now+20*3600000),false);
 }finally{await mf.dispose();}
});

test('bare schedule command opens a bounded dialogue; cancel closes its authority',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const {planCommand}=await import('../../src/application/plan-command.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-13T08:00:00+07:00'),schedule=new ScheduleStore(db),store=new D1WorkStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  const noModel=async()=>{throw Error('bare command must not call model');};
  await planCommand({owner:'123',chat:123,updateId:1,text:'/lich'},store,now,noModel);
  assert.equal(await schedule.isMorningReply('123',undefined,now+1000),true);
  assert.equal(await schedule.isMorningReply('999',undefined,now+1000),false);
  assert.equal(await schedule.isMorningReply('123',undefined,now+900001),false);
  await planCommand({owner:'123',chat:123,updateId:2,text:'/huy'},store,now,noModel);
  assert.equal(await schedule.isMorningReply('123',undefined,now+1000),false);
 }finally{await mf.dispose();}
});
