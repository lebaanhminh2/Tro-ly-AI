import {query,type Database} from './database.ts';
import {chooseDailyPlan,type Candidate,type DayCapacity,type WorkPlan} from '../../application/work-planner.ts';
import {dayWindow,operatingDay} from '../../domain/healthy.ts';
import {availableRanges,type TimeRange} from '../../domain/availability.ts';
import {HealthyStore} from './healthy-store.ts';
export class DayPlanStore{
 private db:Database;
 constructor(db:Database){this.db=db;}
 async inputs(owner:string,now:number){
  const settings=await query(this.db,'SELECT * FROM schedule_settings WHERE owner=?',owner).first<{version:number;start_minutes:number;sleep_minutes:number|null;daily_budget_minutes:number}>();
  if(!settings||settings.sleep_minutes===null)return null;
  const day=operatingDay(now,settings.start_minutes),window=dayWindow(day,settings.start_minutes,settings.sleep_minutes);
  const tasks=(await query(this.db,"SELECT t.id,t.title,t.deadline,t.version,t.created,p.remaining_minutes AS remaining,COALESCE(p.priority,0) AS priority,COALESCE(p.updated,0) AS updated,COALESCE(p.version,0) AS estimate_version FROM tasks t LEFT JOIN task_planning p ON p.task_id=t.id AND p.owner=t.owner WHERE t.owner=? AND t.status='active' AND t.deleted_at IS NULL ORDER BY t.id",owner).all<{id:string;title:string;deadline:string|null;version:number;created:number;remaining:number|null;priority:number;updated:number;estimate_version:number}>()).results;
  const saved=await query(this.db,'SELECT version,intervals_json,start_at FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1',owner,now,now).first<{version:number;intervals_json:string;start_at:number}>();
  const intervals=JSON.parse(saved?.intervals_json??'{}');
  const events=(await query(this.db,"SELECT id,version,start_at,end_at FROM local_events WHERE owner=? AND status='scheduled' AND start_at<? AND COALESCE(end_at,start_at+3600000)>? ORDER BY id",owner,window.start+14*86400000,window.start).all<{id:string;version:number;start_at:number;end_at:number|null}>()).results;
  const days:DayCapacity[]=[];
  for(let n=0;n<14;n++){
   const w=dayWindow(day+n,settings.start_minutes,settings.sleep_minutes);
   const useSaved=n===0&&saved&&saved.start_at>=window.start;
   const base:TimeRange[]=useSaved&&intervals.free?.length?intervals.free:[{start:w.start,end:w.target}];
   const busy:TimeRange[]=[...(useSaved?intervals.busy??[]:[]),...events.map(e=>({start:e.start_at,end:e.end_at??e.start_at+3600000}))];
   let ranges=availableRanges(base.map(r=>({start:Math.max(w.start,r.start),end:Math.min(w.target,r.end)})).filter(r=>r.end>r.start),busy,Math.max(now,w.start));
   // The visible daily budget caps the assumed capacity. It can be adjusted,
   // and it never overrides actual busy intervals or the 20% contingency.
   let budget=settings.daily_budget_minutes/0.8*60000;
   ranges=ranges.flatMap(r=>{const length=Math.min(budget,r.end-r.start);budget-=length;return length>0?[{start:r.start,end:r.start+length}]:[];});
   days.push({day:day+n,ranges,assumed:!useSaved||!(intervals.free?.length||intervals.busy?.length)});
  }
  const candidates:Candidate[]=tasks.map(t=>({...t,deadline:t.deadline?Date.parse(t.deadline.length===10?t.deadline+'T23:59:59+07:00':t.deadline):null}));
  const signature=JSON.stringify([day,settings.version,settings.daily_budget_minutes,saved?.version,events.map(e=>[e.id,e.version]),tasks.map(t=>[t.id,t.version,t.estimate_version])]);
  return {day,window,settings,candidates,days,signature};
 }
 async ensure(owner:string,now:number){
  const input=await this.inputs(owner,now);if(!input)return null;
  const existing=await query(this.db,'SELECT * FROM daily_plans WHERE owner=?',owner).first<{day:number;version:number;signature:string;plan_json:string;updated:number}>();
  if(existing?.signature===input.signature)return {version:existing.version,plan:JSON.parse(existing.plan_json) as WorkPlan,updated:existing.updated};
  const plan=chooseDailyPlan(input.candidates,input.days,now);
  const oldVersion=existing?.version??0;
  await this.db.batch([
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM daily_plans WHERE owner=?),0)=? THEN 1 ELSE 0 END',owner,oldVersion),
   query(this.db,'INSERT INTO daily_plans(owner,day,signature,plan_json,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET day=excluded.day,version=version+1,signature=excluded.signature,plan_json=excluded.plan_json,updated=excluded.updated',owner,input.day,input.signature,JSON.stringify(plan),now),
   query(this.db,"UPDATE outbox SET state='failed' WHERE id LIKE ? AND state='pending'",'daily:'+owner+':%'),
   query(this.db,"UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN (SELECT id FROM sessions WHERE owner=? AND id LIKE ? AND status IN ('planned','draft'))",owner,owner,'daily_'+owner+'_'+input.day+'_%'),
   query(this.db,"UPDATE sessions SET status='skipped',version=version+1 WHERE owner=? AND id LIKE ? AND status IN ('planned','draft')",owner,'daily_'+owner+'_'+input.day+'_%'),
   ...plan.items.flatMap((item,index)=>item.windows.flatMap((window,part)=>{
    const sessionId=`daily_${owner}_${input.day}_${index}_${part}`;
    return [
     query(this.db,"INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES(?,?,?,?,?,'planned',?)",sessionId,owner,item.taskId,window.start,Math.round((window.end-window.start)/60000),input.window.end),
     query(this.db,"INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,?,?,?,?,?),(?,?,?,?,?,?)",`${sessionId}:1:1`,owner,sessionId,1,1,window.start,`${sessionId}:1:2`,owner,sessionId,1,2,window.start+900000)
    ];
   })),
   query(this.db,'DELETE FROM transaction_guard')
  ]);
  return {version:oldVersion+1,plan,updated:now};
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
