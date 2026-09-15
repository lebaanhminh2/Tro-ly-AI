import type {Database} from './database.ts';
import {query} from './database.ts';

/** Read-only completed-task history plus bounded retention cleanup. */
export async function historyPage(db:Database,owner:string,offset=0,limit=20){
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('INVALID_HISTORY_OFFSET');
 if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw Error('INVALID_HISTORY_LIMIT');
 const [rowsResult,countResult]=await Promise.all([
  query(db,`SELECT t.id,t.owner,t.title,t.note,t.deadline,t.version,t.status,t.public_code,
   c.completed_at,t.archived_at
   FROM tasks t JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
   WHERE t.owner=? AND t.deleted_at IS NULL AND t.status='completed'
   ORDER BY c.completed_at DESC,t.public_code DESC LIMIT ? OFFSET ?`,owner,limit+1,offset).all<Record<string,unknown>>(),
  query(db,"SELECT COUNT(*) AS total FROM tasks t JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id WHERE t.owner=? AND t.deleted_at IS NULL AND t.status='completed'",owner).first<{total:number}>()
 ]);
 const rows=rowsResult.results;
 const items:(Record<string,unknown>&{steps:unknown[]})[]=rows.slice(0,limit).map(row=>({...row,steps:[]}));
 const total=Number(countResult?.total??0);
 return {items,total,offset,limit,hasMore:offset+items.length<total};
}

export async function archiveCompleted(db:Database,owner:string,now:number,retentionDays=90,limit=100){
 const cutoff=now-retentionDays*86400000;
 const rows=(await query(db,`SELECT t.id FROM tasks t JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
   WHERE t.owner=? AND t.status='completed' AND t.deleted_at IS NULL AND t.archived_at IS NULL AND c.completed_at<?
   ORDER BY c.completed_at LIMIT ?`,owner,cutoff,limit).all<{id:string}>()).results;
 if(!rows.length)return {archived:0};
 const ids=rows.map(row=>row.id),marks=ids.map(()=>'?').join(','),args:(string|number|null)[]=[owner,...ids];
 await db.batch([
  query(db,`UPDATE tasks SET archived_at=? WHERE owner=? AND id IN (${marks}) AND status='completed' AND archived_at IS NULL`,now,owner,...ids),
  query(db,`DELETE FROM outbox WHERE reminder_id IN (SELECT r.id FROM reminders r JOIN sessions s ON s.id=r.session_id AND s.owner=r.owner WHERE s.owner=? AND s.task_id IN (${marks}))`,...args),
  query(db,`DELETE FROM reminders WHERE owner=? AND session_id IN (SELECT id FROM sessions WHERE owner=? AND task_id IN (${marks}))`,owner,owner,...ids),
  query(db,`DELETE FROM sessions WHERE owner=? AND task_id IN (${marks})`,...args),
  query(db,`DELETE FROM task_steps WHERE owner=? AND task_id IN (${marks})`,...args),
  query(db,`DELETE FROM task_completion_undo WHERE owner=? AND task_id IN (${marks})`,...args)
 ]);
 return {archived:ids.length};
}
