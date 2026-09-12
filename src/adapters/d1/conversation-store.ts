import {query,type Database,type Statement} from './database.ts';
import type {Lease} from '../../ports/work-store.ts';
import type {WorkReader} from '../../ports/work-store.ts';
import type {ModelContent,ModelStep,ToolCall} from '../../ai/contracts.ts';
import {isReadTool,validateTool} from '../../ai/policy.ts';
import {executeTool,type ToolOutcome} from '../../application/tool-executor.ts';
import {runToolTurn} from '../../application/conversation-command.ts';
import type {Change} from '../../domain/work.ts';
import type {ConversationMutation} from '../../domain/conversation.ts';

export class ConversationStore {
 private db:Database;
 constructor(db:Database){this.db=db;}
 async turn(lease:Lease,initial:ModelContent[],reader:WorkReader,mutations:(changes:Change[],now:number)=>Statement[],
   model:(contents:ModelContent[],allowTools:boolean,step:number)=>Promise<ModelStep>,clock:()=>number){
  const saved=await query(this.db,'SELECT tool_context,tool_reply FROM command_inbox WHERE owner=? AND update_id=?',lease.owner,lease.input.updateId)
   .first<{tool_context:string|null;tool_reply:string|null}>();
  if(!saved)throw Error('MISSING_COMMAND');
  if(saved.tool_reply!==null)return saved.tool_reply;
  const context=saved.tool_context?JSON.parse(saved.tool_context) as ModelContent[]:initial;
  if(!saved.tool_context)await this.db.batch([this.fence(lease,clock()),query(this.db,'UPDATE command_inbox SET tool_context=? WHERE owner=? AND update_id=? AND tool_context IS NULL',JSON.stringify(initial),lease.owner,lease.input.updateId),query(this.db,'DELETE FROM transaction_guard')]);
  const readIndexes=new Map<number,number>();
  let resolvedPending:string|null=null;
  const request=(call:ToolCall)=>({name:call.name,args:call.args});
  const reply=await runToolTurn(context,{
   model:(step,contents,allowTools)=>this.step(lease,`model:${step}`,'model',{contents,allowTools},clock,()=>model(contents,allowTools,step)),
   execute:async(step,call)=>{
    validateTool(call,clock());
    if(isReadTool(call.name)){
     const index=readIndexes.get(step)??0;readIndexes.set(step,index+1);
     return this.step(lease,`read:${step}:${index}`,'read',request(call),clock,()=>executeTool(call,reader,lease.owner,lease.input.updateId,clock()));
    }
    const existing=await this.writeResult(lease,request(call));
    if(existing)return {result:existing,changes:[],fallback:String(existing.fallback??'Thao tác đã được ghi nhận.')};
    if(call.name==='resolve_pending'){
     const pending=await this.pending(lease.owner,clock());
     if(!pending||pending.id!==call.args.pending_id||typeof call.args.accept!=='boolean')return {result:{status:'rejected',reason:'stale_confirmation'},changes:[],fallback:'Xác nhận này đã cũ hoặc không còn hiệu lực.'};
     if(call.args.accept===false){
      resolvedPending=pending.id;
      return {result:{status:'planned',cancelled:true},changes:[{type:'cancel',owner:lease.owner}],fallback:'Ừ, tớ không thực hiện đề xuất đó nhé.'};
     }
     const original={name:pending.tool_name as ToolCall['name'],args:JSON.parse(pending.args_json)};
     if(original.name==='resolve_pending')throw Error('RECURSIVE_CONFIRMATION');
     const outcome=await executeTool(original,reader,lease.owner,lease.input.updateId,clock(),pending.reason==='existing_title');
     if(outcome.changes.length)resolvedPending=pending.id;
     return outcome;
    }
    return executeTool(call,reader,lease.owner,lease.input.updateId,clock());
   },
   commit:async(_step,call,outcome)=>{
    if(outcome.result.status==='needs_confirmation'){
     const pending=this.pendingStatements(lease,call.name,call.args,String(outcome.result.reason),clock());
     return this.commitWrite(lease,request(call),{...outcome.result,pendingId:pending.id,fallback:outcome.fallback},pending.statements,clock());
    }
    const result={...outcome.result,status:'applied',fallback:outcome.fallback};
    return this.commitWrite(lease,request(call),result,[
     ...(resolvedPending?this.resolvePendingStatements(lease.owner,resolvedPending,call.args.accept!==false,clock()):[]),
     ...mutations(outcome.changes,clock())
    ],clock());
   }
  });
  await this.db.batch([this.fence(lease,clock()),query(this.db,'UPDATE command_inbox SET tool_reply=? WHERE owner=? AND update_id=?',reply,lease.owner,lease.input.updateId),query(this.db,'DELETE FROM transaction_guard')]);
  return reply;
 }
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

export function conversationStatements(db:Database,owner:string,c:ConversationMutation,native=false){
 if(c.owner!==owner)throw Error('OWNER_MISMATCH');
 const q=(sql:string,...args:(string|number|null)[])=>query(db,sql,...args);
 const statements=[q(`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ${native?'tool_steps':'conversation_receipts'} WHERE owner=? AND update_id=? AND ${native?"kind='write' AND state='done'":"state='ready'"}) THEN 1 ELSE 0 END`,owner,c.updateId)];
 if(c.pendingId)statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END",owner,c.pendingId,c.created));
 if(c.title!==null){
  if(c.expectedVersion!==null)throw Error('INVALID_CAPTURE_VERSION');
  statements.push(q('INSERT INTO tasks(id,owner,title,deadline,deadline_precision,created) VALUES(?,?,?,?,?,?)',c.taskId,owner,c.title,c.deadline?.value??null,c.deadline?.precision??null,c.created));
 }else{
  if(c.expectedVersion===null||(!native&&!c.deadline))throw Error('INVALID_UPDATE');
  statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END',owner,c.taskId,c.expectedVersion));
  statements.push(q('UPDATE tasks SET deadline=?,deadline_precision=?,version=version+1 WHERE owner=? AND id=?',c.deadline?.value??null,c.deadline?.precision??null,owner,c.taskId));
 }
 if(!native)statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?",owner,c.updateId));
 return statements;
}
