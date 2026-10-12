import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import type { ToolCall, ModelStep } from '../../src/ai/contracts.ts';
import { validateTool } from '../../src/ai/policy.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import { ConversationStore } from '../../src/adapters/d1/conversation-store.ts';
import { D1HabitGameCompanion } from '../../src/adapters/d1/habit-game-companion.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { D1GameStore } from '../../src/adapters/d1/game-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { executeTool } from '../../src/application/tool-executor.ts';
import { buildContext } from '../../src/application/context-builder.ts';

const NOW = Date.parse('2026-10-12T08:00:00+07:00');
const definition = { name: 'Đọc sách', metric: 'duration', target: 20, cadence: { kind: 'weekly', quota: 3 } };
async function setup() {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, NOW);
    const store = new D1WorkStore(db), companion = new D1HabitGameCompanion(db);
    const service = new HabitService(new D1HabitStore(db));
    return { mf, db, store, companion, service };
}
function step(calls: ToolCall[]): ModelStep { return { content: { role: 'model', parts: calls.map(functionCall => ({ functionCall })) }, calls, text: '' }; }
async function leaseFor(store: D1WorkStore, id: number, at = NOW) {
    await store.accept({ owner: '123', chat: 123, updateId: id, text: '/ synthetic fixture' }, at, false);
    return (await store.claim('123', at))!;
}

test('bot reads real units, archive restoration IDs and private owner scope without any write or day settlement', async () => {
    const { mf, db, service } = await setup();
    try {
        const saved = await service.execute('123', 'read_habit_001', { operation: 'create', definition }, NOW);
        await service.execute('123', 'read_habit_002', { operation: 'log', habitId: saved.habitId, version: 1, day: saved.day, logVersion: 0, value: 15, note: 'fixture' }, NOW);
        const readOnly: Database = { prepare: sql => {
            assert.match(sql.trim(), /^SELECT\b/i, 'Companion reads must not initialize or settle state'); return db.prepare(sql);
        }, batch: async () => { throw Error('READ_MUST_NOT_BATCH'); } };
        const reader = new D1WorkStore(readOnly);
        const found = await executeTool({ name: 'find_habits', args: { query: 'doc sach', status: 'active', cursor: 0 } }, reader, '123', 1, NOW);
        const habit = (found.result.habits as Record<string, unknown>[])[0]!;
        assert.equal(habit.id, saved.habitId); assert.equal(habit.value, 15); assert.equal(habit.met, false);
        assert.equal((habit.definition as Record<string, unknown>).target, 20);
        assert.equal((await reader.habitGame.findHabits('999', '', 0, NOW)).day, null);
        assert.equal((await reader.habitGame.game('123', 'library', NOW)).day, saved.day);
        const healthy = await new HealthyStore(db).read('123');
        await reader.habitGame.context('123', NOW);
        assert.deepEqual(await new HealthyStore(db).read('123'), healthy);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM game_days').first<{ n: number }>())!.n, 0);
        await service.execute('123', 'archive_habit01', { operation: 'archive', habitId: saved.habitId, version: 1 }, NOW);
        const later = NOW + 8 * 86400000;
        await new ScheduleStore(db).ensureDay('123', later);
        assert.equal(((await reader.habitGame.findHabits('123', '', 0, later)).habits as unknown[]).length, 0);
        const archived = (await reader.habitGame.findHabits('123', '', 0, later, 'all')).habits as Record<string, unknown>[];
        assert.equal(archived[0]!.id, saved.habitId); assert.equal(archived[0]!.version, 2);
    } finally { await mf.dispose(); }
});

test('native habit tool journals business writes together and replays after lost final reply without granting game or task rewards', async () => {
    const { mf, db, store, companion } = await setup();
    try {
        const lease = await leaseFor(store, 101), journal = new ConversationStore(db, undefined, 'action');
        const call: ToolCall = { name: 'habit_action', args: { command: { operation: 'create', definition } } };
        let modelCalls = 0;
        const run = () => journal.turn(lease, [], store, () => { throw Error('NOT_A_TASK_MUTATION'); }, async () => { modelCalls++; return step([call]); }, () => NOW);
        assert.match(await run(), /đã lưu/i); assert.equal(modelCalls, 1);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habits').first<{ n: number }>())!.n, 1);
        assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM tool_steps WHERE kind='write'").first<{ n: number }>())!.n, 1);
        await db.prepare('UPDATE command_inbox SET tool_reply=NULL WHERE owner=? AND update_id=?').bind('123', 101).run();
        assert.match(await run(), /đã lưu/i); assert.equal(modelCalls, 1);
        const found = await companion.findHabits('123', '', 0, NOW), habit = (found.habits as Record<string, unknown>[])[0]!;
        assert.equal(habit.id, 'h_companion_101');
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM game_days').first<{ n: number }>())!.n, 0);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{ n: number }>())!.n, 0);
    } finally { await mf.dispose(); }
});

test('prepared habit log rolls back with failed journal and rejects stale versions, foreign IDs and closed days', async () => {
    const { mf, db, store, companion, service } = await setup();
    try {
        const saved = await service.execute('123', 'atomic_habit001', { operation: 'create', definition }, NOW);
        const command = { operation: 'log', habitId: saved.habitId, version: 1, day: saved.day, logVersion: 0, value: 20 };
        const prepared = await companion.prepare('123', 'atomic_log_001', 'habit', command, NOW);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habit_logs').first<{ n: number }>())!.n, 0);
        const lease = await leaseFor(store, 102), journal = new ConversationStore(db);
        const request = { name: 'habit_action', args: { command } };
        await assert.rejects(journal.commitWrite(lease, request, { status: 'applied' }, [...prepared.statements, db.prepare('INSERT INTO transaction_guard VALUES(0)')], NOW));
        assert.equal(await journal.writeResult(lease, request), null);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habit_logs').first<{ n: number }>())!.n, 0);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habit_receipts WHERE request_id=?').bind('atomic_log_001').first<{ n: number }>())!.n, 0);
        await journal.commitWrite(lease, request, { status: 'applied' }, prepared.statements, NOW);
        await assert.rejects(companion.prepare('123', 'stale_log_001', 'habit', command, NOW), /HABIT_LOG_CHANGED/);
        await assert.rejects(companion.prepare('123', 'foreign_log001', 'habit', { ...command, habitId: 'h_foreign_001' }, NOW), /HABIT_NOT_FOUND/);
        await assert.rejects(companion.prepare('123', 'closed_log_001', 'habit', { ...command, day: saved.day - 1 }, NOW), /HABIT_DAY_CLOSED/);
        await assert.rejects(executeTool({ name: 'habit_action', args: { command } }, store, '123', 103, NOW), /REQUIRES_JOURNAL/);
    } finally { await mf.dispose(); }
});

test('chat may read habit/game but cannot write; companion writes cannot join a task batch or bypass restart confirmation', async () => {
    const { mf, db, store, companion } = await setup();
    try {
        const lease = await leaseFor(store, 104);
        const call: ToolCall = { name: 'habit_action', args: { command: { operation: 'create', definition } } };
        const chat = new ConversationStore(db, undefined, 'chat');
        assert.match(await chat.turn(lease, [], store, () => [], async () => step([call]), () => NOW), /gửi \/ /);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habits').first<{ n: number }>())!.n, 0);
        const action = new ConversationStore(db);
        await assert.rejects(action.commitBatch(lease, [call, { name: 'create_task', args: { title: 'fixture', deadline: null } }], '', store, () => [], NOW), /INVALID_BATCH_OPERATION/);
        assert.throws(() => validateTool({ name: 'habit_action', args: { command: { operation: 'create', definition, owner: '999' } } }, NOW), /INVALID_TOOL_FIELDS/);
        assert.throws(() => validateTool({ name: 'practice_action', args: { command: { operation: 'start_practice', day: 1, version: 0, techniqueId: 'kiem-y', confirmRestart: true } } }, NOW), /INVALID_TOOL_FIELDS/);
        await assert.rejects(companion.prepare('123', 'forced_restart1', 'practice', { operation: 'start_practice', day: 1, version: 0, techniqueId: 'kiem-y', confirmRestart: true }, NOW), /RESTART_REQUIRES_WEB/);
    } finally { await mf.dispose(); }
});

test('native cultivation uses next-day selection, does not train immediately, and a later first-edition request needs web confirmation', async () => {
    const { mf, db, store, companion } = await setup();
    try {
        const game = await new D1GameStore(db).read('123', NOW), lease = await leaseFor(store, 105);
        const journal = new ConversationStore(db, undefined, 'action');
        const call: ToolCall = { name: 'practice_action', args: { command: { operation: 'start_practice', day: game.day.day, version: game.version, techniqueId: 'kiem-y' } } };
        assert.match(await journal.turn(lease, [], store, () => [], async () => step([call]), () => NOW), /kế tiếp/);
        const after = await new D1GameStore(db).read('123', NOW);
        assert.equal(after.current.mode, 'idle'); assert.equal(after.pending!.fromDay, game.day.day + 1);
        assert.equal(after.pendingPractice!.practice.progressMilli, 0);
        assert.equal(after.pendingPractice!.practice.id, 'p_companion_105');
        const existing = await executeTool({ name: 'get_game', args: { section: 'versions', techniqueId: 'kiem-y', before: null } }, store, '123', 105, NOW);
        assert.equal((existing.result.versions as { id: string }[])[0]!.id, after.pendingPractice!.practice.id);
        assert.equal((await companion.game('999', 'versions', NOW, 'kiem-y', null)).day, null);
        await assert.rejects(companion.prepare('123', 'restart_again01', 'practice', { ...call.args.command as object, version: after.version }, NOW), /CONFIRM_PRACTICE_RESTART/);
    } finally { await mf.dispose(); }
});

test('habit preparation crossing the activity-day boundary cannot commit even while lease is valid', async () => {
    const { mf, db, store } = await setup();
    try {
        const boundary = (await new ScheduleStore(db).ensureDay('123', NOW))!.end_at;
        let now = boundary - 1000;
        const lease = await leaseFor(store, 106, now), companion = store.habitGame;
        const reader = Object.create(store) as D1WorkStore;
        Object.defineProperty(reader, 'habitGame', { value: { ...companion, prepare: async (...args: Parameters<typeof companion.prepare>) => {
            const prepared = await companion.prepare(...args); now = boundary; return prepared;
        } } });
        const journal = new ConversationStore(db, undefined, 'action');
        const call: ToolCall = { name: 'habit_action', args: { command: { operation: 'create', definition } } };
        let calls = 0;
        const reply = await journal.turn(lease, [], reader, () => [], async () => ++calls === 1 ? step([call]) : { content: { role: 'model', parts: [{ text: 'fixture' }] }, calls: [], text: 'fixture' }, () => now);
        assert.doesNotMatch(reply, /đã lưu/i);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habits').first<{ n: number }>())!.n, 0);
        assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM tool_steps WHERE kind='write'").first<{ n: number }>())!.n, 0);
    } finally { await mf.dispose(); }
});

test('lost business-commit acknowledgement recovers the receipt; unavailable recovery ends the turn without guessed writes', async () => {
    for (const recoveryFails of [false, true]) {
        const { mf, db, store } = await setup();
        try {
            const lease = await leaseFor(store, 107);
            let ackLost = false, models = 0;
            const fault: Database = { prepare: sql => {
                if (recoveryFails && ackLost && sql.includes("kind='write'")) throw Error('FIXTURE_READ_UNAVAILABLE');
                return db.prepare(sql);
            }, batch: async writes => {
                const result = await db.batch(writes);
                if (!ackLost && (await db.prepare('SELECT COUNT(*) AS n FROM habits').first<{ n: number }>())!.n) {
                    ackLost = true; throw Error('FIXTURE_ACK_LOST');
                }
                return result;
            } };
            const journal = new ConversationStore(fault, undefined, 'action');
            const call: ToolCall = { name: 'habit_action', args: { command: { operation: 'create', definition } } };
            const reply = await journal.turn(lease, [], store, () => [], async () => { models++; return step([call]); }, () => NOW);
            assert.equal(models, 1); assert.equal(ackLost, true);
            assert.match(reply, recoveryFails ? /chưa xác nhận/ : /đã lưu/i);
            assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habits').first<{ n: number }>())!.n, 1);
            assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM tool_steps WHERE kind='write'").first<{ n: number }>())!.n, 1);
        } finally { await mf.dispose(); }
    }
});

test('context with thirty weekly habits is bounded, keeps discoverable pagination and fits the free SQL budget', async () => {
    const { mf, db, service } = await setup();
    try {
        for (let i = 0; i < 30; i++) await service.execute('123', 'budget_habit_' + i, { operation: 'create', definition: { ...definition, name: 'Habit ' + i, note: 'x'.repeat(300) } }, NOW);
        let count = 0;
        const measured: Database = { prepare: sql => { count++; return db.prepare(sql); }, batch: writes => db.batch(writes) };
        const context = await buildContext(new D1WorkStore(measured), '123', 'Hôm nay thế nào?', NOW);
        assert.ok(context.context.length < 28000, 'Actual context size ' + context.context.length);
        const data = JSON.parse(context.context).habitGame;
        assert.equal(data.total, 30); assert.equal(data.habits.length, 6); assert.equal(data.nextCursor, 6);
        assert.ok(count <= 50, 'Free invocation SQL budget: ' + count);
    } finally { await mf.dispose(); }
});
