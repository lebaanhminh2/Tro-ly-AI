import {availableRanges,type TimeRange} from '../../domain/availability.ts';
import {planDay,type PlanningTask} from '../../application/daily-planner.ts';
import {query,type Database} from './database.ts';
import {dayWindow,operatingDay,minutes,DAY_MS,resumeHealthy} from '../../domain/healthy.ts';
import {HealthyStore} from './healthy-store.ts';
export type ScheduleSettings={start_minutes:number;sleep_minutes:number|null;version:number;updated:number};
type DayRow={version:number;day:number;start_at:number;target_sleep:number;end_at:number;asleep_at:number|null;last_chat_at:number|null};
export class ScheduleStore{
 private db:Database;
 constructor(db:Database){this.db=db;}
 settings(owner:string){return query(this.db,'SELECT start_minutes,sleep_minutes,version,updated FROM schedule_settings WHERE owner=?',owner).first<ScheduleSettings>();}
 async openDialog(owner:string,now:number){
  const day=await this.ensureDay(owner,now);if(!day){const settings=await this.settings(owner);throw Error(settings?.sleep_minutes!==null&&settings?'NO_ACTIVE_DAY':'SETUP_REQUIRED');}
  await query(this.db,'INSERT INTO schedule_dialogs(owner,day,expires) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET day=excluded.day,expires=excluded.expires',owner,day.day,Math.min(now+900000,day.end_at)).run();
 }
 async closeDialog(owner:string){await query(this.db,'DELETE FROM schedule_dialogs WHERE owner=?',owner).run();}
 async isMorningReply(owner:string,messageId:number|undefined,now:number){
  if(await query(this.db,'SELECT s.owner FROM schedule_dialogs s JOIN schedule_days d ON d.owner=s.owner AND d.day=s.day WHERE s.owner=? AND s.expires>? AND d.start_at<=? AND d.end_at>? AND d.asleep_at IS NULL',owner,now,now,now).first())return true;
  if(!Number.isSafeInteger(messageId)||Number(messageId)<=0)return false;
  return !!await query(this.db,"SELECT d.day FROM schedule_days d JOIN outbox o ON o.id='healthy:morning:'||d.owner||':'||d.day WHERE d.owner=? AND d.start_at<=? AND d.end_at>? AND d.asleep_at IS NULL AND o.state='sent' AND o.message_id=?",owner,now,now,messageId!).first();
 }
 async configure(owner:string,start:string,sleep:string,version:number,now:number,requestId?:string){
  const a=minutes(start),b=minutes(sleep);
  if(a===b||!Number.isInteger(version)||version<0)throw Error('INVALID_SETTINGS');
  const statements=[
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM schedule_settings WHERE owner=?),0)=? THEN 1 ELSE 0 END',owner,version),
   query(this.db,'INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET start_minutes=excluded.start_minutes,sleep_minutes=excluded.sleep_minutes,version=version+1,updated=excluded.updated',owner,a,b,now),
   query(this.db,'DELETE FROM transaction_guard')
  ];
  // Preserve finished/running work, but never leave future blocks outside the
  // newly selected working window. Their tasks remain unfinished for replanning.
  const future=(await query(this.db,"SELECT id,start_at,minutes FROM sessions WHERE owner=? AND status='planned' AND start_at>=?",owner,now).all<{id:string;start_at:number;minutes:number}>()).results;
  for(const session of future){
   const window=dayWindow(operatingDay(session.start_at,a),a,b);
   if(session.start_at>=window.target||session.start_at+session.minutes*60000>window.target){
    statements.push(query(this.db,"UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id=? AND status IN('pending','queued')",owner,session.id));
    statements.push(query(this.db,"UPDATE sessions SET status='skipped',version=version+1 WHERE owner=? AND id=? AND status='planned'",owner,session.id));
   }
  }
  if(requestId)await new HealthyStore(this.db).mutate(owner,requestId,'settings',{start,sleep,version},now,state=>({state,result:{saved:true},statements}));
  else await this.db.batch(statements);
  // Today's existing snapshot is immutable: changing bedtime cannot erase a penalty.
  return this.ensureDay(owner,now);
 }
 private followingDay(previous:DayRow,settings:ScheduleSettings){
  let day=previous.day+1;
  let window=dayWindow(day,settings.start_minutes,settings.sleep_minutes!);
  // Never shorten an existing rest period or overlap two operating days.
  if(window.start<previous.end_at){day++;window=dayWindow(day,settings.start_minutes,settings.sleep_minutes!);}
  return {day,window};
 }
 async ensureDay(owner:string,now:number):Promise<DayRow|null>{
  const settings=await this.settings(owner);
  if(!settings||settings.sleep_minutes===null)return null;
  const existing=await query(this.db,'SELECT * FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1',owner,now,now).first<DayRow>();
  if(existing)return existing;
  const previous=await query(this.db,'SELECT * FROM schedule_days WHERE owner=? ORDER BY start_at DESC LIMIT 1',owner).first<DayRow>();
  const day=operatingDay(now,settings.start_minutes),window=dayWindow(day,settings.start_minutes,settings.sleep_minutes);
  if(previous&&window.start<previous.end_at)return null;
  if(!previous&&settings.updated>window.target)return null; // No retroactive first-day penalty.
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
  await query(this.db,'INSERT INTO sleep_reports(owner,reported_at) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET reported_at=excluded.reported_at',owner,now).run();
  const day=await this.ensureDay(owner,now);if(!day){
   return {applied:true,delta:0,demoted:false};
  }
  await query(this.db,'UPDATE schedule_days SET asleep_at=COALESCE(asleep_at,?),last_chat_at=? WHERE owner=? AND day=?',now,now,owner,day.day).run();
  const saved=await query(this.db,'SELECT * FROM schedule_days WHERE owner=? AND day=?',owner,day.day).first<DayRow>();
  return new HealthyStore(this.db).score(owner,{day:day.day,target:day.target_sleep,end:day.end_at,reportedAt:saved!.asleep_at,chatActive:true,assessedAt:now});
 }
 async prepareReplan(owner:string,now:number,expectedVersion:number,free:TimeRange[],busy:TimeRange[],tasks:PlanningTask[],requestId:string){
  const day=await this.ensureDay(owner,now);if(!day)throw Error('SETUP_REQUIRED');
  const ranges=availableRanges(free.length?free:[{start:day.start_at,end:day.target_sleep}],busy,now);
  if(ranges.some(r=>r.start<day.start_at||r.end>day.target_sleep))throw Error('OUTSIDE_ACTIVE_DAY');
  const fixed=(await query(this.db,"SELECT start_at,end_at FROM local_events WHERE owner=? AND status='scheduled' AND start_at<? AND COALESCE(end_at,start_at+3600000)>?",owner,day.target_sleep,now).all<{start_at:number;end_at:number|null}>()).results.map(e=>({start:e.start_at,end:e.end_at??e.start_at+3600000}));
  const running=(await query(this.db,"SELECT start_at,minutes FROM sessions WHERE owner=? AND status IN ('running','paused')",owner).all<{start_at:number;minutes:number}>()).results;
  const plan=planDay(tasks,ranges,[...fixed,...running.map(s=>({start:s.start_at,end:Math.max(s.start_at+s.minutes*60000,now+5*60000)}))],now);
   const statements=[
    query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND version=?) THEN 1 ELSE 0 END',owner,day.day,expectedVersion),
    query(this.db,'UPDATE schedule_days SET intervals_json=?,version=version+1 WHERE owner=? AND day=?',JSON.stringify({free,busy,estimates:tasks.filter(t=>t.remainingMinutes!==null).map(t=>({id:t.id,minutes:t.remainingMinutes})),unplanned:plan.unplanned}),owner,day.day),
    query(this.db,'DELETE FROM schedule_dialogs WHERE owner=?',owner),
    query(this.db,"UPDATE reminders SET status='cancelled' WHERE owner=? AND status IN('pending','queued') AND session_id IN(SELECT id FROM sessions WHERE owner=? AND status='planned' AND start_at>=? AND start_at<?)",owner,owner,now,day.end_at),
    query(this.db,"UPDATE sessions SET status='skipped',version=version+1 WHERE owner=? AND status='planned' AND start_at>=? AND start_at<?",owner,now,day.end_at)
   ];
   for(const [index,block] of plan.blocks.entries()){
    const task=tasks.find(t=>t.id===block.taskId)!;
    const id='plan_'+requestId+'_'+index;
    statements.push(
     query(this.db,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND status='active' AND deleted_at IS NULL AND (deadline IS NULL OR (julianday(CASE WHEN deadline_precision='date' THEN deadline||'T23:59:59+07:00' ELSE deadline END)-2440587.5)*86400000>=? OR (julianday(CASE WHEN deadline_precision='date' THEN deadline||'T23:59:59+07:00' ELSE deadline END)-2440587.5)*86400000<=?)) THEN 1 ELSE 0 END",owner,task.id,block.end,now),
     query(this.db,"INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES(?,?,?,?,?,'planned',?)",id,owner,block.taskId,block.start,(block.end-block.start)/60000,day.end_at),
     query(this.db,"INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,?,?,1,1,?),(?,?,?,1,2,?)",id+':1:1',owner,id,block.start,id+':1:2',owner,id,block.start+900000)
    );
   }
   statements.push(query(this.db,'INSERT OR IGNORE INTO reminder_preferences(owner,quiet_start,quiet_end) VALUES(?,0,0)',owner));
   return {plan,statements,day:day.day};
 }
 async replan(owner:string,now:number,expectedVersion:number,free:TimeRange[],busy:TimeRange[],tasks:PlanningTask[],requestId:string){
  const prepared=await this.prepareReplan(owner,now,expectedVersion,free,busy,tasks,requestId);
  return new HealthyStore(this.db).mutate(owner,requestId,'replan',{day:prepared.day,expectedVersion,free,busy,tasks},now,state=>({state,result:prepared.plan,statements:prepared.statements}));
 }
 async restStatus(owner:string,now:number){
  if((await new HealthyStore(this.db).read(owner)).state.suspended)return {reason:'inactive',until:null};
  const pause=await query(this.db,'SELECT pause_until FROM reminder_preferences WHERE owner=?',owner).first<{pause_until:number}>();
  if((pause?.pause_until??0)>now)return {reason:'paused',until:pause!.pause_until};
  const settings=await this.settings(owner);
  const start=settings?.start_minutes??270;
  const sleep=await query(this.db,'SELECT reported_at FROM sleep_reports WHERE owner=?',owner).first<{reported_at:number}>();
  if(sleep){
   const until=(operatingDay(sleep.reported_at,start)+1)*DAY_MS-25200000+start*60000;
   if(now>=sleep.reported_at&&now<until)return {reason:'asleep',until};
  }
  if(settings&&settings.sleep_minutes!==null){
   const window=dayWindow(operatingDay(now,start),start,settings.sleep_minutes);
   if(now>=window.target)return {reason:'bedtime',until:window.end};
  }
  return {reason:'active',until:null};
 }
 async isResting(owner:string,now:number){return (await this.restStatus(owner,now)).reason!=='active';}
 async notificationsPaused(owner:string,now:number){
  return !['active','bedtime'].includes((await this.restStatus(owner,now)).reason);
 }
 async notificationAllowed(owner:string,id:string,now:number){
  const prefix='healthy:';
  if(!id.startsWith(prefix))return true;
  const parts=id.split(':');
  if(parts[2]!==owner)return false;
  const day=Number(parts[3]);
  if(!Number.isInteger(day))return false;
  const settings=await this.settings(owner);
  if(!settings||settings.sleep_minutes===null||day!==operatingDay(now,settings.start_minutes)||await this.notificationsPaused(owner,now))return false;
  const window=dayWindow(day,settings.start_minutes,settings.sleep_minutes);
  if(parts[1]==='morning')return now>=window.start&&now<window.start+3600000;
  const index=Number(parts[4]);if(parts[1]!=='bedtime'||!Number.isInteger(index)||index<0||index>2)return false;
  const due=window.target+index*20*60000;
  return now>=due&&now<due+20*60000&&now<window.end;
 }
 async queueCheckIns(owner:string,now:number){
  if((await new HealthyStore(this.db).read(owner)).state.suspended)return;
  const settings=await this.settings(owner);
  if(!settings||settings.sleep_minutes===null||await this.notificationsPaused(owner,now))return;
  const currentDay=operatingDay(now,settings.start_minutes),window=dayWindow(currentDay,settings.start_minutes,settings.sleep_minutes);
  const day={day:currentDay,start_at:window.start,target_sleep:window.target,end_at:window.end};
  const messages:{id:string;text:string;due:number}[]=[];
  if(now>=day.start_at&&now<day.start_at+3600000)messages.push({
   id:'healthy:morning:'+owner+':'+day.day,due:day.start_at,
   text:'Chào buổi sáng cậu :> hôm nay cậu bận những khoảng nào? Trả lời trực tiếp tin này hoặc dùng /lich kèm lịch của cậu nhé.'
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
   const {day:nextDay,window}=this.followingDay(row,settings);
   if(window.start>now)return;
   await query(this.db,'INSERT OR IGNORE INTO schedule_days(owner,day,start_at,target_sleep,end_at) VALUES(?,?,?,?,?)',owner,nextDay,window.start,window.target,window.end).run();
  }
 }
}
