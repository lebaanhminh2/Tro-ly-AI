CREATE TABLE command_inbox (
 owner TEXT NOT NULL, update_id INTEGER NOT NULL, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','done')),
 created INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 delivery INTEGER NOT NULL CHECK(delivery IN (0,1)), result TEXT,
 PRIMARY KEY(owner,update_id)
);
CREATE INDEX command_pending ON command_inbox(state,owner,update_id);
CREATE TABLE owner_leases (owner TEXT PRIMARY KEY, token TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE transaction_guard (valid INTEGER NOT NULL CHECK(valid=1));
CREATE TABLE command_audit (owner TEXT NOT NULL, update_id INTEGER NOT NULL, change_count INTEGER NOT NULL, applied INTEGER NOT NULL,
 PRIMARY KEY(owner,update_id), FOREIGN KEY(owner,update_id) REFERENCES command_inbox(owner,update_id));
ALTER TABLE outbox ADD COLUMN claim_token TEXT;
/* Old updates cannot safely be replayed across this migration, preserved for inspection. */
INSERT INTO command_inbox(owner,update_id,payload,state,created,delivery,result)
 SELECT CAST(chat AS TEXT),id,'{}','done',created,0,NULL FROM updates WHERE chat IS NOT NULL;
