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
test('weekly audit closes after mode becomes idle, retains late misses, and locks the original funded tier', async () => {
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
        assert.equal(version.tiers.length, 1); assert.equal(version.tiers[0]!.purityBp, 4285);
        assert.equal(version.tiers[0]!.defectsMilli, 2000); assert.equal(version.tiers[0]!.lockedDay, day + 6);
        assert.deepEqual(version.pendingWeeks, []);
        const audit = await db.prepare('SELECT closed_day,state_json FROM practice_week_audits WHERE owner=? AND habit_id=?')
            .bind('123', weekly.habitId).first<{ closed_day: number; state_json: string }>();
        assert.equal(audit!.closed_day, day + 6); assert.equal(JSON.parse(audit!.state_json).misses, 2);
    } finally { await mf.dispose(); }
});
test('30 weekly habits settle and load with bounded SQL statements, response bytes and capped training speed', async () => {
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
        assert.equal(data.currentPractice.practice.progressMilli, 1600);
        assert.equal(data.audits.length, 30); assert.equal(data.currentPractice.practice.pendingWeeks.length, 30);
        assert.ok(count <= 50, 'Free invocation SQL budget: ' + count);
        assert.ok(Buffer.byteLength(raw) < 50000, 'Bounded overview response bytes: ' + Buffer.byteLength(raw));
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
    } finally { await mf.dispose(); }
});
