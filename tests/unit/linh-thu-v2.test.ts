import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAST_V2_CONFIG,
  BEAST_V2_SELF_BURN_BASE,
  BEAST_V2_SELF_BURN_FINAL,
  beastV2BreakthroughModifier,
  beastV2Multiplier,
  beastV2SelfBurn,
  beastV2SkillLevels,
  beastV2SpeciesProjection,
  beastV2SkillProgress,
  type BeastV2ProgressFacts,
  beastV2TowerEligible,
  initialBeastV2State,
  reduceBeastV2,
  type BeastV2Context,
  type BeastV2Event,
  type BeastV2Form,
  type BeastV2State,
} from '../../src/domain/linh-thu-v2.ts';

const never = () => 0.999999;
const progressFacts = (overrides: Partial<BeastV2ProgressFacts> = {}): BeastV2ProgressFacts => ({
  day: 10,
  taskCount: 0,
  daily: { ...initialBeastV2State().daily, day: 10 },
  startSleepStreak: 0,
  multiplier: 1,
  claimedToday: [],
  recentRewards: [],
  tower: null,
  ...overrides,
});

test('skill meters cover all species without exposing locked skills or mutating reward counters', () => {
  for (const species of Object.keys(BEAST_V2_CONFIG)) {
    const state = initialBeastV2State();
    const before = structuredClone(state);
    for (const form of [1, 2, 3, 4] as const) {
      const meters = beastV2SkillProgress(
        { speciesId: species, form, awakened: false, perfect: false },
        state,
        progressFacts(),
      );
      assert.equal(meters.awakening, undefined);
      assert.equal(meters.perfect, undefined);
      const available = beastV2SpeciesProjection(species)!.stages[form - 1]!.skills.map(
        (skill) => skill.id,
      );
      assert.ok(Object.keys(meters).every((id) => available.includes(id)));
    }
    const unlocked = beastV2SkillProgress(
      { speciesId: species, form: 4, awakened: true, perfect: true },
      state,
      progressFacts(),
    );
    assert.ok(unlocked.awakening && unlocked.perfect, species);
    for (const meter of Object.values(unlocked))
      if (meter.kind !== 'status') {
        assert.ok(Number.isFinite(meter.value) && Number.isFinite(meter.max));
        assert.ok(meter.value! >= 0 && meter.value! <= meter.max!);
      }
    assert.deepEqual(state, before);
  }
});

test('daily meters require reward evidence, use skill-specific counters and clear old-day quotas', () => {
  const state = initialBeastV2State();
  const ctx = { speciesId: 'cheerling', form: 4 as const, awakened: true, perfect: true };
  const unclaimed = beastV2SkillProgress(ctx, state, progressFacts({ taskCount: 8 }));
  assert.equal(
    unclaimed.perfect!.status,
    'waiting',
    'eight tasks alone cannot prove this newly unlocked skill paid',
  );
  const claimed = beastV2SkillProgress(
    ctx,
    state,
    progressFacts({ taskCount: 8, claimedToday: [BEAST_V2_CONFIG.cheerling.perfect.name] }),
  );
  assert.equal(claimed.perfect!.status, 'done');
  assert.equal(claimed.perfect!.value, 8);
  const mantis = beastV2SkillProgress(
    { ...ctx, speciesId: 'manteeny' },
    state,
    progressFacts({
      taskCount: 8,
      daily: { ...initialBeastV2State().daily, day: 10, beforeNoonTasks: 1 },
    }),
  );
  assert.equal(
    mantis.awakening!.value,
    1,
    'before-noon skill counter differs from all-day task count',
  );
  const previousDay = {
    ...initialBeastV2State().daily,
    day: 9,
    fusionUses: 3,
    earlyRewarded: true,
    monkeyTriggered: true,
  };
  assert.equal(
    beastV2SkillProgress(
      { ...ctx, speciesId: 'humbug' },
      state,
      progressFacts({ daily: previousDay }),
    ).perfect!.value,
    3,
  );
  assert.equal(
    beastV2SkillProgress(
      { ...ctx, speciesId: 'voltfawn' },
      state,
      progressFacts({ daily: previousDay }),
    ).perfect!.value,
    1,
  );
  assert.equal(
    beastV2SkillProgress(
      { ...ctx, speciesId: 'punchimp' },
      state,
      progressFacts({ daily: previousDay, taskCount: 2 }),
    ).talent_2!.status,
    'ready',
  );
});

test('cycle meters follow resets, pity chance and latched daily effects without pretending uncapped rewards are full bars', () => {
  const ctx = { speciesId: 'gibber', form: 4 as const, awakened: true, perfect: true };
  const state = initialBeastV2State();
  state.counters.breakthroughFailures = 3;
  assert.equal(beastV2SkillProgress(ctx, state, progressFacts()).perfect!.status, 'ready');
  state.counters.drawMisses = 33;
  assert.equal(
    beastV2SkillProgress({ ...ctx, speciesId: 'skinklet' }, state, progressFacts()).awakening!
      .value,
    100,
  );
  state.counters.drawMisses = 0;
  assert.equal(
    beastV2SkillProgress({ ...ctx, speciesId: 'skinklet' }, state, progressFacts()).awakening!
      .value,
    3,
  );
  assert.equal(
    beastV2SkillProgress(
      { ...ctx, speciesId: 'pyropup' },
      state,
      progressFacts({ startSleepStreak: 30, multiplier: 1 }),
    ).perfect!.status,
    'waiting',
  );
  assert.equal(
    beastV2SkillProgress(
      { ...ctx, speciesId: 'pyropup' },
      state,
      progressFacts({ startSleepStreak: 30, multiplier: 3 }),
    ).perfect!.status,
    'ready',
  );
  assert.equal(
    beastV2SkillProgress({ ...ctx, speciesId: 'flameow' }, state, progressFacts({ taskCount: 100 }))
      .perfect!.kind,
    'status',
  );
  assert.equal(
    beastV2SkillProgress({ ...ctx, speciesId: 'zappur' }, state, progressFacts({ taskCount: 100 }))
      .awakening!.kind,
    'status',
  );
  const newCycle = beastV2SkillProgress(
    { ...ctx, speciesId: 'hootlet' },
    initialBeastV2State(),
    progressFacts({ recentRewards: [BEAST_V2_CONFIG.hootlet.awakening.name] }),
  );
  assert.equal(newCycle.awakening!.value, 0);
  assert.match(newCycle.awakening!.hint!, /chu kỳ mới/);
  const tower = beastV2SkillProgress(
    { ...ctx, speciesId: 'punchimp' },
    state,
    progressFacts({ tower: { active: false, available: true, used: true } }),
  );
  assert.equal(tower.perfect!.status, 'done', 'a completed run must retain its used-rescue status');
  const ended = beastV2SkillProgress(
    { ...ctx, speciesId: 'punchimp' },
    state,
    progressFacts({ tower: { active: false, available: true, used: false } }),
  );
  assert.match(ended.perfect!.label, /đã kết thúc/);
});
const always = () => 0;
const context = (speciesId: string, form: BeastV2Form = 4, unlocked = true): BeastV2Context => ({
  speciesId,
  form,
  awakened: unlocked,
  perfect: unlocked,
});
type Day = Extract<BeastV2Event, { kind: 'day' }>;
function day(dayNumber: number, overrides: Partial<Day> = {}): Day {
  return {
    kind: 'day',
    day: dayNumber,
    habitSatisfied: true,
    habitRewardEligible: true,
    sleepOnTime: true,
    sleepStreak: dayNumber + 1,
    taskCount: 1,
    ...overrides,
  };
}
function task(dayNumber: number, ordinal: number, localMinute = 600): BeastV2Event {
  return { kind: 'task', day: dayNumber, ordinal, localMinute };
}
function runDays(speciesId: string, count: number, rng = never, overrides: Partial<Day> = {}) {
  let state = initialBeastV2State();
  let qi = 0;
  let tickets = 0;
  let summons = 0;
  const outcomes = [];
  for (let n = 0; n < count; n += 1) {
    const outcome = reduceBeastV2(state, context(speciesId), day(n, overrides), rng);
    state = outcome.state;
    qi += outcome.reward.qi;
    tickets += outcome.reward.tickets;
    summons += outcome.reward.summonTickets;
    outcomes.push(outcome);
  }
  return { state, qi, tickets, summons, outcomes };
}

test('all eighteen species expose exact independent form rates and complete six-stage roadmaps', () => {
  const expected: Record<string, number[][]> = {
    humbug: [[0.25, 0.5, 0.75, 1]],
    hootlet: [[0.25, 0.5, 0.75, 1]],
    gibber: [[0.25, 0.5, 0.75, 1]],
    voltfawn: [[0.1, 0.2, 0.3, 0.35]],
    cheerling: [[0.1, 0.2, 0.3, 0.35]],
    funglet: [[0.25, 0.5, 0.75, 1]],
    shardsnail: [[0.25, 0.5, 0.75, 1]],
    flameow: [[0.15, 0.3, 0.45, 0.6]],
    manteeny: [[0.1, 0.25, 0.35, 0.5]],
    fluffle: [[0.25, 0.5, 0.75, 1]],
    maskfry: [[0.25, 0.5, 0.75, 1]],
    goonbug: [[0.03, 0.05, 0.07, 0.09]],
    frostnip: [
      [0.25, 0.5, 0.75, 1],
      [0, 0, 0.05, 0.1],
    ],
    zappur: [
      [0.25, 0.5, 0.75, 1],
      [0, 0, 0.5, 1],
    ],
    skinklet: [[0.1, 0.15, 0.25, 0.35]],
    punchimp: [
      [0.25, 0.5, 0.75, 1],
      [0, 0, 0.5, 1],
    ],
    pyropup: [
      [0.25, 0.5, 0.75, 1],
      [0, 0, 0.4, 0.8],
    ],
    rubblet: [
      [0.25, 0.5, 0.75, 1],
      [0, 0, 0.5, 1],
    ],
  };
  assert.deepEqual(Object.keys(BEAST_V2_CONFIG).sort(), Object.keys(expected).sort());
  for (const [species, chances] of Object.entries(expected)) {
    const config = BEAST_V2_CONFIG[species as keyof typeof BEAST_V2_CONFIG];
    assert.deepEqual(
      config.talents.map((talent) => talent.chances),
      chances,
      species,
    );
    const view = beastV2SpeciesProjection(species)!;
    assert.deepEqual(
      view.stages.map((stage) => stage.form),
      [1, 2, 3, 4],
    );
    assert.ok(view.summary && view.awakening.name && view.perfect.name);
    assert.ok(view.stages.every((stage) => stage.skills.length > 0));
  }
  assert.equal(beastV2SpeciesProjection('unknown'), null);
  assert.match(beastV2SpeciesProjection('skinklet')!.stages[2]!.skills[1]!.description, /35%/);
  assert.match(beastV2SpeciesProjection('skinklet')!.stages[3]!.skills[1]!.description, /55%/);
});

test('raw purity boundaries and full T4 training gate awakening and perfection', () => {
  assert.deepEqual(beastV2SkillLevels(4, false, 1), { awakened: false, perfect: false });
  assert.deepEqual(beastV2SkillLevels(3, true, 1), { awakened: false, perfect: false });
  assert.deepEqual(beastV2SkillLevels(4, true, 0.949999), { awakened: false, perfect: false });
  assert.deepEqual(beastV2SkillLevels(4, true, 0.95), { awakened: true, perfect: false });
  assert.deepEqual(beastV2SkillLevels(4, true, 0.999999), { awakened: true, perfect: false });
  assert.deepEqual(beastV2SkillLevels(4, true, 1), { awakened: true, perfect: true });
  const outcome = reduceBeastV2(initialBeastV2State(), context('flameow', 3), task(0, 3), never);
  assert.equal(outcome.reward.qi, 0, 'malformed perfect=true never unlocks a T3 milestone');
});

test('probability boundaries are strict and second talent remains locked before T3', () => {
  const first = reduceBeastV2(
    initialBeastV2State(),
    context('voltfawn', 1, false),
    task(0, 1),
    () => 0.099999,
  );
  assert.equal(first.reward.qi, 1);
  const boundary = reduceBeastV2(
    initialBeastV2State(),
    context('voltfawn', 1, false),
    task(0, 1),
    () => 0.1,
  );
  assert.equal(boundary.reward.qi, 0);
  const pyroT2 = reduceBeastV2(
    initialBeastV2State(),
    context('pyropup', 2, false),
    task(0, 1),
    always,
  );
  assert.equal(pyroT2.reward.qi, 3);
  assert.equal(pyroT2.reward.tickets, 0);
  const pyroT3 = reduceBeastV2(
    initialBeastV2State(),
    context('pyropup', 3, false),
    task(0, 1),
    always,
  );
  assert.equal(pyroT3.reward.qi, 3);
  assert.equal(pyroT3.reward.tickets, 2);
});

test('every form talent pays independently specified resource amounts at strict probability boundaries', () => {
  const cases: {
    species: string;
    rates: number[];
    event: 'task' | 'day' | 'breakthrough' | 'two_tasks';
    field: 'qi' | 'tickets' | 'summonTickets' | 'basic' | 'peace' | 'refundQi';
    amount: number;
    sleep?: boolean;
  }[] = [
    { species: 'humbug', rates: [0.25, 0.5, 0.75, 1], event: 'day', field: 'basic', amount: 1 },
    {
      species: 'hootlet',
      rates: [0.25, 0.5, 0.75, 1],
      event: 'day',
      field: 'qi',
      amount: 1,
      sleep: true,
    },
    {
      species: 'gibber',
      rates: [0.25, 0.5, 0.75, 1],
      event: 'breakthrough',
      field: 'refundQi',
      amount: 5,
    },
    { species: 'voltfawn', rates: [0.1, 0.2, 0.3, 0.35], event: 'task', field: 'qi', amount: 1 },
    {
      species: 'cheerling',
      rates: [0.1, 0.2, 0.3, 0.35],
      event: 'task',
      field: 'tickets',
      amount: 1,
    },
    { species: 'funglet', rates: [0.25, 0.5, 0.75, 1], event: 'day', field: 'qi', amount: 2 },
    {
      species: 'shardsnail',
      rates: [0.25, 0.5, 0.75, 1],
      event: 'day',
      field: 'tickets',
      amount: 2,
    },
    { species: 'flameow', rates: [0.15, 0.3, 0.45, 0.6], event: 'task', field: 'qi', amount: 1 },
    {
      species: 'manteeny',
      rates: [0.1, 0.25, 0.35, 0.5],
      event: 'task',
      field: 'tickets',
      amount: 1,
    },
    {
      species: 'fluffle',
      rates: [0.25, 0.5, 0.75, 1],
      event: 'day',
      field: 'qi',
      amount: 2,
      sleep: true,
    },
    {
      species: 'maskfry',
      rates: [0.25, 0.5, 0.75, 1],
      event: 'breakthrough',
      field: 'refundQi',
      amount: 10,
    },
    {
      species: 'goonbug',
      rates: [0.03, 0.05, 0.07, 0.09],
      event: 'day',
      field: 'peace',
      amount: 1,
    },
    {
      species: 'frostnip',
      rates: [0.25, 0.5, 0.75, 1],
      event: 'day',
      field: 'qi',
      amount: 10,
      sleep: true,
    },
    { species: 'frostnip', rates: [0, 0, 0.05, 0.1], event: 'day', field: 'peace', amount: 1 },
    { species: 'zappur', rates: [0.25, 0.5, 0.75, 1], event: 'task', field: 'tickets', amount: 1 },
    { species: 'zappur', rates: [0, 0, 0.5, 1], event: 'task', field: 'qi', amount: 1 },
    {
      species: 'skinklet',
      rates: [0.1, 0.15, 0.25, 0.35],
      event: 'day',
      field: 'summonTickets',
      amount: 1,
    },
    { species: 'punchimp', rates: [0.25, 0.5, 0.75, 1], event: 'day', field: 'qi', amount: 5 },
    { species: 'punchimp', rates: [0, 0, 0.5, 1], event: 'two_tasks', field: 'tickets', amount: 3 },
    { species: 'pyropup', rates: [0.25, 0.5, 0.75, 1], event: 'task', field: 'qi', amount: 3 },
    { species: 'pyropup', rates: [0, 0, 0.4, 0.8], event: 'task', field: 'tickets', amount: 2 },
    { species: 'rubblet', rates: [0.25, 0.5, 0.75, 1], event: 'day', field: 'qi', amount: 5 },
    {
      species: 'rubblet',
      rates: [0, 0, 0.5, 1],
      event: 'day',
      field: 'qi',
      amount: 10,
      sleep: true,
    },
  ];
  for (const entry of cases) {
    for (const form of [1, 2, 3, 4] as const) {
      const rate = entry.rates[form - 1]!;
      let event: BeastV2Event;
      if (entry.event === 'task' || entry.event === 'two_tasks')
        event = task(0, entry.event === 'task' ? 1 : 2);
      else if (entry.event === 'breakthrough')
        event = { kind: 'breakthrough', day: 0, success: false, lostQi: 100 };
      else
        event = day(
          0,
          entry.species === 'skinklet'
            ? {}
            : { habitRewardEligible: !entry.sleep, sleepOnTime: !!entry.sleep },
        );
      const read = (rngValue: number) => {
        const outcome = reduceBeastV2(
          initialBeastV2State(),
          context(entry.species, form, false),
          event,
          () => rngValue,
        );
        if (entry.field === 'refundQi') return outcome.refundQi;
        if (entry.field === 'basic' || entry.field === 'peace')
          return outcome.reward.items[entry.field] ?? 0;
        return outcome.reward[entry.field];
      };
      assert.equal(
        read(Math.max(0, rate - 0.000001)),
        rate > 0 ? entry.amount : 0,
        `${entry.species} T${form} hit ${entry.field}`,
      );
      assert.equal(
        read(rate),
        rate >= 1 ? entry.amount : 0,
        `${entry.species} T${form} boundary ${entry.field}`,
      );
    }
  }
});

test('humbug cumulative habit awards correct charm tiers and fusion is separate product/refund with daily quota', () => {
  const three = runDays('humbug', 3);
  assert.deepEqual(three.outcomes[0]!.reward.items, { basic: 1 });
  assert.deepEqual(three.outcomes[2]!.reward.items, { basic: 1, middle: 1 });
  let state = initialBeastV2State();
  for (const success of [true, false, true]) {
    const outcome = reduceBeastV2(
      state,
      context('humbug'),
      { kind: 'fusion', day: 0, success, from: 'basic' },
      never,
    );
    assert.deepEqual(
      outcome.fusion,
      success ? { extraMiddle: 1, refundBasic: 0 } : { extraMiddle: 0, refundBasic: 1 },
    );
    assert.deepEqual(outcome.reward.items, {}, 'crafted output/refund is not earned reward');
    state = outcome.state;
  }
  assert.equal(
    reduceBeastV2(
      state,
      context('humbug'),
      { kind: 'fusion', day: 0, success: true, from: 'basic' },
      never,
    ).fusion,
    null,
  );
  const next = reduceBeastV2(
    state,
    context('humbug'),
    { kind: 'fusion', day: 1, success: true, from: 'basic' },
    never,
  );
  assert.deepEqual(next.fusion, { extraMiddle: 1, refundBasic: 0 });
  assert.equal(next.state.daily.fusionUses, 1);
  assert.equal(
    reduceBeastV2(
      state,
      context('humbug'),
      { kind: 'fusion', day: 1, success: true, from: 'middle' },
      never,
    ).fusion,
    null,
  );
});

test('owl has independent three/fourteen night cycles, miss resets and failed perfect rolls consume cycle', () => {
  const fourteen = runDays('hootlet', 14);
  assert.equal(fourteen.qi, 14);
  assert.equal(fourteen.tickets, 12);
  assert.deepEqual(fourteen.outcomes[13]!.reward.items, {});
  assert.equal(fourteen.state.counters.sleep100, 0);
  const hit = runDays('hootlet', 14, always);
  assert.deepEqual(hit.outcomes[13]!.reward.items, { heart: 1 });
  const missed = reduceBeastV2(
    fourteen.outcomes[1]!.state,
    context('hootlet'),
    day(2, { sleepOnTime: false }),
    never,
  );
  assert.equal(missed.state.counters.sleep95, 0);
  assert.equal(missed.state.counters.sleep100, 0);
});

test('turtle refund clamps actual losses and fourth attempt modifier is consumed even on failure', () => {
  let state = initialBeastV2State();
  for (let n = 0; n < 3; n += 1) {
    assert.deepEqual(beastV2BreakthroughModifier(context('gibber'), state), {
      chancePoints: 0,
      preventLoss: false,
    });
    const outcome = reduceBeastV2(
      state,
      context('gibber'),
      { kind: 'breakthrough', day: n, success: false, lostQi: n === 0 ? 3 : 20 },
      never,
    );
    assert.equal(outcome.refundQi, n === 0 ? 3 : 5);
    state = outcome.state;
  }
  assert.deepEqual(beastV2BreakthroughModifier(context('gibber'), state), {
    chancePoints: 5,
    preventLoss: true,
  });
  const fourth = reduceBeastV2(
    state,
    context('gibber'),
    { kind: 'breakthrough', day: 5, success: false, lostQi: 20 },
    never,
  );
  assert.equal(fourth.refundQi, 20);
  assert.equal(fourth.state.counters.breakthroughFailures, 0);
  const success = reduceBeastV2(
    state,
    context('gibber'),
    { kind: 'breakthrough', day: 5, success: true, lostQi: 0 },
    never,
  );
  assert.equal(success.refundQi, 0);
  assert.equal(success.state.counters.breakthroughFailures, 0);
  assert.equal(runDays('gibber', 1).qi, 1);
});

test('deer morning reward uses [05:00,08:00), only once and third-task reward stacks', () => {
  let state = initialBeastV2State();
  const before = reduceBeastV2(state, context('voltfawn'), task(0, 1, 299), never);
  assert.equal(before.reward.qi, 0);
  const start = reduceBeastV2(before.state, context('voltfawn'), task(0, 2, 300), never);
  assert.equal(start.reward.qi, 5);
  const again = reduceBeastV2(start.state, context('voltfawn'), task(0, 3, 479), never);
  assert.equal(again.reward.qi, 3);
  state = again.state;
  const atEnd = reduceBeastV2(state, context('voltfawn'), task(1, 1, 480), never);
  assert.equal(atEnd.reward.qi, 0);
  const lastMinute = reduceBeastV2(atEnd.state, context('voltfawn'), task(2, 1, 479), never);
  assert.equal(lastMinute.reward.qi, 5);
});

test('rabbit eighth task is reachable beyond talent cap and neither ninth nor repeated source repeats milestone', () => {
  let state = initialBeastV2State();
  let tickets = 0;
  let summons = 0;
  for (let ordinal = 1; ordinal <= 9; ordinal += 1) {
    const outcome = reduceBeastV2(state, context('cheerling'), task(0, ordinal), always);
    tickets += outcome.reward.tickets;
    summons += outcome.reward.summonTickets;
    state = outcome.state;
  }
  assert.equal(tickets, 8, 'five talent tickets plus three at task three');
  assert.equal(summons, 1);
  const replay = reduceBeastV2(state, context('cheerling'), task(0, 8), always);
  assert.equal(replay.reward.summonTickets, 0);
  assert.equal(replay.reward.tickets, 0);
  const tomorrow = reduceBeastV2(state, context('cheerling'), task(1, 1), always);
  assert.equal(tomorrow.reward.tickets, 1);
});

test('funglet combined milestone requires no task and pays both resources alongside both qi skills', () => {
  const three = runDays('funglet', 3, never, { taskCount: 0 });
  assert.equal(three.qi, 15, 'three days of +2 talent and +2 awakening, then +3 perfect');
  assert.equal(three.tickets, 3);
  assert.equal(three.state.counters.combined100, 0);
  const miss = reduceBeastV2(
    three.outcomes[1]!.state,
    context('funglet'),
    day(2, { habitSatisfied: false }),
    never,
  );
  assert.equal(miss.state.counters.combined100, 0);
  assert.equal(miss.reward.qi, 0);
});

test('snail pays two-ticket talent, five-day cumulative and perfect rewards independently', () => {
  const five = runDays('shardsnail', 5);
  assert.equal(five.tickets, 35);
  assert.equal(five.qi, 30);
  assert.equal(five.state.counters.habit95, 0);
  assert.equal(five.state.counters.perfect100, 0);
  for (const overrides of [{ sleepOnTime: false }, { habitSatisfied: false }, { taskCount: 0 }]) {
    const missed = reduceBeastV2(
      five.outcomes[3]!.state,
      context('shardsnail'),
      day(4, overrides),
      never,
    );
    assert.equal(missed.state.counters.perfect100, 0);
    assert.equal(missed.reward.tickets, overrides.habitSatisfied === false ? 0 : 7);
  }
});

test('fire cat combo is 1,2,3,3 indefinitely and talent cap never suppresses perfect task six/eight', () => {
  let state = initialBeastV2State();
  let qi = 0;
  const amounts = [];
  for (let ordinal = 1; ordinal <= 8; ordinal += 1) {
    const outcome = reduceBeastV2(state, context('flameow'), task(0, ordinal), always);
    amounts.push(outcome.reward.qi);
    qi += outcome.reward.qi;
    state = outcome.state;
  }
  assert.deepEqual(amounts, [2, 3, 7, 4, 4, 3, 3, 3]);
  assert.equal(qi, 29, '21 perfect +3 awakening +5 talent');
  assert.equal(reduceBeastV2(state, context('flameow'), task(1, 1), never).reward.qi, 1);
});

test('mantis before-noon milestone is strict at noon and two perfect days pay both resources', () => {
  let state = initialBeastV2State();
  for (let ordinal = 1; ordinal <= 2; ordinal += 1)
    state = reduceBeastV2(state, context('manteeny'), task(0, ordinal, 719), never).state;
  const noon = reduceBeastV2(state, context('manteeny'), task(0, 3, 720), never);
  assert.equal(noon.reward.tickets, 0);
  const before = reduceBeastV2(state, context('manteeny'), task(0, 3, 719), never);
  assert.equal(before.reward.tickets, 10);
  const fourth = reduceBeastV2(before.state, context('manteeny'), task(0, 4, 719), never);
  assert.equal(fourth.reward.tickets, 0);
  const two = runDays('manteeny', 2);
  assert.equal(two.tickets, 3);
  assert.equal(two.qi, 5);
});

test('sheep cumulative counter survives miss while perfect requires fresh three-night cycle and uncapped original streak', () => {
  let state = initialBeastV2State();
  for (let n = 0; n < 2; n += 1)
    state = reduceBeastV2(state, context('fluffle'), day(n, { sleepStreak: 21 + n }), never).state;
  const miss = reduceBeastV2(
    state,
    context('fluffle'),
    day(2, { sleepOnTime: false, sleepStreak: 0 }),
    never,
  );
  assert.equal(miss.state.counters.sleepAccum95, 2);
  assert.equal(miss.state.counters.sleep100, 0);
  const third = reduceBeastV2(state, context('fluffle'), day(2, { sleepStreak: 23 }), never);
  assert.equal(third.reward.qi, 30, '+2 talent +5 awakening +23 original streak');
  const long = reduceBeastV2(
    { ...state, counters: { ...state.counters, sleep100: 2 } },
    context('fluffle'),
    day(2, { sleepStreak: 300 }),
    never,
  );
  assert.equal(long.reward.qi, 307);
});

test('fish refunds ten capped by actual loss and five-night reward plus daily habit qi', () => {
  const small = reduceBeastV2(
    initialBeastV2State(),
    context('maskfry'),
    { kind: 'breakthrough', day: 0, success: false, lostQi: 3 },
    never,
  );
  assert.equal(small.refundQi, 3);
  const large = reduceBeastV2(
    initialBeastV2State(),
    context('maskfry'),
    { kind: 'breakthrough', day: 0, success: false, lostQi: 30 },
    never,
  );
  assert.equal(large.refundQi, 10);
  const five = runDays('maskfry', 5);
  assert.equal(five.qi, 10);
  assert.equal(five.summons, 1);
});

test('knight seventh failed consecutive habit roll guarantees one charm, natural hit and miss reset', () => {
  const seven = runDays('goonbug', 7);
  assert.deepEqual(seven.outcomes[5]!.reward.items, {});
  assert.deepEqual(seven.outcomes[6]!.reward.items, { peace: 1 });
  assert.equal(seven.state.counters.habitDry, 0);
  const natural = reduceBeastV2(seven.outcomes[5]!.state, context('goonbug'), day(6), always);
  assert.deepEqual(
    natural.reward.items,
    { peace: 1 },
    'no extra guaranteed charm on natural seventh-day hit',
  );
  assert.equal(natural.state.counters.habitDry, 0);
  const missed = reduceBeastV2(
    seven.outcomes[5]!.state,
    context('goonbug'),
    day(6, { habitSatisfied: false }),
    never,
  );
  assert.equal(missed.state.counters.habitDry, 0);
  const heart = runDays('goonbug', 10, always);
  assert.deepEqual(heart.outcomes[9]!.reward.items, { peace: 1, heart: 1 });
  const peace = runDays('goonbug', 10, never);
  assert.deepEqual(peace.outcomes[9]!.reward.items, { peace: 1 });
});

test('frost cat gets ten qi, independent charm and combined tickets, then uncapped streak tickets', () => {
  const three = runDays('frostnip', 3);
  assert.equal(three.qi, 30);
  assert.equal(three.tickets, 9, 'six awakening tickets plus streak-three perfect');
  const charm = reduceBeastV2(initialBeastV2State(), context('frostnip', 3, false), day(0), always);
  assert.equal(charm.reward.qi, 10);
  assert.deepEqual(charm.reward.items, { peace: 1 });
  const state = { ...initialBeastV2State(), counters: { sleep100: 2 } };
  const long = reduceBeastV2(state, context('frostnip'), day(0, { sleepStreak: 500 }), never);
  assert.equal(long.reward.tickets, 502);
});

test('lion task talents stack with awakening past task five and perfect ceil(S/2) caps at five', () => {
  const third = reduceBeastV2(initialBeastV2State(), context('zappur'), task(0, 3), never);
  assert.equal(third.reward.tickets, 4);
  assert.equal(third.reward.qi, 1);
  const sixth = reduceBeastV2(third.state, context('zappur'), task(0, 6), never);
  assert.equal(sixth.reward.tickets, 3);
  assert.equal(sixth.reward.qi, 0);
  for (const [streak, amount] of [
    [1, 1],
    [2, 1],
    [3, 2],
    [7, 4],
    [8, 4],
    [9, 5],
    [10, 5],
    [100, 5],
  ]) {
    const daily = reduceBeastV2(
      initialBeastV2State(),
      context('zappur'),
      day(0, { sleepStreak: streak }),
      never,
    );
    assert.equal(daily.reward.qi, amount);
    assert.equal(daily.reward.tickets, amount);
  }
});

test('ninja day talent has one boosted roll, 3/6/...100 x10 pity resets only on hit and perfect waits S>=7', () => {
  const t3 = reduceBeastV2(
    initialBeastV2State(),
    context('skinklet', 3, false),
    day(0, { sleepStreak: 14 }),
    () => 0.34999,
  );
  assert.equal(t3.reward.summonTickets, 1);
  const boundary = reduceBeastV2(
    initialBeastV2State(),
    context('skinklet', 3, false),
    day(0, { sleepStreak: 14 }),
    () => 0.35,
  );
  assert.equal(boundary.reward.summonTickets, 0);
  const t4 = reduceBeastV2(
    initialBeastV2State(),
    context('skinklet'),
    day(0, { sleepStreak: 14 }),
    () => 0.54999,
  );
  assert.equal(t4.reward.summonTickets, 1);
  let state = initialBeastV2State();
  for (let n = 0; n < 33; n += 1) {
    const miss = reduceBeastV2(
      state,
      context('skinklet'),
      { kind: 'draw', day: n, count: 10 },
      never,
    );
    assert.equal(miss.reward.summonTickets, 0);
    state = miss.state;
  }
  assert.equal(state.counters.drawMisses, 33);
  const single = reduceBeastV2(
    state,
    context('skinklet'),
    { kind: 'draw', day: 33, count: 1 },
    never,
  );
  assert.equal(single.state.counters.drawMisses, 33);
  const guaranteed = reduceBeastV2(
    single.state,
    context('skinklet'),
    { kind: 'draw', day: 33, count: 10 },
    never,
  );
  assert.equal(guaranteed.reward.summonTickets, 1);
  assert.equal(guaranteed.reward.tickets, 30);
  assert.equal(guaranteed.state.counters.drawMisses, 0);
  const initialMiss = reduceBeastV2(
    initialBeastV2State(),
    context('skinklet'),
    { kind: 'draw', day: 0, count: 10 },
    () => 0.03,
  );
  const secondHit = reduceBeastV2(
    initialMiss.state,
    context('skinklet'),
    { kind: 'draw', day: 0, count: 10 },
    () => 0.059999,
  );
  assert.equal(secondHit.reward.tickets, 30);
  const nine = runDays('skinklet', 9);
  assert.equal(nine.outcomes[7]!.reward.tickets, 0);
  assert.equal(nine.outcomes[8]!.reward.tickets, 30);
  assert.equal(nine.summons, 1);
});

test('monkey habit T4 bonus is separate, two-task buff is guaranteed even failed T3 ticket roll', () => {
  const daily = reduceBeastV2(initialBeastV2State(), context('punchimp'), day(0), never);
  assert.equal(daily.reward.qi, 5);
  assert.equal(daily.reward.tickets, 1);
  const t3 = reduceBeastV2(initialBeastV2State(), context('punchimp', 3, false), task(0, 2), never);
  assert.equal(t3.reward.tickets, 0);
  assert.equal(t3.nextDayTaskBuff, true);
  const repeat = reduceBeastV2(t3.state, context('punchimp', 3, false), task(0, 3), always);
  assert.equal(repeat.nextDayTaskBuff, false);
  assert.equal(repeat.reward.tickets, 0);
  const t4 = reduceBeastV2(initialBeastV2State(), context('punchimp'), task(0, 2), never);
  assert.equal(t4.reward.tickets, 3);
  assert.equal(t4.nextDayTaskBuff, true);
  assert.equal(runDays('punchimp', 5).summons, 1);
  assert.equal(beastV2TowerEligible(context('punchimp')), true);
  assert.equal(beastV2TowerEligible(context('punchimp', 4, false)), false);
  assert.equal(beastV2TowerEligible(context('punchimp', 3)), false);
});

test('pyro gives base three qi/two tickets, tenth-task reward bypasses cap and burn is base12/final36', () => {
  let state = initialBeastV2State();
  let qi = 0;
  let tickets = 0;
  let summons = 0;
  for (let ordinal = 1; ordinal <= 20; ordinal += 1) {
    const outcome = reduceBeastV2(state, context('pyropup'), task(0, ordinal), always);
    qi += outcome.reward.qi;
    tickets += outcome.reward.tickets;
    summons += outcome.reward.summonTickets;
    state = outcome.state;
  }
  assert.equal(qi, 15);
  assert.equal(tickets, 30, 'ten talent tickets plus twenty milestone tickets');
  assert.equal(summons, 2);
  assert.equal(BEAST_V2_SELF_BURN_BASE, 12);
  assert.equal(BEAST_V2_SELF_BURN_FINAL, 36);
  assert.equal(beastV2Multiplier(context('pyropup'), 29), 1);
  assert.equal(beastV2Multiplier(context('pyropup'), 30), 3);
  assert.equal(beastV2SelfBurn(context('pyropup'), 30), 36);
  assert.equal(beastV2SelfBurn(context('pyropup', 4, false), 30), 0);
  assert.equal(beastV2Multiplier(context('rubblet'), 100), 1);
});

test('meteor seven-perfect milestone and daily original-streak tickets stack without resetting account streak', () => {
  const seven = runDays('rubblet', 7);
  assert.equal(seven.qi, 105);
  assert.equal(seven.tickets, 128, '1+2+3+4+5+6+7 plus100');
  assert.equal(seven.outcomes[6]!.reward.tickets, 107);
  assert.equal(seven.state.counters.perfect95, 0);
  const eighth = reduceBeastV2(seven.state, context('rubblet'), day(7, { sleepStreak: 8 }), never);
  assert.equal(eighth.reward.tickets, 8);
  assert.equal(eighth.state.counters.perfect95, 1);
});

test('day replay is pure and gaps/inactive days reset only consecutive counters', () => {
  const state = runDays('shardsnail', 2).state;
  const before = structuredClone(state);
  const replay = reduceBeastV2(state, context('shardsnail'), day(1), () => {
    throw new Error('must not roll replay');
  });
  assert.equal(replay.reward.tickets, 0);
  assert.deepEqual(state, before);
  const gap = reduceBeastV2(state, context('shardsnail'), day(3), never);
  assert.equal(gap.state.counters.perfect100, 1);
  assert.equal(gap.state.counters.habit95, 3);
  const inactive = reduceBeastV2(state, context('shardsnail'), day(2, { active: false }), never);
  assert.equal(inactive.state.counters.perfect100, 0);
  assert.equal(inactive.state.counters.habit95, 2);
  assert.equal(inactive.reward.tickets, 0);
});

test('settled-day backlog never rewinds current fusion/task quota, component flags only suppress paid passives', () => {
  const today = reduceBeastV2(
    initialBeastV2State(),
    context('humbug'),
    { kind: 'fusion', day: 20, from: 'basic', success: true },
    never,
  );
  const backlog = reduceBeastV2(today.state, context('humbug'), day(1), never);
  assert.equal(backlog.state.daily.day, 20);
  assert.equal(backlog.state.daily.fusionUses, 1);
  const suppressed = reduceBeastV2(
    initialBeastV2State(),
    context('rubblet'),
    day(0, { settleHabit: false, settleSleep: false }),
    never,
  );
  assert.equal(suppressed.reward.qi, 0);
  assert.equal(suppressed.reward.tickets, 1);
  assert.equal(suppressed.state.counters.perfect95, 1);
  const noHabit = reduceBeastV2(
    initialBeastV2State(),
    context('rubblet'),
    day(0, { habitRewardEligible: false }),
    never,
  );
  assert.equal(noHabit.reward.qi, 10);
  assert.equal(
    noHabit.reward.tickets,
    1,
    'no active habit can still satisfy perfect-day obligation',
  );
});
