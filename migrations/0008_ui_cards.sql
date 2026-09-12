CREATE TABLE ui_cards (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 chat_id INTEGER NOT NULL,
 message_id INTEGER,
 revision INTEGER NOT NULL CHECK(revision>=1),
 rendered_revision INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL CHECK(status IN ('active','completed','expired')),
 view_json TEXT NOT NULL,
 expires INTEGER NOT NULL,
 lease_token TEXT,
 lease_until INTEGER,
 UNIQUE(owner,chat_id,message_id)
);
CREATE INDEX ui_cards_owner ON ui_cards(owner,status,expires);
CREATE TABLE ui_actions (
 token TEXT PRIMARY KEY,
 card_id TEXT NOT NULL REFERENCES ui_cards(id),
 owner TEXT NOT NULL,
 revision INTEGER NOT NULL,
 action TEXT NOT NULL,
 consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0,1))
);
CREATE INDEX ui_actions_card ON ui_actions(card_id,revision);
CREATE TABLE ui_deliveries (
 id TEXT PRIMARY KEY,
 card_id TEXT NOT NULL REFERENCES ui_cards(id),
 revision INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','superseded','failed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 claim_token TEXT,
 available INTEGER NOT NULL,
 UNIQUE(card_id,revision)
);
CREATE INDEX ui_deliveries_due ON ui_deliveries(state,available);
CREATE TABLE ui_calendar_receipts (
 owner TEXT NOT NULL,
 update_id INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('started','done')),
 view_json TEXT,
 PRIMARY KEY(owner,update_id)
);
