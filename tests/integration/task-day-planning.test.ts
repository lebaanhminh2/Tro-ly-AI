import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {DayPlanStore} from '../../src/adapters/d1/day-plan-store.ts';
import {TaskDayStore} from '../../src/adapters/d1/task-day-store.ts';

async function database(){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
 for(const file of readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
 return {mf,db};
}

test('manual save plans only from save time and splits one task around busy time',async()=>{
 const {mf,db}=await database();
 try{
  const now=Date.parse('2026-09-14T09:02:00+07:00'),at=(time:string)=>Date.parse('2026-09-14T'+time+':00+07:00');
  const schedule=new ScheduleStore(db),work=new D1WorkStore(db);
  const day=(await schedule.configure('123','04:30','22:30',0,now))!;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','Deep work',0)");
  const prepared=await work.prepareSchedule('123',now,day.version,[{start:at('07:00'),end:at('14:00')}],[{start:at('10:00'),end:at('11:00')}],[{id:'a',minutes:180}],'manual-save');
  await db.batch(prepared.statements);
  const saved=(await new DayPlanStore(db).ensure('123',now))!;
  const windows=saved.plan.items.find(item=>item.taskId==='a')!.windows;
  assert.ok(windows.length>=2,'a long task can occupy multiple blocks');
  assert.ok(windows.every(window=>window.start>=at('09:05')),'past availability is never backfilled');
  assert.ok(windows.every(window=>window.end<=at('10:00')||window.start>=at('11:00')),'busy time remains unavailable');
  assert.equal(windows.reduce((sum,window)=>sum+(window.end-window.start)/60000,0),120,'automatic focus cap is split without pretending the whole estimate was scheduled');
  const row=await db.prepare("SELECT task_plan_status,task_plan_source,task_plan_effective_from FROM schedule_days WHERE owner='123'").first<{task_plan_status:string;task_plan_source:string;task_plan_effective_from:number}>();
  assert.deepEqual(row,{task_plan_status:'active',task_plan_source:'manual',task_plan_effective_from:at('09:05')});
  assert.equal(saved.plan.assumed,false,'saving blank free/busy explicitly means the remaining day is available');
 }finally{await mf.dispose();}
});

test('automatic plan waits for the snapshotted setting and starts at the actual activation time',async()=>{
 const {mf,db}=await database();
 try{
  const start=Date.parse('2026-09-14T04:30:00+07:00'),schedule=new ScheduleStore(db),taskDay=new TaskDayStore(db);
  const day=(await schedule.configure('123','04:30','22:30',0,start,undefined,180))!;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0); INSERT INTO task_planning(owner,task_id,remaining_minutes,updated) VALUES('123','a',60,0)");
  assert.equal(day.task_plan_status,'waiting');assert.equal(day.task_plan_due,start+180*60000);
  await schedule.configure('123','04:30','22:30',1,start+30*60000,undefined,60);
  const unchanged=await schedule.ensureDay('123',start+30*60000);assert.equal(unchanged!.task_plan_due,start+180*60000);
  assert.equal(await taskDay.activateAutomatic('123',start+179*60000),null);
  const activated=(await taskDay.activateAutomatic('123',start+181*60000))!;
  const floor=start+185*60000;
  assert.ok(activated.plan.items.flatMap(item=>item.windows).every(window=>window.start>=floor));
  const row=await db.prepare("SELECT task_plan_status,task_plan_source,task_plan_effective_from FROM schedule_days WHERE owner='123'").first<{task_plan_status:string;task_plan_source:string;task_plan_effective_from:number}>();
  assert.deepEqual(row,{task_plan_status:'active',task_plan_source:'automatic',task_plan_effective_from:floor});
  assert.equal(activated.plan.assumed,true,'automatic fallback is visibly an assumed free day');
  assert.equal((await schedule.settings('123'))!.auto_plan_delay_minutes,60,'changed delay applies to later days');
 }finally{await mf.dispose();}
});

test('automatic-plan delay accepts only 30-minute steps from 30 to 720',async()=>{
 const {mf,db}=await database();
 try{
  const schedule=new ScheduleStore(db),now=Date.parse('2026-09-14T04:30:00+07:00');
  await assert.rejects(schedule.configure('123','04:30','22:30',0,now,undefined,45),/INVALID_SETTINGS/);
  await schedule.configure('123','04:30','22:30',0,now,undefined,720);
  assert.equal((await schedule.settings('123'))!.auto_plan_delay_minutes,720);
 }finally{await mf.dispose();}
});
