import type {ToolCall} from '../ai/contracts.ts';
import {isReadTool,validateTool} from '../ai/policy.ts';
import type {WorkReader} from '../ports/work-store.ts';
import type {Change} from '../domain/work.ts';
import {dayStart} from '../domain/session.ts';

export type ToolOutcome={result:Record<string,unknown>;changes:Change[];fallback:string};
export async function executeTool(call:ToolCall,store:WorkReader,owner:string,updateId:number,now:number,confirmed=false):Promise<ToolOutcome>{
 validateTool(call,now);
 const a=call.args;
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
  const id=`tool${owner}_${updateId}`;
  return {result:{status:'planned',task_id:id,title:a.title,deadline:a.deadline},fallback:`Tớ đã thêm “${a.title}”.`,changes:[{
   type:'conversation-task',owner,updateId,taskId:id,title:String(a.title),created:now,deadline:a.deadline as import('../domain/conversation.ts').Deadline|null,expectedVersion:null
  }]};
 }
 if(call.name==='set_reminder_pause'){
  const preferences=await store.preferences(owner)??{owner,quiet_start:0,quiet_end:0,pause_until:0};
  return {result:{status:'planned',until:a.until},fallback:a.until===null?'Tớ đã mở lại nhắc.':'Tớ đã tạm dừng nhắc theo giờ cậu chọn.',changes:[{type:'preferences',preferences:{...preferences,pause_until:a.until===null?0:Date.parse(String(a.until))}}]};
 }
 if(call.name==='remember_preference')return {result:{status:'planned',content:a.content,lifetime:a.lifetime},fallback:'Tớ đã ghi nhớ theo yêu cầu của cậu.',changes:[{
  type:'remember',memory:{id:`toolmem${owner}_${updateId}`,owner,content:String(a.content),kind:a.lifetime==='today'?'temporary':'preference',source:`user-tool:${updateId}`,created:now,expires:a.lifetime==='today'?dayStart(now)+86400000:null}
 }]};
 if(call.name==='resolve_pending')throw Error('PENDING_RESOLUTION_REQUIRES_JOURNAL');
 const task=await store.task(owner,String(a.task_id));
 if(!task)return {result:{status:'rejected',reason:'task_not_found'},changes:[],fallback:'Tớ chưa tìm thấy việc này.'};
 if(task.version!==a.expected_version)return {result:{status:'rejected',reason:'stale_version',task},changes:[],fallback:'Việc vừa thay đổi. Mình kiểm tra lại trước nhé.'};
 if(call.name==='set_reminder'){
  if(task.status==='completed')return {result:{status:'rejected',reason:'task_completed'},changes:[],fallback:'Việc đã hoàn thành rồi, chưa đặt thêm nhắc.'};
  const due=Date.parse(String(a.at)),prefs=await store.preferences(owner);
  if((prefs?.pause_until??0)>due)return {result:{status:'needs_confirmation',reason:'reminders_paused'},changes:[],fallback:'Giờ đó đang nằm trong khoảng cậu dừng nhắc.'};
  return {result:{status:'planned',task_id:task.id,at:a.at,replacesPrevious:true},fallback:`Tớ đã hẹn nhắc “${task.title}” theo giờ cậu chọn.`,changes:[{type:'conversation-appointment',owner,id:`toolap${owner}_${updateId}`,taskId:task.id,expectedVersion:task.version,due,updateId,created:now}]};
 }
 const patch=a.patch as Record<string,unknown>;
 const changes:Change[]=[];
 if('status' in patch&&patch.status!==task.status){
  if(patch.status==='active'&&!await store.completionUndo?.(owner,task.id,task.version,now))return {result:{status:'rejected',reason:'undo_not_available'},changes:[],fallback:'Việc đã thay đổi hoặc hết thời hạn hoàn tác.'};
  if('deadline' in patch)return {result:{status:'needs_confirmation',reason:'split_status_and_deadline'},changes:[],fallback:'Mình đổi trạng thái hay hạn trước nhé?'};
  changes.push({type:'conversation-completion',owner,taskId:task.id,expectedVersion:task.version,operation:patch.status==='completed'?'complete':'reopen',updateId,now});
 }else if('deadline' in patch){
  changes.push({type:'conversation-task',owner,updateId,taskId:task.id,title:null,created:now,deadline:patch.deadline as import('../domain/conversation.ts').Deadline|null,expectedVersion:task.version});
 }
 return {result:{status:changes.length?'planned':'unchanged',task_id:task.id,patch},changes,fallback:changes.length?`Tớ đã cập nhật “${task.title}”.`:'Việc đã ở trạng thái đó rồi nhé.'};
}
