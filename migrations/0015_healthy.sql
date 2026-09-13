CREATE TABLE cultivation_accounts(
 owner TEXT PRIMARY KEY,state_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL
);
CREATE TABLE cultivation_receipts(
 owner TEXT NOT NULL,request_id TEXT NOT NULL,operation TEXT NOT NULL,request_json TEXT NOT NULL,
 result_json TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,request_id)
);
CREATE TABLE sleep_assessments(
 owner TEXT NOT NULL,day INTEGER NOT NULL,target INTEGER NOT NULL,reported_at INTEGER,
 result TEXT NOT NULL CHECK(result IN ('on_time','late','unreported')),
 qi_delta INTEGER NOT NULL,demoted INTEGER NOT NULL,assessed_at INTEGER NOT NULL,PRIMARY KEY(owner,day)
);
CREATE TABLE task_ticket_awards(
 owner TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),created INTEGER NOT NULL,PRIMARY KEY(owner,task_id)
);
