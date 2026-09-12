import type { Button, Input } from '../../domain/work.ts';
import {renderView} from '../../application/ui-renderer.ts';
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
    return { updateId: u.update_id, owner: String(from.id), chat: chat.id, callback: c.data, callbackId: c.id,
      ...(typeof m.message_id==='number'&&Number.isSafeInteger(m.message_id)&&m.message_id>0?{messageId:m.message_id}:{}) };
  }
  if (typeof m.text !== 'string' || m.text.length > 4096) return null;
  return { updateId: u.update_id, owner: String(from.id), chat: chat.id, text: m.text };
}

export type Delivery = { state: 'sent' | 'pending' | 'failed' | 'uncertain'; retryAfter?: number; messageId?: number; reason?:'EDIT_UNAVAILABLE' };
export async function deliver(token: string, payload: Record<string, unknown>, transport: typeof fetch = fetch, timeout = 8000): Promise<Delivery> {
  if (!['sendMessage','answerCallbackQuery','editMessageReplyMarkup','editMessageText'].includes(String(payload.method))) return { state: 'failed' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let phase: 'request' | 'response' = 'request';
  let httpStatus: number | undefined;
  // Only fixed labels and numeric status codes. Never log errors, URLs, payloads or headers.
  const report = (code: string, apiStatus?: number) => {
    console.warn(JSON.stringify({event: 'telegram_delivery', code, phase, httpStatus, apiStatus}));
  };
  try {
    const { method, ...body } = payload;
    if (method === 'sendMessage' || method === 'editMessageText') {
      const markup = record(body.reply_markup);
      const view = renderView({text: String(body.text ?? ''), buttons: (markup.inline_keyboard ?? []) as Button[][]});
      body.text = view.text;
      if (body.reply_markup) body.reply_markup = {...markup, inline_keyboard: view.buttons};
    }
    const response = await transport(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: controller.signal, redirect: 'manual'
    });
    phase = 'response';
    httpStatus = response.status;
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      report('REDIRECT_REJECTED');
      return {state: 'uncertain'};
    }
    const data = record(await response.json()), messageId = record(data.result).message_id;
    const editing = method === 'editMessageText' || method === 'editMessageReplyMarkup';
    // Only the specific no-op response is successful. Other HTTP 400 errors remain failures.
    if (editing && response.status === 400 && data.ok === false && data.error_code === 400
      && typeof data.description === 'string' && /^Bad Request: message is not modified(?:$|:)/.test(data.description)
      && typeof body.message_id === 'number' && Number.isSafeInteger(body.message_id) && body.message_id > 0)
      return {state:'sent',messageId:body.message_id};
    if(editing&&response.status===400&&data.ok===false&&data.error_code===400
      && typeof data.description==='string'&&/^Bad Request: (message to edit not found|message can't be edited)$/.test(data.description))
      return {state:'failed',reason:'EDIT_UNAVAILABLE'};
    if (response.ok && data.ok === true && (method === 'answerCallbackQuery' ? data.result === true : typeof messageId === 'number' && Number.isSafeInteger(messageId)))
      return { state: 'sent', ...(typeof messageId === 'number' ? { messageId } : {}) };
    const retry = record(data.parameters).retry_after;
    const apiStatus = typeof data.error_code === 'number' && Number.isInteger(data.error_code)
      && data.error_code >= 100 && data.error_code <= 599 ? data.error_code : undefined;
    report(data.ok === false ? 'API_REJECTED' : 'UNEXPECTED_RESPONSE', apiStatus);
    if (data.ok === false && data.error_code === 429)
      return { state: 'pending', retryAfter: typeof retry === 'number' && Number.isFinite(retry) ? Math.min(86400, Math.max(1, retry)) : 60 };
    if (data.ok === false && typeof data.error_code === 'number' && data.error_code >= 400 && data.error_code < 500) return { state: 'failed' };
    return { state: 'uncertain' };
  } catch (error) {
    // Match a known runtime failure without exposing arbitrary exception text.
    const illegalInvocation = error instanceof TypeError && /illegal invocation/i.test(error.message);
    report(controller.signal.aborted ? 'TIMEOUT' : phase === 'response' ? 'RESPONSE_DECODE_FAILED'
      : illegalInvocation ? 'TRANSPORT_ILLEGAL_INVOCATION' : 'TRANSPORT_FAILED');
    return { state: 'uncertain' };
  }
  finally { clearTimeout(timer); }
}
export function message(chat: number, text: string, buttons: Button[][] = []) {
  ({text, buttons} = renderView({text, buttons}));
  return { method: 'sendMessage', chat_id: chat, text, ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}) };
}
