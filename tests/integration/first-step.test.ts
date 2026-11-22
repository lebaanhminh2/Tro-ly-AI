import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac, createHash } from 'node:crypto';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { D1FirstStepStore } from '../../src/adapters/d1/first-step-store.ts';
import { FirstStepService } from '../../src/application/first-step-service.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import type { Env } from '../../src/config/env.ts';
import { claimDailyReward, drawReward } from '../../src/domain/healthy.ts';

const now = Date.parse('2026-11-16T08:00:00+07:00');
async function fixture(through = 48) {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  const db = (await mf.getD1Database('DB')) as unknown as Database & {
    exec(sql: string): Promise<unknown>;
  };
  for (const path of readdirSync('migrations')
    .filter((p) => p.endsWith('.sql') && Number(p.slice(0, 4)) <= through)
    .sort())
    await db.exec(readFileSync('migrations/' + path, 'utf8').replace(/\r?\n/g, ' '));
  const store = new D1FirstStepStore(db),
    service = new FirstStepService(store),
    healthy = new HealthyStore(db);
  const run = (
    operation: string,
    occurrenceId: string,
    id = operation + '_' + crypto.randomUUID(),
    at = now,
    owner = '123',
  ) => service.execute(owner, id, { operation, occurrenceId }, at);
  return { mf, db, store, service, healthy, run };
}

test('timer starts once, uses server deadline, crosses days, waits for confirmation and credits the real wallet once', async () => {
  const f = await fixture();
  try {
    const initial = await f.healthy.read('123');
    const started = await f.run('start', 'timer_occurrence_001', 'start_request_001');
    assert.equal(started.result.occurrence.endsAt, now + 300000);
    assert.equal(started.result.rewarded, false);
    assert.deepEqual(started.account.state, initial.state);
    await assert.rejects(
      f.run('claim', 'timer_occurrence_001', 'early_request_001', now + 299999),
      /FIRST_STEP_TOO_EARLY/,
    );
    assert.deepEqual((await f.healthy.read('123')).state, initial.state);
    assert.equal((await f.store.read('123', now + 86400000)).active?.id, 'timer_occurrence_001');
    const claimed = await f.run(
      'claim',
      'timer_occurrence_001',
      'claim_request_001',
      now + 86400000,
    );
    assert.deepEqual(claimed.account.state, { ...initial.state, qi: 1, earned: 1, tickets: 1 });
    assert.equal(claimed.result.occurrence.status, 'completed');
    assert.deepEqual(
      (await f.run('claim', 'timer_occurrence_001', 'claim_request_001', now + 172800000)).result,
      claimed.result,
    );
    assert.equal(
      (await f.run('claim', 'timer_occurrence_001', 'claim_request_002', now + 172800000)).result
        .rewarded,
      false,
    );
    assert.equal((await f.healthy.read('123')).state.tickets, 1);
    assert.equal((await f.store.read('123', now)).active, null);
    await assert.rejects(f.run('cancel', 'timer_occurrence_001'), /FIRST_STEP_COMPLETED/);
  } finally {
    await f.mf.dispose();
  }
});

test('cancel preserves prior rewards, persists, isolates owners and tombstones a delayed start', async () => {
  const f = await fixture();
  try {
    await f.run('outside', 'outside_occurrence_001');
    const before = (await f.healthy.read('123')).state;
    const canceled = await f.run('cancel', 'canceled_before_start', 'cancel_request_001');
    assert.equal(canceled.result.occurrence.status, 'canceled');
    const late = await f.run('start', 'canceled_before_start', 'delayed_start_001', now + 50);
    assert.equal(late.result.occurrence.status, 'canceled');
    await f.run('start', 'replay_start_canceled', 'replay_start_request');
    await f.run('cancel', 'replay_start_canceled');
    assert.equal(
      (await f.run('start', 'replay_start_canceled', 'replay_start_request')).result.occurrence
        .status,
      'canceled',
    );
    assert.equal((await new D1FirstStepStore(f.db).read('123', now)).active, null);
    await assert.rejects(
      f.run('claim', 'canceled_before_start', undefined, now + 400000),
      /FIRST_STEP_CANCELED/,
    );
    await f.run('start', 'active_to_cancel_001');
    await f.run('cancel', 'active_to_cancel_001', 'cancel_active_001', now + 400000);
    assert.deepEqual((await f.healthy.read('123')).state, before);
    assert.equal((await f.store.read('456', now, 'canceled_before_start')).occurrence, null);
    await assert.rejects(
      f.run('claim', 'active_to_cancel_001', undefined, now + 500000, '456'),
      /FIRST_STEP_NOT_FOUND/,
    );
    assert.equal((await f.healthy.read('456')).state.tickets, 0);
  } finally {
    await f.mf.dispose();
  }
});

test('outside acknowledgements award every occurrence on the same day without timer/quota or reusing an active id', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 12; i++) await f.run('outside', 'outside_repeat_' + i);
    assert.equal((await f.healthy.read('123')).state.tickets, 12);
    assert.equal((await f.healthy.read('123')).state.qi, 12);
    assert.equal((await f.run('outside', 'outside_repeat_0')).result.rewarded, false);
    await f.run('start', 'active_occurrence_001');
    await assert.rejects(f.run('outside', 'active_occurrence_001'), /FIRST_STEP_CHANGED/);
    await assert.rejects(f.run('outside', 'outside_while_active'), /FIRST_STEP_ACTIVE/);
    await assert.rejects(f.run('start', 'second_active_timer'), /FIRST_STEP_ACTIVE/);
    assert.equal((await f.healthy.read('123')).state.tickets, 12);
  } finally {
    await f.mf.dispose();
  }
});

test('suspended rewards roll back and concurrent draw/check-in writes never lose or duplicate balances', async () => {
  const f = await fixture();
  try {
    await f.healthy.mutate('123', 'seed_suspended', 'fixture', {}, now, (state) => ({
      state: { ...state, suspended: true },
      result: {},
    }));
    await f.run('start', 'suspended_timer_001');
    await assert.rejects(
      f.run('claim', 'suspended_timer_001', 'suspended_claim_001', now + 300000),
      /ACCOUNT_SUSPENDED/,
    );
    assert.equal((await f.store.read('123', now)).active?.status, 'active');
    assert.equal(
      await f.db
        .prepare(
          "SELECT request_id FROM cultivation_receipts WHERE request_id='suspended_claim_001'",
        )
        .first(),
      null,
    );
    await f.run('cancel', 'suspended_timer_001');
    await f.healthy.mutate('123', 'seed_wallet_races', 'fixture', {}, now, (state) => ({
      state: { ...state, suspended: false, qi: 10, earned: 40, tickets: 10 },
      result: {},
    }));
    const retryConflict = async (run: () => Promise<unknown>) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await run();
        } catch (error) {
          if (attempt >= 3 || !String(error).includes('CHECK constraint failed')) throw error;
        }
      }
    };
    const beforeDraw = await f.healthy.read('123');
    const expectedDraw = drawReward(beforeDraw.state, 0);
    await f.run('start', 'draw_race_timer_001');
    await Promise.all([
      f.run('claim', 'draw_race_timer_001', 'draw_race_claim_001', now + 300000),
      retryConflict(() =>
        f.healthy.mutate('123', 'draw_race_wallet_01', 'draw', {}, now + 300000, (state) => {
          const result = drawReward(state, 0);
          return { state: result.state, result: { reward: result.reward } };
        }),
      ),
    ]);
    assert.deepEqual((await f.healthy.read('123')).state, {
      ...expectedDraw.state,
      qi: expectedDraw.state.qi + 1,
      earned: expectedDraw.state.earned + 1,
      tickets: expectedDraw.state.tickets + 1,
    });
    const beforeCheck = (await f.healthy.read('123')).state;
    const expectedCheck = claimDailyReward(beforeCheck, now + 300000);
    await f.run('start', 'checkin_race_timer_01');
    await Promise.all([
      f.run('claim', 'checkin_race_timer_01', 'checkin_race_claim_01', now + 300000),
      retryConflict(() => f.healthy.checkIn('123', 'checkin_race_wallet_01', {}, now + 300000)),
    ]);
    assert.deepEqual((await f.healthy.read('123')).state, {
      ...expectedCheck.state,
      qi: expectedCheck.state.qi + 1,
      earned: expectedCheck.state.earned + 1,
      tickets: expectedCheck.state.tickets + 1,
    });
  } finally {
    await f.mf.dispose();
  }
});

test('request receipts bind operation/payload, recover lost batch acknowledgements and never replay rewards', async () => {
  const f = await fixture();
  try {
    await f.run('start', 'receipt_occurrence_01', 'immutable_request_01');
    await assert.rejects(
      f.run('cancel', 'receipt_occurrence_01', 'immutable_request_01'),
      /REQUEST_ID_REUSED/,
    );
    await assert.rejects(
      f.run('start', 'different_occurrence', 'immutable_request_01'),
      /REQUEST_ID_REUSED/,
    );
    const lost: Database = {
      prepare: (sql) => f.db.prepare(sql),
      batch: async (statements) => {
        await f.db.batch(statements);
        throw Error('LOST_BATCH_ACK');
      },
    };
    const service = new FirstStepService(new D1FirstStepStore(lost));
    const result = await service.execute(
      '123',
      'claim_lost_ack_001',
      { operation: 'claim', occurrenceId: 'receipt_occurrence_01' },
      now + 300000,
    );
    assert.equal(result.result.rewarded, true);
    assert.equal(
      (await f.run('claim', 'receipt_occurrence_01', 'retry_other_id_001', now + 300000)).result
        .rewarded,
      false,
    );
    assert.equal((await f.healthy.read('123')).state.tickets, 1);
  } finally {
    await f.mf.dispose();
  }
});

test('SQL failure after wallet/receipt writes rolls back every statement', async () => {
  const f = await fixture();
  try {
    await f.run('start', 'rollback_occurrence_01');
    const before = await f.healthy.read('123');
    // A runtime CHECK failure after the writes proves transaction rollback,
    // rather than a prepare-time failure on a missing table.
    const failing: Database = {
      prepare: (sql) => f.db.prepare(sql),
      batch: (statements) =>
        f.db.batch([...statements, f.db.prepare('INSERT INTO transaction_guard(valid) VALUES(0)')]),
    };
    await assert.rejects(
      new FirstStepService(new D1FirstStepStore(failing)).execute(
        '123',
        'rollback_claim_001',
        { operation: 'claim', occurrenceId: 'rollback_occurrence_01' },
        now + 300000,
      ),
      /FIRST_STEP_CHANGED/,
    );
    assert.deepEqual(await f.healthy.read('123'), before);
    assert.equal((await f.store.read('123', now)).active?.status, 'active');
    assert.equal(
      await f.db
        .prepare(
          "SELECT request_id FROM cultivation_receipts WHERE request_id='rollback_claim_001'",
        )
        .first(),
      null,
    );
    await f.run('claim', 'rollback_occurrence_01', 'rollback_claim_001', now + 300000);
    assert.equal((await f.healthy.read('123')).state.tickets, 1);
  } finally {
    await f.mf.dispose();
  }
});

test('parallel start and parallel claims converge to one active occurrence and exactly one reward', async () => {
  const f = await fixture();
  try {
    const starts = await Promise.allSettled([
      f.run('start', 'parallel_start_one'),
      f.run('start', 'parallel_start_two'),
    ]);
    assert.equal(starts.filter((x) => x.status === 'fulfilled').length, 1);
    const active = (await f.store.read('123', now)).active!;
    const claims = await Promise.all([
      f.run('claim', active.id, 'parallel_claim_one', now + 300000),
      f.run('claim', active.id, 'parallel_claim_two', now + 300000),
    ]);
    assert.equal(claims.filter((x) => x.result.rewarded).length, 1);
    assert.equal((await f.healthy.read('123')).state.tickets, 1);
    assert.equal((await f.store.read('123', now)).active, null);
  } finally {
    await f.mf.dispose();
  }
});

test('claim/cancel races have one terminal winner with reward iff completed', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 4; i++) {
      const id = 'terminal_race_' + i;
      const before = (await f.healthy.read('123')).state.tickets;
      await f.run('start', id);
      await Promise.allSettled([
        f.run('claim', id, 'race_claim_' + i, now + 300000),
        f.run('cancel', id, 'race_cancel_' + i, now + 300000),
      ]);
      const row = (await f.store.read('123', now, id)).occurrence!;
      assert.ok(['completed', 'canceled'].includes(row.status));
      assert.equal(
        (await f.healthy.read('123')).state.tickets,
        before + Number(row.status === 'completed'),
      );
      assert.equal((await f.store.read('123', now)).active, null);
    }
  } finally {
    await f.mf.dispose();
  }
});

test('cancel and late start with the same id cannot resurrect an occurrence', async () => {
  const f = await fixture();
  try {
    await Promise.allSettled([
      f.run('cancel', 'tombstone_race_001'),
      f.run('start', 'tombstone_race_001'),
    ]);
    assert.equal(
      (await f.store.read('123', now, 'tombstone_race_001')).occurrence?.status,
      'canceled',
    );
    await f.run('start', 'tombstone_race_001');
    assert.equal((await f.store.read('123', now)).active, null);
    assert.equal((await f.healthy.read('123')).state.tickets, 0);
  } finally {
    await f.mf.dispose();
  }
});

test('additive migration preserves all old tables and existing wallet data', async () => {
  const f = await fixture(47);
  try {
    await f.healthy.mutate('123', 'migration_seed_001', 'fixture', {}, now, (state) => ({
      state: { ...state, qi: 123, earned: 567, tickets: 42 },
      result: {},
    }));
    // Cloudflare's protected _cf_METADATA is platform metadata, not an app table.
    const tables = (
      await f.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' ORDER BY name",
        )
        .all<{ name: string }>()
    ).results;
    async function snapshots() {
      const result: Record<string, string> = {};
      for (const { name } of tables) {
        const rows = (
          await f.db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all()
        ).results;
        result[name] = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      }
      return result;
    }
    const before = await snapshots();
    await f.db.exec(readFileSync('migrations/0048_first_step.sql', 'utf8').replace(/\r?\n/g, ' '));
    assert.deepEqual(await snapshots(), before);
    assert.equal((await f.db.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
    assert.equal((await f.store.read('123', now)).active, null);
  } finally {
    await f.mf.dispose();
  }
});

test('real HTTP route enforces auth/origin/body/owner and never accepts client reward or timer shortcuts', async () => {
  const f = await fixture();
  try {
    const env = {
      DB: f.db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_BOT_TOKEN: 'first-step-test-only',
      TELEGRAM_WEBHOOK_SECRET: 'test-only',
    } satisfies Env;
    const auth = new URLSearchParams({
      auth_date: String(Math.floor(now / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    const check = [...auth]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => k + '=' + v)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest();
    auth.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
    const headers = {
      'X-Telegram-Init-Data': auth.toString(),
      'Content-Type': 'application/json',
      'X-Minh-Anh-Request': '1',
    };
    const send = (body: unknown, extra = {}, at = now) =>
      miniAppApi(
        new Request('https://local.test/api/first-step', {
          method: 'POST',
          headers: { ...headers, ...extra },
          body: JSON.stringify(body),
        }),
        env,
        at,
      );
    assert.equal(
      (await miniAppApi(new Request('https://local.test/api/first-step'), env, now)).status,
      401,
    );
    const start = { id: 'http_start_001', operation: 'start', occurrenceId: 'http_occurrence_01' };
    assert.equal((await send(start, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await send({ ...start, owner: '456' })).status, 400);
    assert.equal((await send({ ...start, endsAt: now })).status, 400);
    for (const operation of [['start'], ['outside'], {}, null, 1])
      assert.equal((await send({ ...start, operation })).status, 400);
    assert.equal((await f.store.read('123', now)).active, null);
    assert.equal((await f.healthy.read('123')).state.tickets, 0);
    const started = await send(start);
    assert.equal(started.status, 200);
    const deadline = ((await started.json()) as { result: { occurrence: { endsAt: number } } })
      .result.occurrence.endsAt;
    assert.equal(
      (await send({ id: 'http_claim_early', operation: 'claim', occurrenceId: start.occurrenceId }))
        .status,
      409,
    );
    assert.equal(
      (
        await send({
          id: 'http_reward_bad',
          operation: 'claim',
          occurrenceId: start.occurrenceId,
          reward: 500,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send(
          { id: 'http_claim_001', operation: 'claim', occurrenceId: start.occurrenceId },
          {},
          deadline,
        )
      ).status,
      200,
    );
    const read = await miniAppApi(
      new Request('https://local.test/api/first-step?occurrenceId=http_occurrence_01', { headers }),
      env,
      now,
    );
    const data = (await read.json()) as {
      owner: string;
      active: unknown;
      occurrence: { status: string };
    };
    assert.equal(data.owner, '123');
    assert.equal(data.active, null);
    assert.equal(data.occurrence.status, 'completed');
    assert.equal((await send({ id: 'oversized_request', padding: 'x'.repeat(5000) })).status, 413);
    assert.equal((await f.healthy.read('456')).state.tickets, 0);
  } finally {
    await f.mf.dispose();
  }
});

test('first-step status uses bounded indexed reads with a large history and database constraints reject invalid states', async () => {
  const f = await fixture();
  try {
    await f.db
      .prepare(
        `INSERT INTO first_step_occurrences(owner,id,source,status,version,started_at,ends_at,completed_at)
      SELECT '123','history_'||value,'outside','completed',1,?,?,? FROM json_each(?)`,
      )
      .bind(now, now, now, JSON.stringify(Array.from({ length: 1000 }, (_, i) => i)))
      .run();
    await f.run('start', 'indexed_active_001');
    const plan = (
      await f.db
        .prepare(
          "EXPLAIN QUERY PLAN SELECT id FROM first_step_occurrences WHERE owner=? AND status='active' LIMIT 1",
        )
        .bind('123')
        .all<{ detail: string }>()
    ).results;
    assert.match(plan.map((row) => row.detail).join('\n'), /SEARCH.*first_step_one_active/);
    let queries = 0;
    const counted: Database = {
      prepare(sql) {
        queries++;
        return f.db.prepare(sql);
      },
      batch(statements) {
        return f.db.batch(statements);
      },
    };
    const snapshot = await new D1FirstStepStore(counted).read('123', now, 'indexed_active_001');
    assert.equal(queries, 2);
    assert.equal(snapshot.active?.id, 'indexed_active_001');
    assert.ok(JSON.stringify(snapshot).length < 1000);
    await assert.rejects(
      f.db
        .prepare(
          "INSERT INTO first_step_occurrences(owner,id,source,status,started_at,ends_at) VALUES('456','bad_duration','timer','active',?,?)",
        )
        .bind(now, now + 1)
        .run(),
      /CHECK constraint/,
    );
    await assert.rejects(
      f.db
        .prepare(
          "UPDATE first_step_occurrences SET status='completed' WHERE owner='123' AND id='indexed_active_001'",
        )
        .run(),
      /CHECK constraint/,
    );
    assert.equal((await f.store.read('123', now)).active?.status, 'active');
  } finally {
    await f.mf.dispose();
  }
});
