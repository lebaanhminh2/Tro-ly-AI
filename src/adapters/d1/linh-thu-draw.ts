import { drawReward, type HealthyState } from '../../domain/healthy.ts';
import {
  applyBeastPassives,
  addSkillReward,
  type SkillReward,
} from '../../domain/linh-thu-skills.ts';
import { beastCalendarWeek } from '../../domain/linh-thu-ultimates.ts';
import { creditBeastReward } from './linh-thu-effects.ts';
import { D1BeastStore } from './linh-thu-store.ts';
import { query, type Database, type Statement } from './database.ts';

export type DrawLoot = ReturnType<typeof drawReward>['reward'];
export function drawLootReward(loot: readonly DrawLoot[]): SkillReward {
  const reward: SkillReward = {};
  for (const key of loot) {
    if (key === 'qi1' || key === 'qi2') reward.qi = (reward.qi ?? 0) + (key === 'qi1' ? 1 : 2);
    else {
      reward.items ??= {};
      reward.items[key] = (reward.items[key] ?? 0) + 1;
    }
  }
  return reward;
}

export async function prepareBeastDraw(
  db: Database,
  owner: string,
  requestId: string,
  day: number,
  now: number,
  count: 1 | 10,
  random: () => number,
) {
  const store = new D1BeastStore(db),
    account = await store.read(owner);
  if (account.activatedDay === null) return null;
  const roles = await store.roles(owner, day),
    role = roles.current.find((role) => role.role === 'companion');
  const beast = role?.beastId ? await store.individual(owner, role.beastId, role.attemptId!) : null;
  const ultimate = await store.ultimate(owner, beastCalendarWeek(now));
  const ordinal =
    (
      await query(
        db,
        `SELECT COALESCE(SUM(COALESCE(json_extract(r.request_json,'$.count'),1)),0) AS total
    FROM cultivation_receipts r JOIN schedule_days d ON d.owner=r.owner AND d.day=?
    WHERE r.owner=? AND r.operation='draw' AND r.created>=d.start_at AND r.created<d.end_at`,
        day,
        owner,
      ).first<{ total: number }>()
    )?.total ?? 0;
  return (healthy: HealthyState) => {
    if (healthy.suspended || healthy.tickets < count) throw Error('NO_TICKETS');
    let state = { ...healthy, tickets: healthy.tickets - count },
      counters = { ...beast?.counters };
    const nextAccount = { ...account.state },
      nextUltimate = ultimate ? { ...ultimate } : null;
    const statements: Statement[] = [
      query(
        db,
        'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM beast_accounts WHERE owner=?)=? THEN 1 ELSE 0 END',
        owner,
        account.version,
      ),
    ];
    const rewards: DrawLoot[] = [],
      choices: { id: string; candidates: DrawLoot[]; picks: number }[] = [];
    for (let i = 0; i < count; i++) {
      const sourceId = `${requestId}:${i}`,
        nth = ordinal + i + 1;
      const boosted =
        nextUltimate &&
        !nextUltimate.cancelled &&
        !nextUltimate.settled &&
        nextUltimate.remaining > 0 &&
        nextUltimate.expiresAt > now &&
        nth <= 10 &&
        ['draw_three_two', 'draw_two_one'].includes(nextUltimate.kind);
      if (boosted) {
        const candidates = Array.from(
          { length: nextUltimate.kind === 'draw_three_two' ? 3 : 2 },
          () => drawReward({ ...healthy, tickets: 1 }, random()).reward,
        );
        const choice = {
          id: 'draw:' + sourceId,
          candidates,
          picks: nextUltimate.kind === 'draw_three_two' ? 2 : 1,
        };
        choices.push(choice);
        nextUltimate.remaining--;
        statements.push(
          query(
            db,
            "INSERT INTO beast_choices(owner,id,kind,state_json,created) VALUES(?,?,'draw',?,?)",
            owner,
            choice.id,
            JSON.stringify({
              ...choice,
              day,
              ordinal: nth,
              companion: beast
                ? { id: beast.id, attemptId: beast.attemptId, attempt: beast.attempt }
                : null,
            }),
            now,
          ),
        );
      } else {
        const loot = drawReward({ ...healthy, tickets: 1 }, random()).reward;
        rewards.push(loot);
        const base = drawLootReward([loot]);
        state = creditBeastReward(state, base);
        if (beast) {
          const effect = applyBeastPassives(
            beast.attempt,
            counters,
            { trigger: 'draw', day, ordinal: nth, qualified: !!base.qi },
            random,
          );
          counters = effect.counters;
          state = creditBeastReward(state, effect.reward);
          nextAccount.summonTickets += effect.reward.summonTickets ?? 0;
        }
      }
      statements.push(
        query(
          db,
          "INSERT INTO beast_skill_events(owner,source_id,kind,day,beast_id,skill_version,result_json,created) VALUES(?,?,'draw',?,?,1,?,?)",
          owner,
          sourceId,
          day,
          beast?.id ?? null,
          JSON.stringify({ ordinal: nth, pending: !!boosted }),
          now,
        ),
      );
    }
    statements.push(
      query(
        db,
        'UPDATE beast_accounts SET state_json=?,version=version+1,updated=? WHERE owner=?',
        JSON.stringify(nextAccount),
        now,
        owner,
      ),
    );
    if (beast)
      statements.push(
        query(
          db,
          'UPDATE beast_attempts SET counters_json=? WHERE owner=? AND id=?',
          JSON.stringify(counters),
          owner,
          beast.attemptId,
        ),
      );
    if (nextUltimate)
      statements.push(
        query(
          db,
          'UPDATE beast_ultimates SET state_json=? WHERE owner=? AND week_start=?',
          JSON.stringify(nextUltimate),
          owner,
          nextUltimate.week,
        ),
      );
    return {
      state,
      statements,
      result: {
        count,
        rewards,
        ...(count === 1 && rewards.length ? { reward: rewards[0] } : {}),
        choices,
      },
    };
  };
}

export async function chooseBeastDraw(
  db: Database,
  owner: string,
  choiceId: string,
  picks: number[],
  now: number,
  random: () => number,
  expectedVersion?: number,
) {
  const row = await query(
    db,
    "SELECT state_json FROM beast_choices WHERE owner=? AND id=? AND kind='draw' AND resolved_at IS NULL",
    owner,
    choiceId,
  ).first<{ state_json: string }>();
  if (!row) throw Error('BEAST_CHOICE_CLOSED');
  const choice = JSON.parse(row.state_json);
  if (
    !Array.isArray(picks) ||
    picks.length !== choice.picks ||
    new Set(picks).size !== picks.length ||
    picks.some((i) => !Number.isInteger(i) || i < 0 || i >= choice.candidates.length)
  )
    throw Error('INVALID_BEAST_CHOICE');
  const store = new D1BeastStore(db),
    account = await store.read(owner);
  if (expectedVersion !== undefined && account.version !== expectedVersion)
    throw Error('BEAST_CHANGED');
  const beast = choice.companion
    ? await store.individual(owner, choice.companion.id, choice.companion.attemptId)
    : null;
  const rewards = picks.map((i) => choice.candidates[i] as DrawLoot),
    reward = drawLootReward(rewards);
  const passive = beast
    ? applyBeastPassives(
        choice.companion.attempt,
        beast.counters,
        { trigger: 'draw', day: choice.day, ordinal: choice.ordinal, qualified: !!reward.qi },
        random,
      )
    : null;
  if (passive) addSkillReward(reward, passive.reward);
  const result = { choiceId, rewards, reward };
  const statements: Statement[] = [
    query(
      db,
      'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM beast_accounts WHERE owner=?)=? AND EXISTS(SELECT 1 FROM beast_choices WHERE owner=? AND id=? AND resolved_at IS NULL) THEN 1 ELSE 0 END',
      owner,
      account.version,
      owner,
      choiceId,
    ),
    query(
      db,
      'UPDATE beast_accounts SET state_json=?,version=version+1,updated=? WHERE owner=?',
      JSON.stringify({
        ...account.state,
        summonTickets: account.state.summonTickets + (reward.summonTickets ?? 0),
      }),
      now,
      owner,
    ),
    query(
      db,
      'UPDATE beast_choices SET resolved_at=?,result_json=? WHERE owner=? AND id=?',
      now,
      JSON.stringify(result),
      owner,
      choiceId,
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
  return {
    apply: (healthy: HealthyState) => creditBeastReward(healthy, reward),
    result,
    statements,
  };
}
