PRAGMA foreign_keys = ON;
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
  deadline TEXT, version INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL
);
CREATE INDEX tasks_owner ON tasks(owner,created);
CREATE TABLE proposals (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, task_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('capture','deadline')),
  value TEXT NOT NULL, expected_version INTEGER NOT NULL,
  expires INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','rejected'))
);
CREATE TABLE selections (owner TEXT PRIMARY KEY, task_id TEXT NOT NULL, version INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE updates (id INTEGER PRIMARY KEY, status TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TRIGGER apply_proposal AFTER UPDATE OF status ON proposals
WHEN OLD.status='pending' AND NEW.status='accepted'
BEGIN
  SELECT CASE WHEN NEW.operation='deadline' AND NOT EXISTS
    (SELECT 1 FROM tasks WHERE id=NEW.task_id AND owner=NEW.owner AND version=NEW.expected_version)
    THEN RAISE(ABORT,'STALE_PROPOSAL') END;
  INSERT INTO tasks(id,owner,title,created)
    SELECT NEW.task_id,NEW.owner,NEW.value,unixepoch()*1000 WHERE NEW.operation='capture';
  UPDATE tasks SET deadline=NEW.value,version=version+1
    WHERE NEW.operation='deadline' AND id=NEW.task_id AND owner=NEW.owner;
END;
