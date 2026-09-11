import { query } from './database.ts';
import type { Database } from './database.ts';
import type { Session } from '../../domain/session.ts';
import { sessionButtons } from '../../domain/session.ts';

export async function reminderAllowed(db:Database,id:string,now:number):Promise<boolean>{
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
    const payload=JSON.stringify({method:'sendMessage',chat_id:Number(owner),text:r.ordinal===1?`Đến buổi “${s.title}” rồi cậu · ${s.minutes} phút.`:`Tớ nhắc thêm lần này thôi nhé: “${s.title}”.`,reply_markup:{inline_keyboard:[...sessionButtons(s),[{text:'Nghỉ hôm nay',callback_data:'rest'}]]}});
    await db.batch([
      query(db,`INSERT OR IGNORE INTO outbox(id,payload,available,reminder_id) SELECT ?,?,?,? FROM reminders r
        JOIN sessions s ON s.id=r.session_id WHERE r.id=? AND r.status='pending' AND s.status='planned' AND s.generation=r.generation`,
        `reminder:${r.id}`,payload,now,r.id,r.id),
      query(db,"UPDATE reminders SET status='queued' WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM outbox WHERE reminder_id=?)",r.id,r.id)
    ]);
  }
}
