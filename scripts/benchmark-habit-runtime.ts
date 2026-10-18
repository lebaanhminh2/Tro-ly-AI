import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import type { Database, Statement } from '../src/adapters/d1/database.ts';
import { D1HabitStore } from '../src/adapters/d1/habit-store.ts';
import { ScheduleStore } from '../src/adapters/d1/schedule-store.ts';
import { HabitService } from '../src/application/habit-service.ts';

// Diagnostic adapter only. Executes the production stores against local SQLite;
// its timings include Node + SQLite CPU, not remote Worker CPU or network time.
export function sqliteDatabase(raw: DatabaseSync, onQuery: (sql: string) => void = () => {}): Database {
    const database: Database = {
        prepare(sql: string): Statement {
            let values: (string | number | null)[] = [];
            const statement: Statement = {
                bind(...args) { values = args; return statement; },
                async first<T>() { onQuery(sql); return (raw.prepare(sql).get(...values) as T | undefined) ?? null; },
                async all<T>() { onQuery(sql); return { results: raw.prepare(sql).all(...values) as T[] }; },
                async run() { onQuery(sql); return { meta: { changes: Number(raw.prepare(sql).run(...values).changes) } }; },
            };
            return statement;
        },
        async batch(statements) {
            raw.exec('BEGIN IMMEDIATE');
            try {
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                raw.exec('COMMIT'); return results;
            } catch (error) { raw.exec('ROLLBACK'); throw error; }
        },
    };
    return database;
}

const NOW = Date.parse('2026-10-12T08:00:00+07:00'), DAY = 86400000;
export async function benchmarkFixture(habitCount: number, historyDays: number, backlogDays: number) {
    const raw = new DatabaseSync(':memory:'); let queries = 0;
    const db = sqliteDatabase(raw, () => { queries++; });
    try {
        for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort()) raw.exec(readFileSync('migrations/' + file, 'utf8'));
        raw.exec('PRAGMA foreign_keys=ON');
        const firstAt = NOW - historyDays * DAY;
        await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, firstAt);
        const habits = new D1HabitStore(db);
        const firstDay = (await habits.today('123', firstAt)).day.day, currentDay = firstDay + historyDays;
        const ids: string[] = [];
        for (let index = 0; index < habitCount; index++) {
            const result = await new HabitService(habits).execute('123', 'benchmark_habit_' + index,
                { operation: 'create', definition: { name: 'Habit ' + index, metric: 'duration', target: 20, cadence: { kind: 'daily' } } }, firstAt);
            ids.push(result.habitId!);
        }
        raw.exec('BEGIN');
        try {
            const dayInsert = raw.prepare('INSERT OR IGNORE INTO habit_days(owner,day,start_at,end_at) VALUES(?,?,?,?)');
            const logInsert = raw.prepare('INSERT INTO habit_logs(owner,habit_id,day,value,note,updated) VALUES(?,?,?,?,?,?)');
            const outcomeInsert = raw.prepare('INSERT INTO habit_outcomes(owner,habit_id,day,revision_day,status,reason,value,successes,misses,game_applied,settled_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)');
            for (let offset = 1; offset <= historyDays; offset++) {
                const day = firstDay + offset, at = firstAt + offset * DAY;
                dayInsert.run('123', day, at - 150 * 60000, at - 150 * 60000 + DAY);
                for (const id of ids) {
                    logInsert.run('123', id, day, offset % 5 ? 2000 : 1500, 'Synthetic history', at);
                    if (day < currentDay - backlogDays) {
                        const achieved = offset % 5 !== 0;
                        outcomeInsert.run('123', id, day, firstDay, achieved ? 'achieved' : 'missed',
                            achieved ? 'target_met' : 'target_missing', achieved ? 2000 : 1500, achieved ? 1 : 0, achieved ? 0 : 1, at + DAY);
                    }
                }
            }
            raw.prepare('UPDATE habits SET next_day=? WHERE owner=?').run(currentDay - backlogDays, '123');
            raw.exec('COMMIT');
        } catch (error) { raw.exec('ROLLBACK'); throw error; }
        assert.equal(raw.prepare('PRAGMA foreign_key_check').all().length, 0);
        const metrics: { operation: string; wallMs: number; localCpuMs: number; queries: number; responseBytes: number }[] = [];
        async function measure<T>(operation: string, action: () => Promise<T>): Promise<T> {
            queries = 0; const cpu = process.cpuUsage(), start = performance.now();
            const result = await action(), elapsedCpu = process.cpuUsage(cpu);
            metrics.push({ operation, wallMs: Number((performance.now() - start).toFixed(3)),
                localCpuMs: Number(((elapsedCpu.user + elapsedCpu.system) / 1000).toFixed(3)), queries,
                responseBytes: Buffer.byteLength(JSON.stringify(result)) });
            return result;
        }
        const today = await measure('today', () => habits.today('123', NOW));
        assert.equal(today.habits.length, habitCount);
        const from = currentDay - 365;
        const page = await measure('history-page-1', () => habits.history('123', from, currentDay, null, null, 50));
        const next = await measure('history-page-2', () => habits.history('123', from, currentDay, null, page.next, 50));
        assert.equal(page.rows.length, 50); assert.equal(next.rows.length, 50);
        const keys = new Set([...page.rows, ...next.rows].map(row => row.day + ':' + row.habitId)); assert.equal(keys.size, 100);
        const report = await measure('year-report', () => habits.report('123', from, currentDay, null));
        assert.equal(report.totals.length, habitCount);
        const healthyBefore = raw.prepare('SELECT * FROM cultivation_accounts ORDER BY owner').all();
        const backlogBefore = raw.prepare('SELECT MIN(next_day) AS day FROM habits').get()!.day as number;
        const batch1 = await measure('habit-backlog-batch-1', () => habits.settleBatch('123', NOW, 30));
        assert.equal(batch1.processed, habitCount);
        assert.equal(raw.prepare('SELECT MIN(next_day) AS day FROM habits').get()!.day, backlogBefore + 1);
        const batch2 = await measure('habit-backlog-batch-2', () => habits.settleBatch('123', NOW, 30));
        assert.equal(batch2.processed, habitCount);
        assert.equal(raw.prepare('SELECT MIN(next_day) AS day FROM habits').get()!.day, backlogBefore + 2);
        const drainStart = performance.now(), drainCpu = process.cpuUsage(); let maxQueriesPerCall = 0;
        for (let offset = 2; offset < backlogDays; offset++) {
            queries = 0; assert.equal((await habits.settleBatch('123', NOW, 30)).processed, habitCount);
            maxQueriesPerCall = Math.max(maxQueriesPerCall, queries);
        }
        assert.ok(maxQueriesPerCall <= 50);
        assert.equal(raw.prepare('SELECT MIN(next_day) AS day FROM habits').get()!.day, currentDay);
        assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM habit_outcomes WHERE owner=? AND day>=?').get('123', backlogBefore)!.n, habitCount * backlogDays);
        const replay = await habits.settleBatch('123', NOW, 30); assert.equal(replay.processed, 0);
        const drainElapsedCpu = process.cpuUsage(drainCpu);
        assert.deepEqual(raw.prepare('SELECT * FROM cultivation_accounts ORDER BY owner').all(), healthyBefore);
        assert.ok(metrics.every(metric => metric.queries <= 50), JSON.stringify(metrics));
        assert.ok(metrics.filter(metric => metric.operation !== 'year-report').every(metric => metric.responseBytes < 100000));
        return { fixture: { habitCount, historyDays, backlogDays, logRows: habitCount * historyDays, databaseBytes: (raw.prepare('PRAGMA page_count').get()!.page_count as number) * (raw.prepare('PRAGMA page_size').get()!.page_size as number) },
            boundedResume: { initialOldestDay: backlogBefore, afterTwoBatches: backlogBefore + 2 },
            backlogDrain: { wallMs: Number((performance.now() - drainStart).toFixed(3)),
                localCpuMs: (drainElapsedCpu.user + drainElapsedCpu.system) / 1000, maxQueriesPerCall,
                outcomeRows: habitCount * backlogDays, finalDay: currentDay, replayProcessed: replay.processed }, metrics };
    } finally { raw.close(); }
}

if (process.argv[1]?.endsWith('benchmark-habit-runtime.ts')) {
    const reportIndex = process.argv.indexOf('--report'), report = process.argv[reportIndex + 1];
    if (reportIndex < 0 || !report) throw Error('USE_--report_NEW_JSON_PATH');
    const fixtures = [];
    for (const habitCount of [6, 30]) for (const backlogDays of [7, 365]) fixtures.push(await benchmarkFixture(habitCount, 1095, backlogDays));
    writeFileSync(report, JSON.stringify({ format: 'assistant-local-runtime-benchmark', version: 1, node: process.version,
        limitation: 'Synthetic offline fixtures, production stores + Node SQLite; local CPU includes SQL, not remote Worker CPU/D1 duration/network/Telegram. Windows CPU counters may round short operations to 0 ms; full backlog drainage uses separate bounded calls, not one Worker invocation.', fixtures }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify(fixtures.map(fixture => ({ fixture: fixture.fixture, metrics: fixture.metrics }))));
}
