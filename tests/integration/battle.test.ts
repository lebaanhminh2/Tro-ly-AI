import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { D1GameStore } from '../../src/adapters/d1/game-store.ts';
import { D1BattleStore } from '../../src/adapters/d1/battle-store.ts';
import { BattleService } from '../../src/application/battle-service.ts';
import { PracticeService } from '../../src/application/practice-service.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { readGame } from '../../src/entrypoints/mini-app/game.ts';
import type { Env } from '../../src/config/env.ts';
import { initialHealthy } from '../../src/domain/healthy.ts';
import { fighterForRank } from '../../src/domain/battle-economy.ts';
import { newBattleState } from '../../src/domain/battle.ts';
import { bossById, bossIntents } from '../../src/domain/game-content.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { searchBattle } from '../../scripts/simulate-game.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';

const at = Date.parse('2026-10-12T08:00:00+07:00'), DAY = 86400000;
async function database(point = at) {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, point);
    const game = new D1GameStore(db), store = new D1BattleStore(db);
    return { mf, db, game, store, service: new BattleService(store) };
}
test('prepare is tomorrow-only, canonical replay survives closure, forged loadouts fail, and concurrent preparations cannot fork', async () => {
    const { mf, db, game, store, service } = await database();
    try {
        const first = await game.read('123', at), input = { operation: 'prepare_battle', day: first.day.day, version: 0, bossId: 'truy-lenh', versions: [] };
        await assert.rejects(service.execute('123', 'fake_loadout001', { ...input, versions: ['other_owner_v1'] }, at), /INVALID_BATTLE_LOADOUT/);
        const results = await Promise.allSettled(['prepare_first01', 'prepare_first02'].map(id => service.execute('123', id, input, at)));
        assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
        const winner = results.findIndex(row => row.status === 'fulfilled'), saved = (results[winner] as PromiseFulfilledResult<{ battleId: string }>).value;
        const overview = await game.read('123', at);
        assert.equal(overview.current.mode, 'idle'); assert.equal(overview.pending!.mode, 'battle');
        assert.equal(overview.pending!.fromDay, first.day.day + 1);
        assert.deepEqual(await service.execute('123', 'prepare_first0' + (winner + 1), input, at + DAY), saved);
        assert.equal(await store.readBattle('456', saved.battleId), null);
        await assert.rejects(service.execute('123', 'choose_early001', { operation: 'choose_battle', day: first.day.day, version: overview.version,
            battleId: saved.battleId, battleVersion: 1, techniqueId: 'vo-ky', acceptCost: false }, at), /BATTLE_NOT_STARTED/);
        const fault: Database = { prepare: sql => db.prepare(sql), batch: statements => db.batch([
            ...statements.slice(0, 4), db.prepare('INSERT INTO transaction_guard(valid) VALUES(0)'), ...statements.slice(4),
        ]) };
        const cancel = { operation: 'cancel_battle', day: first.day.day, version: overview.version, battleId: saved.battleId, battleVersion: 1 };
        await assert.rejects(new BattleService(new D1BattleStore(fault)).execute('123', 'failed_cancel01', cancel, at));
        assert.equal((await store.readBattle('123', saved.battleId))!.status, 'prepared');
        assert.equal(await db.prepare("SELECT request_id FROM game_receipts WHERE request_id='failed_cancel01'").first(), null);
        await service.execute('123', 'failed_cancel01', cancel, at);
        assert.equal((await store.readBattle('123', saved.battleId))!.status, 'cancelled');
        assert.deepEqual((await new HealthyStore(db).read('123')).state, initialHealthy());
    } finally { await mf.dispose(); }
});

test('weekly practice obligations close across battle and safe absence without gaining practice progress from battle sources', async () => {
    const { mf, db, game, service } = await database(at - DAY);
    try {
        const habits = new D1HabitStore(db), logging = new HabitService(habits), practice = new PracticeService(game);
        const daily = await logging.execute('123', 'battle_audit_h1', { operation: 'create', definition: { name: 'Daily', metric: 'check', target: 1, cadence: { kind: 'daily' } } }, at - DAY);
        const weekly = await logging.execute('123', 'battle_audit_h2', { operation: 'create', definition: { name: 'Weekly', metric: 'check', target: 1, cadence: { kind: 'weekly', quota: 3 } } }, at - DAY);
        const first = await game.read('123', at - DAY), day = first.day.day + 1;
        await practice.execute('123', 'audit_practice1', { operation: 'start_practice', day: day - 1, version: 0, techniqueId: 'kiem-y' }, at - DAY);
        for (let index = 0; index < 3; index++) await logging.execute('123', 'audit_daily_' + index, { operation: 'log', habitId: daily.habitId, day: day + index, version: 1, logVersion: 0, value: 1 }, at + index * DAY);
        await logging.execute('123', 'audit_week_log1', { operation: 'log', habitId: weekly.habitId, day, version: 1, logVersion: 0, value: 1 }, at);
        let current = await game.read('123', at + 2 * DAY);
        await practice.execute('123', 'audit_stop_0001', { operation: 'stop_practice', day: current.day.day, version: current.version }, at + 2 * DAY);
        current = await game.read('123', at + 2 * DAY);
        await service.execute('123', 'audit_battle_01', { operation: 'prepare_battle', day: current.day.day, version: current.version, bossId: 'truy-lenh', versions: [] }, at + 2 * DAY);
        await habits.settle('123', at + 7 * DAY, 30);
        await game.settle('123', at + 7 * DAY, 7); await game.settle('123', at + 7 * DAY, 7);
        const version = (await game.versions('123', 'kiem-y', null, 10)).versions[0]!.practice;
        assert.equal(version.tiers.length, 1); assert.equal(version.tiers[0]!.effortMilli, 3000);
        assert.equal(version.tiers[0]!.defectsMilli, 2000); assert.equal(version.tiers[0]!.purityBp, 4285);
        const receiver = await db.prepare('SELECT receiver_json FROM habit_outcomes WHERE owner=? AND habit_id=? AND day=?').bind('123', weekly.habitId, day + 5).first<{ receiver_json: string }>();
        assert.equal(JSON.parse(receiver!.receiver_json).mode, 'battle');
        const last = await db.prepare("SELECT state_json FROM battles WHERE owner=? ORDER BY created DESC LIMIT 1").bind('123').first<{ state_json: string }>();
        const run = JSON.parse(last!.state_json).run;
        assert.equal(run.state.status, 'withdrawn'); assert.equal(run.state.turn, 0); assert.equal(run.state.player.hp, 180);
        assert.equal((await game.read('123', at + 7 * DAY)).current.mode, 'idle', 'Cancelling a requested stop must not resume practice');
    } finally { await mf.dispose(); }
});

test('a battle day with 30 weekly sources fits the free invocation SQL and overview payload budgets', async () => {
    const { mf, db, game, store, service } = await database();
    try {
        const first = await game.read('123', at), day = first.day.day;
        const saved = await service.execute('123', 'budget_battle01', { operation: 'prepare_battle', day, version: 0, bossId: 'truy-lenh', versions: [] }, at);
        const statements = [];
        for (let index = 0; index < 30; index++) {
            const id = 'battle_budget_' + index, definition = { name: 'Budget ' + index, metric: 'check', target: 100, unit: 'lần', note: '', cadence: { kind: 'weekly', quota: 3 }, commitmentFrom: day - 7 };
            statements.push(db.prepare('INSERT INTO habits(owner,id,created_day,next_day,created,updated) VALUES(?,?,?,?,?,?)').bind('123', id, day, day + 2, at, at),
                db.prepare('INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES(?,?,?,?)').bind('123', id, day, JSON.stringify(definition)));
            for (const offset of [0, 1]) statements.push(db.prepare("INSERT INTO habit_outcomes(owner,habit_id,day,revision_day,status,reason,value,successes,misses,settled_at) VALUES(?,?,?,?,'achieved','target_met',100,1,0,?)")
                .bind('123', id, day + offset, day, at + (offset + 1) * DAY));
        }
        await db.batch(statements); await game.settle('123', at + DAY, 1);
        const current = await game.read('123', at + DAY), battle = (await store.readBattle('123', saved.battleId))!;
        await service.execute('123', 'budget_choose01', { operation: 'choose_battle', day: current.day.day, version: current.version, battleId: saved.battleId, battleVersion: battle.version,
            techniqueId: 'vo-ky', acceptCost: false }, at + DAY);
        let count = 0;
        const measured: Database = { prepare: sql => { count++; return db.prepare(sql); }, batch: statements => db.batch(statements) };
        const response = await readGame({ env: { DB: measured } as Env, owner: '123', now: at + 2 * DAY, healthy: new HealthyStore(measured) }, new URL('https://local/api/game'));
        const raw = await response.text(), result = JSON.parse(raw);
        assert.equal(result.battles[0].state.turn, 1); assert.equal(result.recent[0].result.battle.contribution.habits, 600);
        assert.ok(count <= 50, 'SQL invocation budget: ' + count);
        assert.ok(Buffer.byteLength(raw) < 50000, 'Overview payload bytes: ' + Buffer.byteLength(raw));
    } finally { await mf.dispose(); }
});
test('four immutable chosen days produce one victory and unlocks; task contributions are frozen root sources with a global once-only cap', async () => {
    const { mf, db, game, store, service } = await database();
    try {
        for (const id of ['root-one', 'root-two']) await db.prepare('INSERT INTO tasks(id,owner,title,created) VALUES(?,?,?,?)').bind(id, '123', id, at - DAY).run();
        const first = await game.read('123', at), saved = await service.execute('123', 'opening_battle1', { operation: 'prepare_battle', day: first.day.day, version: 0, bossId: 'truy-lenh', versions: [] }, at);
        await game.settle('123', at + DAY, 1);
        for (let offset = 1; offset <= 4; offset++) {
            const now = at + offset * DAY, current = await game.read('123', now), battle = (await store.readBattle('123', saved.battleId))!;
            if (offset === 1) {
                await db.prepare("UPDATE tasks SET status='completed' WHERE owner='123'").run();
                await db.prepare("UPDATE task_completions SET completed_at=? WHERE owner='123'").bind(now).run();
            }
            await service.execute('123', 'opening_choose' + offset, { operation: 'choose_battle', day: current.day.day, version: current.version,
                battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'vo-ky', acceptCost: false }, now);
            await Promise.all([game.settle('123', now + DAY, 1), game.settle('123', now + DAY, 1)]);
        }
        const completed = (await store.readBattle('123', saved.battleId))!;
        assert.equal(completed.run.state.status, 'won'); assert.equal(completed.run.state.turn, 4);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM boss_victories').first<{ n: number }>())!.n, 1);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM task_battle_awards').first<{ n: number }>())!.n, 2);
        const overview = await game.read('123', at + 5 * DAY);
        assert.equal(overview.current.mode, 'idle'); assert.ok(overview.owned.includes('lien-van'));
        const history = await store.history('123', saved.battleId, Number.MAX_SAFE_INTEGER);
        const settlements = history.events.filter(event => event.kind === 'settlement');
        assert.equal(settlements.length, 4);
        assert.equal(settlements.filter(event => event.result.contribution.tasks).length, 1);
        await game.settle('123', at + 5 * DAY, 7);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM boss_victories').first<{ n: number }>())!.n, 1);
        assert.deepEqual((await new HealthyStore(db).read('123')).state, initialHealthy(), 'No extra qi/tickets from battle');
    } finally { await mf.dispose(); }
});
test('rescue commits rank/locks/account/battle together, survives retry, cannot withdraw fatal results, and charges second death once', async () => {
    const { mf, db, game, store, service } = await database();
    try {
        const first = await game.read('123', at), saved = await service.execute('123', 'rescue_battle01', { operation: 'prepare_battle', day: first.day.day, version: 0, bossId: 'truy-lenh', versions: [] }, at);
        await game.settle('123', at + DAY, 1);
        let battle = (await store.readBattle('123', saved.battleId))!;
        const fatalIntent = { id: 'fatal', name: 'Tử kích', description: 'Đã báo.', hits: [999], special: true, heal: 0, armorBuff: 0 };
        battle.run.state = newBattleState(fighterForRank(3), { hp: 9000, maxHp: 9000, attack: 999, armor: 0 },
            [{ id: 'nghich-menh', versionId: 'test_version', tier: 1, purityBp: 10000 }], Array.from({ length: 4 }, () => fatalIntent), 4);
        battle.run.combatRank = 3;
        await db.prepare('UPDATE battles SET state_json=? WHERE owner=? AND id=?').bind(JSON.stringify({ run: battle.run, resumePracticeId: null }), '123', saved.battleId).run();
        await db.prepare('INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)').bind('123', JSON.stringify({ ...initialHealthy(), rank: 3, highestRank: 5, qi: 150, earned: 500, tickets: 4 }), at).run();
        let current = await game.read('123', at + DAY);
        await service.execute('123', 'rescue_fatal001', { operation: 'choose_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'nghich-menh', acceptCost: true }, at + DAY);
        await game.settle('123', at + 2 * DAY, 1);
        battle = (await store.readBattle('123', saved.battleId))!; current = await game.read('123', at + 2 * DAY);
        await assert.rejects(service.execute('123', 'fatal_withdraw1', { operation: 'withdraw_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, confirm: true }, at + 2 * DAY), /WITHDRAWAL_UNAVAILABLE/);
        const healthy = await new HealthyStore(db).read('123'), input = { operation: 'rescue_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, healthyVersion: healthy.version, kind: 'rank', acceptCost: true };
        const fault: Database = { prepare: sql => db.prepare(sql), batch: statements => db.batch([
            ...statements.slice(0, -2), db.prepare('INSERT INTO transaction_guard(valid) VALUES(0)'), ...statements.slice(-2),
        ]) };
        await assert.rejects(new BattleService(new D1BattleStore(fault)).execute('123', 'rank_rollback01', input, at + 2 * DAY));
        assert.deepEqual(await new HealthyStore(db).read('123'), healthy);
        assert.equal((await store.readBattle('123', saved.battleId))!.status, 'awaiting_rescue');
        assert.equal((await db.prepare('SELECT rank_lock_until_day FROM game_accounts').first<{ rank_lock_until_day: number | null }>())!.rank_lock_until_day, null);
        const results = await Promise.allSettled(['rank_rescue001', 'rank_rescue002'].map(id => service.execute('123', id, input, at + 2 * DAY)));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        const account = await new HealthyStore(db).read('123');
        assert.equal(account.state.rank, 2); assert.equal(account.state.qi, 150); assert.equal(account.state.highestRank, 5);
        assert.equal((await db.prepare('SELECT rank_lock_until_day FROM game_accounts').first<{ rank_lock_until_day: number }>())!.rank_lock_until_day, current.day.day + 3);
        battle = (await store.readBattle('123', saved.battleId))!; current = await game.read('123', at + 2 * DAY);
        await service.execute('123', 'second_fatal001', { operation: 'choose_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'vo-ky', acceptCost: false }, at + 2 * DAY);
        await game.settle('123', at + 3 * DAY, 1); await game.settle('123', at + 3 * DAY, 1);
        assert.equal((await store.readBattle('123', saved.battleId))!.run.deathPaid, true);
        assert.equal((await new HealthyStore(db).read('123')).state.qi, 138);
        assert.equal((await new HealthyStore(db).read('123')).state.rank, 2);
    } finally { await mf.dispose(); }
});

test('Vo Mon exchange preserves combat state, respects today’s choice, and an expired rescue commits its death charge exactly once', async () => {
    const { mf, db, game, store, service } = await database();
    try {
        const first = await game.read('123', at), versions = [];
        // Ready versions are an explicit tactical fixture; no entitlement or
        // training traversal is asserted by this temporal transaction case.
        for (const techniqueId of ['vo-mon', 'kiem-y', 'kim-than']) {
            const practice = newPracticeVersion('fixture_' + techniqueId, techniqueId, first.day.day);
            practice.tiers = [{ tier: 1, purityBp: 10000, effortMilli: 3000, defectsMilli: 0, startedDay: first.day.day, lockedDay: first.day.day }];
            versions.push(practice.id);
            await db.prepare('INSERT INTO practice_versions(owner,id,technique_id,state_json,created_day,created,updated) VALUES(?,?,?,?,?,?,?)')
                .bind('123', practice.id, techniqueId, JSON.stringify(practice), first.day.day, at, at).run();
        }
        const saved = await service.execute('123', 'exchange_battle1', { operation: 'prepare_battle', day: first.day.day, version: 0, bossId: 'truy-lenh', versions: versions.slice(0, 2) }, at);
        await game.settle('123', at + DAY, 1);
        let current = await game.read('123', at + DAY), battle = (await store.readBattle('123', saved.battleId))!;
        await service.execute('123', 'exchange_cast01', { operation: 'choose_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'vo-mon', acceptCost: false }, at + DAY);
        await game.settle('123', at + 2 * DAY, 1);
        current = await game.read('123', at + 2 * DAY); battle = (await store.readBattle('123', saved.battleId))!;
        await service.execute('123', 'exchange_chosen', { operation: 'choose_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'vo-mon', acceptCost: false }, at + 2 * DAY);
        current = await game.read('123', at + 2 * DAY); battle = (await store.readBattle('123', saved.battleId))!;
        await assert.rejects(service.execute('123', 'exchange_denied', { operation: 'exchange_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, removeId: 'kiem-y', practiceId: versions[2] }, at + 2 * DAY), /BATTLE_EXCHANGE_UNAVAILABLE/);
        assert.equal((await store.readBattle('123', saved.battleId))!.version, battle.version);
        await game.settle('123', at + 3 * DAY, 1);
        current = await game.read('123', at + 3 * DAY); battle = (await store.readBattle('123', saved.battleId))!;
        const before = structuredClone(battle.run.state);
        const input = { operation: 'exchange_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, removeId: 'kiem-y', practiceId: versions[2] };
        const exchanged = await service.execute('123', 'exchange_saved1', input, at + 3 * DAY);
        assert.deepEqual(await service.execute('123', 'exchange_saved1', input, at + 4 * DAY), exchanged);
        battle = (await store.readBattle('123', saved.battleId))!;
        assert.deepEqual(battle.run.state.player, before.player); assert.deepEqual(battle.run.state.statuses, before.statuses);
        assert.deepEqual(battle.run.state.loadout.map(skill => skill.id), ['vo-mon', 'kim-than']);
        assert.equal(battle.run.state.exchangeAfterTurn, null); assert.equal(battle.run.state.turn, before.turn);
        // Replace the remaining encounter with a declared fatal fixture; use a
        // real chosen-day closure and the production rescue deadline afterwards.
        battle.run.state.intents[2]!.hits = [999];
        await db.prepare('UPDATE battles SET state_json=? WHERE owner=? AND id=?').bind(JSON.stringify({ run: battle.run, resumePracticeId: null }), '123', saved.battleId).run();
        await db.prepare('INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)').bind('123', JSON.stringify({ ...initialHealthy(), qi: 100 }), at).run();
        current = await game.read('123', at + 3 * DAY);
        await service.execute('123', 'timeout_fatal01', { operation: 'choose_battle', day: current.day.day, version: current.version,
            battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'vo-ky', acceptCost: false }, at + 3 * DAY);
        await game.settle('123', at + 4 * DAY, 1);
        assert.equal((await store.readBattle('123', saved.battleId))!.status, 'awaiting_rescue');
        await game.settle('123', at + 5 * DAY, 1); assert.equal((await new HealthyStore(db).read('123')).state.qi, 100);
        await game.settle('123', at + 6 * DAY, 1); await game.settle('123', at + 6 * DAY, 7);
        battle = (await store.readBattle('123', saved.battleId))!;
        assert.equal(battle.status, 'dead'); assert.equal(battle.run.deathPaid, true);
        assert.equal((await new HealthyStore(db).read('123')).state.qi, 92);
    } finally { await mf.dispose(); }
});

test('inheritance requires four genuinely trained first tiers; its committed victory grants the right to practice, never a finished version', async () => {
    const { mf, db, game, store, service } = await database();
    try {
        const habits = new D1HabitStore(db), logging = new HabitService(habits), practice = new PracticeService(game);
        const first = await game.read('123', at), day = first.day.day;
        // Fixture grants the preceding main victory and rank only. All four
        // prerequisite versions below are earned through real habit settlement.
        const boss = bossById('thiet-lenh-su'), state = newBattleState(fighterForRank(2), boss.fighter, [], bossIntents(boss), boss.maxTurns);
        state.boss.hp = 0; state.status = 'won'; state.turn = 1;
        const run = { id: 'fixture_mainwin', bossId: boss.id, contentVersion: 'than-lo-1', combatRank: 2, state,
            startsDay: day - 7, lastDay: day - 1, waitDays: 0, rescueUntilDay: null, deathPaid: false };
        await db.batch([
            db.prepare('INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES(?,?,?,?,?,?,?,?,?)')
                .bind('123', run.id, boss.id, 'won', run.startsDay, JSON.stringify({ run, resumePracticeId: null }), JSON.stringify(boss), at - DAY, at - DAY),
            db.prepare('INSERT INTO boss_victories(owner,boss_id,battle_id,created) VALUES(?,?,?,?)').bind('123', boss.id, run.id, at - DAY),
            db.prepare("INSERT INTO technique_unlocks(owner,technique_id,source,created) SELECT '123',value,'fixture-opening',? FROM json_each(?)")
                .bind(at, JSON.stringify(['lien-van', 'tuyet-menh', 'vo-hoi'])),
            db.prepare('INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)').bind('123', JSON.stringify({ ...initialHealthy(), rank: 2 }), at),
        ]);
        await assert.rejects(service.execute('123', 'inherit_early01', { operation: 'prepare_battle', day, version: 0, bossId: 'kiem-truyen', versions: [] }, at), /BOSS_LOCKED/);
        const habit = await logging.execute('123', 'inherit_habit01', { operation: 'create', definition: { name: 'Thiền', metric: 'check', target: 1, cadence: { kind: 'daily' } } }, at);
        let offset = 0;
        const ids: string[] = [];
        for (const techniqueId of ['kiem-y', 'lien-van', 'tuyet-menh', 'vo-hoi']) {
            const current = await game.read('123', at + offset * DAY);
            const saved = await practice.execute('123', 'inherit_start_' + offset, { operation: 'start_practice', day: current.day.day, version: current.version, techniqueId }, at + offset * DAY);
            assert.ok(saved.practiceId);
            ids.push(saved.practiceId);
            for (let count = 0; count < 3; count++) {
                offset++;
                await habits.settle('123', at + offset * DAY, 10); await game.settle('123', at + offset * DAY, 7);
                await logging.execute('123', 'inherit_log_' + offset, { operation: 'log', habitId: habit.habitId, day: day + offset, version: 1, logVersion: 0, value: 1 }, at + offset * DAY);
            }
            offset++;
            await habits.settle('123', at + offset * DAY, 10); await game.settle('123', at + offset * DAY, 7);
            assert.equal((await game.versions('123', techniqueId, null, 1)).versions[0]!.practice.tiers.length, 1);
        }
        let current = await game.read('123', at + offset * DAY);
        const inherited = await service.execute('123', 'inherit_prepare', { operation: 'prepare_battle', day: current.day.day, version: current.version, bossId: 'kiem-truyen', versions: ids }, at + offset * DAY);
        let battle = (await store.readBattle('123', inherited.battleId))!;
        const solution = searchBattle(battle.run.state, 300); assert.ok(solution, 'Four first-tier techniques and one habit can complete the inheritance');
        assert.equal(current.owned.includes('kiem-vuc'), false);
        for (const techniqueId of solution.sequence) {
            offset++;
            await habits.settle('123', at + offset * DAY, 10); await game.settle('123', at + offset * DAY, 7);
            current = await game.read('123', at + offset * DAY); battle = (await store.readBattle('123', inherited.battleId))!;
            await logging.execute('123', 'inherit_fightlog_' + offset, { operation: 'log', habitId: habit.habitId, day: current.day.day, version: 1, logVersion: 0, value: 1 }, at + offset * DAY);
            await service.execute('123', 'inherit_choose_' + offset, { operation: 'choose_battle', day: current.day.day, version: current.version, battleId: battle.run.id,
                battleVersion: battle.version, techniqueId, acceptCost: true }, at + offset * DAY);
        }
        offset++;
        await habits.settle('123', at + offset * DAY, 10); await game.settle('123', at + offset * DAY, 7);
        assert.equal((await store.readBattle('123', inherited.battleId))!.status, 'won');
        current = await game.read('123', at + offset * DAY); assert.ok(current.owned.includes('kiem-vuc'));
        assert.equal((await game.versions('123', 'kiem-vuc', null, 10)).versions.length, 0);
        await practice.execute('123', 'inherit_learn01', { operation: 'start_practice', day: current.day.day, version: current.version, techniqueId: 'kiem-vuc' }, at + offset * DAY);
        assert.equal((await game.versions('123', 'kiem-vuc', null, 10)).versions[0]!.practice.tiers.length, 0);
    } finally { await mf.dispose(); }
});

test('battle HTTP conceals future patterns, rejects forged results and stale days, and enforces the independent breakthrough cooldown', async () => {
    const { mf, db, game, store } = await database();
    try {
        const env = { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32) } as Env;
        const request = async (path: string, input: Record<string, unknown> | null, now = at, origin = 'https://local', authenticated = true) => {
            const params = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: 123 }) });
            const raw = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n');
            params.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update('test').digest()).update(raw).digest('hex'));
            return miniAppApi(new Request('https://local/api/' + path, { method: input ? 'POST' : 'GET', headers: { Origin: origin,
                ...(authenticated ? { 'X-Telegram-Init-Data': params.toString() } : {}) }, ...(input ? { body: JSON.stringify(input) } : {}) }), env, now);
        };
        const current = await game.read('123', at), input = { id: 'http_prepare01', operation: 'prepare_battle', day: current.day.day, version: 0, bossId: 'truy-lenh', versions: [] };
        assert.equal((await request('game', input, at, 'https://other')).status, 403);
        assert.equal((await request('game', input, at, 'https://local', false)).status, 401);
        for (const forged of [{ owner: '456' }, { now: at + DAY }, { damage: 999 }, { reward: ['kiem-vuc'] }, { contribution: { habits: 600 } }])
            assert.equal((await request('game', { ...input, ...forged })).status, 400);
        const prepared = await request('game', input); assert.equal(prepared.status, 200);
        const saved = await prepared.json() as { battleId: string };
        const overview = await (await request('game', null, at + DAY)).json() as { version: number; battles: { content: Record<string, unknown>; state: Record<string, unknown> }[] };
        assert.equal('pattern' in overview.battles[0]!.content, false); assert.equal('intents' in overview.battles[0]!.state, false);
        const battle = (await store.readBattle('123', saved.battleId))!;
        const stale = await request('game', { id: 'http_old_day01', operation: 'choose_battle', day: current.day.day, version: overview.version,
            battleId: saved.battleId, battleVersion: battle.version, techniqueId: 'vo-ky', acceptCost: false }, at + DAY);
        assert.equal(stale.status, 409); assert.equal((await stale.json() as { error: string }).error, 'GAME_DAY_CLOSED');
        assert.equal((await request('battle-history?battleId=' + saved.battleId + '&before=NaN', null)).status, 400);
        await db.prepare('UPDATE game_accounts SET rank_lock_until_day=? WHERE owner=?').bind(current.day.day + 3, '123').run();
        const blocked = await request('cultivation', { id: 'http_breaklock1', operation: 'breakthrough' });
        assert.equal(blocked.status, 409); assert.equal((await blocked.json() as { error: string }).error, 'BREAKTHROUGH_COMBAT_COOLDOWN');
        assert.equal((await new HealthyStore(db).read('123')).version, 0, 'Denied breakthrough never mutates its account');
    } finally { await mf.dispose(); }
});
