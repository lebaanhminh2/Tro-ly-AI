/* Persistent estimates are not actual work logs. Existing rewards/history stay intact. */
CREATE TABLE task_planning (
 owner TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),
 remaining_minutes INTEGER CHECK(remaining_minutes BETWEEN 1 AND 100000),
 priority INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 2),
 updated INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(owner,task_id)
);
/* Use the latest known estimate for each task, not only today's snapshot. */
INSERT INTO task_planning(owner,task_id,remaining_minutes,updated)
SELECT source.owner,source.task_id,source.minutes,source.updated FROM (
 SELECT d.owner,json_extract(e.value,'$.id') task_id,json_extract(e.value,'$.minutes') minutes,
 d.start_at updated,ROW_NUMBER() OVER(PARTITION BY d.owner,json_extract(e.value,'$.id') ORDER BY d.day DESC) rank
 FROM schedule_days d,json_each(d.intervals_json,'$.estimates') e
) source WHERE rank=1 AND typeof(minutes)='integer' AND minutes BETWEEN 1 AND 100000
 AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=source.task_id AND t.owner=source.owner);
ALTER TABLE schedule_settings ADD COLUMN daily_budget_minutes INTEGER NOT NULL DEFAULT 360 CHECK(daily_budget_minutes BETWEEN 30 AND 960);
CREATE TABLE daily_plans (
 owner TEXT PRIMARY KEY,day INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 signature TEXT NOT NULL,plan_json TEXT NOT NULL,updated INTEGER NOT NULL
);
CREATE TABLE daily_contacts (
 owner TEXT NOT NULL,day INTEGER NOT NULL,task_id TEXT NOT NULL,
 last_attempt INTEGER NOT NULL,count INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(owner,day,task_id)
);
/* Legacy sessions/reminders are preserved during migration. The new daily-plan
   dispatcher owns only its own IDs and remains auditable */
SELECT 1;
