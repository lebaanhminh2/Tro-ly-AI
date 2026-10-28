CREATE TABLE daily_journals (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  achieved TEXT NOT NULL DEFAULT '' CHECK(length(achieved)<=4000),
  lessons TEXT NOT NULL DEFAULT '' CHECK(length(lessons)<=4000),
  tomorrow TEXT NOT NULL DEFAULT '' CHECK(length(tomorrow)<=4000),
  version INTEGER NOT NULL CHECK(version>0),
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  updated INTEGER NOT NULL,
  PRIMARY KEY(owner,day)
);
CREATE TABLE journal_reward_claims (
  owner TEXT NOT NULL,
  day INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,day)
);
CREATE TABLE habit_presentation (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  hidden TEXT NOT NULL DEFAULT '' CHECK(hidden IN ('','archived','deleted')),
  choice_day INTEGER,
  choice TEXT NOT NULL DEFAULT '' CHECK(choice IN ('','deferred','included')),
  reminder_time TEXT,
  PRIMARY KEY(owner,habit_id),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id)
);
