import {query,type Database,type Statement} from './database.ts';
import type {Lease} from '../../ports/work-store.ts';
import {parseConversation,type ConversationIntent,type ConversationMutation} from '../../domain/conversation.ts';

export class ConversationStore {
 private db:Database;
 constructor(db:Database){this.db=db;}
 private fence(lease:Lease,now:number){return query(this.db,`INSERT INTO transaction_guard SELECT CASE WHEN
  EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?) AND
  EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending') THEN 1 ELSE 0 END`,lease.owner,lease.token,now,lease.owner,lease.input.updateId);}

 async step<T>(lease:Lease,key:string,kind:'model'|'read',request:unknown,clock:()=>number,run:()=>Promise<T>):Promise<T>{
  if(!/^(model:[0-2]|read:[0-2]:[0-1])$/.test(key)||!key.startsWith(kind+':'))throw Error('INVALID_STEP');
  const requestJson=JSON.stringify(request);
  if(!requestJson||requestJson.length>100000)throw Error('INVALID_STEP_REQUEST');
  const prior=await query(this.db,'SELECT state,kind,request_json,result_json FROM tool_steps WHERE owner=? AND update_id=? AND step_key=?',lease.owner,lease.input.updateId,key)
   .first<{state:string;kind:string;request_json:string;result_json:string|null}>();
  if(prior){
   if(prior.request_json!==requestJson||prior.kind!==kind)throw Error('STEP_INPUT_CHANGED');
   if(prior.state==='done'&&prior.result_json)return JSON.parse(prior.result_json) as T;
   throw Error('STEP_ALREADY_ATTEMPTED');
  }
  await this.db.batch([this.fence(lease,clock()),query(this.db,"INSERT INTO tool_steps(owner,update_id,step_key,kind,state,request_json,created) VALUES(?,?,?,?,'started',?,?)",lease.owner,lease.input.updateId,key,kind,requestJson,clock()),query(this.db,'DELETE FROM transaction_guard')]);
  try{
   const result=await run(),json=JSON.stringify(result);
   if(!json||json.length>100000)throw Error('INVALID_STEP_RESULT');
   await this.db.batch([this.fence(lease,clock()),query(this.db,"UPDATE tool_steps SET state='done',result_json=? WHERE owner=? AND update_id=? AND step_key=? AND state='started'",json,lease.owner,lease.input.updateId,key),query(this.db,'DELETE FROM transaction_guard')]);
   return result;
  }catch{
   // A provider may have processed a timed-out request. Never auto-repeat the model step.
   await query(this.db,`UPDATE tool_steps SET state='failed' WHERE owner=? AND update_id=? AND step_key=? AND state='started'
    AND EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?)`,lease.owner,lease.input.updateId,key,lease.owner,lease.token,clock()).run();
   throw Error('STEP_UNAVAILABLE');
  }
 }

 async writeResult(lease:Lease,request:unknown):Promise<Record<string,unknown>|null>{
  const row=await query(this.db,"SELECT request_json,result_json FROM tool_steps WHERE owner=? AND update_id=? AND kind='write' AND state='done'",lease.owner,lease.input.updateId)
   .first<{request_json:string;result_json:string}>();
  if(!row)return null;
  if(row.request_json!==JSON.stringify(request))throw Error('WRITE_INPUT_CHANGED');
  return JSON.parse(row.result_json);
 }

 async commitWrite(lease:Lease,request:unknown,result:Record<string,unknown>,statements:Statement[],now:number){
  const prior=await this.writeResult(lease,request);if(prior)return prior;
  const requestJson=JSON.stringify(request),resultJson=JSON.stringify(result);
  if(requestJson.length>16000||resultJson.length>24000)throw Error('TOOL_RESULT_TOO_LARGE');
  await this.db.batch([this.fence(lease,now),
   query(this.db,"INSERT INTO tool_steps(owner,update_id,step_key,kind,state,request_json,result_json,created) VALUES(?,?,'write','write','done',?,?,?)",lease.owner,lease.input.updateId,requestJson,resultJson,now),
   ...statements,query(this.db,'DELETE FROM transaction_guard')]);
  return result;
 }

 pendingStatements(lease:Lease,name:string,args:Record<string,unknown>,reason:string,now:number){
  const id=`pending_${lease.owner}_${lease.input.updateId}`;
  return {id,statements:[
   query(this.db,"UPDATE pending_tool_actions SET status='expired' WHERE owner=? AND status='pending'",lease.owner),
   query(this.db,'INSERT INTO pending_tool_actions(id,owner,tool_name,args_json,reason,expires,origin_update_id) VALUES(?,?,?,?,?,?,?)',id,lease.owner,name,JSON.stringify(args),reason,now+300000,lease.input.updateId)
  ]};
 }
 async pending(owner:string,now:number){
  return query(this.db,"SELECT id,tool_name,args_json,reason,expires FROM pending_tool_actions WHERE owner=? AND status='pending' AND expires>?",owner,now)
   .first<{id:string;tool_name:string;args_json:string;reason:string;expires:number}>();
 }
 resolvePendingStatements(owner:string,id:string,accept:boolean,now:number){
  return [
   query(this.db,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM pending_tool_actions WHERE id=? AND owner=? AND status='pending' AND expires>?) THEN 1 ELSE 0 END",id,owner,now),
   query(this.db,'UPDATE pending_tool_actions SET status=? WHERE id=? AND owner=?',accept?'accepted':'rejected',id,owner)
  ];
 }
 async infer(owner:string,updateId:number,now:number,generate:()=>Promise<ConversationIntent>,metadata?:{model:string;promptVersion:string;source:'model'|'continuation'}){
  if(metadata&&(!/^[\w.-]{1,100}$/.test(metadata.model)||!/^[\w.-]{1,100}$/.test(metadata.promptVersion)))throw Error('INVALID_INFERENCE_METADATA');
  const row=await query(this.db,'SELECT state,envelope FROM conversation_receipts WHERE owner=? AND update_id=?',owner,updateId).first<{state:string;envelope:string|null}>();
  if(row?.state==='ready'&&row.envelope)return parseConversation(row.envelope);
  if(row)throw Error('INFERENCE_ALREADY_ATTEMPTED');
  const accepted=await query(this.db,"INSERT OR IGNORE INTO conversation_receipts(owner,update_id,state,created,model,prompt_version,inference_source) VALUES(?,?,'started',?,?,?,?)",owner,updateId,now,metadata?.model??null,metadata?.promptVersion??null,metadata?.source??null).run();
  if(!accepted.meta.changes)throw Error('INFERENCE_ALREADY_ATTEMPTED');
  const started=Date.now();
  try{
   const value=parseConversation(JSON.stringify(await generate()));
   await query(this.db,"UPDATE conversation_receipts SET state='ready',envelope=?,inference_ms=? WHERE owner=? AND update_id=? AND state='started'",JSON.stringify(value),Math.max(0,Date.now()-started),owner,updateId).run();
   return value;
  }catch{
   await query(this.db,"UPDATE conversation_receipts SET state='failed',inference_ms=? WHERE owner=? AND update_id=? AND state='started'",Math.max(0,Date.now()-started),owner,updateId).run();
   throw Error('INFERENCE_UNAVAILABLE');
  }
 }
}

export async function appointmentAllowed(db:Database,reminderId:string,now:number){
 const match=/^appointment:(.+):([12])$/.exec(reminderId);if(!match)return false;
 const row=await query(db,`SELECT a.*,COALESCE(p.pause_until,0) AS pause_until FROM task_appointments a LEFT JOIN reminder_preferences p ON p.owner=a.owner WHERE a.id=?`,match[1]!).first<{due:number;status:string;responded:number;pause_until:number}>();
 return !!row&&row.status==='active'&&row.due<=now&&now<row.due+3600000&&row.pause_until<=now&&(match[2]==='1'||!row.responded);
}

export async function acknowledgeAppointments(db:Database,owner:string){
 await query(db,`UPDATE task_appointments SET responded=1 WHERE owner=? AND responded=0 AND EXISTS(SELECT 1 FROM outbox o
  WHERE o.reminder_id='appointment:'||task_appointments.id||':1' AND o.state IN ('sent','sending','uncertain'))`,owner).run();
}

export async function queueAppointments(db:Database,owner:string,now:number){
 await query(db,"UPDATE task_appointments SET status='expired' WHERE owner=? AND status='active' AND due+3600000<=?",owner,now).run();
 const appointments=(await query(db,`SELECT a.id,a.due,t.title FROM task_appointments a JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner WHERE a.owner=? AND a.status='active' AND a.due<=? ORDER BY a.due LIMIT 10`,owner,now).all<{id:string;due:number;title:string}>()).results;
 for(const a of appointments){
  if(!await appointmentAllowed(db,`appointment:${a.id}:1`,now)){
   await query(db,"UPDATE task_appointments SET status='cancelled' WHERE id=? AND status='active'",a.id).run();continue;
  }
  const first=await query(db,'SELECT state,sent_at FROM outbox WHERE reminder_id=?',`appointment:${a.id}:1`).first<{state:string;sent_at:number|null}>();
  const ordinal=first?2:1;
  if(first&&(first.state!=='sent'||first.sent_at===null||now<first.sent_at+900000))continue;
  const reminderId=`appointment:${a.id}:${ordinal}`;
  if(!await appointmentAllowed(db,reminderId,now))continue;
  await query(db,'INSERT OR IGNORE INTO outbox(id,payload,available,reminder_id) VALUES(?,?,?,?)',reminderId,
   JSON.stringify({method:'sendMessage',chat_id:Number(owner),text:ordinal===1?`Đến giờ cậu hẹn làm “${a.title}” rồi nhé.`:`Tớ nhắc thêm lần này thôi: “${a.title}”.`}),now,reminderId).run();
 }
}

export function conversationStatements(db:Database,owner:string,c:ConversationMutation){
 if(c.owner!==owner)throw Error('OWNER_MISMATCH');
 const q=(sql:string,...args:(string|number|null)[])=>query(db,sql,...args);
 const statements=[q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_receipts WHERE owner=? AND update_id=? AND state='ready') THEN 1 ELSE 0 END",owner,c.updateId)];
 if(c.pendingId)statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END",owner,c.pendingId,c.created));
 if(c.title!==null){
  if(c.expectedVersion!==null)throw Error('INVALID_CAPTURE_VERSION');
  statements.push(q('INSERT INTO tasks(id,owner,title,deadline,deadline_precision,created) VALUES(?,?,?,?,?,?)',c.taskId,owner,c.title,c.deadline?.value??null,c.deadline?.precision??null,c.created));
 }else{
  if(c.expectedVersion===null||!c.deadline)throw Error('INVALID_UPDATE');
  statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END',owner,c.taskId,c.expectedVersion));
  statements.push(q('UPDATE tasks SET deadline=?,deadline_precision=?,version=version+1 WHERE owner=? AND id=?',c.deadline.value,c.deadline.precision,owner,c.taskId));
 }
 statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?",owner,c.updateId));
 return statements;
}
