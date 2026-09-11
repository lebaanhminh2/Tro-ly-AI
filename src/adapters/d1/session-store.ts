import type { Database,Statement } from './database.ts';
import { query } from './database.ts';
import type { SessionChange } from '../../domain/session.ts';

export function sessionStatements(db:Database,owner:string,c:SessionChange):Statement[]{
  const q=(sql:string,...args:(string|number|null)[])=>query(db,sql,...args);
  if(c.type==='session-input')return [q('DELETE FROM selections WHERE owner=?',owner),
    q('INSERT INTO session_input(owner,task_id,expires) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET task_id=excluded.task_id,expires=excluded.expires',owner,c.taskId,c.expires)];
  if(c.type==='preferences'){
    const p=c.preferences;if(p.owner!==owner)throw Error('OWNER_MISMATCH');
    return [q(`INSERT INTO reminder_preferences(owner,quiet_start,quiet_end,pause_until) VALUES(?,?,?,?)
      ON CONFLICT(owner) DO UPDATE SET quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,pause_until=excluded.pause_until`,owner,p.quiet_start,p.quiet_end,p.pause_until),
      ...(p.pause_until>0?[q("UPDATE reminders SET status='cancelled' WHERE owner=? AND status IN ('pending','queued')",owner)]:[])];
  }
  const s=c.session;if(s.owner!==owner)throw Error('OWNER_MISMATCH');
  if(c.type==='session-create')return [
    q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE id=? AND owner=?) THEN 1 ELSE 0 END',s.task_id,owner),
    q('INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES(?,?,?,?,?,?,?)',s.id,owner,s.task_id,s.start_at,s.minutes,s.status,s.expires),
    q('DELETE FROM session_input WHERE owner=?',owner)];
  const result=[q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM sessions WHERE id=? AND owner=? AND version=?) THEN 1 ELSE 0 END',s.id,owner,s.version)];
  const action=c.action;
  const status=action==='confirm'||action==='snooze'?'planned':action==='start'?'running':action==='pause'?'paused':action==='finish'?'completed':'skipped';
  const generation=s.generation+(action==='snooze'?1:0),start=action==='snooze'?c.now+900000:s.start_at;
  const spent=s.spent_ms+(s.active_since!==null?Math.max(0,c.now-s.active_since):0);
  result.push(q('UPDATE sessions SET status=?,version=version+1,generation=?,start_at=?,active_since=?,spent_ms=? WHERE id=? AND owner=?',status,generation,start,action==='start'?c.now:null,spent,s.id,owner));
  result.push(q("UPDATE reminders SET status='cancelled' WHERE session_id=? AND owner=? AND status IN ('pending','queued')",s.id,owner));
  if(action==='confirm'||action==='snooze'){
    for(const ordinal of [1,2])result.push(q('INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,?,?,?,?,?)',`${s.id}:${generation}:${ordinal}`,owner,s.id,generation,ordinal,start+(ordinal-1)*900000));
    result.push(q('INSERT OR IGNORE INTO reminder_preferences(owner,quiet_start,quiet_end) VALUES(?,1320,420)',owner));
  }
  return result;
}
