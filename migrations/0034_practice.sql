CREATE TABLE game_accounts (
  owner TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  joined_day INTEGER NOT NULL,
  anchor_start INTEGER NOT NULL,
  next_day INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE technique_unlocks (
  owner TEXT NOT NULL,
  technique_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,technique_id)
);
CREATE TABLE practice_versions (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  technique_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  state_json TEXT NOT NULL CHECK(json_valid(state_json) AND length(state_json)<=8000),
  created_day INTEGER NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE INDEX practice_version_history ON practice_versions(owner,technique_id,created DESC,id);
CREATE UNIQUE INDEX practice_editions ON practice_versions(owner,technique_id,json_extract(state_json,'$.edition'));
CREATE INDEX practice_creation_limit ON practice_versions(owner,created_day);
CREATE TABLE game_selections (
  owner TEXT NOT NULL,
  from_day INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN('idle','practice','battle')),
  practice_id TEXT,
  battle_id TEXT,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,from_day),
  FOREIGN KEY(owner,practice_id) REFERENCES practice_versions(owner,id),
  CHECK((mode='practice' AND practice_id IS NOT NULL AND battle_id IS NULL)
    OR (mode='battle' AND battle_id IS NOT NULL AND practice_id IS NULL)
    OR (mode='idle' AND practice_id IS NULL AND battle_id IS NULL))
);
CREATE TABLE practice_week_audits (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  start_day INTEGER NOT NULL,
  end_day INTEGER NOT NULL,
  closed_day INTEGER,
  state_json TEXT NOT NULL CHECK(json_valid(state_json) AND length(state_json)<=8000),
  PRIMARY KEY(owner,habit_id,start_day),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id)
);
CREATE INDEX practice_audit_pending ON practice_week_audits(owner,closed_day,end_day);
CREATE TABLE game_days (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL CHECK(end_at>start_at),
  mode TEXT NOT NULL CHECK(mode IN('idle','practice','battle')),
  practice_id TEXT,
  battle_id TEXT,
  rule TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  settled_at INTEGER NOT NULL,
  PRIMARY KEY(owner,day)
);
CREATE TABLE game_receipts (
  owner TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK(json_valid(request_json)),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,request_id)
);
