export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database { prepare(sql: string): Statement; }
export function query(db: Database, sql: string, ...args: (string | number | null)[]) { return db.prepare(sql).bind(...args); }

// Recovery is conservative: never replay possibly committed business mutations.
export async function recoverInterrupted(db: Database, now: number) {
  const fallback = JSON.stringify({ method: 'sendMessage', text: 'Xử lý vừa bị gián đoạn; thay đổi có thể đã lưu. Cậu kiểm tra /tasks trước khi thử lại nhé.' });
  await query(db, `UPDATE updates SET status='interrupted',response=json_set(?, '$.chat_id', chat)
    WHERE status='processing' AND response IS NULL AND chat IS NOT NULL AND created<?`, fallback, now - 60000).run();
  await query(db, "UPDATE outbox SET state='uncertain' WHERE state='sending' AND lease<?", now).run();
}
