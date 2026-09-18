import {query,type Database} from './database.ts';
import {chooseDailyPlan,chooseManualPlan,type Candidate,type DayCapacity,type ManualDayItem,type WorkPlan} from '../../application/work-planner.ts';
import {dayWindow,operatingDay} from '../../domain/healthy.ts';
import {availableRanges,type TimeRange} from '../../domain/availability.ts';
import {HealthyStore} from './healthy-store.ts';
import {ceilToMinutes,deadlineAt} from '../../domain/time.ts';
export class DayPlanStore{
 private db:Database;
 constructor(db:Database){this.db=db;}
 async inputs(owner:string,now:number){
  const settings=await query(this.db,'SELECT * FROM schedule_settings WHERE owner=?',owner).first<{version:number;start_minutes:number;sleep_minutes:number|null;daily_budget_minutes:number}>();
  if(!settings||settings.sleep_minutes===null)return null;
  const day=operatingDay(now,settings.start_minutes),window=dayWindow(day,settings.start_minutes,settings.sleep_minutes);
  const tasks=(await query(this.db,"SELECT t.id,t.title,t.deadline,t.status,t.created,p.remaining_minutes AS remaining,COALESCE(p.priority,0) AS priority,COALESCE(p.updated,0) AS updated,COALESCE(p.version,0) AS estimate_version,COALESCE((SELECT l.minutes FROM task_work_logs l WHERE l.owner=t.owner AND l.task_id=t.id AND l.day=?),0) AS actual_minutes FROM tasks t LEFT JOIN task_planning p ON p.task_id=t.id AND p.owner=t.owner WHERE t.owner=? AND t.deleted_at IS NULL ORDER BY t.id",day,owner).all<{id:string;title:string;deadline:string|null;status:'active'|'completed';created:number;remaining:number|null;priority:number;updated:number;estimate_version:number;actual_minutes:number}>()).results;
  const saved=await query(this.db,'SELECT version,intervals_json,start_at,task_plan_status,task_plan_generation,task_plan_effective_from,task_plan_source,task_plan_due FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1',owner,now,now).first<{version:number;intervals_json:string;start_at:number;task_plan_status:'waiting'|'active'|'closed';task_plan_generation:number;task_plan_effective_from:number|null;task_plan_source:'manual'|'automatic'|'system'|null;task_plan_due:number|null}>();
  const intervals=JSON.parse(saved?.intervals_json??'{}');
  const events=(await query(this.db,"SELECT id,version,start_at,end_at FROM local_events WHERE owner=? AND status='scheduled' AND start_at<? AND COALESCE(end_at,start_at+3600000)>? ORDER BY id",owner,window.start+14*86400000,window.start).all<{id:string;version:number;start_at:number;end_at:number|null}>()).results;
  const days:DayCapacity[]=[];
  for(let n=0;n<14;n++){
   const w=dayWindow(day+n,settings.start_minutes,settings.sleep_minutes);
   const useSaved=n===0&&saved&&saved.start_at>=window.start;
   const base:TimeRange[]=useSaved&&intervals.free?.length?intervals.free:[{start:w.start,end:w.target}];
   const busy:TimeRange[]=[...(useSaved?intervals.busy??[]:[]),...events.map(e=>({start:e.start_at,end:e.end_at??e.start_at+3600000}))];
   const floor=n===0?Math.max(w.start,saved?.task_plan_effective_from??w.start):w.start;
   const ranges=availableRanges(base.map(r=>({start:Math.max(w.start,r.start),end:Math.min(w.target,r.end)})).filter(r=>r.end>r.start),busy,floor);
   days.push({day:day+n,ranges,assumed:!useSaved||saved?.task_plan_source==='automatic'&&!(intervals.free?.length||intervals.busy?.length)});
  }
  const candidates:Candidate[]=tasks.filter(t=>t.status==='active'&&(t.remaining===null||t.remaining>0)).map(t=>({...t,deadline:deadlineAt(t.deadline)}));
  // Completion changes presentation, not the plan promised for this day.
  // Deadline/estimate/create/delete and availability changes still replan.
  const signature=JSON.stringify([day,settings.version,saved?.version,events.map(e=>[e.id,e.version]),tasks.map(t=>[t.id,t.deadline,t.estimate_version,t.actual_minutes])]);
  return {day,window,settings,tasks,candidates,days,signature,dayRow:saved};
 }
 async ensure(owner:string,now:number){
  const input=await this.inputs(owner,now);if(!input)return null;
  if(!input.dayRow||input.dayRow.task_plan_status!=='active')return null;
  const existing=await query(this.db,'SELECT * FROM daily_plans WHERE owner=?',owner).first<{day:number;version:number;signature:string;plan_json:string;updated:number}>();
  if(existing?.signature===input.signature)return {version:existing.version,plan:JSON.parse(existing.plan_json) as WorkPlan,updated:existing.updated};
  const previous=existing?.day===input.day?JSON.parse(existing.plan_json) as WorkPlan:null;
  const manual=previous?.manualItems;
  const effective=ceilToMinutes(Math.max(now,input.dayRow.task_plan_effective_from??now));
  const days=input.days.map((day,index)=>index?day:{...day,ranges:availableRanges(day.ranges,[],effective)});
  let plan=manual?chooseManualPlan(input.candidates,days,effective,manual.filter(item=>input.candidates.some(task=>task.id===item.taskId))):chooseDailyPlan(input.candidates,days,effective);
  const actual=new Map(input.tasks.map(task=>[task.id,task.actual_minutes]));
  plan.items.forEach(item=>{item.actualMinutes=actual.get(item.taskId)??0;});
  plan=this.preserveCompleted(plan,previous,input.tasks,manual);
  const oldVersion=existing?.version??0;
  await this.db.batch([
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM daily_plans WHERE owner=?),0)=? THEN 1 ELSE 0 END',owner,oldVersion),
   query(this.db,'INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET day=excluded.day,version=version+1,signature=excluded.signature,plan_json=excluded.plan_json,updated=excluded.updated',owner,input.day,input.signature,JSON.stringify(plan),now),
   query(this.db,"UPDATE schedule_days SET task_plan_generation=task_plan_generation+1,task_plan_effective_from=?,task_plan_source=COALESCE(task_plan_source,'system') WHERE owner=? AND day=?",effective,owner,input.day),
   query(this.db,"UPDATE outbox SET state='failed' WHERE (id LIKE ? OR id LIKE ?) AND state='pending'",'daily:'+owner+':%','task-nudge:'+owner+':%'),
   query(this.db,"UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN (SELECT id FROM sessions WHERE owner=? AND id LIKE ? AND status IN ('planned','draft'))",owner,owner,'daily_'+owner+'_'+input.day+'_%'),
   query(this.db,"UPDATE sessions SET status='skipped',version=version+1 WHERE owner=? AND id LIKE ? AND status IN ('planned','draft')",owner,'daily_'+owner+'_'+input.day+'_%'),
   query(this.db,'DELETE FROM transaction_guard')
  ]);
  return {version:oldVersion+1,plan,updated:now};
 }
 private preserveCompleted(plan:WorkPlan,previous:WorkPlan|null,tasks:{id:string;status:'active'|'completed'}[],manual?:ManualDayItem[]){
  if(!previous)return plan;
  const completed=new Set(tasks.filter(task=>task.status==='completed').map(task=>task.id));
  const oldDone=new Map(previous.items.filter(item=>completed.has(item.taskId)).map(item=>[item.taskId,item]));
  if(!oldDone.size)return plan;
  const fresh=new Map(plan.items.map(item=>[item.taskId,item])),items=[] as typeof plan.items;
  for(const old of previous.items){const item=oldDone.get(old.taskId)??fresh.get(old.taskId);if(item&&!items.some(saved=>saved.taskId===item.taskId))items.push(item);}
  for(const item of plan.items)if(!items.some(saved=>saved.taskId===item.taskId))items.push(item);
  plan.items=items;plan.planned=items.reduce((sum,item)=>sum+item.minutes,0);plan.overflow=Math.max(0,plan.planned-plan.capacity);
  if(manual)plan.manualItems=manual.map(item=>({...item}));
  return plan;
 }
 async replace(owner:string,id:string,version:number,items:ManualDayItem[],now:number){
  const input=await this.inputs(owner,now),saved=await this.ensure(owner,now);if(!input||!saved||saved.version!==version)throw Error('PLAN_CHANGED');
  if(items.length>50||new Set(items.map(item=>item.taskId)).size!==items.length||items.some(item=>!item.taskId||!Number.isInteger(item.minutes)||item.minutes<5||item.minutes>960))throw Error('INVALID_MANUAL_PLAN');
  const active=new Set(input.candidates.map(task=>task.id)),completed=new Set(input.tasks.filter(task=>task.status==='completed').map(task=>task.id));
  const old=new Map(saved.plan.items.map(item=>[item.taskId,item]));
  if(items.some(item=>!active.has(item.taskId)&&!(completed.has(item.taskId)&&old.has(item.taskId))))throw Error('TASK_NOT_AVAILABLE');
  let plan=chooseManualPlan(input.candidates,input.days,now,items.filter(item=>active.has(item.taskId)));
  const planned=new Map(plan.items.map(item=>[item.taskId,item]));
  plan.items=items.map(item=>planned.get(item.taskId)??{...old.get(item.taskId)!,minutes:item.minutes,manual:true,scheduledMinutes:item.minutes});
  plan.manualItems=items.map(item=>({...item}));plan.planned=items.reduce((sum,item)=>sum+item.minutes,0);plan.overflow=Math.max(0,plan.planned-plan.capacity);
  const actual=new Map(input.tasks.map(task=>[task.id,task.actual_minutes]));
  plan.items.forEach(item=>{item.actualMinutes=actual.get(item.taskId)??0;});
  return new HealthyStore(this.db).mutate(owner,id,'plan-replace',{version,items},now,state=>({state,result:{saved:true,overflow:plan.overflow,unscheduled:plan.unscheduled??0},statements:[
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM daily_plans WHERE owner=? AND version=? AND day=?) THEN 1 ELSE 0 END',owner,version,input.day),
   query(this.db,'UPDATE daily_plans SET version=version+1,plan_json=?,updated=? WHERE owner=?',JSON.stringify(plan),now,owner),
   query(this.db,"UPDATE schedule_days SET task_plan_generation=task_plan_generation+1,task_plan_effective_from=?,task_plan_source='manual' WHERE owner=? AND day=?",ceilToMinutes(now),owner,input.day),
   query(this.db,"UPDATE outbox SET state='failed' WHERE id LIKE ? AND state='pending'",'task-nudge:'+owner+':%')
  ]}));
 }
 async logWork(owner:string,id:string,taskId:string,minutes:number,note:string|null,now:number){
  if(!Number.isInteger(minutes)||minutes<0||minutes>1440||note!==null&&note.length>500)throw Error('INVALID_WORK_LOG');
  const input=await this.inputs(owner,now);if(!input)throw Error('NO_ACTIVE_DAY');
  const task=input.tasks.find(item=>item.id===taskId&&item.status==='active');if(!task)throw Error('TASK_NOT_AVAILABLE');
  const previous=await query(this.db,'SELECT minutes FROM task_work_logs WHERE owner=? AND task_id=? AND day=?',owner,taskId,input.day).first<{minutes:number}>();
  const oldMinutes=previous?.minutes??0,delta=minutes-oldMinutes;
  const planning=await query(this.db,'SELECT remaining_minutes,version FROM task_planning WHERE owner=? AND task_id=?',owner,taskId).first<{remaining_minutes:number|null;version:number}>();
  return new HealthyStore(this.db).mutate(owner,id,'task-work-log',{taskId,day:input.day,minutes,note},now,state=>({state,result:{saved:true,day:input.day,minutes,remaining:!planning||planning.remaining_minutes===null?null:Math.max(0,planning.remaining_minutes-delta)},statements:[
   query(this.db,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND status='active' AND deleted_at IS NULL) AND COALESCE((SELECT version FROM task_planning WHERE owner=? AND task_id=?),0)=? AND COALESCE((SELECT minutes FROM task_work_logs WHERE owner=? AND task_id=? AND day=?),0)=? THEN 1 ELSE 0 END",owner,taskId,owner,taskId,planning?.version??0,owner,taskId,input.day,oldMinutes),
   query(this.db,'INSERT INTO task_work_logs(owner,task_id,day,minutes,note,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,task_id,day) DO UPDATE SET minutes=excluded.minutes,note=excluded.note,updated=excluded.updated',owner,taskId,input.day,minutes,note,now),
   ...(planning&&planning.remaining_minutes!==null?[query(this.db,'UPDATE task_planning SET remaining_minutes=?,updated=?,version=version+1 WHERE owner=? AND task_id=?',Math.max(0,planning.remaining_minutes-delta),now,owner,taskId)]:[])
  ]}));
 }
 async reorder(owner:string,id:string,version:number,ids:string[],now:number){
  const input=await this.inputs(owner,now),saved=await this.ensure(owner,now);
  if(!input||!saved||saved.version!==version)throw Error('PLAN_CHANGED');
  const selected=saved.plan.items.map(i=>i.taskId);
  if(ids.length!==selected.length||new Set(ids).size!==ids.length||ids.some(i=>!selected.includes(i)))throw Error('INVALID_PLAN_ORDER');
  const plan=chooseDailyPlan(input.candidates,input.days,now,ids);
  return new HealthyStore(this.db).mutate(owner,id,'plan-order',{version,ids},now,state=>({state,result:{saved:true},statements:[
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM daily_plans WHERE owner=? AND version=?) THEN 1 ELSE 0 END',owner,version),
   query(this.db,'UPDATE daily_plans SET version=version+1,plan_json=?,updated=? WHERE owner=?',JSON.stringify(plan),now,owner),
   query(this.db,"UPDATE schedule_days SET task_plan_generation=task_plan_generation+1,task_plan_effective_from=?,task_plan_source='manual' WHERE owner=? AND day=?",ceilToMinutes(now),owner,input.day),
   query(this.db,"UPDATE outbox SET state='failed' WHERE id LIKE ? AND state='pending'",'daily:'+owner+':%')
  ]}));
 }
 async editEstimate(owner:string,id:string,taskId:string,version:number,remaining:number|null,priority:number,now:number){
  if(remaining!==null&&(!Number.isInteger(remaining)||remaining<1||remaining>100000)||!Number.isInteger(priority)||priority<0||priority>2)throw Error('INVALID_ESTIMATE');
  return new HealthyStore(this.db).mutate(owner,id,'task-estimate',{taskId,version,remaining,priority},now,state=>({state,result:{saved:true},statements:[
   query(this.db,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND status='active' AND deleted_at IS NULL) AND COALESCE((SELECT version FROM task_planning WHERE owner=? AND task_id=?),0)=? THEN 1 ELSE 0 END",owner,taskId,owner,taskId,version),
   query(this.db,'INSERT INTO task_planning(owner,task_id,remaining_minutes,priority,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner,task_id) DO UPDATE SET remaining_minutes=excluded.remaining_minutes,priority=excluded.priority,updated=excluded.updated,version=version+1',owner,taskId,remaining,priority,now)
  ]}));
 }
}
