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

export function conversationStatements(db:Database,owner:string,c:ConversationMutation){
 if(c.owner!==owner)throw Error('OWNER_MISMATCH');
 const q=(sql:string,...args:(string|number|null)[])=>query(db,sql,...args);
 const statements=[q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_receipts WHERE owner=? AND update_id=? AND state='ready') THEN 1 ELSE 0 END",owner,c.updateId)];
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
