import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { sqliteDatabase } from './benchmark-habit-runtime.ts';
import { HealthyStore } from '../src/adapters/d1/healthy-store.ts';
import { ScheduleStore } from '../src/adapters/d1/schedule-store.ts';
import { D1BeastStore } from '../src/adapters/d1/linh-thu-store.ts';
import { readBeasts } from '../src/entrypoints/mini-app/linh-thu.ts';
import { initialBeastAccount } from '../src/domain/linh-thu-account.ts';
import { runScheduled } from '../src/entrypoints/worker-scheduler.ts';
import { D1HabitStore } from '../src/adapters/d1/habit-store.ts';
import { HabitService } from '../src/application/habit-service.ts';
import { BeastSettlementService } from '../src/application/linh-thu-settlement.ts';
import { BeastUltimateService } from '../src/application/linh-thu-ultimates.ts';
import { beginBeastTower } from '../src/domain/linh-thu-tower.ts';
import { beastCalendarWeek } from '../src/domain/linh-thu-ultimates.ts';
import { settleOneCombinedBeastDay } from '../src/adapters/d1/linh-thu-maintenance.ts';

const now = Date.parse('2026-10-19T10:00:00+07:00');
const metrics: unknown[] = [];
for (const individuals of [24, 2400]) {
  const raw = new DatabaseSync(':memory:');
  let queries = 0;
  const db = sqliteDatabase(raw, () => {
    queries++;
  });
  try {
    for (const file of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort())
      raw.exec(readFileSync('migrations/' + file, 'utf8'));
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, now);
    const healthy = new HealthyStore(db),
      store = new D1BeastStore(db);
    await healthy.read('123');
    await store.initialize('123', 20745, now);
    // Retain the legacy runtime benchmark; v2 has its own runtime benchmark.
    raw.exec("UPDATE beast_v2_runtime SET cutover_day=1000000 WHERE owner='123'");
    raw.exec('BEGIN');
    for (let i = 0; i < individuals; i++) {
      raw
        .prepare(
          "INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES('123',?,'frostnip',?,?,?)",
        )
        .run('beast_perf_' + i, 'a_' + i, now + i, 'fixture');
      raw
        .prepare(
          "INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,created) VALUES('123',?,?,1,1,'ready',1200,'[200,500,800]',?)",
        )
        .run('a_' + i, 'beast_perf_' + i, now + i);
    }
    raw.exec('COMMIT');
    const context = {
      env: {
        DB: db,
        TELEGRAM_USER_ID: '123',
        TELEGRAM_BOT_TOKEN: 'fixture',
        TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      },
      owner: '123',
      now,
      healthy,
    };
    for (const path of [
      'linh-thu',
      'linh-thu/collection',
      'linh-thu/collection?species=frostnip',
      'linh-thu/tower',
      'linh-thu-backlog',
      'linh-thu-combined',
      'linh-thu-after',
    ]) {
      if (path.endsWith('backlog')) {
        context.now += 86400000;
        await new ScheduleStore(db).ensureDay('123', context.now);
        raw
          .prepare("INSERT INTO beast_roles VALUES('123','companion',20745,'beast_perf_0','a_0',?)")
          .run(now);
        raw
          .prepare(
            "INSERT INTO sleep_assessments(owner,day,target,reported_at,result,qi_delta,demoted,assessed_at) VALUES('123',20745,?,?,'on_time',5,0,?)",
          )
          .run(now + 13 * 3600000, now + 13 * 3600000, context.now);
      }
      queries = 0;
      const start = performance.now();
      const response = await readBeasts(
        context,
        new URL('https://local/api/' + (path.startsWith('linh-thu-') ? 'linh-thu' : path)),
      );
      const body = await response.text();
      const metric = {
        individuals,
        path,
        queries,
        bytes: Buffer.byteLength(body),
        localWallMs: Number((performance.now() - start).toFixed(3)),
      };
      metrics.push(metric);
      assert.equal(response.status, 200);
      assert.ok(queries <= 50, JSON.stringify(metric));
      assert.ok(metric.bytes < 40000, JSON.stringify(metric));
      if (path.includes('/collection')) assert.equal(JSON.parse(body).beasts.length, 24);
      if (path === 'linh-thu') {
        assert.equal(JSON.parse(body).collectionOverview.frostnip.count, individuals);
        assert.equal(Object.keys(JSON.parse(body).collectionOverview).length, 1);
      }
    }
    for (const path of ['overview', 'species-next-page']) {
      const first = await store.collection('123', null, 24, 'frostnip');
      queries = 0;
      const start = performance.now();
      const result =
        path === 'overview'
          ? await store.collectionOverview('123')
          : await store.collection('123', first.nextCursor, 24, 'frostnip');
      const metric = {
        individuals,
        path,
        queries,
        bytes: Buffer.byteLength(JSON.stringify(result)),
        localWallMs: Number((performance.now() - start).toFixed(3)),
      };
      metrics.push(metric);
      assert.equal(queries, 1);
      assert.ok(metric.bytes < 40000);
      if (path === 'species-next-page' && individuals > 24) {
        assert.ok(Array.isArray(result.beasts));
        assert.equal(
          new Set([...first.beasts, ...result.beasts].map((beast) => beast.id)).size,
          48,
        );
      }
    }
    assert.deepEqual((await store.read('123')).state, initialBeastAccount());
    const firstMinute = Math.floor(context.now / 60000);
    for (let job = 0; job < 4; job++) {
      let minute = firstMinute;
      while (
        minute % 4 !== 3 ||
        Math.floor(minute / 4) % 3 !== 2 ||
        Math.floor(minute / 12) % 4 !== job
      )
        minute++;
      const at = minute * 60000;
      queries = 0;
      const start = performance.now();
      await runScheduled(
        { ...context.env, AI_MODE: 'off', ASSETS: { fetch: async () => new Response('fixture') } },
        {
          cardsEnabled: false,
          clock: { now: () => at },
          chat: undefined,
          flushCards: async () => {},
          transport: async () => {
            throw Error('Benchmark must not send any message');
          },
        },
      );
      const metric = {
        individuals,
        path: 'cron-beast-job-' + job,
        queries,
        localWallMs: Number((performance.now() - start).toFixed(3)),
      };
      metrics.push(metric);
      assert.ok(queries <= 50, JSON.stringify(metric));
    }
  } finally {
    raw.close();
  }
}

// Active work is measured separately from idle polling. Each scenario has its
// own database so one cron job cannot consume another scenario's pending work.
for (const [job, pendingSleep] of [
  [0, false],
  [1, false],
  [2, false],
  [3, false],
  [1, true],
] as const) {
  const raw = new DatabaseSync(':memory:');
  let queries = 0;
  const db = sqliteDatabase(raw, () => {
    queries++;
  });
  try {
    for (const file of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort())
      raw.exec(readFileSync('migrations/' + file, 'utf8'));
    raw.exec('PRAGMA foreign_keys=ON');
    const day = 20745,
      DAY = 86400000,
      schedule = new ScheduleStore(db),
      healthy = new HealthyStore(db),
      store = new D1BeastStore(db),
      habits = new D1HabitStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now - DAY);
    await store.initialize('123', day, now);
    raw.exec("UPDATE beast_v2_runtime SET cutover_day=1000000 WHERE owner='123'");
    await healthy.read('123');
    for (let index = 0; index < 30; index++)
      await new HabitService(habits).execute(
        '123',
        'active_habit_' + index,
        {
          operation: 'create',
          definition: {
            name: 'Active habit ' + index,
            metric: 'check',
            target: 1,
            cadence: { kind: 'daily' },
          },
        },
        now - DAY,
      );
    const species = job === 3 ? 'rubblet' : 'funglet';
    await store.transact(
      '123',
      'active_beast_seed',
      'fixture',
      {},
      day,
      now,
      (await store.read('123')).version,
      (account, wallet) => ({
        state: account.state,
        healthy: wallet,
        result: {},
        newBeasts: [
          { id: 'active_companion', attemptId: 'active_attempt', speciesId: species },
          { id: 'active_training', attemptId: 'active_training_attempt', speciesId: 'frostnip' },
        ],
      }),
    );
    raw
      .prepare(
        "UPDATE beast_attempts SET earned=capacity,form=4,status='completed' WHERE id='active_attempt'",
      )
      .run();
    raw
      .prepare("UPDATE beast_attempts SET status='training' WHERE id='active_training_attempt'")
      .run();
    raw
      .prepare(
        "INSERT INTO beast_roles VALUES('123','companion',?,'active_companion','active_attempt',?)",
      )
      .run(day, now);
    raw
      .prepare(
        "INSERT INTO beast_roles VALUES('123','training',?,'active_training','active_training_attempt',?)",
      )
      .run(day, now);
    const dayWindow = (await schedule.ensureDay('123', now))!;
    await new BeastUltimateService(store).execute(
      '123',
      'active_ultimate',
      {
        operation: 'ultimate',
        beastId: 'active_companion',
        day,
        version: (await store.read('123')).version,
      },
      day,
      now,
      dayWindow.end_at,
    );
    const today = await habits.today('123', now);
    raw.exec('BEGIN');
    for (const entry of today.habits)
      raw
        .prepare(
          "INSERT INTO habit_logs(owner,habit_id,day,value,note,updated) VALUES('123',?, ?,100,'',?)",
        )
        .run(entry.habit.id, day, now);
    raw.exec('COMMIT');
    if (!pendingSleep) await schedule.reportSleep('123', now + 13 * 3600000, 'active_sleep');
    await habits.settle('123', now + DAY, 30);
    await habits.settle('123', now + DAY, 30);
    if (job === 0) {
      const tower = {
        ...beginBeastTower(day, false, () => 0),
        floor: 3,
        cleared: 3,
        status: 'decision',
      };
      raw
        .prepare("INSERT INTO beast_tower_runs VALUES('123',?,1,?,'{}',?,?,?)")
        .run(day, JSON.stringify(tower), dayWindow.end_at, now, now);
    }
    if (job === 2 || job === 3)
      await new BeastSettlementService(store, () => 0).settle('123', now + DAY);
    if (job === 3)
      assert.equal(await settleOneCombinedBeastDay(db, '123', now + DAY, () => 0), true);
    if (job === 3) {
      for (let offset = 1; offset < 7; offset++) {
        await schedule.reportSleep(
          '123',
          now + offset * DAY + 13 * 3600000,
          'active_sleep_' + offset,
        );
        await habits.settle('123', now + (offset + 1) * DAY, 30);
        await new BeastSettlementService(store, () => 0).settle('123', now + (offset + 1) * DAY);
        await settleOneCombinedBeastDay(db, '123', now + (offset + 1) * DAY, () => 0);
      }
    }
    let minute = Math.floor((now + (job === 3 ? 7 : 1) * DAY) / 60000);
    while (
      minute % 4 !== 3 ||
      Math.floor(minute / 4) % 3 !== 2 ||
      Math.floor(minute / 12) % 4 !== job
    )
      minute++;
    const at = minute * 60000;
    if (!pendingSleep) await schedule.ensureDay('123', at);
    queries = 0;
    const start = performance.now();
    const env = {
      DB: db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_BOT_TOKEN: 'fixture',
      TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      AI_MODE: 'off',
      ASSETS: { fetch: async () => new Response('fixture') },
    };
    const deps = {
      cardsEnabled: false,
      clock: { now: () => at },
      chat: undefined,
      flushCards: async () => {},
      transport: async () => {
        throw Error('Benchmark must not send any message');
      },
    };
    await runScheduled(env, deps);
    const metric = {
      path: 'cron-active-beast-job-' + job + (pendingSleep ? '-pending-sleep' : ''),
      habits: 30,
      queries,
      localWallMs: Number((performance.now() - start).toFixed(3)),
    };
    metrics.push(metric);
    console.log(JSON.stringify(metric));
    assert.ok(queries <= 50, JSON.stringify(metric));
    if (job === 0) {
      assert.equal((await store.read('123')).state.summonTickets, 0);
      const expired = await store.tower('123', day);
      assert.equal(expired!.state.status, 'expired');
    }
    if (pendingSleep) {
      assert.equal(
        (await store.individual('123', 'active_training'))!.attempt.earned,
        0,
        'Sleep work defers the second maintenance transaction',
      );
      let resumed = false;
      for (let retry = 1; retry <= 3; retry++) {
        const retryAt = at + retry * 48 * 60000;
        queries = 0;
        await runScheduled(env, { ...deps, clock: { now: () => retryAt } });
        const resume = { path: 'cron-active-pending-sleep-resume-' + retry, habits: 30, queries };
        metrics.push(resume);
        assert.ok(queries <= 50, JSON.stringify(resume));
        if ((await store.individual('123', 'active_training'))!.attempt.earned === 16) {
          resumed = true;
          break;
        }
      }
      assert.ok(resumed, 'Deferred training must run after closed sleep days are processed');
      assert.ok(
        raw.prepare("SELECT day FROM sleep_assessments WHERE owner='123' AND day=?").get(day),
      );
    }
    if (job === 1)
      assert.equal((await store.individual('123', 'active_training'))!.attempt.earned, 16);
    if (job === 2)
      assert.equal(
        raw.prepare("SELECT COUNT(*) AS n FROM beast_skill_events WHERE kind='combined'").get()!.n,
        1,
      );
    if (job === 3)
      assert.equal((await store.ultimate('123', beastCalendarWeek(now)))!.settled, true);
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    raw.close();
  }
}
const report = {
  kind: 'Local Node/SQLite diagnostic; excludes remote D1 and network latency',
  metrics,
};
mkdirSync('trial-results/linh-thu', { recursive: true });
writeFileSync('trial-results/linh-thu/performance.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
