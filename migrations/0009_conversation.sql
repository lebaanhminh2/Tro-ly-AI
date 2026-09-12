ALTER TABLE tasks ADD COLUMN deadline_precision TEXT CHECK(deadline_precision IN ('date','datetime'));
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed'));
CREATE TABLE task_completion_undo (
 owner TEXT NOT NULL,
 task_id TEXT NOT NULL REFERENCES tasks(id),
 expected_version INTEGER NOT NULL,
 expires INTEGER NOT NULL,
 PRIMARY KEY(owner,task_id)
);
UPDATE tasks SET deadline_precision='datetime' WHERE deadline IS NOT NULL;
CREATE TRIGGER task_deadline_precision AFTER UPDATE OF deadline ON tasks
BEGIN
 UPDATE tasks SET deadline_precision=(CASE WHEN NEW.deadline IS NULL THEN NULL WHEN length(NEW.deadline)=10 THEN 'date' ELSE 'datetime' END) WHERE id=NEW.id;
END;
CREATE TABLE conversation_receipts (
 owner TEXT NOT NULL,
 update_id INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('started','ready','applied','failed')),
 envelope TEXT,
 model TEXT,
 prompt_version TEXT,
 inference_source TEXT CHECK(inference_source IN ('model','continuation')),
 inference_ms INTEGER,
 created INTEGER NOT NULL,
 PRIMARY KEY(owner,update_id)
);
CREATE TABLE conversation_pending (
 owner TEXT PRIMARY KEY,
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('clarify','confirm')),
 draft TEXT NOT NULL,
 expires INTEGER NOT NULL
);
CREATE TABLE task_appointments (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 task_id TEXT NOT NULL REFERENCES tasks(id),
 due INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
 responded INTEGER NOT NULL DEFAULT 0 CHECK(responded IN (0,1))
);
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
