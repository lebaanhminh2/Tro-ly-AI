import {availableRanges,type TimeRange} from '../domain/availability.ts';
export type PlanningTask={id:string;status:'active'|'completed';deleted:boolean;deadline:number|null;remainingMinutes:number|null};
export type PlannedBlock={taskId:string;start:number;end:number};
// The model estimates/chooses work; deterministic packing verifies what fits.
// It never edits task deadlines or assumes that finishing a block completes a task.
export function planDay(tasks:PlanningTask[],availability:TimeRange[],fixed:TimeRange[],now:number,breakMinutes=10,blockMinutes=25){
 if(!Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes>60||!Number.isInteger(blockMinutes)||blockMinutes<5||blockMinutes>180)throw Error('INVALID_PLANNING_OPTIONS');
 const ranges=availableRanges(availability,fixed,now);
 const queue=tasks.filter(t=>!t.deleted&&t.status==='active').map(t=>{
  // Zero means the estimate is exhausted; the task still needs the user's
  // explicit completion tick, but must not make a replan fail.
  if(t.remainingMinutes!==null&&(!Number.isInteger(t.remainingMinutes)||t.remainingMinutes<0||t.remainingMinutes>100000))throw Error('INVALID_ESTIMATE');
  return {...t};
 }).sort((a,b)=>(a.deadline??Infinity)-(b.deadline??Infinity)||a.id.localeCompare(b.id));
 if(new Set(queue.map(t=>t.id)).size!==queue.length)throw Error('DUPLICATE_TASK');
 const blocks:PlannedBlock[]=[],unplanned:{taskId:string;minutes:number|null;reason:string}[]=[];
 for(const task of queue){
  if(task.remainingMinutes===null){unplanned.push({taskId:task.id,minutes:null,reason:'needs_estimate'});continue;}
  let remaining=task.remainingMinutes;
  for(const range of ranges){
   if(!remaining)break;
   const end=Math.min(range.end,task.deadline!==null&&task.deadline>now?task.deadline:Infinity);
   while(remaining>0&&range.start+Math.min(remaining,5)*60000<=end){
    const minutes=Math.min(remaining,blockMinutes,Math.floor((end-range.start)/60000));
    blocks.push({taskId:task.id,start:range.start,end:range.start+minutes*60000});
    remaining-=minutes;range.start+= (minutes+breakMinutes)*60000;
   }
  }
  if(remaining)unplanned.push({taskId:task.id,minutes:remaining,reason:task.deadline!==null&&task.deadline<=now?'deadline_passed':'not_enough_time'});
 }
 return {blocks,unplanned,plannedMinutes:blocks.reduce((n,b)=>n+(b.end-b.start)/60000,0)};
}
