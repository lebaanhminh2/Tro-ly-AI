import {miniAppApi} from './mini-app.ts';
import {createRuntimeChat} from './worker-chat.ts';
import {runScheduled} from './worker-scheduler.ts';
import {handleTelegramWebhook} from './telegram-webhook.ts';
import {D1UiStore} from '../adapters/d1/ui-store.ts';
import {flushOutbox} from '../adapters/d1/outbox.ts';
import type {Env} from '../config/env.ts';
import type {ChatService} from '../application/plan-command.ts';
import type {Clock} from '../ports/work-store.ts';

export {flushOutbox};

export function createWorker(chat?:ChatService,transport:typeof fetch=fetch,clock:Clock={now:Date.now},cardsEnabled=false){
 const flushCards=async(env:Env)=>{
  if(cardsEnabled&&env.DELIVERY_MODE==='outbox')await new D1UiStore(env.DB).flush(env.TELEGRAM_USER_ID,env.TELEGRAM_BOT_TOKEN!,transport,()=>clock.now());
 };
 const chatFor=(env:Env)=>createRuntimeChat(env,chat,transport,clock,cardsEnabled);
 return {
  async scheduled(_event:unknown,env:Env){
   await runScheduled(env,{cardsEnabled,transport,clock,chat:chatFor(env),flushCards:()=>flushCards(env)});
  },
  async fetch(request:Request,env:Env):Promise<Response>{
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
   return handleTelegramWebhook(request,env,{cardsEnabled,transport,clock,chat:chatFor(env),flushCards:()=>flushCards(env)});
  }
 };
}

const cardWorker=createWorker(undefined,fetch,{now:Date.now},true);
const previewWorker=createWorker();
export default {
 fetch(request:Request,env:Env){return (env.DELIVERY_MODE==='outbox'?cardWorker:previewWorker).fetch(request,env);},
 scheduled(event:unknown,env:Env){return (env.DELIVERY_MODE==='outbox'?cardWorker:previewWorker).scheduled(event,env);}
};
