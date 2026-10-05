/* Replying to one delivered task nudge acknowledges only its schedule window.
   It is not a focus toggle, a completed task, or a global reminder pause. */
CREATE TABLE task_nudge_acknowledgments (
 owner TEXT NOT NULL,
 day INTEGER NOT NULL,
 task_id TEXT NOT NULL,
 window_end INTEGER NOT NULL,
 message_id INTEGER NOT NULL,
 acknowledged_at INTEGER NOT NULL,
 PRIMARY KEY (owner, day, task_id, window_end)
);
