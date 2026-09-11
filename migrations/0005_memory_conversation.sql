CREATE TABLE memories(id TEXT NOT NULL,owner TEXT NOT NULL,content TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('preference','temporary')),source TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER,PRIMARY KEY(owner,id));
CREATE TABLE conversation_turns(owner TEXT NOT NULL,command_id INTEGER NOT NULL,user_text TEXT NOT NULL,assistant_text TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(owner,command_id));
CREATE INDEX conversation_recent ON conversation_turns(owner,created);
CREATE TABLE chat_focus(owner TEXT PRIMARY KEY,task_id TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE ai_reservations(scope TEXT NOT NULL,command_key TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(scope,command_key));
CREATE INDEX ai_window ON ai_reservations(scope,created);
CREATE TABLE memory_settings(owner TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)));
