export type ToolName='find_tasks'|'get_agenda'|'create_task'|'update_task'|'set_reminder'|'set_reminder_pause'|'remember_preference';
export type ToolCall={name:ToolName;args:Record<string,unknown>;id?:string};
export type ModelContent={role:'user'|'model';parts:Record<string,unknown>[]};
export type ModelStep={content:ModelContent;calls:ToolCall[];text:string};
const str={type:'STRING'};
const integer={type:'INTEGER'};
const deadline={type:'OBJECT',nullable:true,properties:{value:str,precision:{type:'STRING',enum:['date','datetime']}},required:['value','precision']};
const declaration=(name:ToolName,description:string,properties:Record<string,unknown>,required=Object.keys(properties))=>({name,description,parameters:{type:'OBJECT',properties,required}});
export const TOOL_DECLARATIONS=[
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

export type Turn = { role: 'user' | 'model'; text: string };
export type Draft = {
  operation: 'capture_task' | 'update_task' | 'reschedule_session';
  entityId: string | null;
  field: 'title' | 'deadline' | 'progress' | 'estimate' | 'subtasks' | 'status' | 'session_time';
  value: string;
  certainty: 'confirmed' | 'tentative' | 'unknown';
  evidence: string;
};
export type Reply = { kind: 'chat' | 'clarify' | 'proposal'; reply: string; draft: Draft | null };

const operations = ['capture_task', 'update_task', 'reschedule_session'];
const fields = ['title', 'deadline', 'progress', 'estimate', 'subtasks', 'status', 'session_time'];
export const REPLY_SCHEMA = {
  type: 'object', required: ['kind', 'reply', 'draft'], additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['chat', 'clarify', 'proposal'] },
    reply: { type: 'string' },
    draft: { anyOf: [
      { type: 'null' },
      { type: 'object', additionalProperties: false,
        required: ['operation', 'entityId', 'field', 'value', 'certainty', 'evidence'],
        properties: {
          operation: { type: 'string', enum: operations },
          entityId: { type: ['string', 'null'] },
          field: { type: 'string', enum: fields }, value: { type: 'string' },
          certainty: { type: 'string', enum: ['confirmed', 'tentative', 'unknown'] },
          evidence: { type: 'string' }
        }
      }
    ] }
  }
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI output');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some(k => !(k in value)))
    throw new Error('Invalid AI fields');
}
function shortText(value: unknown, max = 3000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

// Untrusted model draft, not a user-facing proposal until policy approves it.
// Structural validation is not a truth/authorization check. No mutation executor exists here.
export function parseReply(text: string, turns: Turn[], allowedIds: string[] = []): Reply {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Invalid AI JSON'); }
  const value = object(raw);
  keys(value, ['kind', 'reply', 'draft']);
  if (!['chat', 'clarify', 'proposal'].includes(String(value.kind)) || !shortText(value.reply))
    throw new Error('Invalid AI reply');
  if (value.kind !== 'proposal') {
    if (value.draft !== null) throw new Error('Unexpected draft');
  } else {
    const draft = object(value.draft);
    keys(draft, ['operation', 'entityId', 'field', 'value', 'certainty', 'evidence']);
    if (!operations.includes(String(draft.operation)) || !fields.includes(String(draft.field)) ||
        !['confirmed', 'tentative', 'unknown'].includes(String(draft.certainty)) ||
        !shortText(draft.value) || !shortText(draft.evidence) ||
        !turns.some(t => t.role === 'user' && t.text.includes(draft.evidence as string)))
      throw new Error('Invalid draft evidence or fields');
    if (draft.operation === 'capture_task') {
      if (draft.entityId !== null || draft.field !== 'title') throw new Error('Invalid capture');
    } else {
      if (typeof draft.entityId !== 'string' || !allowedIds.includes(draft.entityId))
        throw new Error('Unknown draft entity');
      if ((draft.operation === 'reschedule_session') !== (draft.field === 'session_time'))
        throw new Error('Invalid draft scope');
    }
  }
  return value as Reply;
}
