import { query } from './database.ts';
import type { Database } from './database.ts';
export async function propose(db: Database, owner: string, updateId: number, taskId: string | null,
  value: string, version: number, now: number) {
  const id = `p${updateId}`;
  await query(db, `INSERT INTO proposals(id,owner,task_id,operation,value,expected_version,expires)
    VALUES(?,?,?,?,?,?,?)`, id, owner, taskId ?? `t${updateId}`, taskId ? 'deadline' : 'capture', value, version, now + 300000).run();
  return id;
}
export async function resolveProposal(db: Database, owner: string, id: string, accept: boolean, now: number) {
  // Trigger applies task mutation in same SQL transaction; no read/modify/write race.
  const result = await query(db, `UPDATE proposals SET status=? WHERE id=? AND owner=? AND status='pending'
    AND expires>? AND (operation='capture' OR julianday(value)>julianday(? / 1000.0,'unixepoch'))`,
    accept ? 'accepted' : 'rejected', id, owner, now, now).run();
  return result.meta.changes > 0;
}
