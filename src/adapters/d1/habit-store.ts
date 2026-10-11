import { assessHabitDay, definitionOnDay, habitPreview, newHabitPeriod,
    type HabitDefinition, type HabitPeriod, type HabitRecord, type HabitRevision } from '../../domain/habits.ts';
import type { HabitChange, HabitDay, HabitHistoryRow, HabitLog, HabitSaved, HabitSnapshot,
    HabitStore, HabitView } from '../../ports/habit-store.ts';
import { query, type Database, type Statement } from './database.ts';
import { ScheduleStore } from './schedule-store.ts';

type HabitRow = { id: string; version: number; created_day: number; archived_from: number | null; next_day: number };
type RevisionRow = { from_day: number; definition_json: string; archived_from: number | null };
type DayRow = { day: number; start_at: number; end_at: number };
const emptyLog = (): HabitLog => ({ value: 0, note: '', version: 0, updatedAt: 0 });
const dayDTO = (row: DayRow): HabitDay => ({ day: row.day, startAt: row.start_at, endAt: row.end_at });
const revisionDTO = (row: RevisionRow): HabitRevision => ({ fromDay: row.from_day,
    definition: JSON.parse(row.definition_json) as HabitDefinition, archivedFrom: row.archived_from });

// The habit aggregate has its own guard and receipts. Logging a habit never
// changes the existing healthy account or mints an ordinary task ticket.
export class D1HabitStore implements HabitStore {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    private async currentDay(owner: string, now: number): Promise<HabitDay> {
        const current = await new ScheduleStore(this.db).ensureDay(owner, now);
        if (!current) throw Error('NO_ACTIVE_DAY');
        await query(this.db, 'INSERT OR IGNORE INTO habit_days(owner,day,start_at,end_at) VALUES(?,?,?,?)',
            owner, current.day, current.start_at, current.end_at).run();
        const row = await query(this.db, 'SELECT day,start_at,end_at FROM habit_days WHERE owner=? AND day=?', owner, current.day).first<DayRow>();
        if (!row || now < row.start_at || now >= row.end_at) throw Error('HABIT_DAY_CLOSED');
        return dayDTO(row);
    }
    private async readHabit(owner: string, id: string, day: number): Promise<HabitRecord | null> {
        const row = await query(this.db, 'SELECT id,version,created_day,archived_from,next_day FROM habits WHERE owner=? AND id=?', owner, id).first<HabitRow>();
        if (!row) return null;
        const revisions = (await query(this.db, `SELECT from_day,definition_json,archived_from FROM habit_revisions
            WHERE owner=? AND habit_id=? AND (from_day=(SELECT MAX(from_day) FROM habit_revisions WHERE owner=? AND habit_id=? AND from_day<=?) OR from_day>?)
            ORDER BY from_day LIMIT 3`, owner, id, owner, id, day, day).all<RevisionRow>()).results.map(revisionDTO);
        const current = revisions.find(revision => revision.fromDay <= day);
        return { id, version: row.version, createdDay: row.created_day,
            archivedFrom: current?.archivedFrom ?? row.archived_from, revisions };
    }
    private async log(owner: string, id: string, day: number): Promise<HabitLog> {
        const row = await query(this.db, 'SELECT value,note,version,updated FROM habit_logs WHERE owner=? AND habit_id=? AND day=?',
            owner, id, day).first<{ value: number; note: string; version: number; updated: number }>();
        return row ? { value: row.value, note: row.note, version: row.version, updatedAt: row.updated } : emptyLog();
    }
    async today(owner: string, now: number, archived = false) {
        const day = await this.currentDay(owner, now);
        const rows = (await query(this.db, `SELECT id FROM habits WHERE owner=?
            ${archived ? '' : 'AND (archived_from IS NULL OR archived_from>?)'} ORDER BY created,id LIMIT 100`,
            ...archived ? [owner] : [owner, day.day]).all<{ id: string }>()).results;
        const habits: HabitView[] = [];
        for (const row of rows) {
            const habit = (await this.readHabit(owner, row.id, day.day))!, revision = definitionOnDay(habit, day.day);
            if (!revision) continue;
            const log = await this.log(owner, row.id, day.day);
            let period = newHabitPeriod(revision.definition, day.day);
            if (revision.definition.cadence.kind === 'weekly' && day.day >= revision.definition.commitmentFrom) {
                // A bounded seven-day projection remains usable while cron is
                // catching up. Only persisted settlement can issue contributions.
                const logs = (await query(this.db, 'SELECT day,value FROM habit_logs WHERE owner=? AND habit_id=? AND day>=? AND day<?',
                    owner, row.id, period.startDay, day.day).all<{ day: number; value: number }>()).results;
                for (let closed = period.startDay; closed < day.day; closed++)
                    period = assessHabitDay(revision.definition, closed, logs.find(item => item.day === closed)?.value ?? 0, period, revision.archivedFrom ?? null).period;
            } else period.closedThrough = day.day - 1;
            habits.push({ habit, definition: revision.definition,
                pending: habit.revisions.find(item => item.fromDay > day.day) ?? null, log,
                preview: habitPreview(habit, day.day, log.value, period) });
        }
        return { day, habits };
    }
    async mutate(owner: string, requestId: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: HabitSnapshot) => { change: HabitChange; result: HabitSaved }): Promise<HabitSaved> {
        if (!/^\d+$/.test(owner) || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw Error('INVALID_HABIT_REQUEST');
        const request = JSON.stringify(input);
        if (request.length > 4000) throw Error('INVALID_HABIT_REQUEST');
        const receipt = await query(this.db, 'SELECT request_json,result_json FROM habit_receipts WHERE owner=? AND request_id=?', owner, requestId)
            .first<{ request_json: string; result_json: string }>();
        if (receipt) {
            if (receipt.request_json !== request) throw Error('REQUEST_ID_REUSED');
            return JSON.parse(receipt.result_json) as HabitSaved;
        }
        const day = await this.currentDay(owner, now);
        const aggregate = await query(this.db, 'SELECT version FROM habit_accounts WHERE owner=?', owner).first<{ version: number }>();
        const habit = typeof input.habitId === 'string' ? await this.readHabit(owner, input.habitId, day.day) : null;
        const active = await query(this.db, 'SELECT COUNT(*) AS n FROM habits WHERE owner=? AND (archived_from IS NULL OR archived_from>?)', owner, day.day).first<{ n: number }>();
        const snapshot: HabitSnapshot = { day, habit, activeCount: active!.n, log: habit ? await this.log(owner, habit.id, day.day) : emptyLog() };
        const { change, result } = apply(snapshot), statements = this.changeStatements(owner, day, now, change);
        try {
            await this.db.batch([
                query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM habit_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END', owner, aggregate?.version ?? 0),
                // The same snapshot is checked in the transaction, not just while
                // constructing it; a concurrent closure cannot admit a new log.
                query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM habit_days WHERE owner=? AND day=? AND start_at<=? AND end_at>?) THEN 1 ELSE 0 END', owner, day.day, now, now),
                ...statements,
                query(this.db, 'INSERT INTO habit_accounts(owner,version) VALUES(?,1) ON CONFLICT(owner) DO UPDATE SET version=version+1', owner),
                query(this.db, 'INSERT INTO habit_receipts(owner,request_id,request_json,result_json,created) VALUES(?,?,?,?,?)', owner, requestId, request, JSON.stringify(result), now),
                query(this.db, 'DELETE FROM transaction_guard'),
            ]);
        } catch (error) {
            const committed = await query(this.db, 'SELECT request_json,result_json FROM habit_receipts WHERE owner=? AND request_id=?', owner, requestId)
                .first<{ request_json: string; result_json: string }>();
            if (committed?.request_json === request) return JSON.parse(committed.result_json) as HabitSaved;
            const next = await query(this.db, 'SELECT version FROM habit_accounts WHERE owner=?', owner).first<{ version: number }>();
            if (next?.version !== aggregate?.version) throw Error('HABIT_CHANGED');
            throw error;
        }
        return result;
    }
    private changeStatements(owner: string, day: HabitDay, now: number, change: HabitChange): Statement[] {
        const id = change.habitId;
        if (change.kind === 'create') return [
            query(this.db, 'INSERT INTO habits(owner,id,created_day,next_day,created,updated) VALUES(?,?,?,?,?,?)', owner, id, day.day, day.day, now, now),
            query(this.db, 'INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES(?,?,?,?)', owner, id, day.day, JSON.stringify(change.definition)),
        ];
        if (change.kind === 'log') return [
            query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM habits WHERE owner=? AND id=? AND version=?) AND COALESCE((SELECT version FROM habit_logs WHERE owner=? AND habit_id=? AND day=?),0)=? AND NOT EXISTS(SELECT 1 FROM habit_outcomes WHERE owner=? AND habit_id=? AND day=?) THEN 1 ELSE 0 END', owner, id, change.habitVersion, owner, id, day.day, change.logVersion, owner, id, day.day),
            query(this.db, 'INSERT INTO habit_logs(owner,habit_id,day,value,note,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,habit_id,day) DO UPDATE SET value=excluded.value,note=excluded.note,version=version+1,updated=excluded.updated', owner, id, day.day, change.value, change.note, now),
        ];
        const guard = query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM habits WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END', owner, id, change.version);
        if (change.kind === 'revision') return [guard,
            // Replace pending future revisions only; closed snapshots survive.
            query(this.db, 'DELETE FROM habit_revisions WHERE owner=? AND habit_id=? AND from_day>?', owner, id, day.day),
            query(this.db, 'INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json,archived_from) VALUES(?,?,?,?,NULL)', owner, id, change.revision.fromDay, JSON.stringify(change.revision.definition)),
            query(this.db, 'UPDATE habits SET version=version+1,archived_from=NULL,updated=? WHERE owner=? AND id=?', now, owner, id),
        ];
        return [guard,
            query(this.db, 'DELETE FROM habit_revisions WHERE owner=? AND habit_id=? AND from_day>?', owner, id, day.day),
            query(this.db, 'INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json,archived_from) SELECT owner,habit_id,?,definition_json,? FROM habit_revisions WHERE owner=? AND habit_id=? AND from_day=(SELECT MAX(from_day) FROM habit_revisions WHERE owner=? AND habit_id=? AND from_day<=?)', change.from, change.from, owner, id, owner, id, day.day),
            query(this.db, 'UPDATE habits SET version=version+1,archived_from=?,updated=? WHERE owner=? AND id=?', change.from, now, owner, id),
        ];
    }
    private async historicDay(owner: string, day: number): Promise<HabitDay> {
        let row = await query(this.db, 'SELECT day,start_at,end_at FROM habit_days WHERE owner=? AND day=?', owner, day).first<DayRow>();
        if (row) return dayDTO(row);
        row = await query(this.db, 'SELECT day,start_at,end_at FROM schedule_days WHERE owner=? AND day=?', owner, day).first<DayRow>();
        if (!row) {
            const previous = await query(this.db, 'SELECT day,start_at,end_at FROM habit_days WHERE owner=? AND day<? ORDER BY day DESC LIMIT 1', owner, day).first<DayRow>();
            if (!previous) throw Error('HABIT_DAY_NOT_FOUND');
            const offset = (day - previous.day) * 86400000;
            row = { day, start_at: previous.start_at + offset, end_at: previous.end_at + offset };
            const next = await query(this.db, 'SELECT start_at FROM schedule_days WHERE owner=? AND day>? ORDER BY day LIMIT 1', owner, day).first<{ start_at: number }>();
            if (next && next.start_at > row.start_at) row.end_at = Math.min(row.end_at, next.start_at);
        }
        await query(this.db, 'INSERT OR IGNORE INTO habit_days(owner,day,start_at,end_at) VALUES(?,?,?,?)', owner, day, row.start_at, row.end_at).run();
        return dayDTO((await query(this.db, 'SELECT day,start_at,end_at FROM habit_days WHERE owner=? AND day=?', owner, day).first<DayRow>())!);
    }
    async settle(owner: string, now: number, limit = 14) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Error('INVALID_HABIT_LIMIT');
        let processed = 0;
        while (processed < limit) {
            const rows = (await query(this.db, 'SELECT id,version,created_day,archived_from,next_day FROM habits WHERE owner=? AND (archived_from IS NULL OR next_day<archived_from) ORDER BY next_day,id LIMIT 1', owner).all<HabitRow>()).results;
            if (!rows.length) break;
            const row = rows[0]!, day = await this.historicDay(owner, row.next_day);
            if (now < day.endAt) break;
            const aggregate = await query(this.db, 'SELECT version FROM habit_accounts WHERE owner=?', owner).first<{ version: number }>();
            const habit = (await this.readHabit(owner, row.id, row.next_day))!, revision = definitionOnDay(habit, row.next_day)!;
            let period = newHabitPeriod(revision.definition, row.next_day);
            const saved = await query(this.db, 'SELECT period_json FROM habit_periods WHERE owner=? AND habit_id=? AND start_day=?', owner, row.id, period.startDay).first<{ period_json: string }>();
            if (saved) period = JSON.parse(saved.period_json) as HabitPeriod;
            if (row.next_day < revision.definition.commitmentFrom) period.closedThrough = row.next_day - 1;
            const log = await this.log(owner, row.id, row.next_day), outcome = assessHabitDay(revision.definition, row.next_day, log.value, period, revision.archivedFrom ?? null);
            try {
                await this.db.batch([
                    query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM habits WHERE owner=? AND id=? AND next_day=? AND version=?) AND COALESCE((SELECT version FROM habit_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END', owner, row.id, row.next_day, row.version, owner, aggregate?.version ?? 0),
                    query(this.db, 'INSERT INTO habit_outcomes(owner,habit_id,day,revision_day,status,reason,value,successes,misses,settled_at) VALUES(?,?,?,?,?,?,?,?,?,?)', owner, row.id, row.next_day, revision.fromDay, outcome.status, outcome.reason, log.value, outcome.successes, outcome.misses, now),
                    query(this.db, 'INSERT INTO habit_periods(owner,habit_id,start_day,period_json) VALUES(?,?,?,?) ON CONFLICT(owner,habit_id,start_day) DO UPDATE SET period_json=excluded.period_json', owner, row.id, period.startDay, JSON.stringify(outcome.period)),
                    query(this.db, 'UPDATE habits SET next_day=next_day+1 WHERE owner=? AND id=?', owner, row.id),
                    query(this.db, 'INSERT INTO habit_accounts(owner,version) VALUES(?,1) ON CONFLICT(owner) DO UPDATE SET version=version+1', owner),
                    query(this.db, 'DELETE FROM transaction_guard'),
                ]);
            } catch (error) {
                const next = await query(this.db, 'SELECT next_day FROM habits WHERE owner=? AND id=?', owner, row.id).first<{ next_day: number }>();
                if (next?.next_day === row.next_day) throw error;
            }
            processed++;
        }
        const pending = await query(this.db, 'SELECT 1 AS found FROM habits h JOIN habit_days d ON d.owner=h.owner AND d.day=h.next_day WHERE h.owner=? AND d.end_at<=? AND (h.archived_from IS NULL OR h.next_day<h.archived_from) LIMIT 1', owner, now).first();
        return { processed, pending: !!pending || processed === limit };
    }
    async history(owner: string, from: number, to: number, habitId: string | null, before: string | null, limit: number) {
        if (![from, to, limit].every(Number.isInteger) || from < 0 || to < from || to - from > 366 || limit < 1 || limit > 100)
            throw Error('INVALID_HABIT_HISTORY');
        let cursorDay = to + 1, cursorId = '';
        if (before) {
            const match = /^(\d+):([a-zA-Z0-9_-]{8,110})$/.exec(before);
            if (!match) throw Error('INVALID_HABIT_CURSOR');
            cursorDay = Number(match[1]); cursorId = match[2]!;
        }
        type Row = { habit_id: string; day: number; definition_json: string; value: number; note: string;
            status: HabitHistoryRow['status']; reason: string; successes: number; misses: number };
        const rows = (await query(this.db, `WITH entries AS (
            SELECT habit_id,day FROM habit_outcomes WHERE owner=? AND day BETWEEN ? AND ?
            UNION SELECT habit_id,day FROM habit_logs WHERE owner=? AND day BETWEEN ? AND ?)
            SELECT e.habit_id,e.day,r.definition_json,COALESCE(l.value,o.value,0) AS value,COALESCE(l.note,'') AS note,
            COALESCE(o.status,'processing') AS status,COALESCE(o.reason,'processing') AS reason,
            COALESCE(o.successes,0) AS successes,COALESCE(o.misses,0) AS misses
            FROM entries e JOIN habit_revisions r ON r.owner=? AND r.habit_id=e.habit_id AND r.from_day=(
              SELECT MAX(from_day) FROM habit_revisions WHERE owner=r.owner AND habit_id=e.habit_id AND from_day<=e.day)
            LEFT JOIN habit_logs l ON l.owner=r.owner AND l.habit_id=e.habit_id AND l.day=e.day
            LEFT JOIN habit_outcomes o ON o.owner=r.owner AND o.habit_id=e.habit_id AND o.day=e.day
            WHERE (? IS NULL OR e.habit_id=?) AND (e.day<? OR (e.day=? AND e.habit_id>?))
            ORDER BY e.day DESC,e.habit_id LIMIT ?`, owner, from, to, owner, from, to, owner, habitId, habitId, cursorDay, cursorDay, cursorId, limit + 1).all<Row>()).results;
        const page = rows.slice(0, limit).map(row => { const definition = JSON.parse(row.definition_json) as HabitDefinition;
            return { habitId: row.habit_id, day: row.day, name: definition.name, definition, value: row.value,
                note: row.note, status: row.status, reason: row.reason, successes: row.successes, misses: row.misses }; });
        const last = page.at(-1);
        return { rows: page, next: rows.length > limit && last ? `${last.day}:${last.habitId}` : null };
    }
}
