/* Additive v2 runtime. Existing wallets, receipts, attempts and pending v1
   choices remain untouched. Runtime bootstrap chooses the cutover day. This
   migration never infers counters, activates skills or mints rewards. */
CREATE TABLE beast_v2_runtime (
  owner TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  cutover_day INTEGER NOT NULL CHECK(cutover_day >= 0),
  last_day INTEGER,
  sleep_streak INTEGER NOT NULL DEFAULT 0 CHECK(sleep_streak >= 0),
  updated INTEGER NOT NULL,
  FOREIGN KEY(owner) REFERENCES beast_accounts(owner),
  CHECK(last_day IS NULL OR last_day >= cutover_day)
);

CREATE TABLE beast_v2_states (
  owner TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  PRIMARY KEY(owner,attempt_id),
  FOREIGN KEY(owner) REFERENCES beast_accounts(owner),
  FOREIGN KEY(owner,attempt_id) REFERENCES beast_attempts(owner,id)
);

CREATE TABLE beast_v2_days (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  task_count INTEGER NOT NULL DEFAULT 0 CHECK(task_count >= 0),
  before_noon_tasks INTEGER NOT NULL DEFAULT 0 CHECK(before_noon_tasks >= 0),
  habit_json TEXT CHECK(habit_json IS NULL OR json_valid(habit_json)),
  daily_json TEXT CHECK(daily_json IS NULL OR json_valid(daily_json)),
  settled INTEGER NOT NULL DEFAULT 0 CHECK(settled IN(0,1)),
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,day),
  FOREIGN KEY(owner) REFERENCES beast_accounts(owner),
  CHECK(before_noon_tasks <= task_count)
);
CREATE INDEX beast_v2_days_pending ON beast_v2_days(owner,settled,day);

CREATE TABLE beast_v2_buffs (
  owner TEXT NOT NULL,
  source_attempt_id TEXT NOT NULL,
  effective_day INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'task' CHECK(kind='task'),
  reward_json TEXT NOT NULL CHECK(json_valid(reward_json)),
  PRIMARY KEY(owner,source_attempt_id,effective_day),
  FOREIGN KEY(owner) REFERENCES beast_accounts(owner),
  FOREIGN KEY(owner,source_attempt_id) REFERENCES beast_attempts(owner,id)
);
CREATE INDEX beast_v2_buffs_day ON beast_v2_buffs(owner,effective_day);

/* Task completion and ticket recovery can commit in different invocations.
   Capture the original companion/form with the caller's canonical timestamp,
   before later evolution or elixir can rewrite it. Existing rows stay NULL. */
ALTER TABLE task_completions ADD COLUMN beast_source_json TEXT
  CHECK(beast_source_json IS NULL OR json_valid(beast_source_json));
CREATE TRIGGER beast_v2_task_source AFTER UPDATE OF completed_at ON task_completions
WHEN NOT EXISTS(SELECT 1 FROM task_ticket_awards WHERE owner=NEW.owner AND task_id=NEW.task_id)
BEGIN
  UPDATE task_completions SET beast_source_json=(
    SELECT json_object('day',ctx.day,'beastId',b.id,'attemptId',a.id,
      'attempt',CASE WHEN a.id IS NULL THEN NULL ELSE json_object(
        'speciesId',b.species_id,'ruleVersion',a.rule_version,'form',a.form,
        'status',a.status,'earned',a.earned,'gray',a.gray) END)
    FROM (SELECT COALESCE(
      (SELECT day FROM schedule_days WHERE owner=NEW.owner AND start_at<=NEW.completed_at AND end_at>NEW.completed_at ORDER BY day DESC LIMIT 1),
      CAST((NEW.completed_at+25200000-ss.start_minutes*60000)/86400000 AS INTEGER)) AS day
      FROM schedule_settings ss WHERE ss.owner=NEW.owner) ctx
    JOIN beast_v2_runtime rt ON rt.owner=NEW.owner AND ctx.day>=rt.cutover_day
    LEFT JOIN beast_roles r ON r.owner=NEW.owner AND r.role='companion'
      AND r.effective_day=(SELECT MAX(effective_day) FROM beast_roles WHERE owner=NEW.owner AND role='companion' AND effective_day<=ctx.day)
    LEFT JOIN beasts b ON b.owner=r.owner AND b.id=r.beast_id AND b.sacrificed_at IS NULL
    LEFT JOIN beast_attempts a ON a.owner=b.owner AND a.id=r.attempt_id
  ) WHERE owner=NEW.owner AND task_id=NEW.task_id;
END;
