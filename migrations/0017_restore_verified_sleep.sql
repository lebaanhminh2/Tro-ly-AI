/* Repair only the verified legacy /ngu fallback. Preserve explicit pauses,
   scores, cancelled reminders, and newer sleep reports. */
INSERT INTO sleep_reports(owner,reported_at)
SELECT i.owner,i.created FROM command_inbox i
JOIN reminder_preferences p ON p.owner=i.owner
WHERE i.owner='7526832102' AND i.update_id=889456715
 AND i.created=1789321461968 AND i.state='done'
 AND json_extract(i.payload,'$.text')='/ngu'
 AND p.pause_until=1789335000000
ON CONFLICT(owner) DO UPDATE SET reported_at=MAX(sleep_reports.reported_at,excluded.reported_at);
UPDATE reminder_preferences SET pause_until=0
WHERE owner='7526832102' AND pause_until=1789335000000
 AND EXISTS(SELECT 1 FROM command_inbox i WHERE i.owner=reminder_preferences.owner
  AND i.update_id=889456715 AND i.created=1789321461968 AND i.state='done'
  AND json_extract(i.payload,'$.text')='/ngu');
