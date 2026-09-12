import type {ChatService} from './plan-command.ts';
import type {ConversationIntent} from '../domain/conversation.ts';
import {conversationDeadline,directRequest} from '../domain/conversation.ts';
import {buildContext} from './context-builder.ts';

type Infer=(owner:string,updateId:number,now:number,context:string,turns:{role:'user'|'model';text:string}[],resolved?:ConversationIntent)=>Promise<ConversationIntent>;
export function conversationChat(infer:Infer):ChatService{
 return async(owner,text,_tasks,input,store,now)=>{
  if(!input||!store||now===undefined)throw Error('MISSING_CONTEXT');
  const receivedAt=input.receivedAt??now;
  const pending=await store.conversationPending?.(owner,now);
  if(pending&&/^(thôi|hủy|không|bỏ đi)$/iu.test(text.trim()))return {view:{text:'Ừ, tớ hủy yêu cầu đang chờ nhé.',buttons:[]},changes:[{type:'conversation-pending',owner,pending:null}]};
  let continuation:ConversationIntent|undefined;
  if(pending?.kind==='clarify'&&conversationDeadline(text,receivedAt)){
    const saved=JSON.parse(pending.draft) as {intent:ConversationIntent;source:string;taskVersion:number|null};
    if(saved.intent.kind==='capture'||saved.intent.kind==='deadline')continuation={...saved.intent,deadlineText:text,evidence:text};
  }
  const built=await buildContext(store,owner,text,receivedAt);
  const intent=await infer(owner,input.updateId,now,built.context,built.turns,continuation);
  if(intent.kind==='chat'||intent.kind==='clarify')return pending?{view:{text:intent.reply,buttons:[]},changes:[{type:'conversation-pending',owner,pending:null}]}:intent.reply;
  if(!continuation&&!directRequest(text,intent))return 'Cậu muốn tớ ghi hoặc đổi việc này thật, hay mình đang bàn phương án thôi?';
  if(!continuation&&intent.title&&!text.includes(intent.title))return 'Tên việc cậu muốn ghi chính xác là gì nhỉ?';
  if(intent.deadlineText&&!text.toLowerCase().includes(intent.deadlineText.toLowerCase()))return 'Cậu nói lại hạn của việc này giúp tớ nhé, tớ chưa xác định chắc được.';
  const deadline=intent.deadlineText?conversationDeadline(intent.deadlineText,receivedAt):null;
  if(intent.deadlineText&&!deadline)return {view:{text:'Hạn đó là ngày nào nhỉ? Cậu ghi ngày/tháng/năm giúp tớ để tránh hiểu nhầm nhé.',buttons:[]},changes:[{
    type:'conversation-pending',owner,pending:{id:`cp${input.updateId}`,kind:'clarify',expires:now+900000,
      draft:JSON.stringify({intent,source:text,taskVersion:intent.taskId?built.tasks.find(t=>t.id===intent.taskId)?.version??null:null})}
  }]};
  let expectedVersion:number|null=null;
  if(intent.kind==='deadline'){
   const task=built.tasks.find(t=>t.id===intent.taskId);
   if(!task)return 'Cậu đang muốn đổi hạn của việc nào?';
   // The model may only resolve by an explicit title or the server's current focus.
   const focus=await store.focus(owner,now);
   if(continuation){
    const saved=JSON.parse(pending!.draft) as {taskVersion:number|null};
    if(saved.taskVersion!==task.version)return 'Việc này vừa thay đổi. Cậu nói lại hạn mới muốn đặt nhé.';
   }else if(!text.toLowerCase().includes(task.title.toLowerCase())&&focus!==task.id)return 'Cậu đang nói đến việc nào nhỉ?';
   expectedVersion=task.version;
  }
  const taskId=intent.taskId??`ct${owner}_${input.updateId}`;
  const title=intent.title??built.tasks.find(t=>t.id===taskId)!.title;
  return {view:{text:`${intent.kind==='capture'?'Tớ ghi':'Tớ đổi hạn cho'} “${title}” rồi${deadline?`, hạn ${deadline.precision==='date'?deadline.value.split('-').reverse().join('/'):deadline.value.slice(0,16).replace('T',' ')}`:''} nhé.`,buttons:[]},
   changes:[{type:'conversation-task',owner,updateId:input.updateId,taskId,title:intent.title,deadline,expectedVersion,created:now},
    {type:'focus',owner,taskId,expires:now+900000},{type:'cancel',owner},{type:'conversation-pending',owner,pending:null}]};
 };
}
