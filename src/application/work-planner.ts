import {availableRanges,type TimeRange} from '../domain/availability.ts';
export type Candidate={id:string;title:string;deadline:number|null;remaining:number|null;priority:number;updated:number;created:number};
export type DayCapacity={day:number;ranges:TimeRange[];assumed:boolean};
export type DayItem={taskId:string;minutes:number;remaining:number|null;provisional:boolean;reason:string;windows:TimeRange[];scheduledMinutes?:number;manual?:boolean;actualMinutes?:number};
export type ManualDayItem={taskId:string;minutes:number};
export type WorkPlan={day:number;items:DayItem[];later:{taskId:string;reason:string}[];risks:{taskId:string;reason:string}[];capacity:number;planned:number;assumed:boolean;futureAssumed:boolean;horizonEnd:number;forecast:{day:number;minutes:number;tasks:string[]}[];manualItems?:ManualDayItem[];overflow?:number;unscheduled?:number};
const MIN=60000;
const DAILY_FOCUS_LIMIT=3;
const FOCUS_BLOCK_MINUTES=120;
export function usableWorkRanges(ranges:TimeRange[],now:number):TimeRange[]{
 return availableRanges(ranges,[],ranges[0]?.start??now).filter(range=>range.end-range.start>=10*MIN)
  .map(range=>({start:range.start,end:range.start+Math.floor((range.end-range.start)/MIN*.8)*MIN}));
}
export function workCapacity(ranges:TimeRange[],now:number):number{
 return usableWorkRanges(ranges,now).reduce((sum,range)=>sum+Math.floor((range.end-range.start)/MIN),0);
}
// Work occupies at most 80% of each available interval. The rest is transition,
// rest and contingency, not extra work hidden outside the budget.
export function chooseDailyPlan(tasks:Candidate[],days:DayCapacity[],now:number,preferred:string[]=[]):WorkPlan{
 if(!days.length)throw Error('INVALID_PLAN_DAYS');
 if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw Error('DUPLICATE_TASK');
 for(const t of tasks)if(t.remaining!==null&&(!Number.isInteger(t.remaining)||t.remaining<0||t.remaining>100000)||!Number.isInteger(t.priority)||t.priority<0||t.priority>2)throw Error('INVALID_ESTIMATE');
 const fullUsable=days.map(d=>usableWorkRanges(d.ranges,now));
 const usable=days.map((d,index)=>availableRanges(fullUsable[index]!,[],now));
 const capacity=fullUsable[0]!.reduce((n,r)=>n+Math.floor((r.end-r.start)/MIN),0);
 const known=tasks.filter(t=>t.remaining!==null);
 const remaining=new Map(known.map(t=>[t.id,t.remaining!]));
 const allocations:DayItem[][]=days.map(()=>[]);
 const risks:WorkPlan['risks']=[];
 const horizonEnd=Math.max(now,...days.flatMap(d=>d.ranges.map(r=>r.end)));
 // Shared deadline capacity: individual feasibility alone misses aggregate overload.
 let cumulative=0;
 for(const t of [...tasks].filter(t=>t.deadline!==null).sort((a,b)=>a.deadline!-b.deadline!)){
  if(t.deadline!<=now){risks.push({taskId:t.id,reason:'overdue'});continue;}
  if(t.remaining===null){risks.push({taskId:t.id,reason:'unknown_duration'});continue;}
  cumulative+=t.remaining;
  const available=usable.flat().reduce((n,r)=>n+Math.max(0,Math.floor((Math.min(r.end,t.deadline!)-r.start)/MIN)),0);
  if(t.deadline!<=horizonEnd&&cumulative>available)risks.push({taskId:t.id,reason:'deadline_capacity'});
  else if(t.deadline!>horizonEnd)risks.push({taskId:t.id,reason:'outside_horizon'});
 }
 for(let d=0;d<days.length;d++){
  const ranges=usable[d]!.map(r=>({...r}));
  const dayStart=days[d]!.ranges[0]?.start??now;
  const slack=(t:Candidate)=>t.deadline===null?Infinity:(t.deadline-dayStart)/MIN-(remaining.get(t.id)??0);
  // Unknown estimates stay out of automatic scheduling. They remain visible
  // in “Để sau” until the user supplies a realistic remaining duration.
  const queue=known.filter(t=>(remaining.get(t.id)??0)>0).sort((a,b)=>{
   // Explicit reordering applies to today; deadline-risk tasks still cannot be
   // scheduled after their deadline (risk is exposed rather than hidden).
   if(d===0&&preferred.length){const ai=preferred.indexOf(a.id),bi=preferred.indexOf(b.id);if(ai!==bi)return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);}
   return slack(a)-slack(b)||b.priority-a.priority||a.created-b.created||a.id.localeCompare(b.id);
  });
  let selected=0;
  for(const t of queue){
   if(selected>=DAILY_FOCUS_LIMIT)break;
   const left=remaining.get(t.id)!;
   const futureDays=Math.max(1,days.slice(d).filter((day,index)=>usable[d+index]!.some(r=>t.deadline===null||r.start<t.deadline)).length);
   // Finish urgent work first. Other tasks receive one meaningful focus block;
   // spare capacity remains a buffer instead of fragmenting every backlog item.
   const urgent=t.deadline!==null&&t.deadline<dayStart+86400000;
   const dailyNeed=t.deadline===null?FOCUS_BLOCK_MINUTES:Math.ceil(left/futureDays/5)*5;
   const allowance=urgent?left:Math.min(left,Math.max(45,Math.min(FOCUS_BLOCK_MINUTES,dailyNeed)));
   let wanted=allowance;const windows:TimeRange[]=[];
   for(const r of ranges){
    const end=t.deadline!==null&&t.deadline>now?Math.min(r.end,t.deadline):r.end;
    while(wanted>0){
     const room=Math.floor((end-r.start)/MIN),minutes=Math.min(room,wanted,FOCUS_BLOCK_MINUTES);
     if(minutes<Math.min(15,left))break;
     windows.push({start:r.start,end:r.start+minutes*MIN});r.start+=(minutes+10)*MIN;wanted-=minutes;
    }
    if(wanted<=0)break;
   }
   const allocated=allowance-wanted;
   if(!allocated)continue;
   selected++;
   remaining.set(t.id,left-allocated);
   allocations[d]!.push({taskId:t.id,minutes:allocated,remaining:t.remaining,provisional:t.remaining===null,reason:urgent?'deadline_near':t.priority>0?'priority':t.deadline!==null?'deadline_spread':'steady_progress',windows});
  }
 }
 const today=allocations[0]!;
 return {day:days[0]!.day,items:today,later:tasks.filter(t=>(t.remaining===null||t.remaining>0)&&!today.some(i=>i.taskId===t.id)).map(t=>({taskId:t.id,reason:t.remaining===null?'needs_estimate':'not_selected_today'})),risks,
  capacity,planned:today.reduce((n,t)=>n+t.minutes,0),assumed:days[0]!.assumed,futureAssumed:days.slice(1).some(d=>d.assumed),horizonEnd,
  forecast:days.map((day,index)=>({day:day.day,minutes:allocations[index]!.reduce((n,t)=>n+t.minutes,0),tasks:allocations[index]!.map(t=>t.taskId)}))};
}

// Once the user edits Today, that exact selection becomes authoritative for
// this operating day. It may consume the normal 20% contingency, but busy and
// sleep time remain hard boundaries. Minutes without a real slot stay visible
// as unscheduled and never receive a fake timed nudge.
export function chooseManualPlan(tasks:Candidate[],days:DayCapacity[],now:number,manualItems:ManualDayItem[]):WorkPlan{
 if(!days.length||manualItems.length>50||new Set(manualItems.map(i=>i.taskId)).size!==manualItems.length||manualItems.some(i=>!Number.isInteger(i.minutes)||i.minutes<5||i.minutes>960))throw Error('INVALID_MANUAL_PLAN');
 const byId=new Map(tasks.map(t=>[t.id,t])),base=chooseDailyPlan(tasks,days,now);
 if(manualItems.some(i=>!byId.has(i.taskId)))throw Error('TASK_NOT_AVAILABLE');
 const ranges=availableRanges(days[0]!.ranges,[],now).filter(r=>r.end-r.start>=5*MIN).map(r=>({...r}));
 const items:DayItem[]=[];
 for(const selected of manualItems){
  const task=byId.get(selected.taskId)!,windows:TimeRange[]=[];let wanted=selected.minutes;
 for(const range of ranges){
   while(wanted>0){
    const room=Math.floor((range.end-range.start)/MIN);if(room<5)break;
    const minutes=Math.min(room,wanted,FOCUS_BLOCK_MINUTES);windows.push({start:range.start,end:range.start+minutes*MIN});
    range.start+=(minutes+10)*MIN;wanted-=minutes;
   }
   if(wanted<=0)break;
  }
  items.push({taskId:task.id,minutes:selected.minutes,remaining:task.remaining,provisional:task.remaining===null,reason:'manual_today',windows,scheduledMinutes:selected.minutes-wanted,manual:true});
 }
 const planned=items.reduce((sum,item)=>sum+item.minutes,0),scheduled=items.reduce((sum,item)=>sum+(item.scheduledMinutes??item.minutes),0);
 return {...base,items,later:tasks.filter(t=>!items.some(i=>i.taskId===t.id)).map(t=>({taskId:t.id,reason:'not_selected_today'})),planned,
  manualItems:manualItems.map(i=>({...i})),overflow:Math.max(0,planned-base.capacity),unscheduled:planned-scheduled,
  forecast:base.forecast.map((day,index)=>index?day:{...day,minutes:planned,tasks:items.map(i=>i.taskId)})};
}
