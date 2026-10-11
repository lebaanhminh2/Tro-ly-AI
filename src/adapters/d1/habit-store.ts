import { assessHabitDay, definitionOnDay, habitPreview, newHabitPeriod,
    type HabitDefinition, type HabitPeriod, type HabitRecord, type HabitRevision } from '../../domain/habits.ts';
import type { HabitChange, HabitDay, HabitHistoryRow, HabitLog, HabitSaved, HabitSnapshot,
    HabitStore, HabitView, HabitReport } from '../../ports/habit-store.ts';
import { query, type Database, type Statement } from './database.ts';
import { ScheduleStore } from './schedule-store.ts';
import { RecurrenceStore } from './recurrence-store.ts';
import { minutes } from '../../domain/healthy.ts';
import { TimelineStore } from './timeline-store.ts';
import { DayPlanStore } from './day-plan-store.ts';

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
        const rows = (await query(this.db, `SELECT id,version,created_day,archived_from,next_day FROM habits WHERE owner=?
            ${archived ? '' : 'AND (archived_from IS NULL OR archived_from>?)'} ORDER BY created,id LIMIT 100`,
            ...archived ? [owner] : [owner, day.day]).all<HabitRow>()).results;
        if (!rows.length) return { day, habits: [] as HabitView[] };
        const ids = JSON.stringify(rows.map(row => row.id));
        // Fixed query count: loading 30 active habits must fit the free Worker
        // budget just as loading five does. Read at most seven days of logs.
        const [revisions, logs, reminders, slots] = await Promise.all([
            query(this.db, `SELECT habit_id,from_day,definition_json,archived_from FROM habit_revisions r
                WHERE owner=? AND habit_id IN(SELECT value FROM json_each(?)) AND
                (from_day=(SELECT MAX(from_day) FROM habit_revisions WHERE owner=r.owner AND habit_id=r.habit_id AND from_day<=?) OR from_day>?)
                ORDER BY habit_id,from_day LIMIT 300`, owner, ids, day.day, day.day).all<RevisionRow & { habit_id: string }>(),
            query(this.db, `SELECT habit_id,day,value,note,version,updated FROM habit_logs
                WHERE owner=? AND habit_id IN(SELECT value FROM json_each(?)) AND day BETWEEN ? AND ? LIMIT 700`,
                owner, ids, day.day - 6, day.day).all<{ habit_id: string; day: number; value: number; note: string; version: number; updated: number }>(),
            query(this.db, `SELECT l.habit_id,json_extract(r.times_json,'$[0]') AS time FROM habit_reminder_links l
                JOIN recurrence_rules r ON r.owner=l.owner AND r.id=l.rule_id WHERE l.owner=? AND r.enabled=1
                AND l.habit_id IN(SELECT value FROM json_each(?)) LIMIT 100`, owner, ids).all<{ habit_id: string; time: string }>(),
            query(this.db, `SELECT habit_id,start_at AS startAt,minutes,version FROM habit_slots
                WHERE owner=? AND day=? AND habit_id IN(SELECT value FROM json_each(?)) LIMIT 100`, owner, day.day, ids)
                .all<{ habit_id: string; startAt: number; minutes: number; version: number }>(),
        ]);
        const habits: HabitView[] = [];
        for (const row of rows) {
            const history = revisions.results.filter(revision => revision.habit_id === row.id).map(revisionDTO);
            const current = history.find(revision => revision.fromDay <= day.day);
            const habit: HabitRecord = { id: row.id, version: row.version, createdDay: row.created_day,
                archivedFrom: current?.archivedFrom ?? row.archived_from, revisions: history };
            const revision = definitionOnDay(habit, day.day);
            if (!revision) continue;
            const habitLogs = logs.results.filter(log => log.habit_id === row.id);
            const todayLog = habitLogs.find(log => log.day === day.day);
            const log = todayLog ? { value: todayLog.value, note: todayLog.note, version: todayLog.version, updatedAt: todayLog.updated } : emptyLog();
            let period = newHabitPeriod(revision.definition, day.day);
            if (revision.definition.cadence.kind === 'weekly' && day.day >= revision.definition.commitmentFrom) {
                // A bounded seven-day projection remains usable while cron is
                // catching up. Only persisted settlement can issue contributions.
                for (let closed = period.startDay; closed < day.day; closed++)
                    period = assessHabitDay(revision.definition, closed, habitLogs.find(item => item.day === closed)?.value ?? 0, period, revision.archivedFrom ?? null).period;
            } else period.closedThrough = day.day - 1;
            habits.push({ habit, definition: revision.definition,
                pending: habit.revisions.find(item => item.fromDay > day.day) ?? null, log,
                preview: habitPreview(habit, day.day, log.value, period), reminderTime: reminders.results.find(item => item.habit_id === habit.id)?.time ?? null,
                slot: (() => { const slot = slots.results.find(item => item.habit_id === habit.id);
                    return slot ? { startAt: slot.startAt, minutes: slot.minutes, version: slot.version } : null; })() });
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
        const slotOperation = input.operation === 'slot' || input.operation === 'remove_slot';
        if (slotOperation) {
            const timeline = await new TimelineStore(this.db).read(owner, now, habit?.id ?? null);
            snapshot.schedule = { free: timeline?.free ?? [], occupied: (timeline?.blocks ?? []).map(block => ({ start: block.start_at, end: block.start_at + block.minutes * 60000 })) };
        }
        const { change, result } = apply(snapshot), statements = this.changeStatements(owner, day, now, change);
        if ((change.kind === 'create' || change.kind === 'revision') && change.reminderTime !== undefined)
            statements.push(...await this.prepareReminder(owner, day, now, change.habitId, change.reminderTime,
                change.kind === 'create' ? change.definition : change.revision.definition));
        if (change.kind === 'slot') statements.push(...await new DayPlanStore(this.db).prepareHabitReservation(owner, now, day.day,
            { habitId: change.habitId, startAt: change.startAt, minutes: change.minutes }));
        if (change.kind === 'archive') statements.push(...await this.archiveReminder(owner, day, now, change.habitId, change.from!));
        if (change.kind === 'revision' && snapshot.habit?.archivedFrom !== null && change.reminderTime === undefined) {
            const time = await this.reminderTime(owner, change.habitId);
            if (time) statements.push(...await this.prepareReminder(owner, { ...day, day: change.revision.fromDay }, now,
                change.habitId, time, change.revision.definition));
        }
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
    private async reminderTime(owner: string, habitId: string): Promise<string | null> {
        const row = await query(this.db, 'SELECT r.enabled,r.times_json FROM habit_reminder_links l JOIN recurrence_rules r ON r.id=l.rule_id AND r.owner=l.owner WHERE l.owner=? AND l.habit_id=?', owner, habitId)
            .first<{ enabled: number; times_json: string }>();
        return row?.enabled ? (JSON.parse(row.times_json) as string[])[0] ?? null : null;
    }
    private async prepareReminder(owner: string, day: HabitDay, now: number, habitId: string, time: string | null,
        definition: HabitDefinition): Promise<Statement[]> {
        const link = await query(this.db, 'SELECT rule_id FROM habit_reminder_links WHERE owner=? AND habit_id=?', owner, habitId).first<{ rule_id: string }>();
        const existing = link ? await new RecurrenceStore(this.db).get(owner, link.rule_id) : null;
        if (!time && !existing) return [];
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner + ':' + habitId));
        const id = link?.rule_id ?? 'habit-' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        const selectedTime = time ?? existing!.times[0]!;
        const startMinutes = Math.floor((day.startAt + 25200000) / 60000) % 1440;
        const shift = minutes(selectedTime) < startMinutes ? 1 : 0;
        const rule = { id, owner, title: definition.name, kind: definition.cadence.kind === 'weekdays' ? 'weekdays' as const : 'daily' as const,
            times: [selectedTime], weekdays: definition.cadence.kind === 'weekdays' ? definition.cadence.weekdays.map(weekday => (weekday + shift) % 7 + 1) : [],
            startDate: new Date((day.day + shift) * 86400000).toISOString().slice(0, 10), endDate: null,
            enabled: time !== null, version: (existing?.version ?? 0) + 1 };
        return [...new RecurrenceStore(this.db).saveStatements(rule, existing?.version ?? 0, now),
            query(this.db, 'INSERT INTO habit_reminder_links(owner,habit_id,rule_id) VALUES(?,?,?) ON CONFLICT(owner,habit_id) DO UPDATE SET rule_id=excluded.rule_id', owner, habitId, id)];
    }
    private async archiveReminder(owner: string, day: HabitDay, now: number, habitId: string, fromDay: number): Promise<Statement[]> {
        const link = await query(this.db, 'SELECT rule_id FROM habit_reminder_links WHERE owner=? AND habit_id=?', owner, habitId).first<{ rule_id: string }>();
        const rule = link ? await new RecurrenceStore(this.db).get(owner, link.rule_id) : null;
        if (!rule) return [];
        const startMinutes = Math.floor((day.startAt + 25200000) / 60000) % 1440;
        const shift = rule.times.some(time => minutes(time) < startMinutes) ? 1 : 0;
        const cutoff = new Date((fromDay - 1 + shift) * 86400000).toISOString().slice(0, 10);
        return new RecurrenceStore(this.db).saveStatements({ ...rule, version: rule.version + 1,
            endDate: rule.endDate && rule.endDate < cutoff ? rule.endDate : cutoff }, rule.version, now);
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
        if (change.kind === 'slot') return [
            query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM habits WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END', owner, id, change.version),
            change.startAt === null ? query(this.db, 'DELETE FROM habit_slots WHERE owner=? AND habit_id=? AND day=?', owner, id, day.day)
                : query(this.db, 'INSERT INTO habit_slots(owner,habit_id,day,start_at,minutes,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,habit_id,day) DO UPDATE SET start_at=excluded.start_at,minutes=excluded.minutes,version=version+1,updated=excluded.updated', owner, id, day.day, change.startAt, change.minutes, now),
            query(this.db, 'UPDATE habits SET version=version+1,updated=? WHERE owner=? AND id=?', now, owner, id),
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
    async history(owner: string, from: number, to: number, habitId: string | null, before: string | null, limit: number, status = 'all') {
        if (![from, to, limit].every(Number.isInteger) || from < 0 || to < from || to - from > 366 || limit < 1 || limit > 100)
            throw Error('INVALID_HABIT_HISTORY');
        if (!['all', 'achieved', 'missed', 'neutral', 'processing'].includes(status)) throw Error('INVALID_HABIT_HISTORY');
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
            AND (?='all' OR COALESCE(o.status,'processing')=?)
            ORDER BY e.day DESC,e.habit_id LIMIT ?`, owner, from, to, owner, from, to, owner, habitId, habitId, cursorDay, cursorDay, cursorId, status, status, limit + 1).all<Row>()).results;
        const page = rows.slice(0, limit).map(row => { const definition = JSON.parse(row.definition_json) as HabitDefinition;
            return { habitId: row.habit_id, day: row.day, name: definition.name, definition, value: row.value,
                note: row.note, status: row.status, reason: row.reason, successes: row.successes, misses: row.misses }; });
        const last = page.at(-1);
        return { rows: page, next: rows.length > limit && last ? `${last.day}:${last.habitId}` : null };
    }
    async report(owner: string, from: number, to: number, habitId: string | null): Promise<HabitReport> {
        if (![from, to].every(Number.isInteger) || from < 0 || to < from || to - from > 366) throw Error('INVALID_HABIT_HISTORY');
        const days = (await query(this.db, `SELECT day,SUM(successes) AS successes,SUM(misses) AS misses,
            SUM(CASE WHEN status='neutral' THEN 1 ELSE 0 END) AS neutral FROM habit_outcomes
            WHERE owner=? AND day BETWEEN ? AND ? AND (? IS NULL OR habit_id=?) GROUP BY day ORDER BY day`,
            owner, from, to, habitId, habitId).all<HabitReport['days'][number]>()).results;
        // Different units/metrics in revisions are deliberately separate totals.
        const totals = (await query(this.db, `SELECT l.habit_id AS habitId,json_extract(r.definition_json,'$.name') AS name,
            json_extract(r.definition_json,'$.metric') AS metric,json_extract(r.definition_json,'$.unit') AS unit,
            SUM(l.value) AS value,COUNT(*) AS loggedDays FROM habit_logs l JOIN habit_revisions r
              ON r.owner=l.owner AND r.habit_id=l.habit_id AND r.from_day=(SELECT MAX(from_day) FROM habit_revisions
                WHERE owner=l.owner AND habit_id=l.habit_id AND from_day<=l.day)
            WHERE l.owner=? AND l.day BETWEEN ? AND ? AND (? IS NULL OR l.habit_id=?)
            GROUP BY l.habit_id,metric,unit ORDER BY l.habit_id,metric,unit`, owner, from, to, habitId, habitId)
            .all<HabitReport['totals'][number]>()).results;
        const successes = days.reduce((sum, day) => sum + day.successes, 0), misses = days.reduce((sum, day) => sum + day.misses, 0);
        return { from, to, successes, misses, neutral: days.reduce((sum, day) => sum + day.neutral, 0),
            rate: successes + misses ? Math.round(100 * successes / (successes + misses)) : null, days, totals };
    }
}
