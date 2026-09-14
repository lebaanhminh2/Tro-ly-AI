/* Keep completed work available without loading it into the active board forever. */
ALTER TABLE tasks ADD COLUMN archived_at INTEGER;
CREATE INDEX tasks_archive_lookup ON tasks(owner, archived_at, status, deleted_at);
