import {query,type Database} from './database.ts';
import {ScheduleStore,type DayRow} from './schedule-store.ts';
import {DayPlanStore} from './day-plan-store.ts';
import {ceilToMinutes} from '../../domain/time.ts';
import {queuePlanConfirmation} from './work-nudges.ts';

/** Owns only the daily task-planning lifecycle; sleep and generic reminders stay elsewhere. */
export class TaskDayStore{
 private db:Database;
 constructor(db:Database){this.db=db;}

 async current(owner:string,now:number):Promise<DayRow|null>{
  return new ScheduleStore(this.db).ensureDay(owner,now);
 }

 async queuePrompt(owner:string,now:number){
  const day=await this.current(owner,now);
  if(!day||day.task_plan_status!=='waiting'||day.task_plan_due===null||now>=day.task_plan_due)return;
  await query(this.db,'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',
   `task-plan:morning:${owner}:${day.day}`,
   JSON.stringify({method:'sendMessage',chat_id:Number(owner),text:'Chào buổi sáng cậu :> vào phần “Thời gian hôm nay” trong ứng dụng giúp tớ nhé. Lưu xong tớ sẽ chia việc cho cậu luôn.'}),
   now).run();
 }

 async activateAutomatic(owner:string,now:number){
  const day=await this.current(owner,now);
  if(!day||day.task_plan_status!=='waiting'||day.task_plan_due===null||now<day.task_plan_due||now>=day.target_sleep)return null;
  const effective=ceilToMinutes(now);
  const changed=await query(this.db,`UPDATE schedule_days SET task_plan_status='active',task_plan_source='automatic',
    task_plan_effective_from=?,version=version+1,
    intervals_json=json_set(CASE WHEN json_valid(intervals_json) THEN intervals_json ELSE '{}' END,'$.free',json('[]'),'$.busy',json('[]'))
    WHERE owner=? AND day=? AND task_plan_status='waiting' AND task_plan_due<=?`,effective,owner,day.day,now).run();
  if(!changed.meta.changes)return null;
  const plan=await new DayPlanStore(this.db).ensure(owner,now);
  if(plan)await queuePlanConfirmation(this.db,owner,`auto-${day.day}`,plan.plan,now);
  return plan;
 }

 async notificationAllowed(owner:string,id:string,now:number){
  if(!id.startsWith('task-plan:morning:'))return true;
  const day=await this.current(owner,now);
  if(!day||id!==`task-plan:morning:${owner}:${day.day}`||day.task_plan_status!=='waiting'||day.task_plan_due===null)return false;
  return now>=day.start_at&&now<day.task_plan_due&&!await new ScheduleStore(this.db).notificationsPaused(owner,now);
 }
}
