import { configured, type Env } from '../config/env.ts';
import { incoming, message } from '../adapters/telegram/api.ts';
import { query } from '../adapters/d1/database.ts';
import { D1WorkStore } from '../adapters/d1/work-store.ts';
import { flushOutbox } from '../adapters/d1/outbox.ts';
import { processInbox } from '../application/process-inbox.ts';
import { ScheduleStore } from '../adapters/d1/schedule-store.ts';
import { HealthyStore } from '../adapters/d1/healthy-store.ts';
import { D1UiStore } from '../adapters/d1/ui-store.ts';
import { acknowledgeAppointments } from '../adapters/d1/conversation-store.ts';
import { receiveNudgeReply } from '../adapters/d1/work-nudges.ts';
import { approveBrowserCode } from '../adapters/d1/browser-auth.ts';
import { logFailure } from '../adapters/observability.ts';
import type { ChatService } from '../application/plan-command.ts';
import type { Clock } from '../ports/work-store.ts';

export async function handleTelegramWebhook(
  request: Request,
  env: Env,
  deps: {
    cardsEnabled: boolean;
    transport: typeof fetch;
    clock: Clock;
    chat: ChatService | undefined;
    flushCards: () => Promise<void>;
  },
): Promise<Response> {
  const { cardsEnabled, transport, clock, chat, flushCards } = deps;
  if (new URL(request.url).pathname !== '/telegram')
    return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!configured(env)) return new Response('Unavailable', { status: 503 });
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET)
    return new Response('Forbidden', { status: 403 });
  const reader = request.body?.getReader();
  if (!reader) return new Response('Bad request', { status: 400 });
  let raw = '',
    bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 20000) {
        await reader.cancel();
        return new Response('Too large', { status: 413 });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  let input;
  try {
    input = incoming(JSON.parse(raw));
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!input || input.owner !== env.TELEGRAM_USER_ID) return new Response('OK');
  if (
    env.ASSETS &&
    /^\/(start|tasks|today|progress|settings)(?:@[A-Za-z0-9_]+)?$/i.test(input.text ?? '')
  )
    input = { ...input, text: '/kiemtra' };
  try {
    if (env.ASSETS && /^\/dangnhap(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(input.text ?? '')) {
      const code = (input.text ?? '').trim().split(/\s+/)[1] ?? '';
      const approved = await approveBrowserCode(
        env.DB,
        input.owner,
        env.TELEGRAM_USER_ID,
        code,
        clock.now(),
      );
      const text = approved
        ? 'Đã xác nhận đăng nhập Chrome của cậu. Quay lại tab Minh Anh nhé.'
        : 'Mã đăng nhập không đúng hoặc đã hết hạn. Cậu tạo mã mới trên Chrome rồi gửi /dangnhap MÃ nhé.';
      const id = `browser-login:${input.owner}:${input.updateId}`;
      await query(
        env.DB,
        'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',
        id,
        JSON.stringify({ method: 'sendMessage', chat_id: input.chat, text }),
        clock.now(),
      ).run();
      if (approved) await new ScheduleStore(env.DB).chatActivity(input.owner, clock.now(), id);
      if (env.DELIVERY_MODE === 'outbox') {
        await flushOutbox(env, transport, clock.now(), () => clock.now(), id, 1);
        return new Response('OK');
      }
      return Response.json(message(input.chat, text, []));
    }
    const store = new D1WorkStore(env.DB, cardsEnabled);
    const isNew = await store.accept(input, clock.now(), env.DELIVERY_MODE === 'outbox');
    if (isNew && env.ASSETS && input.text)
      try {
        await receiveNudgeReply(
          env,
          input.updateId,
          input.text,
          clock.now(),
          transport,
          input.replyToMessageId,
        );
      } catch {
        /* A reply must not block normal chat. */
      }
    if (isNew && env.ASSETS && input.text)
      await new ScheduleStore(env.DB).chatActivity(
        input.owner,
        clock.now(),
        String(input.updateId),
      );
    if (isNew && env.ASSETS && /^\/kiemtra(?:\s|$|@)/i.test(input.text ?? '')) {
      const appUrl = new URL('/app/', request.url).toString();
      await query(
        env.DB,
        'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',
        'menu:' + input.owner + ':' + input.updateId,
        JSON.stringify({
          method: 'setChatMenuButton',
          chat_id: input.chat,
          menu_button: { type: 'web_app', text: 'Mở ứng dụng', web_app: { url: appUrl } },
        }),
        clock.now(),
      ).run();
    }
    if (isNew && (cardsEnabled || env.ASSETS))
      await acknowledgeAppointments(env.DB, input.owner, input.replyToMessageId);
    if (cardsEnabled && env.DELIVERY_MODE === 'outbox' && input.callbackId && isNew) {
      const action =
        input.messageId && input.callback?.startsWith('ui:')
          ? await new D1UiStore(env.DB).resolve(
              input.owner,
              input.chat,
              input.messageId,
              input.callback,
              clock.now(),
            )
          : null;
      const ackId = `ack:${input.owner}:${input.updateId}`;
      await query(
        env.DB,
        'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',
        ackId,
        JSON.stringify({
          method: 'answerCallbackQuery',
          callback_query_id: input.callbackId,
          text:
            input.callback?.startsWith('ui:') && !action
              ? 'Lựa chọn đã cũ hoặc đang cập nhật. Mở lại danh sách nhé.'
              : 'Đã nhận, đang xử lý.',
        }),
        clock.now(),
      ).run();
      await flushOutbox(env, transport, clock.now(), () => clock.now(), ackId);
    }
    if (!cardsEnabled && env.DELIVERY_MODE === 'outbox' && input.callbackId) {
      const ackId = `ack:${input.owner}:${input.updateId}`;
      await query(
        env.DB,
        'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',
        ackId,
        JSON.stringify({ method: 'answerCallbackQuery', callback_query_id: input.callbackId }),
        clock.now(),
      ).run();
      await flushOutbox(env, transport, clock.now(), () => clock.now(), ackId, 1);
    }
    await processInbox(store, input.owner, clock, chat, 4);
    // Deliver this update before optional bookkeeping. On the Workers Free CPU
    // budget a later maintenance step may be interrupted, but a committed reply
    // must not remain behind unrelated reminder jobs in the shared outbox.
    await flushOutbox(
      env,
      transport,
      clock.now(),
      () => clock.now(),
      `reply:${input.owner}:${input.updateId}`,
      1,
    );
    await flushCards();
    if (isNew && env.ASSETS)
      await new HealthyStore(env.DB).syncTaskTickets(input.owner, clock.now());
    if (env.DELIVERY_MODE === 'outbox' || !isNew) return new Response('OK');
    const result = await store.result(input.owner, input.updateId);
    return result
      ? Response.json(message(input.chat, result.text, result.buttons))
      : new Response('OK');
  } catch (error) {
    logFailure('telegram_webhook', error);
    return new Response('Unavailable', { status: 503 });
  }
}
