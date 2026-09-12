export type ToolName='find_tasks'|'get_agenda'|'create_task'|'update_task'|'set_reminder'|'set_reminder_pause'|'remember_preference'|'resolve_pending';
export type ToolCall={name:ToolName;args:Record<string,unknown>;id?:string};
export type ModelContent={role:'user'|'model';parts:Record<string,unknown>[]};
export type ModelStep={content:ModelContent;calls:ToolCall[];text:string};
const str={type:'STRING'};
const integer={type:'INTEGER'};
const deadline={type:'OBJECT',nullable:true,properties:{value:str,precision:{type:'STRING',enum:['date','datetime']}},required:['value','precision']};
const declaration=(name:ToolName,description:string,properties:Record<string,unknown>,required=Object.keys(properties))=>({name,description,parameters:{type:'OBJECT',properties,required}});
export const TOOL_DECLARATIONS=[
 declaration('resolve_pending','Accept or reject the exact pending action only when the user clearly answers it. Never use to approve your own suggestion.',{pending_id:str,accept:{type:'BOOLEAN'}}),
 declaration('find_tasks','Find tasks owned by the user. Query by title, or pass an empty query to list. Use returned IDs/versions, never invent them.',{query:str,status:{type:'STRING',enum:['active','completed','all']},cursor:integer}),
 declaration('get_agenda','Read local task deadlines, appointments and work sessions for a time interval. Does not imply Google Calendar is connected.',{from:str,to:str,cursor:integer}),
 declaration('create_task','Create a task the user directly asked to record. Deadline is optional, date-only must not acquire an invented hour. No reminder is created automatically.',{title:str,deadline}),
 declaration('update_task','Update one known task after the user directly requests the change. Include only fields to change in patch. Completion is for the whole task, not a work session.',{task_id:str,expected_version:integer,patch:{type:'OBJECT',properties:{deadline,status:{type:'STRING',enum:['active','completed']}}}}),
 declaration('set_reminder','Set a reminder time for one task. This is not a work session and has no duration. Replaces the active standalone reminder for this task.',{task_id:str,expected_version:integer,at:str}),
 declaration('set_reminder_pause','Pause reminders until a timestamp, or resume. Feeling tired alone is not a request to pause.',{until:{type:'STRING',nullable:true}}),
 declaration('remember_preference','Store only a preference or temporary fact the user directly asked you to remember.',{content:str,lifetime:{type:'STRING',enum:['today','persistent']}})
];
export function modelStep(raw:unknown):ModelStep{
 const body=object(raw),candidates=body.candidates;
 if(!Array.isArray(candidates)||candidates.length!==1)throw Error('INVALID_MODEL_CANDIDATES');
 const candidate=object(candidates[0]);
 if(candidate.finishReason!=='STOP')throw Error('INCOMPLETE_MODEL_STEP');
 const content=object(candidate.content);
 if(content.role!=='model'||!Array.isArray(content.parts)||!content.parts.length||content.parts.length>32)throw Error('INVALID_MODEL_CONTENT');
 const calls:ToolCall[]=[];const parts:Record<string,unknown>[]=[];let text='';
 for(const rawPart of content.parts){
  const part=object(rawPart);parts.push(part); // Preserve thoughtSignature and part ordering verbatim.
  if(part.functionCall!==undefined){
   const call=object(part.functionCall);
   if(!TOOL_DECLARATIONS.some(tool=>tool.name===call.name))throw Error('UNKNOWN_TOOL');
   const args=object(call.args);
   if(JSON.stringify(args).length>12000)throw Error('TOOL_ARGS_TOO_LARGE');
   if(call.id!==undefined&&(typeof call.id!=='string'||call.id.length>256))throw Error('INVALID_TOOL_ID');
   calls.push({name:call.name as ToolName,args,...(typeof call.id==='string'?{id:call.id}:{})});
  }else if(typeof part.text==='string'&&part.thought!==true)text+=part.text;
 }
 if(calls.length>3||text.length>4000||(!calls.length&&!text.trim()))throw Error('INVALID_MODEL_STEP');
 return {content:{role:'model',parts},calls,text};
}
export function toolResponse(call:ToolCall,result:Record<string,unknown>):Record<string,unknown>{
 return {functionResponse:{name:call.name,...(call.id?{id:call.id}:{}),response:result}};
}

function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_OBJECT');return value as Record<string,unknown>;}
