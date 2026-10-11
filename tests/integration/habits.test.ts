import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';

const monday = Date.parse('2026-10-12T08:00:00+07:00'), DAY = 86400000;
async function database() {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, monday);
    const store = new D1HabitStore(db), service = new HabitService(store);
    return { mf, db, schedule, store, service };
}
const duration = { name: 'Đọc sách', metric: 'duration', target: 20, cadence: { kind: 'daily' } };

test('habit logs replace totals, preserve healthy state, serialize clients and replay committed requests after closure', async () => {
    const { mf, db, schedule, store, service } = await database();
    try {
        const before = await new HealthyStore(db).read('123');
        const created = await service.execute('123', 'create_daily_01', { operation: 'create', definition: duration }, monday);
        let data = await store.today('123', monday), habit = data.habits[0]!;
        assert.equal(habit.preview!.reason, 'not_started');
        assert.equal(created.effectiveFrom, data.day.day + 1);
        const tomorrow = monday + DAY;
        data = await store.today('123', tomorrow); habit = data.habits[0]!;
        const input = { operation: 'log', habitId: created.habitId, version: 1, day: data.day.day, logVersion: 0, value: 15, note: '<img src=x onerror=alert(1)>' };
        await service.execute('123', 'log_partial_01', input, tomorrow);
        assert.equal((await store.today('123', tomorrow)).habits[0]!.preview!.successes, 0);
        const edits = await Promise.allSettled([20, 25].map((value, i) => service.execute('123', 'concurrent_' + i,
            { ...input, value, logVersion: 1 }, tomorrow)));
        assert.equal(edits.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((await store.today('123', tomorrow)).habits[0]!.preview!.successes, 1);
        const finalInput = { ...input, value: 15, logVersion: 2 };
        const result = await service.execute('123', 'log_final_0001', finalInput, tomorrow);
        const end = data.day.endAt;
        assert.deepEqual(await service.execute('123', 'log_final_0001', finalInput, end + 1), result);
        await assert.rejects(service.execute('123', 'new_old_log01', finalInput, end + 1), /HABIT_DAY_CLOSED/);
        await assert.rejects(service.execute('123', 'log_final_0001', { ...finalInput, value: 30 }, end + 1), /REQUEST_ID_REUSED/);
        await store.settle('123', end + 1, 10);
        await store.settle('123', end + 1, 10);
        const history = await store.history('123', data.day.day - 1, data.day.day, null, null, 10);
        assert.equal(history.rows.find(row => row.day === data.day.day)!.misses, 1);
        assert.equal(history.rows.find(row => row.day === data.day.day)!.value, 1500);
        assert.deepEqual(await new HealthyStore(db).read('123'), before);
        assert.equal((await store.today('456', tomorrow).catch(() => null)), null);
        assert.equal((await store.history('456', data.day.day - 1, data.day.day, null, null, 10)).rows.length, 0);
        // Changing settings must not reopen today's stored window.
        await schedule.configure('123', '06:00', '22:30', 1, end + 1);
        assert.equal((await store.today('123', end + 1)).day.day, data.day.day + 1);
    } finally { await mf.dispose(); }
});

test('weekly commitments survive future edits and archive, settle missing days and keep immutable pagination', async () => {
    const { mf, store, service } = await database();
    try {
        const created = await service.execute('123', 'create_weekly01', { operation: 'create', definition: { ...duration, cadence: { kind: 'weekly', quota: 3 } } }, monday);
        const nextMonday = monday + 7 * DAY, first = await store.today('123', nextMonday), day = first.day.day;
        await service.execute('123', 'week_day1_0001', { operation: 'log', habitId: created.habitId, day, version: 1, logVersion: 0, value: 20 }, nextMonday);
        // Removing a weekly habit midweek cannot erase this week's commitment.
        const archived = await service.execute('123', 'archive_week01', { operation: 'archive', habitId: created.habitId, version: 1 }, nextMonday + 2 * DAY);
        assert.equal(archived.effectiveFrom, day + 7);
        assert.equal((await store.today('123', nextMonday + 5 * DAY)).habits[0]!.preview!.misses, 1);
        for (let i = 0; i < 5; i++) await store.settle('123', nextMonday + 7 * DAY, 6);
        let history = await store.history('123', day, day + 6, created.habitId, null, 100);
        assert.deepEqual(history.rows.filter(row => row.misses).map(row => row.day), [day + 6, day + 5]);
        assert.equal(history.rows.reduce((sum, row) => sum + row.successes + row.misses, 0), 3);
        assert.equal((await store.today('123', nextMonday + 7 * DAY)).habits.length, 0);
        const page1 = await store.history('123', day, day + 6, null, null, 3);
        const page2 = await store.history('123', day, day + 6, null, page1.next, 3);
        assert.equal(new Set([...page1.rows, ...page2.rows].map(row => row.day + ':' + row.habitId)).size, 6);
        await service.execute('123', 'restore_week01', { operation: 'restore', habitId: created.habitId, version: 2 }, nextMonday + 7 * DAY);
        const restoring = await store.today('123', nextMonday + 7 * DAY, true);
        assert.equal(restoring.habits[0]!.preview!.reason, 'archived');
        await assert.rejects(service.execute('123', 'archived_log01', { operation: 'log', habitId: created.habitId,
            day: day + 7, version: 3, logVersion: 0, value: 20 }, nextMonday + 7 * DAY), /HABIT_ARCHIVED/);
        for (let i = 0; i < 4; i++) await store.settle('123', nextMonday + 14 * DAY, 6);
        history = await store.history('123', day, day + 13, created.habitId, null, 100);
        assert.equal(history.rows.filter(row => row.day >= day + 7).reduce((sum, row) => sum + row.successes + row.misses, 0), 0);
        assert.equal((await store.today('123', nextMonday + 14 * DAY)).habits[0]!.preview!.reason, 'still_flexible');
    } finally { await mf.dispose(); }
});

test('pending habit revisions never rewrite a log or closed target and failed batches roll back the receipt', async () => {
    const { mf, db, store, service } = await database();
    try {
        const created = await service.execute('123', 'create_edit_01', { operation: 'create', definition: duration }, monday);
        const today = await store.today('123', monday + DAY), day = today.day.day;
        await service.execute('123', 'log_edit_0001', { operation: 'log', habitId: created.habitId, day, version: 1, logVersion: 0, value: 20 }, monday + DAY);
        await service.execute('123', 'update_habit01', { operation: 'update', habitId: created.habitId, version: 1,
            definition: { ...duration, name: 'Đọc thêm', target: 30 } }, monday + DAY);
        const view = (await store.today('123', monday + DAY)).habits[0]!;
        assert.equal(view.definition.target, 2000); assert.equal(view.preview!.successes, 1);
        assert.equal(view.pending!.definition.target, 3000);
        await store.settle('123', monday + 2 * DAY, 10);
        const history = await store.history('123', day, day, null, null, 10);
        assert.equal(history.rows[0]!.definition.target, 2000);
        assert.equal((await store.today('123', monday + 2 * DAY)).habits[0]!.definition.target, 3000);
        const faultDB: Database = { prepare: sql => db.prepare(sql), batch: async statements => db.batch([
            ...statements.slice(0, 3), db.prepare('INSERT INTO transaction_guard(valid) VALUES(0)'), ...statements.slice(3),
        ]) };
        const fault = new HabitService(new D1HabitStore(faultDB));
        await assert.rejects(fault.execute('123', 'failed_create01', { operation: 'create', definition: duration }, monday + 2 * DAY));
        assert.equal((await store.today('123', monday + 2 * DAY)).habits.length, 1);
        assert.equal(await db.prepare("SELECT request_id FROM habit_receipts WHERE request_id='failed_create01'").first(), null);
        await service.execute('123', 'failed_create01', { operation: 'create', definition: duration }, monday + 2 * DAY);
        assert.equal((await store.today('123', monday + 2 * DAY)).habits.length, 2);
    } finally { await mf.dispose(); }
});
