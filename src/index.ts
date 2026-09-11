import { configured } from './config.ts';
import type { Env } from './config.ts';
import { query, recoverInterrupted } from './db.ts';
import { incoming, message, deliver } from './telegram.ts';
import type { Incoming } from './telegram.ts';
import { listTasks, getTask } from './tasks.ts';
import { propose, resolveProposal } from './proposals.ts';
import { deadlineValue } from './domain/time.ts';
import type { Chat } from './ai/chat.ts';

async function handle(input: Incoming, env: Env, now: number, chatService?: Chat) {
  const { owner, chat, callback, text = '', updateId } = input;
  const send = (t: string, b: Parameters<typeof message>[2] = []) => message(chat, t, b);
  const card = (id: string, t: string) => send(t, [[{ text: 'Xác nhận', callback_data: `yes:${id}` }, { text: 'Thôi', callback_data: `no:${id}` }]]);
  if (callback?.startsWith('yes:') || callback?.startsWith('no:')) {
    const [action, id] = callback.split(':');
    const changed = await resolveProposal(env.DB, owner, id!, action === 'yes', now);
    return send(changed ? (action === 'yes' ? 'Đã lưu thay đổi.' : 'Ừ, không đổi nhé.') : 'Lựa chọn đã xử lý, hết hạn hoặc không còn hợp lệ. Dùng /tasks để xem.');
  }
  if (callback?.startsWith('deadline:')) {
    const task = await getTask(env.DB, owner, callback.slice(9));
    if (!task) return send('Không tìm thấy việc này.');
    await query(env.DB, `INSERT INTO selections(owner,task_id,version,expires) VALUES(?,?,?,?)
      ON CONFLICT(owner) DO UPDATE SET task_id=excluded.task_id,version=excluded.version,expires=excluded.expires`, owner, task.id, task.version, now + 300000).run();
    return send(`Đổi hạn “${task.title}”: nhập DD/MM/YYYY HH:mm theo giờ Việt Nam. /cancel để hủy.`);
  }
  if (text === '/cancel') {
    await query(env.DB, 'DELETE FROM selections WHERE owner=?', owner).run();
    return send('Đã hủy nhập ngày giờ.');
  }
  if (text === '/start' || text === '/help') return send('Bản thử: /add tên việc để ghi việc; /tasks để xem và đổi hạn; /cancel để hủy nhập. Hội thoại Gemini hiện đang tắt.');
  if (text === '/tasks' || callback?.startsWith('page:')) {
    const offset = callback ? Number(callback.slice(5)) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) return send('Trang không hợp lệ.');
    const tasks = await listTasks(env.DB, owner, offset);
    return send(tasks.length ? tasks.map(t => `${t.title} — ${t.deadline ?? 'chưa có hạn'}`).join('\n') : 'Chưa có việc ở trang này.',
      [...tasks.map(t => [{ text: `Đổi hạn: ${t.title.slice(0, 40)}`, callback_data: `deadline:${t.id}` }]),
        ...(tasks.length === 10 ? [[{ text: 'Trang tiếp', callback_data: `page:${offset + 10}` }]] : [])]);
  }
  if (callback) return send('Nút không còn hợp lệ.');
  if (text.startsWith('/add ')) {
    const title = text.slice(5).trim();
    if (!title || title.length > 160) return send('Tên việc cần từ 1 đến 160 ký tự.');
    const id = await propose(env.DB, owner, updateId, null, title, 0, now);
    return card(id, `Ghi việc “${title}” nhé?`);
  }
  const selection = await query(env.DB, 'SELECT * FROM selections WHERE owner=? AND expires>?', owner, now)
    .first<{ task_id: string; version: number }>();
  if (selection) {
    const deadline = deadlineValue(text);
    if (!deadline || Date.parse(deadline) <= now) return send('Cần ngày giờ tương lai, dạng DD/MM/YYYY HH:mm. /cancel để hủy.');
    const task = await getTask(env.DB, owner, selection.task_id);
    if (!task || task.version !== selection.version) return send('Việc đã thay đổi. Mở /tasks và chọn lại nhé.');
    const id = await propose(env.DB, owner, updateId, task.id, deadline, task.version, now);
    await query(env.DB, 'DELETE FROM selections WHERE owner=?', owner).run();
    return card(id, `Hạn “${task.title}”: ${task.deadline ?? 'chưa biết'} → ${deadline}. Đổi nhé?`);
  }
  if (chatService) {
    try { return send(await chatService(owner, text, await listTasks(env.DB, owner))); }
    catch { return send('Hội thoại đang gián đoạn. /add và /tasks vẫn dùng được nhé.'); }
  }
  return send('Hội thoại AI chưa bật trong bản thử. Cậu dùng /add tên việc hoặc /tasks nhé.');
}

export async function flushOutbox(env: Env, transport: typeof fetch = fetch, now = Date.now()) {
  if (env.DELIVERY_MODE !== 'outbox' || !configured(env)) return;
  const rows = (await query(env.DB, "SELECT id,payload FROM outbox WHERE state='pending' AND available<=? AND attempts<3 ORDER BY available,id LIMIT 4", now)
    .all<{id:string;payload:string}>()).results;
  for (const row of rows) {
    const claimed = await query(env.DB, "UPDATE outbox SET state='sending',attempts=attempts+1,lease=? WHERE id=? AND state='pending' AND attempts<3 AND available<=?", Date.now()+30000, row.id,now).run();
    if (!claimed.meta.changes) continue;
    const result = await deliver(env.TELEGRAM_BOT_TOKEN!, JSON.parse(row.payload), transport);
    await query(env.DB, `UPDATE outbox SET state=CASE WHEN ?='pending' AND attempts>=3 THEN 'failed' ELSE ? END,
      available=?,message_id=?,lease=NULL WHERE id=? AND state='sending'`, result.state,result.state,
      now+(result.retryAfter ?? 0)*1000,result.messageId ?? null,row.id).run();
  }
}
export function createWorker(chatService?: Chat, transport: typeof fetch = fetch) { return {
  async scheduled(_event: unknown, env: Env) {
    if (!configured(env) || env.DELIVERY_MODE !== 'outbox') return;
    await recoverInterrupted(env.DB, Date.now());
    await flushOutbox(env, transport);
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/telegram') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!configured(env)) return new Response('Unavailable', { status: 503 });
    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
    // Stream cap also protects chunked bodies without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return new Response('Bad request', { status: 400 });
    let raw = ''; let bytes = 0; const decoder = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 20000) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
      raw += decoder.decode(value, { stream: true }); }
    raw += decoder.decode();
    let input: Incoming | null;
    try { input = incoming(JSON.parse(raw)); } catch { return new Response('Bad request', { status: 400 }); }
    if (!input || input.owner !== env.TELEGRAM_USER_ID) return new Response('OK');
    const now = Date.now();
    try {
      await recoverInterrupted(env.DB, now);
      if (env.DELIVERY_MODE === 'outbox' && input.callbackId) {
        await query(env.DB, 'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)', `ack:${input.updateId}`,
          JSON.stringify({ method:'answerCallbackQuery',callback_query_id:input.callbackId }),now).run();
        await flushOutbox(env, transport, now);
      }
      const claim = await query(env.DB, "INSERT OR IGNORE INTO updates(id,status,created,chat) VALUES(?,'processing',?,?)", input.updateId, now,input.chat).run();
      if (!claim.meta.changes) { await flushOutbox(env,transport,now); return new Response('OK'); }
      let response;
      try { response = await handle(input, env, now, chatService); }
      catch { response = message(input.chat, 'Thao tác chưa hoàn tất hoặc đề xuất đã cũ. Kiểm tra /tasks trước khi thử lại nhé.'); }
      if (env.DELIVERY_MODE === 'outbox') {
        await query(env.DB, "UPDATE updates SET status='handled',response=? WHERE id=? AND status='processing'", JSON.stringify(response),input.updateId).run();
        await flushOutbox(env,transport,now);
        return new Response('OK');
      }
      await query(env.DB, "UPDATE updates SET status='handled' WHERE id=?", input.updateId).run();
      return Response.json(response);
    } catch { return new Response('Unavailable', { status: 503 }); }
  }
}; }
export default createWorker();
