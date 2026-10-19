import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { runScheduled } from '../../src/entrypoints/worker-scheduler.ts';
import type { Env } from '../../src/config/env.ts';

test('active beast cron jobs stay within the query budget and resume after sleep backlog', async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['scripts/benchmark-linh-thu.ts'],
    { timeout: 120000, maxBuffer: 1024 * 1024 },
  );
  const start = stdout.lastIndexOf('{\n  "kind":');
  assert.ok(start >= 0, 'Benchmark must emit its final report');
  const report = JSON.parse(stdout.slice(start)) as {
    metrics: { path: string; queries: number }[];
  };
  assert.equal(
    report.metrics.filter((metric) => metric.path.startsWith('cron-active-beast-job-')).length,
    5,
  );
  assert.ok(
    report.metrics.some((metric) => metric.path.startsWith('cron-active-pending-sleep-resume-')),
  );
  for (const metric of report.metrics) assert.ok(metric.queries <= 50, JSON.stringify(metric));
});

test('bounded sleep maintenance delivers queued replies, scores once and catches up without duplicates', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    for (const file of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort())
      raw.exec(readFileSync('migrations/' + file, 'utf8'));
    raw.exec('PRAGMA foreign_keys=ON');
    let queries = 0;
    const db = sqliteDatabase(raw, () => {
      queries++;
    });
    const schedule = new ScheduleStore(db);
    const now = Date.parse('2026-10-19T10:00:00+07:00');
    const dayMs = 86400000;
    await schedule.configure('123', '05:30', '23:15', 0, now - 2 * dayMs);
    await schedule.ensureDay('123', now - dayMs);
    await schedule.ensureDay('123', now);
    for (const id of ['reply:123:fixture', 'menu:123:fixture', 'task-summary:123:queued'])
      raw
        .prepare('INSERT INTO outbox(id,payload,available) VALUES(?,?,?)')
        .run(id, JSON.stringify({ method: 'sendMessage', chat_id: 123, text: id }), now);
    const assessments = () => raw.prepare('SELECT * FROM sleep_assessments ORDER BY day').all();
    const before = assessments().length;
    const sent: string[] = [];
    const env: Env = {
      DB: db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_BOT_TOKEN: '123:fixture',
      TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      DELIVERY_MODE: 'outbox',
      ASSETS: { fetch: async () => new Response('fixture') },
    };
    const deps = {
      cardsEnabled: false,
      clock: { now: () => now },
      chat: undefined,
      flushCards: async () => {},
      transport: (async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { text: string };
        sent.push(body.text);
        return Response.json({ ok: true, result: { message_id: sent.length } });
      }) as typeof fetch,
    };
    queries = 0;
    await runScheduled(env, deps);
    assert.equal(assessments().length, before + 1, 'One closed sleep day per cron invocation');
    assert.deepEqual(sent, ['reply:123:fixture', 'menu:123:fixture']);
    assert.ok(queries <= 50, `Sleep work plus two queued messages used ${queries} queries`);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM outbox WHERE state='sent'").get()!.n, 2);
    assert.equal(
      raw.prepare("SELECT state FROM outbox WHERE id='task-summary:123:queued'").get()!.state,
      'pending',
      'Proactive delivery waits until inactivity catch-up finishes',
    );
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM daily_plans').get()!.n, 0);
    await runScheduled(env, deps);
    assert.equal(assessments().length, before + 2);
    const settled = assessments();
    assert.equal(await schedule.settleClosedDays('123', now, 1), false);
    assert.deepEqual(assessments(), settled, 'Repeated catch-up cannot re-score a closed day');
    assert.deepEqual(sent, ['reply:123:fixture', 'menu:123:fixture']);
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    raw.close();
  }
});
