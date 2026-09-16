/* Recover the latest schedule estimate for tasks that predate durable planning.
   Existing task_planning rows are authoritative and are never overwritten.
   Work logged on or after that schedule day is deducted once during this
   compatibility backfill. Future edits update task_planning directly. */
WITH ranked AS (
 SELECT d.owner,d.day,d.start_at,json_extract(e.value,'$.id') AS task_id,
  json_extract(e.value,'$.minutes') AS minutes,
  ROW_NUMBER() OVER (
   PARTITION BY d.owner,json_extract(e.value,'$.id')
   ORDER BY d.day DESC,d.version DESC
  ) AS rank
 FROM schedule_days d,json_each(d.intervals_json,'$.estimates') e
), recovered AS (
 SELECT r.owner,r.task_id,
  MAX(0,r.minutes-COALESCE((
   SELECT SUM(l.minutes) FROM task_work_logs l
   WHERE l.owner=r.owner AND l.task_id=r.task_id AND l.day>=r.day
  ),0)) AS remaining_minutes,
  r.start_at AS updated
 FROM ranked r
 WHERE r.rank=1 AND typeof(r.minutes)='integer' AND r.minutes BETWEEN 1 AND 100000
)
INSERT INTO task_planning(owner,task_id,remaining_minutes,updated)
SELECT r.owner,r.task_id,r.remaining_minutes,r.updated
FROM recovered r
WHERE EXISTS(
 SELECT 1 FROM tasks t
 WHERE t.owner=r.owner AND t.id=r.task_id AND t.deleted_at IS NULL
)
AND NOT EXISTS(
 SELECT 1 FROM task_planning p
 WHERE p.owner=r.owner AND p.task_id=r.task_id
);
