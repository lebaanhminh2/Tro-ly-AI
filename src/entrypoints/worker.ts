import {boardCommand} from '../application/progress-renderer.ts';
import {SCHEDULE_PROMPT} from '../application/schedule-command.ts';
import {ScheduleStore} from '../adapters/d1/schedule-store.ts';
import {HealthyStore} from '../adapters/d1/healthy-store.ts';
import {RecurrenceStore} from '../adapters/d1/recurrence-store.ts';
import {miniAppApi} from './mini-app.ts';
import {unlockAchievements} from '../adapters/d1/progress-store.ts';
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
import {Gemini} from '../ai/gemini.ts';
import {D1UiStore} from '../adapters/d1/ui-store.ts';
import {ConversationStore,queueAppointments,acknowledgeAppointments} from '../adapters/d1/conversation-store.ts';
import {TOOL_PERSONA} from '../ai/persona.ts';
import {buildContext} from '../application/context-builder.ts';

export { flushOutbox };
export function createWorker(chat?: ChatService, transport: typeof fetch = fetch, clock: Clock = { now: Date.now }, cardsEnabled=false) {
  const flushCards=async(env:Env)=>{
    if(cardsEnabled&&env.DELIVERY_MODE==='outbox')await new D1UiStore(env.DB).flush(env.TELEGRAM_USER_ID,env.TELEGRAM_BOT_TOKEN!,transport,()=>clock.now());
  };
  const runtimeChat = (env: Env): ChatService | undefined => {
    if(chat)return chat;
    if(env.AI_MODE!=='on')return undefined;
    const service:ChatService=async()=>{throw Error('MISSING_OWNER_LEASE');};
    service.forLease=lease=>async(owner,text,_tasks,input,reader)=>{
      if(!reader||owner!==lease.owner)throw Error('INVALID_CHAT_SCOPE');
      lease.pendingWrites=[];
      const journal=new ConversationStore(env.DB,statements=>lease.pendingWrites!.push(...statements)),store=new D1WorkStore(env.DB,cardsEnabled);
      const confirmation=input?.callback? /^tool-confirm:([yn]):(.+)$/.exec(input.callback):null;
      const [context,pending]=await Promise.all([buildContext(reader,owner,text||'Xác nhận bằng nút',lease.input.receivedAt??clock.now()),journal.pending(owner,clock.now())]);
      if(confirmation&&(!pending||pending.id!==confirmation[2]))return 'Đề xuất này đã cũ hoặc đã được xử lý.';
      const scheduling=/^\/lich(?:\s|$|@)/i.test(lease.input.text??'')||(env.ASSETS?await reader.isMorningReply?.(owner,input?.replyToMessageId,clock.now())??false:false);
      const hierarchy=env.ASSETS?await store.hierarchy(owner):[];
      const requestedCodes=new Set([...text.matchAll(/#(\d+)(?:\.(\d+))?/g)].map(m=>Number(m[1])));
      const relevantHierarchy=hierarchy.filter(t=>requestedCodes.has(t.public_code)||context.tasks.some(c=>c.id===t.id));
      const schedule=env.ASSETS?await reader.scheduleContext?.(owner,clock.now())??null:null;
      const sleepPhase=schedule&&Number(schedule.target_sleep)<=clock.now()?'\nĐã đến giờ nghỉ mục tiêu. Hãy hướng cuộc trò chuyện về kết thúc ngày và đi ngủ, không rủ làm thêm task. Nhắc /ngu nhẹ nhàng, không gây tội lỗi.': '';
      const initial=[{role:'user' as const,parts:[{text:JSON.stringify({contextData:{...JSON.parse(context.context),schedule,task_codes:relevantHierarchy.map(t=>({id:t.id,code:'#'+t.public_code,title:t.title,version:t.version,status:t.status,steps:t.steps.map(s=>({id:s.id,code:'#'+t.public_code+'.'+s.step_code,title:s.title,status:s.status,version:s.version}))}))},pending,replyToMessageId:input?.replyToMessageId??null})}]},
        ...context.turns.map(turn=>({role:turn.role,parts:[{text:turn.text}]}))];
      const snapshotReader=Object.create(reader) as typeof reader;
      const summaryRequest=JSON.parse(context.context).summary_request as {source_turns:{id:number;user:string;assistant:string}[]}|null;
      snapshotReader.unsummarized=async()=>summaryRequest?summaryRequest.source_turns.map(t=>({owner,command_id:t.id,user_text:t.user,assistant_text:t.assistant,created:0,expires:Number.MAX_SAFE_INTEGER})):[];
      const reply=await journal.turn(lease,initial,snapshotReader,(changes,now)=>store.mutationStatements(owner,changes,now,true),async(contents,allowTools,step)=>{
        if(confirmation){
          if(step>0)throw Error('USE_COMMITTED_FALLBACK');
          const call={name:'resolve_pending' as const,args:{pending_id:confirmation[2],accept:confirmation[1]==='y'}};
          return {content:{role:'model' as const,parts:[{functionCall:call}]},calls:[call],text:''};
        }
        if(!await reader.aiEnabled(owner))throw Error('AI_DISABLED');
        if(env.AI_TRIAL_ENDS_AT&&(!Number.isFinite(Date.parse(env.AI_TRIAL_ENDS_AT))||clock.now()>=Date.parse(env.AI_TRIAL_ENDS_AT)))throw Error('AI_TRIAL_ENDED');
        if(!await reserveAi(env.DB,'runtime:gemini',`${owner}:${lease.input.updateId}:tool:${step}`,clock.now(),env.AI_DAILY_LIMIT===undefined?null:Number(env.AI_DAILY_LIMIT)))throw Error('AI_QUOTA');
        const client=new Gemini({apiKey:env.GEMINI_API_KEY!,model:env.GEMINI_MODEL!,transport:(url,options)=>transport(url,{...options,redirect:'manual'}),timeoutMs:5000});
        return (await client.generateTools(contents,scheduling?SCHEDULE_PROMPT:TOOL_PERSONA+sleepPhase,allowTools,scheduling?['replan_day','respond']:undefined)).output;
      },()=>clock.now());
      if(journal.requestedView){
        const args=journal.requestedView.args;
        const callback=args.screen==='tasks'?'board:'+String(args.filter)+':0':args.screen==='achievements'?'progress:achievements':'progress:chart';
        const view=await boardCommand({...lease.input,text:undefined,callback},reader,clock.now());
        if(view){
          if(reply.trim()&&reply.length<250){view.view.intro=reply;view.view.text=reply+'\n\n'+view.view.text;}
          return view;
        }
      }
      const awaiting=await journal.pending(owner,clock.now());
      if(awaiting&&awaiting.id===`pending_${owner}_${lease.input.updateId}`)return {view:{text:reply,buttons:[[{text:'Xác nhận',callback_data:`tool-confirm:y:${awaiting.id}`},{text:'Thôi',callback_data:`tool-confirm:n:${awaiting.id}`}]]},changes:[]};
      return reply;
    };
    return service;
  };
  return {
    async scheduled(_event: unknown, env: Env) {
      if (!configured(env)) return;
      const store = new D1WorkStore(env.DB,cardsEnabled);
      if(env.ASSETS){
        const schedule=new ScheduleStore(env.DB);
        await schedule.settleClosedDays(env.TELEGRAM_USER_ID,clock.now());
        await new HealthyStore(env.DB).syncTaskTickets(env.TELEGRAM_USER_ID,clock.now());
        await schedule.queueCheckIns(env.TELEGRAM_USER_ID,clock.now());
        await new RecurrenceStore(env.DB).queueDue(env.TELEGRAM_USER_ID,clock.now(),await schedule.isResting(env.TELEGRAM_USER_ID,clock.now()));
      }
      await expireMemory(env.DB,clock.now());
      await unlockAchievements(env.DB,env.TELEGRAM_USER_ID,clock.now());
      await recoverInterrupted(env.DB, clock.now()); // Handles only legacy prototype updates and delivery leases.
      for (const owner of await store.pendingOwners()) {
        if (owner === env.TELEGRAM_USER_ID) await processInbox(store, owner, clock, runtimeChat(env),4);
      }
      await queueReminders(env.DB,env.TELEGRAM_USER_ID,clock.now());
      if(cardsEnabled)await queueAppointments(env.DB,env.TELEGRAM_USER_ID,clock.now());
      await flushOutbox(env, transport, clock.now());
      await flushCards(env);
    },
    async fetch(request: Request, env: Env): Promise<Response> {
      const path=new URL(request.url).pathname;
      if(env.ASSETS&&path.startsWith('/api/'))return miniAppApi(request,env,clock.now());
      if(env.ASSETS&&(path==='/app'||path.startsWith('/app/'))){
        if(path==='/app')return Response.redirect(new URL('/app/',request.url),302);
        const assetUrl=new URL(request.url);assetUrl.pathname=path.slice(4);
        const response=await env.ASSETS.fetch(new Request(assetUrl,request));
        const headers=new Headers(response.headers);
        headers.set('X-Content-Type-Options','nosniff');
        headers.set('Referrer-Policy','no-referrer');
        headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'");
        return new Response(response.body,{status:response.status,headers});
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
        const store = new D1WorkStore(env.DB,cardsEnabled);
        const isNew = await store.accept(input, clock.now(), env.DELIVERY_MODE === 'outbox');
        if(isNew&&env.ASSETS&&input.text)await new ScheduleStore(env.DB).chatActivity(input.owner,clock.now(),String(input.updateId));
        if(isNew&&env.ASSETS&&/^\/kiemtra(?:\s|$|@)/i.test(input.text??'')){
          const appUrl=new URL('/app/',request.url).toString();
          await query(env.DB,'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)','menu:'+input.owner+':'+input.updateId,JSON.stringify({method:'setChatMenuButton',chat_id:input.chat,menu_button:{type:'web_app',text:'Mở ứng dụng',web_app:{url:appUrl}}}),clock.now()).run();
        }
        if(isNew&&cardsEnabled)await acknowledgeAppointments(env.DB,input.owner,input.replyToMessageId);
        if(cardsEnabled&&env.DELIVERY_MODE==='outbox'&&input.callbackId&&isNew){
          const action=input.messageId&&input.callback?.startsWith('ui:')
            ?await new D1UiStore(env.DB).resolve(input.owner,input.chat,input.messageId,input.callback,clock.now()):null;
          const ackId=`ack:${input.owner}:${input.updateId}`;
          // Resolve only for feedback here. Revalidate under the owner lease before mutation.
          await query(env.DB,'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',ackId,
            JSON.stringify({method:'answerCallbackQuery',callback_query_id:input.callbackId,
              text:input.callback?.startsWith('ui:')&&!action?'Lựa chọn đã cũ hoặc đang cập nhật. Mở lại danh sách nhé.':'Đã nhận, đang xử lý.'}),clock.now()).run();
          await flushOutbox(env,transport,clock.now(),()=>clock.now(),ackId);
        }
        if (!cardsEnabled && env.DELIVERY_MODE === 'outbox' && input.callbackId) {
          await query(env.DB, 'INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)', `ack:${input.owner}:${input.updateId}`,
            JSON.stringify({ method: 'answerCallbackQuery', callback_query_id: input.callbackId }),clock.now()).run();
          await flushOutbox(env, transport, clock.now());
        }
        await processInbox(store, input.owner, clock, runtimeChat(env),4);
        if(env.ASSETS)await new HealthyStore(env.DB).syncTaskTickets(input.owner,clock.now());
        await flushOutbox(env, transport, clock.now());
        await flushCards(env);
        if (env.DELIVERY_MODE === 'outbox' || !isNew) return new Response('OK');
        const result = await store.result(input.owner, input.updateId);
        return result ? Response.json(message(input.chat,result.text,result.buttons)) : new Response('OK');
      } catch { return new Response('Unavailable', { status: 503 }); }
    }
  };
}
const cardWorker=createWorker(undefined,fetch,{now:Date.now},true);
const previewWorker=createWorker();
// Production outbox delivery uses versioned cards. Preview remains a local response-only harness.
export default {
  fetch(request:Request,env:Env){return (env.DELIVERY_MODE==='outbox'?cardWorker:previewWorker).fetch(request,env);},
  scheduled(event:unknown,env:Env){return (env.DELIVERY_MODE==='outbox'?cardWorker:previewWorker).scheduled(event,env);}
};
