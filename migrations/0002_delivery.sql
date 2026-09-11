ALTER TABLE updates ADD COLUMN chat INTEGER;
ALTER TABLE updates ADD COLUMN response TEXT;
CREATE TABLE outbox (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL,
 lease INTEGER, message_id INTEGER
);
CREATE INDEX outbox_due ON outbox(state,available);
CREATE TRIGGER persist_reply AFTER UPDATE OF response ON updates
WHEN NEW.response IS NOT NULL AND OLD.response IS NULL
BEGIN
 INSERT OR IGNORE INTO outbox(id,payload,available) VALUES('reply:'||NEW.id,NEW.response,NEW.created);
END;
