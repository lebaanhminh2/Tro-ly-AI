CREATE TABLE game_preset_accounts (
  owner TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE game_presets (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  versions_json TEXT NOT NULL CHECK(json_valid(versions_json) AND json_type(versions_json)='array' AND json_array_length(versions_json)<=5 AND length(versions_json)<=1000),
  weapon_id TEXT,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,id)
);
CREATE INDEX game_preset_order ON game_presets(owner,created,id);
CREATE TABLE game_preset_receipts (
  owner TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK(json_valid(request_json)),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,request_id)
);
