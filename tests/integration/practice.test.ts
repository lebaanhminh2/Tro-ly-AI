import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import type { Env } from '../../src/config/env.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { D1GameStore } from '../../src/adapters/d1/game-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { PracticeService } from '../../src/application/practice-service.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';
import { timePracticeSummary } from '../../src/domain/practice-progression.ts';

const monday = Date.parse('2026-10-12T08:00:00+07:00'), DAY = 86400000;
async function database(at = monday) {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, at);
    const habits = new D1HabitStore(db), game = new D1GameStore(db);
    return { mf, db, habits, game, habitService: new HabitService(habits), service: new PracticeService(game) };
}
const definition = { name: 'Thiền', metric: 'check', target: 1, cadence: { kind: 'daily' } };

test('read-only settlement of an open day uses two queries and no account uses one, without changing progress or hiding backlog', async () => {
    const { mf, db, game, service } = await database();
    try {
        let reads = 0, batches = 0;
        const measured: Database = { prepare: sql => { reads++; return db.prepare(sql); }, batch: statements => { batches++; return db.batch(statements); } };
        const settling = new D1GameStore(measured);
        assert.deepEqual(await settling.settle('456', monday, 7), { processed: 0, pending: false });
        assert.equal(reads, 1); assert.equal(batches, 0);
        assert.equal(await db.prepare("SELECT 1 FROM game_accounts WHERE owner='456'").first(), null);
        const initial = await game.read('123', monday);
        await service.execute('123', 'read_only_practice', { operation: 'start_practice', day: initial.day.day,
            version: initial.version, techniqueId: 'kiem-y' }, monday);
        const before = { game: await game.read('123', monday), editions: await game.versions('123', 'kiem-y', null, 20),
            days: (await db.prepare('SELECT * FROM game_days WHERE owner=?').bind('123').all()).results,
            receipts: (await db.prepare('SELECT * FROM game_receipts WHERE owner=?').bind('123').all()).results };
        for (const limit of [1, 7]) {
            reads = 0; batches = 0;
            assert.deepEqual(await settling.settle('123', monday + 60000, limit), { processed: 0, pending: false });
            assert.equal(reads, 2, 'Account and existing operating-day boundary each read once'); assert.equal(batches, 0);
        }
        const after = { game: await game.read('123', monday), editions: await game.versions('123', 'kiem-y', null, 20),
            days: (await db.prepare('SELECT * FROM game_days WHERE owner=?').bind('123').all()).results,
            receipts: (await db.prepare('SELECT * FROM game_receipts WHERE owner=?').bind('123').all()).results };
        assert.deepEqual(after, before);
        const limited = await settling.settle('123', monday + 3 * DAY, 1);
        assert.deepEqual(limited, { processed: 1, pending: true }, 'Limit still advertises closed days not yet processed');
        assert.deepEqual(await settling.settle('123', monday + 3 * DAY, 7), { processed: 2, pending: false });
        reads = 0; batches = 0;
        assert.deepEqual(await settling.settle('123', monday + 3 * DAY, 7), { processed: 0, pending: false });
        assert.equal(batches, 0);
    } finally { await mf.dispose(); }
});

test('practice selection is tomorrow-only, retry is canonical across closure, and concurrent/failing writes preserve old versions', async () => {
    const { mf, db, game, service } = await database();
    try {
        const initial = await game.read('123', monday), day = initial.day.day;
        const input = { operation: 'start_practice', day, version: 0, techniqueId: 'kiem-y' };
        const results = await Promise.allSettled(['start_practice01', 'start_practice02'].map(id => service.execute('123', id, input, monday)));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.filter(result => result.status === 'rejected').length, 1);
        const winner = results.findIndex(result => result.status === 'fulfilled'), id = 'start_practice0' + (winner + 1);
        const result = (results[winner] as PromiseFulfilledResult<{ practiceId: string; effectiveFrom: number }>).value;
        const current = await game.read('123', monday);
        assert.equal(current.current.mode, 'idle'); assert.equal(current.pending!.fromDay, day + 1);
        assert.equal(current.pending!.practiceId, result.practiceId);
        let reads = 0;
        const measured: Database = { prepare: sql => { reads++; return db.prepare(sql); }, batch: items => db.batch(items) };
        assert.deepEqual(await new D1GameStore(measured).read('123', monday), current);
        assert.ok(reads <= 3, 'Schedule plus the complete selected-edition snapshot needs at most three reads: ' + reads);
        assert.deepEqual(await service.execute('123', id, { techniqueId: 'kiem-y', version: 0, day, operation: 'start_practice' }, monday + DAY), result);
        await assert.rejects(service.execute('123', id, { ...input, techniqueId: 'kim-than' }, monday), /REQUEST_ID_REUSED/);
        assert.equal((await game.versions('123', 'kiem-y', null, 20)).versions.length, 1);
        await assert.rejects(service.execute('123', 'restart_denied1', { ...input, version: current.version }, monday), /CONFIRM_PRACTICE_RESTART/);
        const fault: Database = { prepare: sql => db.prepare(sql), batch: statements => db.batch([
            ...statements.slice(0, 3), db.prepare('INSERT INTO transaction_guard(valid) VALUES(0)'), ...statements.slice(3),
        ]) };
        await assert.rejects(new PracticeService(new D1GameStore(fault)).execute('123', 'failed_restart1', { ...input, version: current.version, confirmRestart: true }, monday));
        assert.equal((await game.versions('123', 'kiem-y', null, 20)).versions.length, 1);
        assert.equal(await db.prepare("SELECT request_id FROM game_receipts WHERE request_id='failed_restart1'").first(), null);
        await service.execute('123', 'failed_restart1', { ...input, version: current.version, confirmRestart: true }, monday);
        const versions = (await game.versions('123', 'kiem-y', null, 1));
        assert.equal(versions.versions[0]!.practice.edition, 2); assert.ok(versions.next);
        assert.equal((await game.versions('123', 'kiem-y', versions.next, 1)).versions[0]!.practice.edition, 1);
        assert.equal((await game.versions('456', 'kiem-y', null, 20)).versions.length, 0);
    } finally { await mf.dispose(); }
});
test('only complete immutable habit days train once; a later mode choice never changes the earlier receiver or healthy rewards', async () => {
    const { mf, db, game, habits, service, habitService } = await database();
    try {
        const healthy = await new HealthyStore(db).read('123');
        const habit = await habitService.execute('123', 'habit_training1', { operation: 'create', definition }, monday);
        const initial = await game.read('123', monday), day = initial.day.day;
        const saved = await service.execute('123', 'first_practice1', { operation: 'start_practice', techniqueId: 'kiem-y', day, version: 0 }, monday);
        const at = monday + DAY;
        await habitService.execute('123', 'training_log001', { operation: 'log', habitId: habit.habitId, version: 1, logVersion: 0, day: day + 1, value: 1 }, at);
        const current = await game.read('123', at);
        await service.execute('123', 'switch_practice1', { operation: 'start_practice', techniqueId: 'kim-than', day: day + 1, version: current.version }, at);
        assert.equal((await game.settle('123', at + DAY, 1)).processed, 0, 'Game waits for every habit day to finish processing');
        await habits.settle('123', at + DAY, 10);
        const parallel = await Promise.all([game.settle('123', at + DAY, 1), game.settle('123', at + DAY, 1)]);
        assert.ok(parallel.every(result => result.processed >= 0));
        await game.settle('123', at + DAY, 2);
        const old = (await game.versions('123', 'kiem-y', null, 20)).versions[0]!.practice;
        const next = (await game.versions('123', 'kim-than', null, 20)).versions[0]!.practice;
        assert.equal(old.progressMilli, 1000); assert.equal(next.progressMilli, 0);
        assert.equal(old.id, saved.practiceId);
        const source = await db.prepare('SELECT receiver_json,game_applied FROM habit_outcomes WHERE owner=? AND habit_id=? AND day=?')
            .bind('123', habit.habitId, day + 1).first<{ receiver_json: string; game_applied: number }>();
        assert.equal(JSON.parse(source!.receiver_json).practiceId, old.id); assert.equal(source!.game_applied, 1);
        const before = JSON.stringify(old);
        await game.settle('123', at + DAY, 7);
        assert.equal(JSON.stringify((await game.versions('123', 'kiem-y', null, 20)).versions[0]!.practice), before);
        assert.deepEqual(await new HealthyStore(db).read('123'), healthy);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM game_days WHERE owner=? AND day=?').bind('123', day + 1).first<{ n: number }>())!.n, 1);
    } finally { await mf.dispose(); }
});
test('time tier opens on day three and a stopped weekly audit settles its independent ratio without changing healthy rewards', async () => {
    const { mf, db, game, habits, service, habitService } = await database(monday - DAY);
    try {
        const daily = await habitService.execute('123', 'daily_for_week1', { operation: 'create', definition }, monday - DAY);
        const weekly = await habitService.execute('123', 'weekly_training', { operation: 'create', definition: { ...definition, name: 'Đọc', cadence: { kind: 'weekly', quota: 3 } } }, monday - DAY);
        const first = await game.read('123', monday - DAY), day = first.day.day + 1;
        await service.execute('123', 'start_weekly001', { operation: 'start_practice', techniqueId: 'kiem-y', day: first.day.day, version: 0 }, monday - DAY);
        for (let offset = 0; offset < 3; offset++) await habitService.execute('123', 'daily_week_log' + offset,
            { operation: 'log', habitId: daily.habitId, version: 1, logVersion: 0, day: day + offset, value: 1 }, monday + offset * DAY);
        await habitService.execute('123', 'weekly_log_day1', { operation: 'log', habitId: weekly.habitId, version: 1, logVersion: 0, day, value: 1 }, monday);
        const current = await game.read('123', monday + 2 * DAY);
        await service.execute('123', 'stop_before_miss', { operation: 'stop_practice', day: day + 2, version: current.version }, monday + 2 * DAY);
        await habits.settle('123', monday + 7 * DAY, 30);
        await game.settle('123', monday + 7 * DAY, 7); await game.settle('123', monday + 7 * DAY, 7);
        const version = (await game.versions('123', 'kiem-y', null, 20)).versions[0]!.practice;
        assert.equal(version.tiers.length, 1); assert.equal(version.tiers[0]!.purityBp, 6666, 'equal-weight daily 100% and weekly 1/3');
        assert.equal(version.tiers[0]!.defectsMilli, 2000); assert.equal(version.tiers[0]!.lockedDay, day + 2, 'clock never waits for weekly audit');
        assert.equal(version.time!.periods[0]!.ratioBp, 6666);
        assert.equal(timePracticeSummary(version).totalPurityBp, 1666);
        assert.deepEqual(version.pendingWeeks, []);
        const audit = await db.prepare('SELECT closed_day,state_json FROM practice_week_audits WHERE owner=? AND habit_id=?')
            .bind('123', weekly.habitId).first<{ closed_day: number; state_json: string }>();
        assert.equal(audit!.closed_day, day + 6); assert.equal(JSON.parse(audit!.state_json).misses, 2);
    } finally { await mf.dispose(); }
});

test('D1 retains a saved 34-day v2 schedule and publishes its actual upgrade time after factory changes', async () => {
    const { mf, db, game, habits, service, habitService } = await database();
    try {
        const habit = await habitService.execute('123', 'stored_clock_habit', { operation: 'create', definition }, monday);
        const initial = await game.read('123', monday), day = initial.day.day;
        const started = await service.execute('123', 'stored_clock_start',
            { operation: 'start_practice', techniqueId: 'kiem-y', day, version: 0 }, monday);
        const old = (await game.versions('123', 'kiem-y', null, 20)).versions[0]!.practice;
        assert.deepEqual(old.costsMilli, [3000, 4000, 6000, 8000]);
        const savedDays = [3, 6, 10, 15];
        old.time!.periods.forEach((period, index) => { period.requiredDays = savedDays[index]!; });
        old.costsMilli = savedDays.map(days => days * 1000);
        await db.prepare('UPDATE practice_versions SET state_json=? WHERE owner=? AND id=?')
            .bind(JSON.stringify(old), '123', started.practiceId).run();
        for (let offset = 1; offset <= 9; offset++) {
            const at = monday + offset * DAY;
            await habitService.execute('123', 'stored_clock_log_' + offset,
                { operation: 'log', habitId: habit.habitId, version: 1, logVersion: 0, day: day + offset, value: 1 }, at);
            await habits.settle('123', at + DAY, 10);
            await game.settle('123', at + DAY, 2);
        }
        const stored = (await game.versions('123', 'kiem-y', null, 20)).versions[0]!.practice;
        assert.equal(stored.tiers.length, 2);
        assert.deepEqual(stored.tiers.map(tier => tier.lockedDay), [day + 3, day + 9]);
        assert.deepEqual(stored.time!.periods.map(period => period.requiredDays), savedDays);
        const { readGame } = await import('../../src/entrypoints/mini-app/game.ts');
        const response = await readGame({ env: { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32) } as Env, owner: '123', now: monday + 10 * DAY,
            healthy: new HealthyStore(db) }, new URL('https://local/api/game-technique?techniqueId=kiem-y'));
        const detail = await response.json() as { upgrade: { remainingDays: number; referenceRoadmap: { totalDays: number }[] } };
        assert.equal(detail.upgrade.remainingDays, 10);
        assert.deepEqual(detail.upgrade.referenceRoadmap.map(step => step.totalDays), [3, 7, 13, 21]);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM practice_tier_sources WHERE owner=? AND practice_id=?')
            .bind('123', stored.id).first<{ n: number }>())!.n, 2);
    } finally { await mf.dispose(); }
});
test('30 weekly habits retain normalized tier sources and fit SQL/payload budgets without accelerating training time', async () => {
    const { mf, db, game, service } = await database();
    try {
        const initial = await game.read('123', monday), day = initial.day.day;
        await service.execute('123', 'scale_practice1', { operation: 'start_practice', techniqueId: 'kiem-y', day, version: 0 }, monday);
        const statements = [];
        for (let offset = 0; offset < 2; offset++) statements.push(db.prepare('INSERT INTO habit_days(owner,day,start_at,end_at) VALUES(?,?,?,?)')
            .bind('123', day + offset, initial.day.startAt + offset * DAY, initial.day.endAt + offset * DAY));
        for (let index = 0; index < 30; index++) {
            const id = 'scale_week_' + String(index).padStart(2, '0');
            const value = { name: 'Weekly ' + index, metric: 'check', target: 100, unit: 'lần', note: '',
                cadence: { kind: 'weekly', quota: 3 }, commitmentFrom: day - 7 };
            statements.push(db.prepare('INSERT INTO habits(owner,id,created_day,next_day,created,updated) VALUES(?,?,?,?,?,?)').bind('123', id, day - 7, day + 2, monday - 7 * DAY, monday));
            statements.push(db.prepare('INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES(?,?,?,?)').bind('123', id, day - 7, JSON.stringify(value)));
            for (let offset = 0; offset < 2; offset++) statements.push(db.prepare("INSERT INTO habit_outcomes(owner,habit_id,day,revision_day,status,reason,value,successes,misses,settled_at) VALUES(?,?,?,?, 'achieved','target_met',100,1,0,?)")
                .bind('123', id, day + offset, day - 7, monday + (offset + 1) * DAY));
        }
        await db.batch(statements);
        await game.settle('123', monday + DAY, 1);
        let count = 0;
        const measured: Database = { prepare: sql => { count++; return db.prepare(sql); }, batch: items => db.batch(items) };
        const api = await import('../../src/entrypoints/mini-app/game.ts');
        const at = monday + 2 * DAY, response = await api.readGame({ env: { DB: measured } as Env, owner: '123', now: at,
            healthy: new HealthyStore(measured) }, new URL('https://local/api/game'));
        const raw = await response.text(), data = JSON.parse(raw);
        assert.equal(data.currentPractice.practice.progressMilli, 1000);
        assert.equal(data.audits.length, 30); assert.equal(data.currentPractice.practice.pendingWeeks.length, 30);
        assert.equal(data.currentPractice.practice.time.periods[0].members.length, 0, 'public overview omits the contributor ledger');
        assert.equal(data.currentPractice.training.current.memberCount, 30);
        const sources = await db.prepare('SELECT count(*) AS total FROM practice_tier_sources WHERE owner=? AND practice_id=? AND tier=1')
            .bind('123', data.currentPractice.practice.id).first<{ total: number }>();
        assert.equal(sources!.total, 30, 'normalization retains all committed sources');
        const state = await db.prepare('SELECT length(state_json) AS bytes FROM practice_versions WHERE owner=?').bind('123').first<{ bytes: number }>();
        assert.ok(state!.bytes < 8000);
        assert.ok(count <= 50, 'Free invocation SQL budget: ' + count);
        assert.ok(Buffer.byteLength(raw) < 50000, 'Bounded overview response bytes: ' + Buffer.byteLength(raw));
    } finally { await mf.dispose(); }
});

test('four settled tiers times 30 habits keep 120 sources while settlement and overview/detail stay within query and payload budgets', async () => {
    const { mf, db, game, service } = await database();
    try {
        const initial = await game.read('123', monday), day = initial.day.day;
        const started = await service.execute('123', 'scale_four_tiers', { operation: 'start_practice', techniqueId: 'kiem-y', day, version: 0 }, monday);
        const statements = [];
        for (let offset = 0; offset < 35; offset++) statements.push(db.prepare('INSERT INTO habit_days(owner,day,start_at,end_at) VALUES(?,?,?,?)')
            .bind('123', day + offset, initial.day.startAt + offset * DAY, initial.day.endAt + offset * DAY));
        for (let index = 0; index < 30; index++) {
            const id = 'four_tier_habit_' + String(index).padStart(2, '0');
            const value = { name: 'Habit ' + index, metric: 'check', target: 100, unit: 'lần', note: '',
                cadence: { kind: 'daily' }, commitmentFrom: day - 7 };
            statements.push(db.prepare('INSERT INTO habits(owner,id,created_day,next_day,created,updated) VALUES(?,?,?,?,?,?)')
                .bind('123', id, day - 7, day + 35, monday - 7 * DAY, monday));
            statements.push(db.prepare('INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES(?,?,?,?)')
                .bind('123', id, day - 7, JSON.stringify(value)));
            for (let offset = 0; offset < 35; offset++) statements.push(db.prepare("INSERT INTO habit_outcomes(owner,habit_id,day,revision_day,status,reason,value,successes,misses,settled_at) VALUES(?,?,?,?, 'achieved','target_met',100,1,0,?)")
                .bind('123', id, day + offset, day - 7, monday + (offset + 1) * DAY));
        }
        for (let offset = 0; offset < statements.length; offset += 50) await db.batch(statements.slice(offset, offset + 50));
        let queries = 0, peakQueries = 0;
        const measured: Database = { prepare: sql => { queries++; return db.prepare(sql); }, batch: items => db.batch(items) };
        const settling = new D1GameStore(measured);
        for (let offset = 1; offset <= 35; offset++) {
            queries = 0;
            assert.equal((await settling.settle('123', monday + offset * DAY, 1)).processed, 1);
            peakQueries = Math.max(peakQueries, queries);
            assert.ok(queries <= 50, 'Bounded daily settlement query budget: ' + queries);
        }
        const counts = (await db.prepare('SELECT tier,count(*) AS total FROM practice_tier_sources WHERE owner=? AND practice_id=? GROUP BY tier ORDER BY tier')
            .bind('123', started.practiceId).all<{ tier: number; total: number }>()).results;
        assert.deepEqual(counts.map(row => [row.tier, row.total]), [[1, 30], [2, 30], [3, 30], [4, 30]]);
        const stored = await db.prepare('SELECT length(state_json) AS bytes FROM practice_versions WHERE owner=? AND id=?')
            .bind('123', started.practiceId).first<{ bytes: number }>();
        assert.ok(stored!.bytes < 8000);
        const { readGame } = await import('../../src/entrypoints/mini-app/game.ts');
        const at = monday + 35 * DAY, context = { env: { DB: measured } as Env, owner: '123', now: at, healthy: new HealthyStore(measured) };
        queries = 0;
        const overviewRaw = await (await readGame(context, new URL('https://local/api/game'))).text(), overviewQueries = queries;
        const overview = JSON.parse(overviewRaw);
        assert.equal(overview.currentPractice.practice.tiers.length, 4);
        assert.equal(overview.currentPractice.profile.totalPurityBp, 10000);
        assert.ok(overview.currentPractice.practice.time.periods.every((period: { members: unknown[] }) => period.members.length === 0));
        assert.ok(overviewQueries <= 50); assert.ok(Buffer.byteLength(overviewRaw) < 50000);
        queries = 0;
        const detailRaw = await (await readGame(context, new URL('https://local/api/game-technique?techniqueId=kiem-y'))).text(), detailQueries = queries;
        const detail = JSON.parse(detailRaw);
        assert.equal(detail.selected.profile.totalPurityBp, 10000);
        assert.equal(detail.selected.profile.damage, overview.currentPractice.profile.damage);
        assert.ok(detail.selected.practice.time.periods.every((period: { members: unknown[] }) => period.members.length === 0));
        assert.ok(detailQueries <= 50); assert.ok(Buffer.byteLength(detailRaw) < 50000);
        console.log(JSON.stringify({ fixture: 'four_tiers_30_habits', peakSettlementQueries: peakQueries, storedBytes: stored!.bytes,
            overviewQueries, overviewBytes: Buffer.byteLength(overviewRaw), detailQueries, detailBytes: Buffer.byteLength(detailRaw) }));
    } finally { await mf.dispose(); }
});

test('three restarts maintain only the retained and retraining editions; archived sources/history survive and cannot be continued', async () => {
    const { mf, db, game, service } = await database();
    try {
        const initial = await game.read('123', monday), first = await service.execute('123', 'two_slot_first1',
            { operation: 'start_practice', techniqueId: 'kiem-y', day: initial.day.day, version: 0 }, monday);
        const second = await service.execute('123', 'two_slot_second', { operation: 'start_practice', techniqueId: 'kiem-y',
            day: initial.day.day, version: first.version, confirmRestart: true }, monday);
        const third = await service.execute('123', 'two_slot_third1', { operation: 'start_practice', techniqueId: 'kiem-y',
            day: initial.day.day, version: second.version, confirmRestart: true }, monday);
        const all = (await game.versions('123', 'kiem-y', null, 20)).versions;
        assert.equal(all.length, 3, 'the third row is retained read-only history, not a third maintained slot');
        assert.equal(all.filter(value => value.maintained).length, 2);
        assert.ok(all.find(value => value.practice.id === third.practiceId)!.maintained);
        const archived = all.find(value => !value.maintained)!;
        await assert.rejects(service.execute('123', 'archived_resume', { operation: 'continue_practice', day: initial.day.day,
            version: third.version, practiceId: archived.practice.id }, monday), /PRACTICE_ARCHIVED/);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM game_receipts WHERE owner=?').bind('123').first<{ n: number }>())!.n, 3);
    } finally { await mf.dispose(); }
});

test('migration rehearsal preserves all legacy JSON and receipts, keeps strongest plus active slots, and does not invent period results', async () => {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    try {
        for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql') && file < '0038').sort())
            await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
        const originals = [];
        for (let index = 1; index <= 3; index++) {
            const version = newPracticeVersion('legacy_slot_' + index, 'kiem-y', 20000, 1000, index);
            if (index === 1) version.tiers = [{ tier: 1, purityBp: 10000, effortMilli: 3000, defectsMilli: 0, startedDay: 20000, lockedDay: 20002 }];
            const json = JSON.stringify(version); originals.push(json);
            await db.prepare('INSERT INTO practice_versions(owner,id,technique_id,state_json,created_day,created,updated) VALUES(?,?,?,?,?,?,?)')
                .bind('123', version.id, 'kiem-y', json, 20000, index, index).run();
        }
        await db.prepare("INSERT INTO game_selections(owner,from_day,mode,practice_id,created) VALUES('123',20001,'practice','legacy_slot_3',1)").run();
        await db.exec(readFileSync('migrations/0038_cultivation_progression.sql', 'utf8').replace(/\r?\n/g, ' '));
        const rows = (await db.prepare('SELECT id,state_json,maintained,strength_score FROM practice_versions ORDER BY created')
            .all<{ id: string; state_json: string; maintained: number; strength_score: number }>()).results;
        assert.deepEqual(rows.map(row => row.state_json), originals);
        assert.deepEqual(rows.map(row => row.maintained), [1, 0, 1]);
        assert.equal(rows[0]!.strength_score, 100000);
        assert.ok(rows.every(row => !JSON.parse(row.state_json).time), 'no inferred R from legacy q');
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM practice_tier_sources').first<{ n: number }>())!.n, 0);
    } finally { await mf.dispose(); }
});
test('scheduled habit and practice maintenance fit the Free query budget and keep notification phases separate', async () => {
    const { mf, db, game, service } = await database(monday - DAY);
    try {
        const initial = await game.read('123', monday - DAY), day = initial.day.day;
        await service.execute('123', 'cron_practice01', { operation: 'start_practice', techniqueId: 'kiem-y', day, version: 0 }, monday - DAY);
        const statements = [db.prepare('INSERT INTO habit_days(owner,day,start_at,end_at) VALUES(?,?,?,?)').bind('123', day, initial.day.startAt, initial.day.endAt)];
        for (let index = 0; index < 30; index++) {
            const id = 'cron_habit_' + String(index).padStart(2, '0');
            const value = { name: 'Habit ' + index, metric: 'check', target: 100, unit: 'lần', note: '', cadence: { kind: 'daily' }, commitmentFrom: day };
            statements.push(db.prepare('INSERT INTO habits(owner,id,created_day,next_day,created,updated) VALUES(?,?,?,?,?,?)').bind('123', id, day, day, monday - DAY, monday - DAY));
            statements.push(db.prepare('INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES(?,?,?,?)').bind('123', id, day, JSON.stringify(value)));
        }
        await db.batch(statements);
        await new ScheduleStore(db).ensureDay('123', monday);
        const scheduler = await import('../../src/entrypoints/worker-scheduler.ts');
        let count = 0, sends = 0;
        const measured: Database = { prepare: sql => { count++; return db.prepare(sql); }, batch: items => db.batch(items) };
        const env = { DB: measured, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32), TELEGRAM_BOT_TOKEN: '123:fake',
            AI_MODE: 'off', DELIVERY_MODE: 'outbox', ASSETS: { fetch: async () => new Response('fixture') } } as Env;
        const transport = (async () => { sends++; return Response.json({ ok: true, result: { message_id: 42 } }); }) as typeof fetch;
        const minute = Math.floor(monday / 60000);
        for (const slot of [1, 2]) {
            const next = Array.from({ length: 12 }, (_, index) => minute + index).find(value => value % 4 === 3 && Math.floor(value / 4) % 3 === slot)!;
            count = 0;
            await scheduler.runScheduled(env, { cardsEnabled: false, transport, clock: { now: () => next * 60000 }, chat: undefined, flushCards: async () => {} });
            assert.ok(count <= 50, 'Maintenance ' + slot + ' SQL invocation budget: ' + count);
        }
        assert.equal(sends, 0);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habit_outcomes WHERE owner=? AND day=?').bind('123', day).first<{ n: number }>())!.n, 30);
        assert.equal((await game.read('123', monday)).settledThrough, day);
    } finally { await mf.dispose(); }
});
test('game HTTP rejects forged ownership/clock/rewards and serves the full catalog without model calls', async () => {
    const { mf, db, game } = await database();
    try {
        const env = { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32) } as Env;
        const signed = (at = monday) => {
            const params = new URLSearchParams({ auth_date: String(Math.floor(at / 1000)), user: JSON.stringify({ id: 123 }) });
            const data = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n');
            const secret = createHmac('sha256', 'WebAppData').update('test').digest();
            params.set('hash', createHmac('sha256', secret).update(data).digest('hex'));
            return { 'X-Telegram-Init-Data': params.toString() };
        };
        const request = (path: string, input: unknown = null, headers: Record<string, string> = signed()) => miniAppApi(new Request('https://local/api/' + path,
            { method: input ? 'POST' : 'GET', headers: { Origin: 'https://local', ...headers }, ...(input ? { body: JSON.stringify(input) } : {}) }), env, monday);
        assert.equal((await request('game', null, {})).status, 401);
        const current = await game.read('123', monday);
        const input = { id: 'http_game_0001', operation: 'start_practice', techniqueId: 'kiem-y', day: current.day.day, version: 0 };
        for (const forged of [{ owner: '456' }, { now: monday + DAY }, { purityBp: 10000 }, { reward: 50 }, { mode: 'battle' }])
            assert.equal((await request('game', { ...input, ...forged })).status, 400);
        assert.equal((await request('game', { ...input, techniqueId: 'nghich-menh' })).status, 409);
        assert.equal((await request('game', input)).status, 200);
        const overview = await request('game'); assert.equal(overview.status, 200);
        assert.equal((await overview.json() as { pending: { fromDay: number } }).pending.fromDay, current.day.day + 1);
        const catalog = await request('game-catalog'); assert.equal(catalog.status, 200);
        assert.equal((await catalog.json() as { techniques: unknown[] }).techniques.length, 39);
        assert.equal((await request('practice-versions?techniqueId=kiem-y&limit=1000')).status, 400);
        assert.equal((await request('game-technique?techniqueId=kiem-y', null, {})).status, 401);
        const detail = await request('game-technique?techniqueId=kiem-y&attack=99999');
        assert.equal(detail.status, 200);
        const body = await detail.json() as { selected: { practice: { time: { periods: { members: unknown[] }[] } } };
            versions: unknown[]; upgrade: { context: { attack: number }; referenceRoadmap: unknown[]; nextMaximum: { damage: number } } };
        assert.equal(body.upgrade.context.attack, 100, 'comparison context is server-owned');
        assert.equal(body.upgrade.nextMaximum.damage, 110);
        assert.equal(body.upgrade.referenceRoadmap.length, 4);
        assert.equal(body.versions.length, 1);
        assert.ok(body.selected.practice.time.periods.every(period => period.members.length === 0));
        assert.equal((await request('game-technique?techniqueId=nghich-menh')).status, 409, 'sealed names/profiles remain private');
        assert.equal((await request('game-technique?techniqueId=kiem-y&versionId=foreign_edition')).status, 409);
        const oldest = newPracticeVersion('retained_oldest', 'kiem-y', current.day.day);
        oldest.edition = 2;
        oldest.tiers = Array.from({ length: 4 }, (_, index) => ({ tier: index + 1, purityBp: 10000, effortMilli: 10000,
            defectsMilli: 0, startedDay: current.day.day, lockedDay: current.day.day }));
        const archived = Array.from({ length: 21 }, (_, index) => ({ ...oldest, id: 'archived_edition_' + index, edition: index + 3 }));
        await db.batch([oldest, ...archived].map((version, index) => db.prepare(`INSERT INTO practice_versions
            (owner,id,technique_id,state_json,created_day,created,updated,maintained,strength_score) VALUES(?,?,?,?,?,?,?,?,?)`)
            .bind('123', version.id, 'kiem-y', JSON.stringify(version), current.day.day, monday - 1000 + index,
                monday, index === 0 ? 1 : 0, 154000)));
        const retained = await request('game-technique?techniqueId=kiem-y');
        const retainedBody = await retained.json() as { versions: { practice: { id: string } }[] };
        assert.equal(retained.status, 200);
        assert.equal(retainedBody.versions.length, 2);
        assert.ok(retainedBody.versions.some(value => value.practice.id === oldest.id), 'retained edition is found beyond the latest 20 history rows');
        const history = await request('game-technique?techniqueId=kiem-y&versionId=archived_edition_0');
        const historical = await history.json() as { selected: { maintained: boolean }; versions: unknown[] };
        assert.equal(history.status, 200);
        assert.equal(historical.selected.maintained, false);
        assert.equal(historical.versions.length, 2);
    } finally { await mf.dispose(); }
});
