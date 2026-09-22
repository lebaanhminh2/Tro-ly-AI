/* Preserve existing acknowledgements while allowing a day-scoped focus with no task. */
CREATE TABLE task_focus_state_next (
 owner TEXT PRIMARY KEY,
 task_id TEXT REFERENCES tasks(id),
 day INTEGER NOT NULL,
 plan_generation INTEGER NOT NULL,
 plan_version INTEGER NOT NULL,
 started_at INTEGER NOT NULL,
 ends_at INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1
);
INSERT INTO task_focus_state_next SELECT * FROM task_focus_state;
DROP TABLE task_focus_state;
ALTER TABLE task_focus_state_next RENAME TO task_focus_state;
CREATE INDEX task_focus_window ON task_focus_state(owner,ends_at);
