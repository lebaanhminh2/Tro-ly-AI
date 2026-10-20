/* Preserve every previously attained form, including archived attempts.
   Historical attempts remain the account's permanent discovery record after a reset. */
ALTER TABLE beast_attempts ADD COLUMN form INTEGER NOT NULL DEFAULT 1 CHECK(form BETWEEN 1 AND 4);
UPDATE beast_attempts SET form = 1
  + CASE WHEN earned + gray >= json_extract(thresholds_json, '$[0]') THEN 1 ELSE 0 END
  + CASE WHEN earned + gray >= json_extract(thresholds_json, '$[1]') THEN 1 ELSE 0 END
  + CASE WHEN earned + gray >= json_extract(thresholds_json, '$[2]') THEN 1 ELSE 0 END;
