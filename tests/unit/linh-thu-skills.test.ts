import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAST_CATALOG, beastSpecies } from '../../src/domain/linh-thu-catalog.ts';
import {
  applyBeastPassives,
  BEAST_SKILLS,
  type BeastSkillCounters,
  type SkillTrigger,
} from '../../src/domain/linh-thu-skills.ts';
import { BEAST_TRAINING, newBeastAttempt } from '../../src/domain/linh-thu-training.ts';
import { habitWeekStart } from '../../src/domain/habits.ts';

const day = 20745;
function max(id: string) {
  return {
    ...newBeastAttempt(id),
    form: 4 as const,
    status: 'completed' as const,
    earned: BEAST_TRAINING[beastSpecies(id).rank].capacity,
  };
}
const event = (trigger: SkillTrigger, ordinal = 3) => ({
  trigger,
  ordinal,
  day,
  qualified: true,
  actualQiLoss: 2,
});

test('all 18 species have their own complete baseline, fixed talents and distinct perfect abilities', () => {
  assert.deepEqual(Object.keys(BEAST_SKILLS).sort(), BEAST_CATALOG.map((entry) => entry.id).sort());
  assert.equal(new Set(Object.values(BEAST_SKILLS).map((entry) => entry.ultimate.kind)).size, 18);
  for (const entry of BEAST_CATALOG)
    assert.equal(
      BEAST_SKILLS[entry.id]!.talents.length,
      ['SSR', 'UR'].includes(entry.rank) ? 2 : 1,
    );
});

test('task specialists pay integer rewards, respect first five valid tasks and keep the two Stormlion trials independent', () => {
  const expected = {
    pyropup: { qi: 1, tickets: 1 },
    zappur: { tickets: 3, qi: 1 },
    flameow: { qi: 4 },
    manteeny: { tickets: 2 },
    voltfawn: { qi: 2 },
    cheerling: { tickets: 2 },
  };
  for (const [id, reward] of Object.entries(expected)) {
    assert.deepEqual(applyBeastPassives(max(id), {}, event('task'), () => 0).reward, reward, id);
    assert.deepEqual(applyBeastPassives(max(id), {}, event('task', 6), () => 0).reward, {}, id);
  }
  let rolls = [0.1, 0.9];
  assert.deepEqual(
    applyBeastPassives(max('zappur'), {}, event('task', 1), () => rolls.shift()!).reward,
    { tickets: 1 },
  );
  rolls = [0.9, 0.1];
  assert.deepEqual(
    applyBeastPassives(max('zappur'), {}, event('task', 1), () => rolls.shift()!).reward,
    { qi: 1 },
  );
  const t1 = newBeastAttempt('pyropup');
  assert.deepEqual(applyBeastPassives(t1, {}, event('task'), () => 0.3).reward, {});
  assert.deepEqual(applyBeastPassives(t1, {}, event('task'), () => 0).reward, { qi: 1 });
});

test('habit and combined buffs use distinct original events and never grant training points', () => {
  const expected = {
    rubblet: { qi: 4 },
    frostnip: { items: { peace: 1 } },
    punchimp: { qi: 3, tickets: 1 },
    shardsnail: { tickets: 1 },
    maskfry: { qi: 2 },
    goonbug: { items: { peace: 1 } },
    humbug: { items: { basic: 1 } },
    gibber: { qi: 1 },
    funglet: { qi: 1 },
  };
  for (const [id, reward] of Object.entries(expected)) {
    const attempt = max(id);
    assert.deepEqual(applyBeastPassives(attempt, {}, event('habit'), () => 0).reward, reward, id);
    assert.deepEqual(
      applyBeastPassives(attempt, {}, { ...event('habit'), qualified: false }, () => 0).reward,
      {},
    );
    assert.deepEqual(attempt, max(id));
  }
  assert.deepEqual(applyBeastPassives(max('frostnip'), {}, event('combined'), () => 0).reward, {
    tickets: 1,
  });
  assert.deepEqual(applyBeastPassives(max('funglet'), {}, event('combined'), () => 0).reward, {
    qi: 1,
  });
});

test('sleep talents require on-time assessment and retain cumulative progress across calendar weeks', () => {
  for (const [id, qi] of [
    ['rubblet', 3],
    ['frostnip', 3],
    ['fluffle', 2],
    ['hootlet', 1],
  ] as const) {
    assert.deepEqual(applyBeastPassives(max(id), {}, event('sleep'), () => 0).reward, { qi });
    assert.deepEqual(
      applyBeastPassives(max(id), {}, { ...event('sleep'), qualified: false }, () => 0).reward,
      {},
    );
  }
  let counters: BeastSkillCounters = {};
  for (let i = 0; i < 3; i++) {
    const result = applyBeastPassives(
      max('fluffle'),
      counters,
      { ...event('sleep'), day: day + i * 7 },
      () => 0,
    );
    counters = result.counters;
    assert.equal(result.reward.qi, i === 2 ? 7 : 2);
  }
});

test('each cumulative awakening pays on the exact source count, preserves remainders, and ignores unopened awakenings', () => {
  const cases = [
    ['pyropup', 'task', 20, 'summonTickets', 1],
    ['rubblet', 'combined', 5, 'summonTickets', 1],
    ['punchimp', 'habit', 5, 'summonTickets', 1],
    ['shardsnail', 'habit', 5, 'tickets', 3],
    ['skinklet', 'draw', 3, 'qi', 3],
    ['humbug', 'habit', 3, 'basic', 1],
  ] as const;
  for (const [id, trigger, count, key, amount] of cases) {
    let counters: BeastSkillCounters = {};
    for (let i = 0; i < count + 1; i++) {
      const result = applyBeastPassives(max(id), counters, event(trigger, 1), () => 0.99);
      counters = result.counters;
      const base = id === 'shardsnail' ? 1 : 0;
      const value = key === 'basic' ? (result.reward.items?.basic ?? 0) : (result.reward[key] ?? 0);
      assert.equal(value, base + (i === count - 1 ? amount : 0), id + ':' + i);
    }
    assert.equal(counters.awakening, 1);
    const incomplete = { ...max(id), earned: max(id).earned - 1 };
    assert.equal(
      applyBeastPassives(
        incomplete,
        { awakening: count - 1 },
        event(trigger, 1),
        () => 0.99,
      ).triggered.includes(BEAST_SKILLS[id]!.awakening.name),
      false,
    );
  }
});

test('Hootlet grants one weekly heart at three on-time nights and resets only the weekly counter', () => {
  let counters: BeastSkillCounters = {};
  let hearts = 0;
  for (let i = 0; i < 7; i++) {
    const result = applyBeastPassives(
      max('hootlet'),
      counters,
      { ...event('sleep'), day: habitWeekStart(day) + i },
      () => 0,
    );
    counters = result.counters;
    hearts += result.reward.items?.heart ?? 0;
  }
  assert.equal(hearts, 1);
  const next = applyBeastPassives(
    max('hootlet'),
    counters,
    { ...event('sleep'), day: habitWeekStart(day) + 7 },
    () => 0,
  );
  assert.equal(next.counters.awakening, 1);
  assert.equal(next.counters.weekPaid, 0);
});

test('late Hootlet assessments cannot reset or repay either calendar week', () => {
  const week = habitWeekStart(day);
  let counters: BeastSkillCounters = {};
  let hearts = 0;
  for (const offset of [0, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11, 6, 12, 13]) {
    const result = applyBeastPassives(
      max('hootlet'),
      counters,
      { ...event('sleep'), day: week + offset },
      () => 0,
    );
    counters = result.counters;
    hearts += result.reward.items?.heart ?? 0;
  }
  assert.equal(hearts, 2);
  assert.equal(counters.week, week + 7);
  assert.equal(counters[`weekPaid:${week}`], 1);
  assert.equal(counters[`weekPaid:${week + 7}`], 1);
});

test('Beetleknight pity guarantees the seventh dry qualified habit day and resets after a natural proc', () => {
  let counters: BeastSkillCounters = {};
  for (let i = 0; i < 8; i++) {
    const result = applyBeastPassives(max('goonbug'), counters, event('habit'), () => 0.99);
    counters = result.counters;
    assert.equal(result.reward.items?.peace ?? 0, i === 6 ? 1 : 0);
  }
  const proc = applyBeastPassives(max('goonbug'), { awakening: 6 }, event('habit'), () => 0);
  assert.equal(proc.reward.items?.peace, 1);
  assert.equal(proc.counters.awakening, 0);
});

test('draw talents only consume first ten paid original draws containing qi; breakthrough refunds cap at actual loss', () => {
  assert.deepEqual(applyBeastPassives(max('skinklet'), {}, event('draw', 1), () => 0).reward, {
    qi: 1,
  });
  assert.deepEqual(applyBeastPassives(max('skinklet'), {}, event('draw', 11), () => 0).reward, {});
  assert.deepEqual(
    applyBeastPassives(max('skinklet'), {}, { ...event('draw', 1), qualified: false }, () => 0)
      .reward,
    {},
  );
  for (const [id, refund] of [
    ['skinklet', 2],
    ['maskfry', 2],
    ['gibber', 1],
  ] as const) {
    const result = applyBeastPassives(max(id), {}, event('breakthrough'), () => 0);
    assert.equal(result.refundQi, refund);
    assert.equal(result.reward.qi, undefined);
  }
});
