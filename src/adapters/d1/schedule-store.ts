import {availableRanges,type TimeRange} from '../../domain/availability.ts';
import {planDay,type PlanningTask} from '../../application/daily-planner.ts';
import {query,type Database} from './database.ts';
import {dayWindow,operatingDay,minutes,DAY_MS,resumeHealthy} from '../../domain/healthy.ts';
import {HealthyStore} from './healthy-store.ts';
export type ScheduleSettings={start_minutes:number;sleep_minutes:number|null;version:number};
type DayRow={version:number;day:number;start_at:number;target_sleep:number;end_at:number;asleep_at:number|null;last_chat_at:number|null};
export class ScheduleStore{
 private db:Database;
 constructor(db:Database){this.db=db;}
 settings(owner:string){return query(this.db,'SELECT start_minutes,sleep_minutes,version FROM schedule_settings WHERE owner=?',owner).first<ScheduleSettings>();}
 async configure(owner:string,start:string,sleep:string,version:number,now:number){
  const a=minutes(start),b=minutes(sleep);
  if(a===b||!Number.isInteger(version)||version<0)throw Error('INVALID_SETTINGS');
  await this.db.batch([
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM schedule_settings WHERE owner=?),0)=? THEN 1 ELSE 0 END',owner,version),
   query(this.db,'INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET start_minutes=excluded.start_minutes,sleep_minutes=excluded.sleep_minutes,version=version+1,updated=excluded.updated',owner,a,b,now),
   query(this.db,'DELETE FROM transaction_guard')
  ]);
  // Today's existing snapshot is immutable: changing bedtime cannot erase a penalty.
  return this.ensureDay(owner,now);
 }
 async ensureDay(owner:string,now:number):Promise<DayRow|null>{
  const settings=await this.settings(owner);
  if(!settings||settings.sleep_minutes===null)return null;
  const existing=await query(this.db,'SELECT * FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1',owner,now,now).first<DayRow>();
  if(existing)return existing;
  const day=operatingDay(now,settings.start_minutes),window=dayWindow(day,settings.start_minutes,settings.sleep_minutes);
  await query(this.db,'INSERT OR IGNORE INTO schedule_days(owner,day,start_at,target_sleep,end_at) VALUES(?,?,?,?,?)',owner,day,window.start,window.target,window.end).run();
  return query(this.db,'SELECT * FROM schedule_days WHERE owner=? AND day=?',owner,day).first<DayRow>();
 }
 async chatActivity(owner:string,now:number,requestId:string){
  await this.settleClosedDays(owner,now);
  const day=await this.ensureDay(owner,now);if(!day)return null;
  const healthy=new HealthyStore(this.db);
  const current=await healthy.read(owner);
  if(current.state.suspended)await healthy.mutate(owner,'resume:'+requestId,'resume',{day:day.day},now,state=>({state:resumeHealthy(state,day.day),result:{resumed:true}}));
  await query(this.db,'UPDATE schedule_days SET last_chat_at=? WHERE owner=? AND day=?',now,owner,day.day).run();
  return day;
 }
 async reportSleep(owner:string,now:number){
  const day=await this.ensureDay(owner,now);if(!day){
   const settings=await this.settings(owner),start=settings?.start_minutes??270;
   const end=(operatingDay(now,start)+1)*DAY_MS-7*3600000+start*60000;
   await query(this.db,"INSERT INTO reminder_preferences(owner,quiet_start,quiet_end,pause_until) VALUES(?,0,0,?) ON CONFLICT(owner) DO UPDATE SET pause_until=excluded.pause_until",owner,end).run();
   return {applied:true,delta:0,demoted:false};
  }
  await query(this.db,'UPDATE schedule_days SET asleep_at=COALESCE(asleep_at,?),last_chat_at=? WHERE owner=? AND day=?',now,now,owner,day.day).run();
  const saved=await query(this.db,'SELECT * FROM schedule_days WHERE owner=? AND day=?',owner,day.day).first<DayRow>();
  return new HealthyStore(this.db).score(owner,{day:day.day,target:day.target_sleep,end:day.end_at,reportedAt:saved!.asleep_at,chatActive:true,assessedAt:now});
 }
 async replan(owner:string,now:number,expectedVersion:number,free:TimeRange[],busy:TimeRange[],tasks:PlanningTask[],requestId:string){
  const day=await this.ensureDay(owner,now);if(!day)throw Error('SETUP_REQUIRED');
  const ranges=availableRanges(free.length?free:[{start:day.start_at,end:day.target_sleep}],busy,now);
  if(ranges.some(r=>r.start<day.start_at||r.end>day.target_sleep))throw Error('OUTSIDE_ACTIVE_DAY');
  const fixed=(await query(this.db,"SELECT start_at,end_at FROM local_events WHERE owner=? AND status='scheduled' AND start_at<? AND COALESCE(end_at,start_at+3600000)>?",owner,day.target_sleep,now).all<{start_at:number;end_at:number|null}>()).results.map(e=>({start:e.start_at,end:e.end_at??e.start_at+3600000}));
  const plan=planDay(tasks,ranges,fixed,now);
  return new HealthyStore(this.db).mutate(owner,requestId,'replan',{day:day.day,expectedVersion,free,busy,tasks},now,state=>{
   const statements=[
    query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND version=?) THEN 1 ELSE 0 END',owner,day.day,expectedVersion),
    query(this.db,'UPDATE schedule_days SET intervals_json=?,version=version+1 WHERE owner=? AND day=?',JSON.stringify({free,busy,unplanned:plan.unplanned}),owner,day.day),
    query(this.db,"UPDATE reminders SET status='cancelled' WHERE owner=? AND status IN('pending','queued') AND session_id IN(SELECT id FROM sessions WHERE owner=? AND status='planned' AND start_at>=? AND start_at<?)",owner,owner,now,day.end_at),
    query(this.db,"UPDATE sessions SET status='skipped',version=version+1 WHERE owner=? AND status='planned' AND start_at>=? AND start_at<?",owner,now,day.end_at)
   ];
   for(const [index,block] of plan.blocks.entries()){
    const task=tasks.find(t=>t.id===block.taskId)!;
    const id='plan_'+requestId+'_'+index;
    statements.push(
     query(this.db,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND status='active' AND deleted_at IS NULL AND (deadline IS NULL OR (julianday(CASE WHEN deadline_precision='date' THEN deadline||'T23:59:59+07:00' ELSE deadline END)-2440587.5)*86400000>=?)) THEN 1 ELSE 0 END",owner,task.id,block.end),
     query(this.db,"INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES(?,?,?,?,?,'planned',?)",id,owner,block.taskId,block.start,(block.end-block.start)/60000,day.end_at),
     query(this.db,"INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,?,?,1,1,?),(?,?,?,1,2,?)",id+':1:1',owner,id,block.start,id+':1:2',owner,id,block.start+900000)
    );
   }
   statements.push(query(this.db,'INSERT OR IGNORE INTO reminder_preferences(owner,quiet_start,quiet_end) VALUES(?,0,0)',owner));
   return {state,result:plan,statements};
  });
 }
 async isResting(owner:string,now:number){
  if((await new HealthyStore(this.db).read(owner)).state.suspended)return true;
  const pause=await query(this.db,'SELECT pause_until FROM reminder_preferences WHERE owner=?',owner).first<{pause_until:number}>();
  if((pause?.pause_until??0)>now)return true;
  return !!await query(this.db,'SELECT day FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? AND asleep_at IS NOT NULL',owner,now,now).first();
 }
 async queueCheckIns(owner:string,now:number){
  if((await new HealthyStore(this.db).read(owner)).state.suspended)return;
  const day=await this.ensureDay(owner,now);if(!day||day.asleep_at!==null)return;
  const messages:{id:string;text:string;due:number}[]=[];
  if(now>=day.start_at&&now<day.start_at+3600000)messages.push({
   id:'healthy:morning:'+owner+':'+day.day,due:day.start_at,
   text:'Chào buổi sáng cậu :> hôm nay cậu bận những khoảng nào? Trả lời bằng /lich kèm lịch của cậu nhé.'
  });
  for(let n=0;n<3;n++){
   const due=day.target_sleep+n*20*60000;
   if(now>=due&&now<due+20*60000&&now<day.end_at)messages.push({
    id:'healthy:bedtime:'+owner+':'+day.day+':'+n,due,
    text:[
     'Cậu ơi, đến giờ nghỉ rồi. Thu bài lại, chuẩn bị đi ngủ với tớ nhé 🤍 Gửi /ngu khi cậu bắt đầu nghỉ.',
     'Cho tớ xin cậu thêm một chút kỷ luật nào :> đặt máy xuống nhé, phần còn lại mai mình tính tiếp.',
     'Tớ nhắc lần cuối tối nay thôi: nghỉ ngơi nhé cậu. Khi sẵn sàng ngủ, nhắn /ngu cho tớ biết 🤍'
    ][n]!
   });
  }
  if(messages.length)await this.db.batch(messages.map(m=>query(this.db,'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',m.id,JSON.stringify({method:'sendMessage',chat_id:Number(owner),text:m.text}),now)));
 }
 async settleClosedDays(owner:string,now:number){
  const healthy=new HealthyStore(this.db);
  // At most three absent days are settled. No unbounded catch-up or retroactive
  // penalties before setup. A recorded active day can reset the absence count.
  let row=await query(this.db,'SELECT * FROM schedule_days WHERE owner=? ORDER BY start_at DESC LIMIT 1',owner).first<DayRow>();
  const settings=await this.settings(owner);
  if(!row||!settings||settings.sleep_minutes===null)return;
  for(let n=0;n<4;n++){
   const account=await healthy.read(owner);if(account.state.suspended)return;
   const pending=await query(this.db,'SELECT d.* FROM schedule_days d WHERE d.owner=? AND d.end_at<=? AND d.day>? AND NOT EXISTS(SELECT 1 FROM sleep_assessments a WHERE a.owner=d.owner AND a.day=d.day) ORDER BY d.start_at LIMIT 1',owner,now,account.state.lastScoredDay??-1).first<DayRow>();
   if(pending){
    await healthy.score(owner,{day:pending.day,target:pending.target_sleep,end:pending.end_at,reportedAt:pending.asleep_at,chatActive:pending.last_chat_at!==null,assessedAt:now});
    if((await healthy.read(owner)).state.suspended)return;
   }
   row=(await query(this.db,'SELECT * FROM schedule_days WHERE owner=? ORDER BY start_at DESC LIMIT 1',owner).first<DayRow>())!;
   if(row.end_at>now)return;
   const nextDay=row.day+1,window={start:row.end_at,target:row.target_sleep+DAY_MS,end:row.end_at+DAY_MS};
   await query(this.db,'INSERT OR IGNORE INTO schedule_days(owner,day,start_at,target_sleep,end_at) VALUES(?,?,?,?,?)',owner,nextDay,window.start,window.target,window.end).run();
  }
 }
}
