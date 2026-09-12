ALTER TABLE tasks ADD COLUMN deadline_precision TEXT CHECK(deadline_precision IN ('date','datetime'));
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
