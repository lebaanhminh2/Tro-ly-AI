ALTER TABLE habits ADD COLUMN display_order TEXT;
CREATE INDEX habits_display_order ON habits(owner, COALESCE(display_order, printf('%016d',created)||':'||id));
