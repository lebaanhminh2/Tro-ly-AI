import type {Database} from './database.ts';
import {query} from './database.ts';
import type {MemoryChange} from '../../domain/memory.ts';
export function memoryStatements(db:Database,owner:string,c:MemoryChange){
 const q=(sql:string,...args:(string|number|null)[])=>query(db,sql,...args);
 if(c.type==='remember'){
  const m=c.memory;if(m.owner!==owner)throw Error('OWNER_MISMATCH');
  return [q('INSERT INTO memories(id,owner,content,kind,source,created,expires) VALUES(?,?,?,?,?,?,?)',m.id,owner,m.content,m.kind,m.source,m.created,m.expires)];
 }
 if(c.type==='memory-confirm'){
  const p=c.confirmation;if(p.owner!==owner)throw Error('OWNER_MISMATCH');
  return [q("UPDATE memory_confirmations SET status='rejected' WHERE owner=? AND status='pending'",owner),
    q('INSERT INTO memory_confirmations(owner,id,expires) VALUES(?,?,?)',owner,p.id,p.expires)];
 }
 if(c.owner!==owner)throw Error('OWNER_MISMATCH');
 if(c.type==='memory-resolve')return [
  q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM memory_confirmations WHERE owner=? AND id=? AND status='pending' AND expires>?) THEN 1 ELSE 0 END",owner,c.id,c.now),
  q('UPDATE memory_confirmations SET status=? WHERE owner=? AND id=?',c.accept?'accepted':'rejected',owner,c.id),
  ...(c.accept?[q('DELETE FROM conversation_summaries WHERE owner=?',owner),q('DELETE FROM conversation_clarifications WHERE owner=?',owner),q('DELETE FROM memories WHERE owner=?',owner),q('DELETE FROM conversation_turns WHERE owner=?',owner),q('DELETE FROM chat_focus WHERE owner=?',owner),q("UPDATE command_inbox SET payload='{}',result=NULL WHERE owner=? AND state='done'",owner)]:[]),q('DELETE FROM transaction_guard')];
 if(c.type==='forget')return [
  q('DELETE FROM conversation_summaries WHERE owner=? AND EXISTS(SELECT 1 FROM memories WHERE owner=? AND id=?)',owner,owner,c.id),
  q('DELETE FROM conversation_clarifications WHERE owner=? AND EXISTS(SELECT 1 FROM memories WHERE owner=? AND id=?)',owner,owner,c.id),
  q('DELETE FROM conversation_turns WHERE owner=? AND EXISTS(SELECT 1 FROM memories WHERE owner=? AND id=?)',owner,owner,c.id),
  q('DELETE FROM chat_focus WHERE owner=? AND EXISTS(SELECT 1 FROM memories WHERE owner=? AND id=?)',owner,owner,c.id),
  q("UPDATE command_inbox SET payload='{}',result=NULL WHERE owner=? AND state='done' AND EXISTS(SELECT 1 FROM memories WHERE owner=? AND id=?)",owner,owner,c.id),
  q('DELETE FROM memories WHERE owner=? AND id=?',owner,c.id)];
 if(c.type==='ai-enabled')return [q('INSERT INTO memory_settings(owner,enabled) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET enabled=excluded.enabled',owner,c.enabled?1:0)];
 return [q('INSERT INTO chat_focus(owner,task_id,expires) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET task_id=excluded.task_id,expires=excluded.expires',owner,c.taskId,c.expires)];
}
export async function reserveAi(db:Database,scope:string,command:string,now:number,limit=100){
 if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('INVALID_QUOTA');
 // Conservative rolling 24 hours, not provider billing/reset time. All retries consume reservation.
 const r=await query(db,`INSERT OR IGNORE INTO ai_reservations(scope,command_key,created)
 SELECT ?,?,? WHERE (SELECT COUNT(*) FROM ai_reservations WHERE scope=? AND created>?)<?
 AND (SELECT COUNT(*) FROM ai_reservations WHERE scope=? AND created>?)<4`,scope,command,now,scope,now-86400000,limit,scope,now-60000).run();
 return r.meta.changes>0;
}

export async function expireMemory(db:Database,now:number){
 await db.batch([
  query(db,'DELETE FROM memories WHERE expires IS NOT NULL AND expires<=?',now),
  query(db,'DELETE FROM conversation_turns WHERE expires<=?',now),
  query(db,'DELETE FROM chat_focus WHERE expires<=?',now),
  query(db,"UPDATE conversation_clarifications SET status='expired' WHERE status='waiting' AND expires<=?",now),
  query(db,'DELETE FROM tool_steps WHERE created<? AND EXISTS(SELECT 1 FROM command_inbox i WHERE i.owner=tool_steps.owner AND i.update_id=tool_steps.update_id AND i.state=\'done\')',now-30*86400000),
  query(db,"UPDATE command_inbox SET payload='{}',result=NULL,tool_context=NULL,tool_reply=NULL WHERE state='done' AND created<?",now-30*86400000)
 ]);
}
