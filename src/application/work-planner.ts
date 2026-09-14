import {availableRanges,type TimeRange} from '../domain/availability.ts';
export type Candidate={id:string;title:string;deadline:number|null;remaining:number|null;priority:number;updated:number;created:number};
export type DayCapacity={day:number;ranges:TimeRange[];assumed:boolean};
export type DayItem={taskId:string;minutes:number;remaining:number|null;provisional:boolean;reason:string;windows:TimeRange[]};
export type WorkPlan={day:number;items:DayItem[];later:{taskId:string;reason:string}[];risks:{taskId:string;reason:string}[];capacity:number;planned:number;assumed:boolean;futureAssumed:boolean;horizonEnd:number;forecast:{day:number;minutes:number;tasks:string[]}[]};
const MIN=60000;
// Work occupies at most 80% of each available interval. The rest is transition,
// rest and contingency, not extra work hidden outside the budget.
export function chooseDailyPlan(tasks:Candidate[],days:DayCapacity[],now:number,preferred:string[]=[]):WorkPlan{
 if(!days.length)throw Error('INVALID_PLAN_DAYS');
 if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw Error('DUPLICATE_TASK');
 for(const t of tasks)if(t.remaining!==null&&(!Number.isInteger(t.remaining)||t.remaining<1||t.remaining>100000)||!Number.isInteger(t.priority)||t.priority<0||t.priority>2)throw Error('INVALID_ESTIMATE');
 const usable=days.map(d=>availableRanges(d.ranges,[],now).filter(r=>r.end-r.start>=10*MIN).map(r=>({start:r.start,end:r.start+Math.floor((r.end-r.start)/MIN*.8)*MIN})));
 const capacity=usable[0]!.reduce((n,r)=>n+Math.floor((r.end-r.start)/MIN),0);
 const remaining=new Map(tasks.map(t=>[t.id,t.remaining??45]));
 const allocations:DayItem[][]=days.map(()=>[]);
 const risks:WorkPlan['risks']=[];
 const horizonEnd=Math.max(now,...days.flatMap(d=>d.ranges.map(r=>r.end)));
 // Shared deadline capacity: individual feasibility alone misses aggregate overload.
 let cumulative=0;
 for(const t of [...tasks].filter(t=>t.deadline!==null).sort((a,b)=>a.deadline!-b.deadline!)){
  if(t.deadline!<=now){risks.push({taskId:t.id,reason:'overdue'});continue;}
  cumulative+=t.remaining??45;
  const available=usable.flat().reduce((n,r)=>n+Math.max(0,Math.floor((Math.min(r.end,t.deadline!)-r.start)/MIN)),0);
  if(t.deadline!<=horizonEnd&&cumulative>available)risks.push({taskId:t.id,reason:t.remaining===null?'unknown_duration':'deadline_capacity'});
  else if(t.deadline!>horizonEnd)risks.push({taskId:t.id,reason:'outside_horizon'});
 }
 for(let d=0;d<days.length;d++){
  const ranges=usable[d]!.map(r=>({...r}));
  const dayStart=days[d]!.ranges[0]?.start??now;
  const slack=(t:Candidate)=>t.deadline===null?Infinity:(t.deadline-dayStart)/MIN-(remaining.get(t.id)??0);
  const queue=tasks.filter(t=>remaining.get(t.id)!>0).sort((a,b)=>{
   // Explicit reordering applies to today; deadline-risk tasks still cannot be
   // scheduled after their deadline (risk is exposed rather than hidden).
   if(d===0&&preferred.length){const ai=preferred.indexOf(a.id),bi=preferred.indexOf(b.id);if(ai!==bi)return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);}
   return slack(a)-slack(b)||b.priority-a.priority||a.created-b.created||a.id.localeCompare(b.id);
  });
  for(const t of queue){
   const left=remaining.get(t.id)!;
   const futureDays=Math.max(1,days.slice(d).filter((day,index)=>usable[d+index]!.some(r=>t.deadline===null||r.start<t.deadline)).length);
   // Spread long tasks over usable days instead of filling today with one task.
   // Urgent work gets what can fit today; undated work advances in meaningful doses.
   const urgent=t.deadline!==null&&t.deadline<dayStart+86400000;
   const allowance=urgent?left:Math.min(left,t.deadline===null?90:Math.max(30,Math.ceil(left/futureDays/5)*5));
   let wanted=allowance;const windows:TimeRange[]=[];
   for(const r of ranges){
    if(wanted<=0)break;
    const end=t.deadline!==null&&t.deadline>now?Math.min(r.end,t.deadline):r.end;
    const room=Math.floor((end-r.start)/MIN);
    const minutes=Math.min(room,wanted);
    if(minutes<Math.min(15,left))continue;
    windows.push({start:r.start,end:r.start+minutes*MIN});r.start+=(minutes+10)*MIN;wanted-=minutes;
   }
   const allocated=allowance-wanted;
   if(!allocated)continue;
   remaining.set(t.id,left-allocated);
   allocations[d]!.push({taskId:t.id,minutes:allocated,remaining:t.remaining,provisional:t.remaining===null,reason:urgent?'deadline_near':t.priority>0?'priority':t.deadline!==null?'deadline_spread':'steady_progress',windows});
  }
 }
 const today=allocations[0]!;
 return {day:days[0]!.day,items:today,later:tasks.filter(t=>!today.some(i=>i.taskId===t.id)).map(t=>({taskId:t.id,reason:'not_selected_today'})),risks,
  capacity,planned:today.reduce((n,t)=>n+t.minutes,0),assumed:days[0]!.assumed,futureAssumed:days.slice(1).some(d=>d.assumed),horizonEnd,
  forecast:days.map((day,index)=>({day:day.day,minutes:allocations[index]!.reduce((n,t)=>n+t.minutes,0),tasks:allocations[index]!.map(t=>t.taskId)}))};
}
