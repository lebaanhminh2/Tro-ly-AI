import { configured } from '../config/env.ts';
import type { Env } from '../config/env.ts';
import { incoming, message } from '../adapters/telegram/api.ts';
import { query, recoverInterrupted } from '../adapters/d1/database.ts';
import { D1WorkStore } from '../adapters/d1/work-store.ts';
import { flushOutbox } from '../adapters/d1/outbox.ts';
import { processInbox } from '../application/process-inbox.ts';
import type { ChatService } from '../application/plan-command.ts';
import type { Clock } from '../ports/work-store.ts';
import { queueReminders } from '../adapters/d1/reminders.ts';

export { flushOutbox };
export function createWorker(chat?: ChatService, transport: typeof fetch = fetch, clock: Clock = { now: Date.now }) {
  return {
    async scheduled(_event: unknown, env: Env) {
      if (!configured(env)) return;
      const store = new D1WorkStore(env.DB);
      await recoverInterrupted(env.DB, clock.now()); // Handles only legacy prototype updates and delivery leases.
      for (const owner of await store.pendingOwners()) {
        if (owner === env.TELEGRAM_USER_ID) await processInbox(store, owner, clock, chat);
      }
      await queueReminders(env.DB,env.TELEGRAM_USER_ID,clock.now());
      await flushOutbox(env, transport, clock.now());
    },
    async fetch(request: Request, env: Env): Promise<Response> {
      if (new URL(request.url).pathname !== '/telegram') return new Response('Not found', { status: 404 });
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!configured(env)) return new Response('Unavailable', { status: 503 });
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
      const reader = request.body?.getReader();
      if (!reader) return new Response('Bad request', { status: 400 });
      let raw = '', bytes = 0;
      const decoder = new TextDecoder('utf-8', { fatal: true });
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 20000) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } catch { return new Response('Bad request', { status: 400 }); }
      let input;
      try { input = incoming(JSON.parse(raw)); } catch { return new Response('Bad request', { status: 400 }); }
      if (!input || input.owner !== env.TELEGRAM_USER_ID) return new Response('OK');
      try {
        const store = new D1WorkStore(env.DB);
        const isNew = await store.accept(input, clock.now(), env.DELIVERY_MODE === 'outbox');
        if (env.DELIVERY_MODE === 'outbox' && input.callbackId) {
          await query(env.DB, 'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)', `ack:${input.owner}:${input.updateId}`,
            JSON.stringify({ method: 'answerCallbackQuery', callback_query_id: input.callbackId }),clock.now()).run();
          await flushOutbox(env, transport, clock.now());
        }
        await processInbox(store, input.owner, clock, chat);
        await flushOutbox(env, transport, clock.now());
        if (env.DELIVERY_MODE === 'outbox' || !isNew) return new Response('OK');
        const result = await store.result(input.owner, input.updateId);
        return result ? Response.json(message(input.chat,result.text,result.buttons)) : new Response('OK');
      } catch { return new Response('Unavailable', { status: 503 }); }
    }
  };
}
export default createWorker();
