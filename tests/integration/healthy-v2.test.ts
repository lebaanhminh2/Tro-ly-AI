import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { initialBeastAccount } from '../../src/domain/linh-thu-account.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../../src/domain/linh-thu-catalog.ts';
import { initialHealthy, operatingDay, type HealthyState } from '../../src/domain/healthy.ts';
import { runScheduled } from '../../src/entrypoints/worker-scheduler.ts';
import { prepareCultivationDraw } from '../../src/adapters/d1/linh-thu-draw.ts';

const now = Date.parse('2026-10-22T10:00:00+07:00');
async function fixture(speciesId = 'pyropup', multiplier = 3) {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort())
    raw.exec(readFileSync('migrations/' + file, 'utf8'));
  raw.exec('PRAGMA foreign_keys=ON');
  let queries = 0;
  const db = sqliteDatabase(raw, () => {
      queries += 1;
    }),
    schedule = new ScheduleStore(db),
    healthy = new HealthyStore(db);
  await schedule.configure('123', '04:30', '22:30', 0, now);
  const sourceDay = (await schedule.ensureDay('123', now))!;
  const rule = BEAST_TRAINING[beastSpecies(speciesId).rank];
  const attempt = {
    speciesId,
    ruleVersion: 1,
    status: 'completed',
    form: 4,
    earned: rule.capacity,
    gray: 0,
  };
  raw
    .prepare(
      'INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES(?,?,?,0,0)',
    )
    .run('123', JSON.stringify(initialBeastAccount()), sourceDay.day - 40);
  raw
    .prepare(
      'INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES(?,?,?,?,0,?)',
    )
    .run('123', 'beast', speciesId, 'attempt', 'seed');
  raw
    .prepare(
      "INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,earned,capacity,thresholds_json,form,created) VALUES('123','attempt','beast',1,2,'completed',?,?,?,4,0)",
    )
    .run(rule.capacity, rule.capacity, JSON.stringify(rule.thresholds));
  raw
    .prepare(
      "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,'beast','attempt',0)",
    )
    .run(sourceDay.day - 1);
  raw
    .prepare(
      "INSERT INTO beast_v2_runtime(owner,cutover_day,last_day,sleep_streak,updated) VALUES('123',?,?,30,0)",
    )
    .run(sourceDay.day - 1, sourceDay.day - 1);
  raw.prepare("INSERT INTO beast_v2_days(owner,day,snapshot_json,updated) VALUES('123',?,?,0)").run(
    sourceDay.day,
    JSON.stringify({
      multiplier,
      startSleepStreak: 30,
      beastId: 'beast',
      attemptId: 'attempt',
      attempt,
    }),
  );
  const seedWallet = async (patch: Partial<HealthyState>) =>
    healthy.mutate('123', 'seed_wallet', 'fixture', {}, now, (state) => ({
      state: { ...state, ...patch },
      result: {},
    }));
  return {
    raw,
    db,
    healthy,
    schedule,
    day: sourceDay,
    seedWallet,
    resetQueries: () => {
      queries = 0;
    },
    queryCount: () => queries,
  };
}

test('paid summon-ticket loot credits the real beast wallet atomically in legacy, unaccompanied v2 and companion v2 draws', async () => {
  for (const mode of ['legacy-new', 'legacy-existing', 'v2-alone', 'v2-companion', 'v2-triple']) {
    const f = await fixture('pyropup', mode === 'v2-triple' ? 3 : 1);
    try {
      if (mode.startsWith('legacy')) {
        f.raw.exec(
          'BEGIN; PRAGMA defer_foreign_keys=ON; DELETE FROM beast_v2_states; DELETE FROM beast_v2_buffs; DELETE FROM beast_v2_days; DELETE FROM beast_v2_runtime; DELETE FROM beast_roles; DELETE FROM beast_attempts; DELETE FROM beasts; COMMIT;',
        );
        if (mode === 'legacy-new')
          f.raw.exec('DELETE FROM beast_number_counters; DELETE FROM beast_accounts');
      } else if (mode === 'v2-alone') {
        f.raw.exec('DELETE FROM beast_roles');
        f.raw
          .prepare(
            "UPDATE beast_v2_days SET snapshot_json=json_set(snapshot_json,'$.beastId',NULL,'$.attemptId',NULL,'$.attempt',NULL)",
          )
          .run();
      }
      await f.seedWallet({ tickets: 12 });
      const draw = () =>
        f.healthy.mutateWithAccount(
          '123',
          'summon_loot_tx',
          'draw',
          { count: 10 },
          now,
          async (state) => {
            const prepared = await prepareCultivationDraw(
              f.db,
              '123',
              'summon_loot_tx',
              f.day.day,
              now,
              10,
              () => 0.997,
            );
            return prepared.apply!(state);
          },
        );
      f.raw.exec(
        "CREATE TRIGGER loot_abort BEFORE INSERT ON cultivation_receipts WHEN NEW.request_id='summon_loot_tx' BEGIN SELECT RAISE(ABORT,'test abort'); END",
      );
      await assert.rejects(draw());
      assert.equal((await f.healthy.read('123')).state.tickets, 12);
      const balance = () =>
        JSON.parse(
          String(
            f.raw.prepare("SELECT state_json FROM beast_accounts WHERE owner='123'").get()
              ?.state_json ?? '{"summonTickets":0}',
          ),
        ).summonTickets;
      assert.equal(balance(), 0);
      f.raw.exec('DROP TRIGGER loot_abort');
      const result = await draw();
      assert.deepEqual(
        (result.result as { rewards: string[] }).rewards,
        Array(10).fill('summonTicket'),
      );
      assert.equal((await f.healthy.read('123')).state.tickets, 2);
      assert.equal(balance(), mode === 'v2-triple' ? 30 : 10, mode);
      assert.deepEqual(await draw(), result);
      assert.equal(balance(), mode === 'v2-triple' ? 30 : 10);
      assert.equal((await f.healthy.read('123')).state.tickets, 2);
      assert.ok(!('summonTicket' in (await f.healthy.read('123')).state.inventory));
    } finally {
      f.raw.close();
    }
  }
});

test('v2 checkin credits base reward exactly three times, persists actual reward and replays unchanged', async () => {
  const f = await fixture();
  try {
    const result = await f.healthy.checkIn('123', 'checkin', {}, now);
    assert.equal(result.dailyReward.qi, 3);
    const wallet = await f.healthy.read('123');
    assert.equal(wallet.state.qi, 3);
    assert.equal(wallet.state.earned, 3);
    const saved = JSON.parse(
      String(
        f.raw.prepare("SELECT reward_json FROM daily_checkins WHERE owner='123'").get()!
          .reward_json,
      ),
    );
    assert.equal(saved.qi, 3);
    assert.deepEqual(await f.healthy.checkIn('123', 'checkin', {}, now + 86400000), result);
    assert.deepEqual(await f.healthy.read('123'), wallet);
    assert.equal(
      f.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM beast_skill_events WHERE owner='123' AND kind='v2:reward'",
        )
        .get()!.n,
      1,
    );
  } finally {
    f.raw.close();
  }
});

test('v2 checkin multiplies tickets and inventory once while calendar progress advances only one day', async () => {
  const f = await fixture();
  try {
    const calendarDay = operatingDay(now, 0);
    await f.seedWallet({
      checkin: { cycleStartDay: calendarDay - 6, lastDay: calendarDay - 1, count: 6 },
    });
    const result = await f.healthy.checkIn('123', 'seventh_checkin', {}, now);
    assert.equal(result.dailyReward.day, 7);
    assert.equal(result.dailyReward.tickets, 6);
    assert.equal(result.dailyReward.items.basic, 9);
    const state = (await f.healthy.read('123')).state;
    assert.equal(state.tickets, 6);
    assert.equal(state.inventory.basic, 9);
    assert.equal(state.checkin!.count, 7);
  } finally {
    f.raw.close();
  }
});

test('v2 sleep reports use immutable multiplier and undo preserves exact base award without rerolling skills', async () => {
  const f = await fixture();
  try {
    await f.seedWallet({ qi: 40, earned: 40, streak: 30 });
    const reportAt = Date.parse('2026-10-22T21:00:00+07:00');
    const first = await f.schedule.reportSleep('123', reportAt, 'report1');
    assert.equal(first.delta, 15);
    assert.equal((await f.healthy.read('123')).state.qi, 55);
    await f.schedule.undoSleep('123', reportAt + 1000, 'undo1', first.generation!);
    assert.equal((await f.healthy.read('123')).state.qi, 40);
    const second = await f.schedule.reportSleep('123', reportAt + 2000, 'report2');
    assert.equal(second.delta, 15);
    assert.equal((await f.healthy.read('123')).state.qi, 55);
    assert.equal(
      f.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM beast_skill_events WHERE owner='123' AND kind='v2:source_sleep'",
        )
        .get()!.n,
      1,
    );
  } finally {
    f.raw.close();
  }
});

test('v2 late sleep keeps tripled penalty after chain break and clamps before demotion', async () => {
  const f = await fixture();
  try {
    await f.seedWallet({ qi: 50, earned: 50, rank: 1, streak: 30 });
    const outcome = await f.healthy.score('123', {
      day: f.day.day,
      target: f.day.target_sleep,
      end: f.day.end_at,
      reportedAt: null,
      chatActive: false,
      assessedAt: f.day.end_at,
    });
    assert.equal(outcome.delta, -50);
    assert.equal(outcome.demoted, true);
    assert.equal((await f.healthy.read('123')).state.streak, 0);
    assert.equal((await f.healthy.read('123')).state.qi, 0);
  } finally {
    f.raw.close();
  }
});

test('v2 habit completion returns actual multiplied ticket amount and repeated log cannot pay twice', async () => {
  const f = await fixture();
  try {
    const store = new D1HabitStore(f.db),
      service = new HabitService(store);
    const created = await service.execute(
      '123',
      'habit_create',
      {
        operation: 'create',
        definition: { name: 'Read', metric: 'check', target: 1, cadence: { kind: 'daily' } },
      },
      now,
    );
    // Existing committed habit, not a new habit whose commitment starts tomorrow.
    f.raw
      .prepare(
        "UPDATE habit_revisions SET definition_json=json_set(definition_json,'$.commitmentFrom',?) WHERE owner='123' AND habit_id=?",
      )
      .run(f.day.day, created.habitId);
    const today = await store.today('123', now);
    const view = today.habits.find((entry) => entry.habit.id === created.habitId)!;
    const input = {
      operation: 'log',
      habitId: view.habit.id,
      day: today.day.day,
      version: view.habit.version,
      logVersion: view.log.version,
      value: 1,
    };
    const result = await service.execute('123', 'habit_log', input, now + 1);
    assert.equal(result.ticketAwarded, 3);
    assert.equal((await f.healthy.read('123')).state.tickets, 3);
    assert.deepEqual(await service.execute('123', 'habit_log', input, now + 2), result);
    assert.equal((await f.healthy.read('123')).state.tickets, 3);
  } finally {
    f.raw.close();
  }
});

test('v2 canonical task recovery preserves completion time, applies automatic skills past cap and replays receipts', async () => {
  const f = await fixture('cheerling', 1);
  try {
    for (let n = 1; n <= 9; n += 1) {
      const id = 'task_' + n;
      f.raw
        .prepare("INSERT INTO tasks(id,owner,title,status,created) VALUES(?,'123',?,'completed',?)")
        .run(id, id, now + n);
      f.raw
        .prepare("INSERT INTO task_completions(owner,task_id,completed_at) VALUES('123',?,?)")
        .run(id, now + n);
    }
    for (let n = 0; n < 9; n += 1) {
      f.resetQueries();
      await f.healthy.syncTaskTickets('123', now + 100 + n);
      assert.ok(f.queryCount() <= 50, `one v2 recovery used ${f.queryCount()} database queries`);
      assert.equal(
        f.raw.prepare("SELECT COUNT(*) AS n FROM task_ticket_awards WHERE owner='123'").get()!.n,
        n + 1,
      );
    }
    const wallet = await f.healthy.read('123');
    assert.ok(
      wallet.state.tickets >= 12 && wallet.state.tickets <= 17,
      'nine base plus3 third-task plus0..5 talents',
    );
    const beasts = JSON.parse(
      String(
        f.raw.prepare("SELECT state_json FROM beast_accounts WHERE owner='123'").get()!.state_json,
      ),
    );
    assert.equal(beasts.summonTickets, 1);
    assert.equal(
      f.raw
        .prepare("SELECT task_count FROM beast_v2_days WHERE owner='123' AND day=?")
        .get(f.day.day)!.task_count,
      9,
    );
    assert.equal(
      f.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM beast_skill_events WHERE owner='123' AND kind='v2:task'",
        )
        .get()!.n,
      9,
    );
    await f.healthy.syncTaskTickets('123', now + 86400000);
    assert.deepEqual(await f.healthy.read('123'), wallet);
    const replay = await f.healthy.awardTask('123', 'task_8', now + 86400000);
    assert.equal(replay.ticket, 1);
    assert.deepEqual(await f.healthy.read('123'), wallet);
    assert.deepEqual(f.raw.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    f.raw.close();
  }
});

test('v2 task base ticket and skill earned qi multiply once while source timestamps remain original', async () => {
  const f = await fixture();
  try {
    f.raw
      .prepare(
        "INSERT INTO tasks(id,owner,title,status,created) VALUES('late_task','123','Late','completed',?)",
      )
      .run(now);
    f.raw
      .prepare(
        "INSERT INTO task_completions(owner,task_id,completed_at) VALUES('123','late_task',?)",
      )
      .run(now);
    const outcome = await f.healthy.awardTask('123', 'late_task', now + 86400000);
    assert.equal(outcome.ticket, 3);
    const wallet = (await f.healthy.read('123')).state;
    assert.equal(wallet.qi, 9);
    assert.ok(wallet.tickets === 3 || wallet.tickets === 9);
    const source = f.raw
      .prepare(
        "SELECT day,result_json FROM beast_skill_events WHERE owner='123' AND kind='v2:task'",
      )
      .get()!;
    assert.equal(source.day, f.day.day);
    assert.equal(
      f.raw.prepare("SELECT created FROM task_ticket_awards WHERE owner='123'").get()!.created,
      now,
    );
    const saved = JSON.parse(String(source.result_json));
    assert.equal(saved.baseReward.qi, 3);
    assert.equal(saved.reward.qi, 9);
    assert.equal(saved.multiplier, 3);
  } finally {
    f.raw.close();
  }
});

test('v2 whole worker recovery stays under fifty queries and progresses one source on every maintenance slot', async (t) => {
  const f = await fixture('cheerling', 1);
  try {
    for (let n = 0; n < 3; n += 1) {
      const id = 'worker_' + n;
      f.raw
        .prepare("INSERT INTO tasks(id,owner,title,status,created) VALUES(?,'123',?,'completed',?)")
        .run(id, id, now + n);
      f.raw
        .prepare("INSERT INTO task_completions(owner,task_id,completed_at) VALUES('123',?,?)")
        .run(id, now + n);
    }
    let clockNow = now + 3 * 60000;
    const env = {
      DB: f.db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      TELEGRAM_BOT_TOKEN: '123:fake',
      DELIVERY_MODE: 'outbox' as const,
      ASSETS: { fetch: async () => new Response('fixture') },
    };
    const deps = {
      cardsEnabled: false,
      transport: (async () =>
        Response.json({ ok: true, result: { message_id: 1 } })) as typeof fetch,
      clock: { now: () => clockNow },
      chat: undefined,
      flushCards: async () => {},
    };
    for (let pass = 1; pass <= 3; pass += 1) {
      f.resetQueries();
      await runScheduled(env, deps);
      const count = f.queryCount();
      t.diagnostic(`v2 task maintenance invocation ${pass}: ${count} queries`);
      assert.ok(count <= 50, `whole worker used ${count} queries`);
      assert.equal(
        f.raw.prepare("SELECT COUNT(*) AS n FROM task_ticket_awards WHERE owner='123'").get()!.n,
        pass,
      );
      clockNow += 12 * 60000;
    }
  } finally {
    f.raw.close();
  }
});

test('v2 paid x10 refuses insufficient original tickets before any loot or pity random sample', async () => {
  const f = await fixture('skinklet', 1);
  try {
    await f.seedWallet({ tickets: 9 });
    let rolls = 0;
    const prepared = await prepareCultivationDraw(
      f.db,
      '123',
      'cannot_pay',
      f.day.day,
      now,
      10,
      () => {
        rolls += 1;
        return 0;
      },
    );
    await assert.rejects(
      async () => prepared.apply!((await f.healthy.read('123')).state),
      /NO_TICKETS/,
    );
    assert.equal(rolls, 0);
    assert.equal((await f.healthy.read('123')).state.tickets, 9);
    assert.equal(
      f.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM beast_skill_events WHERE owner='123' AND kind='v2:draw'",
        )
        .get()!.n,
      0,
    );
    assert.equal(
      f.raw.prepare("SELECT COUNT(*) AS n FROM beast_v2_states WHERE owner='123'").get()!.n,
      0,
    );
  } finally {
    f.raw.close();
  }
});
