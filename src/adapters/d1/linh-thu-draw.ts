import { drawReward, drawRewards, type HealthyState } from '../../domain/healthy.ts';
import {
  applyBeastPassives,
  addSkillReward,
  type SkillReward,
} from '../../domain/linh-thu-skills.ts';
import { beastCalendarWeek } from '../../domain/linh-thu-ultimates.ts';
import { creditBeastReward } from './linh-thu-effects.ts';
import { D1BeastStore } from './linh-thu-store.ts';
import { query, type Database, type Statement } from './database.ts';
import {
  validBeastAccount,
  initialBeastAccount,
  type BeastAccount,
  type OwnedBeast,
} from '../../domain/linh-thu-account.ts';
import type { BeastUltimate } from '../../domain/linh-thu-ultimates.ts';
import { readBeastV2Context, multiplyBeastV2Reward } from './linh-thu-v2-context.ts';
import { prepareBeastV2Effect } from './linh-thu-v2-effects.ts';

export type DrawLoot = ReturnType<typeof drawReward>['reward'];
export function drawLootReward(loot: readonly DrawLoot[]): SkillReward {
  const reward: SkillReward = {};
  for (const key of loot) {
    if (key === 'qi1' || key === 'qi2') reward.qi = (reward.qi ?? 0) + (key === 'qi1' ? 1 : 2);
    else if (key === 'summonTicket') reward.summonTickets = (reward.summonTickets ?? 0) + 1;
    else {
      reward.items ??= {};
      reward.items[key] = (reward.items[key] ?? 0) + 1;
    }
  }
  return reward;
}

export async function prepareCultivationDraw(
  db: Database,
  owner: string,
  requestId: string,
  requestedDay: number | undefined,
  now: number,
  count: 1 | 10,
  random: () => number,
) {
  const row = await readDrawContext(db, owner, requestedDay, now);
  if (!row || row.start_minutes === null || row.sleep_minutes === null)
    throw Error('SETUP_REQUIRED');
  return {
    day: row.day,
    startMinutes: row.start_minutes,
    apply:
      row.day === null
        ? null
        : row.cutover_day !== null && row.day >= row.cutover_day
          ? !row.id && (!row.snapshot_json || !JSON.parse(row.snapshot_json).beastId)
            ? prepareUnaccompaniedV2Draw(db, owner, requestId, row.day, now, count, random, row)
            : await prepareV2DrawEffects(db, owner, requestId, row.day, now, count, random)
          : prepareDrawEffects(db, owner, requestId, row.day, now, count, random, row),
  };
}

/** V1 compatibility preparer for existing paid-choice fixtures and receipts.
 * Live API dispatch, including v2, always uses prepareCultivationDraw. */
export async function prepareBeastDraw(
  db: Database,
  owner: string,
  requestId: string,
  day: number,
  now: number,
  count: 1 | 10,
  random: () => number,
) {
  return prepareDrawEffects(
    db,
    owner,
    requestId,
    day,
    now,
    count,
    random,
    await readDrawContext(db, owner, day, now),
  );
}

async function readDrawContext(
  db: Database,
  owner: string,
  requestedDay: number | undefined,
  now: number,
) {
  // Read the operating day with the companion context. A missing day is
  // returned to the caller for the normal day-creation path before any roll.
  return query(
    db,
    `WITH context AS (
      SELECT o.owner,s.start_minutes,s.sleep_minutes,
        COALESCE(?,(SELECT day FROM schedule_days WHERE owner=o.owner AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1)) AS day
      FROM (SELECT ? AS owner) o LEFT JOIN schedule_settings s ON s.owner=o.owner
    )
    SELECT c.day,c.start_minutes,c.sleep_minutes,ba.state_json AS account_json,ba.version,ba.activated_day,
      rt.cutover_day,rt.version AS runtime_version,vd.snapshot_json,
      CASE WHEN vd.snapshot_json IS NOT NULL THEN json_extract(vd.snapshot_json,'$.startSleepStreak')
        WHEN rt.cutover_day IS NULL OR c.day<rt.cutover_day OR b.id IS NOT NULL THEN 0
        WHEN rt.last_day=c.day-1 THEN rt.sleep_streak ELSE
        (WITH RECURSIVE nights(day) AS (
          SELECT c.day-1 WHERE EXISTS(SELECT 1 FROM sleep_assessments
            WHERE owner=c.owner AND day=c.day-1 AND result='on_time')
          UNION ALL SELECT nights.day-1 FROM nights WHERE EXISTS(SELECT 1 FROM sleep_assessments
            WHERE owner=c.owner AND day=nights.day-1 AND result='on_time')
        ) SELECT COUNT(*) FROM nights) END AS start_sleep_streak,
      u.state_json AS ultimate_json,
      b.id,b.species_id,b.acquired_at,a.id AS attempt_id,a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json,
      (SELECT COALESCE(SUM(COALESCE(json_extract(cr.request_json,'$.count'),1)),0)
       FROM cultivation_receipts cr JOIN schedule_days d ON d.owner=cr.owner AND d.day=c.day
       WHERE cr.owner=ba.owner AND cr.operation='draw' AND cr.created>=d.start_at AND cr.created<d.end_at) AS ordinal
     FROM context c LEFT JOIN beast_accounts ba ON ba.owner=c.owner
     LEFT JOIN beast_v2_runtime rt ON rt.owner=c.owner
     LEFT JOIN beast_v2_days vd ON vd.owner=c.owner AND vd.day=c.day
     LEFT JOIN beast_roles r ON r.owner=ba.owner AND r.role='companion'
       AND r.effective_day=(SELECT MAX(effective_day) FROM beast_roles WHERE owner=ba.owner AND role='companion' AND effective_day<=c.day)
     LEFT JOIN beasts b ON b.owner=ba.owner AND b.id=r.beast_id AND b.sacrificed_at IS NULL
     LEFT JOIN beast_attempts a ON a.owner=b.owner AND a.beast_id=b.id AND a.id=COALESCE(r.attempt_id,b.current_attempt_id)
     LEFT JOIN beast_ultimates u ON u.owner=ba.owner AND u.week_start=?`,
    requestedDay ?? null,
    now,
    now,
    owner,
    beastCalendarWeek(now),
  ).first<{
    day: number | null;
    start_minutes: number | null;
    sleep_minutes: number | null;
    account_json: string | null;
    version: number;
    activated_day: number | null;
    cutover_day: number | null;
    runtime_version: number;
    snapshot_json: string | null;
    start_sleep_streak: number;
    ultimate_json: string | null;
    id: string | null;
    species_id: string;
    acquired_at: number;
    attempt_id: string | null;
    rule_version: 1;
    status: OwnedBeast['attempt']['status'];
    earned: number;
    gray: number;
    form: NonNullable<OwnedBeast['attempt']['form']>;
    counters_json: string;
    ordinal: number;
  }>();
}

/** No beast counters can fire. Keep ordinary paid draws at wallet/context/batch,
 * including the day latch and guards in that same transaction. */
function prepareUnaccompaniedV2Draw(
  db: Database,
  owner: string,
  requestId: string,
  day: number,
  now: number,
  count: 1 | 10,
  random: () => number,
  row: NonNullable<Awaited<ReturnType<typeof readDrawContext>>>,
) {
  const snapshot = row.snapshot_json
    ? JSON.parse(row.snapshot_json)
    : {
        multiplier: 1,
        startSleepStreak: row.start_sleep_streak,
        beastId: null,
        attemptId: null,
        attempt: null,
      };
  return (healthy: HealthyState) => {
    if (healthy.suspended || healthy.tickets < count) throw Error('NO_TICKETS');
    const rewards = Array.from(
      { length: count },
      () => drawReward({ ...healthy, tickets: 1 }, random()).reward,
    );
    const baseReward = drawLootReward(rewards);
    const earnedReward = multiplyBeastV2Reward(baseReward, snapshot.multiplier);
    return {
      state: creditBeastReward({ ...healthy, tickets: healthy.tickets - count }, earnedReward),
      statements: [
        query(
          db,
          'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM beast_accounts WHERE owner=?)=? AND (SELECT version FROM beast_v2_runtime WHERE owner=?)=? THEN 1 ELSE 0 END',
          owner,
          row.version,
          owner,
          row.runtime_version,
        ),
        query(
          db,
          `INSERT INTO beast_v2_days(owner,day,snapshot_json,updated) VALUES(?,?,?,?)
          ON CONFLICT(owner,day) DO NOTHING`,
          owner,
          day,
          JSON.stringify(snapshot),
          now,
        ),
        ...(earnedReward.summonTickets
          ? [
              query(
                db,
                "UPDATE beast_accounts SET state_json=json_set(state_json,'$.summonTickets',json_extract(state_json,'$.summonTickets')+?),version=version+1,updated=? WHERE owner=?",
                earnedReward.summonTickets,
                now,
                owner,
              ),
            ]
          : []),
        query(
          db,
          `INSERT INTO beast_skill_events(owner,source_id,kind,day,beast_id,skill_version,result_json,created)
          VALUES(?,?,'v2:draw',?,NULL,2,?,?)`,
          owner,
          requestId,
          day,
          JSON.stringify({
            version: 2,
            count,
            reward: earnedReward,
            baseReward,
            multiplier: snapshot.multiplier,
            refundQi: 0,
            triggered: [],
          }),
          now,
        ),
      ],
      result: {
        count,
        rewards,
        ...(count === 1 ? { reward: rewards[0] } : {}),
        choices: [],
        earnedReward,
      },
    };
  };
}

async function prepareV2DrawEffects(
  db: Database,
  owner: string,
  requestId: string,
  day: number,
  now: number,
  count: 1 | 10,
  random: () => number,
) {
  const context = await readBeastV2Context(db, owner, day, now);
  return async (healthy: HealthyState) => {
    // No loot or pity roll until all original input tickets are available.
    if (healthy.suspended || healthy.tickets < count) throw Error('NO_TICKETS');
    const rewards = Array.from(
      { length: count },
      () => drawReward({ ...healthy, tickets: 1 }, random()).reward,
    );
    const baseReward = drawLootReward(rewards);
    const effect = await prepareBeastV2Effect(
      db,
      owner,
      { kind: 'draw', day, count },
      requestId,
      now,
      random,
      { ...(context ? { context } : {}), extraEarned: baseReward },
    );
    if (!effect) throw Error('BEAST_V2_CONTEXT_CHANGED');
    return {
      state: effect.apply({ ...healthy, tickets: healthy.tickets - count }),
      statements: effect.statements,
      result: {
        count,
        rewards,
        ...(count === 1 ? { reward: rewards[0] } : {}),
        choices: [],
        earnedReward: effect.reward,
        beastEffect: effect.result,
      },
    };
  };
}

function prepareDrawEffects(
  db: Database,
  owner: string,
  requestId: string,
  day: number,
  now: number,
  count: 1 | 10,
  random: () => number,
  row: Awaited<ReturnType<typeof readDrawContext>>,
) {
  if (!row) return null;
  if (row.account_json === null || row.activated_day === null)
    return (healthy: HealthyState) => {
      const drawn = drawRewards(healthy, count, random);
      const statements: Statement[] = [];
      if (drawn.summonTickets) {
        const account = { ...initialBeastAccount(), summonTickets: drawn.summonTickets };
        statements.push(
          query(
            db,
            'INSERT INTO transaction_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM beast_accounts WHERE owner=?) THEN 1 ELSE 0 END',
            owner,
          ),
          query(
            db,
            'INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES(?,?,?,?,?)',
            owner,
            JSON.stringify(account),
            day,
            now,
            now,
          ),
        );
      }
      return {
        state: drawn.state,
        statements,
        result: {
          count,
          rewards: drawn.rewards,
          ...(count === 1 ? { reward: drawn.rewards[0] } : {}),
          choices: [],
        },
      };
    };
  const account = { state: JSON.parse(row.account_json) as BeastAccount, version: row.version };
  validBeastAccount(account.state);
  const beast: OwnedBeast | null =
    row.id && row.attempt_id
      ? {
          id: row.id,
          speciesId: row.species_id,
          attemptId: row.attempt_id,
          acquiredAt: row.acquired_at,
          counters: JSON.parse(row.counters_json),
          attempt: {
            speciesId: row.species_id,
            ruleVersion: row.rule_version,
            status: row.status,
            earned: row.earned,
            gray: row.gray,
            form: row.form,
          },
        }
      : null;
  const ultimate = row.ultimate_json ? (JSON.parse(row.ultimate_json) as BeastUltimate) : null,
    ordinal = row.ordinal;
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
        nextAccount.summonTickets += base.summonTickets ?? 0;
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
