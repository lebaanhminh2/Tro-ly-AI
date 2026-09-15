import {boardCommand} from '../application/progress-renderer.ts';
import {SCHEDULE_PROMPT} from '../application/schedule-command.ts';
import {reserveAi} from '../adapters/d1/memory.ts';
import {Gemini} from '../ai/gemini.ts';
import {D1WorkStore} from '../adapters/d1/work-store.ts';
import {ConversationStore} from '../adapters/d1/conversation-store.ts';
import {TOOL_PERSONA} from '../ai/persona.ts';
import {buildContext} from '../application/context-builder.ts';
import type {Env} from '../config/env.ts';
import type {ChatService} from '../application/plan-command.ts';
import type {Clock} from '../ports/work-store.ts';

export function createRuntimeChat(env:Env,chat:ChatService|undefined,transport:typeof fetch,clock:Clock,cardsEnabled:boolean):ChatService|undefined{
 if(chat)return chat;
 if(env.AI_MODE!=='on')return undefined;
 const service:ChatService=async()=>{throw Error('MISSING_OWNER_LEASE');};
 service.forLease=lease=>async(owner,text,_tasks,input,reader)=>{
  if(!reader||owner!==lease.owner)throw Error('INVALID_CHAT_SCOPE');
  lease.pendingWrites=[];
  const store=new D1WorkStore(env.DB,cardsEnabled);
  const confirmation=input?.callback?/^tool-confirm:([yn]):(.+)$/.exec(input.callback):null;
  const [context,pending]=await Promise.all([
   buildContext(reader,owner,text||'Xác nhận bằng nút',lease.input.receivedAt??clock.now()),
   new ConversationStore(env.DB).pending(owner,clock.now())
  ]);
  if(confirmation&&(!pending||pending.id!==confirmation[2]))return 'Đề xuất này đã cũ hoặc đã được xử lý.';
  const scheduling=/^\/lich(?:\s|$|@)/i.test(lease.input.text??'')||(env.ASSETS?await reader.isMorningReply?.(owner,input?.replyToMessageId,clock.now())??false:false);
  const action=/^\/\s+\S/.test(lease.input.text??'')||/^\/ngu(?:@[A-Za-z0-9_]+)?\s+\S/i.test(lease.input.text??'')||!!confirmation;
  const mode=scheduling?'schedule':action?'action':'chat';
  const journal=new ConversationStore(env.DB,statements=>lease.pendingWrites!.push(...statements),mode);
  const hierarchy=env.ASSETS?await store.hierarchy(owner):[];
  const requestedCodes=new Set([...text.matchAll(/#(\d+)(?:\.(\d+))?/g)].map(match=>Number(match[1])));
  const relevantHierarchy=hierarchy.filter(task=>requestedCodes.has(task.public_code)||context.tasks.some(candidate=>candidate.id===task.id));
  const schedule=env.ASSETS?await reader.scheduleContext?.(owner,clock.now())??null:null;
  const sleepPhase=schedule&&Number(schedule.target_sleep)<=clock.now()? '\nĐã đến giờ nghỉ mục tiêu. Hãy hướng cuộc trò chuyện về kết thúc ngày và đi ngủ, không rủ làm thêm task. Nhắc /ngu nhẹ nhàng, không gây tội lỗi.':'';
  const initial=[{role:'user' as const,parts:[{text:JSON.stringify({contextData:{...JSON.parse(context.context),schedule,task_codes:relevantHierarchy.map(task=>({id:task.id,code:'#'+task.public_code,title:task.title,version:task.version,status:task.status,steps:task.steps.map(step=>({id:step.id,code:'#'+task.public_code+'.'+step.step_code,title:step.title,status:step.status,version:step.version}))}))},pending,replyToMessageId:input?.replyToMessageId??null})}]},
   ...context.turns.map(turn=>({role:turn.role,parts:[{text:turn.text}]}))];
  const snapshotReader=Object.create(reader) as typeof reader;
  const summaryRequest=JSON.parse(context.context).summary_request as {source_turns:{id:number;user:string;assistant:string}[]}|null;
  snapshotReader.unsummarized=async()=>summaryRequest?summaryRequest.source_turns.map(turn=>({owner,command_id:turn.id,user_text:turn.user,assistant_text:turn.assistant,created:0,expires:Number.MAX_SAFE_INTEGER})):[];
  const reply=await journal.turn(lease,initial,snapshotReader,(changes,now)=>store.mutationStatements(owner,changes,now,true),async(contents,allowTools,step)=>{
   if(confirmation){
    if(step>0)throw Error('USE_COMMITTED_FALLBACK');
    const call={name:'resolve_pending' as const,args:{pending_id:confirmation[2],accept:confirmation[1]==='y'}};
    return {content:{role:'model' as const,parts:[{functionCall:call}]},calls:[call],text:''};
   }
   if(!await reader.aiEnabled(owner))throw Error('AI_DISABLED');
   if(env.AI_TRIAL_ENDS_AT&&(!Number.isFinite(Date.parse(env.AI_TRIAL_ENDS_AT))||clock.now()>=Date.parse(env.AI_TRIAL_ENDS_AT)))throw Error('AI_TRIAL_ENDED');
   if(!await reserveAi(env.DB,'runtime:gemini',`${owner}:${lease.input.updateId}:tool:${step}`,clock.now(),env.AI_DAILY_LIMIT===undefined?null:Number(env.AI_DAILY_LIMIT)))throw Error('AI_QUOTA');
   const client=new Gemini({apiKey:env.GEMINI_API_KEY!,model:env.GEMINI_MODEL!,transport:(url,options)=>transport(url,{...options,redirect:'manual'}),timeoutMs:8000});
   return (await client.generateTools(contents,scheduling?SCHEDULE_PROMPT:TOOL_PERSONA+sleepPhase+(action?'\nYêu cầu hành động: gọi tool thật; thiếu thông tin dùng ask_user. Không respond báo đã làm khi chưa có action.':'\nChỉ trò chuyện hoặc đọc dữ liệu. Không ghi task/lịch. Muốn thay đổi thì nhắc user gửi / nội dung.'),allowTools,scheduling?['set_availability','ask_user']:action?undefined:['respond','find_tasks','get_agenda','show_work','ask_user'])).output;
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
