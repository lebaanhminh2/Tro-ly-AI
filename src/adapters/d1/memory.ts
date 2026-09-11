import type {Database} from './database.ts';
import {query} from './database.ts';
import type {MemoryChange} from '../../domain/memory.ts';
export function memoryStatements(db:Database,owner:string,c:MemoryChange){
 const q=(sql:string,...args:(string|number|null)[])=>query(db,sql,...args);
 if(c.type==='remember'){
  const m=c.memory;if(m.owner!==owner)throw Error('OWNER_MISMATCH');
  return [q('INSERT INTO memories(id,owner,content,kind,source,created,expires) VALUES(?,?,?,?,?,?,?)',m.id,owner,m.content,m.kind,m.source,m.created,m.expires)];
 }
 if(c.owner!==owner)throw Error('OWNER_MISMATCH');
 if(c.type==='forget')return [c.id===null?q('DELETE FROM memories WHERE owner=?',owner):q('DELETE FROM memories WHERE owner=? AND id=?',owner,c.id),
  q('DELETE FROM conversation_turns WHERE owner=?',owner),q('DELETE FROM chat_focus WHERE owner=?',owner),
  q("UPDATE command_inbox SET payload='{}',result=NULL WHERE owner=? AND state='done'",owner)];
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
  query(db,"UPDATE command_inbox SET payload='{}',result=NULL WHERE state='done' AND created<?",now-7*86400000)
 ]);
}
