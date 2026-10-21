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
) {
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
  const boosted: UltimateOutcome | null = ultimate ? applyBeastUltimate(ultimate, event) : null;
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
) {
  const day = await query(
    db,
    'SELECT day,start_at,end_at FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY day DESC LIMIT 1',
    owner,
    now,
    now,
  ).first<{ day: number; start_at: number; end_at: number }>();
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
