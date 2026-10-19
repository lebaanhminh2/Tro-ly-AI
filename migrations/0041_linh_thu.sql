/* New independent runtime. Legacy game tables and all existing balances remain intact. */
CREATE TABLE beast_accounts (
  owner TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  activated_day INTEGER NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

CREATE TABLE beasts (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  species_id TEXT NOT NULL,
  current_attempt_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  acquired_receipt TEXT NOT NULL,
  PRIMARY KEY(owner,id),
  FOREIGN KEY(owner) REFERENCES beast_accounts(owner)
);
CREATE INDEX beasts_collection_page ON beasts(owner,acquired_at DESC,id DESC);
CREATE INDEX beasts_species ON beasts(owner,species_id,acquired_at DESC,id DESC);

CREATE TABLE beast_attempts (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  beast_id TEXT NOT NULL,
  rule_version INTEGER NOT NULL,
  skill_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN('ready','training','sealed','completed')),
  earned INTEGER NOT NULL DEFAULT 0 CHECK(earned >= 0),
  gray INTEGER NOT NULL DEFAULT 0 CHECK(gray >= 0),
  capacity INTEGER NOT NULL CHECK(capacity > 0 AND earned + gray <= capacity),
  thresholds_json TEXT NOT NULL CHECK(json_valid(thresholds_json)),
  counters_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(counters_json)),
  started_day INTEGER,
  last_settled_day INTEGER,
  ended_day INTEGER,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,id),
  FOREIGN KEY(owner,beast_id) REFERENCES beasts(owner,id)
);
CREATE INDEX beast_attempts_individual ON beast_attempts(owner,beast_id,created DESC);

CREATE TABLE beast_roles (
  owner TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN('training','companion')),
  effective_day INTEGER NOT NULL,
  beast_id TEXT,
  attempt_id TEXT,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,role,effective_day),
  FOREIGN KEY(owner,beast_id) REFERENCES beasts(owner,id),
  FOREIGN KEY(owner,attempt_id) REFERENCES beast_attempts(owner,id),
  CHECK((beast_id IS NULL) = (attempt_id IS NULL))
);
CREATE INDEX beast_roles_history ON beast_roles(owner,role,effective_day DESC);

CREATE TABLE beast_day_settlements (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  training_beast_id TEXT,
  companion_beast_id TEXT,
  outcomes_json TEXT NOT NULL CHECK(json_valid(outcomes_json)),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,day)
);

CREATE TABLE beast_skill_events (
  owner TEXT NOT NULL,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  day INTEGER NOT NULL,
  beast_id TEXT,
  skill_version INTEGER NOT NULL,
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,kind,source_id)
);
CREATE INDEX beast_skill_day ON beast_skill_events(owner,day,kind,created);

CREATE TABLE beast_ultimates (
  owner TEXT NOT NULL,
  week_start INTEGER NOT NULL,
  beast_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  skill_version INTEGER NOT NULL,
  activated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  PRIMARY KEY(owner,week_start),
  FOREIGN KEY(owner,attempt_id) REFERENCES beast_attempts(owner,id)
);

CREATE TABLE beast_tower_runs (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  eligibility_json TEXT NOT NULL CHECK(json_valid(eligibility_json)),
  expires_at INTEGER NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,day)
);
CREATE INDEX beast_tower_expiry ON beast_tower_runs(owner,expires_at,day);

CREATE TABLE beast_choices (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('summon','draw','reward')),
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  created INTEGER NOT NULL,
  resolved_at INTEGER,
  PRIMARY KEY(owner,id)
);
CREATE INDEX beast_choices_pending ON beast_choices(owner,resolved_at,created);
CREATE INDEX beast_receipts_recent ON cultivation_receipts(owner,operation,created DESC);
