import {deadlineValue} from './time.ts';
import {dayStart} from './session.ts';

export type Deadline = {value:string;precision:'date'|'datetime'};
export type ConversationIntent = {
 kind:'chat'|'clarify'|'capture'|'deadline'|'overview'|'rest'|'resume'|'remind'|'complete'|'reopen';
 reply:string;
 title:string|null;
 taskId:string|null;
 deadlineText:string|null;
 evidence:string|null;
};
export const CONVERSATION_SCHEMA = {
 type:'object',additionalProperties:false,
 required:['kind','reply','title','taskId','deadlineText','evidence'],
 properties:{kind:{type:'string',enum:['chat','clarify','capture','deadline','overview','rest','resume','remind','complete','reopen']},reply:{type:'string'},
  title:{type:['string','null']},taskId:{type:['string','null']},deadlineText:{type:['string','null']},evidence:{type:['string','null']}}
};

export function parseConversation(raw:string):ConversationIntent{
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_INTENT');
 const v=value as Record<string,unknown>;
 const keys=['kind','reply','title','taskId','deadlineText','evidence'];
 if(Object.keys(v).length!==keys.length||keys.some(k=>!(k in v))||!['chat','clarify','capture','deadline','overview','rest','resume','remind','complete','reopen'].includes(String(v.kind)))throw Error('INVALID_INTENT');
 if(typeof v.reply!=='string'||!v.reply.trim()||v.reply.length>2000)throw Error('INVALID_REPLY');
 for(const field of ['title','taskId','deadlineText','evidence'])if(v[field]!==null&&(typeof v[field]!=='string'||!v[field].trim()||v[field].length>1000))throw Error('INVALID_INTENT_FIELD');
 if(v.kind==='capture'&&(typeof v.title!=='string'||v.title.length>160||v.taskId!==null))throw Error('INVALID_CAPTURE');
 if(['deadline','remind'].includes(String(v.kind))&&(typeof v.taskId!=='string'||v.title!==null||typeof v.deadlineText!=='string'))throw Error('INVALID_DEADLINE_INTENT');
 if(['chat','clarify'].includes(String(v.kind))&&['title','taskId','deadlineText','evidence'].some(k=>v[k]!==null))throw Error('UNEXPECTED_ACTION_FIELDS');
 if(['capture','deadline','remind'].includes(String(v.kind))&&typeof v.evidence!=='string')throw Error('MISSING_EVIDENCE');
 if(['complete','reopen'].includes(String(v.kind))&&(typeof v.taskId!=='string'||v.title!==null||v.deadlineText!==null||typeof v.evidence!=='string'))throw Error('INVALID_COMPLETION');
 if(['overview','rest','resume'].includes(String(v.kind))&&(['title','taskId','deadlineText'].some(k=>v[k]!==null)||typeof v.evidence!=='string'))throw Error('INVALID_CONTROL_INTENT');
 return v as ConversationIntent;
}

// Interpret source text, not a timestamp invented by the model. Unknown formats ask the user.
export function conversationDeadline(source:string,now:number):Deadline|null{
 const raw=source.trim().toLowerCase();
 const relative=/^(hôm nay|ngày mai|mai|ngày kia)(?:\s+(\d{1,2})(?::(\d{2})|h(?:\s*(\d{2}))?))?$/.exec(raw);
 if(relative){
  const offset=relative[1]==='hôm nay'?0:relative[1]==='ngày kia'?2:1;
  const date=new Date(dayStart(now)+offset*86400000+7*3600000).toISOString().slice(0,10);
  if(relative[2]===undefined)return {value:date,precision:'date'};
  const hour=Number(relative[2]),minute=Number(relative[3]??relative[4]??0);
  if(hour>23||minute>59)return null;
  const value=`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+07:00`;
  return Date.parse(value)>now?{value,precision:'datetime'}:null;
 }
 const exact=deadlineValue(source);
 if(exact)return Date.parse(exact)>now?{value:exact,precision:'datetime'}:null;
 const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
 if(m){
  const validated=deadlineValue(`${raw} 00:00`);
  if(!validated)return null;
  const value=validated.slice(0,10);
  return value>=new Date(now+7*3600000).toISOString().slice(0,10)?{value,precision:'date'}:null;
 }
 return null;
}

export function directRequest(text:string,intent:ConversationIntent):boolean{
 if(!intent.evidence||!text.includes(intent.evidence))return false;
 // Conservative first slice. Quoted examples, hypothetical or tentative requests never auto-write.
 if(/[“”"`]/u.test(text)||/\b(ví dụ|giả sử|nếu|hình như|có lẽ|chắc là|đừng|không thêm|không đổi)\b/iu.test(text))return false;
 const lower=text.toLowerCase();
 if(['ví dụ','giả sử','hình như','có lẽ','đừng','không thêm','không đổi','không cần','chưa muốn','chưa chắc','nếu ','chắc là'].some(s=>lower.includes(s)))return false;
 if(intent.kind==='rest')return /(?:dừng|tắt|ngừng)\s+nhắc|(?:nghỉ|đừng nhắc).*hôm nay/iu.test(text);
 if(intent.kind==='resume')return /(?:mở|bật)\s+(?:lại\s+)?nhắc|nhắc\s+lại\s+(?:đi|nhé)/iu.test(text);
 if(intent.kind==='overview')return /(?:hôm nay|công việc|lịch|task|việc).*(?:gì|nào|còn)|(?:xem|cho.*biết|tổng quan).*(?:việc|lịch|task)/iu.test(text);
 if(intent.kind==='remind')return /nhắc|hẹn/iu.test(text);
 if(intent.kind==='complete')return /(?:xong|hoàn thành).*(?:việc|task|bài)|(?:việc|task|bài).*?(?:xong|hoàn thành)/iu.test(text)&&!/(?:(?:chưa|không).*?(?:xong|hoàn thành)|xong\s+(?:(?:một|1)\s+)?(?:buổi|phần|đoạn))/iu.test(text);
 if(intent.kind==='reopen')return /(?:mở lại|hoàn tác).*(?:việc|task|bài)/iu.test(text);
 return intent.kind==='capture'
  ? /(?:tớ|tôi|mình|tao|em|anh)\s+(?:có|còn|phải)|(?:thêm|ghi|lưu)(?:\s+lại)?\s+(?:việc|task|bài)|(?:có|còn)\s+(?:task|bài|việc)/iu.test(text)
  : /(?:đổi|dời|sửa|cập nhật|đặt)\s+(?:lại\s+)?(?:hạn|deadline|dl)/iu.test(text);
}

export type ConversationMutation = {
 type:'conversation-task'; owner:string; updateId:number; taskId:string; title:string|null;created:number;
 deadline:Deadline|null; expectedVersion:number|null;
 pendingId?:string;
};
export type PendingConversation = {id:string;kind:'clarify'|'confirm';draft:string;expires:number};
export type ConversationPendingChange={type:'conversation-pending';owner:string;pending:PendingConversation|null};
export type AppointmentChange={type:'conversation-appointment';owner:string;id:string;taskId:string;expectedVersion:number;due:number;updateId:number;created:number;pendingId?:string};
export type CompletionChange={type:'conversation-completion';owner:string;taskId:string;expectedVersion:number;operation:'complete'|'reopen';updateId:number;now:number};
