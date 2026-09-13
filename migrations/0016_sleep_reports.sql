/* Separate sleep notification state from explicit pauses and scoring. */
CREATE TABLE sleep_reports (owner TEXT PRIMARY KEY, reported_at INTEGER NOT NULL);
INSERT INTO sleep_reports(owner,reported_at)
 SELECT owner,MAX(asleep_at) FROM schedule_days WHERE asleep_at IS NOT NULL GROUP BY owner;
