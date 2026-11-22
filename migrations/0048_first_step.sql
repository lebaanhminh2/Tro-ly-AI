CREATE TABLE first_step_occurrences (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN('timer','outside')),
  status TEXT NOT NULL CHECK(status IN('active','completed','canceled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  started_at INTEGER NOT NULL CHECK(started_at>=0),
  ends_at INTEGER NOT NULL,
  completed_at INTEGER,
  canceled_at INTEGER,
  PRIMARY KEY(owner,id),
  CHECK((source='timer' AND ends_at-started_at=300000) OR
        (source='outside' AND status='completed' AND ends_at=started_at)),
  CHECK((status='active' AND completed_at IS NULL AND canceled_at IS NULL) OR
        (status='completed' AND completed_at IS NOT NULL AND canceled_at IS NULL) OR
        (status='canceled' AND completed_at IS NULL AND canceled_at IS NOT NULL))
);
CREATE UNIQUE INDEX first_step_one_active ON first_step_occurrences(owner) WHERE status='active';
