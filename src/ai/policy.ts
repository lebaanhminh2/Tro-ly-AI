import type {ToolCall,ToolName} from './contracts.ts';

export function isReadTool(name:ToolName){return name==='find_tasks'||name==='get_agenda';}
function fields(args:Record<string,unknown>,required:string[],optional:string[]=[]){
 if(required.some(k=>!(k in args))||Object.keys(args).some(k=>![...required,...optional].includes(k)))throw Error('INVALID_TOOL_FIELDS');
}
function textArg(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('INVALID_TOOL_TEXT');}
function cursorArg(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<0||Number(value)>10000)throw Error('INVALID_CURSOR');}
function timestamp(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('INVALID_TIME');
 if(Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59)throw Error('INVALID_TIME');
 const date=value.slice(0,10),t=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==date)throw Error('INVALID_DATE');
 return Date.parse(value);
}
function deadlineArg(value:unknown){
 if(value===null)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_DEADLINE');
 const d=value as Record<string,unknown>;fields(d,['value','precision']);
 if(d.precision==='datetime'){timestamp(d.value);return;}
 if(d.precision!=='date'||typeof d.value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.value))throw Error('INVALID_DEADLINE');
 timestamp(d.value+'T00:00:00Z');
}
// Validate data, never natural-language wording. Owner and mutation permission are server concerns.
export function validateTool(call:ToolCall,now:number):void{
 const a=call.args;
 switch(call.name){
  case 'replan_day':fields(a,['expected_version','free','busy','estimates']);
   for(const key of ['free','busy']){if(!Array.isArray(a[key])||(a[key] as unknown[]).length>20)throw Error('INVALID_RANGES');for(const raw of a[key] as Record<string,unknown>[]){if(!raw||typeof raw!=='object')throw Error('INVALID_RANGE');fields(raw,['start','end']);if(timestamp(raw.end)<=timestamp(raw.start))throw Error('INVALID_RANGE');}}
   if(!Array.isArray(a.estimates)||a.estimates.length>100)throw Error('INVALID_ESTIMATES');
   for(const raw of a.estimates){if(!raw||typeof raw!=='object')throw Error('INVALID_ESTIMATE');fields(raw,['id','minutes']);textArg(raw.id,100);if(!Number.isInteger(raw.minutes)||raw.minutes<5||raw.minutes>600)throw Error('INVALID_ESTIMATE');}break;
  case 'show_work':fields(a,['screen','filter']);if(!['tasks','progress','achievements'].includes(String(a.screen))||!['active','all','overdue','today','upcoming','undated','completed'].includes(String(a.filter)))throw Error('INVALID_VIEW');break;
  case 'record_progress':fields(a,['task_id','expected_version','content']);textArg(a.task_id,100);textArg(a.content,300);break;
  case 'update_event':fields(a,['event_id','expected_version','cancelled','start','end']);textArg(a.event_id,100);if(typeof a.cancelled!=='boolean')throw Error('INVALID_EVENT_ACTION');{const start=timestamp(a.start);if(!a.cancelled&&start<=now)throw Error('EVENT_IN_PAST');if(a.end!==null&&timestamp(a.end)<=start)throw Error('INVALID_EVENT_END');}break;
  case 'reschedule_reminder':fields(a,['reminder_id','expected_version','at','message']);textArg(a.reminder_id,100);textArg(a.message,500);if(timestamp(a.at)<=now)throw Error('REMINDER_IN_PAST');break;
  case 'plan_work':fields(a,['task_id','expected_version','at','minutes']);textArg(a.task_id,100);if(timestamp(a.at)<=now||!Number.isInteger(a.minutes)||Number(a.minutes)<5||Number(a.minutes)>180)throw Error('INVALID_WORK_BLOCK');break;
  case 'session_action':fields(a,['session_id','expected_version','action']);textArg(a.session_id,100);if(!['start','pause','finish','skip','snooze'].includes(String(a.action)))throw Error('INVALID_SESSION_ACTION');break;
  case 'acknowledge_reminder':case 'cancel_reminder':fields(a,['reminder_id','expected_version']);textArg(a.reminder_id,100);break;
  case 'respond':fields(a,['message']);textArg(a.message,4000);break;
  case 'create_event':fields(a,['title','start','end','remind_at','message']);textArg(a.title,160);textArg(a.message,500);{
   const start=timestamp(a.start);if(start<=now)throw Error('EVENT_IN_PAST');
   if(a.end!==null&&timestamp(a.end)<=start)throw Error('INVALID_EVENT_END');
   if(a.remind_at!==null&&(timestamp(a.remind_at)<=now||timestamp(a.remind_at)>start))throw Error('INVALID_EVENT_REMINDER');
  }break;
  case 'create_reminder':fields(a,['subject','at','message']);textArg(a.subject,160);textArg(a.message,500);if(timestamp(a.at)<=now)throw Error('REMINDER_IN_PAST');break;
  case 'save_clarification':fields(a,['subject','question','task_id']);textArg(a.subject,160);textArg(a.question,400);if(a.task_id!==null)textArg(a.task_id,100);break;
  case 'close_clarification':fields(a,['pending_id','cancelled']);textArg(a.pending_id,100);if(typeof a.cancelled!=='boolean')throw Error('INVALID_CONFIRMATION');break;
  case 'update_summary':fields(a,['content','through','expected_version']);textArg(a.content,2400);cursorArg(a.expected_version);if(!Number.isSafeInteger(a.through)||Number(a.through)<0)throw Error('INVALID_SUMMARY_RANGE');break;

  case 'resolve_pending':fields(a,['pending_id','accept']);textArg(a.pending_id,100);if(typeof a.accept!=='boolean')throw Error('INVALID_CONFIRMATION');break;
  case 'find_tasks':fields(a,['query','status','cursor']);if(typeof a.query!=='string'||a.query.length>160||!['active','completed','all'].includes(String(a.status)))throw Error('INVALID_QUERY');cursorArg(a.cursor);break;
  case 'get_agenda':fields(a,['from','to','cursor']);{const from=timestamp(a.from),to=timestamp(a.to);if(to<=from||to-from>31*86400000)throw Error('INVALID_RANGE');}cursorArg(a.cursor);break;
  case 'create_task':fields(a,['title','deadline']);textArg(a.title,160);deadlineArg(a.deadline);break;
  case 'update_task':fields(a,['task_id','expected_version','patch']);textArg(a.task_id,100);if(!a.patch||typeof a.patch!=='object'||Array.isArray(a.patch))throw Error('INVALID_PATCH');{
   const patch=a.patch as Record<string,unknown>;fields(patch,[],['deadline','status','title']);if(!Object.keys(patch).length)throw Error('EMPTY_PATCH');
   if('title' in patch)textArg(patch.title,160);if('deadline' in patch)deadlineArg(patch.deadline);if('status' in patch&&!['active','completed'].includes(String(patch.status)))throw Error('INVALID_STATUS');
  }break;
  case 'set_reminder':fields(a,['task_id','expected_version','at']);textArg(a.task_id,100);if(timestamp(a.at)<=now)throw Error('REMINDER_IN_PAST');break;
  case 'set_reminder_pause':fields(a,['until']);if(a.until!==null&&(timestamp(a.until)<=now||timestamp(a.until)-now>7*86400000))throw Error('INVALID_PAUSE');break;
  case 'remember_preference':fields(a,['content','lifetime']);textArg(a.content,300);if(!['today','persistent'].includes(String(a.lifetime)))throw Error('INVALID_LIFETIME');break;
  default:throw Error('UNKNOWN_TOOL');
 }
 if(call.name!=='update_summary'&&'expected_version' in a&&(!Number.isSafeInteger(a.expected_version)||Number(a.expected_version)<1))throw Error('INVALID_VERSION');
}
