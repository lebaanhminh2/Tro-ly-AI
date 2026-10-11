CREATE TABLE habit_accounts (
  owner TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0)
);
CREATE TABLE habits (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_day INTEGER NOT NULL,
  archived_from INTEGER,
  next_day INTEGER NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE INDEX habits_settlement ON habits(owner,next_day);
CREATE TABLE habit_revisions (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  from_day INTEGER NOT NULL,
  definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  archived_from INTEGER,
  PRIMARY KEY(owner,habit_id,from_day),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id)
);
CREATE TABLE habit_days (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL CHECK(end_at>start_at),
  PRIMARY KEY(owner,day)
);
CREATE TABLE habit_logs (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  value INTEGER NOT NULL CHECK(value>=0 AND value<=100000000),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=300),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,habit_id,day),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id),
  FOREIGN KEY(owner,day) REFERENCES habit_days(owner,day)
);
CREATE INDEX habit_logs_history ON habit_logs(owner,day DESC,habit_id);
CREATE TABLE habit_periods (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  start_day INTEGER NOT NULL,
  period_json TEXT NOT NULL CHECK(json_valid(period_json)),
  PRIMARY KEY(owner,habit_id,start_day),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id)
);
CREATE TABLE habit_outcomes (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  revision_day INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN('achieved','missed','neutral')),
  reason TEXT NOT NULL,
  value INTEGER NOT NULL CHECK(value>=0),
  successes INTEGER NOT NULL CHECK(successes IN(0,1)),
  misses INTEGER NOT NULL CHECK(misses IN(0,1)),
  receiver_json TEXT CHECK(receiver_json IS NULL OR json_valid(receiver_json)),
  game_applied INTEGER NOT NULL DEFAULT 0 CHECK(game_applied IN(0,1)),
  settled_at INTEGER NOT NULL,
  PRIMARY KEY(owner,habit_id,day),
  FOREIGN KEY(owner,habit_id,revision_day) REFERENCES habit_revisions(owner,habit_id,from_day)
);
CREATE INDEX habit_outcomes_history ON habit_outcomes(owner,day DESC,habit_id);
CREATE INDEX habit_outcomes_game ON habit_outcomes(owner,game_applied,day);
CREATE TABLE habit_receipts (
  owner TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK(json_valid(request_json)),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,request_id)
);
