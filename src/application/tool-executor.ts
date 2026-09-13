import type {ToolCall} from '../ai/contracts.ts';
import {isReadTool,validateTool} from '../ai/policy.ts';
import type {WorkReader} from '../ports/work-store.ts';
import type {Change} from '../domain/work.ts';
import {canAct,dayStart} from '../domain/session.ts';

export type ToolOutcome={result:Record<string,unknown>;changes:Change[];fallback:string};
export async function executeTool(call:ToolCall,store:WorkReader,owner:string,updateId:number,now:number,confirmed=false,actionIndex?:number):Promise<ToolOutcome>{
 validateTool(call,now);
 const a=call.args;
 if(call.name==='show_work')throw Error('VIEW_IS_NOT_A_MUTATION');
 if(call.name==='record_progress'){
  const task=await store.task(owner,String(a.task_id));if(!task||task.status==='completed'||task.version!==a.expected_version)throw Error('TASK_NOT_AVAILABLE');
  return {result:{status:'planned'},fallback:'Thêm một bước rồi này, giỏi quá :>',changes:[{type:'progress-record',owner,id:`progress_${owner}_${updateId}_${actionIndex??0}`,taskId:task.id,content:String(a.content),created:now,updateId}]};
 }
 if(call.name==='respond')throw Error('REPLY_IS_NOT_A_MUTATION');
 const suffix=actionIndex===undefined?'':`_${actionIndex}`;
 if(call.name==='update_event'){
  const event=await store.event?.(owner,String(a.event_id));
  if(!event||event.version!==a.expected_version)throw Error('EVENT_NOT_FOUND_OR_CHANGED');
  return {result:{status:'planned'},fallback:'Tớ đã cập nhật cuộc hẹn và hủy nhắc cũ của cuộc hẹn đó.',changes:[{type:'event-update',owner,id:event.id,expectedVersion:event.version,cancelled:Boolean(a.cancelled),start:Date.parse(String(a.start)),end:a.end===null?null:Date.parse(String(a.end))}]};
 }
 if(call.name==='reschedule_reminder'){
  const reminder=(await store.appointmentContext?.(owner,now)??[]).find(r=>r.id===a.reminder_id);
  if(!reminder||reminder.version!==a.expected_version)throw Error('REMINDER_NOT_FOUND_OR_CHANGED');
  const due=Date.parse(String(a.at));if(((await store.preferences(owner))?.pause_until??0)>due)throw Error('REMINDERS_PAUSED');
  const cancel:Change={type:'reminder-action',owner,id:String(a.reminder_id),expectedVersion:Number(a.expected_version),action:'cancel'};
  if(reminder.task_id){
   const task=await store.task(owner,String(reminder.task_id));if(!task||task.status==='completed')throw Error('TASK_NOT_AVAILABLE');
   return {result:{status:'planned'},fallback:'Tớ đã đổi giờ nhắc.',changes:[cancel,{type:'conversation-appointment',owner,id:`toolap${owner}_${updateId}${suffix}`,taskId:task.id,expectedVersion:task.version,due,updateId,created:now}]};
  }
  return {result:{status:'planned'},fallback:'Tớ đã đổi giờ nhắc.',changes:[cancel,{type:'standalone-reminder',owner,id:`toolap${owner}_${updateId}${suffix}`,subject:String(reminder.subject),message:String(a.message),due,created:now,...(reminder.event_id?{eventId:String(reminder.event_id)}:{})}]};
 }
 if(call.name==='acknowledge_reminder'||call.name==='cancel_reminder'){
  const reminder=(await store.appointmentContext?.(owner,now)??[]).find(r=>r.id===a.reminder_id);
  if(!reminder||reminder.version!==a.expected_version)throw Error('REMINDER_NOT_FOUND_OR_CHANGED');
  return {result:{status:'planned'},fallback:call.name==='cancel_reminder'?'Tớ đã hủy nhắc này.':'Ừ, tớ không nhắc thêm việc này nữa nhé.',changes:[{type:'reminder-action',owner,id:String(a.reminder_id),expectedVersion:Number(a.expected_version),action:call.name==='cancel_reminder'?'cancel':'acknowledge'}]};
 }
 if(call.name==='session_action'){
  const session=await store.session(owner,String(a.session_id));
  if(!session||session.version!==a.expected_version||!canAct(session,String(a.action),now))throw Error('SESSION_NOT_AVAILABLE');
  return {result:{status:'planned'},fallback:'Tớ đã cập nhật buổi làm; chưa đánh dấu xong cả task.',changes:[{type:'session-action',session,action:a.action as 'start'|'pause'|'finish'|'skip'|'snooze',now}]};
 }
 if(call.name==='plan_work'){
  const task=await store.task(owner,String(a.task_id));
  if(!task||task.version!==a.expected_version||task.status==='completed')throw Error('TASK_NOT_AVAILABLE');
  const start=Date.parse(String(a.at)),minutes=Number(a.minutes),end=start+minutes*60000;
  const prefs=await store.preferences(owner);if((prefs?.pause_until??0)>start)throw Error('REMINDERS_PAUSED');
  const [events,blocks,reminders]=await Promise.all([store.events?.(owner,start-86400000,end)??[],store.sessions(owner,start-86400000,end),store.appointmentContext?.(owner,now)??[]]);
  if(events.some(e=>e.start_at<end&&(e.end_at??e.start_at+3600000)>start)||blocks.some(b=>['planned','running','paused'].includes(b.status)&&b.start_at<end&&b.start_at+b.minutes*60000>start))throw Error('WORK_BLOCK_CONFLICT');
  if(blocks.some(b=>b.task_id===task.id&&['planned','running','paused'].includes(b.status))||reminders.some(r=>r.task_id===task.id&&!r.responded))throw Error('EXISTING_TASK_CYCLE');
  const session:import('../domain/session.ts').Session={id:`work_${owner}_${updateId}${suffix}`,owner,task_id:task.id,start_at:start,minutes,status:'draft',version:1,generation:1,expires:now+900000,active_since:null,spent_ms:0};
  return {result:{status:'planned',task_id:task.id,at:a.at,estimated_minutes:minutes},fallback:`Tớ đã xếp một buổi ${minutes} phút cho “${task.title}”.`,changes:[{type:'session-create',session},{type:'session-action',session,action:'confirm',now}]};
 }
 if(call.name==='create_event'){
  return {result:{status:'planned',title:a.title,start:a.start},fallback:`Tớ đã lưu lịch “${a.title}”.`,changes:[{type:'event-create',event:{id:`event_${owner}_${updateId}${suffix}`,owner,title:String(a.title),start_at:Date.parse(String(a.start)),end_at:a.end===null?null:Date.parse(String(a.end)),status:'scheduled',version:1},reminderAt:a.remind_at===null?null:Date.parse(String(a.remind_at)),reminderMessage:String(a.message)}]};
 }
 if(call.name==='create_reminder'){
  const due=Date.parse(String(a.at)),prefs=await store.preferences(owner);
  if((prefs?.pause_until??0)>due)throw Error('REMINDERS_PAUSED');
  return {result:{status:'planned',subject:a.subject,at:a.at},fallback:`Tớ đã đặt nhắc “${a.subject}”.`,changes:[{type:'standalone-reminder',owner,id:`toolap${owner}_${updateId}${suffix}`,subject:String(a.subject),message:String(a.message),due,created:now}]};
 }
 if(call.name==='save_clarification'){
  if(a.task_id!==null&&!await store.task(owner,String(a.task_id)))throw Error('TASK_NOT_FOUND');
  return {result:{status:'planned'},fallback:String(a.question),changes:[{type:'clarification-create',clarification:{
   id:`clarify_${owner}_${updateId}${suffix}`,owner,subject:String(a.subject),question:String(a.question),task_id:a.task_id as string|null,status:'waiting',created:now,expires:now+86400000
  }}]};
 }
 if(call.name==='close_clarification'){
  if(!(await store.clarifications?.(owner,now)??[]).some(p=>p.id===a.pending_id))throw Error('PENDING_NOT_FOUND');
  return {result:{status:'planned'},fallback:'Ừ, phần đang hỏi đã được xử lý nhé.',changes:[{type:'clarification-close',owner,id:String(a.pending_id),status:a.cancelled?'cancelled':'applied',now}]};
 }
 if(call.name==='update_summary'){
  const previous=await store.summary?.(owner);
  const history=await store.unsummarized?.(owner,now,previous?.covered_through??-1)??await store.history(owner,now);
  if((previous?.version??0)!==a.expected_version||!history.some(h=>h.command_id===a.through)||Number(a.through)<=Number(previous?.covered_through??-1))throw Error('INVALID_SUMMARY_SOURCE');
  return {result:{status:'planned'},fallback:'Tớ vẫn đang theo mạch câu chuyện nhé.',changes:[{type:'summary-update',owner,content:String(a.content),through:Number(a.through),expectedVersion:Number(a.expected_version),now}]};
 }
 if(isReadTool(call.name)){
  if(call.name==='find_tasks'){
   if(!store.findTasks)throw Error('MISSING_TOOL_READER');
   return {result:await store.findTasks(owner,String(a.query),a.status as 'active'|'completed'|'all',Number(a.cursor)),changes:[],fallback:'Tớ đã đọc danh sách việc.'};
  }
  if(!store.agenda)throw Error('MISSING_TOOL_READER');
  return {result:await store.agenda(owner,Date.parse(String(a.from)),Date.parse(String(a.to)),Number(a.cursor)),changes:[],fallback:'Tớ đã đọc lịch nội bộ.'};
 }
 if(call.name==='create_task'){
  const same=await store.sameTitleTasks?.(owner,String(a.title))??[];
  if(same.length&&!confirmed)return {result:{status:'needs_confirmation',reason:'existing_title',matches:same.map(t=>({id:t.id,title:t.title,version:t.version}))},changes:[],fallback:`Đã có “${a.title}”. Cậu xác nhận thêm một việc mới cùng tên nhé?`};
  const id=`tool${owner}_${updateId}${suffix}`;
  return {result:{status:'planned',task_id:id,title:a.title,deadline:a.deadline},fallback:`Tớ đã thêm “${a.title}”.`,changes:[{
   type:'conversation-task',owner,updateId,taskId:id,title:String(a.title),created:now,deadline:a.deadline as import('../domain/conversation.ts').Deadline|null,expectedVersion:null
  }]};
 }
 if(call.name==='set_reminder_pause'){
  const preferences=await store.preferences(owner)??{owner,quiet_start:0,quiet_end:0,pause_until:0};
  return {result:{status:'planned',until:a.until},fallback:a.until===null?'Tớ đã mở lại nhắc.':'Tớ đã tạm dừng nhắc theo giờ cậu chọn.',changes:[{type:'preferences',preferences:{...preferences,pause_until:a.until===null?0:Date.parse(String(a.until))}}]};
 }
 if(call.name==='remember_preference')return {result:{status:'planned',content:a.content,lifetime:a.lifetime},fallback:'Tớ đã ghi nhớ theo yêu cầu của cậu.',changes:[{
  type:'remember',memory:{id:`toolmem${owner}_${updateId}${suffix}`,owner,content:String(a.content),kind:a.lifetime==='today'?'temporary':'preference',source:`user-tool:${updateId}`,created:now,expires:a.lifetime==='today'?dayStart(now)+86400000:null}
 }]};
 if(call.name==='resolve_pending')throw Error('PENDING_RESOLUTION_REQUIRES_JOURNAL');
 const task=await store.task(owner,String(a.task_id));
 if(!task)return {result:{status:'rejected',reason:'task_not_found'},changes:[],fallback:'Tớ chưa tìm thấy việc này.'};
 if(task.version!==a.expected_version)return {result:{status:'rejected',reason:'stale_version',task},changes:[],fallback:'Việc vừa thay đổi. Mình kiểm tra lại trước nhé.'};
 if(call.name==='set_reminder'){
  if(task.status==='completed')return {result:{status:'rejected',reason:'task_completed'},changes:[],fallback:'Việc đã hoàn thành rồi, chưa đặt thêm nhắc.'};
  const due=Date.parse(String(a.at)),prefs=await store.preferences(owner);
  if((prefs?.pause_until??0)>due)return {result:{status:'needs_confirmation',reason:'reminders_paused'},changes:[],fallback:'Giờ đó đang nằm trong khoảng cậu dừng nhắc.'};
  return {result:{status:'planned',task_id:task.id,at:a.at,replacesPrevious:true},fallback:`Tớ đã hẹn nhắc “${task.title}” theo giờ cậu chọn.`,changes:[{type:'conversation-appointment',owner,id:`toolap${owner}_${updateId}${suffix}`,taskId:task.id,expectedVersion:task.version,due,updateId,created:now}]};
 }
 const patch=a.patch as Record<string,unknown>;
 const changes:Change[]=[];
 if('title' in patch&&Object.keys(patch).length===1){
  return {result:{status:'planned'},fallback:`Tớ đã đổi tên thành “${patch.title}”.`,changes:[{type:'task-rename',owner,taskId:task.id,expectedVersion:task.version,title:String(patch.title)}]};
 }
 if('status' in patch&&patch.status!==task.status){
  if(patch.status==='active'&&!await store.completionUndo?.(owner,task.id,task.version,now))return {result:{status:'rejected',reason:'undo_not_available'},changes:[],fallback:'Việc đã thay đổi hoặc hết thời hạn hoàn tác.'};
  if('deadline' in patch)return {result:{status:'needs_confirmation',reason:'split_status_and_deadline'},changes:[],fallback:'Mình đổi trạng thái hay hạn trước nhé?'};
  changes.push({type:'conversation-completion',owner,taskId:task.id,expectedVersion:task.version,operation:patch.status==='completed'?'complete':'reopen',updateId,now});
 }else if('deadline' in patch){
  changes.push({type:'conversation-task',owner,updateId,taskId:task.id,title:null,created:now,deadline:patch.deadline as import('../domain/conversation.ts').Deadline|null,expectedVersion:task.version});
 }
 if('title' in patch)changes.push({type:'task-rename',owner,taskId:task.id,expectedVersion:task.version+changes.length,title:String(patch.title)});
 return {result:{status:changes.length?'planned':'unchanged',task_id:task.id,patch},changes,fallback:changes.length?`Tớ đã cập nhật “${task.title}”.`:'Việc đã ở trạng thái đó rồi nhé.'};
}
