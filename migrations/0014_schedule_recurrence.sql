CREATE TABLE schedule_settings(
 owner TEXT PRIMARY KEY,start_minutes INTEGER NOT NULL DEFAULT 270 CHECK(start_minutes BETWEEN 0 AND 1439),
 sleep_minutes INTEGER CHECK(sleep_minutes BETWEEN 0 AND 1439),
 version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,
 CHECK(sleep_minutes IS NULL OR sleep_minutes!=start_minutes)
);
CREATE TABLE schedule_days(
 owner TEXT NOT NULL,day INTEGER NOT NULL,start_at INTEGER NOT NULL,target_sleep INTEGER NOT NULL,end_at INTEGER NOT NULL,
 intervals_json TEXT NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 1,
 morning_message_id INTEGER,asleep_at INTEGER,last_chat_at INTEGER,
 PRIMARY KEY(owner,day),CHECK(start_at<target_sleep AND target_sleep<end_at)
);
CREATE TABLE recurrence_rules(
 id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('once','daily','weekdays')),
 times_json TEXT NOT NULL,weekdays_json TEXT NOT NULL DEFAULT '[]',start_date TEXT NOT NULL,end_date TEXT,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),version INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL
);
CREATE INDEX recurrence_owner ON recurrence_rules(owner,enabled);
CREATE TABLE recurrence_occurrences(
 id TEXT PRIMARY KEY,rule_id TEXT NOT NULL REFERENCES recurrence_rules(id),owner TEXT NOT NULL,
 rule_version INTEGER NOT NULL,slot TEXT NOT NULL,due INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','queued','sent','cancelled','skipped_rest','missed')),
 message_id INTEGER,UNIQUE(rule_id,rule_version,slot)
);
CREATE INDEX occurrences_due ON recurrence_occurrences(owner,status,due);
