/* Notes are user-authored details shown in the Mini App task sheet. */
ALTER TABLE tasks ADD COLUMN note TEXT NOT NULL DEFAULT '';
