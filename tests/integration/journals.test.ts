import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { JournalStore } from '../../src/adapters/d1/journal-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import type { Env } from '../../src/config/env.ts';
import { createHmac } from 'node:crypto';

const now = Date.parse('2026-10-23T08:00:00+07:00');
async function fixture() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  const db = (await mf.getD1Database('DB')) as unknown as Database & {
    exec(sql: string): Promise<unknown>;
  };
  for (const path of readdirSync('migrations')
    .filter((p) => p.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('migrations/' + path, 'utf8').replace(/\r?\n/g, ' '));
  const schedule = new ScheduleStore(db);
  await schedule.configure('123', '05:30', '23:15', 0, now);
  await schedule.configure('456', '05:30', '23:15', 0, now);
  const store = new JournalStore(db),
    healthy = new HealthyStore(db);
  const day = (await store.read('123', now)).today;
  return { mf, db, store, healthy, day };
}
const text = {
  achieved: 'Đọc sách\nHoàn thành việc',
  lessons: '<script>alert(1)</script>',
  tomorrow: 'Ngủ sớm',
};

test('journal HTTP enforces authentication/origin/strict fields and accepts all three full-length Vietnamese sections', async () => {
  const { mf, db, day } = await fixture();
  try {
    const env = {
      DB: db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_WEBHOOK_SECRET: 'fixture-only-webhook-secret',
      TELEGRAM_BOT_TOKEN: 'journal-test-secret',
    } satisfies Env;
    const data = new URLSearchParams({
      auth_date: String(Math.floor(now / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    const check = [...data]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => key + '=' + value)
      .join('\n');
    const key = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN!).digest();
    data.set('hash', createHmac('sha256', key).update(check).digest('hex'));
    const headers = { 'X-Telegram-Init-Data': data.toString(), 'Content-Type': 'application/json' };
    const body = {
      id: 'journal_http_01',
      operation: 'save',
      day,
      version: 0,
      achieved: 'ắ'.repeat(4000),
      lessons: 'ỗ'.repeat(4000),
      tomorrow: 'đ'.repeat(4000),
    };
    assert.equal(
      (await miniAppApi(new Request('https://local.test/api/journals'), env, now)).status,
      401,
    );
    assert.equal(
      (
        await miniAppApi(
          new Request('https://local.test/api/journals', {
            method: 'POST',
            headers: { ...headers, Origin: 'https://evil.test' },
            body: JSON.stringify(body),
          }),
          env,
          now,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await miniAppApi(
          new Request('https://local.test/api/journals', {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...body, owner: '456' }),
          }),
          env,
          now,
        )
      ).status,
      400,
    );
    const response = await miniAppApi(
      new Request('https://local.test/api/journals', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
      env,
      now,
    );
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as any).result.reward, true);
    const read = await miniAppApi(
      new Request('https://local.test/api/journals?day=' + day, { headers }),
      env,
      now,
    );
    assert.equal(((await read.json()) as any).entry.tomorrow.length, 4000);
    assert.equal(
      (
        await miniAppApi(
          new Request('https://local.test/api/journals', {
            method: 'POST',
            headers,
            body: ' '.repeat(65537),
          }),
          env,
          now,
        )
      ).status,
      413,
    );
  } finally {
    await mf.dispose();
  }
});

test('failed journal transaction publishes neither entry, reward claim, wallet nor receipt', async () => {
  const { mf, db, healthy, day } = await fixture();
  try {
    const failing: Database = {
      prepare: (sql) => db.prepare(sql),
      batch: async () => {
        throw Error('SIMULATED_DATABASE_FAILURE');
      },
    };
    await assert.rejects(
      new JournalStore(failing).write(
        '123',
        'journal_rollback_01',
        { operation: 'save', day, version: 0, ...text },
        now,
      ),
      /SIMULATED_DATABASE_FAILURE/,
    );
    assert.equal((await healthy.read('123')).version, 0);
    for (const table of ['daily_journals', 'journal_reward_claims', 'cultivation_receipts']) {
      assert.equal(
        (await db.prepare('SELECT COUNT(*) AS n FROM ' + table).first<{ n: number }>())!.n,
        0,
      );
    }
  } finally {
    await mf.dispose();
  }
});

test('journal save/edit/delete/recreate use real wallet once, preserve tombstone and isolate owners', async () => {
  const { mf, db, store, healthy, day } = await fixture();
  try {
    const command = { operation: 'save', day, version: 0, ...text };
    const first = await store.write('123', 'journal_save_01', command, now);
    assert.equal(first.result.reward, true);
    assert.equal(first.account.state.qi, 1);
    assert.equal(first.account.state.earned, 1);
    assert.equal(first.account.state.tickets, 1);
    assert.deepEqual(
      await store.write('123', 'journal_save_01', command, now + 86400000),
      first,
      'Committed receipt remains recoverable after day closes',
    );
    const read = await store.read('123', now, day);
    assert.equal(read.entry?.achieved, text.achieved);
    assert.equal(read.entry?.lessons, text.lessons);
    assert.equal((await store.read('456', now, day)).entry, null);
    await assert.rejects(
      store.write('123', 'journal_save_01', { ...command, achieved: 'different' }, now),
      /REQUEST_ID_REUSED/,
    );
    const edit = await store.write(
      '123',
      'journal_edit_01',
      { ...command, version: 1, achieved: 'Edited' },
      now,
    );
    assert.equal(edit.result.reward, false);
    await assert.rejects(store.write('123', 'journal_stale_01', command, now), /JOURNAL_CHANGED/);
    const deleted = await store.write(
      '123',
      'journal_delete_01',
      { operation: 'delete', day, version: 2 },
      now,
    );
    assert.equal(deleted.result.deleted, true);
    assert.equal((await store.read('123', now, day)).entry, null);
    assert.equal((await store.read('123', now, day)).version, 3);
    assert.equal((await store.read('123', now)).entries?.length, 0);
    const tombstone = await db
      .prepare('SELECT achieved,lessons,tomorrow FROM daily_journals WHERE owner=? AND day=?')
      .bind('123', day)
      .first();
    assert.deepEqual(tombstone, { achieved: '', lessons: '', tomorrow: '' });
    const recreated = await store.write(
      '123',
      'journal_recreate_01',
      { ...command, version: 3 },
      now,
    );
    assert.equal(recreated.result.reward, false);
    assert.equal((await healthy.read('123')).state.qi, 1);
    assert.equal((await healthy.read('123')).state.tickets, 1);
    const past = await store.write('123', 'journal_past_01', { ...command, day: day - 1 }, now);
    assert.equal(past.result.reward, false);
    const next = await store.write(
      '123',
      'journal_next_01',
      { ...command, day: day + 1 },
      now + 86400000,
    );
    assert.equal(next.result.reward, true);
    assert.equal((await healthy.read('123')).state.tickets, 2);
  } finally {
    await mf.dispose();
  }
});

test('parallel first saves cannot double reward or silently overwrite text; same receipt retries converge', async () => {
  const { mf, store, healthy, day } = await fixture();
  try {
    const input = { operation: 'save', day, version: 0, ...text };
    const competing = await Promise.allSettled([
      store.write('123', 'parallel_journal_a', input, now),
      store.write('123', 'parallel_journal_b', { ...input, achieved: 'Another device' }, now),
    ]);
    assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await healthy.read('123')).state.tickets, 1);
    const results = await Promise.all([
      store.write('456', 'same_journal_request', input, now),
      store.write('456', 'same_journal_request', input, now),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal((await healthy.read('456')).state.qi, 1);
  } finally {
    await mf.dispose();
  }
});

test('validation rejects empty/future/oversized entries and lists every day through pagination', async () => {
  const { mf, store, healthy, day } = await fixture();
  try {
    const input = { operation: 'save', day, version: 0, ...text };
    for (const change of [
      { achieved: '', lessons: ' ', tomorrow: '' },
      { day: day + 1 },
      { day: 1.5 },
      { achieved: 'a'.repeat(4001) },
      { tomorrow: '\u0000' },
      { version: -1 },
      { owner: '456' },
    ]) {
      await assert.rejects(
        store.write('123', 'invalid_journal_01', { ...input, ...change }, now),
        /INVALID_JOURNAL/,
      );
    }
    assert.equal((await healthy.read('123')).version, 0);
    for (let index = 0; index < 33; index++)
      await store.write('123', 'history_journal_' + index, { ...input, day: day - index }, now);
    const page = await store.read('123', now);
    assert.equal(page.entries?.length, 30);
    const next = await store.read('123', now, undefined, page.next!);
    assert.equal(next.entries?.length, 3);
    assert.equal(
      new Set([...(page.entries ?? []), ...(next.entries ?? [])].map((r) => r.day)).size,
      33,
    );
    assert.equal((await healthy.read('123')).state.tickets, 1);
  } finally {
    await mf.dispose();
  }
});
