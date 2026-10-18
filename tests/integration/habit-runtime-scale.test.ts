import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';

test('D1 three-year history remains paginated and a year of backlog advances one bounded day without duplicate sources or healthy rewards', async () => {
    const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB'] });
    try {
        const db = await mf.getD1Database('DB') as unknown as Database & { exec(sql: string): Promise<unknown> };
        for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
            await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
        const now = Date.parse('2026-10-12T08:00:00+07:00'), dayMs = 86400000;
        await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, now);
        const day = (await new D1HabitStore(db).today('123', now)).day;
        const firstDay = day.day - 1095, oldest = day.day - 365;
        const ids = Array.from({ length: 30 }, (_, index) => 'scale_history_' + String(index).padStart(2, '0'));
        const definition = JSON.stringify({ name: 'Synthetic history', metric: 'duration', target: 2000, unit: 'phút', note: '', cadence: { kind: 'daily' }, commitmentFrom: firstDay });
        await db.batch([
            db.prepare('INSERT INTO habits(owner,id,created_day,next_day,created,updated) SELECT ?,value,?,?,?,? FROM json_each(?)').bind('123', firstDay, oldest, now - 1095 * dayMs, now, JSON.stringify(ids)),
            db.prepare('INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) SELECT ?,value,?,? FROM json_each(?)').bind('123', firstDay, definition, JSON.stringify(ids)),
            db.prepare('WITH RECURSIVE dates(d) AS (SELECT ? UNION ALL SELECT d+1 FROM dates WHERE d<?) INSERT OR IGNORE INTO habit_days(owner,day,start_at,end_at) SELECT ?,d,?+(d-?)*?,?+(d-?+1)*? FROM dates')
                .bind(firstDay, day.day, '123', day.startAt, day.day, dayMs, day.startAt, day.day, dayMs),
            db.prepare("INSERT INTO habit_logs(owner,habit_id,day,value,note,updated) SELECT d.owner,h.id,d.day,2000,'Synthetic history',? FROM habit_days d JOIN habits h ON h.owner=d.owner WHERE d.owner=?")
                .bind(now, '123'),
            db.prepare("INSERT INTO habit_outcomes(owner,habit_id,day,revision_day,status,reason,value,successes,misses,game_applied,settled_at) SELECT d.owner,h.id,d.day,?,'achieved','target_met',2000,1,0,1,? FROM habit_days d JOIN habits h ON h.owner=d.owner WHERE d.owner=? AND d.day<?")
                .bind(firstDay, now, '123', oldest),
        ]);
        const healthyBefore = (await db.prepare('SELECT * FROM cultivation_accounts ORDER BY owner').all()).results;
        let queries = 0;
        const measured: Database = { prepare: sql => { queries++; return db.prepare(sql); }, batch: statements => db.batch(statements) };
        const store = new D1HabitStore(measured);
        queries = 0;
        const today = await store.today('123', now); assert.equal(today.habits.length, 30); assert.ok(queries <= 25);
        queries = 0;
        const page = await store.history('123', day.day - 365, day.day, null, null, 50);
        const next = await store.history('123', day.day - 365, day.day, null, page.next, 50);
        assert.equal(page.rows.length, 50); assert.equal(next.rows.length, 50); assert.equal(queries, 2);
        assert.equal(new Set([...page.rows, ...next.rows].map(row => row.day + ':' + row.habitId)).size, 100);
        const report = await store.report('123', day.day - 365, day.day, null); assert.equal(report.totals.length, 30);
        queries = 0;
        assert.equal((await store.settleBatch('123', now, 30)).processed, 30); assert.ok(queries <= 20);
        assert.equal((await db.prepare('SELECT MIN(next_day) AS day FROM habits').first<{ day: number }>())!.day, oldest + 1);
        queries = 0;
        queries = 0;
        assert.equal((await store.settleBatch('123', now, 30)).processed, 30); assert.ok(queries <= 20);
        assert.equal((await db.prepare('SELECT MIN(next_day) AS day FROM habits').first<{ day: number }>())!.day, oldest + 2);
        assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM habit_outcomes WHERE owner=? AND day>=? AND day<?').bind('123', oldest, oldest + 2).first<{ n: number }>())!.n, 60);
        assert.deepEqual((await db.prepare('SELECT * FROM cultivation_accounts ORDER BY owner').all()).results, healthyBefore);
    } finally { await mf.dispose(); }
});
