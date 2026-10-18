import { query, type Database } from './database.ts';
import { ScheduleStore } from './schedule-store.ts';
import { occurrences, type RecurrenceRule, validateRule } from '../../domain/recurrence.ts';
type RuleRow = {
  id: string;
  owner: string;
  title: string;
  kind: RecurrenceRule['kind'];
  times_json: string;
  weekdays_json: string;
  start_date: string;
  end_date: string | null;
  enabled: number;
  version: number;
};
const ruleDTO = (r: RuleRow): RecurrenceRule => ({
  id: r.id,
  owner: r.owner,
  title: r.title,
  kind: r.kind,
  times: JSON.parse(r.times_json) as string[],
  weekdays: JSON.parse(r.weekdays_json) as number[],
  startDate: r.start_date,
  endDate: r.end_date,
  enabled: !!r.enabled,
  version: r.version,
});
export class RecurrenceStore {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }
  async get(owner: string, id: string): Promise<RecurrenceRule | null> {
    const r = await query(
      this.db,
      'SELECT * FROM recurrence_rules WHERE owner=? AND id=?',
      owner,
      id,
    ).first<RuleRow>();
    return r ? ruleDTO(r) : null;
  }
  async rules(owner: string) {
    return (await this.page(owner)).rules;
  }
  async page(owner: string, offset = 0) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw Error('INVALID_PAGE');
    const rows = (
      await query(
        this.db,
        'SELECT * FROM recurrence_rules WHERE owner=? ORDER BY enabled DESC,created DESC,id LIMIT 101 OFFSET ?',
        owner,
        offset,
      ).all<RuleRow>()
    ).results;
    return {
      rules: rows.slice(0, 100).map(ruleDTO),
      nextCursor: rows.length > 100 ? offset + 100 : null,
    };
  }
  async visiblePage(owner: string, offset: number, visibleStart: number) {
    const page = await this.page(owner, offset);
    const latest = (
      await query(
        this.db,
        `SELECT rule_id,due,status FROM (
    SELECT o.rule_id,o.due,o.status,ROW_NUMBER() OVER(PARTITION BY o.rule_id ORDER BY o.due DESC,o.id DESC) AS position
    FROM recurrence_occurrences o JOIN recurrence_rules r ON r.owner=o.owner AND r.id=o.rule_id AND r.version=o.rule_version
    WHERE o.owner=? AND o.rule_id IN(SELECT value FROM json_each(?))
  ) WHERE position=1`,
        owner,
        JSON.stringify(page.rules.map((rule) => rule.id)),
      ).all<{ rule_id: string; due: number; status: string }>()
    ).results;
    const occurrence = new Map(latest.map((row) => [row.rule_id, row]));
    return {
      nextCursor: page.nextCursor,
      rules: page.rules
        .filter(
          (rule) =>
            rule.kind !== 'once' ||
            Math.max(
              occurrence.get(rule.id)?.due ?? 0,
              ...rule.times.map((time) => Date.parse(rule.startDate + 'T' + time + ':00+07:00')),
            ) >= visibleStart,
        )
        .map((rule) => ({
          ...rule,
          ...(rule.kind === 'once' && occurrence.get(rule.id)
            ? {
                delivered: occurrence.get(rule.id)!.status === 'sent',
                past: ['sent', 'missed', 'skipped_rest', 'cancelled'].includes(
                  occurrence.get(rule.id)!.status,
                ),
              }
            : {}),
        })),
    };
  }
  saveStatements(rule: RecurrenceRule, expectedVersion: number, now: number) {
    validateRule(rule);
    if (rule.version !== expectedVersion + 1) throw Error('INVALID_RULE_VERSION');
    return [
      query(
        this.db,
        'INSERT INTO transaction_guard SELECT CASE WHEN (?=0 AND NOT EXISTS(SELECT 1 FROM recurrence_rules WHERE id=?)) OR EXISTS(SELECT 1 FROM recurrence_rules WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END',
        expectedVersion,
        rule.id,
        rule.owner,
        rule.id,
        expectedVersion,
      ),
      query(
        this.db,
        'INSERT INTO recurrence_rules(id,owner,title,kind,times_json,weekdays_json,start_date,end_date,enabled,version,created) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,kind=excluded.kind,times_json=excluded.times_json,weekdays_json=excluded.weekdays_json,start_date=excluded.start_date,end_date=excluded.end_date,enabled=excluded.enabled,version=excluded.version WHERE recurrence_rules.owner=excluded.owner',
        rule.id,
        rule.owner,
        rule.title,
        rule.kind,
        JSON.stringify(rule.times),
        JSON.stringify(rule.weekdays),
        rule.startDate,
        rule.endDate,
        Number(rule.enabled),
        rule.version,
        now,
      ),
      query(
        this.db,
        "UPDATE recurrence_occurrences SET status='cancelled' WHERE owner=? AND rule_id=? AND status IN ('scheduled','queued')",
        rule.owner,
        rule.id,
      ),
      query(this.db, 'DELETE FROM transaction_guard'),
    ];
  }
  async save(rule: RecurrenceRule, expectedVersion: number, now: number) {
    await this.db.batch(this.saveStatements(rule, expectedVersion, now));
  }
  async materialize(owner: string, from: number, to: number) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 32 * 86400000)
      throw Error('INVALID_OCCURRENCE_WINDOW');
    const cursor = await query(
      this.db,
      'SELECT after_id FROM recurrence_scan WHERE owner=?',
      owner,
    ).first<{ after_id: string }>();
    const fromDate = new Date(from + 25200000).toISOString().slice(0, 10),
      toDate = new Date(to + 25200000).toISOString().slice(0, 10);
    const rows = (
      await query(
        this.db,
        `SELECT * FROM recurrence_rules WHERE owner=? AND enabled=1 AND id>?
    AND start_date<=? AND (end_date IS NULL OR end_date>=?) AND (kind!='once' OR start_date>=?) ORDER BY id LIMIT 20`,
        owner,
        cursor?.after_id ?? '',
        toDate,
        fromDate,
        fromDate,
      ).all<RuleRow>()
    ).results;
    await this.materializeRules(rows.map(ruleDTO), from, to);
    // Resume next cron instead of silently rescanning the first page forever.
    await query(
      this.db,
      'INSERT INTO recurrence_scan(owner,after_id) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET after_id=excluded.after_id',
      owner,
      rows.length === 20 ? rows.at(-1)!.id : '',
    ).run();
  }
  private async materializeRules(rules: RecurrenceRule[], from: number, to: number) {
    const items = rules.flatMap((rule) => occurrences(rule, from, to));
    // One SQL statement per bounded JSON page, rather than one query per slot.
    // Deterministic keys preserve skipped and moved occurrences.
    for (let i = 0; i < items.length; i += 50) {
      await query(
        this.db,
        `INSERT OR IGNORE INTO recurrence_occurrences(id,rule_id,owner,rule_version,slot,due)
      SELECT json_extract(o.value,'$.id'),json_extract(o.value,'$.ruleId'),json_extract(o.value,'$.owner'),json_extract(o.value,'$.version'),json_extract(o.value,'$.slot'),json_extract(o.value,'$.due') FROM json_each(?) o
      WHERE EXISTS(SELECT 1 FROM recurrence_rules WHERE id=json_extract(o.value,'$.ruleId') AND owner=json_extract(o.value,'$.owner') AND enabled=1 AND version=json_extract(o.value,'$.version'))
      AND (NOT EXISTS(SELECT 1 FROM habit_reminder_links WHERE owner=json_extract(o.value,'$.owner') AND rule_id=json_extract(o.value,'$.ruleId')) OR NOT EXISTS(
        SELECT 1 FROM recurrence_occurrences prior JOIN outbox b ON b.id='recurring:'||prior.id
        WHERE prior.owner=json_extract(o.value,'$.owner') AND prior.rule_id=json_extract(o.value,'$.ruleId') AND prior.slot=json_extract(o.value,'$.slot') AND b.state IN('sending','sent','uncertain')))`,
        JSON.stringify(items.slice(i, i + 50)),
      ).run();
    }
  }
  async queueDue(owner: string, now: number, resting: boolean) {
    // Sleep stops work prompts, not explicitly requested personal reminders.
    resting = resting || (await new ScheduleStore(this.db).personalRemindersPaused(owner, now));
    // A short look-back tolerates cron jitter; old occurrences become missed,
    // never an accumulated notification debt after downtime.
    await this.materialize(owner, now - 3600000, now + 86400000);
    await query(
      this.db,
      "UPDATE recurrence_occurrences SET status='missed' WHERE owner=? AND status='scheduled' AND due<?",
      owner,
      now - 3600000,
    ).run();
    const rows = (
      await query(
        this.db,
        "SELECT o.id,o.due,o.rule_id,o.rule_version,r.title FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id AND r.owner=o.owner WHERE o.owner=? AND o.status='scheduled' AND o.due<=? AND r.enabled=1 AND r.version=o.rule_version ORDER BY o.due LIMIT 20",
        owner,
        now,
      ).all<{ id: string; due: number; rule_id: string; rule_version: number; title: string }>()
    ).results;
    if (!rows.length) return;
    const ids = JSON.stringify(rows.map((row) => row.id));
    if (resting) {
      await query(
        this.db,
        "UPDATE recurrence_occurrences SET status='skipped_rest' WHERE owner=? AND id IN(SELECT value FROM json_each(?)) AND status='scheduled' AND due<=?",
        owner,
        ids,
        now,
      ).run();
      return;
    }
    // Queue this bounded page in one transaction, with current status/due/version
    // checks so a concurrent skip or move cannot enqueue a stale notification.
    await this.db.batch([
      query(
        this.db,
        `INSERT OR IGNORE INTO outbox(id,payload,available,reminder_id)
        SELECT 'recurring:'||o.id,json_object('method','sendMessage','chat_id',?,'text',r.title||?),?,'recurring:'||o.id
        FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id AND r.owner=o.owner
        WHERE o.owner=? AND o.id IN(SELECT value FROM json_each(?)) AND o.status='scheduled' AND o.due<=? AND r.enabled=1 AND r.version=o.rule_version`,
        Number(owner),
        ' · đến giờ cậu hẹn rồi nhé.',
        now,
        owner,
        ids,
        now,
      ),
      query(
        this.db,
        "UPDATE recurrence_occurrences SET status='queued' WHERE owner=? AND id IN(SELECT value FROM json_each(?)) AND status='scheduled' AND due<=? AND EXISTS(SELECT 1 FROM outbox WHERE id='recurring:'||recurrence_occurrences.id)",
        owner,
        ids,
        now,
      ),
    ]);
  }
  async next(owner: string, ruleId: string, now: number) {
    const rule = await this.get(owner, ruleId);
    if (!rule || !rule.enabled) return null;
    await this.materializeRules([rule], now, now + 8 * 86400000);
    return query(
      this.db,
      "SELECT id,rule_version,due,slot FROM recurrence_occurrences WHERE owner=? AND rule_id=? AND rule_version=? AND status IN ('scheduled','queued') AND due>=? AND NOT EXISTS(SELECT 1 FROM outbox b WHERE b.id='recurring:'||recurrence_occurrences.id AND b.state IN ('sending','sent','uncertain')) ORDER BY due LIMIT 1",
      owner,
      ruleId,
      rule.version,
      now,
    ).first<{ id: string; rule_version: number; due: number; slot: string }>();
  }
  async skip(owner: string, id: string, version: number) {
    const result = await query(
      this.db,
      "UPDATE recurrence_occurrences SET status='cancelled' WHERE owner=? AND id=? AND rule_version=? AND status IN ('scheduled','queued')",
      owner,
      id,
      version,
    ).run();
    return result.meta.changes > 0;
  }
}
