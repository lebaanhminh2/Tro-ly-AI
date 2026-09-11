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
import {expireMemory, reserveAi} from '../adapters/d1/memory.ts';
import {contextualChat} from '../ai/chat.ts';
import {GeminiTrial} from '../ai/gemini.ts';
import {CalendarService} from '../adapters/google-calendar/service.ts';
import {GoogleClient} from '../adapters/google-calendar/client.ts';
import {GoogleTokenVault} from '../adapters/google-calendar/vault.ts';

export { flushOutbox };
export function createWorker(chat?: ChatService, transport: typeof fetch = fetch, clock: Clock = { now: Date.now }, calendarOverride?:CalendarService) {
  const runtimeChat = (env: Env): ChatService | undefined => {
    if (chat) return chat; // Explicit offline dependency injection; default export has none.
    if (env.AI_MODE !== 'enabled') return undefined;
    return contextualChat({generate: (turns, context, ids) => {
      // One client per reserved call: durable D1 quota, not isolate lifetime, is authoritative.
      const client = new GeminiTrial({apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL!,
        transport: (url, options) => transport(url, {...options, redirect: 'error'}),
        now: () => clock.now(), timeoutMs: 5000, maxRequests: 1});
      return client.generate(turns, context, ids);
    }}, (key, now) => reserveAi(env.DB, 'runtime:gemini', key, now, Number(env.AI_DAILY_LIMIT)));
  };
  const calendar=(env:Env)=>{
    if(env.CALENDAR_MODE!=='enabled')return undefined;
    if(calendarOverride)return calendarOverride;
    const client=new GoogleClient({clientId:env.GOOGLE_CLIENT_ID!,clientSecret:env.GOOGLE_CLIENT_SECRET!,redirectUri:env.PUBLIC_ORIGIN!+'/oauth/google/callback'},transport);
    return new CalendarService({db:env.DB,provider:client,tokens:client,vault:new GoogleTokenVault(env.GOOGLE_TOKEN_KEY!),owner:env.TELEGRAM_USER_ID,origin:env.PUBLIC_ORIGIN!,writes:env.CALENDAR_WRITES==='enabled',now:()=>clock.now()});
  };
  return {
    async scheduled(_event: unknown, env: Env) {
      if (!configured(env)) return;
      const store = new D1WorkStore(env.DB);
      const calendarService=calendar(env);
      await expireMemory(env.DB,clock.now());
      await recoverInterrupted(env.DB, clock.now()); // Handles only legacy prototype updates and delivery leases.
      for (const owner of await store.pendingOwners()) {
        if (owner === env.TELEGRAM_USER_ID) await processInbox(store, owner, clock, runtimeChat(env),4,calendarService);
      }
      try{await calendarService?.tick();}catch{/* Error state remains visible via /calendar; never log tokens. */}
      await queueReminders(env.DB,env.TELEGRAM_USER_ID,clock.now());
      await flushOutbox(env, transport, clock.now());
    },
    async fetch(request: Request, env: Env): Promise<Response> {
      const url=new URL(request.url);
      if(url.pathname.startsWith('/oauth/google/')){
        if(!configured(env)||env.CALENDAR_MODE!=='enabled')return new Response('Not found',{status:404});
        const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Type':'text/plain; charset=utf-8'};
        if(request.method!=='GET'||url.origin!==env.PUBLIC_ORIGIN)return new Response('Forbidden',{status:403,headers});
        const service=calendar(env)!;
        try{
          if(url.pathname==='/oauth/google/start'&&url.searchParams.getAll('ticket').length===1){
            const result=await service.start(url.searchParams.get('ticket')!);
            return new Response(null,{status:302,headers:{...headers,Location:result.url,'Set-Cookie':`__Host-calendar=${result.browser}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`}});
          }
          if(url.pathname==='/oauth/google/callback'&&url.searchParams.getAll('state').length===1&&url.searchParams.getAll('code').length===1&&!url.searchParams.has('error')){
            const browser=(request.headers.get('Cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-calendar='))?.slice(16)??'';
            await service.callback(url.searchParams.get('state')!,browser,url.searchParams.get('code')!);
            return new Response('Đã kết nối Google. Quay lại Telegram và dùng /calendar list.',{headers:{...headers,'Set-Cookie':'__Host-calendar=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'}});
          }
        }catch{/* Return only generic error, never provider body or query params. */}
        return new Response('Liên kết không hợp lệ, hết hạn hoặc kết nối chưa thành công. Tạo lại từ bot.',{status:400,headers});
      }
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
        await processInbox(store, input.owner, clock, runtimeChat(env),4,calendar(env));
        await flushOutbox(env, transport, clock.now());
        if (env.DELIVERY_MODE === 'outbox' || !isNew) return new Response('OK');
        const result = await store.result(input.owner, input.updateId);
        return result ? Response.json(message(input.chat,result.text,result.buttons)) : new Response('OK');
      } catch { return new Response('Unavailable', { status: 503 }); }
    }
  };
}
export default createWorker();
