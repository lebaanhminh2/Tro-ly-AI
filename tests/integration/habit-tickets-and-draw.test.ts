import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import type { Env } from '../../src/config/env.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { handleCultivation } from '../../src/entrypoints/mini-app/cultivation.ts';
import { D1BeastStore } from '../../src/adapters/d1/linh-thu-store.ts';
import { BeastUltimateService } from '../../src/application/linh-thu-ultimates.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../../src/domain/linh-thu-catalog.ts';
import { setTimeout as delay } from 'node:timers/promises';

const monday = Date.parse('2026-10-12T08:00:00+07:00'),
  DAY = 86400000;
const definition = { name: 'Đọc sách', metric: 'duration', target: 20, cadence: { kind: 'daily' } };
async function fixture() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  const db = (await mf.getD1Database('DB')) as unknown as Database & {
    exec(sql: string): Promise<unknown>;
  };
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
  await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, monday);
  const store = new D1HabitStore(db),
    service = new HabitService(store),
    healthy = new HealthyStore(db);
  async function record(habitId: string, at: number, value: number, id: string) {
    const data = await store.today('123', at),
      view = data.habits.find((view) => view.habit.id === habitId)!;
    return service.execute(
      '123',
      id,
      {
        operation: 'log',
        habitId,
        day: data.day.day,
        version: view.habit.version,
        logVersion: view.log.version,
        value,
      },
      at,
    );
  }
  return { mf, db, store, service, healthy, record };
}

async function drawCompanion(db: Database, now = monday, speciesId = 'frostnip') {
  const store = new D1BeastStore(db),
    day = (await new ScheduleStore(db).ensureDay('123', now))!.day;
  await store.transact(
    '123',
    'draw_companion_seed',
    'fixture',
    {},
    day,
    now,
    0,
    (account, state) => ({
      state: account.state,
      healthy: { ...state, tickets: 40 },
      newBeasts: [{ id: 'draw_companion_01', speciesId, attemptId: 'draw_attempt_001' }],
      result: {},
    }),
  );
  await db
    .prepare(
      "UPDATE beast_attempts SET earned=?,form=4,status='completed' WHERE owner='123' AND id='draw_attempt_001'",
    )
    .bind(BEAST_TRAINING[beastSpecies(speciesId).rank].capacity)
    .run();
  await db
    .prepare(
      "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,'draw_companion_01','draw_attempt_001',?)",
    )
    .bind(day, now)
    .run();
  return { store, day };
}

function drawContext(db: Database, now = monday) {
  return {
    env: { DB: db, TELEGRAM_USER_ID: '123' } as Env,
    owner: '123',
    now,
    healthy: new HealthyStore(db),
  };
}

test('real draw handler uses four database round trips with a companion under binding latency, including repeated x1/x10 and day rollover', async (t) => {
  const { mf, db, healthy } = await fixture();
  try {
    const { day } = await drawCompanion(db);
    let calls: string[] = [];
    const native = new WeakMap<ReturnType<Database['prepare']>, ReturnType<Database['prepare']>>();
    const slow = {
      prepare(sql: string) {
        const wrap = (
          statement: ReturnType<Database['prepare']>,
        ): ReturnType<Database['prepare']> => {
          const wrapped: ReturnType<Database['prepare']> = {
            bind: (...values) => wrap(statement.bind(...values)),
            first: async <T>() => {
              calls.push('read');
              await delay(25);
              return statement.first<T>();
            },
            all: async <T>() => {
              calls.push('read');
              await delay(25);
              return statement.all<T>();
            },
            run: async () => {
              calls.push('write');
              await delay(25);
              return statement.run();
            },
          };
          native.set(wrapped, statement);
          return wrapped;
        };
        return wrap(db.prepare(sql));
      },
      batch: async (statements) => {
        calls.push('batch');
        await delay(25);
        return db.batch(statements.map((statement) => native.get(statement)!));
      },
    } satisfies Database;
    const context = drawContext(slow);
    let balance = 40;
    for (const [index, count] of [1, 10, 1].entries()) {
      calls = [];
      const input = { id: 'slow_draw_000' + index, operation: 'draw', count };
      const started = performance.now();
      const response = await handleCultivation(context, input),
        body = (await response.json()) as any;
      assert.equal(response.status, 200);
      assert.equal(body.result.rewards.length, count);
      assert.equal(body.account.state.tickets, (balance -= count));
      assert.deepEqual(body.account, await healthy.read('123'));
      assert.deepEqual(calls, ['read', 'read', 'read', 'batch']);
      t.diagnostic(
        JSON.stringify({
          count,
          bindingLatencyMs: 25,
          dbCalls: calls.length,
          elapsedMs: Math.round(performance.now() - started),
        }),
      );
      calls = [];
      assert.deepEqual(await (await handleCultivation(context, input)).json(), body);
      assert.deepEqual(calls, ['read'], 'A replay must not prepare effects or write again');
    }
    const events = (
      await db
        .prepare(
          "SELECT json_extract(result_json,'$.ordinal') AS ordinal FROM beast_skill_events WHERE owner='123' AND kind='draw' ORDER BY json_extract(result_json,'$.ordinal')",
        )
        .all<{ ordinal: number }>()
    ).results;
    assert.deepEqual(
      events.map((event) => event.ordinal),
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    const next = await handleCultivation(drawContext(db, monday + DAY), {
      id: 'rollover_draw_01',
      operation: 'draw',
    });
    assert.equal(next.status, 200);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT json_extract(result_json,'$.ordinal') AS ordinal FROM beast_skill_events WHERE owner='123' AND day=?",
          )
          .bind(day + 1)
          .first<{ ordinal: number }>()
      )?.ordinal,
      1,
    );
    assert.equal((await healthy.read('456')).state.tickets, 0);
  } finally {
    await mf.dispose();
  }
});

test('draw wallet, choices, companion, ultimate and receipt roll back together, then recover a lost committed response once', async () => {
  const { mf, db, healthy } = await fixture();
  try {
    const { store, day } = await drawCompanion(db, monday, 'skinklet');
    await new BeastUltimateService(store).execute(
      '123',
      'draw_ultimate_01',
      {
        operation: 'ultimate',
        day,
        version: (await store.read('123')).version,
        beastId: 'draw_companion_01',
      },
      day,
      monday,
      (await new ScheduleStore(db).ensureDay('123', monday))!.end_at,
    );
    const before = await healthy.read('123'),
      beastBefore = await store.read('123'),
      ultimateBefore = await store.ultimate('123', day);
    let loseCommitted = false;
    const broken: Database = {
      prepare: db.prepare.bind(db),
      batch: async (statements) => {
        if (!loseCommitted)
          return db.batch([...statements, db.prepare('INSERT INTO transaction_guard SELECT 0')]);
        await db.batch(statements);
        throw Error('SIMULATED_LOST_COMMITTED_RESPONSE');
      },
    };
    const input = { id: 'draw_atomic_001', operation: 'draw', count: 10 };
    await assert.rejects(
      handleCultivation(drawContext(broken), input),
      /CHECK|constraint|D1_ERROR/i,
    );
    assert.deepEqual(await healthy.read('123'), before);
    assert.deepEqual(await store.read('123'), beastBefore);
    assert.deepEqual(await store.ultimate('123', day), ultimateBefore);
    assert.equal((await store.pendingDraws('123')).length, 0);
    assert.equal(
      await db.prepare("SELECT 1 FROM beast_skill_events WHERE kind='draw'").first(),
      null,
    );
    assert.equal(await healthy.receipt('123', input.id, 'draw', input), null);
    loseCommitted = true;
    const responses = await Promise.all([
      handleCultivation(drawContext(broken), input),
      handleCultivation(drawContext(broken), input),
    ]);
    const [saved, replay] = (await Promise.all(
      responses.map((response) => response.json()),
    )) as any[];
    assert.deepEqual(saved, replay);
    assert.equal(saved.result.choices.length, 3);
    assert.equal(saved.result.rewards.length, 7);
    assert.equal(saved.account.state.tickets, before.state.tickets - 10);
    assert.deepEqual(saved.account, await healthy.read('123'));
    assert.equal((await store.pendingDraws('123')).length, 3);
    assert.equal((await store.ultimate('123', day))!.remaining, 0);
    assert.equal(
      (await db
        .prepare("SELECT COUNT(*) AS n FROM cultivation_receipts WHERE operation='draw'")
        .first<{ n: number }>())!.n,
      1,
    );
  } finally {
    await mf.dispose();
  }
});

test('a wallet change during slow draw preparation rejects the stale batch and preserves the competing reward for retry', async () => {
  const { mf, db, healthy } = await fixture();
  let didPrepare!: () => void, resume!: () => void;
  const prepared = new Promise<void>((resolve) => {
      didPrepare = resolve;
    }),
    release = new Promise<void>((resolve) => {
      resume = resolve;
    });
  try {
    const { store } = await drawCompanion(db);
    const beastBefore = await store.read('123');
    const held: Database = {
      prepare: db.prepare.bind(db),
      batch: async (statements) => {
        didPrepare();
        await release;
        return db.batch(statements);
      },
    };
    const input = { id: 'draw_guarded_01', operation: 'draw', count: 10 };
    const pending = handleCultivation(drawContext(held), input);
    const rejected = assert.rejects(pending, /CHECK|constraint|D1_ERROR/i);
    await prepared;
    await healthy.mutate('123', 'draw_competing_bonus', 'fixture', {}, monday, (state) => ({
      state: { ...state, tickets: state.tickets + 3 },
      result: {},
    }));
    resume();
    await rejected;
    assert.equal((await healthy.read('123')).state.tickets, 43);
    assert.deepEqual(await store.read('123'), beastBefore);
    assert.equal(await healthy.receipt('123', input.id, 'draw', input), null);
    const response = await handleCultivation(drawContext(db), input),
      body = (await response.json()) as any;
    assert.equal(response.status, 200);
    assert.equal(body.account.state.tickets, 33);
    assert.deepEqual(body.account, await healthy.read('123'));
  } finally {
    resume();
    await mf.dispose();
  }
});

test('habit tickets require a new scheduled completion, survive undo once and never backfill settlements', async () => {
  const { mf, db, store, service, healthy, record } = await fixture();
  try {
    const created = await service.execute(
      '123',
      'create_ticket_01',
      { operation: 'create', definition },
      monday,
    );
    assert.equal((await record(created.habitId, monday, 20, 'trial_log_0001')).ticketAwarded, 0);
    assert.equal(
      (await record(created.habitId, monday + DAY, 19.99, 'partial_log_01')).ticketAwarded,
      0,
    );
    assert.equal(
      (await record(created.habitId, monday + DAY, 20, 'complete_log01')).ticketAwarded,
      1,
    );
    assert.equal((await healthy.read('123')).state.tickets, 1);
    assert.equal(
      (await record(created.habitId, monday + DAY, 25, 'increase_log01')).ticketAwarded,
      0,
    );
    assert.equal(
      (await record(created.habitId, monday + DAY, 0, 'undo_log_0001')).ticketAwarded,
      0,
    );
    assert.equal(
      (await record(created.habitId, monday + DAY, 20, 'redo_log_0001')).ticketAwarded,
      0,
    );
    assert.equal((await healthy.read('123')).state.tickets, 1);
    const data = await store.today('123', monday + DAY),
      view = data.habits[0]!;
    const input = {
      operation: 'log',
      habitId: created.habitId,
      day: data.day.day,
      version: view.habit.version,
      logVersion: view.log.version,
      value: 21,
    };
    const saved = await service.execute('123', 'receipt_ticket01', input, monday + DAY);
    assert.deepEqual(
      await service.execute('123', 'receipt_ticket01', input, monday + 2 * DAY),
      saved,
    );
    await assert.rejects(
      service.execute('123', 'receipt_ticket01', { ...input, value: 22 }, monday + 2 * DAY),
      /REQUEST_ID_REUSED/,
    );
    await store.settle('123', monday + 4 * DAY, 20);
    assert.equal((await healthy.read('123')).state.tickets, 1);
    assert.equal((await healthy.read('456')).state.tickets, 0);
    assert.equal(
      (await db.prepare('SELECT COUNT(*) AS n FROM habit_ticket_awards').first<{ n: number }>())!.n,
      1,
    );
    assert.equal(
      (await record(created.habitId, monday + 4 * DAY, 20, 'another_day01')).ticketAwarded,
      1,
    );
  } finally {
    await mf.dispose();
  }
});

test('weekday eligibility and weekly quota constrain ticket rewards even after undo and future edits', async () => {
  const { mf, store, service, healthy, record } = await fixture();
  try {
    const weekday = await service.execute(
      '123',
      'create_weekday01',
      {
        operation: 'create',
        definition: { ...definition, cadence: { kind: 'weekdays', weekdays: [2] } },
      },
      monday,
    );
    assert.equal(
      (await record(weekday.habitId, monday + DAY, 20, 'off_day_log01')).ticketAwarded,
      0,
    );
    assert.equal(
      (await record(weekday.habitId, monday + 2 * DAY, 20, 'on_day_log001')).ticketAwarded,
      1,
    );
    const weekly = await service.execute(
      '123',
      'create_weekly01',
      { operation: 'create', definition: { ...definition, cadence: { kind: 'weekly', quota: 2 } } },
      monday,
    );
    const start = monday + 7 * DAY;
    assert.equal((await record(weekly.habitId, start, 20, 'week_first001')).ticketAwarded, 1);
    await record(weekly.habitId, start, 0, 'week_undo0001');
    assert.equal((await record(weekly.habitId, start, 20, 'week_redo0001')).ticketAwarded, 0);
    assert.equal((await record(weekly.habitId, start + DAY, 20, 'week_second01')).ticketAwarded, 1);
    const data = await store.today('123', start + DAY),
      view = data.habits.find((v) => v.habit.id === weekly.habitId)!;
    await service.execute(
      '123',
      'edit_week_quota',
      {
        operation: 'update',
        habitId: weekly.habitId,
        version: view.habit.version,
        definition: { ...definition, cadence: { kind: 'weekly', quota: 4 } },
      },
      start + DAY,
    );
    assert.equal(
      (await record(weekly.habitId, start + 2 * DAY, 20, 'week_extra001')).ticketAwarded,
      0,
    );
    assert.equal(
      (await record(weekly.habitId, start + 7 * DAY, 20, 'new_week_0001')).ticketAwarded,
      1,
    );
    assert.equal((await healthy.read('123')).state.tickets, 4);
  } finally {
    await mf.dispose();
  }
});

test('weekly rewards do not add tickets for quota already fulfilled by older logs', async () => {
  const { mf, db, store, service, healthy, record } = await fixture();
  try {
    const created = await service.execute(
      '123',
      'legacy_week_001',
      { operation: 'create', definition: { ...definition, cadence: { kind: 'weekly', quota: 1 } } },
      monday,
    );
    const start = monday + 7 * DAY,
      day = (await store.today('123', start)).day.day;
    await db
      .prepare('INSERT INTO habit_logs(owner,habit_id,day,value,note,updated) VALUES(?,?,?,?,?,?)')
      .bind('123', created.habitId, day, 2000, '', start)
      .run();
    assert.equal(
      (await record(created.habitId, start + DAY, 20, 'legacy_extra01')).ticketAwarded,
      0,
    );
    assert.equal((await healthy.read('123')).state.tickets, 0);
  } finally {
    await mf.dispose();
  }
});

test('ticket, log and receipt roll back together and recover a committed response lost after the batch', async () => {
  const { mf, db, store, service, healthy } = await fixture();
  try {
    const created = await service.execute(
      '123',
      'atomic_create01',
      { operation: 'create', definition },
      monday,
    );
    const data = await store.today('123', monday + DAY);
    const input = {
      operation: 'log',
      habitId: created.habitId,
      day: data.day.day,
      version: 1,
      logVersion: 0,
      value: 20,
    };
    let commit = false;
    const broken = {
      prepare: db.prepare.bind(db),
      batch: async (statements: any[]) => {
        if (!commit)
          return db.batch([
            ...statements.slice(0, -1),
            db.prepare('INSERT INTO transaction_guard SELECT 0'),
            ...statements.slice(-1),
          ]);
        await db.batch(statements);
        throw Error('SIMULATED_BATCH_FAILURE');
      },
    } as Database;
    const failing = new HabitService(new D1HabitStore(broken));
    await assert.rejects(
      failing.execute('123', 'atomic_log_0001', input, monday + DAY),
      /CHECK|constraint|D1_ERROR/i,
    );
    assert.equal((await healthy.read('123')).state.tickets, 0);
    assert.equal((await store.today('123', monday + DAY)).habits[0]!.log.version, 0);
    assert.equal(await db.prepare('SELECT 1 FROM habit_ticket_awards').first(), null);
    commit = true;
    const result = await failing.execute('123', 'atomic_log_0001', input, monday + DAY);
    assert.equal(result.ticketAwarded, 1);
    assert.deepEqual(await service.execute('123', 'atomic_log_0001', input, monday + DAY), result);
    assert.equal((await healthy.read('123')).state.tickets, 1);
  } finally {
    await mf.dispose();
  }
});

test('two clients and a competing account reward cannot mint or overwrite a habit ticket twice', async () => {
  const { mf, db, store, service, healthy } = await fixture();
  try {
    const created = await service.execute(
      '123',
      'race_create001',
      { operation: 'create', definition },
      monday,
    );
    const data = await store.today('123', monday + DAY);
    const input = {
      operation: 'log',
      habitId: created.habitId,
      day: data.day.day,
      version: 1,
      logVersion: 0,
      value: 20,
    };
    const results = await Promise.allSettled(
      ['race_log_0001', 'race_log_0002'].map((id) =>
        service.execute('123', id, input, monday + DAY),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const bonus = () =>
      healthy.mutate('123', 'parallel_bonus', 'fixture', {}, monday + DAY, (s) => ({
        state: { ...s, tickets: s.tickets + 2, qi: 17 },
        result: { ok: true },
      }));
    await bonus();
    const next = monday + 2 * DAY,
      day = (await store.today('123', next)).day.day;
    const nextInput = { ...input, day, logVersion: 0 };
    const extra = () =>
      healthy.mutate('123', 'parallel_again', 'fixture', {}, next, (s) => ({
        state: { ...s, tickets: s.tickets + 2 },
        result: { ok: true },
      }));
    const log = () => service.execute('123', 'next_day_race01', nextInput, next);
    await Promise.allSettled([extra(), log()]);
    await extra();
    await log();
    const account = await healthy.read('123');
    assert.equal(account.state.tickets, 6);
    assert.equal(account.state.qi, 17);
    assert.equal(
      (await db.prepare('SELECT COUNT(*) AS n FROM habit_ticket_awards').first<{ n: number }>())!.n,
      2,
    );
  } finally {
    await mf.dispose();
  }
});

test('draw x10 is atomic, validates count and replays identical results after settings or account change', async () => {
  const { mf, db, healthy } = await fixture();
  try {
    const context = {
      env: { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'fixture' } as Env,
      owner: '123',
      now: monday,
      healthy,
    };
    const call = (input: Record<string, unknown> & { id: string }) =>
      handleCultivation(context, input);
    await healthy.mutate('123', 'seed_draw_0001', 'fixture', {}, monday, (s) => ({
      state: { ...s, tickets: 9 },
      result: {},
    }));
    const input = { id: 'draw_batch_001', operation: 'draw', count: 10 };
    await assert.rejects(call(input), /NO_TICKETS/);
    assert.equal((await healthy.read('123')).state.tickets, 9);
    assert.equal(
      await db
        .prepare("SELECT 1 FROM cultivation_receipts WHERE request_id='draw_batch_001'")
        .first(),
      null,
    );
    for (const count of [0, 2, 11, -1, 1.5, '10', null, {}])
      assert.equal((await call({ id: 'invalid_draw01', operation: 'draw', count })).status, 400);
    assert.equal(
      (await call({ id: 'invalid_check1', operation: 'checkin', count: 10 })).status,
      400,
    );
    assert.equal(
      (await call({ id: 'invalid_item01', operation: 'draw', count: 10, item: 'basic' })).status,
      400,
    );
    await healthy.mutate('123', 'seed_draw_0002', 'fixture', {}, monday, (s) => ({
      state: { ...s, tickets: 15 },
      result: {},
    }));
    const response = await call(input),
      saved = (await response.json()) as any;
    assert.equal(response.status, 200);
    assert.equal(saved.result.rewards.length, 10);
    assert.equal(saved.result.count, 10);
    assert.equal(saved.account.state.tickets, 5);
    const inventory = Object.values(saved.account.state.inventory) as number[];
    const qiCount = saved.result.rewards.filter(
      (key: string) => key === 'qi1' || key === 'qi2',
    ).length;
    assert.equal(inventory.reduce((sum, n) => sum + n, 0) + qiCount, 10);
    await healthy.mutate('123', 'suspend_draw01', 'fixture', {}, monday, (s) => ({
      state: { ...s, suspended: true },
      result: {},
    }));
    await db.prepare("UPDATE schedule_settings SET sleep_minutes=NULL WHERE owner='123'").run();
    const replay = (await (await call(input)).json()) as any;
    assert.deepEqual(replay.result, saved.result);
    assert.equal(replay.account.state.tickets, 5);
    await assert.rejects(call({ ...input, count: 1 }), /REQUEST_ID_REUSED/);
    assert.equal((await healthy.read('456')).state.tickets, 0);
  } finally {
    await mf.dispose();
  }
});

test('two competing x10 requests spend only one batch and the committed receipt can be recovered', async () => {
  const { mf, db, healthy } = await fixture();
  try {
    const context = {
      env: { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'fixture' } as Env,
      owner: '123',
      now: monday,
      healthy,
    };
    await healthy.mutate('123', 'seed_draw_race1', 'fixture', {}, monday, (s) => ({
      state: { ...s, tickets: 10 },
      result: {},
    }));
    const inputs = ['draw_race_0001', 'draw_race_0002'].map((id) => ({
      id,
      operation: 'draw',
      count: 10,
    }));
    const results = await Promise.allSettled(
      inputs.map((input) => handleCultivation(context, input)),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await healthy.read('123')).state.tickets, 0);
    const winner = results.findIndex((r) => r.status === 'fulfilled');
    const saved = (await (results[winner] as PromiseFulfilledResult<Response>).value.json()) as any;
    assert.equal(saved.result.rewards.length, 10);
    const replay = (await (await handleCultivation(context, inputs[winner]!)).json()) as any;
    assert.deepEqual(replay.result, saved.result);
    await assert.rejects(handleCultivation(context, inputs[1 - winner]!), /NO_TICKETS/);
    const receipts = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM cultivation_receipts WHERE owner='123' AND operation='draw'",
      )
      .first<{ n: number }>();
    assert.equal(receipts!.n, 1);
  } finally {
    await mf.dispose();
  }
});
