CREATE TABLE browser_pairings (
 verifier_hash TEXT PRIMARY KEY,
 code_hash TEXT NOT NULL UNIQUE,
 client_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 approved_owner TEXT,
 consumed_at INTEGER
);
CREATE INDEX browser_pairings_client ON browser_pairings(client_hash,created_at);
CREATE INDEX browser_pairings_expiry ON browser_pairings(expires_at);
CREATE TABLE browser_sessions (
 token_hash TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX browser_sessions_expiry ON browser_sessions(expires_at);
