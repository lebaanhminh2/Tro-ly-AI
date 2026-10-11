CREATE TABLE habit_reminder_links (
  owner TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  rule_id TEXT NOT NULL UNIQUE,
  PRIMARY KEY(owner,habit_id),
  FOREIGN KEY(owner,habit_id) REFERENCES habits(owner,id),
  FOREIGN KEY(rule_id) REFERENCES recurrence_rules(id)
);
