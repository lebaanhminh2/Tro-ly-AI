import { query } from './database.ts';
import { configured } from '../../config/env.ts';
import type { Env } from '../../config/env.ts';
import { deliver } from '../telegram/api.ts';
import { reminderAllowed } from './reminders.ts';

export async function flushOutbox(env: Env, transport: typeof fetch = fetch, now = Date.now(), clock:()=>number = Date.now, onlyId?:string) {
  const wallStart=clock();
  const currentTime=()=>now+Math.max(0,clock()-wallStart);
  if (env.DELIVERY_MODE !== 'outbox' || !configured(env)) return;
  const rows = (await query(env.DB, "SELECT id,payload,reminder_id FROM outbox WHERE state='pending' AND available<=? AND attempts<3 AND (? IS NULL OR id=?) ORDER BY available,id LIMIT 4", now,onlyId??null,onlyId??null)
    .all<{ id: string; payload: string;reminder_id:string|null }>()).results;
  for (const row of rows) {
    const attemptAt=currentTime();
    if(row.reminder_id&&!await reminderAllowed(env.DB,row.reminder_id,attemptAt)){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND state='pending'",row.id).run();continue;
    }
    const token = crypto.randomUUID();
    const claimed = await query(env.DB, `UPDATE outbox SET state='sending',attempts=attempts+1,lease=?,claim_token=?
      WHERE id=? AND state='pending' AND attempts<3 AND available<=?`, attemptAt + 30000, token,row.id,attemptAt).run();
    if (!claimed.meta.changes) continue;
    if(row.reminder_id&&!await reminderAllowed(env.DB,row.reminder_id,currentTime())){
      await query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND claim_token=?",row.id,token).run();continue;
    }
    let result;
    try { result = await deliver(env.TELEGRAM_BOT_TOKEN!, JSON.parse(row.payload), transport); }
    catch { result = { state: 'failed' as const }; }
    const completedAt=currentTime();
    await query(env.DB, `UPDATE outbox SET state=CASE WHEN ?='pending' AND attempts>=3 THEN 'failed' ELSE ? END,
      available=?,message_id=?,sent_at=?,lease=NULL WHERE id=? AND state='sending' AND claim_token=?`, result.state,result.state,
      completedAt + (result.retryAfter ?? 0)*1000,result.messageId ?? null,result.state==='sent'?completedAt:null,row.id,token).run();
    if(row.reminder_id&&result.state==='sent')await query(env.DB,"UPDATE reminders SET status='done' WHERE id=?",row.reminder_id).run();
  }
}
