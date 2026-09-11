ALTER TABLE outbox ADD COLUMN sent_at INTEGER;
CREATE TABLE memory_confirmations (
 owner TEXT NOT NULL, id TEXT NOT NULL, expires INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 PRIMARY KEY(owner,id)
);
