export type ToolName='ask_user'|'edit_task_step'|'show_work'|'record_progress'|'update_event'|'reschedule_reminder'|'plan_work'|'session_action'|'acknowledge_reminder'|'cancel_reminder'|'create_event'|'create_reminder'|'respond'|'save_clarification'|'close_clarification'|'update_summary'|'find_tasks'|'get_agenda'|'create_task'|'update_task'|'set_reminder'|'set_reminder_pause'|'remember_preference'|'resolve_pending';
export type ToolCall={name:ToolName;args:Record<string,unknown>;id?:string};
export type ModelContent={role:'user'|'model';parts:Record<string,unknown>[]};
export type ModelStep={content:ModelContent;calls:ToolCall[];text:string};
const str={type:'STRING'};
const integer={type:'INTEGER'};
const deadline={type:'OBJECT',nullable:true,properties:{value:str,precision:{type:'STRING',enum:['date','datetime']}},required:['value','precision']};
const declaration=(name:ToolName,description:string,properties:Record<string,unknown>,required=Object.keys(properties))=>({name,description,parameters:{type:'OBJECT',properties,required}});
export const TOOL_DECLARATIONS=[
 declaration('ask_user','Ask a specific missing detail; no changes are applied. Never claim successful writes in this question.',{question:str}),
 declaration('edit_task_step','Edit only a task child using task_codes mapping. Does not complete parent. Use add_step, edit_step or step_status. Supply parent version. If reopening completed parent requires confirmation, ask user to use the app. Do not combine with other writes in one response.',{
 operation:{type:'STRING',enum:['add_step','edit_step','step_status']},task_id:str,expected_version:integer,
 step_id:{type:'STRING',nullable:true},title:{type:'STRING',nullable:true},complete:{type:'BOOLEAN',nullable:true}
 }),

 declaration('show_work','Open the interactive DB-backed work board or progress chart/achievements. Always use this when user asks for all tasks or statistics; never dump a long list in text.',{screen:{type:'STRING',enum:['tasks','progress','achievements']},filter:{type:'STRING',enum:['active','all','overdue','today','upcoming','undated','completed']}}),
 declaration('record_progress','Record a concrete small step user explicitly reports having finished on this task. Not a plan, feeling, timer, or entire-task completion.',{task_id:str,expected_version:integer,content:str}),

 declaration('update_event','Move or cancel one known local event. Cancel leaves start unchanged. Existing linked reminders are cancelled; create the replacement only when user wants it.',{event_id:str,expected_version:integer,cancelled:{type:'BOOLEAN'},start:str,end:{type:'STRING',nullable:true}}),
 declaration('reschedule_reminder','Move one active reminder. Old delivery is cancelled and a new reminder cycle created with a new ID only on user request.',{reminder_id:str,expected_version:integer,at:str,message:str}),

 declaration('plan_work','Plan one work block AND its start reminder plus one follow-up automatically. Never add create_reminder/set_reminder for the same block: that would notify twice. Duration is an estimate, not progress. Requires known user availability; do not fill every gap or create another unanswered reminder cycle.',{task_id:str,expected_version:integer,at:str,minutes:integer}),
 declaration('session_action','Start, pause, finish a work block (not the whole task), skip or snooze it. Use session ID/version from context.',{session_id:str,expected_version:integer,action:{type:'STRING',enum:['start','pause','finish','skip','snooze']}}),
 declaration('acknowledge_reminder','Mark the one reminder the user is answering as responded; does not complete its task or other reminders.',{reminder_id:str,expected_version:integer}),
 declaration('cancel_reminder','Cancel one known reminder the user no longer wants. Does not delete its task.',{reminder_id:str,expected_version:integer}),

 declaration('create_event','Create an actual fixed meeting/class/appointment. Never use for a request merely to notify, wake up, or go to sleep: use create_reminder. End and reminder are optional; do not invent duration.',{title:str,start:str,end:{type:'STRING',nullable:true},remind_at:{type:'STRING',nullable:true},message:str}),
 declaration('create_reminder','Create a NEW standalone reminder, including wake-up or bedtime requests. Do not create an event or task just to send a notification. Never attach to an unrelated task. Read notificationState: asleep/paused/inactive blocks delivery; ask for another time, never silently resume all notifications.',{subject:str,at:str,message:str}),
 declaration('respond','Provide the user-facing reply to send after the other actions succeed. May accompany writes and clarification questions in the same response. Plain social chat may just return text.',{message:str}),
 declaration('save_clarification','Save only the unfinished part while executing clear actions. task_id is null for no task or @index for a task created earlier in this batch.',{subject:str,question:str,task_id:{type:'STRING',nullable:true}}),
 declaration('close_clarification','Close a known question after resolving it with the other actions, or when the user cancels it.',{pending_id:str,cancelled:{type:'BOOLEAN'}}),
 declaration('update_summary','Optional memory maintenance. Summarize only provided historical turns through summary_request.through, never the current turn or uncommitted actions. Do not replace missing history with guesses.',{content:str,through:integer,expected_version:integer}),

 declaration('resolve_pending','Accept or reject the exact pending action only when the user clearly answers it. Never use to approve your own suggestion.',{pending_id:str,accept:{type:'BOOLEAN'}}),
 declaration('find_tasks','Find tasks owned by the user. Query by title, or pass an empty query to list. Use returned IDs/versions, never invent them.',{query:str,status:{type:'STRING',enum:['active','completed','all']},cursor:integer}),
 declaration('get_agenda','Read local task deadlines, appointments and work sessions for a time interval.',{from:str,to:str,cursor:integer}),
 declaration('create_task','Create a task the user directly asked to record. Deadline is optional, date-only must not acquire an invented hour. No reminder is created automatically.',{title:str,deadline}),
 declaration('update_task','Update one known task after the user directly requests the change. Include only fields to change in patch. Completion is for the whole task, not a work session.',{task_id:str,expected_version:integer,patch:{type:'OBJECT',properties:{title:str,deadline,status:{type:'STRING',enum:['active','completed']}}}}),
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
 if(calls.length>8||text.length>4000||(!calls.length&&!text.trim()))throw Error('INVALID_MODEL_STEP');
 return {content:{role:'model',parts},calls,text};
}
export function toolResponse(call:ToolCall,result:Record<string,unknown>):Record<string,unknown>{
 return {functionResponse:{name:call.name,...(call.id?{id:call.id}:{}),response:result}};
}

function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_OBJECT');return value as Record<string,unknown>;}
