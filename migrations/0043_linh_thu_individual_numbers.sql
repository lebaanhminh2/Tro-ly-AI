/* Public numbers belong to an individual, independently of its training attempts. */
ALTER TABLE beasts ADD COLUMN individual_number INTEGER CHECK(individual_number BETWEEN 1 AND 9007199254740990);

WITH numbered AS (
  SELECT owner,id,ROW_NUMBER() OVER (PARTITION BY owner,species_id ORDER BY acquired_at,id) AS number
  FROM beasts
)
UPDATE beasts SET individual_number=(SELECT number FROM numbered WHERE numbered.owner=beasts.owner AND numbered.id=beasts.id);

CREATE UNIQUE INDEX beasts_individual_number ON beasts(owner,species_id,individual_number);

CREATE TABLE beast_number_counters (
  owner TEXT NOT NULL,
  species_id TEXT NOT NULL,
  next_number INTEGER NOT NULL CHECK(next_number BETWEEN 2 AND 9007199254740991),
  PRIMARY KEY(owner,species_id),
  FOREIGN KEY(owner) REFERENCES beast_accounts(owner)
);
INSERT INTO beast_number_counters(owner,species_id,next_number)
SELECT owner,species_id,MAX(individual_number)+1 FROM beasts GROUP BY owner,species_id;

/* Keep older writers compatible while the Worker version is being deployed. */
CREATE TRIGGER assign_beast_individual_number AFTER INSERT ON beasts WHEN NEW.individual_number IS NULL
BEGIN
  INSERT INTO beast_number_counters(owner,species_id,next_number) VALUES(NEW.owner,NEW.species_id,2)
  ON CONFLICT(owner,species_id) DO UPDATE SET next_number=beast_number_counters.next_number+1;
  UPDATE beasts SET individual_number=(SELECT next_number-1 FROM beast_number_counters WHERE owner=NEW.owner AND species_id=NEW.species_id)
  WHERE owner=NEW.owner AND id=NEW.id;
END;
