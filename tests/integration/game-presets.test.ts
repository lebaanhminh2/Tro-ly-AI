import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import type { Env } from '../../src/config/env.ts';
import { D1GamePresetStore } from '../../src/adapters/d1/game-preset-store.ts';
import { D1BattleStore } from '../../src/adapters/d1/battle-store.ts';
import { GamePresetService } from '../../src/application/game-preset-service.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { bossById, bossIntents } from '../../src/domain/game-content.ts';
import { newBattleState } from '../../src/domain/battle.ts';
import { fighterForRank } from '../../src/domain/battle-economy.ts';

const now = Date.parse('2026-10-12T08:00:00+07:00');
async function fixture() {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    try {
    for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    for (const [owner, id, technique, edition, tiers] of [
        ['123', 'preset_old_001', 'kiem-y', 1, 1], ['123', 'preset_new_001', 'kiem-y', 2, 2],
        ['123', 'preset_draft01', 'kim-than', 1, 0], ['456', 'foreign_ready1', 'kim-than', 1, 1],
    ] as const) {
        const practice = newPracticeVersion(id, technique, 20738, 1000, edition);
        practice.tiers = Array.from({ length: tiers }, (_, index) => ({ tier: index + 1, purityBp: 7500,
            effortMilli: 3000, defectsMilli: 0, startedDay: 20738, lockedDay: 20738 }));
        await db.prepare('INSERT INTO practice_versions(owner,id,technique_id,state_json,created_day,created,updated) VALUES(?,?,?,?,?,?,?)')
            .bind(owner, id, technique, JSON.stringify(practice), 20738, now, now).run();
    }
    const content = bossById('truy-lenh'), state = newBattleState(fighterForRank(0), content.fighter, [], bossIntents(content), content.maxTurns);
    state.status = 'won'; state.boss.hp = 0;
    const run = { id: 'fixture_battle', bossId: content.id, contentVersion: 'than-lo-2', combatRank: 0, state,
        startsDay: 20738, lastDay: null, waitDays: 0, rescueUntilDay: null, deathPaid: false };
    await db.prepare("INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES('123','fixture_battle',?,'won',20738,?,?,?,?)")
        .bind(content.id, JSON.stringify({ run, resumePracticeId: null }), JSON.stringify(content), now, now).run();
    await db.prepare("INSERT INTO game_entitlements(owner,kind,id,battle_id,created) VALUES('123','weapon','thach-tam','fixture_battle',?)").bind(now).run();
    const store = new D1GamePresetStore(db);
    return { mf, db, store, service: new GamePresetService(store) };
    } catch (error) { await mf.dispose(); throw error; }
}
const save = (version = 0) => ({ operation: 'save', version, name: 'Công thủ cân bằng', versions: ['preset_old_001'], weaponId: 'thach-tam' });

test('presets preserve a chosen old edition across devices without mutating combat, cultivation or training', async () => {
    const { mf, db, store, service } = await fixture();
    try {
        const input = save(), battleBefore = await db.prepare('SELECT state_json FROM battles').first();
        const created = await service.execute('123', 'preset_save001', input, now);
        assert.equal(created.version, 1);
        assert.deepEqual(await new D1GamePresetStore(db).read('123'), { version: 1, presets: [{ id: created.presetId,
            name: input.name, versions: input.versions, weaponId: input.weaponId }] });
        const resolver = new D1BattleStore(db);
        assert.equal((await resolver.availableLoadout('123'))[0]!.versionId, 'preset_new_001');
        assert.equal((await resolver.resolveLoadout('123', input.versions))[0]!.versionId, 'preset_old_001');
        assert.deepEqual(await resolver.resolveLoadout('456', input.versions), []);
        assert.deepEqual(await store.read('456'), { version: 0, presets: [] });
        await assert.rejects(service.execute('456', 'preset_other01', { ...save(), presetId: created.presetId }, now), /GAME_PRESET_NOT_FOUND/);
        assert.deepEqual(await db.prepare('SELECT state_json FROM battles').first(), battleBefore);
        for (const table of ['game_accounts', 'cultivation_accounts', 'game_days'])
            assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM ' + table).first<{ count: number }>())!.count, 0);
        assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM practice_versions').first<{ count: number }>())!.count, 4);
    } finally { await mf.dispose(); }
});

test('preset replay, concurrent writes and failed final batch are atomic', async () => {
    const { mf, db, store, service } = await fixture();
    try {
        const input = save();
        const same = await Promise.all([service.execute('123', 'preset_replay01', input, now), service.execute('123', 'preset_replay01', input, now)]);
        assert.deepEqual(same[0], same[1]); assert.equal((await store.read('123')).presets.length, 1);
        assert.deepEqual(await service.execute('123', 'preset_replay01', input, now + 86400000), same[0]);
        await assert.rejects(service.execute('123', 'preset_replay01', { ...input, name: 'Khác' }, now), /REQUEST_ID_REUSED/);
        const concurrent = await Promise.allSettled(['preset_race01', 'preset_race02'].map(id => service.execute('123', id, save(1), now)));
        assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((await store.read('123')).version, 2); assert.equal((await store.read('123')).presets.length, 2);
        const fault: Database = { prepare: sql => db.prepare(sql), batch: statements => db.batch([...statements,
            db.prepare('INSERT INTO transaction_guard(valid) VALUES(0)')]) };
        await assert.rejects(new GamePresetService(new D1GamePresetStore(fault)).execute('123', 'preset_fault01', save(2), now));
        assert.equal((await store.read('123')).version, 2); assert.equal((await store.read('123')).presets.length, 2);
        assert.equal(await db.prepare("SELECT request_id FROM game_preset_receipts WHERE request_id='preset_fault01'").first(), null);
        assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM transaction_guard').first<{ count: number }>())!.count, 0);
        assert.equal((await service.execute('123', 'preset_fault01', save(2), now)).version, 3);
    } finally { await mf.dispose(); }
});

test('presets reject forged, duplicate and unfinished editions and enforce six sets while allowing updates and deletions', async () => {
    const { mf, store, service } = await fixture();
    try {
        for (const versions of [['foreign_ready1'], ['preset_draft01'], ['preset_old_001', 'preset_new_001']])
            await assert.rejects(service.execute('123', 'preset_invalid1', { ...save(), versions }, now), /INVALID_BATTLE_LOADOUT/);
        await assert.rejects(service.execute('456', 'preset_weapon01', { ...save(), versions: [] }, now), /GAME_WEAPON_LOCKED/);
        assert.throws(() => service.execute('123', 'preset_name001', { ...save(), name: 'Tên\nkhác' }, now), /INVALID_GAME_PRESET/);
        assert.throws(() => service.execute('123', 'preset_owner01', { ...save(), owner: '456' }, now), /INVALID_GAME_PRESET/);
        for (let index = 0; index < 6; index++) await service.execute('123', 'preset_limit0' + index, save(index), now);
        await assert.rejects(service.execute('123', 'preset_limit07', save(6), now), /GAME_PRESET_LIMIT/);
        const presetId = (await store.read('123')).presets[0]!.id;
        await service.execute('123', 'preset_update01', { ...save(6), presetId, name: 'Bộ mới', versions: [], weaponId: null }, now);
        assert.equal((await store.read('123')).presets.length, 6);
        assert.deepEqual((await store.read('123')).presets[0], { id: presetId, name: 'Bộ mới', versions: [], weaponId: null });
        const deletion = { operation: 'delete', version: 7, presetId };
        const removed = await service.execute('123', 'preset_delete01', deletion, now);
        assert.deepEqual(await service.execute('123', 'preset_delete01', deletion, now + 1), removed);
        assert.equal((await store.read('123')).presets.length, 5);
    } finally { await mf.dispose(); }
});

test('preset HTTP routes retain authentication, origin, bounded input and owner-scoped resolution', async () => {
    const { mf, db } = await fixture();
    try {
        const token = 'fixture-token', env = { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: 'fixture-secret' } as Env;
        const params = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: 123 }) });
        const secret = createHmac('sha256', 'WebAppData').update(token).digest();
        params.set('hash', createHmac('sha256', secret).update([...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n')).digest('hex'));
        const headers = { 'X-Telegram-Init-Data': params.toString(), Origin: 'https://app.test', 'Content-Type': 'application/json' };
        const request = (path: string, input?: unknown, overrides = {}) => new Request('https://app.test/api/' + path,
            { method: input ? 'POST' : 'GET', headers: { ...headers, ...overrides }, ...(input ? { body: JSON.stringify(input) } : {}) });
        assert.equal((await miniAppApi(new Request('https://app.test/api/game-presets'), env, now)).status, 401);
        assert.equal((await miniAppApi(request('game-presets', { id: 'preset_http01', ...save() }, { Origin: 'https://elsewhere.test' }), env, now)).status, 403);
        const saved = await miniAppApi(request('game-presets', { id: 'preset_http01', ...save() }), env, now);
        assert.equal(saved.status, 200);
        const read = await miniAppApi(request('game-presets'), env, now);
        assert.equal(read.status, 200); assert.equal((await read.json() as { presets: unknown[] }).presets.length, 1);
        const resolved = await miniAppApi(request('battle-loadout?versionId=preset_new_001&versionId=foreign_ready1'), env, now);
        assert.deepEqual((await resolved.json() as { versions: { versionId: string }[] }).versions.map(value => value.versionId), ['preset_new_001']);
        assert.equal((await miniAppApi(request('battle-loadout?' + Array.from({ length: 6 }, (_, index) => 'versionId=version_00' + index).join('&')), env, now)).status, 400);
        assert.equal((await miniAppApi(request('game-presets', { id: 'preset_http02', ...save(1), owner: '456' }), env, now)).status, 400);
        assert.equal((await miniAppApi(request('game-presets', { id: 'preset_http03', ...save(1), name: 'x'.repeat(5000) }), env, now)).status, 413);
    } finally { await mf.dispose(); }
});
