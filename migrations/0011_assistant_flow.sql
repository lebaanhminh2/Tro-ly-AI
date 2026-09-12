CREATE TABLE conversation_summaries (
 owner TEXT PRIMARY KEY,
 content TEXT NOT NULL,
 covered_through INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 updated INTEGER NOT NULL
);
CREATE TABLE conversation_clarifications (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 subject TEXT NOT NULL,
 question TEXT NOT NULL,
 task_id TEXT,
 status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','applied','cancelled','expired')),
 created INTEGER NOT NULL,
 expires INTEGER NOT NULL,
 FOREIGN KEY(task_id) REFERENCES tasks(id)
);
CREATE INDEX clarification_owner ON conversation_clarifications(owner,status,expires);
DROP TRIGGER cancel_appointments_on_pause;
DROP TRIGGER cancel_appointments_on_initial_pause;
CREATE TABLE task_appointments_next (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 task_id TEXT REFERENCES tasks(id),
 due INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
 responded INTEGER NOT NULL DEFAULT 0 CHECK(responded IN (0,1)),
 subject TEXT,
 message TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 CHECK(task_id IS NOT NULL OR (subject IS NOT NULL AND length(trim(subject))>0))
);
INSERT INTO task_appointments_next(id,owner,task_id,due,status,responded)
 SELECT id,owner,task_id,due,status,responded FROM task_appointments;
DROP TABLE task_appointments;
ALTER TABLE task_appointments_next RENAME TO task_appointments;
CREATE INDEX task_appointments_due ON task_appointments(owner,status,due);
CREATE TRIGGER cancel_appointments_on_pause AFTER UPDATE OF pause_until ON reminder_preferences
WHEN NEW.pause_until>0
BEGIN
 UPDATE task_appointments SET status='cancelled' WHERE owner=NEW.owner AND due<NEW.pause_until AND status='active';
END;
CREATE TRIGGER cancel_appointments_on_initial_pause AFTER INSERT ON reminder_preferences
WHEN NEW.pause_until>0
BEGIN
 UPDATE task_appointments SET status='cancelled' WHERE owner=NEW.owner AND due<NEW.pause_until AND status='active';
END;
CREATE TABLE local_events (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 title TEXT NOT NULL,
 start_at INTEGER NOT NULL,
 end_at INTEGER,
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled')),
 version INTEGER NOT NULL DEFAULT 1,
 CHECK(end_at IS NULL OR end_at>start_at)
);
CREATE INDEX local_events_owner ON local_events(owner,start_at);
ALTER TABLE task_appointments ADD COLUMN event_id TEXT REFERENCES local_events(id);
