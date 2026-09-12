import type {ChatService} from './plan-command.ts';
import type {ConversationIntent} from '../domain/conversation.ts';
import {conversationDeadline,directRequest,unsupportedSuccessClaim} from '../domain/conversation.ts';
import {buildContext} from './context-builder.ts';
import {dayStart} from '../domain/session.ts';
import {toolResponse,type ModelContent,type ModelStep,type ToolCall} from '../ai/contracts.ts';
import {isReadTool} from '../ai/policy.ts';
import type {ToolOutcome} from './tool-executor.ts';

export type ToolTurnPorts={
 // Caller journals each model step and tool outcome; this loop never retries implicitly.
 model:(step:number,contents:ModelContent[],allowTools:boolean)=>Promise<ModelStep>;
 execute:(step:number,call:ToolCall)=>Promise<ToolOutcome>;
 commit:(step:number,call:ToolCall,outcome:ToolOutcome)=>Promise<Record<string,unknown>>;
};
export async function runToolTurn(initial:ModelContent[],ports:ToolTurnPorts):Promise<string>{
 const contents=[...initial];let reads=0,wrote=false,fallback='Hội thoại đang gián đoạn, tớ chưa thực hiện thay đổi nào.';
 for(let step=0;step<3;step++){
  let response:ModelStep;
  try{response=await ports.model(step,contents,!wrote);}catch{return fallback;}
  if(!response.calls.length)return response.text;
  const writes=response.calls.filter(call=>!isReadTool(call.name));
  // Reject the whole group before any write; never silently execute only the first mutation.
  if(writes.length>1||(writes.length&&response.calls.length>1)||wrote)return wrote?fallback:'Cậu đang yêu cầu nhiều thay đổi. Mình xử lý từng việc để tránh làm nhầm nhé.';
  if(reads+response.calls.filter(call=>isReadTool(call.name)).length>2)return 'Tớ cần thu hẹp việc đang tìm. Cậu nói rõ tên hoặc khoảng ngày giúp tớ nhé.';
  contents.push(response.content);
  const results:Record<string,unknown>[]=[];
  for(const call of response.calls){
   if(isReadTool(call.name))reads++;
   let outcome:ToolOutcome;
   try{outcome=await ports.execute(step,call);}catch{
    results.push(toolResponse(call,{status:'rejected',reason:'invalid_or_unavailable_tool'}));continue;
   }
   if(isReadTool(call.name)){results.push(toolResponse(call,outcome.result));continue;}
   if(outcome.changes.length){
    let committed:Record<string,unknown>;
    try{committed=await ports.commit(step,call,outcome);}catch{
     return 'Tớ chưa xác nhận được kết quả lưu. Kiểm tra trạng thái trước khi thực hiện lại nhé.';
    }
    if(committed.status!=='applied')return 'Thay đổi chưa được xác nhận là đã lưu.';
    wrote=true;fallback=outcome.fallback;results.push(toolResponse(call,committed));
   }else{
    fallback=outcome.fallback;results.push(toolResponse(call,outcome.result));
    if(outcome.result.status==='needs_confirmation'){
     // Pending state must be persisted by the commit port before asking the user.
     try{await ports.commit(step,call,outcome);}catch{return 'Tớ chưa lưu được đề xuất để xác nhận. Chưa có thay đổi nào được thực hiện.';}
     return fallback;
    }
   }
  }
  contents.push({role:'user',parts:results});
 }
 return fallback;
}

type Infer=(owner:string,updateId:number,now:number,context:string,turns:{role:'user'|'model';text:string}[],resolved?:ConversationIntent)=>Promise<ConversationIntent>;
export function conversationChat(infer:Infer):ChatService{
 return async(owner,text,_tasks,input,store,now)=>{
  if(!input||!store||now===undefined)throw Error('MISSING_CONTEXT');
  const receivedAt=input.receivedAt??now;
  const pending=await store.conversationPending?.(owner,now);
  if(pending&&/^(thôi|hủy|không|bỏ đi)$/iu.test(text.trim()))return {view:{text:'Ừ, tớ hủy yêu cầu đang chờ nhé.',buttons:[]},changes:[{type:'conversation-pending',owner,pending:null}]};
  let continuation:ConversationIntent|undefined;
  let confirmedDuplicate=false;
  let confirmedScope=false;
  if(pending?.kind==='clarify'){
    const saved=JSON.parse(pending.draft) as {intent:ConversationIntent;reason?:string;title?:string};
    if(saved.reason==='completion-scope'){
      if(/^(xong )?(cả (bài|việc|task)|toàn bộ( (bài|việc|task))?)( rồi)?[.!\s]*$/iu.test(text.trim())){
        continuation={...saved.intent,evidence:text};confirmedScope=true;
      }else if(/^(chỉ )?(xong )?(buổi|phần|đoạn)( thôi)?[.!\s]*$/iu.test(text.trim()))return {
        view:{text:'Ừ, vậy tớ chưa đánh dấu cả việc là xong. Cậu nói rõ buổi nào cần kết thúc nhé.',buttons:[]},changes:[{type:'conversation-pending',owner,pending:null}]};
    }
    if(saved.reason==='existing-or-new'){
      if(/^(việc cũ|bài cũ|cập nhật việc cũ|đổi hạn việc cũ)[.!\s]*$/iu.test(text.trim())){
        continuation={...saved.intent,evidence:text};confirmedScope=true;
      }else if(/^(việc mới|bài mới|thêm mới|thêm việc mới)[.!\s]*$/iu.test(text.trim())){
        continuation={...saved.intent,kind:'capture',taskId:null,title:saved.title!,evidence:text};confirmedDuplicate=true;
      }
    }
  }
  if(pending?.kind==='confirm'&&/^(ừ|ừm|đồng ý|ok|oke|đúng|thêm đi|xác nhận|ừ[, ]+thêm đi)[.!\s]*$/iu.test(text.trim())){
    const saved=JSON.parse(pending.draft) as {intent:ConversationIntent;reason:string};
    if(saved.reason==='duplicate-title'){continuation=saved.intent;confirmedDuplicate=true;}
  }
  if(pending?.kind==='clarify'&&conversationDeadline(text,receivedAt)){
    const saved=JSON.parse(pending.draft) as {intent:ConversationIntent;source:string;taskVersion:number|null;reason?:string};
    if(!saved.reason&&['capture','deadline','remind'].includes(saved.intent.kind))continuation={...saved.intent,deadlineText:text,evidence:text};
  }
  const built=await buildContext(store,owner,text,receivedAt);
  const intent=await infer(owner,input.updateId,now,built.context,built.turns,continuation);
  if(intent.kind==='chat'||intent.kind==='clarify'){
    const reply=unsupportedSuccessClaim(intent.reply)?'Tớ chưa thực hiện thay đổi nào từ câu này. Cậu nói rõ việc muốn tớ làm nhé.':intent.reply;
    return pending?{view:{text:reply,buttons:[]},changes:[{type:'conversation-pending',owner,pending:null}]}:reply;
  }
  if(!continuation&&!directRequest(text,intent)){
    const focus=await store.focus(owner,now);
    const task=built.tasks.find(t=>t.id===intent.taskId);
    if(intent.kind==='complete'&&/^(tớ )?xong rồi[.!\s]*$/iu.test(text.trim())&&task&&focus===task.id&&task.status!=='completed')return {
      view:{text:`Cậu xong cả “${task.title}”, hay chỉ xong buổi/phần đang làm thôi?`,buttons:[]},changes:[{type:'conversation-pending',owner,pending:{id:`cp${input.updateId}`,kind:'clarify',expires:now+300000,
        draft:JSON.stringify({intent,reason:'completion-scope',taskVersion:task.version,receivedAt})}}]};
    if(intent.kind==='deadline'&&task&&intent.deadlineText&&text.includes(task.title)&&text.toLowerCase().includes(intent.deadlineText.toLowerCase())
      &&directRequest(text,{...intent,kind:'capture',title:task.title,taskId:null}))return {
      view:{text:`Đã có “${task.title}” trong danh sách. Cậu muốn cập nhật hạn việc cũ, hay thêm một việc mới cùng tên?`,buttons:[]},changes:[{type:'conversation-pending',owner,pending:{id:`cp${input.updateId}`,kind:'clarify',expires:now+300000,
        draft:JSON.stringify({intent,reason:'existing-or-new',title:task.title,taskVersion:task.version,receivedAt})}}]};
    return 'Cậu muốn tớ ghi hoặc đổi việc này thật, hay mình đang bàn phương án thôi?';
  }
  if(intent.kind==='overview'){
    const sessions=await store.sessions(owner,dayStart(now),dayStart(now)+86400000);
    const tasks=(await store.tasks(owner,0)).filter(t=>t.status!=='completed');
    const lines=await Promise.all(sessions.slice(0,6).map(async s=>`${new Date(s.start_at+7*3600000).toISOString().slice(11,16)} · ${(await store.task(owner,s.task_id))?.title??'Công việc'} (${s.status==='completed'?'đã kết thúc':s.status==='running'?'đang làm':s.status==='skipped'?'đã bỏ':s.status==='paused'?'tạm dừng':'chưa kết thúc'})`));
    return {view:{text:lines.length?`Hôm nay cậu có:\n${lines.join('\n')}${sessions.length>6?'\nCòn các buổi khác trong lịch hôm nay.':''}`:tasks.length?`Hôm nay chưa có buổi nào được chốt. Cậu đang có các việc như: ${tasks.slice(0,3).map(t=>t.title).join(', ')}.`:'Chưa có việc hay buổi nào được lưu. Cậu cứ nói việc cần làm, tớ ghi giúp nhé.',
      buttons:tasks.length||sessions.length?[[{text:'Công việc',callback_data:'nav:tasks'},{text:'Hôm nay',callback_data:'nav:today'}]]:[]},changes:[{type:'cancel',owner},{type:'conversation-pending',owner,pending:null}]};
  }
  if(intent.kind==='rest'||intent.kind==='resume'){
    const preferences=await store.preferences(owner)??{owner,quiet_start:0,quiet_end:0,pause_until:0};
    return {view:{text:intent.kind==='rest'?'Ừ, tớ dừng nhắc đến hết hôm nay nhé.':'Tớ mở nhắc lại rồi nhé. Các nhắc đã hủy sẽ không gửi bù.',buttons:[]},
      changes:[{type:'preferences',preferences:{...preferences,pause_until:intent.kind==='rest'?dayStart(now)+86400000:0}},
      {type:'cancel',owner},{type:'conversation-pending',owner,pending:null}]};
  }
  if(!continuation&&intent.title&&!text.includes(intent.title))return 'Tên việc cậu muốn ghi chính xác là gì nhỉ?';
  if(!confirmedDuplicate&&!confirmedScope&&intent.deadlineText&&!text.toLowerCase().includes(intent.deadlineText.toLowerCase()))return 'Cậu nói lại hạn của việc này giúp tớ nhé, tớ chưa xác định chắc được.';
  const dateBase=confirmedDuplicate||confirmedScope?(JSON.parse(pending!.draft) as {receivedAt:number}).receivedAt:receivedAt;
  const deadline=intent.deadlineText?conversationDeadline(intent.deadlineText,dateBase):null;
  if(intent.deadlineText&&(!deadline||(intent.kind==='remind'&&deadline.precision!=='datetime')))return {view:{text:intent.kind==='remind'?'Cậu muốn nhắc ngày nào, mấy giờ? Gửi ngày/tháng/năm giờ:phút giúp tớ nhé.':'Hạn đó là ngày nào nhỉ? Cậu ghi ngày/tháng/năm giúp tớ để tránh hiểu nhầm nhé.',buttons:[]},changes:[{
    type:'conversation-pending',owner,pending:{id:`cp${input.updateId}`,kind:'clarify',expires:now+900000,
      draft:JSON.stringify({intent,source:text,taskVersion:intent.taskId?built.tasks.find(t=>t.id===intent.taskId)?.version??null:null})}
  }]};
  let expectedVersion:number|null=null;
  if(intent.kind==='capture'&&!confirmedDuplicate){
    const same=await store.sameTitleTasks?.(owner,intent.title!)??[];
    if(same.length)return {view:{text:`Đã có việc “${intent.title}” rồi. Cậu muốn thêm một việc khác cùng tên à?`,buttons:[]},changes:[{type:'conversation-pending',owner,pending:{
      id:`cp${input.updateId}`,kind:'confirm',expires:now+300000,draft:JSON.stringify({intent,receivedAt,reason:'duplicate-title'})
    }}]};
  }
  if(['deadline','remind','complete','reopen'].includes(intent.kind)){
   const task=built.tasks.find(t=>t.id===intent.taskId);
   if(!task)return 'Cậu đang muốn đổi hạn của việc nào?';
   // The model may only resolve by an explicit title or the server's current focus.
   const focus=await store.focus(owner,now);
   const same=await store.sameTitleTasks?.(owner,task.title)??[];
   if(same.length>1&&focus!==task.id)return 'Có nhiều việc cùng tên. Cậu nói rõ việc nào, hoặc mở chi tiết việc cần đổi giúp tớ nhé.';
   if(continuation){
    const saved=JSON.parse(pending!.draft) as {taskVersion:number|null};
    if(saved.taskVersion!==task.version)return 'Việc này vừa thay đổi. Cậu nói lại hạn mới muốn đặt nhé.';
   }else if(!text.toLowerCase().includes(task.title.toLowerCase())&&focus!==task.id)return 'Cậu đang nói đến việc nào nhỉ?';
   expectedVersion=task.version;
   if(intent.kind!=='reopen'&&task.status==='completed')return 'Việc này đã được đánh dấu xong rồi nhé.';
  }
  const taskId=intent.taskId??`ct${owner}_${input.updateId}`;
  const title=intent.title??built.tasks.find(t=>t.id===taskId)!.title;
  if(intent.kind==='complete'||intent.kind==='reopen'){
    if(intent.kind==='reopen'&&!await store.completionUndo?.(owner,taskId,expectedVersion!,now))return 'Không thể hoàn tác tự động: việc đã đổi hoặc quá 15 phút từ lúc đánh dấu xong. Tớ chưa thay đổi gì nhé.';
    return {view:{text:intent.kind==='complete'?`Xong “${title}” rồi nhé. Tớ đã dừng các nhắc và đóng buổi làm còn lại của việc này. Nếu nhầm, cậu có thể bảo hoàn tác việc trong 15 phút.`:`Tớ mở lại “${title}” rồi. Nhắc và buổi cũ không được khôi phục để tránh nhắc sai; cậu hẹn lại nếu cần nhé.`,buttons:[]},changes:[
      {type:'conversation-completion',owner,taskId,expectedVersion:expectedVersion!,operation:intent.kind,updateId:input.updateId,now,...(continuation?{pendingId:pending!.id}:{})},
      {type:'focus',owner,taskId,expires:now+900000},{type:'cancel',owner},{type:'conversation-pending',owner,pending:null}
    ]};
  }
  if(intent.kind==='remind'){
    const due=Date.parse(deadline!.value);
    const preferences=await store.preferences(owner);
    if(due<=now)return 'Giờ đó đã qua rồi. Cậu chọn giờ mới giúp tớ nhé.';
    if((preferences?.pause_until??0)>due)return 'Cậu đang dừng nhắc trong khoảng đó. Mở lại nhắc hoặc chọn giờ khác nhé.';
    return {view:{text:`Tớ hẹn nhắc “${title}” lúc ${deadline!.value.slice(11,16)} ngày ${deadline!.value.slice(0,10).split('-').reverse().join('/')} nhé. Hẹn nhắc riêng của việc này trước đó, nếu có, được thay bằng giờ mới.`,buttons:[]},changes:[
      {type:'conversation-appointment',owner,id:`ap${owner}_${input.updateId}`,taskId,expectedVersion:expectedVersion!,due,updateId:input.updateId,created:now,...(continuation?{pendingId:pending!.id}:{})},
      {type:'focus',owner,taskId,expires:now+900000},{type:'cancel',owner},{type:'conversation-pending',owner,pending:null}
    ]};
  }
  return {view:{text:`${intent.kind==='capture'?'Tớ ghi':'Tớ đổi hạn cho'} “${title}” rồi${deadline?`, hạn ${deadline.precision==='date'?deadline.value.split('-').reverse().join('/'):deadline.value.slice(0,16).replace('T',' ')}`:''} nhé.`,buttons:[]},
   changes:[{type:'conversation-task',owner,updateId:input.updateId,taskId,title:intent.title,deadline,expectedVersion,created:now,...(continuation?{pendingId:pending!.id}:{})},
    {type:'focus',owner,taskId,expires:now+900000},{type:'cancel',owner},{type:'conversation-pending',owner,pending:null}]};
 };
}
