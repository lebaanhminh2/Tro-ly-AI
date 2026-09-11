import { query } from './database.ts';
import { configured } from '../../config/env.ts';
import type { Env } from '../../config/env.ts';
import { deliver } from '../telegram/api.ts';

export async function flushOutbox(env: Env, transport: typeof fetch = fetch, now = Date.now()) {
  if (env.DELIVERY_MODE !== 'outbox' || !configured(env)) return;
  const rows = (await query(env.DB, "SELECT id,payload FROM outbox WHERE state='pending' AND available<=? AND attempts<3 ORDER BY available,id LIMIT 4", now)
    .all<{ id: string; payload: string }>()).results;
  for (const row of rows) {
    const token = crypto.randomUUID();
    const claimed = await query(env.DB, `UPDATE outbox SET state='sending',attempts=attempts+1,lease=?,claim_token=?
      WHERE id=? AND state='pending' AND attempts<3 AND available<=?`, now + 30000, token,row.id,now).run();
    if (!claimed.meta.changes) continue;
    let result;
    try { result = await deliver(env.TELEGRAM_BOT_TOKEN!, JSON.parse(row.payload), transport); }
    catch { result = { state: 'failed' as const }; }
    await query(env.DB, `UPDATE outbox SET state=CASE WHEN ?='pending' AND attempts>=3 THEN 'failed' ELSE ? END,
      available=?,message_id=?,lease=NULL WHERE id=? AND state='sending' AND claim_token=?`, result.state,result.state,
      now + (result.retryAfter ?? 0)*1000,result.messageId ?? null,row.id,token).run();
  }
}
