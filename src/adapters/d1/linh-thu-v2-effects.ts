import type { HealthyState } from '../../domain/healthy.ts';
import type { SkillReward } from '../../domain/linh-thu-skills.ts';
import {
  reduceBeastV2,
  emptyBeastV2Reward,
  BEAST_V2_SELF_BURN_FINAL,
  type BeastV2Event,
  type BeastV2Result,
} from '../../domain/linh-thu-v2.ts';
import { query, type Database, type Statement } from './database.ts';
import {
  readBeastV2Context,
  beastV2ContextGuards,
  creditBeastV2Reward,
  multiplyBeastV2Reward,
  type BeastV2RuntimeContext,
} from './linh-thu-v2-context.ts';

export type BeastV2SourceEvent =
  BeastV2Event | { kind: 'source_sleep'; day: number } | { kind: 'reward'; day: number };
export type BeastV2EffectOptions = {
  context?: BeastV2RuntimeContext;
  extraEarned?: SkillReward;
  runtimeUpdate?: { lastDay: number; sleepStreak: number };
  settleDay?: boolean;
};

/** Return writes to join the original guarded wallet transaction, never commit them here. */
export async function prepareBeastV2Effect(
  db: Database,
  owner: string,
  event: BeastV2SourceEvent,
  sourceId: string,
  now: number,
  random: () => number,
  options: BeastV2EffectOptions = {},
) {
  const context = options.context ?? (await readBeastV2Context(db, owner, event.day, now));
  if (!context?.active) return null;
  const kind = 'v2:' + event.kind;
  const prior = await query(
    db,
    'SELECT result_json FROM beast_skill_events WHERE owner=? AND kind=? AND source_id=?',
    owner,
    kind,
    sourceId,
  ).first<{ result_json: string }>();
  const multiplier = context.snapshot.multiplier;
  if (prior)
    return {
      statements: [] as Statement[],
      result: JSON.parse(prior.result_json) as Record<string, unknown>,
      reward: emptyBeastV2Reward(),
      refundQi: 0,
      multiplier,
      protectQi: false,
      protectStreak: false,
      apply: (state: HealthyState) => state,
    };

  let outcome: BeastV2Result | null = null;
  let dayState = context.dayState;
  if (context.beast && event.kind !== 'source_sleep' && event.kind !== 'reward') {
    const previous = context.beast.state;
    outcome = reduceBeastV2(
      event.kind === 'day' ? previous : { ...previous, daily: dayState },
      context.beast.skills,
      event,
      random,
    );
    if (event.kind !== 'day') {
      dayState = outcome.state.daily;
      // A delayed original-day task must not rewind today's fusion/task quota.
      if (previous.daily.day > event.day) outcome.state.daily = previous.daily;
    }
  }
  const earned = outcome?.reward ?? emptyBeastV2Reward();
  const extra = options.extraEarned ?? {};
  earned.qi += extra.qi ?? 0;
  earned.tickets += extra.tickets ?? 0;
  earned.summonTickets += extra.summonTickets ?? 0;
  for (const [item, amount] of Object.entries(extra.items ?? {})) {
    const key = item as keyof HealthyState['inventory'];
    earned.items[key] = (earned.items[key] ?? 0) + amount;
  }
  if (event.kind === 'task') {
    earned.qi += context.taskBuff.qi;
    earned.tickets += context.taskBuff.tickets;
  }
  const reward = multiplyBeastV2Reward(earned, multiplier);
  // The second chat task can be recovered after some next-day tasks were
  // already paid. Their earned buff still belongs to that original next day.
  let retroactiveTaskBuff: { day: number; count: number; multiplier: 1 | 3 } | null = null;
  if (context.beast && outcome?.nextDayTaskBuff) {
    const target = await query(
      db,
      `SELECT task_count,snapshot_json FROM beast_v2_days WHERE owner=? AND day=?`,
      owner,
      event.day + 1,
    ).first<{ task_count: number; snapshot_json: string }>();
    if (target && target.task_count > 0) {
      const targetMultiplier = (JSON.parse(target.snapshot_json) as { multiplier: 1 | 3 })
        .multiplier;
      retroactiveTaskBuff = {
        day: event.day + 1,
        count: target.task_count,
        multiplier: targetMultiplier,
      };
      reward.qi += target.task_count * targetMultiplier;
      reward.tickets += target.task_count * targetMultiplier;
    }
  }
  const refundQi = outcome?.refundQi ?? 0;
  const products = outcome?.fusion;
  const burn = options.settleDay && multiplier === 3 ? BEAST_V2_SELF_BURN_FINAL : 0;
  const result = {
    version: 2,
    reward,
    baseReward: earned,
    refundQi,
    fusion: products ?? null,
    multiplier,
    selfBurn: burn,
    triggered: outcome?.activated ?? [],
    nextDayTaskBuff: outcome?.nextDayTaskBuff ?? false,
    retroactiveTaskBuff,
  };
  const statements: Statement[] = [
    ...beastV2ContextGuards(db, context),
    query(
      db,
      'UPDATE beast_accounts SET state_json=?,version=version+1,updated=? WHERE owner=?',
      JSON.stringify({
        ...context.account,
        summonTickets: context.account.summonTickets + reward.summonTickets,
      }),
      now,
      owner,
    ),
    query(
      db,
      `UPDATE beast_v2_runtime SET version=version+1,updated=?,
       last_day=COALESCE(?,last_day),sleep_streak=COALESCE(?,sleep_streak) WHERE owner=?`,
      now,
      options.runtimeUpdate?.lastDay ?? null,
      options.runtimeUpdate?.sleepStreak ?? null,
      owner,
    ),
    query(
      db,
      `INSERT INTO beast_v2_days(owner,day,snapshot_json,task_count,before_noon_tasks,settled,updated,daily_json)
       VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner,day) DO UPDATE SET
       task_count=excluded.task_count,before_noon_tasks=excluded.before_noon_tasks,
       settled=MAX(beast_v2_days.settled,excluded.settled),updated=excluded.updated,daily_json=excluded.daily_json`,
      owner,
      event.day,
      JSON.stringify(context.snapshot),
      event.kind === 'task' ? event.ordinal : context.taskCount,
      context.beforeNoonTasks + (event.kind === 'task' && event.localMinute < 720 ? 1 : 0),
      options.settleDay ? 1 : 0,
      now,
      JSON.stringify(dayState),
    ),
    query(
      db,
      `INSERT INTO beast_skill_events(owner,source_id,kind,day,beast_id,skill_version,result_json,created)
       VALUES(?,?,?,?,?,2,?,?)`,
      owner,
      sourceId,
      kind,
      event.day,
      context.beast?.id ?? null,
      JSON.stringify(result),
      now,
    ),
  ];
  if (context.beast && outcome)
    statements.push(
      query(
        db,
        `INSERT INTO beast_v2_states(owner,attempt_id,state_json) VALUES(?,?,?)
     ON CONFLICT(owner,attempt_id) DO UPDATE SET state_json=excluded.state_json`,
        owner,
        context.beast.attemptId,
        JSON.stringify(outcome.state),
      ),
    );
  if (context.beast && outcome?.nextDayTaskBuff)
    statements.push(
      query(
        db,
        `INSERT INTO beast_v2_buffs(owner,source_attempt_id,effective_day,kind,reward_json)
     VALUES(?,?,?,'task',?) ON CONFLICT(owner,source_attempt_id,effective_day) DO NOTHING`,
        owner,
        context.beast.attemptId,
        event.day + 1,
        JSON.stringify({ qi: 1, tickets: 1 }),
      ),
    );

  return {
    statements,
    result,
    reward,
    refundQi,
    multiplier,
    protectQi: false,
    protectStreak: false,
    apply: (state: HealthyState) => {
      const next = creditBeastV2Reward(state, reward, refundQi, burn);
      // Extra fusion output and failed-input refund are products/refunds, not
      // earned rewards: never pass them through the multiplier.
      if (products) {
        next.inventory.middle += products.extraMiddle;
        next.inventory.basic += products.refundBasic;
      }
      return next;
    },
  };
}
