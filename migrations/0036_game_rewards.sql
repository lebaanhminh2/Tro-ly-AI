CREATE TABLE game_entitlements (
  owner TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('weapon','achievement')),
  id TEXT NOT NULL,
  battle_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,kind,id),
  FOREIGN KEY(owner,battle_id) REFERENCES battles(owner,id)
);
CREATE INDEX game_entitlement_history ON game_entitlements(owner,created DESC,kind,id);
