import type { Button, Input } from '../../domain/work.ts';
export type { Button };
export type Incoming = Input;
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function incoming(raw: unknown): Incoming | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = record(raw), c = record(u.callback_query), hasCallback = u.callback_query !== undefined;
  if (typeof u.update_id !== 'number' || !Number.isSafeInteger(u.update_id) || u.update_id < 0) return null;
  const m = record(hasCallback ? c.message : u.message), chat = record(m.chat), from = record(hasCallback ? c.from : m.from);
  if (chat.type !== 'private' || typeof chat.id !== 'number' || !Number.isSafeInteger(chat.id) || chat.id <= 0
    || from.is_bot || from.id !== chat.id) return null;
  if (hasCallback) {
    if (typeof c.id !== 'string' || !c.id || c.id.length > 256 || typeof c.data !== 'string' || new TextEncoder().encode(c.data).length > 64) return null;
    return { updateId: u.update_id, owner: String(from.id), chat: chat.id, callback: c.data, callbackId: c.id };
  }
  if (typeof m.text !== 'string' || m.text.length > 4096) return null;
  return { updateId: u.update_id, owner: String(from.id), chat: chat.id, text: m.text };
}

export type Delivery = { state: 'sent' | 'pending' | 'failed' | 'uncertain'; retryAfter?: number; messageId?: number };
export async function deliver(token: string, payload: Record<string, unknown>, transport: typeof fetch = fetch, timeout = 8000): Promise<Delivery> {
  if (!['sendMessage','answerCallbackQuery'].includes(String(payload.method))) return { state: 'failed' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const { method, ...body } = payload;
    const response = await transport(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: controller.signal, redirect: 'error'
    });
    const data = record(await response.json()), messageId = record(data.result).message_id;
    if (response.ok && data.ok === true && (method === 'answerCallbackQuery' ? data.result === true : typeof messageId === 'number' && Number.isSafeInteger(messageId)))
      return { state: 'sent', ...(typeof messageId === 'number' ? { messageId } : {}) };
    const retry = record(data.parameters).retry_after;
    if (data.ok === false && data.error_code === 429)
      return { state: 'pending', retryAfter: typeof retry === 'number' && Number.isFinite(retry) ? Math.min(86400, Math.max(1, retry)) : 60 };
    if (data.ok === false && typeof data.error_code === 'number' && data.error_code >= 400 && data.error_code < 500) return { state: 'failed' };
    return { state: 'uncertain' };
  } catch { return { state: 'uncertain' }; } // Never log error/URL: the URL contains token.
  finally { clearTimeout(timer); }
}
export function message(chat: number, text: string, buttons: Button[][] = []) {
  return { method: 'sendMessage', chat_id: chat, text, ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}) };
}
