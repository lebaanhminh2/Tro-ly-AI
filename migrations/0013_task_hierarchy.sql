ALTER TABLE tasks ADD COLUMN public_code INTEGER;
WITH numbered AS (
 SELECT id,ROW_NUMBER() OVER(PARTITION BY owner ORDER BY created,id) AS code FROM tasks
)
UPDATE tasks SET public_code=(SELECT code FROM numbered WHERE numbered.id=tasks.id);
CREATE UNIQUE INDEX tasks_public_code ON tasks(owner,public_code);
CREATE TABLE task_code_counters(owner TEXT PRIMARY KEY,next_code INTEGER NOT NULL);
INSERT INTO task_code_counters(owner,next_code) SELECT owner,MAX(public_code)+1 FROM tasks GROUP BY owner;
CREATE TRIGGER assign_task_code AFTER INSERT ON tasks WHEN NEW.public_code IS NULL
BEGIN
 INSERT INTO task_code_counters(owner,next_code) VALUES(NEW.owner,1) ON CONFLICT(owner) DO NOTHING;
 UPDATE tasks SET public_code=(SELECT next_code FROM task_code_counters WHERE owner=NEW.owner) WHERE id=NEW.id;
 UPDATE task_code_counters SET next_code=next_code+1 WHERE owner=NEW.owner;
END;
CREATE TABLE task_steps(
 id TEXT PRIMARY KEY,owner TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),
 step_code INTEGER NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
 version INTEGER NOT NULL DEFAULT 1,deleted_at INTEGER,created INTEGER NOT NULL,completed_at INTEGER,
 UNIQUE(task_id,step_code)
);
CREATE INDEX task_steps_parent ON task_steps(owner,task_id);
