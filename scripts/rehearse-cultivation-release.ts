import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Miniflare } from 'miniflare';
import type { Database } from '../src/adapters/d1/database.ts';
import { ScheduleStore } from '../src/adapters/d1/schedule-store.ts';
import { D1GameStore } from '../src/adapters/d1/game-store.ts';
import { D1BattleStore } from '../src/adapters/d1/battle-store.ts';
import { sqliteDatabase } from './benchmark-habit-runtime.ts';
import { tableProofs } from './rehearse-staging-upgrade.ts';
import { bossById, bossIntents, SUPPORTED_CONTENT_VERSIONS } from '../src/domain/game-content.ts';
import { battleChoiceDetail, CURRENT_BATTLE_RULE, newBattleState } from '../src/domain/battle.ts';
import { fighterForRank } from '../src/domain/battle-economy.ts';
import { newPracticeVersion, settlePracticeDay } from '../src/domain/practice.ts';
import { newTimePracticeVersion } from '../src/domain/practice-progression.ts';
import { practiceStrength } from '../src/domain/technique-profile.ts';

// Offline recovery candidate proof. Never call scheduled, Telegram, cloud D1
// or a real session. Synthetic snapshots are confined to ephemeral Miniflare.
const arg = (name: string) => { const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]; };
const bundle = arg('--bundle'), restored = arg('--restored'), report = arg('--report');
if (!bundle || !restored || !report) throw Error('USE_--bundle_--restored_--report');
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const fixtureOwner = '777777', token = '777777:offline_recovery_fixture', now = Date.now(), dayMs = 86400000;
const localCompatibilityDate = '2026-08-06'; // Installed workerd maximum; cloud config stays 2026-09-11.
const mf = new Miniflare({ modules: true, scriptPath: resolve(bundle), compatibilityDate: localCompatibilityDate,
    d1Databases: ['DB'], bindings: { TELEGRAM_USER_ID: fixtureOwner, TELEGRAM_BOT_TOKEN: token,
        TELEGRAM_WEBHOOK_SECRET: 'r'.repeat(32), AI_MODE: 'off' },
    serviceBindings: { ASSETS: () => new Response('Offline fixture only') } });
try {
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    await new ScheduleStore(db).configure(fixtureOwner, '05:30', '23:15', 0, now);
    const overview = await new D1GameStore(db).read(fixtureOwner, now), day = overview.day.day;
    const legacy = newPracticeVersion('recovery_legacy', 'kiem-y', day - 40);
    legacy.tiers.push({ tier: 1, purityBp: 7000, effortMilli: 3000, defectsMilli: 1000, startedDay: day - 40, lockedDay: day - 38 });
    let current = newTimePracticeVersion('recovery_current', 'kiem-y', day - 40, 1000, 2);
    for (let offset = 0; offset < 21; offset++) current = settlePracticeDay(day - 40 + offset, current.id, [current], [],
        [{ habitId: 'recovery_daily', successes: 1, misses: 0, mature: true, weekly: null }]).versions[0]!;
    assert.equal(current.tiers.length, 4);
    for (const version of [legacy, current]) await db.prepare('INSERT INTO practice_versions(owner,id,technique_id,created_day,state_json,created,updated) VALUES(?,?,?,?,?,?,?)')
        .bind(fixtureOwner, version.id, version.techniqueId, version.createdDay, JSON.stringify(version), now, now).run();
    const params = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: Number(fixtureOwner) }) });
    params.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
        .update([...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + '=' + v).join('\n')).digest('hex'));
    const headers = { 'X-Telegram-Init-Data': params.toString(), 'X-Minh-Anh-Request': '1' };
    const snapshots = [];
    for (const contentVersion of SUPPORTED_CONTENT_VERSIONS) {
        const modern = contentVersion === 'than-lo-5', edition = modern ? current : legacy;
        const content = structuredClone(bossById('truy-lenh')), fighter = { hp: 10000, maxHp: 10000, attack: 50, armor: 10 };
        const skill = { id: 'kiem-y', versionId: edition.id, tier: edition.tiers.length,
            purityBp: edition.tiers.at(-1)!.purityBp, ...(modern ? { strength: practiceStrength(edition)! } : {}) };
        const state = newBattleState(fighterForRank(2), fighter, [skill], bossIntents(content), content.maxTurns,
            undefined, modern ? CURRENT_BATTLE_RULE : undefined);
        const id = 'recovery_' + contentVersion.replaceAll('-', '_');
        const run = { id, bossId: content.id, contentVersion, combatRank: 2, weaponId: null, state,
            startsDay: day, lastDay: null, waitDays: 0, rescueUntilDay: null, deathPaid: false };
        await db.prepare('INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES(?,?,?,?,?,?,?,?,?)')
            .bind(fixtureOwner, id, content.id, 'active', day, JSON.stringify({ run, resumePracticeId: null }), JSON.stringify(content), now, now).run();
        const before = await db.prepare('SELECT state_json,version FROM battles WHERE owner=? AND id=?').bind(fixtureOwner, id).first();
        const response = await mf.dispatchFetch('https://offline.example/api/battle-choice?battleId=' + id + '&techniqueId=kiem-y', { headers });
        assert.equal(response.status, 200, contentVersion);
        const output = await response.json() as ReturnType<typeof battleChoiceDetail>;
        const expected = JSON.parse(JSON.stringify(battleChoiceDetail(state, 'kiem-y')));
        assert.deepEqual(output.profile, expected.profile); assert.deepEqual(output.preview, expected.preview);
        assert.deepEqual(await db.prepare('SELECT state_json,version FROM battles WHERE owner=? AND id=?').bind(fixtureOwner, id).first(), before);
        snapshots.push({ contentVersion, battleRule: state.rule ?? 'battle-v1', editionRule: edition.rule ?? 'practice-v1', status: response.status, unchanged: true });
        // Preserve the production one-active-battle constraint between isolated cases.
        await db.prepare('DELETE FROM battles WHERE owner=? AND id=?').bind(fixtureOwner, id).run();
    }
    const editions = [];
    for (const version of [legacy, current]) {
        const response = await mf.dispatchFetch('https://offline.example/api/game-technique?techniqueId=kiem-y&versionId=' + version.id, { headers });
        assert.equal(response.status, 200);
        const output = await response.json() as { selected: { practice: { rule?: string } }; upgrade: unknown };
        assert.equal(output.selected.practice.rule ?? 'practice-v1', version.rule ?? 'practice-v1'); assert.ok(output.upgrade);
        editions.push({ rule: version.rule ?? 'practice-v1', status: response.status });
    }
    const unauthenticated = await mf.dispatchFetch('https://offline.example/api/game-technique?techniqueId=kiem-y');
    assert.equal(unauthenticated.status, 401);
    const copy = new DatabaseSync(resolve(restored), { readOnly: true });
    let restoredProof;
    try {
        assert.equal(copy.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
        assert.equal(copy.prepare('PRAGMA foreign_key_check').all().length, 0);
        const before = tableProofs(copy), adapter = sqliteDatabase(copy);
        const owners = copy.prepare('SELECT owner FROM game_accounts ORDER BY owner').all() as { owner: string }[];
        for (const { owner } of owners) {
            const game = await new D1GameStore(adapter).read(owner, now);
            await new D1BattleStore(adapter).overview(owner, game.day);
            await new D1BattleStore(adapter).list(owner, null, 20);
        }
        assert.deepEqual(tableProofs(copy), before);
        restoredProof = { integrity: 'ok', foreignKeyViolations: 0, ownersRead: owners.length,
            unchanged: true, tables: before.length, rowsHash: sha(JSON.stringify(before)) };
    } finally { copy.close(); }
    const proof = { generatedAt: new Date().toISOString(), localCompatibilityDate, cloudCompatibilityDate: '2026-09-11', bundleSha256: sha(readFileSync(bundle)),
        snapshots, editions, unauthenticatedStatus: unauthenticated.status, restored: restoredProof,
        limitation: 'Offline bundle GETs and read-only restored DB; no cron, external messages, paid APIs or cloud writes. Recovery must use this compatible bundle/source, not a pre-v2 binary or overwrite backup.' };
    writeFileSync(report, JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify(proof));
} finally { await mf.dispose(); }
