export type Button = { text: string; callback_data: string };
export type Incoming = { updateId: number; owner: string; chat: number; text?: string; callback?: string; callbackId?: string };
export function incoming(raw: unknown): Incoming | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, any>;
  if (!Number.isSafeInteger(u.update_id)) return null;
  const c = u.callback_query;
  const m = c ? c.message : u.message;
  const from = c ? c.from : m?.from;
  if (!m || m.chat?.type !== 'private' || !Number.isSafeInteger(m.chat.id) || !Number.isSafeInteger(from?.id)
    || from.is_bot || from.id !== m.chat.id) return null;
  if (c && (typeof c.id !== 'string' || !c.id || c.id.length > 256 || typeof c.data !== 'string' || new TextEncoder().encode(c.data).length > 64)) return null;
  if (!c && (typeof m.text !== 'string' || m.text.length > 4096)) return null;
  return { updateId: u.update_id, owner: String(from.id), chat: m.chat.id, ...(c ? { callback: c.data, callbackId: c.id } : { text: m.text }) };
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
    const data = await response.json() as any;
    if (response.ok && data.ok === true && (method === 'answerCallbackQuery' ? data.result === true : Number.isSafeInteger(data.result?.message_id)))
      return { state: 'sent', ...(method === 'sendMessage' ? { messageId: data.result.message_id } : {}) };
    if (data.ok === false && data.error_code === 429)
      return { state: 'pending', retryAfter: Number.isFinite(data.parameters?.retry_after) ? Math.min(86400, Math.max(1, data.parameters.retry_after)) : 60 };
    if (data.ok === false && data.error_code >= 400 && data.error_code < 500) return { state: 'failed' };
    return { state: 'uncertain' };
  } catch { return { state: 'uncertain' }; } // Never log error/URL: the URL contains token.
  finally { clearTimeout(timer); }
}
export function message(chat: number, text: string, buttons: Button[][] = []) {
  return { method: 'sendMessage', chat_id: chat, text, ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}) };
}
