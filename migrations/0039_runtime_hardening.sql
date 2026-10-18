/* Additive only: preserve the currently displayed estimate for existing tasks.
   Historical overrun discarded by older code cannot be inferred reliably. */
ALTER TABLE task_planning ADD COLUMN remaining_balance INTEGER;
UPDATE task_planning SET remaining_balance=remaining_minutes;

CREATE TABLE recurrence_scan (
  owner TEXT PRIMARY KEY,
  after_id TEXT NOT NULL
);
CREATE INDEX recurrence_eligible ON recurrence_rules(owner,enabled,id);
CREATE INDEX habit_archive_page ON habits(owner,archived_from,created,id);
CREATE INDEX completion_recent ON task_completions(owner,completed_at DESC,task_id);
CREATE INDEX progress_recent ON task_progress(owner,created DESC,id);
