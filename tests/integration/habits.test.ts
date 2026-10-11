import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { createHmac } from 'node:crypto';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { RecurrenceStore } from '../../src/adapters/d1/recurrence-store.ts';
import { reminderAllowed } from '../../src/adapters/d1/reminders.ts';
import { flushOutbox } from '../../src/adapters/d1/outbox.ts';
import type { Env } from '../../src/config/env.ts';
import { DayPlanStore } from '../../src/adapters/d1/day-plan-store.ts';
import { TaskDayStore } from '../../src/adapters/d1/task-day-store.ts';
import { TimelineStore } from '../../src/adapters/d1/timeline-store.ts';

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

test('habit list keeps a fixed D1 query budget at 30 active habits and projects all weekly logs', async () => {
    const { mf, db, store } = await database();
    try {
        const day = (await store.today('123', monday)).day.day;
        const statements = [];
        for (let index = 0; index < 30; index++) {
            const id = 'habit_scale_' + String(index).padStart(2, '0');
            const definition = { ...duration, target: 2000, unit: 'phút', note: '', commitmentFrom: day,
                cadence: { kind: 'weekly', quota: 3 } };
            statements.push(db.prepare('INSERT INTO habits(id,owner,created_day,next_day,created,updated) VALUES(?,?,?,?,?,?)').bind(id, '123', day, day, monday, monday));
            statements.push(db.prepare('INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES(?,?,?,?)').bind('123', id, day, JSON.stringify(definition)));
            statements.push(db.prepare('INSERT INTO habit_logs(owner,habit_id,day,value,note,updated) VALUES(?,?,?,?,?,?)').bind('123', id, day, 2000, '', monday));
        }
        await db.batch(statements);
        let queries = 0;
        const measured: Database = { prepare: sql => { queries++; return db.prepare(sql); }, batch: items => db.batch(items) };
        const data = await new D1HabitStore(measured).today('123', monday + 5 * DAY, true);
        assert.equal(data.habits.length, 30);
        assert.ok(data.habits.every(view => view.preview!.misses === 1 && view.preview!.period.completedDays.length === 1));
        assert.ok(queries <= 25, 'Full habit load including schedule reads must leave headroom below 50: ' + queries);
    } finally { await mf.dispose(); }
});

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
        const report = await store.report('123', day, day + 6, created.habitId);
        assert.equal(report.successes, 1); assert.equal(report.misses, 2); assert.equal(report.rate, 33);
        assert.equal(report.neutral, 4); assert.equal(report.totals[0]!.value, 2000);
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

test('habit HTTP preserves auth and strict inputs; optional recurring reminders keep sleep semantics and archive boundaries', async () => {
    const { mf, db, store, service, schedule } = await database();
    try {
        const token = '123:fake', env = { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
            TELEGRAM_BOT_TOKEN: token, DELIVERY_MODE: 'outbox', ASSETS: { fetch: async () => new Response('test') } } as Env;
        const signed = (at: number) => {
            const params = new URLSearchParams({ auth_date: String(Math.floor(at / 1000)), user: JSON.stringify({ id: 123 }) });
            params.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
                .update([...params].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n')).digest('hex'));
            return { 'X-Telegram-Init-Data': params.toString() };
        };
        const request = (path: string, input: unknown = null, at = monday, headers: Record<string, string> = signed(at)) => miniAppApi(
            new Request('https://local/api/' + path, { method: input ? 'POST' : 'GET', headers: { Origin: 'https://local', ...headers }, ...(input ? { body: JSON.stringify(input) } : {}) }), env, at);
        assert.equal((await request('habits', null, monday, {})).status, 401);
        assert.equal((await request('habits', { id: 'bad_owner_001', operation: 'create', definition: duration, owner: '456' })).status, 400);
        assert.equal((await request('habits', { id: 'bad_time_0001', operation: 'create', definition: duration, reminderTime: '25:00' })).status, 400);
        assert.equal((await request('habit-report?from=1&to=1000')).status, 400);
        const created = await service.execute('123', 'create_remind1', { operation: 'create', definition: {
            ...duration, cadence: { kind: 'weekdays', weekdays: [0] } }, reminderTime: '23:00' }, monday);
        const rules = await new RecurrenceStore(db).rules('123');
        assert.equal(rules.length, 1); assert.deepEqual(rules[0]!.weekdays, [1]);
        assert.equal((await store.today('123', monday)).habits[0]!.reminderTime, '23:00');
        const bedtime = Date.parse('2026-10-12T22:45:00+07:00'), due = bedtime + 15 * 60000;
        await schedule.reportSleep('123', bedtime);
        const state = await new HealthyStore(db).read('123');
        await new RecurrenceStore(db).queueDue('123', due, false);
        const row = await db.prepare("SELECT reminder_id,id FROM outbox WHERE id LIKE 'recurring:%'").first<{ reminder_id: string; id: string }>();
        assert.ok(row); assert.equal(await reminderAllowed(db, row.reminder_id, due), true);
        const calls: unknown[] = [];
        await flushOutbox(env, (async (_url, options) => { calls.push(JSON.parse(options!.body as string));
            return Response.json({ ok: true, result: { message_id: 99 } }); }) as typeof fetch, due, () => due, row.id);
        assert.equal(calls.length, 1, 'Opted-in habit reminder is delivered while asleep');
        assert.equal((await store.today('123', due)).habits[0]!.log.value, 0, 'Sending/ACK is not completing a habit');
        assert.deepEqual(await new HealthyStore(db).read('123'), state);
        await service.execute('123', 'archive_remind', { operation: 'archive', habitId: created.habitId, version: 1 }, due);
        await new RecurrenceStore(db).queueDue('123', due + 60000, false);
        assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'recurring:%'").first<{ n: number }>())!.n, 1,
            'A rule version change cannot resend a delivered habit reminder slot');
        await new RecurrenceStore(db).queueDue('123', due + 7 * DAY, false);
        const next = await db.prepare("SELECT reminder_id FROM outbox WHERE id LIKE 'recurring:%' AND state='pending'").first<{ reminder_id: string }>();
        assert.equal(next, null, 'Archiving sets an explicit reminder end date rather than growing undeliverable jobs');
        // A reminder before the wake boundary belongs to the previous operating
        // day; selected weekdays must be shifted rather than silently skipped.
        await service.execute('123', 'night_remind01', { operation: 'create', definition: {
            ...duration, cadence: { kind: 'weekdays', weekdays: [0] } }, reminderTime: '01:00' }, monday);
        const night = (await new RecurrenceStore(db).rules('123')).find(rule => rule.times[0] === '01:00')!;
        assert.deepEqual(night.weekdays, [2]); assert.equal(night.startDate, '2026-10-13');
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

test('habit reservations preserve task windows, block collisions, survive replans and never issue task tickets or completion', async () => {
    const { mf, db, store, service, schedule } = await database();
    try {
        const now = monday + 3 * 3600000;
        await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','Work',0); INSERT INTO task_planning(owner,task_id,remaining_minutes,updated) VALUES('123','a',60,0)");
        await new TaskDayStore(db).activateAutomatic('123', now);
        const plans = new DayPlanStore(db), plan = (await plans.ensure('123', now))!;
        const windows = structuredClone(plan.plan.items[0]!.windows);
        const created = await service.execute('123', 'create_slot_01', { operation: 'create', definition: duration }, now);
        const data = await store.today('123', now), day = data.day.day;
        const at = Math.ceil(windows.at(-1)!.end / 300000) * 300000 + 15 * 60000;
        const input = { operation: 'slot', habitId: created.habitId, version: 1, day, startAt: at, minutes: 20 };
        const result = await service.execute('123', 'reserve_habit1', input, now);
        assert.deepEqual(await service.execute('123', 'reserve_habit1', input, now), result);
        let current = (await plans.ensure('123', now))!;
        assert.deepEqual(current.plan.items[0]!.windows, windows, 'Adding into free time cannot move existing work');
        assert.ok(current.plan.capacity < plan.plan.capacity, 'Reservation reduces usable task capacity and keeps the existing 20% buffer');
        assert.equal((await store.today('123', now)).habits[0]!.log.value, 0);
        assert.equal((await new TimelineStore(db).read('123', now))!.habitSlots[0]!.habitId, created.habitId);
        await assert.rejects(service.execute('123', 'stale_habit01', { ...input, minutes: 30 }, now), /HABIT_CHANGED/);
        await assert.rejects(service.execute('123', 'overlap_task01', { ...input, version: 2, startAt: windows[0]!.start }, now), /HABIT_SLOT_CONFLICT/);
        const other = await service.execute('123', 'create_slot_02', { operation: 'create', definition: duration }, now);
        await assert.rejects(service.execute('123', 'overlap_habit1', { ...input, habitId: other.habitId }, now), /HABIT_SLOT_CONFLICT/);
        const ownerDay = (await schedule.ensureDay('123', now))!;
        await schedule.replan('123', now, ownerDay.version, [{ start: ownerDay.start_at, end: ownerDay.target_sleep }], [],
            [{ id: 'a', status: 'active', deleted: false, deadline: null, remainingMinutes: 180 }], 'reserve_replan');
        current = (await plans.ensure('123', now))!;
        assert.ok(current.plan.items[0]!.windows.every(window => window.end <= at || window.start >= at + 20 * 60000));
        await service.execute('123', 'remove_slot01', { operation: 'remove_slot', habitId: created.habitId, version: 2, day }, now);
        assert.equal((await store.today('123', now)).habits[0]!.slot, null);
        await assert.rejects(service.execute('123', 'old_day_slot1', { ...input, version: 3 }, data.day.endAt + 1), /HABIT_DAY_CLOSED/);
        const awards = await db.prepare("SELECT COUNT(*) AS n FROM task_ticket_awards WHERE owner='123'").first<{ n: number }>();
        assert.equal(awards!.n, 0);
    } finally { await mf.dispose(); }
});
