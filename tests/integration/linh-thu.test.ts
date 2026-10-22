import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Miniflare } from 'miniflare';
import type { Database } from '../../src/adapters/d1/database.ts';
import { D1BeastStore } from '../../src/adapters/d1/linh-thu-store.ts';
import { D1BeastReader } from '../../src/adapters/d1/linh-thu-reader.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { BeastService, type BeastCommand } from '../../src/application/linh-thu-service.ts';
import { initialBeastAccount } from '../../src/domain/linh-thu-account.ts';
import { createHmac } from 'node:crypto';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { BeastRoleService } from '../../src/application/linh-thu-roles.ts';
import { BeastSettlementService } from '../../src/application/linh-thu-settlement.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { BeastTowerService, type BeastTowerCommand } from '../../src/application/linh-thu-tower.ts';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import { BeastUltimateService } from '../../src/application/linh-thu-ultimates.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../../src/domain/linh-thu-catalog.ts';
import { prepareBeastDraw, chooseBeastDraw } from '../../src/adapters/d1/linh-thu-draw.ts';
import {
  settleOneCombinedBeastDay,
  settleOneExpiredBeastUltimate,
} from '../../src/adapters/d1/linh-thu-maintenance.ts';
import { handleCultivation } from '../../src/entrypoints/mini-app/cultivation.ts';
import { handleBeasts } from '../../src/entrypoints/mini-app/linh-thu.ts';

test('individual numbers migrate per owner and species without changing training, and old writers allocate atomically', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql') && file < '0043')
      .sort())
      db.exec(readFileSync('migrations/' + file, 'utf8'));
    for (const owner of ['123', '456'])
      db.prepare(
        'INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES(?,?,1,1,1)',
      ).run(owner, JSON.stringify(initialBeastAccount()));
    const entries = [
      ['123', 'legacy_z', 'frostnip', 10],
      ['123', 'legacy_a', 'frostnip', 10],
      ['123', 'legacy_b', 'frostnip', 20],
      ['123', 'legacy_c', 'gibber', 10],
      ['456', 'legacy_a', 'frostnip', 10],
    ] as const;
    for (const [owner, id, species, at] of entries) {
      db.prepare(
        'INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES(?,?,?,?,?,?)',
      ).run(owner, id, species, 'attempt_' + id, at, 'receipt');
      db.prepare(
        "INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,earned,gray,form,created) VALUES(?,?,?,1,1,'sealed',1200,'[200,500,800]',300,10,2,?)",
      ).run(owner, 'attempt_' + id, id, at);
    }
    const original = () =>
      db
        .prepare(
          'SELECT owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt FROM beasts ORDER BY owner,id',
        )
        .all();
    const before = original(),
      attempts = db.prepare('SELECT * FROM beast_attempts ORDER BY owner,id').all();
    db.exec(readFileSync('migrations/0043_linh_thu_individual_numbers.sql', 'utf8'));
    assert.deepEqual(original(), before);
    assert.deepEqual(db.prepare('SELECT * FROM beast_attempts ORDER BY owner,id').all(), attempts);
    assert.deepEqual(
      db
        .prepare('SELECT owner,id,individual_number FROM beasts ORDER BY owner,id')
        .all()
        .map((row) => [row.owner, row.id, row.individual_number]),
      [
        ['123', 'legacy_a', 1],
        ['123', 'legacy_b', 3],
        ['123', 'legacy_c', 1],
        ['123', 'legacy_z', 2],
        ['456', 'legacy_a', 1],
      ],
    );
    const insert = db.prepare(
      "INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES('123',?,'frostnip','unused_attempt',0,'receipt')",
    );
    insert.run('new_old_writer');
    assert.equal(
      db
        .prepare("SELECT individual_number FROM beasts WHERE owner='123' AND id='new_old_writer'")
        .get()!.individual_number,
      4,
    );
    db.exec('BEGIN');
    insert.run('rolled_back');
    db.exec('ROLLBACK');
    insert.run('after_rollback');
    assert.equal(
      db
        .prepare("SELECT individual_number FROM beasts WHERE owner='123' AND id='after_rollback'")
        .get()!.individual_number,
      5,
    );
    assert.throws(
      () =>
        db.exec(
          "INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt,individual_number) VALUES('123','duplicate','frostnip','unused',0,'receipt',5)",
        ),
      /UNIQUE constraint/,
    );
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

async function projectionFixture() {
  const f = await fixture();
  const schedule = new ScheduleStore(f.db);
  await schedule.configure('123', '05:30', '23:15', 0, now - 86400000);
  const today = (await schedule.ensureDay('123', now))!;
  await f.store.initialize('123', today.day, now);
  await f.store.transact(
    '123',
    'projection_seed_001',
    'fixture',
    {},
    today.day,
    now,
    (await f.store.read('123')).version,
    (snapshot, healthy) => ({
      state: snapshot.state,
      healthy,
      result: {},
      newBeasts: [
        { id: 'projection_beast_01', speciesId: 'frostnip', attemptId: 'projection_attempt_01' },
        { id: 'projection_beast_02', speciesId: 'pyropup', attemptId: 'projection_attempt_02' },
      ],
    }),
  );
  await f.db
    .prepare(
      "UPDATE beast_attempts SET status='training',earned=716,form=3 WHERE owner='123' AND id='projection_attempt_01'",
    )
    .run();
  await f.db
    .prepare(
      "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','training',?,'projection_beast_01','projection_attempt_01',?)",
    )
    .bind(today.day, now)
    .run();
  const habits = new D1HabitStore(f.db),
    service = new HabitService(habits);
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    const result = await service.execute(
      '123',
      'projection_habit_' + i,
      {
        operation: 'create',
        definition: { name: 'Daily ' + i, metric: 'check', target: 1, cadence: { kind: 'daily' } },
      },
      now - 86400000,
    );
    ids.push(result.habitId);
  }
  const env = {
    DB: f.db,
    TELEGRAM_USER_ID: '123',
    TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
    TELEGRAM_BOT_TOKEN: '123:fake',
  };
  async function get(at = now, authorized = true) {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(at / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    params.set(
      'hash',
      createHmac(
        'sha256',
        createHmac('sha256', 'WebAppData').update(env.TELEGRAM_BOT_TOKEN).digest(),
      )
        .update(
          [...params]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => k + '=' + v)
            .join('\n'),
        )
        .digest('hex'),
    );
    const response = await miniAppApi(
      new Request('https://local/api/linh-thu/training-preview', {
        headers: authorized ? { 'X-Telegram-Init-Data': params.toString() } : {},
      }),
      env,
      at,
    );
    return {
      response,
      body: (await response.json()) as {
        day: { day: number; endAt: number };
        preview: null | {
          beastId: string;
          attemptId: string;
          base: { earned: number; gray: number };
          delta: { earned: number; gray: number };
        };
      },
    };
  }
  async function log(id: string, value: number, suffix: string) {
    const view = (await habits.today('123', now)).habits.find((h) => h.habit.id === id)!;
    await service.execute(
      '123',
      'projection_log_' + suffix,
      {
        operation: 'log',
        habitId: id,
        day: today.day,
        version: view.habit.version,
        logVersion: view.log.version,
        value,
      },
      now,
    );
  }
  return { ...f, today, habits, service, ids, get, log };
}

test('training preview API evaluates current habits, excludes neutral schedules and writes no training or rewards', async () => {
  const f = await projectionFixture();
  try {
    assert.equal((await f.get(now, false)).response.status, 401);
    let result = await f.get();
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.preview!.delta, { earned: 0, gray: 16 });
    await f.log(f.ids[0]!, 1, 'one');
    await f.log(f.ids[1]!, 1, 'two');
    await f.service.execute(
      '123',
      'projection_weekly',
      {
        operation: 'create',
        definition: {
          name: 'Flexible weekly',
          metric: 'check',
          target: 1,
          cadence: { kind: 'weekly', quota: 3 },
        },
      },
      now - 86400000,
    );
    await f.service.execute(
      '123',
      'projection_weekdays',
      {
        operation: 'create',
        definition: {
          name: 'Tuesday only',
          metric: 'check',
          target: 1,
          cadence: { kind: 'weekdays', weekdays: [1] },
        },
      },
      now - 86400000,
    );
    await f.service.execute(
      '123',
      'projection_tomorrow',
      {
        operation: 'create',
        definition: {
          name: 'Starts tomorrow',
          metric: 'check',
          target: 1,
          cadence: { kind: 'daily' },
        },
      },
      now,
    );
    const before = {
      beast: await f.store.individual('123', 'projection_beast_01'),
      account: await f.store.read('123'),
      wallet: await f.healthy.read('123'),
    };
    result = await f.get();
    assert.equal(result.body.day.day, f.today.day);
    assert.deepEqual(result.body.preview!.delta, { earned: 8, gray: 8 });
    await f.get();
    assert.deepEqual(
      {
        beast: await f.store.individual('123', 'projection_beast_01'),
        account: await f.store.read('123'),
        wallet: await f.healthy.read('123'),
      },
      before,
    );
    await f.log(f.ids[2]!, 1, 'three');
    assert.deepEqual((await f.get()).body.preview!.delta, { earned: 12, gray: 4 });
    await f.log(f.ids[2]!, 0, 'undo');
    assert.deepEqual((await f.get()).body.preview!.delta, { earned: 8, gray: 8 });
  } finally {
    await f.mf.dispose();
  }
});

test('training preview preserves the final impurity tenth, current role and pending-day boundary', async () => {
  const f = await projectionFixture();
  try {
    await f.db
      .prepare("UPDATE beast_attempts SET earned=1199,form=4 WHERE id='projection_attempt_01'")
      .run();
    await f.log(f.ids[0]!, 1, 'cap_one');
    await f.log(f.ids[1]!, 1, 'cap_two');
    await f.log(f.ids[2]!, 1, 'cap_three');
    assert.deepEqual((await f.get()).body.preview!.delta, { earned: 0, gray: 1 });
    await f.log(f.ids[3]!, 1, 'cap_four');
    assert.deepEqual((await f.get()).body.preview!.delta, { earned: 1, gray: 0 });
    assert.equal((await f.store.individual('123', 'projection_beast_01'))!.attempt.earned, 1199);
    await f.db
      .prepare(
        "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','training',?,'projection_beast_02','projection_attempt_02',?)",
      )
      .bind(f.today.day + 1, now)
      .run();
    assert.equal((await f.get()).body.preview!.beastId, 'projection_beast_01');
    const tomorrow = await f.get(f.today.end_at + 1);
    assert.equal(tomorrow.body.day.day, f.today.day + 1);
    assert.equal(
      tomorrow.body.preview,
      null,
      'unsettled earlier days must not yield an inaccurate current-day capacity',
    );
    await f.db
      .prepare(
        "UPDATE beast_attempts SET status='completed',earned=1200 WHERE id='projection_attempt_01'",
      )
      .run();
    assert.equal((await f.get()).body.preview, null);
  } finally {
    await f.mf.dispose();
  }
});

const now = Date.parse('2026-10-19T10:00:00+07:00');
const day = 20745;
test('manual evolution persists once, rejects gray-only progress, and retains discovery through reset and duplicate species', async () => {
  const { mf, db, store } = await fixture();
  try {
    await store.transact(
      '123',
      'evolution_seed_001',
      'fixture',
      {},
      day,
      now,
      0,
      (snapshot, healthy) => ({
        state: { ...snapshot.state, alchemy: { ...snapshot.state.alchemy, inventory: 1 } },
        healthy,
        newBeasts: [
          { id: 'evolution_beast_001', speciesId: 'gibber', attemptId: 'evolution_attempt_001' },
          { id: 'evolution_beast_002', speciesId: 'gibber', attemptId: 'evolution_attempt_002' },
        ],
        result: {},
      }),
    );
    const roles = new BeastRoleService(store);
    await db
      .prepare(
        "UPDATE beast_attempts SET status='training',earned=90,gray=20 WHERE id='evolution_attempt_001'",
      )
      .run();
    await assert.rejects(
      roles.execute(
        '123',
        'evolution_blocked_001',
        {
          operation: 'evolve',
          day,
          version: (await store.read('123')).version,
          beastId: 'evolution_beast_001',
        },
        day,
        now,
      ),
      /NOT_READY/,
    );
    await db
      .prepare(
        "UPDATE beast_attempts SET status='completed',earned=600,gray=0 WHERE id='evolution_attempt_001'",
      )
      .run();
    for (let form = 2; form <= 4; form++) {
      const input = {
        operation: 'evolve' as const,
        day,
        version: (await store.read('123')).version,
        beastId: 'evolution_beast_001',
      };
      const result = await roles.execute('123', 'evolution_step_00' + form, input, day, now);
      assert.equal(result.form, form);
      const replay = await roles.execute('123', 'evolution_step_00' + form, input, day, now);
      assert.deepEqual(replay, result);
      assert.equal((await store.individual('123', 'evolution_beast_001'))!.attempt.earned, 600);
      assert.equal((await store.individual('123', 'evolution_beast_001'))!.attempt.form, form);
      if (form === 2)
        await assert.rejects(
          roles.execute('123', 'evolution_stale_001', input, day, now),
          /CHANGED/,
        );
    }
    assert.deepEqual((await store.discoveries('123')).gibber, {
      form: 4,
      awakened: true,
      perfect: true,
    });
    await roles.execute(
      '123',
      'evolution_reset_001',
      {
        operation: 'reset',
        day,
        version: (await store.read('123')).version,
        beastId: 'evolution_beast_001',
      },
      day,
      now,
    );
    assert.equal((await store.individual('123', 'evolution_beast_001'))!.attempt.form, 1);
    assert.equal((await store.individual('123', 'evolution_beast_002'))!.attempt.form, 1);
    assert.deepEqual((await store.discoveries('123')).gibber, {
      form: 4,
      awakened: true,
      perfect: true,
    });
    assert.deepEqual(await store.discoveries('another-owner'), {});
  } finally {
    await mf.dispose();
  }
});

async function perfectCompanion(db: Database, store: D1BeastStore, speciesId: string, id: string) {
  const capacity = BEAST_TRAINING[beastSpecies(speciesId).rank].capacity;
  const snapshot = await store.read('123');
  await store.transact(
    '123',
    id,
    'fixture',
    {},
    day,
    now,
    snapshot.version,
    (account, healthy) => ({
      state: account.state,
      healthy,
      newBeasts: [{ id: 'b_' + id, attemptId: 'a_' + id, speciesId }],
      result: {},
    }),
  );
  await db
    .prepare(
      "UPDATE beast_attempts SET earned=?,form=4,status='completed' WHERE owner='123' AND id=?",
    )
    .bind(capacity, 'a_' + id)
    .run();
  await db
    .prepare(
      "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,?,?,?) ON CONFLICT(owner,role,effective_day) DO UPDATE SET beast_id=excluded.beast_id,attempt_id=excluded.attempt_id",
    )
    .bind(day, 'b_' + id, 'a_' + id, now)
    .run();
  // Establish fixture cutover metadata before rollback snapshots are taken;
  // production lazy bootstrap is metadata-only and otherwise appears as an
  // unrelated first-read change during the deliberately failing transaction.
  await db
    .prepare(
      "INSERT OR IGNORE INTO beast_v2_runtime(owner,cutover_day,updated) VALUES('123',1000000,?)",
    )
    .bind(now)
    .run();
  return 'b_' + id;
}
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
    await db.exec(readFileSync(`migrations/${file}`, 'utf8').replace(/\r?\n/g, ' '));
  // This suite is the retained v1 contract (weekly activation, paid choices and
  // old quotas). Keep its world explicitly before cutover, even when a tested
  // route initializes runtime lazily. V2 default/cutover behavior is exercised
  // separately by linh-thu-v2-* suites; do not alter any v1 expected rewards.
  await db.exec(
    'CREATE TRIGGER legacy_fixture_before_v2 AFTER INSERT ON beast_v2_runtime BEGIN UPDATE beast_v2_runtime SET cutover_day=1000000 WHERE owner=NEW.owner; END;',
  );
  const healthy = new HealthyStore(db);
  await healthy.mutate('123', 'seed_beasts_001', 'fixture', {}, now, (state) => ({
    state: { ...state, tickets: 400 },
    result: {},
  }));
  const store = new D1BeastStore(db);
  return { mf, db, healthy, store, service: new BeastService(store, () => 0) };
}

async function sacrificeFixture() {
  const f = await fixture();
  const species = [
    'gibber',
    'gibber',
    'gibber',
    'gibber',
    'gibber',
    'gibber',
    'flameow',
    'frostnip',
    'pyropup',
    'rubblet',
  ];
  const ids = species.map((_, i) => 'sacrifice_beast_' + i);
  await f.store.transact(
    '123',
    'sacrifice_seed_001',
    'fixture',
    {},
    day,
    now,
    0,
    (snapshot, healthy) => ({
      state: { ...snapshot.state, summonTickets: 5 },
      healthy,
      result: {},
      newBeasts: species.map((speciesId, i) => ({
        id: ids[i]!,
        speciesId,
        attemptId: 'sacrifice_attempt_' + i,
      })),
    }),
  );
  const act = async (id: string, command: Omit<BeastCommand, 'version'>) =>
    f.service.execute(
      '123',
      id,
      { ...command, version: (await f.store.read('123')).version },
      day,
      now,
    );
  return { ...f, ids, act };
}

test('sacrifice preserves discoveries and numbering, banks change, and recovers a committed request without double credit', async () => {
  const { mf, db, store, healthy, service, ids, act } = await sacrificeFixture();
  try {
    await db
      .prepare(
        "UPDATE beast_attempts SET earned=capacity,status='completed',form=4 WHERE id='sacrifice_attempt_7'",
      )
      .run();
    await act('sacrifice_protect_001', {
      operation: 'protect',
      beastId: ids[0],
      isProtected: true,
    });
    const beforeWallet = await healthy.read('123');
    const input = {
      operation: 'sacrifice' as const,
      beastIds: ids.slice(1),
      version: (await store.read('123')).version,
    };
    const result = await service.execute('123', 'sacrifice_commit_001', input, day, now);
    assert.equal(result.points, 14);
    assert.equal(result.tickets, 1);
    assert.equal(result.remainder, 4);
    assert.equal((await store.read('123')).state.summonTickets, 6);
    assert.equal((await store.collection('123')).beasts.length, 1);
    assert.equal((await store.collectionOverview('123')).gibber!.count, 1);
    assert.equal((await store.individual('123', ids[0]!))!.isProtected, true);
    assert.equal(await store.individual('123', ids[7]!), null);
    assert.equal((await store.individual('123', ids[7]!, 'sacrifice_attempt_7'))!.attempt.form, 4);
    assert.equal((await store.discoveries('123')).frostnip!.perfect, true);
    assert.deepEqual((await healthy.read('123')).state, beforeWallet.state);
    assert.deepEqual(
      await service.execute('123', 'sacrifice_commit_001', input, day + 1, now + 86400000),
      result,
    );
    assert.equal((await store.read('123')).state.summonTickets, 6);
    await store.transact(
      '123',
      'sacrifice_after_001',
      'fixture',
      {},
      day,
      now,
      (await store.read('123')).version,
      (snapshot, healthy) => ({
        state: snapshot.state,
        healthy,
        result: {},
        newBeasts: [
          { id: 'sacrifice_new_beast', speciesId: 'gibber', attemptId: 'sacrifice_new_attempt' },
        ],
      }),
    );
    assert.equal((await store.individual('123', 'sacrifice_new_beast'))!.individualNumber, 7);
    await assert.rejects(
      act('sacrifice_reuse_001', { operation: 'protect', beastId: ids[7], isProtected: false }),
      /BEAST_NOT_FOUND/,
    );
    await assert.rejects(
      new BeastRoleService(store).execute(
        '123',
        'sacrifice_role_001',
        {
          operation: 'select',
          role: 'companion',
          beastId: ids[7],
          day,
          version: (await store.read('123')).version,
        },
        day,
        now,
      ),
      /BEAST_NOT_FOUND/,
    );
  } finally {
    await mf.dispose();
  }
});

test('sacrifice rejects protected, missing, duplicated, cross-owner and insufficient selections without changing balances', async () => {
  const { mf, store, healthy, service, ids, act } = await sacrificeFixture();
  try {
    await act('sacrifice_protect_002', {
      operation: 'protect',
      beastId: ids[0],
      isProtected: true,
    });
    const before = await store.read('123'),
      wallet = await healthy.read('123');
    await assert.rejects(
      act('sacrifice_reject_star', { operation: 'sacrifice', beastIds: ids }),
      /BEAST_PROTECTED/,
    );
    await assert.rejects(
      act('sacrifice_reject_small', { operation: 'sacrifice', beastIds: [ids[1]!] }),
      /BEAST_NOT_ENOUGH_SACRIFICE_POINTS/,
    );
    await assert.rejects(
      act('sacrifice_reject_duplicate', { operation: 'sacrifice', beastIds: [ids[1]!, ids[1]!] }),
      /INVALID_BEAST_SACRIFICE/,
    );
    await assert.rejects(
      act('sacrifice_reject_missing', {
        operation: 'sacrifice',
        beastIds: [...ids.slice(1), 'missing_beast_001'],
      }),
      /BEAST_NOT_FOUND/,
    );
    await assert.rejects(
      act('sacrifice_reject_large', {
        operation: 'sacrifice',
        beastIds: Array.from({ length: 25 }, (_, i) => 'large_beast_' + i),
      }),
      /INVALID_BEAST_SACRIFICE/,
    );
    await assert.rejects(
      service.execute(
        '456',
        'sacrifice_other_owner',
        { operation: 'sacrifice', beastIds: ids, version: 0 },
        day,
        now,
      ),
      /BEAST_NOT_FOUND/,
    );
    assert.deepEqual(await store.read('123'), before);
    assert.deepEqual(await healthy.read('123'), wallet);
    assert.equal((await store.collection('123')).beasts.length, 10);
  } finally {
    await mf.dispose();
  }
});

test('sacrifice previews block current and pending roles, unsettled effects, tower runs and pending rewards', async () => {
  const { mf, db, store, ids, act } = await sacrificeFixture();
  try {
    for (const [index, role, effective] of [
      [0, 'training', day],
      [1, 'companion', day + 1],
    ] as const) {
      await db
        .prepare(
          "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123',?,?,?,?,?)",
        )
        .bind(role, effective, ids[index]!, 'sacrifice_attempt_' + index, now)
        .run();
    }
    const ultimateState = { kind: 'tower_rescue', cancelled: false, settled: false };
    await db
      .prepare(
        "INSERT INTO beast_ultimates(owner,week_start,beast_id,attempt_id,skill_version,activated_at,expires_at,state_json) VALUES('123',?,?,?,1,?,?,?)",
      )
      .bind(
        day,
        ids[2]!,
        'sacrifice_attempt_2',
        now - 100,
        now + 100,
        JSON.stringify(ultimateState),
      )
      .run();
    await db
      .prepare(
        "INSERT INTO beast_tower_runs(owner,day,state_json,eligibility_json,expires_at,created,updated) VALUES('123',?,?,?,?,?,?)",
      )
      .bind(
        day,
        JSON.stringify({ status: 'choosing' }),
        JSON.stringify({ rescueBeastId: ids[3] }),
        now + 100,
        now,
        now,
      )
      .run();
    const entries = await store.sacrificeSelection('123', ids, day, now);
    for (const id of ids.slice(0, 4))
      assert.ok(entries.find((b) => b.id === id)!.sacrificeBlockedReason, id);
    assert.equal((await store.sacrificeOverview('123', day)).gibber, 2);
    await assert.rejects(
      act('sacrifice_in_use_001', { operation: 'sacrifice', beastIds: ids }),
      /BEAST_IN_USE/,
    );
    await db
      .prepare(
        "UPDATE beast_ultimates SET state_json=json_set(state_json,'$.settled',json('true')) WHERE owner='123'",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO beast_choices(owner,id,kind,state_json,created) VALUES('123','pending_sacrifice_reward','reward','{}',?)",
      )
      .bind(now)
      .run();
    assert.match(
      (await store.sacrificeSelection('123', [ids[2]!], day, now))[0]!.sacrificeBlockedReason!,
      /lựa chọn/,
    );
    const page = await store.collection('123', null, 24, 'gibber', { day, now });
    assert.equal(page.beasts.filter((b) => !b.sacrificeBlockedReason).length, 2);
    assert.deepEqual((await store.collection('456')).beasts, []);
  } finally {
    await mf.dispose();
  }
});

test('sacrifice rolls back its wallet, inventory and receipt if the guarded batch fails', async () => {
  const { mf, db, store, ids, act } = await sacrificeFixture();
  try {
    const before = await store.read('123');
    await db.exec(
      "CREATE TRIGGER fail_sacrifice BEFORE UPDATE OF sacrificed_at ON beasts WHEN NEW.sacrificed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'forced sacrifice failure'); END;",
    );
    await assert.rejects(
      act('sacrifice_rollback_001', { operation: 'sacrifice', beastIds: ids }),
      /forced sacrifice failure/,
    );
    assert.deepEqual(await store.read('123'), before);
    assert.equal((await store.collection('123')).beasts.length, 10);
    assert.equal(
      await db
        .prepare("SELECT 1 FROM cultivation_receipts WHERE request_id='sacrifice_rollback_001'")
        .first(),
      null,
    );
  } finally {
    await mf.dispose();
  }
});

test('sacrifice rechecks protection at commit even if a preview became stale', async () => {
  const { mf, db, store, ids, act } = await sacrificeFixture();
  try {
    const before = await store.read('123');
    const select = store.sacrificeSelection.bind(store);
    store.sacrificeSelection = async (...args) => {
      const candidates = await select(...args);
      await db
        .prepare("UPDATE beasts SET is_protected=1 WHERE owner='123' AND id=?")
        .bind(ids[0]!)
        .run();
      return candidates;
    };
    await assert.rejects(
      act('sacrifice_stale_preview', { operation: 'sacrifice', beastIds: ids }),
      /BEAST_CHANGED/,
    );
    assert.deepEqual(await store.read('123'), before);
    assert.equal((await store.collection('123')).beasts.length, 10);
    assert.equal(
      await db
        .prepare("SELECT 1 FROM cultivation_receipts WHERE request_id='sacrifice_stale_preview'")
        .first(),
      null,
    );
  } finally {
    await mf.dispose();
  }
});

test('protection survives evolution and elixir reset without changing the individual number', async () => {
  const { mf, db, store, ids, act } = await sacrificeFixture();
  try {
    await act('sacrifice_keep_star', { operation: 'protect', beastId: ids[0], isProtected: true });
    await db
      .prepare(
        "UPDATE beast_attempts SET status='training',earned=100 WHERE id='sacrifice_attempt_0'",
      )
      .run();
    const roles = new BeastRoleService(store);
    await roles.execute(
      '123',
      'sacrifice_star_evolve',
      { operation: 'evolve', beastId: ids[0], day, version: (await store.read('123')).version },
      day,
      now,
    );
    assert.equal((await store.individual('123', ids[0]!))!.isProtected, true);
    await db
      .prepare("UPDATE beast_attempts SET status='sealed' WHERE id='sacrifice_attempt_0'")
      .run();
    await store.transact(
      '123',
      'sacrifice_star_elixir',
      'fixture',
      {},
      day,
      now,
      (await store.read('123')).version,
      (snapshot, healthy) => ({
        state: { ...snapshot.state, alchemy: { ...snapshot.state.alchemy, inventory: 1 } },
        healthy,
        result: {},
      }),
    );
    await roles.execute(
      '123',
      'sacrifice_star_reset',
      { operation: 'reset', beastId: ids[0], day, version: (await store.read('123')).version },
      day,
      now,
    );
    const beast = (await store.individual('123', ids[0]!))!;
    assert.equal(beast.isProtected, true);
    assert.equal(beast.individualNumber, 1);
    assert.equal(beast.attempt.earned, 0);
    assert.notEqual(beast.attemptId, 'sacrifice_attempt_0');
  } finally {
    await mf.dispose();
  }
});

test('sacrifice keeps a previous companion unavailable until its historical day has settled', async () => {
  const { mf, db, store, ids } = await sacrificeFixture();
  try {
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    await db
      .prepare(
        "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,?,?,?)",
      )
      .bind(day, ids[0]!, 'sacrifice_attempt_0', now)
      .run();
    await db
      .prepare(
        "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,NULL,NULL,?)",
      )
      .bind(day + 1, now)
      .run();
    const candidate = (
      await store.sacrificeSelection('123', [ids[0]!], day + 1, now + 86400000)
    )[0]!;
    assert.match(candidate.sacrificeBlockedReason!, /ngày chưa quyết toán/);
    await db
      .prepare(
        "INSERT INTO beast_day_settlements(owner,day,outcomes_json,result_json,created) VALUES('123',?,'[]','{}',?)",
      )
      .bind(day, now)
      .run();
    assert.ok(
      (await store.sacrificeSelection('123', [ids[0]!], day + 1, now + 86400000))[0]!
        .sacrificeBlockedReason,
    );
  } finally {
    await mf.dispose();
  }
});

test('sacrifice API exposes eligibility, enforces server protection and returns recoverable owner-scoped receipts', async () => {
  const { mf, db, store, ids } = await sacrificeFixture();
  try {
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, now);
    const token = '123:fake',
      env = {
        DB: db,
        TELEGRAM_USER_ID: '123',
        TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
        TELEGRAM_BOT_TOKEN: token,
      };
    const auth = new URLSearchParams({
      auth_date: String(Math.floor(now / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    auth.set(
      'hash',
      createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
        .update(
          [...auth]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => k + '=' + v)
            .join('\n'),
        )
        .digest('hex'),
    );
    const headers = { 'X-Telegram-Init-Data': auth.toString(), Origin: 'https://local' };
    const get = (path: string) =>
      miniAppApi(new Request('https://local/api/linh-thu/' + path, { headers }), env, now);
    const post = async (id: string, fields: Record<string, unknown>) =>
      miniAppApi(
        new Request('https://local/api/linh-thu', {
          method: 'POST',
          headers,
          body: JSON.stringify({ id, day, version: (await store.read('123')).version, ...fields }),
        }),
        env,
        now,
      );
    const preview = await get('collection?purpose=sacrifice&species=gibber');
    assert.equal(preview.status, 200);
    const page = (await preview.json()) as {
      beasts: { isProtected: boolean; sacrificeBlockedReason: string | null }[];
      availableCounts: Record<string, number>;
    };
    assert.equal(page.availableCounts.gibber, 6);
    assert.ok(
      page.beasts.every((b) => b.isProtected === false && b.sacrificeBlockedReason === null),
    );
    assert.equal(
      (
        await post('sacrifice_api_protect', {
          operation: 'protect',
          beastId: ids[0],
          isProtected: true,
        })
      ).status,
      200,
    );
    const blocked = await post('sacrifice_api_blocked', { operation: 'sacrifice', beastIds: ids });
    assert.equal(blocked.status, 409);
    assert.equal(((await blocked.json()) as { error: string }).error, 'BEAST_PROTECTED');
    assert.equal(
      (
        await post('sacrifice_api_unprotect', {
          operation: 'protect',
          beastId: ids[0],
          isProtected: false,
        })
      ).status,
      200,
    );
    const sacrificed = await post('sacrifice_api_commit', {
      operation: 'sacrifice',
      beastIds: ids,
    });
    assert.equal(sacrificed.status, 200);
    const body = (await sacrificed.json()) as { result: { tickets: number; remainder: number } };
    assert.equal(body.result.tickets, 1);
    assert.equal(body.result.remainder, 5);
    const receipt = await get('receipt?id=sacrifice_api_commit&operation=sacrifice');
    assert.equal(receipt.status, 200);
    assert.deepEqual(((await receipt.json()) as { result: unknown }).result, body.result);
    assert.equal((await get('receipt?id=sacrifice_api_protect&operation=protect')).status, 200);
    assert.equal(
      (
        await post('sacrifice_api_wrong_field', {
          operation: 'protect',
          beastId: ids[0],
          isProtected: true,
          count: 1,
        })
      ).status,
      400,
    );
  } finally {
    await mf.dispose();
  }
});

test('combined habit and sleep rewards rendezvous in either settlement order, preserve original companion and pay once', async () => {
  for (const sleepFirst of [true, false]) {
    const { mf, db, store, healthy } = await fixture();
    try {
      const schedule = new ScheduleStore(db),
        habits = new D1HabitStore(db),
        hs = new HabitService(habits);
      await schedule.configure('123', '05:30', '23:15', 0, now);
      const beastId = await perfectCompanion(db, store, 'funglet', 'combined_fung_01');
      await new BeastUltimateService(store).execute(
        '123',
        'combined_activate',
        {
          operation: 'ultimate',
          day,
          version: (await store.read('123')).version,
          beastId,
        },
        day,
        now,
        (await schedule.ensureDay('123', now))!.end_at,
      );
      const habitId = (
        await hs.execute(
          '123',
          'combined_create_habit',
          {
            operation: 'create',
            definition: { name: 'Habit', metric: 'check', target: 1, cadence: { kind: 'daily' } },
          },
          now,
        )
      ).habitId;
      const settlement = new BeastSettlementService(store, () => 0.99),
        DAY = 86400000;
      // The creation day is neutral, and must not count towards the three-day bounty.
      await schedule.reportSleep('123', now + 13 * 3600000, 'combined_sleep_neutral');
      await habits.settle('123', now + DAY, 30);
      await settlement.settle('123', now + DAY, 14);
      await settleOneCombinedBeastDay(db, '123', now + DAY, () => 0.99);
      for (let i = 1; i <= 3; i++) {
        const at = now + i * DAY,
          today = await habits.today('123', at),
          habit = today.habits[0]!;
        await hs.execute(
          '123',
          'combined_log_' + i,
          {
            operation: 'log',
            habitId,
            day: today.day.day,
            version: habit.habit.version,
            logVersion: habit.log.version,
            value: 1,
          },
          at,
        );
        if (sleepFirst) await schedule.reportSleep('123', at + 13 * 3600000, 'combined_sleep_' + i);
        await habits.settle('123', at + DAY, 30);
        await settlement.settle('123', at + DAY, 14);
        if (!sleepFirst) {
          assert.equal(await settleOneCombinedBeastDay(db, '123', at + DAY, () => 0.99), false);
          await schedule.reportSleep('123', at + 13 * 3600000, 'combined_sleep_' + i);
        }
        // A new companion after the original day must never steal its combined reward.
        if (i === 3) {
          await db
            .prepare(
              "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,NULL,NULL,?)",
            )
            .bind(today.day.day + 1, at + DAY)
            .run();
        }
        const before = (await healthy.read('123')).state.qi;
        assert.equal(await settleOneCombinedBeastDay(db, '123', at + DAY, () => 0.99), true);
        assert.equal((await healthy.read('123')).state.qi, before + 1);
        assert.equal(await settleOneCombinedBeastDay(db, '123', at + DAY, () => 0.99), false);
      }
      assert.equal((await store.ultimate('123', day))!.count, 3);
      assert.equal((await store.pendingRewards('123')).length, 1);
    } finally {
      await mf.dispose();
    }
  }
});

test('Meteor expiry waits for Sunday operating day, habit and sleep settlement, then exchanges unused guards once', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const sunday = now + 6 * 86400000,
      schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, sunday);
    const today = (await schedule.ensureDay('123', sunday))!;
    const beastId = await perfectCompanion(db, store, 'rubblet', 'meteor_expiry_01');
    // This fixture starts on Sunday; the generic companion helper uses Monday's day.
    await db
      .prepare("UPDATE beast_accounts SET activated_day=? WHERE owner='123'")
      .bind(day + 6)
      .run();
    await new BeastUltimateService(store).execute(
      '123',
      'meteor_expiry_activate',
      {
        operation: 'ultimate',
        day: day + 6,
        version: (await store.read('123')).version,
        beastId,
      },
      day + 6,
      sunday,
      today.end_at,
    );
    const mondayMidnight = Date.parse('2026-10-26T00:05:00+07:00');
    assert.equal(await settleOneExpiredBeastUltimate(db, '123', mondayMidnight), false);
    const afterClose = today.end_at + 60000;
    assert.equal(
      await settleOneExpiredBeastUltimate(db, '123', afterClose),
      false,
      'unassessed sleep blocks conversion',
    );
    await schedule.reportSleep('123', sunday + 13 * 3600000, 'meteor_sleep_sunday');
    assert.equal(
      await settleOneExpiredBeastUltimate(db, '123', afterClose),
      false,
      'habit settlement still pending',
    );
    await new D1HabitStore(db).settle('123', afterClose, 30);
    await new BeastSettlementService(store, () => 0.99).settle('123', afterClose, 14);
    assert.equal(
      await settleOneExpiredBeastUltimate(db, '123', afterClose),
      false,
      'combined rendezvous still pending',
    );
    assert.equal(await settleOneCombinedBeastDay(db, '123', afterClose, () => 0.99), true);
    const before = (await healthy.read('123')).state;
    assert.equal(await settleOneExpiredBeastUltimate(db, '123', afterClose), true);
    const after = (await healthy.read('123')).state;
    assert.equal(after.qi, before.qi + 15);
    assert.equal(after.earned, before.earned + 15);
    assert.equal(await settleOneExpiredBeastUltimate(db, '123', afterClose), false);
  } finally {
    await mf.dispose();
  }
});

test('fusion and breakthrough ultimates join real API transactions and never count refunded qi as earned', async () => {
  for (const species of ['humbug', 'gibber', 'maskfry', 'rubblet']) {
    const { mf, db, store, healthy } = await fixture();
    try {
      const schedule = new ScheduleStore(db);
      await schedule.configure('123', '05:30', '23:15', 0, now);
      const beastId = await perfectCompanion(db, store, species, 'api_effect_' + species);
      await healthy.mutate('123', 'api_effect_wallet', 'fixture', {}, now, (state) => ({
        state: {
          ...state,
          qi: 500,
          earned: 500,
          streak: 30,
          inventory: { ...state.inventory, basic: 3 },
        },
        result: {},
      }));
      await new BeastUltimateService(store).execute(
        '123',
        'api_effect_activate',
        {
          operation: 'ultimate',
          day,
          version: (await store.read('123')).version,
          beastId,
          ...(species === 'maskfry' ? { pact: 'guard' as const } : {}),
        },
        day,
        now,
        (await schedule.ensureDay('123', now))!.end_at,
      );
      const input =
        species === 'humbug'
          ? { id: 'api_effect_action', operation: 'fuse', item: 'basic' }
          : { id: 'api_effect_action', operation: 'breakthrough' };
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
      const response = await handleCultivation(context, input);
      assert.equal(response.status, 200);
      const result = (
        (await response.json()) as {
          result: {
            success: boolean;
            penalty: number;
            beastEffect: { reward: { qi?: number }; refundQi: number };
          };
        }
      ).result;
      const after = (await healthy.read('123')).state;
      if (species === 'humbug') {
        assert.equal(after.inventory.basic, result.success ? 0 : 1);
        assert.equal(after.inventory.middle, result.success ? 2 : 0);
        assert.equal((await store.ultimate('123', day))!.remaining, 0);
      } else {
        const refund = !result.success
          ? species === 'gibber'
            ? Math.min(10, result.penalty)
            : result.penalty
          : 0;
        assert.equal(result.beastEffect.refundQi, refund);
        assert.equal(after.qi, 500 - result.penalty + refund + (result.beastEffect.reward.qi ?? 0));
        assert.equal(after.earned, 500 + (result.beastEffect.reward.qi ?? 0));
      }
      assert.equal((await handleCultivation(context, input)).status, 200);
      assert.deepEqual((await healthy.read('123')).state, after);
    } finally {
      await mf.dispose();
    }
  }
});

test('Flameow combo and locked Manteeny/Voltfawn targets react to real whole-task completions', async () => {
  for (const species of ['flameow', 'manteeny', 'voltfawn']) {
    const { mf, db, store, healthy } = await fixture();
    try {
      const schedule = new ScheduleStore(db),
        work = new D1WorkStore(db);
      await schedule.configure('123', '05:30', '23:15', 0, now);
      const today = (await schedule.ensureDay('123', now))!;
      const beastId = await perfectCompanion(db, store, species, 'task_matrix_' + species);
      const ids: string[] = [];
      for (let i = 0; i < 3; i++)
        ids.push(
          String(
            (
              await work.mutateHierarchy(
                '123',
                'matrix_task_' + i,
                { operation: 'create', title: 'Task ' + i },
                now,
              )
            ).id,
          ),
        );
      await new BeastUltimateService(store).execute(
        '123',
        'matrix_activate',
        {
          operation: 'ultimate',
          day,
          version: (await store.read('123')).version,
          beastId,
          ...(species === 'flameow'
            ? {}
            : { targets: ids.slice(0, species === 'manteeny' ? 2 : 3) }),
        },
        day,
        now,
        today.end_at,
      );
      for (let i = 0; i < 3; i++) {
        const outcome = await work.mutateHierarchy(
          '123',
          'matrix_complete_' + i,
          { operation: 'complete', taskId: ids[i]!, version: 1, complete: true },
          now + i + 1,
        );
        const effect = outcome.beastEffect as {
          triggered: string[];
          reward: { qi?: number; tickets?: number };
          ultimate: { count: number; completedTargets: string[] };
        };
        if (species === 'flameow') {
          const passiveQi = Number(effect.triggered.includes('Dư Hỏa')) + (i === 2 ? 3 : 0);
          assert.equal(effect.reward.qi, [3, 5, 10][i]! + passiveQi);
        } else
          assert.equal(
            effect.ultimate.completedTargets.length,
            Math.min(i + 1, species === 'manteeny' ? 2 : 3),
          );
      }
      if (species === 'manteeny') assert.equal((await healthy.read('123')).state.qi, 5);
      if (species === 'voltfawn') assert.equal((await store.pendingRewards('123')).length, 3);
    } finally {
      await mf.dispose();
    }
  }
});

test('task effects and weekly ultimate share the real completion transaction, survive undo, cap at five and preserve one reward choice across reloads', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const today = (await schedule.ensureDay('123', now))!;
    const beastId = await perfectCompanion(db, store, 'zappur', 'ultimate_storm_01');
    const ultimate = new BeastUltimateService(store),
      work = new D1WorkStore(db);
    const activate = {
      operation: 'ultimate' as const,
      day: today.day,
      version: (await store.read('123')).version,
      beastId,
    };
    await ultimate.execute('123', 'ultimate_activate_01', activate, today.day, now, today.end_at);
    await ultimate.execute('123', 'ultimate_activate_01', activate, today.day, now, today.end_at);
    for (let i = 1; i <= 6; i++) {
      const task = await work.mutateHierarchy(
        '123',
        'ultimate_create_' + i,
        { operation: 'create', title: 'Task ' + i },
        now + i,
      );
      const result = await work.mutateHierarchy(
        '123',
        'ultimate_complete_' + i,
        { operation: 'complete', taskId: String(task.id), version: 1, complete: true },
        now + i,
      );
      assert.equal(
        (result.beastEffect as { ultimate: { count: number } }).ultimate.count,
        Math.min(i, 5),
      );
      const accountBeforeUndo = await healthy.read('123');
      await work.mutateHierarchy(
        '123',
        'ultimate_undo_' + i,
        { operation: 'complete', taskId: String(task.id), version: 2, complete: false },
        now + i,
      );
      await work.mutateHierarchy(
        '123',
        'ultimate_redo_' + i,
        { operation: 'complete', taskId: String(task.id), version: 3, complete: true },
        now + i,
      );
      assert.deepEqual((await healthy.read('123')).state, accountBeforeUndo.state);
    }
    assert.equal((await store.ultimate('123', day))!.count, 5);
    const choices = await store.pendingRewards('123');
    assert.equal(choices.length, 1);
    const choose = {
      operation: 'choose_reward' as const,
      day,
      version: (await store.read('123')).version,
      choiceId: choices[0]!.id,
      option: 0,
    };
    await ultimate.chooseReward('123', 'ultimate_choose_01', choose, day, now + 100, today.end_at);
    await ultimate.chooseReward('123', 'ultimate_choose_01', choose, day, now + 100, today.end_at);
    assert.equal((await store.read('123')).state.summonTickets, 2);
    assert.equal((await store.pendingRewards('123')).length, 0);
    const secondBeast = await perfectCompanion(db, store, 'pyropup', 'ultimate_pyro_001');
    await assert.rejects(
      ultimate.execute(
        '123',
        'ultimate_second_01',
        {
          operation: 'ultimate',
          day,
          version: (await store.read('123')).version,
          beastId: secondBeast,
        },
        day,
        now + 200,
        today.end_at,
      ),
      /WEEK_USED/,
    );
  } finally {
    await mf.dispose();
  }
});

test('atomic task rollback never leaves a passive reward, consumed ultimate progress or skill journal behind', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, now);
    await new ScheduleStore(db).ensureDay('123', now);
    await perfectCompanion(db, store, 'pyropup', 'atomic_pyro_001');
    const work = new D1WorkStore(db);
    const task = await work.mutateHierarchy(
      '123',
      'atomic_task_create',
      { operation: 'create', title: 'Task' },
      now,
    );
    const before = await healthy.read('123'),
      beasts = await store.read('123');
    await db.exec(
      "CREATE TRIGGER reject_skill_fixture BEFORE INSERT ON beast_skill_events BEGIN SELECT RAISE(ABORT,'SKILL_FAILURE'); END;",
    );
    await assert.rejects(
      work.mutateHierarchy(
        '123',
        'atomic_task_done01',
        { operation: 'complete', taskId: String(task.id), version: 1, complete: true },
        now,
      ),
      /SKILL_FAILURE/,
    );
    assert.deepEqual(await healthy.read('123'), before);
    assert.deepEqual(await store.read('123'), beasts);
    assert.equal((await work.task('123', String(task.id)))!.status, 'active');
    assert.equal(
      await healthy.receipt('123', 'atomic_task_done01', 'task:complete', {
        operation: 'complete',
        taskId: String(task.id),
        version: 1,
        complete: true,
      }),
      null,
    );
  } finally {
    await mf.dispose();
  }
});

test('sleep protection runs before rank demotion and corrections retain one skill roll, one charge and earned bonuses', async () => {
  for (const late of [false, true]) {
    const { mf, db, store, healthy } = await fixture();
    try {
      const schedule = new ScheduleStore(db);
      await schedule.configure('123', '05:30', '23:15', 0, now);
      const today = (await schedule.ensureDay('123', now))!;
      const beastId = await perfectCompanion(db, store, 'frostnip', 'sleep_frost_001');
      await healthy.mutate('123', 'sleep_account_seed', 'fixture', {}, now, (state) => ({
        state: { ...state, qi: 18, earned: 18, streak: 4, rank: 2, highestRank: 2 },
        result: {},
      }));
      await new BeastUltimateService(store).execute(
        '123',
        'sleep_ultimate_01',
        { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
        day,
        now,
        today.end_at,
      );
      const at = Date.parse(`2026-10-19T${late ? '23:16' : '23:00'}:00+07:00`);
      await schedule.reportSleep('123', at, 'beast_sleep_first');
      const first = await healthy.read('123');
      assert.equal(
        first.state.rank,
        2,
        'beast guard must prevent demotion, rather than refund after it',
      );
      assert.equal(first.state.qi, late ? 18 : 31);
      assert.equal((await store.ultimate('123', day))!.remaining, 2);
      const status = await schedule.sleepStatus('123', at + 60000);
      assert.equal(status.canUndo, true);
      await schedule.undoSleep('123', at + 60000, 'beast_sleep_undo1', status.generation!);
      assert.equal(
        (await healthy.read('123')).state.qi,
        late ? 18 : 26,
        'undo reverses base sleep only; skill reward is retained',
      );
      await schedule.reportSleep('123', at + 120000, 'beast_sleep_again');
      assert.equal((await healthy.read('123')).state.qi, first.state.qi);
      assert.equal(
        (await store.ultimate('123', day))!.remaining,
        2,
        'correction does not consume another charge',
      );
      const events = await db
        .prepare("SELECT COUNT(*) AS n FROM beast_skill_events WHERE owner='123' AND kind='sleep'")
        .first<{ n: number }>();
      assert.equal(events!.n, 1);
    } finally {
      await mf.dispose();
    }
  }
});

test('Hootlet and Beetleknight sleep ultimates retain their distinct protection and on-time rewards in the actual sleep hook', async () => {
  for (const species of ['hootlet', 'goonbug'])
    for (const late of [false, true]) {
      const { mf, db, store, healthy } = await fixture();
      try {
        const schedule = new ScheduleStore(db);
        await schedule.configure('123', '05:30', '23:15', 0, now);
        const today = (await schedule.ensureDay('123', now))!;
        const beastId = await perfectCompanion(db, store, species, 'sleep_matrix_' + species);
        await healthy.mutate('123', 'sleep_matrix_wallet', 'fixture', {}, now, (state) => ({
          state: { ...state, qi: 100, earned: 100, streak: 4 },
          result: {},
        }));
        await new BeastUltimateService(store).execute(
          '123',
          'sleep_matrix_activate',
          { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
          day,
          now,
          today.end_at,
        );
        await schedule.reportSleep(
          '123',
          Date.parse(`2026-10-19T${late ? '23:16' : '23:00'}:00+07:00`),
          'sleep_matrix_report',
        );
        const after = (await healthy.read('123')).state;
        assert.equal((await store.ultimate('123', day))!.remaining, 0);
        if (late) {
          assert.equal(after.streak, 4);
          assert.equal(after.qi === 100, species === 'goonbug');
        } else if (species === 'goonbug') {
          assert.equal(after.inventory.heart, 1);
          assert.equal(after.inventory.peace, 1);
        } else assert.equal((await store.pendingRewards('123')).length, 1);
      } finally {
        await mf.dispose();
      }
    }
});

test('Shardsnail habit and Fluffle sleep bounties pay exactly at three original qualified days', async () => {
  for (const species of ['shardsnail', 'fluffle']) {
    const { mf, db, store } = await fixture();
    try {
      const schedule = new ScheduleStore(db),
        habits = new D1HabitStore(db),
        hs = new HabitService(habits);
      await schedule.configure('123', '05:30', '23:15', 0, now);
      const beastId = await perfectCompanion(db, store, species, 'bounty_matrix_' + species);
      await new BeastUltimateService(store).execute(
        '123',
        'bounty_activate',
        { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
        day,
        now,
        (await schedule.ensureDay('123', now))!.end_at,
      );
      const habitId = (
        await hs.execute(
          '123',
          'bounty_create_habit',
          {
            operation: 'create',
            definition: { name: 'Habit', metric: 'check', target: 1, cadence: { kind: 'daily' } },
          },
          now,
        )
      ).habitId;
      for (let i = 1; i <= 4; i++) {
        const at = now + i * 86400000,
          view = await habits.today('123', at),
          habit = view.habits[0]!;
        await hs.execute(
          '123',
          'bounty_log_' + i,
          {
            operation: 'log',
            habitId,
            day: view.day.day,
            version: habit.habit.version,
            logVersion: habit.log.version,
            value: 1,
          },
          at,
        );
        await schedule.reportSleep('123', at + 13 * 3600000, 'bounty_sleep_' + i);
        await habits.settle('123', at + 86400000, 30);
        await new BeastSettlementService(store, () => 0.99).settle('123', at + 86400000, 14);
        assert.equal((await store.read('123')).state.summonTickets, i >= 3 ? 1 : 0);
      }
      assert.equal((await store.ultimate('123', day))!.count, 3);
    } finally {
      await mf.dispose();
    }
  }
});

test('Cheerstella paid draw creates one two-to-one selection, persists through reload and charges no ticket for claiming', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const beastId = await perfectCompanion(db, store, 'cheerling', 'cheer_draw_001');
    await new BeastUltimateService(store).execute(
      '123',
      'cheer_draw_activate',
      { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
      day,
      now,
      (await schedule.ensureDay('123', now))!.end_at,
    );
    const prepared = (await prepareBeastDraw(
      db,
      '123',
      'cheer_draw_action',
      day,
      now + 1,
      1,
      () => 0,
    ))!;
    const result = await healthy.mutate(
      '123',
      'cheer_draw_action',
      'draw',
      { count: 1 },
      now + 1,
      prepared,
    );
    assert.equal(result.rewards.length, 0);
    assert.equal(result.choices[0]!.candidates.length, 2);
    assert.equal(result.choices[0]!.picks, 1);
    assert.equal((await healthy.read('123')).state.tickets, 399);
    const pending = (await new D1BeastStore(db).pendingDraws('123'))[0]!;
    const closing = (await schedule.ensureDay('123', now))!;
    const delayed: Database = {
      prepare(sql) {
        const statement = db.prepare(sql);
        if (sql.includes('SELECT state_json FROM beast_choices')) {
          const first = statement.first.bind(statement);
          statement.first = async <T>() => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return first<T>();
          };
        }
        return statement;
      },
      batch: (statements) => db.batch(statements),
    };
    await assert.rejects(
      handleBeasts(
        {
          env: { DB: delayed, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32) },
          owner: '123',
          now: closing.end_at - 5,
          healthy: new HealthyStore(delayed),
        },
        {
          id: 'cheer_claim_after_deadline',
          operation: 'choose_draw',
          day,
          version: (await store.read('123')).version,
          choiceId: pending.id,
          picks: [1],
        },
      ),
      /BEAST_DAY_CLOSED/,
    );
    assert.equal(
      (await store.pendingDraws('123')).length,
      1,
      'closing request must not consume the saved choice',
    );
    assert.equal((await healthy.read('123')).state.qi, 0);
    const selected = await chooseBeastDraw(db, '123', pending.id, [1], now + 2, () => 0);
    await healthy.mutate(
      '123',
      'cheer_draw_claim',
      'beast-choose_draw',
      { choiceId: pending.id, picks: [1] },
      now + 2,
      (state) => ({
        state: selected.apply(state),
        result: selected.result,
        statements: selected.statements,
      }),
    );
    assert.equal((await healthy.read('123')).state.qi, 1);
    assert.equal((await healthy.read('123')).state.tickets, 399);
    assert.equal((await store.pendingDraws('123')).length, 0);
  } finally {
    await mf.dispose();
  }
});

test('Pyro choice persists all three candidates, spends ten upfront and advances pity sequentially only after one selection', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const today = (await schedule.ensureDay('123', now))!;
    const beastId = await perfectCompanion(db, store, 'pyropup', 'pyro_choice_001');
    const service = new BeastService(store, () => 0.999);
    await service.execute(
      '123',
      'pyro_exchange_001',
      { operation: 'exchange', version: (await store.read('123')).version, count: 10 },
      day,
      now,
    );
    await new BeastUltimateService(store).execute(
      '123',
      'pyro_activate_001',
      { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
      day,
      now,
      today.end_at,
    );
    const command = {
      operation: 'summon' as const,
      day,
      version: (await store.read('123')).version,
      count: 10,
    };
    const first = await service.execute('123', 'pyro_summon_0001', command, day, now + 1);
    assert.deepEqual(first.beasts, []);
    const pending = await store.summonChoice('123');
    assert.ok(pending);
    assert.equal((await store.read('123')).state.summonTickets, 0);
    assert.deepEqual((await store.read('123')).state.pity, { ssr: 0, ur: 0 });
    assert.equal(
      new Set(pending.candidates).size,
      2,
      'UR three candidates must include both species',
    );
    assert.deepEqual(
      await service.execute('123', 'pyro_summon_0001', command, day + 1, now + 86400000),
      first,
    );
    const choose = {
      operation: 'choose_summon' as const,
      day,
      version: (await store.read('123')).version,
      choiceId: pending.id,
      option: 0,
    };
    const result = await service.execute('123', 'pyro_choose_0001', choose, day, now + 2);
    assert.equal((result.beasts as unknown[]).length, 10);
    assert.equal(
      (await store.collection('123')).beasts.length,
      11,
      'ten new individuals plus original perfect companion',
    );
    assert.equal(await store.summonChoice('123'), null);
    assert.deepEqual((await store.read('123')).state.pity, { ssr: 0, ur: 0 });
    await service.execute('123', 'pyro_choose_0001', choose, day + 1, now + 86400000);
    assert.equal((await store.collection('123')).beasts.length, 11);
    assert.equal((await healthy.read('123')).state.tickets, 200);
  } finally {
    await mf.dispose();
  }
});

test('Hychroma paid x10 preserves three independent choices, grants only selected outcomes, counts each draw once and pays no fractions', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const today = (await schedule.ensureDay('123', now))!;
    const beastId = await perfectCompanion(db, store, 'skinklet', 'draw_hychroma_01');
    await new BeastUltimateService(store).execute(
      '123',
      'draw_activate_001',
      { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
      day,
      now,
      today.end_at,
    );
    const prepare = (id: string, count: 1 | 10) =>
      prepareBeastDraw(db, '123', id, day, now + 1, count, () => 0);
    const draw = (await prepare('draw_hychroma_x10', 10))!;
    const result = await healthy.mutate(
      '123',
      'draw_hychroma_x10',
      'draw',
      { operation: 'draw', count: 10 },
      now + 1,
      draw,
    );
    assert.equal(result.choices.length, 3);
    assert.equal(result.rewards.length, 7);
    assert.equal((await healthy.read('123')).state.tickets, 390);
    assert.equal((await healthy.read('123')).state.qi, 20);
    assert.equal((await store.ultimate('123', day))!.remaining, 0);
    assert.equal((await store.pendingDraws('123')).length, 3);
    let index = 0;
    for (const choice of result.choices) {
      await assert.rejects(
        chooseBeastDraw(db, '123', choice.id, [0, 0], now + 2, () => 0),
        /INVALID_BEAST_CHOICE/,
      );
      const selected = await chooseBeastDraw(db, '123', choice.id, [0, 2], now + 2, () => 0);
      const id = 'draw_choice_' + ++index,
        input = { choiceId: choice.id, picks: [0, 2] };
      const received = await healthy.mutate(
        '123',
        id,
        'beast-choose_draw',
        input,
        now + 2,
        (state) => ({
          state: selected.apply(state),
          result: selected.result,
          statements: selected.statements,
        }),
      );
      assert.deepEqual(received.rewards, ['qi1', 'qi1']);
      await healthy.mutate('123', id, 'beast-choose_draw', input, now + 2, () => {
        throw Error('must recover existing receipt');
      });
    }
    assert.equal((await healthy.read('123')).state.qi, 32);
    assert.equal((await healthy.read('123')).state.tickets, 390);
    assert.equal((await store.pendingDraws('123')).length, 0);
    const extra = (await prepare('draw_hychroma_11', 1))!;
    await healthy.mutate(
      '123',
      'draw_hychroma_11',
      'draw',
      { operation: 'draw', count: 1 },
      now + 3,
      extra,
    );
    assert.equal((await healthy.read('123')).state.qi, 33, 'eleventh paid draw has no beast buff');
  } finally {
    await mf.dispose();
  }
});

test('elixir reset updates a queued companion to the new attempt without reviving its previous perfect skills tomorrow', async () => {
  const { mf, db, store } = await fixture();
  try {
    const resetId = await perfectCompanion(db, store, 'gibber', 'queued_reset_001');
    const currentId = await perfectCompanion(db, store, 'frostnip', 'queued_other_001');
    const resetBeast = (await store.individual('123', resetId))!;
    await db
      .prepare(
        "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES('123','companion',?,?,?,?)",
      )
      .bind(day + 1, resetId, resetBeast.attemptId, now)
      .run();
    const before = await store.read('123');
    await store.transact(
      '123',
      'queued_elixir_seed',
      'fixture',
      {},
      day,
      now,
      before.version,
      (account, healthy) => ({
        state: { ...account.state, alchemy: { ...account.state.alchemy, inventory: 1 } },
        healthy,
        result: {},
      }),
    );
    await new BeastRoleService(store).execute(
      '123',
      'queued_reset_done',
      { operation: 'reset', day, version: (await store.read('123')).version, beastId: resetId },
      day,
      now,
    );
    const after = (await store.individual('123', resetId))!;
    assert.equal(after.attempt.status, 'ready');
    assert.equal(after.individualNumber, resetBeast.individualNumber);
    assert.equal(after.individualNumber, 1);
    assert.equal((await store.roles('123', day)).current[0]!.beastId, currentId);
    assert.equal((await store.roles('123', day + 1)).current[0]!.attemptId, after.attemptId);
    assert.notEqual(after.attemptId, resetBeast.attemptId);
  } finally {
    await mf.dispose();
  }
});

test('exchange and ten summons atomically share the real wallet, retain duplicates as individuals and paginate owner-scoped inventory', async () => {
  const { mf, healthy, store, service } = await fixture();
  try {
    assert.deepEqual(await store.collection('123'), { beasts: [], nextCursor: null });
    assert.deepEqual((await store.read('123')).state, initialBeastAccount());
    const exchange = { operation: 'exchange' as const, version: 0, count: 10 };
    assert.deepEqual(await service.execute('123', 'beast_exchange01', exchange, day, now), {
      exchanged: 10,
      cost: 200,
    });
    assert.equal((await healthy.read('123')).state.tickets, 200);
    assert.deepEqual(
      await service.execute('123', 'beast_exchange01', exchange, day + 1, now + 86400000),
      { exchanged: 10, cost: 200 },
    );
    assert.equal((await healthy.read('123')).state.tickets, 200);
    const result = await service.execute(
      '123',
      'beast_summon_01',
      { operation: 'summon', version: 1, count: 10 },
      day,
      now,
    );
    assert.equal(result.count, 10);
    assert.equal((await store.read('123')).state.summonTickets, 0);
    assert.deepEqual((await store.read('123')).state.pity, { ssr: 10, ur: 10 });
    const page1 = await store.collection('123', null, 6);
    const page2 = await store.collection('123', page1.nextCursor, 6);
    assert.equal(page1.beasts.length, 6);
    assert.equal(page2.beasts.length, 4);
    assert.equal(page2.nextCursor, null);
    const all = [...page1.beasts, ...page2.beasts];
    assert.equal(new Set(all.map((beast) => beast.id)).size, 10);
    assert.deepEqual(
      all.map((beast) => beast.individualNumber).sort((a, b) => a! - b!),
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    for (const beast of all)
      assert.equal(
        (await store.individual('123', beast.id))!.individualNumber,
        beast.individualNumber,
      );
    assert.ok(
      all.every(
        (beast) =>
          beast.speciesId === 'humbug' &&
          beast.attempt.status === 'ready' &&
          beast.attempt.earned === 0,
      ),
    );
    assert.deepEqual((await store.collection('456')).beasts, []);
    assert.equal((await store.read('456')).state.summonTickets, 0);
    assert.equal((await healthy.read('456')).state.tickets, 0);
    const replay = await service.execute(
      '123',
      'beast_summon_01',
      { operation: 'summon', version: 1, count: 10 },
      day + 2,
      now + 2 * 86400000,
    );
    assert.deepEqual(replay, result);
    assert.equal((await store.collection('123')).beasts.length, 10);
    await assert.rejects(
      service.execute(
        '123',
        'beast_summon_01',
        { operation: 'summon', version: 1, count: 1 },
        day,
        now,
      ),
      /REQUEST_ID_REUSED/,
    );
  } finally {
    await mf.dispose();
  }
});

test('collection overview ranks current owned attempts and species pages isolate owners with tied timestamps', async () => {
  const { mf, db, store } = await fixture();
  const reader = new D1BeastReader({
    prepare(sql) {
      assert.match(sql, /^\s*SELECT\b/i, 'The reader must not prepare database mutations');
      return db.prepare(sql);
    },
    batch() {
      throw Error('The reader must not commit a transaction');
    },
  });
  try {
    for (const owner of ['123', '456']) {
      for (let batch = 0; batch < 3; batch++) {
        await store.transact(
          owner,
          'overview_seed_00' + batch,
          'fixture',
          {},
          day,
          now,
          batch,
          (snapshot, healthy) => ({
            state: snapshot.state,
            healthy,
            result: {},
            newBeasts: Array.from({ length: 10 }, (_, index) => {
              const i = batch * 10 + index;
              return {
                id: 'overview_beast_' + String(i).padStart(3, '0'),
                attemptId: 'overview_attempt_' + String(i).padStart(3, '0'),
                speciesId: i < 28 ? 'gibber' : 'frostnip',
              };
            }),
          }),
        );
      }
    }
    await db
      .prepare(
        "UPDATE beast_attempts SET form=4,earned=550,gray=50 WHERE owner='123' AND id='overview_attempt_000'",
      )
      .run();
    await db
      .prepare(
        "UPDATE beast_attempts SET form=4,earned=600,gray=0 WHERE owner='123' AND id='overview_attempt_001'",
      )
      .run();
    await db
      .prepare(
        "UPDATE beast_attempts SET form=3,earned=600,gray=0 WHERE owner='123' AND id='overview_attempt_002'",
      )
      .run();
    // An old perfect attempt must not become the representative after a reset.
    await db
      .prepare(
        "INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,earned,gray,form,created) VALUES('123','overview_old_attempt','overview_beast_029',1,1,'completed',1200,'[200,500,800]',1200,0,4,?)",
      )
      .bind(now - 1)
      .run();
    assert.deepEqual(await reader.read('123'), await store.read('123'));
    assert.equal((await reader.read('789')).activatedDay, null);
    assert.deepEqual(await reader.collection('123'), await store.collection('123'));
    const overview = await reader.collectionOverview('123');
    assert.equal(overview.gibber!.count, 28);
    assert.equal(overview.gibber!.best.id, 'overview_beast_001');
    assert.equal(overview.frostnip!.count, 2);
    assert.equal(overview.frostnip!.best.attempt.form, 1);
    await db
      .prepare("UPDATE beast_attempts SET form=3 WHERE owner='123' AND id='overview_attempt_001'")
      .run();
    assert.equal(
      (await reader.collectionOverview('123')).gibber!.best.id,
      'overview_beast_000',
      'Higher attained form wins over purity',
    );
    await db
      .prepare(
        "UPDATE beast_attempts SET form=4,earned=580,gray=20 WHERE owner='123' AND id='overview_attempt_003'",
      )
      .run();
    assert.equal(
      (await reader.collectionOverview('123')).gibber!.best.id,
      'overview_beast_003',
      'Equal forms rank by purity',
    );
    assert.equal((await reader.discoveries('123')).frostnip!.form, 4);
    assert.equal((await reader.collectionOverview('456')).gibber!.best.attempt.form, 1);
    assert.deepEqual(await reader.collectionOverview('789'), {});
    const first = await reader.collection('123', null, 24, 'gibber');
    const second = await reader.collection('123', first.nextCursor, 24, 'gibber');
    assert.equal(first.beasts.length, 24);
    assert.equal(second.beasts.length, 4);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.beasts, ...second.beasts].map((beast) => beast.id)).size, 28);
    assert.ok([...first.beasts, ...second.beasts].every((beast) => beast.speciesId === 'gibber'));
    assert.deepEqual(
      [...first.beasts, ...second.beasts]
        .map((beast) => beast.individualNumber)
        .sort((a, b) => a! - b!),
      Array.from({ length: 28 }, (_, i) => i + 1),
    );
    assert.equal(
      (await reader.collection('456', null, 24, 'frostnip')).beasts.at(-1)!.individualNumber,
      1,
    );
    assert.equal((await reader.individual('123', 'overview_beast_003'))!.individualNumber, 4);
    assert.deepEqual(await reader.collection('789', null, 24, 'gibber'), {
      beasts: [],
      nextCursor: null,
    });
    await assert.rejects(reader.collection('123', null, 24, 'unknown'), /INVALID_BEAST_SPECIES/);
    await assert.rejects(reader.collection('123', null, 24, ''), /INVALID_BEAST_SPECIES/);
  } finally {
    await mf.dispose();
  }
});

test('concurrent stale exchanges spend once; insufficient ten draw never spends partially', async () => {
  const { mf, healthy, store, service } = await fixture();
  try {
    const results = await Promise.allSettled([
      service.execute(
        '123',
        'beast_race_0001',
        { operation: 'exchange', version: 0, count: 1 },
        day,
        now,
      ),
      service.execute(
        '123',
        'beast_race_0002',
        { operation: 'exchange', version: 0, count: 1 },
        day,
        now,
      ),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await healthy.read('123')).state.tickets, 380);
    assert.equal((await store.read('123')).state.summonTickets, 1);
    await assert.rejects(
      service.execute(
        '123',
        'beast_insuff001',
        { operation: 'summon', version: 1, count: 10 },
        day,
        now,
      ),
      /NO_SUMMON_TICKETS/,
    );
    assert.equal((await store.read('123')).state.summonTickets, 1);
    assert.equal((await store.collection('123')).beasts.length, 0);
  } finally {
    await mf.dispose();
  }
});

test('a failure in a created individual rolls back currency, pity, inventory and receipt', async () => {
  const { mf, healthy, store, service, db } = await fixture();
  try {
    await service.execute(
      '123',
      'beast_exchange02',
      { operation: 'exchange', version: 0, count: 10 },
      day,
      now,
    );
    await db.exec(
      "CREATE TRIGGER reject_beast_fixture BEFORE INSERT ON beasts WHEN NEW.id LIKE '%_5' BEGIN SELECT RAISE(ABORT,'FIXTURE_FAILURE'); END;",
    );
    await assert.rejects(
      service.execute(
        '123',
        'beast_rollback01',
        { operation: 'summon', version: 1, count: 10 },
        day,
        now,
      ),
      /FIXTURE_FAILURE/,
    );
    const account = await store.read('123');
    assert.equal(account.version, 1);
    assert.equal(account.state.summonTickets, 10);
    assert.deepEqual(account.state.pity, { ssr: 0, ur: 0 });
    assert.equal((await store.collection('123')).beasts.length, 0);
    assert.equal(
      await healthy.receipt('123', 'beast_rollback01', 'beast-summon', {
        operation: 'summon',
        version: 1,
        count: 10,
      }),
      null,
    );
  } finally {
    await mf.dispose();
  }
});

test('lost commit acknowledgements recover exchange and crafting receipts without paying twice or rerolling', async () => {
  const { mf, healthy, store, service, db } = await fixture();
  try {
    let lost = true;
    const unreliable: Database = {
      prepare: (sql) => db.prepare(sql),
      batch: async (statements) => {
        const result = await db.batch(statements);
        if (lost) {
          lost = false;
          throw Error('LOST_COMMIT_RESPONSE');
        }
        return result;
      },
    };
    const recovered = new BeastService(new D1BeastStore(unreliable), () => {
      throw Error('must not reroll');
    });
    await recovered.execute(
      '123',
      'beast_lost_0001',
      { operation: 'exchange', version: 0, count: 1 },
      day,
      now,
    );
    assert.equal((await healthy.read('123')).state.tickets, 380);
    const state = (await store.read('123')).state;
    await db
      .prepare('UPDATE beast_accounts SET state_json=? WHERE owner=?')
      .bind(JSON.stringify({ ...state, alchemy: { days: 30, failures: 2, inventory: 0 } }), '123')
      .run();
    lost = true;
    const craft = { operation: 'craft' as const, version: 1 };
    const result = await recovered.execute('123', 'beast_craft_001', craft, day, now);
    assert.equal(result.success, true);
    assert.deepEqual((await store.read('123')).state.alchemy, {
      days: 0,
      failures: 0,
      inventory: 1,
    });
    assert.deepEqual(
      await service.execute('123', 'beast_craft_001', craft, day + 1, now + 86400000),
      result,
    );
    assert.equal((await store.read('123')).state.alchemy.inventory, 1);
  } finally {
    await mf.dispose();
  }
});

test('real API enforces auth, origin, server day and owner, exposes receipts and recovers a committed prior-day request', async () => {
  const { mf, db, healthy, store } = await fixture();
  try {
    const token = '123:fake';
    const env = {
      DB: db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      TELEGRAM_BOT_TOKEN: token,
    };
    const params = new URLSearchParams({
      auth_date: String(Math.floor(now / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    params.set(
      'hash',
      createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
        .update(
          [...params]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => k + '=' + v)
            .join('\n'),
        )
        .digest('hex'),
    );
    const auth = { 'X-Telegram-Init-Data': params.toString() };
    const sign = (at: number) => {
      const fresh = new URLSearchParams({
        auth_date: String(Math.floor(at / 1000)),
        user: JSON.stringify({ id: 123 }),
      });
      fresh.set(
        'hash',
        createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
          .update(
            [...fresh]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => k + '=' + v)
              .join('\n'),
          )
          .digest('hex'),
      );
      return { 'X-Telegram-Init-Data': fresh.toString() };
    };
    const get = (path: string, authorized = true) =>
      miniAppApi(
        new Request('https://local/api/' + path, { headers: authorized ? auth : {} }),
        env,
        now,
      );
    const post = (input: unknown, at = now, origin = 'https://local') =>
      miniAppApi(
        new Request('https://local/api/linh-thu', {
          method: 'POST',
          headers: { ...sign(at), Origin: origin },
          body: JSON.stringify(input),
        }),
        env,
        at,
      );
    assert.equal((await get('linh-thu', false)).status, 401);
    assert.equal(
      (
        await post(
          { id: 'beast_api_0001', day, operation: 'exchange', version: 0 },
          now,
          'https://other',
        )
      ).status,
      403,
    );
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const active = (await schedule.ensureDay('123', now))!;
    const initial = await get('linh-thu');
    assert.equal(initial.status, 200);
    const view = (await initial.json()) as {
      config: { catalog: unknown[] };
      collectionOverview: Record<string, unknown>;
      day: { day: number };
      account: { version: number };
    };
    assert.equal(view.config.catalog.length, 18);
    assert.deepEqual(view.collectionOverview, {});
    assert.equal(view.day.day, active.day);
    const input = {
      id: 'beast_api_0001',
      day: active.day,
      operation: 'exchange',
      version: view.account.version,
      count: 1,
    };
    assert.equal((await post({ ...input, day: active.day - 1 })).status, 409);
    assert.equal((await post({ ...input, owner: '456' })).status, 400);
    const first = await post(input);
    assert.equal(first.status, 200);
    const saved = (await first.json()) as { result: unknown };
    assert.equal((await healthy.read('123')).state.tickets, 380);
    const replay = await post(input, now + 86400000);
    assert.equal(replay.status, 200);
    assert.equal((await healthy.read('123')).state.tickets, 380);
    assert.deepEqual(((await replay.json()) as { result: unknown }).result, saved.result);
    const receipt = await get('linh-thu/receipt?id=beast_api_0001&operation=exchange');
    assert.equal(receipt.status, 200);
    assert.deepEqual(((await receipt.json()) as { result: unknown }).result, saved.result);
    assert.equal((await get('linh-thu/receipt?id=not_exists_001&operation=exchange')).status, 404);
    assert.equal((await get('linh-thu/collection?limit=51')).status, 400);
    assert.equal((await get('linh-thu/collection?cursor=invalid')).status, 400);
    assert.equal((await get('linh-thu/collection?species=unknown')).status, 400);
    assert.equal((await get('linh-thu/collection?species=')).status, 400);
    assert.equal((await get('linh-thu/collection?species=frostnip')).status, 200);
    assert.equal((await post({ ...input, day: active.day + 1 })).status, 409);
    assert.equal((await store.read('123')).state.summonTickets, 1);
  } finally {
    await mf.dispose();
  }
});

test('calendar weekly quota changes retain habit identity and train only from effective daily outcomes without retroactive gray', async () => {
  const { mf, db, store } = await fixture();
  try {
    const DAY = 86400000,
      sunday = now - DAY,
      schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, sunday);
    const habits = new D1HabitStore(db),
      service = new HabitService(habits);
    const created = await service.execute(
      '123',
      'quota_beast_create',
      {
        operation: 'create',
        definition: {
          name: 'Weekly practice',
          metric: 'check',
          target: 1,
          cadence: { kind: 'weekly', quota: 4 },
        },
      },
      sunday,
    );
    assert.equal(created.effectiveFrom, day, 'The commitment starts on calendar Monday');
    await store.transact(
      '123',
      'quota_beast_seed',
      'fixture',
      {},
      day - 1,
      sunday,
      0,
      (account, healthy) => ({
        state: account.state,
        healthy,
        result: {},
        newBeasts: [{ id: 'quota_beast', attemptId: 'quota_attempt', speciesId: 'frostnip' }],
      }),
    );
    await new BeastRoleService(store).execute(
      '123',
      'quota_beast_select',
      {
        operation: 'select',
        role: 'training',
        beastId: 'quota_beast',
        day: day - 1,
        version: (await store.read('123')).version,
      },
      day - 1,
      sunday,
    );
    const settlement = new BeastSettlementService(store, () => 0);
    await habits.settle('123', now, 30);
    await settlement.settle('123', now);
    async function log(at: number) {
      const view = await habits.today('123', at),
        row = view.habits.find((h) => h.habit.id === created.habitId)!;
      await service.execute(
        '123',
        'quota_log_' + view.day.day,
        {
          operation: 'log',
          habitId: created.habitId,
          version: row.habit.version,
          logVersion: row.log.version,
          day: view.day.day,
          value: 1,
        },
        at,
      );
    }
    await log(now);
    for (let offset = 0; offset < 14; offset++) {
      const at = now + offset * DAY;
      if (offset === 1) {
        const changed = await service.execute(
          '123',
          'quota_beast_reduce',
          {
            operation: 'update',
            habitId: created.habitId,
            version: 1,
            definition: {
              name: 'Weekly practice',
              metric: 'check',
              target: 1,
              cadence: { kind: 'weekly', quota: 1 },
            },
          },
          at,
        );
        assert.equal(changed.habitId, created.habitId);
        assert.equal(changed.effectiveFrom, day + 7, 'The new quota starts next calendar week');
      }
      if (offset === 8) await log(at);
      await habits.settle('123', at + DAY, 30);
      assert.equal((await settlement.settle('123', at + DAY)).processed, 1);
      const attempt = (await store.individual('123', 'quota_beast'))!.attempt;
      if (offset === 3)
        assert.deepEqual(
          { earned: attempt.earned, gray: attempt.gray },
          { earned: 10, gray: 0 },
          'Flexible uncompleted sessions remain neutral while still attainable',
        );
      if (offset === 6)
        assert.deepEqual(
          { earned: attempt.earned, gray: attempt.gray },
          { earned: 10, gray: 30 },
          'The original four-session commitment produces exactly three missed days',
        );
    }
    const attempt = (await store.individual('123', 'quota_beast'))!.attempt;
    assert.deepEqual(
      { earned: attempt.earned, gray: attempt.gray },
      { earned: 20, gray: 30 },
      'One achieved session satisfies the new week without erasing old gray',
    );
    const missed = await db
      .prepare(
        "SELECT day FROM beast_day_settlements WHERE owner='123' AND json_extract(result_json,'$.delta.gray')>0 ORDER BY day",
      )
      .all<{ day: number }>();
    assert.deepEqual(
      missed.results.map((row) => row.day),
      [day + 4, day + 5, day + 6],
    );
    assert.equal(
      (await store.read('123')).state.alchemy.days,
      1,
      'Rest days pause the new alchemy streak',
    );
  } finally {
    await mf.dispose();
  }
});

test('late habit settlement trains the original individual, seals exact progress on switching, starts the next attempt and replays safely', async () => {
  const { mf, db, healthy, store } = await fixture();
  try {
    const DAY = 86400000;
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const originalDay = (await schedule.ensureDay('123', now))!.day;
    const habits = new D1HabitStore(db);
    const habitService = new HabitService(habits);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++)
      ids.push(
        (
          await habitService.execute(
            '123',
            'beast_habit_seed_' + i,
            {
              operation: 'create',
              definition: {
                name: 'Habit ' + i,
                metric: 'check',
                target: 1,
                cadence: { kind: 'daily' },
              },
            },
            now,
          )
        ).habitId,
      );
    await store.transact(
      '123',
      'beast_roster_seed',
      'fixture',
      {},
      originalDay,
      now,
      0,
      (snapshot, current) => ({
        state: snapshot.state,
        healthy: current,
        result: {},
        newBeasts: [
          { id: 'owned_frost_01', speciesId: 'frostnip', attemptId: 'attempt_frost_01' },
          { id: 'owned_storm_01', speciesId: 'zappur', attemptId: 'attempt_storm_01' },
        ],
      }),
    );
    const roles = new BeastRoleService(store);
    const settlement = new BeastSettlementService(store, () => 0);
    const choose = async (
      requestId: string,
      beastId: string,
      role: 'training' | 'companion',
      at: number,
      ordinal: number,
    ) =>
      roles.execute(
        '123',
        requestId,
        {
          operation: 'select',
          version: (await store.read('123')).version,
          day: ordinal,
          beastId,
          role,
        },
        ordinal,
        at,
      );
    await choose('choose_frost_01', 'owned_frost_01', 'training', now, originalDay);
    await choose('choose_storm_01', 'owned_storm_01', 'companion', now, originalDay);
    assert.equal((await store.roles('123', originalDay)).current.length, 0);
    assert.equal((await store.roles('123', originalDay)).pending.length, 2);
    await habits.settle('123', now + DAY, 30);
    assert.equal((await settlement.settle('123', now + DAY)).processed, 1);
    assert.equal((await store.individual('123', 'owned_frost_01'))!.attempt.status, 'training');
    assert.equal(
      (await store.read('123')).state.alchemy.days,
      0,
      'trial/neutral day is not an earned day',
    );
    async function log(id: string, at: number) {
      const view = await habits.today('123', at);
      const habit = view.habits.find((row) => row.habit.id === id)!;
      await habitService.execute(
        '123',
        'log_' + id + '_' + view.day.day,
        {
          operation: 'log',
          habitId: id,
          version: habit.habit.version,
          logVersion: habit.log.version,
          day: view.day.day,
          value: 1,
        },
        at,
      );
    }
    for (const id of ids.slice(0, 3)) await log(id, now + DAY);
    await choose('switch_storm_01', 'owned_storm_01', 'training', now + DAY, originalDay + 1);
    await choose('companion_frost1', 'owned_frost_01', 'companion', now + DAY, originalDay + 1);
    assert.equal((await store.individual('123', 'owned_frost_01'))!.attempt.status, 'training');
    assert.equal(
      (await settlement.settle('123', now + 2 * DAY)).processed,
      0,
      'unassessed habit day must defer',
    );
    await habits.settle('123', now + 2 * DAY, 30);
    assert.equal((await settlement.settle('123', now + 2 * DAY)).processed, 1);
    const frost = (await store.individual('123', 'owned_frost_01'))!;
    assert.deepEqual(
      { earned: frost.attempt.earned, gray: frost.attempt.gray, status: frost.attempt.status },
      { earned: 12, gray: 4, status: 'sealed' },
    );
    assert.equal((await store.individual('123', 'owned_storm_01'))!.attempt.status, 'training');
    assert.equal((await store.read('123')).state.alchemy.days, 0);
    await assert.rejects(
      choose('locked_frost_01', 'owned_frost_01', 'training', now + 2 * DAY, originalDay + 2),
      /TRAINING_LOCKED/,
    );
    for (const id of ids) await log(id, now + 2 * DAY);
    await habits.settle('123', now + 3 * DAY, 30);
    assert.equal((await settlement.settle('123', now + 3 * DAY)).processed, 1);
    assert.equal((await store.individual('123', 'owned_storm_01'))!.attempt.earned, 16);
    assert.equal(
      (await store.individual('123', 'owned_frost_01'))!.attempt.earned,
      12,
      'companion selection never resumes sealed training',
    );
    assert.equal((await store.read('123')).state.alchemy.days, 1);
    const before = await healthy.read('123');
    assert.equal((await settlement.settle('123', now + 3 * DAY)).processed, 0);
    assert.deepEqual(await healthy.read('123'), before);
    const firstResult = await db
      .prepare(
        'SELECT training_beast_id,companion_beast_id FROM beast_day_settlements WHERE owner=? AND day=?',
      )
      .bind('123', originalDay + 1)
      .first<{ training_beast_id: string; companion_beast_id: string }>();
    assert.deepEqual(firstResult, {
      training_beast_id: 'owned_frost_01',
      companion_beast_id: 'owned_storm_01',
    });
  } finally {
    await mf.dispose();
  }
});

test('cancelled pending roles do not seal training; elixir reset preserves attempt history and consumed weekly ultimate slot', async () => {
  const { mf, db, store } = await fixture();
  try {
    await store.transact(
      '123',
      'beast_reset_seed',
      'fixture',
      {},
      day,
      now,
      0,
      (snapshot, healthy) => ({
        state: { ...snapshot.state, alchemy: { days: 0, failures: 0, inventory: 1 } },
        healthy,
        result: {},
        newBeasts: [{ id: 'owned_reset_01', speciesId: 'frostnip', attemptId: 'attempt_reset_01' }],
      }),
    );
    await db
      .prepare(
        "UPDATE beast_attempts SET status='sealed',earned=720,gray=120,counters_json=? WHERE owner=? AND id=?",
      )
      .bind('{"awakening":2}', '123', 'attempt_reset_01')
      .run();
    await db
      .prepare(
        "INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,'companion',?,?,?,?)",
      )
      .bind('123', day - 1, 'owned_reset_01', 'attempt_reset_01', now - 86400000)
      .run();
    await db
      .prepare(
        'INSERT INTO beast_ultimates(owner,week_start,beast_id,attempt_id,skill_version,activated_at,expires_at,state_json) VALUES(?,?,?,?,1,?,?,?)',
      )
      .bind('123', day - 1, 'owned_reset_01', 'attempt_reset_01', now - 1000, now + 86400000, '{}')
      .run();
    const service = new BeastRoleService(store);
    const reset = { operation: 'reset' as const, version: 1, day, beastId: 'owned_reset_01' };
    await service.execute('123', 'beast_reset_001', reset, day, now);
    const current = (await store.individual('123', 'owned_reset_01'))!;
    assert.deepEqual(
      {
        earned: current.attempt.earned,
        gray: current.attempt.gray,
        status: current.attempt.status,
      },
      { earned: 0, gray: 0, status: 'ready' },
    );
    assert.deepEqual(current.counters, {});
    assert.equal((await store.read('123')).state.alchemy.inventory, 0);
    const historical = (await store.individual('123', 'owned_reset_01', 'attempt_reset_01'))!;
    assert.equal(historical.attempt.gray, 120);
    assert.equal(historical.counters.awakening, 2);
    assert.equal((await store.roles('123', day - 1)).current[0]!.attemptId, 'attempt_reset_01');
    assert.equal((await store.roles('123', day)).current[0]!.attemptId, current.attemptId);
    const slot = await db
      .prepare('SELECT state_json FROM beast_ultimates WHERE owner=?')
      .bind('123')
      .first<{ state_json: string }>();
    assert.equal(JSON.parse(slot!.state_json).cancelled, true);
    await service.execute('123', 'beast_reset_001', reset, day + 1, now + 86400000);
    assert.equal((await store.read('123')).state.alchemy.inventory, 0);
    await service.execute(
      '123',
      'beast_pending_01',
      { operation: 'select', version: 2, day, role: 'training', beastId: current.id },
      day,
      now,
    );
    await service.execute(
      '123',
      'beast_cancel_001',
      { operation: 'cancel', version: 3, day, role: 'training' },
      day,
      now,
    );
    assert.equal((await store.roles('123', day)).pending.length, 0);
    assert.equal((await store.individual('123', current.id))!.attempt.status, 'ready');
  } finally {
    await mf.dispose();
  }
});

test('server tower pays exact noncumulative stops, survives log undo, serializes two picks and grants a single daily run', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const DAY = 86400000;
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const habits = new D1HabitStore(db),
      habitService = new HabitService(habits),
      work = new D1WorkStore(db);
    const habitId = (
      await habitService.execute(
        '123',
        'tower_daily_habit',
        {
          operation: 'create',
          definition: { name: 'Habit', metric: 'check', target: 1, cadence: { kind: 'daily' } },
        },
        now,
      )
    ).habitId;
    const tower = new BeastTowerService(store, () => 0);
    let request = 0;
    for (let stop = 1; stop <= 4; stop++) {
      const at = now + stop * DAY;
      const today = await habits.today('123', at),
        habit = today.habits[0]!;
      await habitService.execute(
        '123',
        'tower_log_day_' + stop,
        {
          operation: 'log',
          habitId,
          day: today.day.day,
          version: habit.habit.version,
          logVersion: habit.log.version,
          value: 1,
        },
        at,
      );
      assert.equal(
        (await store.towerEligibility('123', at)).eligible,
        false,
        'habit alone does not unlock tower',
      );
      const created = await work.mutateHierarchy(
        '123',
        'tower_task_day_' + stop,
        { operation: 'create', title: 'Whole task ' + stop },
        at,
      );
      await work.mutateHierarchy(
        '123',
        'tower_done_day_' + stop,
        { operation: 'complete', taskId: String(created.id), version: 1, complete: true },
        at,
      );
      assert.equal((await store.towerEligibility('123', at)).eligible, true);
      const act = async (operation: BeastTowerCommand['operation'], card?: number) => {
        const existing = await store.tower('123', today.day.day);
        const command: BeastTowerCommand = {
          operation,
          day: today.day.day,
          version: (await store.read('123')).version,
          ...(existing ? { runVersion: existing.version } : {}),
          ...(card === undefined ? {} : { card }),
        };
        return tower.execute(
          '123',
          'tower_action_' + ++request,
          command,
          today.day.day,
          at,
          today.day.endAt,
        );
      };
      const start = await act('tower_start');
      assert.equal(Object.hasOwn(start.tower as object, 'trap'), false);
      if (stop === 1) {
        const view = await habits.today('123', at),
          currentHabit = view.habits[0]!;
        await habitService.execute(
          '123',
          'tower_undo_habit',
          {
            operation: 'log',
            habitId,
            day: view.day.day,
            version: currentHabit.habit.version,
            logVersion: currentHabit.log.version,
            value: 0,
          },
          at,
        );
        assert.equal((await store.towerEligibility('123', at)).eligible, false);
        const command: BeastTowerCommand = {
          operation: 'tower_pick',
          day: today.day.day,
          version: (await store.read('123')).version,
          runVersion: (await store.tower('123', today.day.day))!.version,
          card: 1,
        };
        const race = await Promise.allSettled([
          tower.execute('123', 'tower_race_pick1', command, today.day.day, at),
          tower.execute('123', 'tower_race_pick2', command, today.day.day, at),
        ]);
        assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
      } else await act('tower_pick', 1);
      for (let floor = 2; floor <= stop; floor++) {
        await act('tower_continue');
        await act('tower_pick', 1);
      }
      const before = await healthy.read('123'),
        accountBefore = await store.read('123');
      const result = await act('tower_claim');
      const reward =
        stop === 1
          ? { tickets: 2, summonTickets: 0 }
          : stop === 2
            ? { tickets: 3, summonTickets: 0 }
            : stop === 3
              ? { tickets: 5, summonTickets: 0 }
              : { tickets: 0, summonTickets: 1 };
      assert.deepEqual(result.reward, reward);
      assert.equal(
        (await healthy.read('123')).state.tickets,
        before.state.tickets + reward.tickets,
      );
      assert.equal(
        (await store.read('123')).state.summonTickets,
        accountBefore.state.summonTickets + reward.summonTickets,
      );
      await assert.rejects(act('tower_claim'), /CANNOT_CLAIM/);
      const duplicate = {
        operation: 'tower_start' as const,
        day: today.day.day,
        version: (await store.read('123')).version,
      };
      await assert.rejects(
        tower.execute('123', 'tower_repeat_' + stop, duplicate, today.day.day, at),
        /ALREADY_PLAYED/,
      );
    }
    assert.equal((await store.read('123')).state.summonTickets, 1);
  } finally {
    await mf.dispose();
  }
});

test('Rockong rescues once on floors one to three, never rescues floor four, and elixir cancels an ongoing run rescue', async () => {
  const { mf, db, store } = await fixture();
  try {
    const schedule = new ScheduleStore(db),
      habits = new D1HabitStore(db),
      hs = new HabitService(habits),
      work = new D1WorkStore(db);
    await schedule.configure('123', '05:30', '23:15', 0, now);
    const beastId = await perfectCompanion(db, store, 'punchimp', 'rockong_rescue_01');
    await new BeastUltimateService(store).execute(
      '123',
      'rockong_activate',
      { operation: 'ultimate', day, version: (await store.read('123')).version, beastId },
      day,
      now,
      (await schedule.ensureDay('123', now))!.end_at,
    );
    const habitId = (
      await hs.execute(
        '123',
        'rockong_create_habit',
        {
          operation: 'create',
          definition: { name: 'Habit', metric: 'check', target: 1, cadence: { kind: 'daily' } },
        },
        now,
      )
    ).habitId;
    const tower = new BeastTowerService(store, () => 0);
    let sequence = 0;
    for (let i = 1; i <= 3; i++) {
      const at = now + i * 86400000,
        view = await habits.today('123', at),
        habit = view.habits[0]!;
      await hs.execute(
        '123',
        'rockong_log_' + i,
        {
          operation: 'log',
          habitId,
          day: view.day.day,
          version: habit.habit.version,
          logVersion: habit.log.version,
          value: 1,
        },
        at,
      );
      const task = await work.mutateHierarchy(
        '123',
        'rockong_task_' + i,
        { operation: 'create', title: 'Task' },
        at,
      );
      await work.mutateHierarchy(
        '123',
        'rockong_done_' + i,
        { operation: 'complete', taskId: String(task.id), version: 1, complete: true },
        at,
      );
      const act = async (operation: BeastTowerCommand['operation'], card?: number) => {
        const run = await store.tower('123', view.day.day);
        return tower.execute(
          '123',
          'rockong_tower_' + ++sequence,
          {
            operation,
            day: view.day.day,
            version: (await store.read('123')).version,
            ...(run ? { runVersion: run.version } : {}),
            ...(card === undefined ? {} : { card }),
          },
          view.day.day,
          at,
          view.day.endAt,
        );
      };
      assert.equal((await store.towerEligibility('123', at)).rescueBeastId, beastId);
      await act('tower_start');
      if (i === 1) {
        const rescue = await act('tower_pick', 0);
        assert.equal((rescue.tower as { lastResult: string }).lastResult, 'rescued');
        const fail = await act('tower_pick', 0);
        assert.equal((fail.tower as { status: string }).status, 'failed');
      } else if (i === 2) {
        for (let floor = 1; floor < 4; floor++) {
          await act('tower_pick', 1);
          await act('tower_continue');
        }
        assert.equal(((await act('tower_pick', 0)).tower as { status: string }).status, 'failed');
      } else {
        const account = await store.read('123');
        await store.transact(
          '123',
          'rockong_elixir_seed',
          'fixture',
          {},
          view.day.day,
          at,
          account.version,
          (s, healthy) => ({
            state: { ...s.state, alchemy: { ...s.state.alchemy, inventory: 1 } },
            healthy,
            result: {},
          }),
        );
        await new BeastRoleService(store).execute(
          '123',
          'rockong_reset',
          {
            operation: 'reset',
            day: view.day.day,
            version: (await store.read('123')).version,
            beastId,
          },
          view.day.day,
          at,
          view.day.endAt,
        );
        assert.equal((await store.tower('123', view.day.day))!.state.rescueAvailable, false);
        assert.equal(((await act('tower_pick', 0)).tower as { status: string }).status, 'failed');
        assert.equal((await store.ultimate('123', day))!.cancelled, true);
      }
    }
  } finally {
    await mf.dispose();
  }
});

test('tower traps lose only pending loot and a prior-day unfinished run automatically pays its last cleared floor exactly once', async () => {
  const { mf, db, store, healthy } = await fixture();
  try {
    const DAY = 86400000;
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, now);
    const habits = new D1HabitStore(db),
      hs = new HabitService(habits),
      work = new D1WorkStore(db);
    const habitId = (
      await hs.execute(
        '123',
        'tower_expire_habit',
        {
          operation: 'create',
          definition: {
            name: 'Daily',
            metric: 'check',
            target: 1,
            cadence: { kind: 'daily' },
          },
        },
        now,
      )
    ).habitId;
    const tower = new BeastTowerService(store, () => 0);
    let sequence = 0;
    for (let index = 1; index <= 2; index++) {
      const at = now + index * DAY;
      const view = await habits.today('123', at),
        habit = view.habits[0]!;
      await hs.execute(
        '123',
        'tower_expire_log' + index,
        {
          operation: 'log',
          habitId,
          day: view.day.day,
          version: habit.habit.version,
          logVersion: habit.log.version,
          value: 1,
        },
        at,
      );
      const task = await work.mutateHierarchy(
        '123',
        'tower_expire_task' + index,
        { operation: 'create', title: 'Task' },
        at,
      );
      await work.mutateHierarchy(
        '123',
        'tower_expire_done' + index,
        { operation: 'complete', taskId: String(task.id), version: 1, complete: true },
        at,
      );
      const act = async (operation: BeastTowerCommand['operation'], card?: number) => {
        const run = await store.tower('123', view.day.day);
        return tower.execute(
          '123',
          'tower_expire_action' + ++sequence,
          {
            operation,
            day: view.day.day,
            version: (await store.read('123')).version,
            ...(run ? { runVersion: run.version } : {}),
            ...(card === undefined ? {} : { card }),
          },
          view.day.day,
          at,
        );
      };
      await act('tower_start');
      await act('tower_pick', 1);
      await act('tower_continue');
      if (index === 1) {
        const before = await healthy.read('123');
        const result = await act('tower_pick', 0);
        assert.equal((result.tower as { status: string }).status, 'failed');
        assert.equal((await healthy.read('123')).state.tickets, before.state.tickets);
        assert.equal(await tower.expire('123', at + DAY), null);
      } else {
        await act('tower_pick', 1);
        await act('tower_continue');
        await act('tower_pick', 1);
        await act('tower_continue');
        const before = (await healthy.read('123')).state.tickets;
        const summonBefore = (await store.read('123')).state.summonTickets;
        const expired = await tower.expire('123', at + DAY);
        assert.ok(expired);
        assert.equal((await healthy.read('123')).state.tickets, before + 5);
        assert.equal((await store.read('123')).state.summonTickets, summonBefore);
        assert.equal(await tower.expire('123', at + DAY), null);
        assert.equal((await healthy.read('123')).state.tickets, before + 5);
        assert.equal((await store.read('123')).state.summonTickets, summonBefore);
        assert.equal(
          await store.tower('123', view.day.day + 1),
          null,
          'old run never reserves the new day',
        );
      }
    }
  } finally {
    await mf.dispose();
  }
});
