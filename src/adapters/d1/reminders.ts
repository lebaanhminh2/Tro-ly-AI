import { query } from './database.ts';
import {ScheduleStore} from './schedule-store.ts';
import type { Database } from './database.ts';
import type { Session } from '../../domain/session.ts';
import {appointmentAllowed} from './conversation-store.ts';

export async function reminderAllowed(db:Database,id:string,now:number):Promise<boolean>{
  if(id.startsWith('recurring:')){
    return !!await query(db,`SELECT o.id FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id AND r.owner=o.owner
      WHERE o.id=? AND o.status='queued' AND o.due<=? AND o.due>? AND r.enabled=1 AND r.version=o.rule_version
      AND (NOT EXISTS(SELECT 1 FROM habit_reminder_links WHERE owner=o.owner AND rule_id=o.rule_id) OR NOT EXISTS(
        SELECT 1 FROM recurrence_occurrences prior JOIN outbox b ON b.id='recurring:'||prior.id
        WHERE prior.owner=o.owner AND prior.rule_id=o.rule_id AND prior.slot=o.slot AND prior.id<>o.id AND b.state IN('sending','sent','uncertain')))
      AND NOT EXISTS(SELECT 1 FROM habit_reminder_links l JOIN habit_revisions v ON v.owner=l.owner AND v.habit_id=l.habit_id
        WHERE l.owner=o.owner AND l.rule_id=r.id AND v.from_day=(SELECT MAX(from_day) FROM habit_revisions
          WHERE owner=l.owner AND habit_id=l.habit_id AND from_day<=COALESCE(
            (SELECT day FROM habit_days WHERE owner=l.owner AND start_at<=o.due AND end_at>o.due ORDER BY start_at DESC LIMIT 1),
            (SELECT day FROM schedule_days WHERE owner=l.owner AND start_at<=o.due AND end_at>o.due ORDER BY start_at DESC LIMIT 1),
            CAST((o.due+25200000-COALESCE((SELECT start_minutes FROM schedule_settings WHERE owner=l.owner),0)*60000)/86400000 AS INTEGER)))
        AND v.archived_from IS NOT NULL)`,id.slice(10),now,now-3600000).first();
  }
  if(id.startsWith('appointment:'))return appointmentAllowed(db,id,now);
  const r=await query(db,`SELECT r.*,s.status AS session_status,s.generation AS current_generation,s.start_at,s.minutes,
    p.quiet_start,p.quiet_end,p.pause_until FROM reminders r JOIN sessions s ON s.id=r.session_id AND s.owner=r.owner
    JOIN reminder_preferences p ON p.owner=r.owner WHERE r.id=?`,id).first<{
      status:string;session_status:string;generation:number;current_generation:number;start_at:number;minutes:number;
      quiet_start:number;quiet_end:number;pause_until:number
    }>();
  return !!r&&['pending','queued'].includes(r.status)&&r.session_status==='planned'&&r.generation===r.current_generation
    &&now<r.start_at+Math.max(r.minutes,15)*60000+60000&&now>=r.pause_until;
}
export async function queueReminders(db:Database,owner:string,now:number){
  // Expired slots become unknown, not failed; a day of outage never produces a reminder flood.
  await query(db,"UPDATE sessions SET status='unknown',version=version+1 WHERE owner=? AND status='planned' AND start_at+(MAX(minutes,15)+1)*60000<=?",owner,now).run();
  if(await new ScheduleStore(db).isResting(owner,now))return;
  const due=(await query(db,"SELECT * FROM reminders WHERE owner=? AND status='pending' AND due<=? ORDER BY due,ordinal LIMIT 20",owner,now)
    .all<{id:string;session_id:string;generation:number;ordinal:number;due:number}>()).results;
  for(const r of due){
    if(!await reminderAllowed(db,r.id,now)){
      await query(db,"UPDATE reminders SET status='cancelled' WHERE id=? AND status='pending'",r.id).run();continue;
    }
    if(r.ordinal===2){
      const previous=await query(db,"SELECT state,sent_at FROM outbox WHERE reminder_id=?",`${r.session_id}:${r.generation}:1`).first<{state:string;sent_at:number|null}>();
      if(!previous||previous.state!=='sent'||previous.sent_at===null)continue;
      if(now<previous.sent_at+900000)continue;
    }
    const s=await query(db,'SELECT s.*,t.title FROM sessions s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.id=? AND s.owner=?',r.session_id,owner).first<Session&{title:string}>();
    if(!s)continue;
    const payload=JSON.stringify({method:'sendMessage',chat_id:Number(owner),text:r.ordinal===1?`Đến giờ làm “${s.title}” rồi cậu · dự kiến ${s.minutes} phút. Mình bắt đầu từ một phần nhỏ nhé :>`:`Tớ nhắc nhẹ “${s.title}” nhé. Nếu xong rồi, cậu tick trong ứng dụng giúp tớ nha.`});
    await db.batch([
      query(db,`INSERT OR IGNORE INTO outbox(id,payload,available,reminder_id) SELECT ?,?,?,? FROM reminders r
        JOIN sessions s ON s.id=r.session_id WHERE r.id=? AND r.status='pending' AND s.status='planned' AND s.generation=r.generation`,
        `reminder:${r.id}`,payload,now,r.id,r.id),
      query(db,"UPDATE reminders SET status='queued' WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM outbox WHERE reminder_id=?)",r.id,r.id)
    ]);
  }
}
