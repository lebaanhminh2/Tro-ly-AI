import test from 'node:test';
import assert from 'node:assert/strict';
import {planDay} from '../../src/application/daily-planner.ts';
import {availableRanges} from '../../src/domain/availability.ts';
import {chooseDailyPlan,chooseManualPlan} from '../../src/application/work-planner.ts';
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

test('automatic daily plan keeps a small sequential focus set and defers unknown work',()=>{
 const start=Date.parse('2026-09-14T09:00:00+07:00');
 const result=chooseDailyPlan([
  {id:'urgent',title:'Urgent',deadline:start+8*3600000,remaining:180,priority:2,updated:0,created:0},
  {id:'next',title:'Next',deadline:start+2*86400000,remaining:240,priority:1,updated:0,created:1},
  {id:'steady',title:'Steady',deadline:null,remaining:240,priority:0,updated:0,created:2},
  {id:'unknown',title:'Unknown',deadline:null,remaining:null,priority:0,updated:0,created:3},
 ],[{day:1,ranges:[{start,end:start+10*3600000}],assumed:false}],start);
 assert.ok(result.items.length<=3);
 assert.ok(!result.items.some(item=>item.taskId==='unknown'));
 assert.ok(result.later.some(item=>item.taskId==='unknown'&&item.reason==='needs_estimate'));
 assert.ok(result.items.every(item=>item.minutes>=15));
});

test('manual Today may exceed calculated capacity but only real windows are nudged',()=>{
 const start=Date.parse('2026-09-14T08:00:00+07:00'),end=Date.parse('2026-09-14T18:00:00+07:00');
 const tasks=[
  {id:'a',title:'A',deadline:null,remaining:500,priority:0,updated:0,created:0},
  {id:'b',title:'B',deadline:null,remaining:500,priority:0,updated:0,created:1}
 ];
 const plan=chooseManualPlan(tasks,[{day:1,ranges:[{start,end}],assumed:false}],start,[{taskId:'a',minutes:500},{taskId:'b',minutes:500}]);
 assert.equal(plan.capacity,480,'capacity is calculated from this day, including contingency');
 assert.equal(plan.planned,1000);assert.equal(plan.overflow,520);
 assert.ok((plan.unscheduled??0)>0);
 assert.equal(plan.items.reduce((sum,item)=>sum+(item.scheduledMinutes??0),0),plan.planned-plan.unscheduled!);
 assert.ok(plan.items.flatMap(item=>item.windows).every(window=>window.start>=start&&window.end<=end));
});

test('manual Today preserves completed totals, supports removal and resets at next operating day',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const {DayPlanStore}=await import('../../src/adapters/d1/day-plan-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T08:00:00+07:00'),schedule=new ScheduleStore(db),work=new D1WorkStore(db),plans=new DayPlanStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',1)");
  const initial=(await plans.ensure('123',now))!;
  await db.prepare("INSERT INTO nudge_cycles(owner,day,next_at) VALUES('123',?,0)").bind(initial.plan.day).run();
  await db.prepare("INSERT INTO outbox(id,payload,available) VALUES('nudge:123:old','{}',0)").run();
  await plans.replace('123','manual_plan_001',initial.version,[{taskId:'a',minutes:500},{taskId:'b',minutes:500}],now);
  let saved=(await plans.ensure('123',now))!;assert.equal(saved.plan.planned,1000);assert.deepEqual(saved.plan.manualItems?.map(item=>item.taskId),['a','b']);
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='nudge:123:old'").first<{state:string}>())!.state,'failed');
  await db.prepare("UPDATE nudge_cycles SET attempts=2,tasks_json='[\"a\"]' WHERE owner='123'").run();
  await work.mutateHierarchy('123','complete_a_001',{operation:'complete',taskId:'a',version:1,complete:true,confirm:true},now+1000);
  const cycle=await db.prepare("SELECT attempts,tasks_json FROM nudge_cycles WHERE owner='123'").first<{attempts:number;tasks_json:string}>();assert.equal(cycle?.attempts,0);assert.equal(cycle?.tasks_json,'[]');
  saved=(await plans.ensure('123',now+1000))!;assert.equal(saved.plan.planned,1000);assert.equal(saved.plan.items.length,2);
  await plans.replace('123','remove_b_001',saved.version,[{taskId:'a',minutes:500}],now+2000);
  saved=(await plans.ensure('123',now+2000))!;assert.deepEqual(saved.plan.items.map(item=>item.taskId),['a']);assert.equal(saved.plan.planned,500);
  const tomorrow=(await plans.ensure('123',now+86400000))!;assert.ok(!tomorrow.plan.items.some(item=>item.taskId==='a'));assert.ok(!tomorrow.plan.items.some(item=>item.taskId==='b'));assert.ok(tomorrow.plan.later.some(item=>item.taskId==='b'&&item.reason==='needs_estimate'));
 }finally{await mf.dispose();}
});

test('daily work log replaces the same-day value and carries only remaining effort forward',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {DayPlanStore}=await import('../../src/adapters/d1/day-plan-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-15T08:00:00+07:00'),plans=new DayPlanStore(db);
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0); INSERT INTO task_planning(owner,task_id,remaining_minutes,updated) VALUES('123','a',240,0)");
  let result=await plans.logWork('123','work_log_001','a',30,null,now);
  assert.equal(result.remaining,210);
  result=await plans.logWork('123','work_log_001','a',30,null,now);
  assert.equal(result.remaining,210,'retry returns receipt and cannot subtract twice');
  result=await plans.logWork('123','work_log_002','a',45,null,now+1000);
  assert.equal(result.remaining,195,'editing replaces the old daily value and applies only the difference');
  let saved=(await plans.ensure('123',now+1000))!;
  assert.equal(saved.plan.items.find(item=>item.taskId==='a')?.actualMinutes,45);
  assert.equal((await db.prepare("SELECT remaining_minutes FROM task_planning WHERE owner='123' AND task_id='a'").first<{remaining_minutes:number}>())!.remaining_minutes,195);
  saved=(await plans.ensure('123',now+86400000))!;
  assert.equal(saved.plan.items.find(item=>item.taskId==='a')?.actualMinutes,0,'new day starts a fresh actual-work field');
  assert.equal(saved.plan.items.find(item=>item.taskId==='a')?.remaining,195,'remaining estimate persists without re-entry');
 }finally{await mf.dispose();}
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
  assert.equal((await db.prepare("SELECT remaining_minutes FROM task_planning WHERE owner='123' AND task_id='late'").first<{remaining_minutes:number}>())!.remaining_minutes,25);
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

test('availability update accepts multiple busy intervals without task estimates',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const {Miniflare}=await import('miniflare');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as import('../../src/adapters/d1/database.ts').Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T08:00:00+07:00'),store=new D1WorkStore(db);
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','report',0)");
  const busy=[{start:Date.parse('2026-09-14T14:00:00+07:00'),end:Date.parse('2026-09-14T16:00:00+07:00')},{start:Date.parse('2026-09-14T17:00:00+07:00'),end:Date.parse('2026-09-14T18:00:00+07:00')}];
  const prepared=await store.prepareSchedule('123',now,1,[],busy,[],'availability-test');
  await db.batch(prepared.statements);
  const row=await db.prepare('SELECT intervals_json FROM schedule_days WHERE owner=?').bind('123').first<{intervals_json:string}>();
  const saved=JSON.parse(row!.intervals_json);
  assert.deepEqual(saved.busy,busy);assert.equal(saved.unplanned[0].reason,'needs_estimate');
  assert.equal((await store.sessions('123',now,now+86400000)).length,0);
 }finally{await mf.dispose();}
});
