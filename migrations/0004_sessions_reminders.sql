CREATE TABLE sessions (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES tasks(id),
 start_at INTEGER NOT NULL, minutes INTEGER NOT NULL CHECK(minutes BETWEEN 5 AND 180),
 status TEXT NOT NULL CHECK(status IN ('draft','planned','running','paused','completed','skipped','unknown')),
 version INTEGER NOT NULL DEFAULT 1, generation INTEGER NOT NULL DEFAULT 1,
 expires INTEGER NOT NULL, active_since INTEGER, spent_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_today ON sessions(owner,start_at);
CREATE TABLE reminder_preferences (owner TEXT PRIMARY KEY, quiet_start INTEGER NOT NULL, quiet_end INTEGER NOT NULL, pause_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE session_input (owner TEXT PRIMARY KEY, task_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE reminders (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id),
 generation INTEGER NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal IN (1,2)), due INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','queued','done','cancelled')),
 UNIQUE(session_id,generation,ordinal)
);
CREATE INDEX reminders_due ON reminders(owner,status,due);
ALTER TABLE outbox ADD COLUMN reminder_id TEXT;
