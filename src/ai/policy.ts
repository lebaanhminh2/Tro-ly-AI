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
  case 'resolve_pending':fields(a,['pending_id','accept']);textArg(a.pending_id,100);if(typeof a.accept!=='boolean')throw Error('INVALID_CONFIRMATION');break;
  case 'find_tasks':fields(a,['query','status','cursor']);if(typeof a.query!=='string'||a.query.length>160||!['active','completed','all'].includes(String(a.status)))throw Error('INVALID_QUERY');cursorArg(a.cursor);break;
  case 'get_agenda':fields(a,['from','to','cursor']);{const from=timestamp(a.from),to=timestamp(a.to);if(to<=from||to-from>31*86400000)throw Error('INVALID_RANGE');}cursorArg(a.cursor);break;
  case 'create_task':fields(a,['title','deadline']);textArg(a.title,160);deadlineArg(a.deadline);break;
  case 'update_task':fields(a,['task_id','expected_version','patch']);textArg(a.task_id,100);if(!a.patch||typeof a.patch!=='object'||Array.isArray(a.patch))throw Error('INVALID_PATCH');{
   const patch=a.patch as Record<string,unknown>;fields(patch,[],['deadline','status']);if(!Object.keys(patch).length)throw Error('EMPTY_PATCH');
   if('deadline' in patch)deadlineArg(patch.deadline);if('status' in patch&&!['active','completed'].includes(String(patch.status)))throw Error('INVALID_STATUS');
  }break;
  case 'set_reminder':fields(a,['task_id','expected_version','at']);textArg(a.task_id,100);if(timestamp(a.at)<=now)throw Error('REMINDER_IN_PAST');break;
  case 'set_reminder_pause':fields(a,['until']);if(a.until!==null&&(timestamp(a.until)<=now||timestamp(a.until)-now>7*86400000))throw Error('INVALID_PAUSE');break;
  case 'remember_preference':fields(a,['content','lifetime']);textArg(a.content,300);if(!['today','persistent'].includes(String(a.lifetime)))throw Error('INVALID_LIFETIME');break;
  default:throw Error('UNKNOWN_TOOL');
 }
 if('expected_version' in a&&(!Number.isSafeInteger(a.expected_version)||Number(a.expected_version)<1))throw Error('INVALID_VERSION');
}
