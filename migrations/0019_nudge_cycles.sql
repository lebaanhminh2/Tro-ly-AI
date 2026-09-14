/* One owner gate prevents separate tasks from competing for attention. */
CREATE TABLE nudge_cycles (
 owner TEXT PRIMARY KEY, day INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 cycle INTEGER NOT NULL DEFAULT 1, tasks_json TEXT NOT NULL DEFAULT '[]',
 attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
 blocked_json TEXT NOT NULL DEFAULT '[]', lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE nudge_reply_receipts (
 owner TEXT NOT NULL, update_id INTEGER NOT NULL, created INTEGER NOT NULL,
 PRIMARY KEY(owner,update_id)
);
