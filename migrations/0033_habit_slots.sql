CREATE TABLE habit_slots (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  start_at INTEGER NOT NULL,
  minutes INTEGER NOT NULL CHECK(minutes BETWEEN 5 AND 240 AND minutes%5=0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,habit_id,day),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id),
  FOREIGN KEY(owner,day) REFERENCES habit_days(owner,day)
);
CREATE INDEX habit_slots_time ON habit_slots(owner,start_at);
