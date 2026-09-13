ALTER TABLE tasks ADD COLUMN deleted_at INTEGER;
CREATE TABLE task_completions (
 owner TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),
 completed_at INTEGER NOT NULL,deadline TEXT,precision TEXT,
 PRIMARY KEY(owner,task_id)
);
CREATE TRIGGER record_task_completion AFTER UPDATE OF status ON tasks
WHEN OLD.status='active' AND NEW.status='completed' AND NEW.deleted_at IS NULL
BEGIN
 INSERT OR REPLACE INTO task_completions(owner,task_id,completed_at,deadline,precision)
 VALUES(NEW.owner,NEW.id,unixepoch()*1000,NEW.deadline,NEW.deadline_precision);
END;
CREATE TRIGGER undo_task_completion AFTER UPDATE OF status ON tasks
WHEN OLD.status='completed' AND NEW.status='active'
BEGIN
 DELETE FROM task_completions WHERE owner=NEW.owner AND task_id=NEW.id;
END;
CREATE TABLE task_progress (
 id TEXT PRIMARY KEY,owner TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),
 content TEXT NOT NULL,created INTEGER NOT NULL,source_update INTEGER NOT NULL,
 UNIQUE(owner,source_update,task_id,content)
);
CREATE TABLE achievements (
 owner TEXT NOT NULL,code TEXT NOT NULL,unlocked_at INTEGER NOT NULL,notified INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner,code)
);
CREATE TABLE task_board_selection (
 owner TEXT PRIMARY KEY,items TEXT NOT NULL DEFAULT '[]',expires INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1
);
