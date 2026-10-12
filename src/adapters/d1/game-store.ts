import { habitWeekStart, type HabitDefinition } from '../../domain/habits.ts';
import { PRACTICE_RULE, settlePracticeDay, type PracticeSource, type PracticeVersion, type PracticeWeek } from '../../domain/practice.ts';
import { INITIAL_TECHNIQUES, techniqueById } from '../../domain/techniques.ts';
import type { GameChange, GameOverview, GameSaved, GameSelection, GameSnapshot, GameStore, StoredPractice } from '../../ports/game-store.ts';
import type { HabitDay } from '../../ports/habit-store.ts';
import { query, type Database, type Statement } from './database.ts';
import { ScheduleStore } from './schedule-store.ts';

type Account = { version: number; joined_day: number; anchor_start: number; next_day: number };
type SelectionRow = { from_day: number; mode: GameSelection['mode']; practice_id: string | null; battle_id: string | null };
type VersionRow = { id: string; state_json: string; version: number; created: number };
const stored = (row: VersionRow): StoredPractice => ({ practice: JSON.parse(row.state_json) as PracticeVersion, version: row.version, created: row.created });
const selection = (row: SelectionRow): GameSelection => ({ fromDay: row.from_day, mode: row.mode, practiceId: row.practice_id, battleId: row.battle_id });
const idle = (day: number): GameSelection => ({ fromDay: day, mode: 'idle', practiceId: null, battleId: null });

export class D1GameStore implements GameStore {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    private async day(owner: string, now: number): Promise<HabitDay> {
        const day = await new ScheduleStore(this.db).ensureDay(owner, now);
        if (!day) throw Error('NO_ACTIVE_DAY');
        if (now < day.start_at || now >= day.end_at) throw Error('GAME_DAY_CLOSED');
        return { day: day.day, startAt: day.start_at, endAt: day.end_at };
    }
    private account(owner: string) { return query(this.db, 'SELECT version,joined_day,anchor_start,next_day FROM game_accounts WHERE owner=?', owner).first<Account>(); }
    private async owned(owner: string): Promise<string[]> {
        const rows = (await query(this.db, 'SELECT technique_id FROM technique_unlocks WHERE owner=? ORDER BY technique_id LIMIT 50', owner).all<{ technique_id: string }>()).results;
        return [...new Set([...INITIAL_TECHNIQUES, ...rows.map(row => row.technique_id)])];
    }
    private async selected(owner: string, day: number): Promise<GameSelection> {
        const row = await query(this.db, 'SELECT from_day,mode,practice_id,battle_id FROM game_selections WHERE owner=? AND from_day<=? ORDER BY from_day DESC LIMIT 1', owner, day).first<SelectionRow>();
        return row ? selection(row) : idle(day);
    }
    private async pending(owner: string, day: number): Promise<GameSelection | null> {
        const row = await query(this.db, 'SELECT from_day,mode,practice_id,battle_id FROM game_selections WHERE owner=? AND from_day>? ORDER BY from_day LIMIT 1', owner, day).first<SelectionRow>();
        return row ? selection(row) : null;
    }
    private async practice(owner: string, id: string | null): Promise<StoredPractice | null> {
        if (!id) return null;
        const row = await query(this.db, 'SELECT id,state_json,version,created FROM practice_versions WHERE owner=? AND id=?', owner, id).first<VersionRow>();
        return row ? stored(row) : null;
    }
    async read(owner: string, now: number): Promise<GameOverview> {
        const day = await this.day(owner, now);
        const [account, current, pending, owned, audits, recent] = await Promise.all([
            this.account(owner), this.selected(owner, day.day), this.pending(owner, day.day), this.owned(owner),
            query(this.db, 'SELECT state_json FROM practice_week_audits WHERE owner=? AND closed_day IS NULL ORDER BY end_day,habit_id LIMIT 30', owner).all<{ state_json: string }>(),
            query(this.db, 'SELECT day,mode,result_json FROM game_days WHERE owner=? ORDER BY day DESC LIMIT 7', owner).all<{ day: number; mode: string; result_json: string }>(),
        ]);
        const [currentPractice, pendingPractice] = await Promise.all([this.practice(owner, current.practiceId), this.practice(owner, pending?.practiceId ?? null)]);
        return { day, version: account?.version ?? 0, current, pending, currentPractice, pendingPractice, owned,
            settledThrough: account ? account.next_day - 1 : null,
            audits: audits.results.map(row => JSON.parse(row.state_json) as PracticeWeek),
            recent: recent.results.map(row => ({ day: row.day, mode: row.mode, result: JSON.parse(row.result_json) as Record<string, unknown> })) };
    }
    async versions(owner: string, techniqueId: string, before: string | null, limit: number) {
        techniqueById(techniqueId);
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Error('INVALID_GAME_HISTORY');
        let created = Number.MAX_SAFE_INTEGER, id = '';
        if (before) {
            const match = /^(\d+):([a-zA-Z0-9_-]{8,110})$/.exec(before);
            if (!match || !Number.isSafeInteger(Number(match[1]))) throw Error('INVALID_GAME_HISTORY');
            created = Number(match[1]); id = match[2]!;
        }
        const rows = (await query(this.db, `SELECT id,state_json,version,created FROM practice_versions
            WHERE owner=? AND technique_id=? AND (created<? OR (created=? AND id>?)) ORDER BY created DESC,id LIMIT ?`,
            owner, techniqueId, created, created, id, limit + 1).all<VersionRow>()).results;
        const page = rows.slice(0, limit).map(stored), last = page.at(-1);
        return { versions: page, next: rows.length > limit && last ? last.created + ':' + last.practice.id : null };
    }
    async mutate(owner: string, id: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: GameSnapshot) => { change: GameChange; result: GameSaved }): Promise<GameSaved> {
        if (!/^\d+$/.test(owner) || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw Error('INVALID_GAME_REQUEST');
        const request = JSON.stringify(Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key]])));
        if (request.length > 4000) throw Error('INVALID_GAME_REQUEST');
        const committed = await query(this.db, 'SELECT request_json,result_json FROM game_receipts WHERE owner=? AND request_id=?', owner, id).first<{ request_json: string; result_json: string }>();
        if (committed) {
            if (committed.request_json !== request) throw Error('REQUEST_ID_REUSED');
            return JSON.parse(committed.result_json) as GameSaved;
        }
        const day = await this.day(owner, now);
        const [account, current, pending, owned, requestedPractice, prior, created] = await Promise.all([
            this.account(owner), this.selected(owner, day.day), this.pending(owner, day.day), this.owned(owner),
            this.practice(owner, typeof input.practiceId === 'string' ? input.practiceId : null),
            query(this.db, 'SELECT COUNT(*) AS n FROM practice_versions WHERE owner=? AND technique_id=?', owner, typeof input.techniqueId === 'string' ? input.techniqueId : '').first<{ n: number }>(),
            query(this.db, 'SELECT COUNT(*) AS n FROM practice_versions WHERE owner=? AND created_day=?', owner, day.day).first<{ n: number }>(),
        ]);
        const { change, result } = apply({ day, version: account?.version ?? 0, current, pending, owned, requestedPractice,
            priorVersions: prior!.n, createdToday: created!.n });
        const statements: Statement[] = [
            query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM game_accounts WHERE owner=?),0)=? AND EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND start_at<=? AND end_at>?) THEN 1 ELSE 0 END', owner, account?.version ?? 0, owner, day.day, now, now),
            query(this.db, 'INSERT INTO game_accounts(owner,joined_day,anchor_start,next_day,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET version=version+1,updated=excluded.updated', owner, day.day, day.startAt, day.day, now),
        ];
        if (!account) statements.push(...INITIAL_TECHNIQUES.map(techniqueId => query(this.db,
            'INSERT OR IGNORE INTO technique_unlocks(owner,technique_id,source,created) VALUES(?,?,?,?)', owner, techniqueId, 'starter', now)));
        if (change.practice) statements.push(query(this.db, 'INSERT INTO practice_versions(owner,id,technique_id,state_json,created_day,created,updated) VALUES(?,?,?,?,?,?,?)',
            owner, change.practice.id, change.practice.techniqueId, JSON.stringify(change.practice), day.day, now, now));
        statements.push(
            query(this.db, 'DELETE FROM game_selections WHERE owner=? AND from_day>?', owner, day.day),
            query(this.db, 'INSERT INTO game_selections(owner,from_day,mode,practice_id,battle_id,created) VALUES(?,?,?,?,?,?)',
                owner, change.selection.fromDay, change.selection.mode, change.selection.practiceId, change.selection.battleId, now),
            query(this.db, 'INSERT INTO game_receipts(owner,request_id,request_json,result_json,created) VALUES(?,?,?,?,?)', owner, id, request, JSON.stringify(result), now),
            query(this.db, 'DELETE FROM transaction_guard'),
        );
        try { await this.db.batch(statements); }
        catch (error) {
            const receipt = await query(this.db, 'SELECT request_json,result_json FROM game_receipts WHERE owner=? AND request_id=?', owner, id).first<{ request_json: string; result_json: string }>();
            if (receipt?.request_json === request) return JSON.parse(receipt.result_json) as GameSaved;
            if ((await this.account(owner))?.version !== account?.version) throw Error('GAME_CHANGED');
            throw error;
        }
        return result;
    }
    private async historicalDay(owner: string, day: number, account: Account): Promise<HabitDay> {
        const found = await query(this.db, `SELECT start_at,end_at FROM habit_days WHERE owner=? AND day=?
            UNION ALL SELECT start_at,end_at FROM schedule_days WHERE owner=? AND day=? LIMIT 1`, owner, day, owner, day).first<{ start_at: number; end_at: number }>();
        if (found) return { day, startAt: found.start_at, endAt: found.end_at };
        const previous = await query(this.db, 'SELECT day,start_at,end_at FROM game_days WHERE owner=? AND day<? ORDER BY day DESC LIMIT 1', owner, day).first<{ day: number; start_at: number; end_at: number }>();
        const startAt = previous ? previous.start_at + (day - previous.day) * 86400000 : account.anchor_start + (day - account.joined_day) * 86400000;
        const next = await query(this.db, 'SELECT start_at FROM schedule_days WHERE owner=? AND day>? ORDER BY day LIMIT 1', owner, day).first<{ start_at: number }>();
        return { day, startAt, endAt: Math.min(startAt + 86400000, next?.start_at ?? Infinity) };
    }
    async settle(owner: string, now: number, limit = 1) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 7) throw Error('INVALID_GAME_LIMIT');
        let processed = 0;
        while (processed < limit) {
            const account = await this.account(owner);
            if (!account) break;
            const day = await this.historicalDay(owner, account.next_day, account);
            if (now < day.endAt) break;
            if (await query(this.db, 'SELECT 1 FROM habits WHERE owner=? AND created_day<=? AND next_day<=? AND (archived_from IS NULL OR next_day<archived_from) LIMIT 1', owner, day.day, day.day).first()) break;
            const selected = await this.selected(owner, day.day);
            // Battle settlement is implemented by the battle use case, never
            // rerouted into training when a fight is waiting or has ended.
            if (selected.mode === 'battle') break;
            const aggregate = await query(this.db, 'SELECT version FROM habit_accounts WHERE owner=?', owner).first<{ version: number }>();
            const sourceRows = (await query(this.db, `SELECT o.habit_id,o.successes,o.misses,o.reason,o.game_applied,r.definition_json
                FROM habit_outcomes o JOIN habit_revisions r ON r.owner=o.owner AND r.habit_id=o.habit_id AND r.from_day=o.revision_day
                WHERE o.owner=? AND o.day=? ORDER BY o.habit_id LIMIT 100`, owner, day.day)
                .all<{ habit_id: string; successes: number; misses: number; reason: string; game_applied: number; definition_json: string }>()).results;
            if (sourceRows.some(row => row.game_applied)) throw Error('GAME_DAY_CONFLICT');
            const prior = (await query(this.db, 'SELECT habit_id,SUM(successes) AS successes,SUM(misses) AS misses FROM habit_outcomes WHERE owner=? AND day>=? AND day<? GROUP BY habit_id',
                owner, habitWeekStart(day.day), day.day).all<{ habit_id: string; successes: number; misses: number }>()).results;
            const sources: PracticeSource[] = sourceRows.map(row => {
                const definition = JSON.parse(row.definition_json) as HabitDefinition;
                const totals = prior.find(total => total.habit_id === row.habit_id);
                return { habitId: row.habit_id, successes: row.successes, misses: row.misses, mature: day.day - definition.commitmentFrom >= 7,
                    weekly: definition.cadence.kind === 'weekly' && !['not_started', 'archived'].includes(row.reason)
                        ? { startDay: habitWeekStart(day.day), endDay: habitWeekStart(day.day) + 7, quota: definition.cadence.quota,
                            successesBefore: totals?.successes ?? 0, missesBefore: totals?.misses ?? 0 } : null };
            });
            const weekRows = (await query(this.db, 'SELECT state_json FROM practice_week_audits WHERE owner=? AND (closed_day IS NULL OR end_day>?) ORDER BY end_day,habit_id LIMIT 60', owner, day.day).all<{ state_json: string }>()).results;
            const weeks = weekRows.map(row => JSON.parse(row.state_json) as PracticeWeek);
            const ids = [...new Set([selected.practiceId, ...weeks.flatMap(week => [week.fallback?.versionId, ...week.claims.map(claim => claim.versionId)])].filter((id): id is string => !!id))];
            const versionRows = (await query(this.db, 'SELECT id,state_json,version,created FROM practice_versions WHERE owner=? AND id IN(SELECT value FROM json_each(?))', owner, JSON.stringify(ids)).all<VersionRow>()).results;
            const outcome = settlePracticeDay(day.day, selected.mode === 'practice' ? selected.practiceId : null,
                versionRows.map(row => stored(row).practice), weeks, sources);
            const changedVersions = outcome.versions.filter(version => JSON.stringify(version) !== versionRows.find(row => row.id === version.id)?.state_json);
            const changedWeeks = outcome.weeks.filter(week => JSON.stringify(week) !== weekRows.find(row => (JSON.parse(row.state_json) as PracticeWeek).key === week.key)?.state_json);
            const result = { progressMilli: outcome.progressMilli, directMisses: outcome.directMisses, weeklyMisses: outcome.weeklyMisses,
                closedWeeks: outcome.closedWeeks, locked: outcome.locked,
                habits: sourceRows.filter(row => row.successes || row.misses).map(row => ({
                    habitId: row.habit_id, name: (JSON.parse(row.definition_json) as HabitDefinition).name,
                    successes: row.successes, misses: row.misses, receiver: selected.mode,
                })) };
            const statements = [
                query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM game_accounts WHERE owner=? AND version=? AND next_day=?) AND COALESCE((SELECT version FROM habit_accounts WHERE owner=?),0)=? AND NOT EXISTS(SELECT 1 FROM habits WHERE owner=? AND created_day<=? AND next_day<=? AND (archived_from IS NULL OR next_day<archived_from)) THEN 1 ELSE 0 END', owner, account.version, day.day, owner, aggregate?.version ?? 0, owner, day.day, day.day),
                query(this.db, `UPDATE practice_versions SET version=version+1,updated=?,state_json=(SELECT json_extract(value,'$.state')
                    FROM json_each(?) WHERE json_extract(value,'$.id')=practice_versions.id) WHERE owner=? AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?))`,
                    now, JSON.stringify(changedVersions.map(version => ({ id: version.id, state: version }))), owner, JSON.stringify(changedVersions.map(version => ({ id: version.id })))),
                query(this.db, `INSERT INTO practice_week_audits(owner,habit_id,start_day,end_day,closed_day,state_json)
                    SELECT ?,json_extract(value,'$.habitId'),json_extract(value,'$.startDay'),json_extract(value,'$.endDay'),json_extract(value,'$.closedDay'),value FROM json_each(?) WHERE 1
                    ON CONFLICT(owner,habit_id,start_day) DO UPDATE SET closed_day=excluded.closed_day,state_json=excluded.state_json`, owner, JSON.stringify(changedWeeks)),
                query(this.db, 'INSERT INTO game_days(owner,day,start_at,end_at,mode,practice_id,battle_id,rule,result_json,settled_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                    owner, day.day, day.startAt, day.endAt, selected.mode, selected.practiceId, selected.battleId, PRACTICE_RULE, JSON.stringify(result), now),
                query(this.db, `UPDATE habit_outcomes SET game_applied=1,receiver_json=json_object('mode',?,'practiceId',?,'battleId',?,'rule',?,'day',day) WHERE owner=? AND day=?`,
                    selected.mode, selected.practiceId, selected.battleId, PRACTICE_RULE, owner, day.day),
                query(this.db, 'UPDATE game_accounts SET next_day=next_day+1,version=version+1,updated=? WHERE owner=?', now, owner),
                query(this.db, 'DELETE FROM transaction_guard'),
            ];
            try { await this.db.batch(statements); }
            catch (error) {
                const newer = await this.account(owner);
                if (newer && newer.next_day > day.day) { processed++; continue; }
                if (newer?.version !== account.version || (await query(this.db, 'SELECT version FROM habit_accounts WHERE owner=?', owner).first<{ version: number }>())?.version !== aggregate?.version)
                    return { processed, pending: true };
                throw error;
            }
            processed++;
        }
        const current = await this.account(owner);
        const next = current ? await this.historicalDay(owner, current.next_day, current) : null;
        return { processed, pending: !!next && next.endAt <= now };
    }
}
