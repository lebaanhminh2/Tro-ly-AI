ALTER TABLE practice_versions ADD COLUMN maintained INTEGER NOT NULL DEFAULT 1 CHECK(maintained IN(0,1));
ALTER TABLE practice_versions ADD COLUMN strength_score INTEGER NOT NULL DEFAULT 0 CHECK(strength_score>=0);
CREATE TABLE practice_tier_sources (
  owner TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 4),
  habit_id TEXT NOT NULL,
  successes_milli INTEGER NOT NULL CHECK(successes_milli>=0),
  misses_milli INTEGER NOT NULL CHECK(misses_milli>=0),
  cadence_json TEXT NOT NULL CHECK(json_valid(cadence_json)),
  PRIMARY KEY(owner,practice_id,tier,habit_id),
  FOREIGN KEY(owner,practice_id) REFERENCES practice_versions(owner,id)
);
CREATE INDEX practice_maintained ON practice_versions(owner,technique_id,maintained);
UPDATE practice_versions SET strength_score =
  CASE WHEN json_array_length(state_json,'$.tiers')=0 THEN 0 ELSE
    CAST((1000 + (json_array_length(state_json,'$.tiers')-1)*180) *
    (400 + CAST(json_extract(state_json,'$.tiers[#-1].purityBp')*0.06 AS INTEGER)) / 10 AS INTEGER)
  END;
WITH ranked AS (
  SELECT owner,id,technique_id,ROW_NUMBER() OVER(PARTITION BY owner,technique_id ORDER BY
    json_array_length(state_json,'$.tiers') DESC,strength_score DESC,created DESC,id) AS place
  FROM practice_versions
), choices AS (
  SELECT owner,practice_id,ROW_NUMBER() OVER(PARTITION BY owner ORDER BY from_day DESC) AS place
  FROM game_selections WHERE mode='practice'
), alternatives AS (
  SELECT p.owner,p.id,ROW_NUMBER() OVER(PARTITION BY p.owner,p.technique_id ORDER BY
    CASE WHEN p.id=(SELECT practice_id FROM choices c WHERE c.owner=p.owner AND c.place=1) THEN 0 ELSE 1 END,
    json_array_length(p.state_json,'$.tiers') DESC,p.strength_score DESC,p.created DESC,p.id) AS place
  FROM practice_versions p WHERE NOT EXISTS(SELECT 1 FROM ranked r WHERE r.owner=p.owner AND r.id=p.id AND r.place=1)
)
UPDATE practice_versions SET maintained=0 WHERE NOT EXISTS(
  SELECT 1 FROM ranked r WHERE r.owner=practice_versions.owner AND r.id=practice_versions.id AND r.place=1
) AND NOT EXISTS(
  SELECT 1 FROM alternatives a WHERE a.owner=practice_versions.owner AND a.id=practice_versions.id AND a.place=1
);
