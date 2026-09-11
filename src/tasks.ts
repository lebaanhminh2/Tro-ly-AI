import { query } from './db.ts';
import type { Database } from './db.ts';
export type StoredTask = { id: string; owner: string; title: string; deadline: string | null; version: number };
export async function listTasks(db: Database, owner: string, offset = 0) {
  return (await query(db, 'SELECT * FROM tasks WHERE owner=? ORDER BY created,id LIMIT 10 OFFSET ?', owner, offset).all<StoredTask>()).results;
}
export function getTask(db: Database, owner: string, id: string) {
  return query(db, 'SELECT * FROM tasks WHERE owner=? AND id=?', owner, id).first<StoredTask>();
}
