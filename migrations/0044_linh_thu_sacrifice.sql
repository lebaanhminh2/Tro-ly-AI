/* Retain consumed individuals for discoveries, role history and stable numbering. */
ALTER TABLE beasts ADD COLUMN is_protected INTEGER NOT NULL DEFAULT 0 CHECK(is_protected IN(0,1));
ALTER TABLE beasts ADD COLUMN sacrificed_at INTEGER;
CREATE INDEX beasts_active_species ON beasts(owner,species_id,acquired_at DESC,id DESC) WHERE sacrificed_at IS NULL;
