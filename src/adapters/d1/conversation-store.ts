import {query,type Database} from './database.ts';
import {parseConversation,type ConversationIntent,type ConversationMutation} from '../../domain/conversation.ts';

export class ConversationStore {
 private db:Database;
 constructor(db:Database){this.db=db;}
 async infer(owner:string,updateId:number,now:number,generate:()=>Promise<ConversationIntent>){
  const row=await query(this.db,'SELECT state,envelope FROM conversation_receipts WHERE owner=? AND update_id=?',owner,updateId).first<{state:string;envelope:string|null}>();
  if(row?.state==='ready'&&row.envelope)return parseConversation(row.envelope);
  if(row)throw Error('INFERENCE_ALREADY_ATTEMPTED');
  const accepted=await query(this.db,"INSERT OR IGNORE INTO conversation_receipts(owner,update_id,state,created) VALUES(?,?,'started',?)",owner,updateId,now).run();
  if(!accepted.meta.changes)throw Error('INFERENCE_ALREADY_ATTEMPTED');
  try{
   const value=parseConversation(JSON.stringify(await generate()));
   await query(this.db,"UPDATE conversation_receipts SET state='ready',envelope=? WHERE owner=? AND update_id=? AND state='started'",JSON.stringify(value),owner,updateId).run();
   return value;
  }catch{
   await query(this.db,"UPDATE conversation_receipts SET state='failed' WHERE owner=? AND update_id=? AND state='started'",owner,updateId).run();
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
