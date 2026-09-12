ALTER TABLE command_inbox ADD COLUMN tool_context TEXT;
ALTER TABLE command_inbox ADD COLUMN tool_reply TEXT;
CREATE TABLE tool_steps (
 owner TEXT NOT NULL,
 update_id INTEGER NOT NULL,
 step_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('model','read','write')),
 state TEXT NOT NULL CHECK(state IN ('started','done','failed')),
 request_json TEXT NOT NULL,
 result_json TEXT,
 created INTEGER NOT NULL,
 PRIMARY KEY(owner,update_id,step_key),
 FOREIGN KEY(owner,update_id) REFERENCES command_inbox(owner,update_id)
);
CREATE UNIQUE INDEX tool_one_write_per_turn ON tool_steps(owner,update_id) WHERE kind='write';
CREATE TABLE pending_tool_actions (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 tool_name TEXT NOT NULL,
 args_json TEXT NOT NULL,
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','expired')),
 expires INTEGER NOT NULL,
 origin_update_id INTEGER NOT NULL,
 UNIQUE(owner,origin_update_id)
);
CREATE UNIQUE INDEX tool_one_pending_per_owner ON pending_tool_actions(owner) WHERE status='pending';
/* Old intent-specific prompts must never be executed as tool confirmations. */
UPDATE conversation_pending SET expires=0;
