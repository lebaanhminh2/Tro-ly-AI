import type { Database, Statement } from './database.ts';
import { query } from './database.ts';
import type { WorkStore, Lease, ViewResult } from '../../ports/work-store.ts';
import type { Input, Task, Proposal, Selection, Plan } from '../../domain/work.ts';

export class D1WorkStore implements WorkStore {
  private db: Database;
  constructor(db: Database) { this.db = db; }
  task(owner: string, id: string) { return query(this.db, 'SELECT * FROM tasks WHERE owner=? AND id=?', owner, id).first<Task>(); }
  async tasks(owner: string, offset: number) { return (await query(this.db, 'SELECT * FROM tasks WHERE owner=? ORDER BY created,id LIMIT 10 OFFSET ?', owner, offset).all<Task>()).results; }
  proposal(owner: string, id: string) { return query(this.db, 'SELECT * FROM proposals WHERE owner=? AND id=?', owner, id).first<Proposal>(); }
  selection(owner: string) { return query(this.db, 'SELECT * FROM selections WHERE owner=?', owner).first<Selection>(); }
  async result(owner: string, id: number): Promise<ViewResult | null> {
    const row = await query(this.db, 'SELECT result FROM command_inbox WHERE owner=? AND update_id=? AND state=?', owner, id, 'done').first<{result: string | null}>();
    return row?.result ? JSON.parse(row.result) as ViewResult : null;
  }
  async accept(input: Input, now: number, delivery: boolean) {
    const response = await query(this.db, 'INSERT OR IGNORE INTO command_inbox(owner,update_id,payload,created,delivery) VALUES(?,?,?,?,?)',
      input.owner, input.updateId, JSON.stringify(input), now, delivery ? 1 : 0).run();
    return response.meta.changes > 0;
  }
  async pendingOwners() { return (await query(this.db, "SELECT DISTINCT owner FROM command_inbox WHERE state='pending' LIMIT 4").all<{owner: string}>()).results.map(r => r.owner); }
  async claim(owner: string, now: number): Promise<Lease | null> {
    const token = crypto.randomUUID();
    const claim = await query(this.db, `INSERT INTO owner_leases(owner,token,expires) VALUES(?,?,?)
      ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE owner_leases.expires<=?`, owner, token, now + 30000, now).run();
    if (!claim.meta.changes) return null;
    const row = await query(this.db, "SELECT payload,attempts,update_id FROM command_inbox WHERE owner=? AND state='pending' ORDER BY update_id LIMIT 1", owner).first<{payload:string;attempts:number;update_id:number}>();
    if (!row) { await query(this.db, 'DELETE FROM owner_leases WHERE owner=? AND token=?', owner, token).run(); return null; }
    const counted = await query(this.db, `UPDATE command_inbox SET attempts=attempts+1 WHERE owner=? AND update_id=? AND state='pending'
      AND EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=?)`, owner,row.update_id,owner,token).run();
    if (!counted.meta.changes) return null;
    return { owner, token, input: JSON.parse(row.payload) as Input, attempts: row.attempts + 1 };
  }
  async release(lease: Lease) { await query(this.db, 'DELETE FROM owner_leases WHERE owner=? AND token=?', lease.owner, lease.token).run(); }
  async commit(lease: Lease, plan: Plan, now: number) {
    const { owner, input, token } = lease;
    const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
    const statements: Statement[] = [q(`INSERT INTO transaction_guard(valid) SELECT CASE WHEN
      EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?) AND
      EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending') THEN 1 ELSE 0 END`, owner, token, now, owner, input.updateId)];
    for (const change of plan.changes) {
      if (change.type === 'cancel') {
        if (change.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q('DELETE FROM selections WHERE owner=?', owner));
      } else if (change.type === 'select') {
        const s = change.selection;
        if (s.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE id=? AND owner=? AND version=?) THEN 1 ELSE 0 END', s.task_id, owner, s.version));
        statements.push(q(`INSERT INTO selections(owner,task_id,version,expires) VALUES(?,?,?,?) ON CONFLICT(owner)
          DO UPDATE SET task_id=excluded.task_id,version=excluded.version,expires=excluded.expires`, owner,s.task_id,s.version,s.expires));
      } else if (change.type === 'propose') {
        const p = change.proposal;
        if (p.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q('INSERT INTO proposals(id,owner,task_id,operation,value,expected_version,expires) VALUES(?,?,?,?,?,?,?)', p.id,owner,p.task_id,p.operation,p.value,p.expected_version,p.expires));
      } else {
        const p = change.proposal;
        if (p.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM proposals WHERE id=? AND owner=? AND status='pending' AND expires>?) THEN 1 ELSE 0 END", p.id,owner,now));
        // Existing trigger validates version and applies task mutation within this batch.
        statements.push(q("UPDATE proposals SET status=? WHERE id=? AND owner=? AND status='pending'", change.accept ? 'accepted' : 'rejected',p.id,owner));
      }
    }
    const payload = JSON.stringify({ method: 'sendMessage', chat_id: input.chat, text: plan.view.text,
      ...(plan.view.buttons.length ? { reply_markup: { inline_keyboard: plan.view.buttons } } : {}) });
    statements.push(q(`INSERT INTO outbox(id,payload,available) SELECT ?,?,? FROM command_inbox WHERE owner=? AND update_id=? AND delivery=1`,
      `reply:${owner}:${input.updateId}`,payload,now,owner,input.updateId));
    statements.push(q("UPDATE command_inbox SET state='done',result=? WHERE owner=? AND update_id=?", JSON.stringify(plan.view),owner,input.updateId));
    statements.push(q('INSERT INTO command_audit(owner,update_id,change_count,applied) VALUES(?,?,?,?)',owner,input.updateId,plan.changes.length,now));
    statements.push(q('DELETE FROM transaction_guard'));
    statements.push(q('DELETE FROM owner_leases WHERE owner=? AND token=?',owner,token));
    await this.db.batch(statements);
  }
}
