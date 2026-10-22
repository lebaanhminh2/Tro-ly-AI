import { operatingDay, type HealthyState } from '../../domain/healthy.ts';
import type { BeastAccount } from '../../domain/linh-thu-account.ts';
import { trainingView, type BeastAttempt } from '../../domain/linh-thu-training.ts';
import {
  initialBeastV2State,
  beastV2Multiplier,
  beastV2SkillProgress,
  type BeastV2Context,
  type BeastV2State,
  type BeastV2Reward,
} from '../../domain/linh-thu-v2.ts';
import { query, type Database, type Statement } from './database.ts';

export type BeastV2DaySnapshot = {
  multiplier: 1 | 3;
  startSleepStreak: number;
  beastId: string | null;
  attemptId: string | null;
  attempt: BeastAttempt | null;
};
export type BeastV2RuntimeContext = {
  active: boolean;
  owner: string;
  day: number;
  now: number;
  runtime: { version: number; cutoverDay: number; lastDay: number | null; sleepStreak: number };
  account: BeastAccount;
  accountVersion: number;
  beast: {
    id: string;
    attemptId: string;
    attempt: BeastAttempt;
    skills: BeastV2Context;
    state: BeastV2State;
  } | null;
  snapshot: BeastV2DaySnapshot;
  snapshotExists: boolean;
  taskCount: number;
  beforeNoonTasks: number;
  settled: boolean;
  taskBuff: { qi: number; tickets: number };
  /** Immediate quotas belong to their source day, including delayed recovery. */
  dayState: BeastV2State['daily'];
};

/** Bootstrap changes metadata only, never wallet/skill counters or old receipts. */
export async function initializeBeastV2Runtime(
  db: Database,
  owner: string,
  cutoverDay: number,
  now: number,
): Promise<void> {
  await query(
    db,
    `INSERT INTO beast_v2_runtime(owner,cutover_day,updated)
     SELECT owner,?,? FROM beast_accounts WHERE owner=?
     ON CONFLICT(owner) DO NOTHING`,
    cutoverDay,
    now,
    owner,
  ).run();
}

/** Actual consecutive on-time assessments, independent of protected game streaks. */
export async function beastV2SleepStreak(db: Database, owner: string, throughDay: number) {
  const row = await query(
    db,
    `WITH nights AS (
       SELECT day,ROW_NUMBER() OVER(ORDER BY day DESC) AS position
       FROM sleep_assessments WHERE owner=? AND day<=? AND result='on_time'
     ) SELECT COUNT(*) AS total FROM nights WHERE day=?-position+1`,
    owner,
    throughDay,
    throughDay,
  ).first<{ total: number }>();
  return row?.total ?? 0;
}

export function beastV2AttemptContext(attempt: BeastAttempt): BeastV2Context {
  const view = trainingView(attempt);
  return {
    speciesId: attempt.speciesId,
    form: view.form,
    awakened: view.awakened,
    perfect: view.perfect,
  };
}

/** One joined read for current source context; historical day latch is immutable. */
export async function readBeastV2Context(
  db: Database,
  owner: string,
  day: number,
  now: number,
): Promise<BeastV2RuntimeContext | null> {
  const row = await query(
    db,
    `SELECT ba.state_json AS account_json,ba.version AS account_version,
      rt.version,rt.cutover_day,rt.last_day,rt.sleep_streak,
      ss.start_minutes,
      (SELECT day FROM schedule_days WHERE owner=ba.owner AND start_at<=? AND end_at>?
        ORDER BY day DESC LIMIT 1) AS current_day,
      b.id AS beast_id,b.species_id,a.id AS attempt_id,a.rule_version,a.form,a.status,a.earned,a.gray,
      st.state_json AS skill_json,d.snapshot_json,d.task_count,d.before_noon_tasks,d.settled,d.daily_json,
      EXISTS(SELECT 1 FROM beast_roles gap WHERE gap.owner=ba.owner AND gap.role='companion'
        AND gap.effective_day>(SELECT MAX(e.day) FROM beast_skill_events e
          WHERE e.owner=ba.owner AND e.kind='v2:breakthrough' AND e.beast_id=b.id)
        AND gap.effective_day<=? AND (gap.attempt_id IS NULL OR gap.attempt_id<>a.id)) AS interrupted_breakthrough,
      (SELECT COALESCE(SUM(json_extract(reward_json,'$.qi')),0) FROM beast_v2_buffs
        WHERE owner=ba.owner AND effective_day=?) AS buff_qi,
      (SELECT COALESCE(SUM(json_extract(reward_json,'$.tickets')),0) FROM beast_v2_buffs
        WHERE owner=ba.owner AND effective_day=?) AS buff_tickets
     FROM beast_accounts ba
     LEFT JOIN beast_v2_runtime rt ON rt.owner=ba.owner
     LEFT JOIN schedule_settings ss ON ss.owner=ba.owner
     LEFT JOIN beast_roles r ON r.owner=ba.owner AND r.role='companion'
       AND r.effective_day=(SELECT MAX(effective_day) FROM beast_roles
         WHERE owner=ba.owner AND role='companion' AND effective_day<=?)
     LEFT JOIN beasts b ON b.owner=r.owner AND b.id=r.beast_id AND b.sacrificed_at IS NULL
     LEFT JOIN beast_attempts a ON a.owner=b.owner AND a.beast_id=b.id AND a.id=r.attempt_id
     LEFT JOIN beast_v2_states st ON st.owner=a.owner AND st.attempt_id=a.id
     LEFT JOIN beast_v2_days d ON d.owner=ba.owner AND d.day=?
     WHERE ba.owner=?`,
    now,
    now,
    day,
    day,
    day,
    day,
    day,
    owner,
  ).first<{
    account_json: string;
    account_version: number;
    version: number | null;
    cutover_day: number;
    last_day: number | null;
    sleep_streak: number;
    start_minutes: number | null;
    current_day: number | null;
    beast_id: string | null;
    species_id: string;
    attempt_id: string | null;
    rule_version: 1;
    form: BeastAttempt['form'];
    status: BeastAttempt['status'];
    earned: number;
    gray: number;
    skill_json: string | null;
    interrupted_breakthrough: number;
    snapshot_json: string | null;
    daily_json: string | null;
    task_count: number | null;
    before_noon_tasks: number | null;
    settled: number | null;
    buff_qi: number;
    buff_tickets: number;
  }>();
  if (!row) return null;
  if (row.version === null) {
    // Existing accounts retain the current operating day under v1. Requested
    // source day may be old; never use it to backdate the cutover.
    const currentDay = row.current_day ?? operatingDay(now, row.start_minutes ?? 0);
    await initializeBeastV2Runtime(db, owner, currentDay + 1, now);
    return readBeastV2Context(db, owner, day, now);
  }
  const attempt: BeastAttempt | null =
    row.beast_id && row.attempt_id
      ? {
          speciesId: row.species_id,
          ruleVersion: row.rule_version,
          form: row.form,
          status: row.status,
          earned: row.earned,
          gray: row.gray,
        }
      : null;
  const beast = attempt
    ? {
        id: row.beast_id!,
        attemptId: row.attempt_id!,
        attempt,
        skills: beastV2AttemptContext(attempt),
        state: row.skill_json
          ? (JSON.parse(row.skill_json) as BeastV2State)
          : initialBeastV2State(),
      }
    : null;
  // Consecutive breakthrough attempts cannot cross an absence from companion
  // duty. Day-cycle counters settle separately in chronological day order.
  if (beast && row.interrupted_breakthrough) beast.state.counters.breakthroughFailures = 0;
  let snapshot: BeastV2DaySnapshot;
  if (row.snapshot_json) snapshot = JSON.parse(row.snapshot_json) as BeastV2DaySnapshot;
  else {
    const streak =
      row.last_day === day - 1 ? row.sleep_streak : await beastV2SleepStreak(db, owner, day - 1);
    snapshot = {
      startSleepStreak: streak,
      multiplier: beast ? beastV2Multiplier(beast.skills, streak) : 1,
      beastId: beast?.id ?? null,
      attemptId: beast?.attemptId ?? null,
      attempt,
    };
  }
  return {
    active: day >= row.cutover_day,
    owner,
    day,
    now,
    runtime: {
      version: row.version,
      cutoverDay: row.cutover_day,
      lastDay: row.last_day,
      sleepStreak: row.sleep_streak,
    },
    account: JSON.parse(row.account_json) as BeastAccount,
    accountVersion: row.account_version,
    beast,
    snapshot,
    snapshotExists: row.snapshot_json !== null,
    taskCount: row.task_count ?? 0,
    beforeNoonTasks: row.before_noon_tasks ?? 0,
    settled: !!row.settled,
    taskBuff: { qi: row.buff_qi, tickets: row.buff_tickets },
    dayState: row.daily_json
      ? (JSON.parse(row.daily_json) as BeastV2State['daily'])
      : beast?.state.daily.day === day
        ? { ...beast.state.daily }
        : { ...initialBeastV2State().daily, day },
  };
}

/** A single read for the companion UI; never added to the reward write path. */
export async function readBeastV2SkillProgress(db: Database, context: BeastV2RuntimeContext) {
  const beast = context.beast;
  if (!context.active || !beast) return null;
  const row = await query(
    db,
    `
    WITH identity(owner,day,beast_id,attempt_id,last_day,now) AS (VALUES(?,?,?,?,?,?)),
    events AS (
      SELECT e.day,j.value AS name FROM identity i
      JOIN beast_skill_events e ON e.owner=i.owner AND e.beast_id=i.beast_id
        AND e.day IN(i.day,i.last_day) AND e.skill_version=2
      JOIN json_each(e.result_json,'$.triggered') j
      WHERE (e.kind='v2:task' AND (
        EXISTS(SELECT 1 FROM task_completions tc WHERE tc.owner=i.owner AND tc.task_id=e.source_id
          AND json_extract(tc.beast_source_json,'$.attemptId')=i.attempt_id)
        OR (NOT EXISTS(SELECT 1 FROM task_completions tc WHERE tc.owner=i.owner AND tc.task_id=e.source_id AND tc.beast_source_json IS NOT NULL)
          AND EXISTS(SELECT 1 FROM beast_v2_days d JOIN beast_attempts a ON a.owner=d.owner AND a.id=i.attempt_id
            WHERE d.owner=i.owner AND d.day=e.day AND json_extract(d.snapshot_json,'$.attemptId')=i.attempt_id AND e.created>=a.created))
      )) OR (e.kind='v2:day' AND EXISTS(SELECT 1 FROM beast_v2_days d WHERE d.owner=i.owner
        AND d.day=e.day AND json_extract(d.snapshot_json,'$.attemptId')=i.attempt_id))
    )
    SELECT
      (SELECT json_group_array(DISTINCT name) FROM events WHERE day=i.day) AS today_json,
      (SELECT json_group_array(DISTINCT name) FROM events WHERE day=i.last_day) AS recent_json,
      (SELECT json_object(
        'active',t.expires_at>i.now AND json_extract(t.state_json,'$.status') IN('choosing','decision'),
        'available',json_extract(t.state_json,'$.rescueAvailable')=1 AND json_extract(t.eligibility_json,'$.rescueBeastId')=i.beast_id AND t.created>=a.created,
        'used',json_extract(t.state_json,'$.rescued')=1 AND json_extract(t.eligibility_json,'$.rescueBeastId')=i.beast_id AND t.created>=a.created)
       FROM beast_tower_runs t JOIN beast_attempts a ON a.owner=t.owner AND a.id=i.attempt_id
       WHERE t.owner=i.owner AND t.day=i.day) AS tower_json
    FROM identity i`,
    context.owner,
    context.day,
    beast.id,
    beast.attemptId,
    beast.state.lastDay ?? -1,
    context.now,
  ).first<{ today_json: string; recent_json: string; tower_json: string | null }>();
  return {
    beastId: beast.id,
    attemptId: beast.attemptId,
    items: beastV2SkillProgress(beast.skills, beast.state, {
      day: context.day,
      taskCount: context.taskCount,
      daily: context.dayState,
      startSleepStreak: context.snapshot.startSleepStreak,
      multiplier: context.snapshot.multiplier,
      claimedToday: JSON.parse(row?.today_json ?? '[]') as string[],
      recentRewards: JSON.parse(row?.recent_json ?? '[]') as string[],
      tower: row?.tower_json
        ? (JSON.parse(row.tower_json) as { active: boolean; available: boolean; used: boolean })
        : null,
    }),
  };
}

export function beastV2ContextGuards(db: Database, context: BeastV2RuntimeContext): Statement[] {
  return [
    query(
      db,
      'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM beast_v2_runtime WHERE owner=?)=? THEN 1 ELSE 0 END',
      context.owner,
      context.runtime.version,
    ),
    query(
      db,
      'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM beast_accounts WHERE owner=?)=? THEN 1 ELSE 0 END',
      context.owner,
      context.accountVersion,
    ),
  ];
}

export function multiplyBeastV2Reward<
  T extends {
    qi?: number;
    tickets?: number;
    summonTickets?: number;
    items?: Partial<HealthyState['inventory']>;
  },
>(reward: T, multiplier: number): T {
  return {
    ...reward,
    ...(reward.qi === undefined ? {} : { qi: reward.qi * multiplier }),
    ...(reward.tickets === undefined ? {} : { tickets: reward.tickets * multiplier }),
    ...(reward.summonTickets === undefined
      ? {}
      : { summonTickets: reward.summonTickets * multiplier }),
    ...(reward.items === undefined
      ? {}
      : {
          items: Object.fromEntries(
            Object.entries(reward.items).map(([key, value]) => [key, value! * multiplier]),
          ),
        }),
  };
}

/** Apply earned reward separately from refunds/products and nonnegative penalties. */
export function creditBeastV2Reward(
  state: HealthyState,
  reward: Partial<BeastV2Reward>,
  refund = 0,
  penalty = 0,
): HealthyState {
  const next = {
    ...state,
    inventory: { ...state.inventory },
    qi: Math.max(0, state.qi + (reward.qi ?? 0) + refund - penalty),
    earned: state.earned + (reward.qi ?? 0),
    tickets: state.tickets + (reward.tickets ?? 0),
  };
  for (const [item, amount] of Object.entries(reward.items ?? {}))
    next.inventory[item as keyof HealthyState['inventory']] += amount;
  return next;
}
