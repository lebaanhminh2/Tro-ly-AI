import {boardCommand} from '../application/progress-renderer.ts';
import {reserveAi} from '../adapters/d1/memory.ts';
import {Gemini} from '../ai/gemini.ts';
import {D1WorkStore} from '../adapters/d1/work-store.ts';
import {ConversationStore} from '../adapters/d1/conversation-store.ts';
import {TOOL_PERSONA} from '../ai/persona.ts';
import {buildContext} from '../application/context-builder.ts';
import {query} from '../adapters/d1/database.ts';
import {logChatTiming,measureChatPhase} from '../adapters/observability.ts';
import type {Env} from '../config/env.ts';
import type {ChatService} from '../application/plan-command.ts';
import type {Clock} from '../ports/work-store.ts';

export function createRuntimeChat(env:Env,chat:ChatService|undefined,transport:typeof fetch,clock:Clock,cardsEnabled:boolean):ChatService|undefined{
 if(chat)return chat;
 if(env.AI_MODE!=='on')return undefined;
 const service:ChatService=async()=>{throw Error('MISSING_OWNER_LEASE');};
 service.forLease=lease=>async(owner,text,_tasks,input,reader)=>{
  if(!reader||owner!==lease.owner)throw Error('INVALID_CHAT_SCOPE');
  const contextStarted=clock.now();
  const activeLease=await query(env.DB,'SELECT expires FROM owner_leases WHERE owner=? AND token=? AND expires>?',owner,lease.token,clock.now()).first<{expires:number}>();
  if(!activeLease)throw Error('INVALID_CHAT_SCOPE');
  // All model steps share the live lease's budget. Leave time for the journal,
  // command commit and delivery rather than giving every step another 20s.
  const modelDeadline=activeLease.expires-5000;
  lease.pendingWrites=[];
  const store=new D1WorkStore(env.DB,cardsEnabled);
  const confirmation=input?.callback?/^tool-confirm:([yn]):(.+)$/.exec(input.callback):null;
  const action=/^\/\s+\S/.test(lease.input.text??'')||/^\/ngu(?:@[A-Za-z0-9_]+)?\s+\S/i.test(lease.input.text??'')||!!confirmation;
  const mode=action?'action':'chat';
  const contextNow=clock.now();
  const [context,pending,hierarchy,schedule]=await Promise.all([
   measureChatPhase('context_data',()=>buildContext(reader,owner,text||'Xác nhận bằng nút',contextNow,{includeSummaryRequest:action}),()=>clock.now()),
   measureChatPhase('pending_read',()=>new ConversationStore(env.DB).pending(owner,contextNow),()=>clock.now()),
   env.ASSETS?measureChatPhase('task_hierarchy',()=>store.hierarchy(owner),()=>clock.now()):[],
   env.ASSETS?measureChatPhase('schedule_context',async()=>reader.scheduleContext?.(owner,contextNow)??null,()=>clock.now()):null
  ]);
  if(confirmation&&(!pending||pending.id!==confirmation[2]))return 'Đề xuất này đã cũ hoặc đã được xử lý.';
  const journal=new ConversationStore(env.DB,statements=>lease.pendingWrites!.push(...statements),mode);
  const requestedCodes=new Set([...text.matchAll(/#(\d+)(?:\.(\d+))?/g)].map(match=>Number(match[1])));
  const relevantHierarchy=hierarchy.filter(task=>requestedCodes.has(task.public_code)||context.tasks.some(candidate=>candidate.id===task.id));
  const contextData=JSON.parse(context.context),rest=contextData.notificationState;
  const sleepPhase=rest?.reason==='asleep'?
   '\nServer xác nhận cậu đã báo /ngu và đang ở trạng thái ngủ. Không tự nhắc đi ngủ, gửi /ngu, cảnh báo phạt vì chưa báo ngủ, thúc làm task hoặc bật tập trung. Trả lời nội dung cậu chủ động nhắn; chỉ giải thích giờ ngủ hay task khi cậu hỏi. Các lời nhắc cậu chủ động đặt vẫn gửi theo lịch; không nói mọi lời nhắc đã bị tắt. Trạng thái server hiện tại ưu tiên hơn lịch sử trò chuyện.':
   rest?.reason==='bedtime'?'\nĐã đến giờ nghỉ mục tiêu, chưa báo ngủ. Hãy hướng cuộc trò chuyện về kết thúc ngày và đi ngủ, không rủ làm thêm task. Nhắc /ngu nhẹ nhàng, không gây tội lỗi.':'';
  const initial=[{role:'user' as const,parts:[{text:JSON.stringify({contextData:{...contextData,schedule,task_codes:relevantHierarchy.map(task=>({id:task.id,code:'#'+task.public_code,title:task.title,version:task.version,status:task.status,steps:task.steps.map(step=>({id:step.id,code:'#'+task.public_code+'.'+step.step_code,title:step.title,status:step.status,version:step.version}))}))},pending,replyToMessageId:input?.replyToMessageId??null})}]},
   ...context.turns.map(turn=>({role:turn.role,parts:[{text:turn.text}]}))];
  const snapshotReader=Object.create(reader) as typeof reader;
  const summaryRequest=contextData.summary_request as {source_turns:{id:number;user:string;assistant:string}[]}|null|undefined;
  snapshotReader.unsummarized=async()=>summaryRequest?summaryRequest.source_turns.map(turn=>({owner,command_id:turn.id,user_text:turn.user,assistant_text:turn.assistant,created:0,expires:Number.MAX_SAFE_INTEGER})):[];
  logChatTiming('context_prepare',clock.now()-contextStarted,'ok',{inputChars:JSON.stringify(initial).length});
  const reply=await journal.turn(lease,initial,snapshotReader,(changes,now)=>store.mutationStatements(owner,changes,now,true),async(contents,allowTools,step)=>{
   if(confirmation){
    if(step>0)throw Error('USE_COMMITTED_FALLBACK');
    const call={name:'resolve_pending' as const,args:{pending_id:confirmation[2],accept:confirmation[1]==='y'}};
    return {content:{role:'model' as const,parts:[{functionCall:call}]},calls:[call],text:''};
   }
   const timeoutMs=await measureChatPhase('model_prepare',async()=>{
    if(!await reader.aiEnabled(owner))throw Error('AI_DISABLED');
    if(env.AI_TRIAL_ENDS_AT&&(!Number.isFinite(Date.parse(env.AI_TRIAL_ENDS_AT))||clock.now()>=Date.parse(env.AI_TRIAL_ENDS_AT)))throw Error('AI_TRIAL_ENDED');
    if(modelDeadline-clock.now()<1000)throw Error('PROVIDER_TIMEOUT');
    if(!await reserveAi(env.DB,'runtime:gemini',`${owner}:${lease.input.updateId}:tool:${step}`,clock.now(),env.AI_DAILY_LIMIT===undefined?null:Number(env.AI_DAILY_LIMIT)))throw Error('AI_QUOTA');
    const remaining=Math.min(20000,Math.floor(modelDeadline-clock.now()));
    if(remaining<1000)throw Error('PROVIDER_TIMEOUT');
    return remaining;
   },()=>clock.now(),{step});
   const client=new Gemini({apiKey:env.GEMINI_API_KEY!,model:env.GEMINI_MODEL!,transport:(url,options)=>transport(url,{...options,redirect:'manual'}),timeoutMs});
   const modelStarted=clock.now();
   let modelStatus:'ok'|'failed'='failed';
   let tokens:Awaited<ReturnType<Gemini['generateTools']>>['metrics']['tokens']={};
   try{
    const result=await client.generateTools(contents,TOOL_PERSONA+sleepPhase+(action?'\nYêu cầu hành động: gọi tool thật; thiếu thông tin dùng ask_user. Không respond báo đã làm khi chưa có action.':'\nChỉ trò chuyện hoặc đọc dữ liệu. Không ghi task/lịch. Muốn đổi giờ rảnh/bận thì hướng user mở phần “Thời gian hôm nay” trong ứng dụng.'),allowTools,action?undefined:['respond','find_tasks','get_agenda','show_work','ask_user']);
    tokens=result.metrics.tokens;
    if(clock.now()>=modelDeadline)throw Error('PROVIDER_TIMEOUT');
    modelStatus='ok';
    return result.output;
   }finally{
    logChatTiming('model',clock.now()-modelStarted,modelStatus,{step,...tokens});
   }
  },()=>clock.now());
  if(journal.requestedView){
   if(env.ASSETS)return 'Cậu mở nút “Mở ứng dụng” cạnh ô nhập tin nhắn nhé — lịch, lời nhắc và tu vi đều ở đó, không cần đọc danh sách dài trong chat.';
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
}
