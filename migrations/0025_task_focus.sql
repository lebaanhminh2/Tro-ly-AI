/* A focus acknowledgement silences only task-plan nudges for the exact
   scheduled window. It is not a timer and does not infer worked minutes. */
CREATE TABLE task_focus_state (
 owner TEXT PRIMARY KEY,
 task_id TEXT NOT NULL REFERENCES tasks(id),
 day INTEGER NOT NULL,
 plan_generation INTEGER NOT NULL,
 plan_version INTEGER NOT NULL,
 started_at INTEGER NOT NULL,
 ends_at INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX task_focus_window ON task_focus_state(owner,ends_at);
