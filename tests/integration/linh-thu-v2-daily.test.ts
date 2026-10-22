import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import { initialHealthy } from '../../src/domain/healthy.ts';
import { initialBeastAccount } from '../../src/domain/linh-thu-account.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../../src/domain/linh-thu-catalog.ts';
import { initialBeastV2State } from '../../src/domain/linh-thu-v2.ts';
import { settleOneBeastV2Day } from '../../src/adapters/d1/linh-thu-v2-daily.ts';

const owner = '123';
const day = 20740;
const start = Date.parse('2026-10-13T05:30:00+07:00');
const end = start + 86400000;

function fixture(speciesId = 'fluffle') {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort())
    raw.exec(readFileSync('migrations/' + file, 'utf8'));
  let queries = 0;
  const db = sqliteDatabase(raw, () => {
    queries++;
  });
  const capacity = BEAST_TRAINING[beastSpecies(speciesId).rank].capacity;
  const attempt = {
    speciesId,
    ruleVersion: 1,
    form: 4,
    status: 'completed',
    earned: capacity,
    gray: 0,
  };
  raw
    .prepare(
      'INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES(?,?,?,?,?)',
    )
    .run(owner, JSON.stringify(initialBeastAccount()), day - 30, start, start);
  raw
    .prepare('INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)')
    .run(owner, JSON.stringify({ ...initialHealthy(), qi: 100, earned: 100 }), start);
  raw
    .prepare(
      'INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES(?,?,?,?,?,?)',
    )
    .run(owner, 'daily_beast', speciesId, 'daily_attempt', start, 'fixture');
  raw
    .prepare(
      `INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,
    capacity,thresholds_json,earned,gray,form,created) VALUES(?,?,?,1,1,'completed',?,'[]',?,0,4,?)`,
    )
    .run(owner, 'daily_attempt', 'daily_beast', capacity, capacity, start);
  raw
    .prepare(
      'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
    )
    .run(owner, 'companion', day - 30, 'daily_beast', 'daily_attempt', start);
  raw
    .prepare('INSERT INTO beast_v2_runtime(owner,cutover_day,updated) VALUES(?,?,?)')
    .run(owner, day, start);
  const addDay = (
    ordinal: number,
    options: {
      settlement?: boolean;
      sleep?: 'on_time' | 'late' | 'unreported' | null;
      habit?: { satisfied: boolean; rewardEligible: boolean };
      count?: number;
    } = {},
  ) => {
    const at = start + (ordinal - day) * 86400000;
    raw
      .prepare(
        'INSERT INTO schedule_days(owner,day,start_at,target_sleep,end_at) VALUES(?,?,?,?,?)',
      )
      .run(owner, ordinal, at, at + 18 * 3600000, at + 86400000);
    if (options.settlement !== false)
      raw
        .prepare(
          `INSERT INTO beast_day_settlements(owner,day,companion_beast_id,outcomes_json,result_json,created)
        VALUES(?,?,'daily_beast','[]',?,?)`,
        )
        .run(
          owner,
          ordinal,
          JSON.stringify({
            companionAttempt: attempt,
            companionAttemptId: 'daily_attempt',
            v2Habit: options.habit ?? { satisfied: true, rewardEligible: true },
          }),
          at + 86400000,
        );
    if (options.sleep !== null) {
      const result = options.sleep ?? 'on_time';
      raw
        .prepare(
          `INSERT INTO sleep_assessments(owner,day,target,reported_at,result,qi_delta,demoted,assessed_at)
        VALUES(?,?,?,?,?,0,0,?)`,
        )
        .run(
          owner,
          ordinal,
          at + 18 * 3600000,
          result === 'unreported' ? null : at + 17 * 3600000,
          result,
          at + 86400000,
        );
    }
    if (options.count !== undefined)
      raw
        .prepare(
          `INSERT INTO beast_v2_days(owner,day,snapshot_json,task_count,updated)
        VALUES(?,?,?,?,?)`,
        )
        .run(
          owner,
          ordinal,
          JSON.stringify({
            multiplier: 1,
            startSleepStreak: 0,
            beastId: 'daily_beast',
            attemptId: 'daily_attempt',
            attempt,
          }),
          options.count,
          at,
        );
  };
  const state = () =>
    JSON.parse(
      String(raw.prepare('SELECT state_json FROM cultivation_accounts').get()!.state_json),
    );
  const skill = () =>
    JSON.parse(String(raw.prepare('SELECT state_json FROM beast_v2_states').get()!.state_json));
  return {
    raw,
    db,
    attempt,
    addDay,
    state,
    skill,
    queries: () => queries,
    resetQueries: () => {
      queries = 0;
    },
  };
}

test('daily v2 waits for original day end, final sleep and upstream habit settlement without rolling', async () => {
  const f = fixture();
  try {
    f.addDay(day, { settlement: false });
    const random = () => {
      throw Error('pending day must not roll');
    };
    assert.equal(await settleOneBeastV2Day(f.db, owner, end - 1, random), false);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, random), false);
    assert.equal(f.state().qi, 100);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_skill_events').get()!.n, 0);
  } finally {
    f.raw.close();
  }
});

test('daily v2 settles milestones with original strict sleep streak once and within query budget', async () => {
  const f = fixture();
  try {
    f.addDay(day - 2);
    f.addDay(day - 1);
    f.addDay(day);
    const previous = initialBeastV2State();
    previous.lastDay = day - 1;
    previous.counters = { sleepAccum95: 2, sleep100: 2 };
    f.raw
      .prepare('INSERT INTO beast_v2_states VALUES(?,?,?)')
      .run(owner, 'daily_attempt', JSON.stringify(previous));
    f.resetQueries();
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), true);
    assert.equal(f.state().qi, 110, '2 sleep talent +5 cumulative +3 current sleep chain');
    assert.equal(f.state().earned, 110);
    assert.equal(f.skill().counters.sleep100, 0);
    assert.equal(f.skill().counters.sleepAccum95, 0);
    assert.equal(f.raw.prepare('SELECT sleep_streak FROM beast_v2_runtime').get()!.sleep_streak, 3);
    assert.ok(f.queries() <= 30, `daily job used ${f.queries()} queries`);
    assert.equal(
      await settleOneBeastV2Day(f.db, owner, end + 1, () => {
        throw Error('replay');
      }),
      false,
    );
    assert.equal(f.state().qi, 110);
    assert.equal(
      f.raw.prepare("SELECT COUNT(*) AS n FROM beast_skill_events WHERE kind='v2:day'").get()!.n,
      1,
    );
  } finally {
    f.raw.close();
  }
});

test('daily v2 never skips an older pending day to pay a later ready one', async () => {
  const f = fixture();
  try {
    f.addDay(day, { sleep: null });
    f.addDay(day + 1);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 86400001, () => 0), false);
    assert.equal(f.state().qi, 100);
    assert.equal(f.raw.prepare('SELECT last_day FROM beast_v2_runtime').get()!.last_day, null);
  } finally {
    f.raw.close();
  }
});

test('daily v2 waits out sleep undo window even when a day is closed', async () => {
  const f = fixture();
  try {
    f.addDay(day);
    f.raw
      .prepare(
        `INSERT INTO sleep_controls(owner,generation,day,reported_at,undo_until,before_json,after_json)
      VALUES(?,1,?,?,?,'{}','{}')`,
      )
      .run(owner, day, end - 1, end + 100);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), false);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 100, () => 0), true);
    assert.equal(f.state().qi, 102);
  } finally {
    f.raw.close();
  }
});

test('daily v2 waits for recovery of original-day chat task rewards before freezing perfect-day count', async () => {
  const f = fixture();
  try {
    f.addDay(day);
    f.raw
      .prepare(
        "INSERT INTO tasks(id,owner,title,created) VALUES('pending_chat_task',?,'Chat task',?)",
      )
      .run(owner, start);
    f.raw.exec("UPDATE tasks SET status='completed' WHERE id='pending_chat_task'");
    f.raw
      .prepare("UPDATE task_completions SET completed_at=? WHERE task_id='pending_chat_task'")
      .run(start + 60000);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), false);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_v2_days').get()!.n, 0);
    f.raw
      .prepare(
        "INSERT INTO task_ticket_awards(owner,task_id,created) VALUES(?,'pending_chat_task',?)",
      )
      .run(owner, start + 60000);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 2, () => 0), true);
  } finally {
    f.raw.close();
  }
});

test('daily v2 closes a suspended unscored day without rewards and resets consecutive progress only', async () => {
  const f = fixture();
  try {
    f.addDay(day, { sleep: null });
    f.raw.exec(
      "UPDATE cultivation_accounts SET state_json=json_set(state_json,'$.suspended',json('true'))",
    );
    const previous = initialBeastV2State();
    previous.lastDay = day - 1;
    previous.counters = { sleep100: 2, sleepAccum95: 2 };
    f.raw
      .prepare('INSERT INTO beast_v2_states VALUES(?,?,?)')
      .run(owner, 'daily_attempt', JSON.stringify(previous));
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), true);
    assert.equal(f.state().qi, 100);
    assert.equal(f.skill().counters.sleep100, 0);
    assert.equal(f.skill().counters.sleepAccum95, 2);
    assert.equal(f.raw.prepare('SELECT sleep_streak FROM beast_v2_runtime').get()!.sleep_streak, 0);
  } finally {
    f.raw.close();
  }
});

test('daily v2 uses the latched original attempt after same-day elixir reset changes role history', async () => {
  const f = fixture();
  try {
    f.addDay(day, { count: 1 });
    f.raw
      .prepare(
        `INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,created)
      VALUES(?,'new_attempt','daily_beast',1,1,'ready',800,'[]',?)`,
      )
      .run(owner, end);
    f.raw.exec(
      "UPDATE beasts SET current_attempt_id='new_attempt'; UPDATE beast_roles SET attempt_id='new_attempt'",
    );
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), true);
    assert.equal(f.state().qi, 102, 'original completed T4 receives its sleep talent');
    assert.equal(
      f.raw.prepare('SELECT attempt_id FROM beast_v2_states').get()!.attempt_id,
      'daily_attempt',
    );
  } finally {
    f.raw.close();
  }
});

test('daily v2 gaps break consecutive milestones instead of joining across missing schedule days', async () => {
  const f = fixture();
  try {
    f.addDay(day);
    const previous = initialBeastV2State();
    previous.lastDay = day - 2;
    previous.counters = { sleep100: 2 };
    f.raw
      .prepare('INSERT INTO beast_v2_states VALUES(?,?,?)')
      .run(owner, 'daily_attempt', JSON.stringify(previous));
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), true);
    assert.equal(f.state().qi, 102);
    assert.equal(f.skill().counters.sleep100, 1);
  } finally {
    f.raw.close();
  }
});

test('daily v2 uses closing skill level for the same original attempt rather than its morning snapshot', async () => {
  const f = fixture();
  try {
    f.addDay(day, { count: 1 });
    f.raw.exec(
      "UPDATE beast_v2_days SET snapshot_json=json_set(snapshot_json,'$.attempt.form',1,'$.attempt.earned',0,'$.attempt.status','ready')",
    );
    // RNG=0.9 would miss the morning T1's 25%; at close the same attempt was
    // already fully trained T4 (the training settlement preserves that level).
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0.9), true);
    assert.equal(f.state().qi, 102);
  } finally {
    f.raw.close();
  }
});

test('daily v2 self-burn charges 12 base times three exactly once without counting as earned', async () => {
  const f = fixture('pyropup');
  try {
    f.addDay(day, { count: 1 });
    f.raw.exec(
      "UPDATE beast_v2_days SET snapshot_json=json_set(snapshot_json,'$.multiplier',3,'$.startSleepStreak',30)",
    );
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 1, () => 0), true);
    assert.equal(f.state().qi, 64);
    assert.equal(f.state().earned, 100);
    assert.equal(await settleOneBeastV2Day(f.db, owner, end + 2, () => 0), false);
    assert.equal(f.state().qi, 64);
  } finally {
    f.raw.close();
  }
});

test('daily v2 stale runtime version rolls back wallet, counters, journal and day settlement together', async () => {
  const f = fixture();
  try {
    f.addDay(day);
    const conflicting = {
      prepare: f.db.prepare.bind(f.db),
      batch: async (statements: Parameters<typeof f.db.batch>[0]) => {
        f.raw.exec('UPDATE beast_v2_runtime SET version=version+1');
        return f.db.batch(statements);
      },
    };
    await assert.rejects(
      settleOneBeastV2Day(conflicting, owner, end + 1, () => 0),
      /CHECK constraint/,
    );
    assert.equal(f.state().qi, 100);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_v2_states').get()!.n, 0);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_skill_events').get()!.n, 0);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM beast_v2_days').get()!.n, 0);
    assert.equal(f.raw.prepare('SELECT last_day FROM beast_v2_runtime').get()!.last_day, null);
  } finally {
    f.raw.close();
  }
});
