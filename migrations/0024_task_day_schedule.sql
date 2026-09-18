/* Task-day planning is deliberately isolated from standalone and recurring reminders. */
ALTER TABLE schedule_settings ADD COLUMN auto_plan_delay_minutes INTEGER NOT NULL DEFAULT 180
 CHECK(auto_plan_delay_minutes BETWEEN 30 AND 720);

ALTER TABLE schedule_days ADD COLUMN task_plan_status TEXT NOT NULL DEFAULT 'waiting'
 CHECK(task_plan_status IN ('waiting','active','closed'));
ALTER TABLE schedule_days ADD COLUMN task_plan_due INTEGER;
ALTER TABLE schedule_days ADD COLUMN task_plan_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_days ADD COLUMN task_plan_effective_from INTEGER;
ALTER TABLE schedule_days ADD COLUMN task_plan_source TEXT
 CHECK(task_plan_source IS NULL OR task_plan_source IN ('manual','automatic','system'));

/* Preserve already materialized plans during rollout. New days always start waiting. */
UPDATE schedule_days
SET task_plan_status='active',
    task_plan_generation=COALESCE((SELECT version FROM daily_plans p WHERE p.owner=schedule_days.owner AND p.day=schedule_days.day),1),
    task_plan_effective_from=COALESCE((SELECT updated FROM daily_plans p WHERE p.owner=schedule_days.owner AND p.day=schedule_days.day),start_at),
    task_plan_source='system'
WHERE EXISTS(SELECT 1 FROM daily_plans p WHERE p.owner=schedule_days.owner AND p.day=schedule_days.day);

UPDATE schedule_days
SET task_plan_due=start_at+180*60000
WHERE task_plan_due IS NULL;

/* Counts survive day rollover and replans. They reset only on meaningful user activity. */
CREATE TABLE task_nudge_state (
 owner TEXT PRIMARY KEY,
 version INTEGER NOT NULL DEFAULT 1,
 consecutive_unanswered INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_unanswered BETWEEN 0 AND 3),
 task_counts_json TEXT NOT NULL DEFAULT '{}',
 next_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 updated INTEGER NOT NULL
);

CREATE TABLE task_nudge_receipts (
 owner TEXT NOT NULL,
 activity_id TEXT NOT NULL,
 created INTEGER NOT NULL,
 PRIMARY KEY(owner,activity_id)
);

/* Old work-nudge payloads do not carry a plan generation, so they are unsafe
   after this migration. Standalone/recurring reminders use other id prefixes. */
UPDATE outbox
SET state='failed'
WHERE id LIKE 'nudge:%' AND state='pending';
