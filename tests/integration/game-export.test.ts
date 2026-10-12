import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import type { Env } from '../../src/config/env.ts';
import { D1GameExportStore } from '../../src/adapters/d1/game-export-store.ts';
import { GameExportService } from '../../src/application/game-export-service.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';
import { newBattleState } from '../../src/domain/battle.ts';
import { fighterForRank } from '../../src/domain/battle-economy.ts';
import { bossById, bossIntents } from '../../src/domain/game-content.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';

const now = Date.parse('2026-10-12T08:00:00+07:00'), day = 20738;
async function fixture() {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
    try {
        for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
            await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
        for (const owner of ['123', '456']) {
            const practice = newPracticeVersion('export_version_' + owner, 'kiem-y', day, 1000, 1);
            await db.prepare('INSERT INTO practice_versions(owner,id,technique_id,state_json,created_day,created,updated) VALUES(?,?,?,?,?,?,?)')
                .bind(owner, practice.id, practice.techniqueId, JSON.stringify(practice), day, now, now).run();
        }
        const content = { ...bossById('truy-lenh'), victory: 'SECRET-UNREVEALED-ENDING' };
        const state = newBattleState(fighterForRank(0), content.fighter, [], bossIntents(content), content.maxTurns);
        state.intents[1]!.name = 'SECRET-FUTURE-PATTERN';
        const run = { id: 'export_battle01', bossId: content.id, contentVersion: 'than-lo-2', combatRank: 0, state,
            startsDay: day - 10, lastDay: day, waitDays: 0, rescueUntilDay: null, deathPaid: false };
        await db.prepare("INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES('123',?,'truy-lenh','active',?,?,?,?,?)")
            .bind(run.id, run.startsDay, JSON.stringify({ run, resumePracticeId: null }), JSON.stringify(content), now, now).run();
        await db.prepare("INSERT INTO battle_events(owner,battle_id,sequence,day,kind,entries_json,result_json,created) VALUES('123',?,1,?,'day','[\"Đòn đã ghi\"]','{\"status\":\"active\"}',?)")
            .bind(run.id, day, now).run();
        const service = new GameExportService(new D1GameExportStore(db)); return { mf, db, service };
    } catch (error) { await mf.dispose(); throw error; }
}

test('export reads a saved owner snapshot without starting or settling a day and hides unrevealed battle content', async () => {
    const { mf, db, service } = await fixture();
    try {
        const before = await db.prepare('SELECT state_json,version FROM battles').first();
        const result = await service.read('123', day - 1, day, now);
        assert.equal(result.format, 'assistant-than-lo'); assert.equal(result.version, 1);
        assert.equal(result.profile.account, null); assert.equal(result.days.length, 0);
        assert.deepEqual(result.practiceVersions.map(value => value.practice.id), ['export_version_123']);
        assert.equal(result.battles.length, 1, 'Live battles begun before the range remain part of the saved profile');
        assert.equal(result.battles[0]!.state.announced.length, 1); assert.equal(result.battles[0]!.victory, null);
        assert.deepEqual(result.events[0]!.entries, ['Đòn đã ghi']);
        const raw = JSON.stringify(result);
        for (const hidden of ['SECRET-FUTURE-PATTERN', 'SECRET-UNREVEALED-ENDING', 'content_json', 'export_version_456']) assert.equal(raw.includes(hidden), false, hidden);
        assert.deepEqual(await db.prepare('SELECT state_json,version FROM battles').first(), before);
        for (const table of ['schedule_days', 'game_accounts', 'game_receipts', 'outbox'])
            assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM ' + table).first<{ count: number }>())!.count, 0);
        const foreign = await service.read('456', day - 1, day, now);
        assert.equal(foreign.battles.length, 0); assert.equal(foreign.events.length, 0);
        assert.deepEqual(foreign.practiceVersions.map(value => value.practice.id), ['export_version_456']);
        await assert.rejects(service.read('123', day - 366, day, now), /INVALID_GAME_EXPORT/);
    } finally { await mf.dispose(); }
});

test('export refuses an oversized journal rather than silently truncating it', async () => {
    const { mf, db, service } = await fixture();
    try {
        const entries = JSON.stringify(['a'.repeat(10000)]);
        await db.batch(Array.from({ length: 55 }, (_, index) => db.prepare("INSERT INTO battle_events(owner,battle_id,sequence,day,kind,entries_json,result_json,created) VALUES('123','export_battle01',?,?,'day',?,'{}',?)")
            .bind(index + 2, day, entries, now)));
        await assert.rejects(service.read('123', day - 1, day, now), /GAME_EXPORT_TOO_LARGE/);
        assert.equal((await service.read('123', day - 2, day - 1, now)).events.length, 0);
    } finally { await mf.dispose(); }
});

test('export caps actual UTF-8 bytes after guarded SQL materialization', async () => {
    const { mf, db, service } = await fixture();
    try {
        const json = JSON.stringify({ note: '🌙'.repeat(500000) });
        await db.prepare("INSERT INTO game_days(owner,day,start_at,end_at,mode,rule,result_json,settled_at) VALUES('123',?,0,1,'idle','fixture',?,?)")
            .bind(day, json, now).run();
        const entries = JSON.stringify(['🌙'.repeat(7000)]);
        // Each row stays under the event limit; ten rows add enough bytes to cross 2 MiB.
        await db.batch(Array.from({ length: 10 }, (_, index) => db.prepare("INSERT INTO battle_events(owner,battle_id,sequence,day,kind,entries_json,result_json,created) VALUES('123','export_battle01',?,?,'day',?,'{}',?)")
            .bind(index + 2, day, entries, now)));
        const materialized = await new D1GameExportStore(db).read('123', day, day);
        assert.ok(new TextEncoder().encode(JSON.stringify(materialized)).byteLength > 2 * 1024 * 1024,
            'SQL character guards permit this snapshot; the service must enforce actual response bytes');
        await assert.rejects(service.read('123', day, day, now), /GAME_EXPORT_TOO_LARGE/);
    } finally { await mf.dispose(); }
});

test('export HTTP route retains authentication and origin guards and rejects malformed ranges', async () => {
    const { mf, db } = await fixture();
    try {
        const token = 'fixture-token', env = { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: 'fixture-secret' } as Env;
        const params = new URLSearchParams({ auth_date: String(Math.floor(now / 1000)), user: JSON.stringify({ id: 123 }) });
        const secret = createHmac('sha256', 'WebAppData').update(token).digest();
        params.set('hash', createHmac('sha256', secret).update([...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('\n')).digest('hex'));
        const request = (range: string, origin = 'https://app.test') => new Request('https://app.test/api/game-export' + range,
            { headers: { 'X-Telegram-Init-Data': params.toString(), Origin: origin } });
        assert.equal((await miniAppApi(new Request('https://app.test/api/game-export?from=20738&to=20738'), env, now)).status, 401);
        assert.equal((await miniAppApi(request('?from=20738&to=20738', 'https://elsewhere.test'), env, now)).status, 403);
        for (const range of ['', '?from=&to=20738', '?from=20738&to=bad', '?from=20738&to=20737', '?from=20000&to=20738'])
            assert.equal((await miniAppApi(request(range), env, now)).status, 400, range);
        const response = await miniAppApi(request('?from=20738&to=20738'), env, now);
        assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal((await response.json() as { format: string }).format, 'assistant-than-lo');
    } finally { await mf.dispose(); }
});
