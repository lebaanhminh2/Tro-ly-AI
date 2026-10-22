import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import { initialBeastV2State } from '../../src/domain/linh-thu-v2.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../../src/domain/linh-thu-catalog.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { D1BeastStore } from '../../src/adapters/d1/linh-thu-store.ts';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { handleCultivation } from '../../src/entrypoints/mini-app/cultivation.ts';
import { BeastUltimateService } from '../../src/application/linh-thu-ultimates.ts';
import { BeastRoleService } from '../../src/application/linh-thu-roles.ts';
import { BeastTowerService, type BeastTowerCommand } from '../../src/application/linh-thu-tower.ts';
import { beginBeastTower } from '../../src/domain/linh-thu-tower.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { BeastService } from '../../src/application/linh-thu-service.ts';
import { BeastSettlementService } from '../../src/application/linh-thu-settlement.ts';
import { settleOneBeastV2Day } from '../../src/adapters/d1/linh-thu-v2-daily.ts';
import { runScheduled } from '../../src/entrypoints/worker-scheduler.ts';
import {
  readBeastV2Context,
  readBeastV2SkillProgress,
} from '../../src/adapters/d1/linh-thu-v2-context.ts';
import { readBeasts } from '../../src/entrypoints/mini-app/linh-thu.ts';

const now = Date.parse('2026-10-22T06:30:00+07:00');
const owner = '123';

test('companion meters use real paid task receipts, stay read-only and isolate reset attempts and owners', async () => {
  const f = await fixture('cheerling');
  try {
    for (let index = 1; index <= 3; index++) await f.complete(index, now + index);
    const before = f.raw
      .prepare('SELECT state_json FROM cultivation_accounts WHERE owner=?')
      .get(owner)!.state_json;
    const context = (await readBeastV2Context(f.db, owner, f.today.day, now + 100))!;
    const progress = (await readBeastV2SkillProgress(f.db, context))!;
    assert.equal(progress.items.awakening!.status, 'done');
    assert.equal(progress.items.perfect!.value, 3);
    assert.equal(progress.items.perfect!.status, 'working');
    assert.equal(progress.items.talent_1!.value, 2);
    assert.equal(
      f.raw.prepare('SELECT state_json FROM cultivation_accounts WHERE owner=?').get(owner)!
        .state_json,
      before,
    );
    const response = await readBeasts(
      { ...f.context, now: now + 101 },
      new URL('https://local/api/linh-thu'),
    );
    const body = (await response.json()) as any;
    assert.equal(body.v2.skillProgress.items.awakening.status, 'done');
    assert.equal(
      body.config.skillsV2.cheerling.progress,
      undefined,
      'dynamic UI data is not duplicated for all species',
    );
    // A reset creates a new attempt on the same beast. Old paid events must not
    // label the new attempt as paid, even though its source day is unchanged.
    f.raw
      .prepare(
        "INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,earned,gray,form,created) SELECT owner,'fresh_ui_attempt',beast_id,rule_version,skill_version,status,capacity,thresholds_json,earned,gray,form,? FROM beast_attempts WHERE id='runtime_attempt'",
      )
      .run(now + 500);
    f.raw
      .prepare("UPDATE beasts SET current_attempt_id='fresh_ui_attempt' WHERE owner=?")
      .run(owner);
    f.raw.prepare("UPDATE beast_roles SET attempt_id='fresh_ui_attempt' WHERE owner=?").run(owner);
    const reset = (await readBeastV2Context(f.db, owner, f.today.day, now + 501))!;
    const resetMeter = (await readBeastV2SkillProgress(f.db, reset))!;
    assert.equal(resetMeter.attemptId, 'fresh_ui_attempt');
    assert.equal(resetMeter.items.awakening!.status, 'waiting');
    assert.doesNotMatch(resetMeter.items.awakening!.label, /Đã nhận/);
    assert.equal(await readBeastV2Context(f.db, 'another-owner', f.today.day, now + 502), null);
  } finally {
    f.raw.close();
  }
});

test('actual habit settlement distinguishes no obligations, weekly neutral, missed and achieved before perfect-day rewards', async (t) => {
  for (const mode of ['none', 'weekly-rest', 'missed', 'achieved'] as const) {
    await t.test(mode, async () => {
      const f = await fixture('rubblet');
      try {
        const habits = new D1HabitStore(f.db),
          service = new HabitService(habits);
        if (mode !== 'none') {
          const created = await service.execute(
            owner,
            'v2_obligation_create',
            {
              operation: 'create',
              definition: {
                name: 'Obligation',
                metric: 'check',
                target: 1,
                cadence: mode === 'weekly-rest' ? { kind: 'weekly', quota: 3 } : { kind: 'daily' },
              },
            },
            now,
          );
          // Model a previously committed habit. Creation normally starts later.
          f.raw
            .prepare(
              "UPDATE habit_revisions SET definition_json=json_set(definition_json,'$.commitmentFrom',?) WHERE habit_id=?",
            )
            .run(f.today.day, created.habitId);
          if (mode === 'weekly-rest') {
            const startDay = f.today.day - ((f.today.day + 3) % 7);
            f.raw
              .prepare(
                'INSERT INTO habit_periods(owner,habit_id,start_day,period_json) VALUES(?,?,?,?) ON CONFLICT(owner,habit_id,start_day) DO UPDATE SET period_json=excluded.period_json',
              )
              .run(
                owner,
                created.habitId,
                startDay,
                JSON.stringify({
                  startDay,
                  endDay: startDay + 7,
                  quota: 3,
                  completedDays: [],
                  misses: 0,
                  closedThrough: f.today.day - 1,
                }),
              );
          }
          if (mode === 'achieved')
            await service.execute(
              owner,
              'v2_obligation_log',
              {
                operation: 'log',
                habitId: created.habitId,
                version: 1,
                day: f.today.day,
                logVersion: 0,
                value: 1,
              },
              now + 1,
            );
        }
        await f.complete(1);
        const state = initialBeastV2State();
        state.lastDay = f.today.day - 1;
        state.counters.perfect95 = 6;
        f.raw
          .prepare(
            'INSERT INTO beast_v2_states(owner,attempt_id,state_json) VALUES(?,?,?) ON CONFLICT(owner,attempt_id) DO UPDATE SET state_json=excluded.state_json',
          )
          .run(owner, 'runtime_attempt', JSON.stringify(state));
        await f.schedule.reportSleep(owner, f.today.target_sleep - 1000, 'v2_obligation_sleep');
        const closedAt = f.today.end_at + 1;
        await f.schedule.ensureDay(owner, closedAt);
        await habits.settleBatch(owner, closedAt, 30);
        assert.deepEqual(
          await new BeastSettlementService(f.store, () => 0).settle(owner, closedAt),
          { processed: 1 },
        );
        const settlement = JSON.parse(
          String(f.raw.prepare('SELECT result_json FROM beast_day_settlements').get()!.result_json),
        );
        const qualified = mode !== 'missed';
        assert.deepEqual(settlement.v2Habit, {
          satisfied: qualified,
          rewardEligible: qualified && mode !== 'none',
        });
        assert.equal(settlement.delta.earned, 0, 'completed companion is not a training target');
        assert.equal(await settleOneBeastV2Day(f.db, owner, closedAt, () => 0), true);
        const event = JSON.parse(
          String(
            f.raw.prepare("SELECT result_json FROM beast_skill_events WHERE kind='v2:day'").get()!
              .result_json,
          ),
        );
        assert.equal(event.reward.qi, qualified && mode !== 'none' ? 15 : 10);
        assert.equal(
          event.reward.tickets,
          qualified ? 101 : 0,
          'perfect requires due obligations, not a raw achieved habit row',
        );
        assert.equal(await settleOneBeastV2Day(f.db, owner, closedAt + 1, () => 0), false);
        assert.deepEqual(f.raw.prepare('PRAGMA foreign_key_check').all(), []);
      } finally {
        f.raw.close();
      }
    });
  }
});

async function fixture(speciesId: string) {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort())
    raw.exec(readFileSync('migrations/' + file, 'utf8'));
  const db = sqliteDatabase(raw);
  const schedule = new ScheduleStore(db);
  await schedule.configure(owner, '05:30', '23:15', 0, now);
  const today = (await schedule.ensureDay(owner, now))!;
  const store = new D1BeastStore(db);
  await store.initialize(owner, today.day, now);
  const capacity = BEAST_TRAINING[beastSpecies(speciesId).rank].capacity;
  raw
    .prepare(
      'INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES(?,?,?,?,?,?)',
    )
    .run(owner, 'runtime_beast', speciesId, 'runtime_attempt', now, 'fixture');
  raw
    .prepare(
      `INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,
    capacity,thresholds_json,earned,gray,form,created) VALUES(?,?,?,1,1,'completed',?,'[]',?,0,4,?)`,
    )
    .run(owner, 'runtime_attempt', 'runtime_beast', capacity, capacity, now);
  raw
    .prepare(
      'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
    )
    .run(owner, 'companion', today.day, 'runtime_beast', 'runtime_attempt', now);
  const healthy = new HealthyStore(db);
  const work = new D1WorkStore(db);
  const env = {
    DB: db,
    TELEGRAM_USER_ID: owner,
    TELEGRAM_BOT_TOKEN: 'fixture',
    TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
  };
  const context = { env, owner, now, healthy };
  const complete = async (index: number, at = now) => {
    const created = await work.mutateHierarchy(
      owner,
      'v2_task_create_' + index,
      { operation: 'create', title: 'Task ' + index },
      at,
    );
    const input = { operation: 'complete', taskId: String(created.id), version: 1, complete: true };
    const result = await work.mutateHierarchy(owner, 'v2_task_complete_' + index, input, at);
    return { input, result, requestId: 'v2_task_complete_' + index };
  };
  return { raw, db, schedule, today, store, healthy, work, context, complete };
}

test('first beast mutation creates v2 metadata atomically even without an earlier collection GET', async () => {
  const f = await fixture('humbug');
  try {
    const newOwner = '456';
    await f.schedule.configure(newOwner, '05:30', '23:15', 0, now);
    const today = (await f.schedule.ensureDay(newOwner, now))!;
    await f.healthy.mutate(newOwner, 'v2_first_wallet', 'fixture', {}, now, (state) => ({
      state: { ...state, tickets: 100 },
      result: {},
    }));
    const command = { operation: 'exchange' as const, count: 1, day: today.day, version: 0 };
    const result = await new BeastService(f.store, () => 0).execute(
      newOwner,
      'v2_first_exchange',
      command,
      today.day,
      now,
      today.end_at,
    );
    assert.equal(
      f.raw.prepare('SELECT cutover_day FROM beast_v2_runtime WHERE owner=?').get(newOwner)!
        .cutover_day,
      today.day,
    );
    assert.deepEqual(
      await new BeastService(f.store, () => 0).execute(
        newOwner,
        'v2_first_exchange',
        command,
        today.day,
        now,
        today.end_at,
      ),
      result,
    );
    assert.equal((await f.store.read(newOwner)).state.summonTickets, 1);
  } finally {
    f.raw.close();
  }
});

test('v2 cron alone advances habit training rendezvous and automatic combined rewards without a collection GET', async () => {
  const f = await fixture('funglet');
  try {
    const state = initialBeastV2State();
    state.lastDay = f.today.day - 1;
    state.counters.combined100 = 2;
    f.raw
      .prepare('INSERT INTO beast_v2_states(owner,attempt_id,state_json) VALUES(?,?,?)')
      .run(owner, 'runtime_attempt', JSON.stringify(state));
    await f.schedule.reportSleep(owner, f.today.target_sleep - 1000, 'v2_cron_sleep');
    const next = f.today.end_at + 1000;
    await f.schedule.ensureDay(owner, next);
    let queries = 0;
    const measured = {
      prepare: (sql: string) => {
        queries++;
        return f.db.prepare(sql);
      },
      batch: f.db.batch.bind(f.db),
    };
    let at = next;
    const tick = async (maintenance: number, beastJob?: number) => {
      let minute = Math.ceil(at / 60000);
      while (
        minute % 4 !== 3 ||
        Math.floor(minute / 4) % 3 !== maintenance ||
        (beastJob !== undefined && Math.floor(minute / 12) % 4 !== beastJob)
      )
        minute++;
      at = minute * 60000;
      queries = 0;
      await runScheduled(
        { ...f.context.env, DB: measured, ASSETS: { fetch: async () => new Response('fixture') } },
        {
          cardsEnabled: false,
          clock: { now: () => at },
          chat: undefined,
          flushCards: async () => {},
          transport: async () => Response.json({ ok: true, result: { message_id: 1 } }),
        },
      );
      assert.ok(queries <= 50, 'full cron invocation queries: ' + queries);
      at += 60000;
    };
    await tick(1);
    await tick(2, 1);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_day_settlements').get()!.n, 1);
    await tick(2, 2);
    const event = JSON.parse(
      String(
        f.raw.prepare("SELECT result_json FROM beast_skill_events WHERE kind='v2:day'").get()!
          .result_json,
      ),
    );
    assert.equal(
      event.reward.qi,
      5,
      'combined milestone and daily awakening do not require a task',
    );
    assert.equal(event.reward.tickets, 3);
    const paid = await f.healthy.read(owner);
    await tick(2, 2);
    assert.deepEqual(await f.healthy.read(owner), paid);
  } finally {
    f.raw.close();
  }
});

test('new account initializes v2 immediately, rabbit task eight pays one summon and replay/redo cannot repeat', async () => {
  const f = await fixture('cheerling');
  try {
    assert.equal(
      f.raw.prepare('SELECT cutover_day FROM beast_v2_runtime').get()!.cutover_day,
      f.today.day,
    );
    let eighth: Awaited<ReturnType<typeof f.complete>> | null = null;
    for (let index = 1; index <= 9; index++) {
      const result = await f.complete(index);
      if (index === 8) eighth = result;
    }
    assert.equal((await f.store.read(owner)).state.summonTickets, 1);
    assert.equal(f.raw.prepare('SELECT task_count FROM beast_v2_days').get()!.task_count, 9);
    const before = await f.healthy.read(owner);
    assert.deepEqual(
      await f.work.mutateHierarchy(owner, eighth!.requestId, eighth!.input, now),
      eighth!.result,
    );
    await f.work.mutateHierarchy(
      owner,
      'v2_rabbit_undo',
      { ...eighth!.input, version: 2, complete: false },
      now,
    );
    await f.work.mutateHierarchy(owner, 'v2_rabbit_redo', { ...eighth!.input, version: 3 }, now);
    assert.deepEqual(await f.healthy.read(owner), {
      ...before,
      version: before.version + 2,
    });
    assert.equal((await f.store.read(owner)).state.summonTickets, 1);
    assert.equal(f.raw.prepare('SELECT task_count FROM beast_v2_days').get()!.task_count, 9);
  } finally {
    f.raw.close();
  }
});

test('flameow real task completion continues its perfect combo after task five', async () => {
  const f = await fixture('flameow');
  try {
    for (let index = 1; index <= 5; index++) await f.complete(index);
    const before = (await f.healthy.read(owner)).state;
    for (let index = 6; index <= 8; index++) await f.complete(index);
    const after = (await f.healthy.read(owner)).state;
    assert.equal(
      after.qi - before.qi,
      9,
      'three post-cap tasks each give +3, with no capped talent rolls',
    );
    assert.equal(after.tickets - before.tickets, 3, 'base task ticket remains once per task');
  } finally {
    f.raw.close();
  }
});

test('monkey real two-task milestone grants certain next-day buff and one award per day', async () => {
  const f = await fixture('punchimp');
  try {
    await f.complete(1);
    await f.complete(2);
    await f.complete(3);
    assert.equal((await f.healthy.read(owner)).state.tickets, 6, 'three base tickets +3 Kiên Tâm');
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_v2_buffs').get()!.n, 1);
    const tomorrow = now + 86400000;
    await f.schedule.ensureDay(owner, tomorrow);
    const before = (await f.healthy.read(owner)).state;
    await f.complete(4, tomorrow);
    const after = (await f.healthy.read(owner)).state;
    assert.equal(after.qi - before.qi, 1);
    assert.equal(after.tickets - before.tickets, 2);
  } finally {
    f.raw.close();
  }
});

test('skinklet real x10 API pays guaranteed growing pity once for the bundle and replays unchanged', async () => {
  const f = await fixture('skinklet');
  try {
    await f.healthy.mutate(owner, 'seed_draw_wallet', 'fixture', {}, now, (state) => ({
      state: { ...state, tickets: 100 },
      result: {},
    }));
    const state = initialBeastV2State();
    state.counters.drawMisses = 33;
    f.raw
      .prepare('INSERT INTO beast_v2_states VALUES(?,?,?)')
      .run(owner, 'runtime_attempt', JSON.stringify(state));
    const input = { id: 'v2_real_draw_x10', operation: 'draw', count: 10 };
    const response = await handleCultivation(f.context, input);
    assert.equal(response.status, 200);
    const first = await response.json();
    assert.equal((await f.healthy.read(owner)).state.tickets, 120);
    assert.equal((await f.store.read(owner)).state.summonTickets, 1);
    assert.equal(
      f.raw.prepare("SELECT COUNT(*) AS n FROM beast_skill_events WHERE kind='v2:draw'").get()!.n,
      1,
    );
    assert.equal(
      JSON.parse(String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json))
        .counters.drawMisses,
      0,
    );
    const replay = await handleCultivation(f.context, input);
    assert.deepEqual(await replay.json(), first);
    assert.equal((await f.healthy.read(owner)).state.tickets, 120);
  } finally {
    f.raw.close();
  }
});

test('turtle real breakthrough API adds five chance points before rolling and consumes prepared protection', async () => {
  const f = await fixture('gibber');
  try {
    await f.healthy.mutate(owner, 'seed_breakthrough_wallet', 'fixture', {}, now, (state) => ({
      state: {
        ...state,
        qi: 100,
        earned: 100,
        streak: 20,
        failures: 3,
        inventory: { ...state.inventory, high: 1 },
      },
      result: {},
    }));
    const state = initialBeastV2State();
    state.counters.breakthroughFailures = 3;
    f.raw
      .prepare('INSERT INTO beast_v2_states VALUES(?,?,?)')
      .run(owner, 'runtime_attempt', JSON.stringify(state));
    const input = { id: 'v2_real_breakthrough', operation: 'breakthrough', item: 'high' };
    const response = await handleCultivation(f.context, input);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { result: { success: boolean; chance: number } };
    assert.equal(body.result.chance, 100, 'base65 + failure-pity10 + high-charm20 + skill5');
    assert.equal(body.result.success, true, 'buff applied before roll makes result certain');
    assert.equal(
      JSON.parse(String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json))
        .counters.breakthroughFailures,
      0,
    );
    assert.equal((await f.healthy.read(owner)).state.rank, 1);
  } finally {
    f.raw.close();
  }
});

test('v2 rejects new weekly activation but preserves replay of a committed v1 activation receipt', async () => {
  const f = await fixture('flameow');
  try {
    const service = new BeastUltimateService(f.store);
    const command = {
      operation: 'ultimate' as const,
      day: f.today.day,
      version: (await f.store.read(owner)).version,
      beastId: 'runtime_beast',
    };
    await assert.rejects(
      service.execute(
        owner,
        'v2_reject_manual_ultimate',
        command,
        f.today.day,
        now,
        f.today.end_at,
      ),
      /BEAST_SKILLS_AUTOMATIC/,
    );
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_ultimates').get()!.n, 0);
    const saved = { ultimate: { kind: 'task_combo', remaining: 3 }, compatibility: true };
    f.raw
      .prepare(
        `INSERT INTO cultivation_receipts(owner,request_id,operation,request_json,result_json,created)
      VALUES(?,?,'beast-ultimate',?,?,?)`,
      )
      .run(
        owner,
        'v1_saved_manual_ultimate',
        JSON.stringify(command),
        JSON.stringify(saved),
        now - 1,
      );
    assert.deepEqual(
      await service.execute(
        owner,
        'v1_saved_manual_ultimate',
        command,
        f.today.day,
        now,
        f.today.end_at,
      ),
      saved,
    );
  } finally {
    f.raw.close();
  }
});

test('v2 still resolves an existing paid v1 reward choice once at its saved unmultiplied amount', async () => {
  const f = await fixture('pyropup');
  try {
    f.raw
      .prepare(
        `INSERT INTO beast_choices(owner,id,kind,state_json,created)
      VALUES(?,'v1_paid_choice','reward',?,?)`,
      )
      .run(owner, JSON.stringify({ options: [{ qi: 40, tickets: 5, summonTickets: 1 }] }), now - 1);
    const command = {
      operation: 'choose_reward' as const,
      day: f.today.day,
      version: (await f.store.read(owner)).version,
      choiceId: 'v1_paid_choice',
      option: 0,
    };
    const service = new BeastUltimateService(f.store);
    const result = await service.chooseReward(
      owner,
      'v1_claim_paid_choice',
      command,
      f.today.day,
      now,
      f.today.end_at,
    );
    assert.deepEqual(result.reward, { qi: 40, tickets: 5, summonTickets: 1 });
    assert.equal((await f.healthy.read(owner)).state.qi, 40);
    assert.equal((await f.store.read(owner)).state.summonTickets, 1);
    assert.deepEqual(
      await service.chooseReward(
        owner,
        'v1_claim_paid_choice',
        command,
        f.today.day,
        now,
        f.today.end_at,
      ),
      result,
    );
    assert.equal((await f.healthy.read(owner)).state.qi, 40);
  } finally {
    f.raw.close();
  }
});

test('pyropup real task, checkin and draw sources multiply earned amounts once and leave draw cost unchanged', async () => {
  const f = await fixture('pyropup');
  try {
    for (let offset = 30; offset >= 1; offset--) {
      const at = now - offset * 86400000;
      f.raw
        .prepare(
          `INSERT INTO sleep_assessments(owner,day,target,reported_at,result,qi_delta,demoted,assessed_at)
        VALUES(?,?,?,?,'on_time',5,0,?)`,
        )
        .run(owner, f.today.day - offset, at, at, at);
    }
    await f.complete(1);
    let wallet = (await f.healthy.read(owner)).state;
    assert.equal(wallet.qi, 9, '3 base Liệp Hỏa qi times3, once');
    assert.ok(
      wallet.tickets === 3 || wallet.tickets === 9,
      'base ticket times3, optional 2 Truy Tài tickets also times3',
    );
    assert.equal(
      f.raw
        .prepare("SELECT json_extract(snapshot_json,'$.multiplier') AS m FROM beast_v2_days")
        .get()!.m,
      3,
    );
    const checkin = await handleCultivation(f.context, {
      id: 'v2_pyro_checkin',
      operation: 'checkin',
    });
    assert.equal(checkin.status, 200);
    assert.equal(
      (await f.healthy.read(owner)).state.qi - wallet.qi,
      3,
      'day-one checkin qi1 times3',
    );
    wallet = (await f.healthy.read(owner)).state;
    const draw = await handleCultivation(f.context, {
      id: 'v2_pyro_draw',
      operation: 'draw',
      count: 1,
    });
    assert.equal(draw.status, 200);
    const body = (await draw.json()) as { result: { reward: string } };
    const after = (await f.healthy.read(owner)).state;
    assert.equal(after.tickets, wallet.tickets - 1, 'one ordinary ticket cost is not tripled');
    if (body.result.reward === 'qi1' || body.result.reward === 'qi2')
      assert.equal(after.qi - wallet.qi, body.result.reward === 'qi1' ? 3 : 6);
    else {
      const key = body.result.reward as keyof typeof wallet.inventory;
      assert.equal(after.inventory[key] - wallet.inventory[key], 3, 'one earned draw item times3');
    }
  } finally {
    f.raw.close();
  }
});

test('turtle returning after a companion interruption cannot reuse the previous interval failure protection', async () => {
  const f = await fixture('gibber');
  try {
    f.raw.exec("DELETE FROM beast_roles WHERE owner='123'");
    const insertRole = f.raw.prepare(
      'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
    );
    insertRole.run(
      owner,
      'companion',
      f.today.day - 3,
      'runtime_beast',
      'runtime_attempt',
      now - 3 * 86400000,
    );
    insertRole.run(owner, 'companion', f.today.day - 2, null, null, now - 2 * 86400000);
    insertRole.run(owner, 'companion', f.today.day, 'runtime_beast', 'runtime_attempt', now);
    const state = initialBeastV2State();
    state.counters.breakthroughFailures = 3;
    state.lastDay = f.today.day - 3;
    f.raw
      .prepare('INSERT INTO beast_v2_states VALUES(?,?,?)')
      .run(owner, 'runtime_attempt', JSON.stringify(state));
    f.raw
      .prepare(
        `INSERT INTO beast_skill_events(owner,source_id,kind,day,beast_id,skill_version,result_json,created)
      VALUES(?,'old_turtle_failure','v2:breakthrough',?,'runtime_beast',2,'{}',?)`,
      )
      .run(owner, f.today.day - 3, now - 3 * 86400000);
    await f.healthy.mutate(owner, 'seed_returning_turtle', 'fixture', {}, now, (wallet) => ({
      state: {
        ...wallet,
        qi: 100,
        earned: 100,
        streak: 20,
        failures: 3,
        inventory: { ...wallet.inventory, high: 1 },
      },
      result: {},
    }));
    const response = await handleCultivation(f.context, {
      id: 'returning_turtle_attempt',
      operation: 'breakthrough',
      item: 'high',
    });
    const body = (await response.json()) as { result: { chance: number } };
    assert.equal(response.status, 200);
    assert.equal(body.result.chance, 95, 'old interval three-failure skill has been interrupted');
  } finally {
    f.raw.close();
  }
});

test('elixir reset latches original daily identity before replacing a same-day companion role', async () => {
  const f = await fixture('fluffle');
  try {
    f.raw.exec("UPDATE beast_accounts SET state_json=json_set(state_json,'$.alchemy.inventory',1)");
    const roles = new BeastRoleService(f.store);
    await roles.execute(
      owner,
      'v2_real_elixir_reset',
      {
        operation: 'reset',
        day: f.today.day,
        version: (await f.store.read(owner)).version,
        beastId: 'runtime_beast',
      },
      f.today.day,
      now,
      f.today.end_at,
    );
    const snapshot = JSON.parse(
      String(f.raw.prepare('SELECT snapshot_json FROM beast_v2_days').get()!.snapshot_json),
    );
    assert.equal(snapshot.attemptId, 'runtime_attempt');
    assert.equal(snapshot.attempt.form, 4);
    assert.equal(snapshot.attempt.earned, 800);
    assert.notEqual(
      (await f.store.individual(owner, 'runtime_beast'))!.attemptId,
      snapshot.attemptId,
    );
    const selected = (await f.store.roles(owner, f.today.day)).current.find(
      (role) => role.role === 'companion',
    )!;
    assert.notEqual(selected.attemptId, snapshot.attemptId);
    assert.equal(
      f.raw.prepare('SELECT COUNT(*) AS n FROM beast_skill_events').get()!.n,
      0,
      'latching identity does not mint a source reward',
    );
    assert.equal((await f.healthy.read(owner)).state.qi, 0);
  } finally {
    f.raw.close();
  }
});

test('monkey actual tower service rescues floor four once and a reshuffled trap still fails', async () => {
  const f = await fixture('punchimp');
  try {
    const habits = new HabitService(new D1HabitStore(f.db));
    const habit = await habits.execute(
      owner,
      'v2_tower_habit_create',
      {
        operation: 'create',
        definition: { name: 'Tower habit', metric: 'check', target: 1, cadence: { kind: 'daily' } },
      },
      now,
    );
    const at = now + 86400000;
    const today = (await f.schedule.ensureDay(owner, at))!;
    await habits.execute(
      owner,
      'v2_tower_habit_log',
      {
        operation: 'log',
        habitId: habit.habitId,
        version: 1,
        day: today.day,
        logVersion: 0,
        value: 1,
      },
      at,
    );
    await f.complete(1, at);
    const service = new BeastTowerService(f.store, () => 0);
    let request = 0;
    const command = async (operation: BeastTowerCommand['operation'], card?: number) => {
      const run = await f.store.tower(owner, today.day);
      return service.execute(
        owner,
        'v2_tower_step_' + request++,
        {
          operation,
          day: today.day,
          version: (await f.store.read(owner)).version,
          ...(operation === 'tower_start' ? {} : { runVersion: run!.version }),
          ...(card === undefined ? {} : { card }),
        },
        today.day,
        at,
        today.end_at,
      );
    };
    await command('tower_start');
    for (let floor = 1; floor <= 3; floor++) {
      await command('tower_pick', 1);
      await command('tower_continue');
    }
    await command('tower_pick', 0);
    let run = (await f.store.tower(owner, today.day))!;
    assert.equal(run.state.floor, 4);
    assert.equal(run.state.lastResult, 'rescued');
    assert.equal(run.state.status, 'choosing');
    assert.equal(run.state.rescued, true);
    await command('tower_pick', 0);
    run = (await f.store.tower(owner, today.day))!;
    assert.equal(run.state.status, 'failed', 'one rescue per run, not one per retry/floor');
    assert.equal(run.state.lastResult, 'trap');
    await assert.rejects(command('tower_start'), /TOWER_ALREADY_PLAYED/);
  } finally {
    f.raw.close();
  }
});

test('tower delayed expiry pays the run original multiplier once after companion changes', async () => {
  const f = await fixture('pyropup');
  try {
    const run = {
      ...beginBeastTower(f.today.day, false, () => 0, { rescueMaxFloor: 4, rewardMultiplier: 3 }),
      floor: 3,
      cleared: 3,
      status: 'decision' as const,
    };
    f.raw
      .prepare(
        `INSERT INTO beast_tower_runs(owner,day,state_json,eligibility_json,expires_at,created,updated)
      VALUES(?,?,?,'{}',?,?,?)`,
      )
      .run(owner, f.today.day, JSON.stringify(run), f.today.end_at, now, now);
    f.raw
      .prepare(
        'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
      )
      .run(owner, 'companion', f.today.day + 1, null, null, f.today.end_at);
    const service = new BeastTowerService(f.store, () => 0);
    const result = await service.expire(owner, f.today.end_at + 1);
    assert.ok(result);
    assert.equal((await f.healthy.read(owner)).state.tickets, 15, 'floor3 base5 tickets times3');
    assert.equal(
      (await f.store.read(owner)).state.summonTickets,
      0,
      'floor3 has no summon ticket reward',
    );
    assert.equal(await service.expire(owner, f.today.end_at + 2), null);
    assert.equal((await f.healthy.read(owner)).state.tickets, 15);
    assert.equal((await f.store.read(owner)).state.summonTickets, 0);
  } finally {
    f.raw.close();
  }
});

test('recovering an older task uses its own daily quota without rewinding current-day immediate progress', async () => {
  const f = await fixture('zappur');
  try {
    await f.complete(1);
    f.raw
      .prepare(
        "INSERT INTO tasks(id,owner,title,created) VALUES('late_original_task',?,'Delayed original task',?)",
      )
      .run(owner, now + 100);
    f.raw.exec("UPDATE tasks SET status='completed' WHERE id='late_original_task'");
    f.raw
      .prepare("UPDATE task_completions SET completed_at=? WHERE task_id='late_original_task'")
      .run(now + 100);
    const tomorrow = now + 86400000;
    const nextDay = (await f.schedule.ensureDay(owner, tomorrow))!;
    await f.complete(2, tomorrow);
    await f.healthy.syncTaskTickets(owner, tomorrow + 1000);
    const rows = f.raw
      .prepare('SELECT day,task_count,daily_json FROM beast_v2_days ORDER BY day')
      .all();
    assert.equal(rows[0]!.day, f.today.day);
    assert.equal(rows[0]!.task_count, 2);
    assert.equal(JSON.parse(String(rows[0]!.daily_json)).taskOrdinal, 2);
    assert.equal(rows[1]!.day, nextDay.day);
    assert.equal(rows[1]!.task_count, 1);
    let state = JSON.parse(
      String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json),
    );
    assert.equal(state.daily.day, nextDay.day);
    assert.equal(
      state.daily.taskOrdinal,
      1,
      'late old task did not overwrite newer immediate state',
    );
    const before = (await f.healthy.read(owner)).state;
    await f.complete(3, tomorrow + 2000);
    const second = (await f.healthy.read(owner)).state;
    assert.equal(
      second.tickets - before.tickets,
      2,
      'task2 gets base1+talent1, not ordinal3 awakening',
    );
    await f.complete(4, tomorrow + 3000);
    const third = (await f.healthy.read(owner)).state;
    assert.equal(third.tickets - second.tickets, 5, 'task3 gets base1+talent1+awakening3');
    state = JSON.parse(
      String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json),
    );
    assert.equal(state.daily.taskOrdinal, 3);
    assert.equal(
      f.raw
        .prepare(
          "SELECT COUNT(*) AS n FROM beast_skill_events WHERE kind='v2:task' AND source_id='late_original_task'",
        )
        .get()!.n,
      1,
    );
  } finally {
    f.raw.close();
  }
});

test('delayed chat task retains original T1 skill level after the same attempt later reaches perfect T4', async () => {
  const f = await fixture('flameow');
  try {
    f.raw.exec("UPDATE beast_attempts SET form=1,earned=0,status='ready'");
    f.raw
      .prepare(
        "INSERT INTO tasks(id,owner,title,created) VALUES('old_form_task',?,'Old form task',?)",
      )
      .run(owner, now);
    f.raw.exec("UPDATE tasks SET status='completed' WHERE id='old_form_task'");
    f.raw
      .prepare("UPDATE task_completions SET completed_at=? WHERE task_id='old_form_task'")
      .run(now + 100);
    const captured = JSON.parse(
      String(
        f.raw
          .prepare("SELECT beast_source_json FROM task_completions WHERE task_id='old_form_task'")
          .get()!.beast_source_json,
      ),
    );
    assert.equal(captured.attempt.form, 1);
    assert.equal(captured.attempt.earned, 0);
    f.raw.exec("UPDATE beast_attempts SET form=4,earned=800,status='completed'");
    await f.healthy.syncTaskTickets(owner, now + 1000);
    const event = JSON.parse(
      String(
        f.raw
          .prepare(
            "SELECT result_json FROM beast_skill_events WHERE kind='v2:task' AND source_id='old_form_task'",
          )
          .get()!.result_json,
      ),
    );
    assert.equal(
      event.triggered.includes('Hỏa Liên Trảm'),
      false,
      'T1 source cannot acquire a later perfect combo',
    );
    assert.ok(event.reward.qi <= 1, 'only original T1 chance for +1 qi may pay');
    assert.equal((await f.healthy.read(owner)).state.tickets, 1);
  } finally {
    f.raw.close();
  }
});

test('delayed chat task remains attributed to the completed old attempt after elixir creates a new one', async () => {
  const f = await fixture('flameow');
  try {
    f.raw
      .prepare(
        "INSERT INTO tasks(id,owner,title,created) VALUES('old_attempt_task',?,'Old attempt task',?)",
      )
      .run(owner, now);
    f.raw.exec("UPDATE tasks SET status='completed' WHERE id='old_attempt_task'");
    f.raw
      .prepare("UPDATE task_completions SET completed_at=? WHERE task_id='old_attempt_task'")
      .run(now + 100);
    f.raw.exec("UPDATE beast_accounts SET state_json=json_set(state_json,'$.alchemy.inventory',1)");
    await new BeastRoleService(f.store).execute(
      owner,
      'delayed_source_reset',
      {
        operation: 'reset',
        day: f.today.day,
        version: (await f.store.read(owner)).version,
        beastId: 'runtime_beast',
      },
      f.today.day,
      now + 200,
      f.today.end_at,
    );
    const newAttemptId = (await f.store.individual(owner, 'runtime_beast'))!.attemptId;
    assert.notEqual(newAttemptId, 'runtime_attempt');
    await f.healthy.syncTaskTickets(owner, now + 1000);
    const event = JSON.parse(
      String(
        f.raw
          .prepare(
            "SELECT result_json FROM beast_skill_events WHERE kind='v2:task' AND source_id='old_attempt_task'",
          )
          .get()!.result_json,
      ),
    );
    assert.equal(
      event.triggered.includes('Hỏa Liên Trảm'),
      true,
      'completed original attempt retains its earned source',
    );
    assert.equal(
      f.raw.prepare('SELECT attempt_id FROM beast_v2_states').get()!.attempt_id,
      'runtime_attempt',
    );
    assert.equal(
      f.raw
        .prepare('SELECT COUNT(*) AS n FROM beast_v2_states WHERE attempt_id=?')
        .get(newAttemptId)!.n,
      0,
    );
  } finally {
    f.raw.close();
  }
});

test('humbug real fusion API applies three daily uses to success and failure without multiplying products or refunds', async (t) => {
  const f = await fixture('humbug');
  try {
    let roll = 0;
    t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
      array.fill(roll++ % 2 ? 4294967295 : 0);
      return array;
    }) as typeof crypto.getRandomValues);
    await f.healthy.mutate(owner, 'seed_humbug_input', 'fixture', {}, now, (state) => ({
      state: { ...state, inventory: { ...state.inventory, basic: 20 } },
      result: {},
    }));
    for (let use = 1; use <= 4; use++) {
      const before = (await f.healthy.read(owner)).state;
      const response = await handleCultivation(f.context, {
        id: 'humbug_fusion_' + use,
        operation: 'fuse',
        item: 'basic',
      });
      const result = (await response.json()) as { result: { success: boolean } };
      assert.equal(response.status, 200);
      assert.equal(result.result.success, use % 2 === 1);
      const after = (await f.healthy.read(owner)).state;
      if (result.result.success) {
        assert.equal(after.inventory.basic - before.inventory.basic, -3);
        assert.equal(after.inventory.middle - before.inventory.middle, use <= 3 ? 2 : 1);
      } else {
        assert.equal(after.inventory.basic - before.inventory.basic, use <= 3 ? -2 : -3);
        assert.equal(after.inventory.middle, before.inventory.middle);
      }
    }
    const state = () =>
      JSON.parse(String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json));
    assert.equal(state().daily.fusionUses, 3);
    const tomorrow = now + 86400000;
    await f.schedule.ensureDay(owner, tomorrow);
    const before = (await f.healthy.read(owner)).state;
    await handleCultivation(
      { ...f.context, now: tomorrow },
      { id: 'humbug_fusion_tomorrow', operation: 'fuse', item: 'basic' },
    );
    assert.equal((await f.healthy.read(owner)).state.inventory.middle - before.inventory.middle, 2);
    assert.equal(state().daily.fusionUses, 1);
    f.raw.exec(
      "UPDATE cultivation_accounts SET state_json=json_set(state_json,'$.inventory.basic',2)",
    );
    await assert.rejects(
      handleCultivation(
        { ...f.context, now: tomorrow },
        { id: 'humbug_insufficient', operation: 'fuse', item: 'basic' },
      ),
      /FUSION_UNAVAILABLE/,
    );
    assert.equal(state().daily.fusionUses, 1, 'insufficient input does not consume a daily use');
  } finally {
    f.raw.close();
  }
});

test('fusion batch requires the full recipe, preserves refunds, and replays wallet and skill quota once', async (t) => {
  const f = await fixture('humbug');
  try {
    const rolls = [4294967295, 4294967295, ...Array(8).fill(0)];
    let samples = 0;
    t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
      array.fill(rolls[samples++]!);
      return array;
    }) as typeof crypto.getRandomValues);
    await f.healthy.mutate(owner, 'batch_refund_seed', 'fixture', {}, now, (state) => ({
      state: { ...state, inventory: { ...state.inventory, basic: 30 } },
      result: {},
    }));
    const input = { id: 'batch_refund_request', operation: 'fuse', item: 'basic', count: 10 };
    const first = await handleCultivation(f.context, input);
    const body = (await first.json()) as any;
    assert.equal(first.status, 200);
    assert.deepEqual(
      { ...body.result, beastEffect: undefined },
      {
        requested: 10,
        count: 10,
        successes: 8,
        failures: 2,
        success: true,
        output: 'middle',
        received: 9,
        consumed: { basic: 28 },
        stoppedEarly: false,
        beastEffect: undefined,
      },
    );
    assert.equal(body.account.state.inventory.basic, 2);
    assert.equal(body.account.state.inventory.middle, 9);
    const replay = await handleCultivation(f.context, input);
    assert.deepEqual(await replay.json(), body);
    assert.equal(samples, 10);
    const skills = JSON.parse(
      String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json),
    );
    assert.equal(skills.daily.fusionUses, 3);
    assert.equal(
      f.raw.prepare("SELECT COUNT(*) n FROM beast_skill_events WHERE kind='v2:fusion'").get()!.n,
      1,
    );
    await assert.rejects(
      handleCultivation(f.context, { ...input, count: 100 }),
      /REQUEST_ID_REUSED/,
    );
  } finally {
    f.raw.close();
  }
});

test('unfunded fusion batches reject before RNG, receipts, wallet changes or skill consumption', async (t) => {
  const f = await fixture('humbug');
  try {
    t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('MUST_NOT_ROLL');
    });
    for (const [item, count, ingredient, amount] of [
      ['basic', 10, 'basic', 9],
      ['basic', 10, 'basic', 29],
      ['basic', 100, 'basic', 299],
      ['supreme', 10, 'supreme', 29],
      ['supreme', 10, 'keepsake', 29],
    ] as const) {
      const id = `unfunded_${item}_${count}_${ingredient}_${amount}`;
      await f.healthy.mutate(owner, id + '_seed', 'fixture', {}, now, (state) => ({
        state: {
          ...state,
          inventory: {
            ...state.inventory,
            basic: 300,
            supreme: 300,
            keepsake: 300,
            [ingredient]: amount,
          },
        },
        result: {},
      }));
      const before = await f.healthy.read(owner);
      const input = { id, operation: 'fuse', item, count };
      await assert.rejects(handleCultivation(f.context, input), /FUSION_UNAVAILABLE/);
      assert.deepEqual(await f.healthy.read(owner), before);
      assert.equal(await f.healthy.receipt(owner, id, 'fuse', input), null);
      assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM beast_v2_states').get()!.n, 0);
    }
  } finally {
    f.raw.close();
  }
});

test('fusion API commits 100 independent attempts once and validates batch sizes without consuming resources', async (t) => {
  const f = await fixture('humbug');
  try {
    let samples = 0;
    t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
      samples++;
      array.fill(0);
      return array;
    }) as typeof crypto.getRandomValues);
    await f.healthy.mutate(owner, 'batch_100_seed', 'fixture', {}, now, (state) => ({
      state: { ...state, inventory: { ...state.inventory, middle: 300 } },
      result: {},
    }));
    for (const count of [0, -1, 2, 101, 1.5, '10', null]) {
      const response = await handleCultivation(f.context, {
        id: 'invalid_batch',
        operation: 'fuse',
        item: 'middle',
        count,
      });
      assert.equal(response.status, 400);
    }
    assert.equal(samples, 0);
    const input = { id: 'batch_100_request', operation: 'fuse', item: 'middle', count: 100 };
    const body = (await (await handleCultivation(f.context, input)).json()) as any;
    assert.equal(body.result.count, 100);
    assert.equal(body.result.successes, 100);
    assert.equal(body.result.received, 100);
    assert.deepEqual(body.result.consumed, { middle: 300 });
    assert.equal(body.account.state.inventory.middle, 0);
    assert.equal(body.account.state.inventory.high, 100);
    assert.equal(body.result.stoppedEarly, false);
    assert.deepEqual(await (await handleCultivation(f.context, input)).json(), body);
    assert.equal(samples, 100);
  } finally {
    f.raw.close();
  }
});

test('old wallets gain an immortal slot and supreme batches burn keepsakes on both outcomes without using Song Sinh quota', async (t) => {
  const f = await fixture('humbug');
  try {
    let samples = 0;
    t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
      array.fill(samples++ === 0 ? 0 : 4294967295);
      return array;
    }) as typeof crypto.getRandomValues);
    await f.healthy.mutate(owner, 'immortal_recipe_seed', 'fixture', {}, now, (state) => ({
      state: { ...state, inventory: { ...state.inventory, supreme: 30, keepsake: 30 } },
      result: {},
    }));
    f.raw.exec(
      "UPDATE cultivation_accounts SET state_json=json_remove(state_json,'$.inventory.immortal')",
    );
    assert.equal((await f.healthy.read(owner)).state.inventory.immortal, 0);
    const input = { id: 'immortal_recipe_request', operation: 'fuse', item: 'supreme', count: 10 };
    const body = (await (await handleCultivation(f.context, input)).json()) as any;
    assert.equal(body.result.count, 10);
    assert.equal(body.result.successes, 1);
    assert.equal(body.result.failures, 9);
    assert.equal(body.result.received, 1);
    assert.deepEqual(body.result.consumed, { supreme: 30, keepsake: 30 });
    assert.equal(body.account.state.inventory.immortal, 1);
    const skill = JSON.parse(
      String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json),
    );
    assert.equal(skill.daily.fusionUses, 0);
    assert.deepEqual(await (await handleCultivation(f.context, input)).json(), body);
    assert.equal(samples, 10);
  } finally {
    f.raw.close();
  }
});

test('immortal breakthrough persists its floor and grants both protections exactly once on either outcome', async (t) => {
  let sample = 4294967295;
  t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
    array.fill(sample);
    return array;
  }) as typeof crypto.getRandomValues);
  for (const succeeds of [false, true]) {
    sample = succeeds ? 0 : 4294967295;
    const f = await fixture('humbug');
    try {
      await f.healthy.mutate(owner, 'immortal_use_seed', 'fixture', {}, now, (state) => ({
        state: {
          ...state,
          qi: 1000,
          earned: 1000,
          streak: 100,
          inventory: { ...state.inventory, immortal: 1 },
        },
        result: {},
      }));
      const input = { id: 'immortal_use_request', operation: 'breakthrough', item: 'immortal' };
      const body = (await (await handleCultivation(f.context, input)).json()) as any;
      assert.equal(body.result.success, succeeds);
      assert.equal(body.result.penalty, succeeds ? 0 : 1);
      assert.equal(body.account.state.immortalPity, !succeeds);
      assert.equal(body.account.state.inventory.heart, 1);
      assert.equal(body.account.state.inventory.peace, 1);
      assert.equal(body.account.state.inventory.immortal, 0);
      const repeated = await (await handleCultivation(f.context, input)).json();
      assert.deepEqual(repeated, body);
      const stored = (await f.healthy.read(owner)).state;
      assert.equal(stored.inventory.heart, 1);
      assert.equal(stored.inventory.peace, 1);
      assert.equal(stored.immortalPity, !succeeds);
    } finally {
      f.raw.close();
    }
  }
});

test('immortal support leaves Mai Da three-failure cycle unchanged and resets after breakthrough success', async (t) => {
  let sample = 4294967295;
  t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
    array.fill(sample);
    return array;
  }) as typeof crypto.getRandomValues);
  const f = await fixture('gibber');
  try {
    await f.healthy.mutate(owner, 'separate_support_seed', 'fixture', {}, now, (state) => ({
      state: {
        ...state,
        qi: 1000,
        earned: 1000,
        streak: 100,
        inventory: { ...state.inventory, immortal: 1 },
      },
      result: {},
    }));
    const counters = [1, 2, 3, 0, 0];
    const chances = [90, 70, 70, 80, 80];
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt === 4) sample = 0;
      const input = {
        id: 'separate_support_' + attempt,
        operation: 'breakthrough',
        item: attempt === 0 ? 'immortal' : null,
      };
      const context = { ...f.context, now: now + attempt * 86400000 };
      const body = (await (await handleCultivation(context, input)).json()) as any;
      assert.equal(body.result.success, attempt === 4);
      assert.equal(body.result.chance, chances[attempt]);
      assert.equal(body.account.state.immortalPity, attempt !== 4);
      const skillState = JSON.parse(
        String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json),
      );
      assert.equal(
        skillState.counters.breakthroughFailures,
        counters[attempt],
        'Mai Da still requires three actual failures and consumes its own readiness once',
      );
      assert.equal(body.account.state.inventory.heart, 1);
      assert.equal(body.account.state.inventory.peace, 1);
      assert.deepEqual(await (await handleCultivation(context, input)).json(), body);
    }
    const stored = (await f.healthy.read(owner)).state;
    assert.equal(stored.immortalPity, false);
    assert.equal(stored.failures, 0);
  } finally {
    f.raw.close();
  }
});

test('legacy Song Sinh is consumed once inside a fully funded fusion batch and preserves its refund', async (t) => {
  const f = await fixture('humbug');
  try {
    f.raw
      .prepare('UPDATE beast_v2_runtime SET cutover_day=? WHERE owner=?')
      .run(f.today.day + 1, owner);
    const account = await f.store.read(owner);
    await new BeastUltimateService(f.store).execute(
      owner,
      'legacy_fusion_activate',
      {
        operation: 'ultimate',
        day: f.today.day,
        version: account.version,
        beastId: 'runtime_beast',
      },
      f.today.day,
      now,
      f.today.end_at,
    );
    await f.healthy.mutate(owner, 'legacy_fusion_seed', 'fixture', {}, now, (state) => ({
      state: { ...state, inventory: { ...state.inventory, basic: 30 } },
      result: {},
    }));
    let samples = 0;
    t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
      array.fill(samples++ === 0 ? 4294967295 : 0);
      return array;
    }) as typeof crypto.getRandomValues);
    const input = { id: 'legacy_fusion_batch', operation: 'fuse', item: 'basic', count: 10 };
    const body = (await (await handleCultivation(f.context, input)).json()) as any;
    assert.equal(body.result.count, 10);
    assert.equal(body.result.received, 9);
    assert.equal(body.account.state.inventory.basic, 1);
    assert.equal(
      JSON.parse(String(f.raw.prepare('SELECT state_json FROM beast_ultimates').get()!.state_json))
        .remaining,
      0,
    );
    assert.deepEqual(await (await handleCultivation(f.context, input)).json(), body);
    assert.equal(samples, 10);
  } finally {
    f.raw.close();
  }
});

test('failed fusion commit rolls back ingredients, outputs, receipt and daily Song Sinh uses together', async (t) => {
  const f = await fixture('humbug');
  try {
    t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
      array.fill(0);
      return array;
    }) as typeof crypto.getRandomValues);
    await f.healthy.mutate(owner, 'fusion_rollback_seed', 'fixture', {}, now, (state) => ({
      state: { ...state, inventory: { ...state.inventory, basic: 30 } },
      result: {},
    }));
    const before = await f.healthy.read(owner);
    f.raw.exec(
      "CREATE TRIGGER reject_fusion BEFORE INSERT ON beast_skill_events WHEN NEW.kind='v2:fusion' BEGIN SELECT RAISE(ABORT,'forced_failure'); END",
    );
    const input = { id: 'fusion_atomic_batch', operation: 'fuse', item: 'basic', count: 10 };
    await assert.rejects(handleCultivation(f.context, input), /forced_failure/);
    assert.deepEqual(await f.healthy.read(owner), before);
    assert.equal(await f.healthy.receipt(owner, input.id, 'fuse', input), null);
    assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM beast_v2_states').get()!.n, 0);
    f.raw.exec('DROP TRIGGER reject_fusion');
    const body = (await (await handleCultivation(f.context, input)).json()) as any;
    assert.equal(body.result.count, 10);
    assert.equal(body.result.received, 13);
    assert.equal(body.account.state.inventory.basic, 0);
    const skill = JSON.parse(
      String(f.raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json),
    );
    assert.equal(skill.daily.fusionUses, 3);
  } finally {
    f.raw.close();
  }
});

test('v2 settled suspended day releases prior companion sacrifice without demanding a missing sleep assessment', async () => {
  const f = await fixture('funglet');
  try {
    const tomorrow = now + 86400000;
    const next = (await f.schedule.ensureDay(owner, tomorrow))!;
    f.raw
      .prepare(
        'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
      )
      .run(owner, 'companion', next.day, null, null, tomorrow);
    f.raw
      .prepare(
        'INSERT INTO beast_v2_days(owner,day,snapshot_json,settled,updated) VALUES(?,?,?,0,?)',
      )
      .run(owner, f.today.day, '{}', tomorrow);
    let beast = (
      await f.store.sacrificeSelection(owner, ['runtime_beast'], next.day, tomorrow)
    )[0]!;
    assert.match(beast.sacrificeBlockedReason!, /ngày chưa quyết toán/);
    f.raw.exec("UPDATE beast_v2_days SET settled=1 WHERE owner='123'");
    beast = (await f.store.sacrificeSelection(owner, ['runtime_beast'], next.day, tomorrow))[0]!;
    assert.equal(beast.sacrificeBlockedReason, null);
    f.raw.exec("UPDATE beast_accounts SET state_json=json_set(state_json,'$.sacrificePoints',9)");
    await new BeastService(f.store, () => 0).execute(
      owner,
      'v2_sacrifice_after_suspend',
      {
        operation: 'sacrifice',
        day: next.day,
        version: (await f.store.read(owner)).version,
        beastIds: ['runtime_beast'],
      },
      next.day,
      tomorrow,
      next.end_at,
    );
    assert.notEqual(
      f.raw.prepare("SELECT sacrificed_at FROM beasts WHERE id='runtime_beast'").get()!
        .sacrificed_at,
      null,
    );
    assert.equal((await f.store.read(owner)).state.sacrificePoints, 0);
    assert.equal((await f.store.read(owner)).state.summonTickets, 1);
  } finally {
    f.raw.close();
  }
});

test('late monkey second-task recovery compensates already-paid next-day tasks and never compensates twice', async () => {
  const f = await fixture('punchimp');
  try {
    await f.complete(1);
    f.raw
      .prepare(
        "INSERT INTO tasks(id,owner,title,created) VALUES('late_monkey_second',?,'Delayed second task',?)",
      )
      .run(owner, now + 100);
    f.raw.exec("UPDATE tasks SET status='completed' WHERE id='late_monkey_second'");
    f.raw
      .prepare("UPDATE task_completions SET completed_at=? WHERE task_id='late_monkey_second'")
      .run(now + 100);
    const tomorrow = now + 86400000;
    await f.schedule.ensureDay(owner, tomorrow);
    await f.complete(2, tomorrow);
    const before = (await f.healthy.read(owner)).state;
    await f.healthy.syncTaskTickets(owner, tomorrow + 1000);
    const recovered = (await f.healthy.read(owner)).state;
    assert.equal(
      recovered.qi - before.qi,
      1,
      'one original next-day task receives its delayed buff qi',
    );
    assert.equal(
      recovered.tickets - before.tickets,
      5,
      'old base1 + old milestone3 + next-day catchup1',
    );
    await f.healthy.syncTaskTickets(owner, tomorrow + 1500);
    assert.deepEqual((await f.healthy.read(owner)).state, recovered);
    await f.complete(3, tomorrow + 2000);
    const nextTask = (await f.healthy.read(owner)).state;
    assert.equal(
      nextTask.qi - recovered.qi,
      1,
      'new next-day task receives the ordinary buff once',
    );
    assert.equal(
      nextTask.tickets - recovered.tickets,
      5,
      'base1 + buff1 + current second-task milestone3',
    );
  } finally {
    f.raw.close();
  }
});
