import {ScheduleStore} from './schedule-store.ts';
import { query } from './database.ts';
import { configured } from '../../config/env.ts';
import type { Env } from '../../config/env.ts';
import { deliver } from '../telegram/api.ts';
import { reminderAllowed } from './reminders.ts';
import {nudgeAllowed} from './work-nudges.ts';
import {TaskDayStore} from './task-day-store.ts';

export async function flushOutbox(env: Env, transport: typeof fetch = fetch, now = Date.now(), clock:()=>number = Date.now, onlyId?:string) {
  const wallStart=clock();
  const currentTime=()=>now+Math.max(0,clock()-wallStart);
  if (env.DELIVERY_MODE !== 'outbox' || !configured(env)) return;
  const rows = (await query(env.DB, "SELECT id,payload,reminder_id FROM outbox WHERE state='pending' AND available<=? AND attempts<3 AND (? IS NULL OR id=?) ORDER BY available,id LIMIT 4", now,onlyId??null,onlyId??null)
    .all<{ id: string; payload: string;reminder_id:string|null }>()).results;
  for (const row of rows) {
    const legacyWork=env.ASSETS&&row.reminder_id&&!row.reminder_id.startsWith('appointment:')&&!row.reminder_id.startsWith('recurring:');
    if(legacyWork||row.id.startsWith('nudge:')||row.id.startsWith('task-nudge:')&&!await nudgeAllowed(env.DB,env.TELEGRAM_USER_ID,row.id,currentTime())||row.id.startsWith('task-plan:')&&!await new TaskDayStore(env.DB).notificationAllowed(env.TELEGRAM_USER_ID,row.id,currentTime())){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND state='pending'",row.id).run();continue;
    }
    const schedule=new ScheduleStore(env.DB);
    const blocked=async(at:number)=>row.reminder_id&&!row.reminder_id.startsWith('recurring:')&&!row.reminder_id.startsWith('appointment:')
      ?schedule.isResting(env.TELEGRAM_USER_ID,at):schedule.notificationsPaused(env.TELEGRAM_USER_ID,at);
    const attemptAt=currentTime();
    if(env.ASSETS&&(row.reminder_id||row.id.startsWith('achievement:')||row.id.startsWith('healthy:'))&&await blocked(attemptAt)){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND state='pending'",row.id).run();continue;
    }
    if(row.reminder_id&&!await reminderAllowed(env.DB,row.reminder_id,attemptAt)){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND state='pending'",row.id).run();continue;
    }
    if(env.ASSETS&&!await new ScheduleStore(env.DB).notificationAllowed(env.TELEGRAM_USER_ID,row.id,attemptAt)){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND state='pending'",row.id).run();continue;
    }
    const token = crypto.randomUUID();
    const claimed = await query(env.DB, `UPDATE outbox SET state='sending',attempts=attempts+1,lease=?,claim_token=?
      WHERE id=? AND state='pending' AND attempts<3 AND available<=?`, attemptAt + 30000, token,row.id,attemptAt).run();
    if (!claimed.meta.changes) continue;
    if(env.ASSETS&&(row.reminder_id||row.id.startsWith('healthy:'))&&await blocked(currentTime())){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND claim_token=?",row.id,token).run();continue;
    }
    if(row.reminder_id&&!await reminderAllowed(env.DB,row.reminder_id,currentTime())){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND claim_token=?",row.id,token).run();continue;
    }
    let result;
    if(row.id.startsWith('nudge:')||row.id.startsWith('task-nudge:')&&!await nudgeAllowed(env.DB,env.TELEGRAM_USER_ID,row.id,currentTime())||row.id.startsWith('task-plan:')&&!await new TaskDayStore(env.DB).notificationAllowed(env.TELEGRAM_USER_ID,row.id,currentTime())){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND claim_token=?",row.id,token).run();continue;
    }
    const payload=JSON.parse(row.payload);delete payload._nudge;delete payload._taskNudge;
    try { result = await deliver(env.TELEGRAM_BOT_TOKEN!, payload, transport); }
    catch { result = { state: 'failed' as const }; }
    const completedAt=currentTime();
    await query(env.DB, `UPDATE outbox SET state=CASE WHEN ?='pending' AND attempts>=3 THEN 'failed' ELSE ? END,
      available=?,message_id=?,sent_at=?,lease=NULL WHERE id=? AND state='sending' AND claim_token=?`, result.state,result.state,
      completedAt + (result.retryAfter ?? 0)*1000,result.messageId ?? null,result.state==='sent'?completedAt:null,row.id,token).run();
    if(row.reminder_id?.startsWith('recurring:')&&result.state==='sent')await query(env.DB,"UPDATE recurrence_occurrences SET status='sent',message_id=? WHERE id=? AND owner=?",result.messageId??null,row.reminder_id.slice(10),env.TELEGRAM_USER_ID).run();
    if(row.reminder_id&&result.state==='sent')await query(env.DB,"UPDATE reminders SET status='done' WHERE id=?",row.reminder_id).run();
  }
}
