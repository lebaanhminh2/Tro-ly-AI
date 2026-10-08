/* The current report is reversible for five minutes. Receipts retain each action. */
CREATE TABLE sleep_controls(
 owner TEXT PRIMARY KEY,
 generation INTEGER NOT NULL CHECK(generation>0),
 day INTEGER,
 reported_at INTEGER NOT NULL,
 undo_until INTEGER NOT NULL,
 undone_at INTEGER,
 previous_reported_at INTEGER,
 previous_asleep_at INTEGER,
 before_json TEXT NOT NULL,
 after_json TEXT NOT NULL
);
