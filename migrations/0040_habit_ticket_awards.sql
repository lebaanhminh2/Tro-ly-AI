/* New completions only. Historical logs and settlements do not mint tickets. */
CREATE TABLE habit_ticket_awards (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  week_start INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY(owner,habit_id,day),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id)
);
CREATE INDEX habit_ticket_week ON habit_ticket_awards(owner,habit_id,week_start,day);
