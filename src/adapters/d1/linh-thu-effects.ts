import {
  addSkillReward,
  applyBeastPassives,
  type SkillReward,
} from '../../domain/linh-thu-skills.ts';
import {
  applyBeastUltimate,
  beastCalendarWeek,
  type UltimateEvent,
  type UltimateOutcome,
} from '../../domain/linh-thu-ultimates.ts';
import type { HealthyState, SleepAssessment } from '../../domain/healthy.ts';
import { D1BeastReader } from './linh-thu-reader.ts';
import { query, type Database, type Statement } from './database.ts';
import { habitWeekStart } from '../../domain/habits.ts';
import type { BeastAttempt } from '../../domain/linh-thu-training.ts';
import { readBeastV2Context, beastV2AttemptContext } from './linh-thu-v2-context.ts';
import {
  initialBeastV2State,
  beastV2Multiplier,
  type BeastV2State,
} from '../../domain/linh-thu-v2.ts';
import { prepareBeastV2Effect } from './linh-thu-v2-effects.ts';
import { runFusionBatch, type FusionBatchInput } from './cultivation-fusion.ts';

export function creditBeastReward(
  healthy: HealthyState,
  reward: SkillReward,
  refund = 0,
): HealthyState {
  const next = {
    ...healthy,
    inventory: { ...healthy.inventory },
    qi: healthy.qi + (reward.qi ?? 0) + refund,
    earned: healthy.earned + (reward.qi ?? 0),
    tickets: healthy.tickets + (reward.tickets ?? 0),
  };
  for (const [item, amount] of Object.entries(reward.items ?? {}))
    next.inventory[item as keyof typeof next.inventory] += amount;
  return next;
}

/** Prepared writes join the source operation's HealthyStore batch and version guard. */
export async function prepareBeastEffect(
  db: Database,
  owner: string,
  event: UltimateEvent,
  now: number,
  random: () => number,
  attemptOverride?: BeastAttempt,
  fusionBatch?: FusionBatchInput,
) {
  const v2 = await readBeastV2Context(db, owner, event.day, now);
  if (v2?.active) {
    if (event.kind === 'fusion')
      return prepareBeastV2Effect(
        db,
        owner,
        {
          kind: 'fusion',
          day: event.day,
          success: !!event.success,
          from: event.fusionTier as 'basic' | 'middle' | 'high' | 'supreme',
        },
        event.sourceId,
        now,
        random,
        { context: v2, fusionBatch },
      );
    if (event.kind === 'breakthrough')
      return prepareBeastV2Effect(
        db,
        owner,
        {
          kind: 'breakthrough',
          day: event.day,
          success: !!event.success,
          lostQi: event.actualQiLoss ?? 0,
        },
        event.sourceId,
        now,
        random,
        { context: v2 },
      );
    // Daily skill sources wait for the complete closed day and the undo window.
    // Never fall through to v1 merely because a v2 event has no immediate reward.
    return null;
  }
  const store = new D1BeastReader(db);
  const account = await store.read(owner);
  if (account.activatedDay === null || event.day < account.activatedDay) return null;
  const prior = await query(
    db,
    'SELECT 1 FROM beast_skill_events WHERE owner=? AND kind=? AND source_id=?',
    owner,
    event.kind,
    event.sourceId,
  ).first();
  if (prior) return null;
  const selections = await store.roles(owner, event.day);
  const selected = selections.current.find((role) => role.role === 'companion');
  const beast = selected?.beastId
    ? await store.individual(owner, selected.beastId, selected.attemptId!)
    : null;
  const ultimate = await store.ultimate(
    owner,
    ['sleep', 'habit', 'combined'].includes(event.kind)
      ? habitWeekStart(event.day)
      : beastCalendarWeek(event.at),
  );
  const passive = beast
    ? applyBeastPassives(
        attemptOverride ?? beast.attempt,
        beast.counters,
        {
          trigger: event.kind === 'fusion' ? 'breakthrough' : event.kind,
          day: event.day,
          ordinal: event.ordinal,
          qualified: event.kind === 'fusion' ? false : event.qualified,
          actualQiLoss: event.actualQiLoss,
        },
        random,
      )
    : null;
  let boosted: UltimateOutcome | null = ultimate ? applyBeastUltimate(ultimate, event) : null;
  let batch: ReturnType<typeof runFusionBatch> | undefined;
  if (event.kind === 'fusion' && fusionBatch) {
    let previous = ultimate;
    const rewards: SkillReward = {};
    batch = runFusionBatch(fusionBatch, random, (state, success) => {
      if (!previous) return state;
      boosted = applyBeastUltimate(previous, { ...event, success });
      previous = boosted.state;
      addSkillReward(rewards, boosted.reward);
      return creditBeastReward(state, boosted.reward);
    });
    if (boosted) boosted.reward = rewards;
    if (passive) batch.state = creditBeastReward(batch.state, passive.reward);
  }
  const reward: SkillReward = {};
  if (passive) addSkillReward(reward, passive.reward);
  if (boosted) addSkillReward(reward, boosted.reward);
  // Refunds share the same actual loss. Never stack past the loss or ultimate cap.
  const refundQi = Math.min(
    event.actualQiLoss ?? 0,
    Math.max(passive?.refundQi ?? 0, boosted?.refundQi ?? 0),
  );
  const state = {
    ...account.state,
    summonTickets: account.state.summonTickets + (reward.summonTickets ?? 0),
  };
  const result = {
    reward,
    refundQi,
    triggered: passive?.triggered ?? [],
    ultimate: boosted?.state ?? null,
    choices: boosted?.choices ?? [],
    protectStreak: boosted?.protectStreak ?? false,
    protectQi: boosted?.protectQi ?? false,
  };
  const statements: Statement[] = [
    query(
      db,
      'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM beast_accounts WHERE owner=?)=? THEN 1 ELSE 0 END',
      owner,
      account.version,
    ),
    query(
      db,
      'UPDATE beast_accounts SET state_json=?,version=version+1,updated=? WHERE owner=?',
      JSON.stringify(state),
      now,
      owner,
    ),
    query(
      db,
      'INSERT INTO beast_skill_events(owner,source_id,kind,day,beast_id,skill_version,result_json,created) VALUES(?,?,?,?,?,1,?,?)',
      owner,
      event.sourceId,
      event.kind,
      event.day,
      beast?.id ?? null,
      JSON.stringify(result),
      now,
    ),
  ];
  if (beast && passive)
    statements.push(
      query(
        db,
        'UPDATE beast_attempts SET counters_json=? WHERE owner=? AND id=?',
        JSON.stringify(passive.counters),
        owner,
        beast.attemptId,
      ),
    );
  if (boosted)
    statements.push(
      query(
        db,
        'UPDATE beast_ultimates SET state_json=? WHERE owner=? AND week_start=?',
        JSON.stringify(boosted.state),
        owner,
        boosted.state.week,
      ),
    );
  for (const choice of boosted?.choices ?? [])
    statements.push(
      query(
        db,
        "INSERT INTO beast_choices(owner,id,kind,state_json,created) VALUES(?,?,'reward',?,?)",
        owner,
        `${event.kind}:${choice.key}`,
        JSON.stringify({ options: choice.options, sourceId: event.sourceId }),
        now,
      ),
    );
  return {
    statements,
    result,
    reward,
    refundQi,
    protectStreak: boosted?.protectStreak ?? false,
    protectQi: boosted?.protectQi ?? false,
    apply: (healthy: HealthyState) => creditBeastReward(healthy, reward, refundQi),
    batch,
  };
}

export async function prepareBeastSleepEffect(
  db: Database,
  owner: string,
  healthy: HealthyState,
  input: SleepAssessment,
  random: () => number,
) {
  if (healthy.suspended || (healthy.lastScoredDay !== null && healthy.lastScoredDay >= input.day))
    return null;
  const v2 = await readBeastV2Context(db, owner, input.day, input.assessedAt);
  if (v2?.active)
    return prepareBeastV2Effect(
      db,
      owner,
      { kind: 'source_sleep', day: input.day },
      String(input.day),
      input.assessedAt,
      random,
      { context: v2 },
    );
  const prior = await query(
    db,
    "SELECT result_json FROM beast_skill_events WHERE owner=? AND kind='sleep' AND source_id=?",
    owner,
    String(input.day),
  ).first<{ result_json: string }>();
  if (prior) {
    const result = JSON.parse(prior.result_json);
    return {
      statements: [] as Statement[],
      result,
      protectStreak: !!result.protectStreak,
      protectQi: !!result.protectQi,
      apply: (state: HealthyState) => state,
    };
  }
  const onTime = input.reportedAt !== null && input.reportedAt <= input.target;
  return prepareBeastEffect(
    db,
    owner,
    {
      kind: 'sleep',
      sourceId: String(input.day),
      day: input.day,
      at: onTime ? input.reportedAt! : input.target,
      qualified: onTime,
      streakAtRisk: !onTime && healthy.streak > 0 && healthy.heartDay !== input.day,
      qiAtRisk: !onTime && healthy.peaceDay !== input.day && (healthy.qi > 0 || healthy.rank > 0),
    },
    input.assessedAt,
    random,
  );
}

export async function prepareBeastTaskEffect(
  db: Database,
  owner: string,
  taskId: string,
  now: number,
  random: () => number,
  source?: { day: number; at: number; beastSourceJson?: string | null },
) {
  const sourceAt = source?.at ?? now;
  const readDay = () =>
    query(
      db,
      'SELECT day,start_at,end_at FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY day DESC LIMIT 1',
      owner,
      sourceAt,
      sourceAt,
    ).first<{ day: number; start_at: number; end_at: number }>();
  let day = source ? null : await readDay();
  const sourceDay = source?.day ?? day?.day;
  if (sourceDay === undefined) return null;
  const v2 = await readBeastV2Context(db, owner, sourceDay, now);
  if (v2?.active && source) {
    const saved = Object.hasOwn(source, 'beastSourceJson')
      ? { beast_source_json: source.beastSourceJson }
      : await query(
          db,
          'SELECT beast_source_json FROM task_completions WHERE owner=? AND task_id=?',
          owner,
          taskId,
        ).first<{ beast_source_json: string | null }>();
    if (saved?.beast_source_json) {
      const original = JSON.parse(saved.beast_source_json) as {
        day: number;
        beastId: string | null;
        attemptId: string | null;
        attempt: BeastAttempt | null;
      };
      if (original.day !== sourceDay) throw Error('BEAST_SOURCE_DAY_CHANGED');
      if (!original.attempt || !original.beastId || !original.attemptId) v2.beast = null;
      else {
        const state =
          v2.beast?.attemptId === original.attemptId
            ? v2.beast.state
            : (
                await query(
                  db,
                  'SELECT state_json FROM beast_v2_states WHERE owner=? AND attempt_id=?',
                  owner,
                  original.attemptId,
                ).first<{ state_json: string }>()
              )?.state_json;
        v2.beast = {
          id: original.beastId,
          attemptId: original.attemptId,
          attempt: original.attempt,
          skills: beastV2AttemptContext(original.attempt),
          state:
            typeof state === 'string'
              ? (JSON.parse(state) as BeastV2State)
              : (state ?? initialBeastV2State()),
        };
      }
      if (!v2.snapshotExists)
        v2.snapshot = {
          ...v2.snapshot,
          beastId: original.beastId,
          attemptId: original.attemptId,
          attempt: original.attempt,
          multiplier: v2.beast
            ? beastV2Multiplier(v2.beast.skills, v2.snapshot.startSleepStreak)
            : 1,
        };
    }
  }
  if (v2?.active)
    return prepareBeastV2Effect(
      db,
      owner,
      {
        kind: 'task',
        day: sourceDay,
        ordinal: v2.taskCount + 1,
        localMinute: Math.floor(((sourceAt + 7 * 3600000) % 86400000) / 60000),
      },
      taskId,
      now,
      random,
      { context: v2 },
    );
  day ??= await readDay();
  if (!day) return null;
  const count = await query(
    db,
    `SELECT COUNT(*) AS total FROM task_ticket_awards a
     WHERE a.owner=? AND a.created>=? AND a.created<? AND EXISTS(
       SELECT 1 FROM cultivation_receipts r WHERE r.owner=a.owner AND r.operation='task:complete'
       AND r.created=a.created AND json_extract(r.result_json,'$.id')=a.task_id AND json_extract(r.result_json,'$.ticket')=1)`,
    owner,
    day.start_at,
    day.end_at,
  ).first<{ total: number }>();
  return prepareBeastEffect(
    db,
    owner,
    {
      kind: 'task',
      sourceId: taskId,
      day: day.day,
      at: now,
      qualified: true,
      ordinal: (count?.total ?? 0) + 1,
    },
    now,
    random,
  );
}
