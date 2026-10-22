import type { BeastAttempt } from '../../domain/linh-thu-training.ts';
import { initialBeastV2State, type BeastV2State } from '../../domain/linh-thu-v2.ts';
import { query, type Database } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import {
  beastV2AttemptContext,
  beastV2SleepStreak,
  readBeastV2Context,
  type BeastV2RuntimeContext,
} from './linh-thu-v2-context.ts';
import { prepareBeastV2Effect } from './linh-thu-v2-effects.ts';

type DayFacts = {
  day: number;
  end_at: number;
  settlement_json: string | null;
  companion_beast_id: string | null;
  sleep_result: string | null;
  sleep_final: number;
  suspended: number;
  last_scored_day: number | null;
  pending_tasks: number;
};
type HabitSettlement = {
  companionAttempt?: BeastAttempt | null;
  companionAttemptId?: string | null;
  v2Habit?: { satisfied: boolean; rewardEligible: boolean };
};

/**
 * Settle one original closed day after both upstream assessments are final.
 * Never select only ready rows: doing so could pay a later day before an older
 * pending one and destroy the meaning of consecutive milestones.
 */
export async function settleOneBeastV2Day(
  db: Database,
  owner: string,
  now: number,
  random: () => number,
): Promise<boolean> {
  const row = await query(
    db,
    `SELECT d.day,d.end_at,b.result_json AS settlement_json,b.companion_beast_id,
      s.result AS sleep_result,
      CASE WHEN NOT EXISTS(SELECT 1 FROM sleep_controls c WHERE c.owner=d.owner
        AND c.day=d.day AND c.undone_at IS NULL AND c.undo_until>?) THEN 1 ELSE 0 END AS sleep_final,
      COALESCE(json_extract(c.state_json,'$.suspended'),0) AS suspended,
      json_extract(c.state_json,'$.lastScoredDay') AS last_scored_day,
      EXISTS(SELECT 1 FROM task_completions tc JOIN tasks t ON t.owner=tc.owner AND t.id=tc.task_id
        WHERE tc.owner=d.owner AND tc.completed_at>=d.start_at AND tc.completed_at<d.end_at
        AND t.status='completed' AND t.deleted_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM task_ticket_awards a WHERE a.owner=t.owner AND a.task_id=t.id)) AS pending_tasks
     FROM beast_v2_runtime rt
     JOIN schedule_days d ON d.owner=rt.owner AND d.day>=rt.cutover_day
       AND (rt.last_day IS NULL OR d.day>rt.last_day)
     LEFT JOIN beast_day_settlements b ON b.owner=d.owner AND b.day=d.day
     LEFT JOIN sleep_assessments s ON s.owner=d.owner AND s.day=d.day
     LEFT JOIN cultivation_accounts c ON c.owner=d.owner
     WHERE rt.owner=? ORDER BY d.day LIMIT 1`,
    now,
    owner,
  ).first<DayFacts>();
  if (!row || row.end_at > now || !row.settlement_json || !row.sleep_final) return false;
  // Suspension and subsequent resume deliberately skip sleep scoring for absent
  // days. Those days break skill chains but cannot mint sleep/perfect rewards.
  const skippedSleep =
    row.sleep_result === null &&
    (!!row.suspended || (row.last_scored_day !== null && row.last_scored_day >= row.day));
  if (row.sleep_result === null && !skippedSleep) return false;
  // Chat completions can commit before their bounded ticket/skill recovery.
  // Do not freeze a false task count while that original-day source is pending.
  if (row.pending_tasks && !skippedSleep) return false;
  const settlement = JSON.parse(row.settlement_json) as HabitSettlement;
  if (!settlement.v2Habit) return false;
  const context = await readBeastV2Context(db, owner, row.day, now);
  if (!context?.active || context.settled) return false;
  await originalCompanion(db, context, settlement, row.companion_beast_id);
  const onTime = row.sleep_result === 'on_time';
  // This SQL helper includes actual pre-cutover nights and breaks at a missing
  // ordinal. Neither a protected game streak nor today's wallet is authoritative.
  const sleepStreak = onTime ? await beastV2SleepStreak(db, owner, row.day) : 0;
  const effect = await prepareBeastV2Effect(
    db,
    owner,
    {
      kind: 'day',
      day: row.day,
      habitSatisfied: settlement.v2Habit.satisfied,
      habitRewardEligible: settlement.v2Habit.rewardEligible,
      sleepOnTime: onTime,
      sleepStreak,
      taskCount: context.taskCount,
      active: !skippedSleep,
    },
    String(row.day),
    now,
    random,
    {
      context,
      runtimeUpdate: { lastDay: row.day, sleepStreak },
      settleDay: true,
    },
  );
  if (!effect) return false;
  await new HealthyStore(db).mutate(
    owner,
    'beast_v2_day_' + row.day,
    'beast-v2-day',
    { day: row.day },
    now,
    (state) => ({
      state: effect.apply(state),
      result: effect.result,
      statements: effect.statements,
    }),
  );
  return true;
}

async function originalCompanion(
  db: Database,
  context: BeastV2RuntimeContext,
  settlement: HabitSettlement,
  companionId: string | null,
) {
  const snapshot = context.snapshotExists ? context.snapshot : null;
  // Day events originate at close, so a same-attempt evolution/opening before
  // close uses the settlement's pre-training level. An elixir reset changes the
  // attempt identity; in that case the latched original attempt stays isolated.
  const attempt = snapshot
    ? settlement.companionAttemptId === snapshot.attemptId
      ? (settlement.companionAttempt ?? snapshot.attempt)
      : snapshot.attempt
    : (settlement.companionAttempt ?? null);
  const attemptId = snapshot
    ? snapshot.attemptId
    : (settlement.companionAttemptId ?? context.beast?.attemptId);
  const beastId = snapshot ? snapshot.beastId : companionId;
  if (!attempt || !attemptId || !beastId) {
    context.beast = null;
    return;
  }
  let state = context.beast?.attemptId === attemptId ? context.beast.state : null;
  if (!state) {
    const saved = await query(
      db,
      'SELECT state_json FROM beast_v2_states WHERE owner=? AND attempt_id=?',
      context.owner,
      attemptId,
    ).first<{ state_json: string }>();
    state = saved ? (JSON.parse(saved.state_json) as BeastV2State) : initialBeastV2State();
  }
  context.beast = {
    id: beastId,
    attemptId,
    attempt,
    skills: beastV2AttemptContext(attempt),
    state,
  };
}
