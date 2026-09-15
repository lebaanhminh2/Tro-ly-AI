/* Zero remaining means the estimate is exhausted and the task still needs a manual completion tick */
ALTER TABLE task_planning RENAME TO task_planning_0022_old;
CREATE TABLE task_planning (
 owner TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),
 remaining_minutes INTEGER CHECK(remaining_minutes BETWEEN 0 AND 100000),
 priority INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 2),
 updated INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(owner,task_id)
);
INSERT INTO task_planning(owner,task_id,remaining_minutes,priority,updated,version)
SELECT owner,task_id,remaining_minutes,priority,updated,version FROM task_planning_0022_old;
DROP TABLE task_planning_0022_old;

/* Manual daily work entries. They are an audit ledger and never infer time from chat. */
CREATE TABLE task_work_logs (
 owner TEXT NOT NULL,
 task_id TEXT NOT NULL REFERENCES tasks(id),
 day INTEGER NOT NULL,
 minutes INTEGER NOT NULL CHECK(minutes BETWEEN 0 AND 1440),
 note TEXT,
 updated INTEGER NOT NULL,
 PRIMARY KEY(owner,task_id,day)
);
CREATE INDEX task_work_logs_owner_day ON task_work_logs(owner,day);
