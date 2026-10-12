ALTER TABLE game_accounts ADD COLUMN rank_lock_until_day INTEGER;
CREATE TABLE battles (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  boss_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('prepared','active','won','awaiting_rescue','dead','expired','withdrawn','cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  starts_day INTEGER NOT NULL,
  state_json TEXT NOT NULL CHECK(json_valid(state_json) AND length(state_json)<=24000),
  content_json TEXT NOT NULL CHECK(json_valid(content_json) AND length(content_json)<=8000),
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE INDEX battle_history ON battles(owner,created DESC,id);
CREATE UNIQUE INDEX one_live_battle ON battles(owner)
  WHERE status IN('prepared','active','awaiting_rescue');
CREATE TABLE battle_choices (
  owner TEXT NOT NULL,
  battle_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  technique_id TEXT NOT NULL,
  accept_cost INTEGER NOT NULL CHECK(accept_cost IN(0,1)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,battle_id,day),
  FOREIGN KEY(owner,battle_id) REFERENCES battles(owner,id)
);
CREATE TABLE battle_events (
  owner TEXT NOT NULL,
  battle_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  day INTEGER NOT NULL,
  kind TEXT NOT NULL,
  entries_json TEXT NOT NULL CHECK(json_valid(entries_json) AND length(entries_json)<=16000),
  result_json TEXT NOT NULL CHECK(json_valid(result_json) AND length(result_json)<=8000),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,battle_id,sequence),
  FOREIGN KEY(owner,battle_id) REFERENCES battles(owner,id)
);
CREATE TABLE boss_victories (
  owner TEXT NOT NULL,
  boss_id TEXT NOT NULL,
  battle_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,boss_id),
  FOREIGN KEY(owner,battle_id) REFERENCES battles(owner,id)
);
CREATE TABLE battle_task_sources (
  owner TEXT NOT NULL,
  battle_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  PRIMARY KEY(owner,battle_id,task_id),
  FOREIGN KEY(owner,battle_id) REFERENCES battles(owner,id)
);
CREATE TABLE task_battle_awards (
  owner TEXT NOT NULL,
  task_id TEXT NOT NULL,
  battle_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,task_id),
  FOREIGN KEY(owner,battle_id) REFERENCES battles(owner,id)
);
