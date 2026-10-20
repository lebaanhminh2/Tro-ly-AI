import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateBeastUltimate,
  applyBeastUltimate,
  settleBeastUltimate,
  type UltimateEvent,
} from '../../src/domain/linh-thu-ultimates.ts';
import { newBeastAttempt, BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../../src/domain/linh-thu-catalog.ts';

const now = Date.parse('2026-10-19T10:00:00+07:00'),
  day = 20745,
  DAY = 86400000;
function activate(speciesId: string, extra = {}) {
  const attempt = {
    ...newBeastAttempt(speciesId),
    form: 4 as const,
    status: 'completed' as const,
    earned: BEAST_TRAINING[beastSpecies(speciesId).rank].capacity,
  };
  return activateBeastUltimate({
    attempt,
    beastId: 'beast_test',
    attemptId: 'attempt_test',
    day,
    now,
    dayEnd: now + 18 * 3600000,
    ...extra,
  });
}
const event = (kind: UltimateEvent['kind'], extra: Partial<UltimateEvent> = {}): UltimateEvent => ({
  kind,
  sourceId: 'task1',
  day,
  at: now + 1,
  qualified: true,
  ordinal: 1,
  ...extra,
});

test('activation requires exact completed purity, validates immutable target/pact inputs and uses Monday calendar weeks', () => {
  const attempt = {
    ...newBeastAttempt('flameow'),
    earned: 799,
    gray: 1,
    status: 'completed' as const,
  };
  assert.throws(
    () =>
      activateBeastUltimate({ attempt, beastId: 'b', attemptId: 'a', day, now, dayEnd: now + DAY }),
    /PERFECT_REQUIRED/,
  );
  assert.throws(() => activate('manteeny'), /TARGETS/);
  assert.throws(() => activate('manteeny', { targets: ['a', 'a'] }), /TARGETS/);
  assert.throws(() => activate('maskfry'), /PACT/);
  const monday = activate('pyropup');
  assert.equal(monday.week, day);
  assert.equal(monday.expiresAt, Date.parse('2026-10-26T00:00:00+07:00'));
  assert.equal(activate('flameow').expiresAt, now + 18 * 3600000);
});

test('task ultimates enforce first-five limit, exact combo rewards, locked targets and one final bounty', () => {
  let state = activate('zappur');
  for (let i = 1; i <= 6; i++) {
    const result = applyBeastUltimate(state, event('task', { ordinal: i }));
    state = result.state;
    assert.equal(result.choices.length, i === 5 ? 1 : 0);
    if (i === 5) assert.deepEqual(result.choices[0]!.options, [{ summonTickets: 2 }, { qi: 40 }]);
  }
  state = activate('flameow');
  for (const expected of [3, 5, 10, undefined]) {
    const result = applyBeastUltimate(state, event('task'));
    state = result.state;
    assert.equal(result.reward.qi, expected);
  }
  state = activate('manteeny', { targets: ['task1', 'task2'] });
  let result = applyBeastUltimate(state, event('task'));
  state = result.state;
  assert.deepEqual(result.reward, { tickets: 5 });
  assert.deepEqual(applyBeastUltimate(state, event('task')).reward, {});
  result = applyBeastUltimate(state, event('task', { sourceId: 'task2' }));
  assert.deepEqual(result.reward, { tickets: 5, qi: 5 });
  const magnet = applyBeastUltimate(activate('voltfawn', { targets: ['task1'] }), event('task'));
  assert.deepEqual(magnet.choices[0]!.options, [{ tickets: 1 }, { qi: 3 }]);
});

test('habit, sleep and combined bounties count only qualified original events after activation and expire without payment', () => {
  for (const [species, kind] of [
    ['shardsnail', 'habit'],
    ['fluffle', 'sleep'],
    ['funglet', 'habit'],
  ] as const) {
    let state = activate(species);
    assert.equal(applyBeastUltimate(state, event(kind, { qualified: false })).state.count, 0);
    assert.equal(applyBeastUltimate(state, event(kind, { at: now - 1 })).state.count, 0);
    assert.equal(
      applyBeastUltimate(state, event(kind, { at: state.expiresAt, day: day + 7 })).state.count,
      0,
    );
    for (let i = 1; i <= 4; i++) {
      const result = applyBeastUltimate(state, event(kind));
      state = result.state;
      assert.equal(result.choices.length, species === 'funglet' && i === 3 ? 1 : 0);
      assert.equal(result.reward.summonTickets ?? 0, species !== 'funglet' && i === 3 ? 1 : 0);
    }
  }
});

test('sleep guards preserve their different semantics and Meteorax consumes only uncovered harm then converts unused charges once', () => {
  let state = activate('rubblet');
  assert.equal(
    applyBeastUltimate(state, event('sleep', { qualified: false })).state.sleepRemaining,
    2,
  );
  let result = applyBeastUltimate(state, event('sleep', { qualified: false, streakAtRisk: true }));
  state = result.state;
  assert.equal(result.protectStreak, true);
  assert.equal(result.protectQi, true);
  assert.equal(state.sleepRemaining, 1);
  result = applyBeastUltimate(state, event('breakthrough', { success: false, actualQiLoss: 8 }));
  assert.equal(result.refundQi, 8);
  const paid = settleBeastUltimate(result.state, state.expiresAt);
  assert.deepEqual(paid.reward, { qi: 5 });
  assert.deepEqual(settleBeastUltimate(paid.state, state.expiresAt).reward, {});
  for (const [species, qiProtected] of [
    ['frostnip', true],
    ['goonbug', true],
    ['hootlet', false],
  ] as const) {
    result = applyBeastUltimate(
      activate(species),
      event('sleep', { qualified: false, streakAtRisk: true, qiAtRisk: true }),
    );
    assert.equal(result.protectStreak, true);
    assert.equal(result.protectQi, qiProtected);
  }
  assert.deepEqual(applyBeastUltimate(activate('frostnip'), event('sleep')).reward, { qi: 5 });
  assert.deepEqual(applyBeastUltimate(activate('goonbug'), event('sleep')).reward, {
    items: { heart: 1, peace: 1 },
  });
  assert.deepEqual(applyBeastUltimate(activate('hootlet'), event('sleep')).choices[0]!.options, [
    { tickets: 5 },
    { qi: 12 },
  ]);
});

test('breakthrough pacts, turtle total cap and basic-only fusion never manufacture refunds or reuse an ultimate charge', () => {
  const fail = event('breakthrough', { success: false, actualQiLoss: 8 });
  assert.equal(applyBeastUltimate(activate('maskfry', { pact: 'guard' }), fail).refundQi, 8);
  assert.equal(applyBeastUltimate(activate('maskfry', { pact: 'reward' }), fail).refundQi, 0);
  assert.deepEqual(
    applyBeastUltimate(activate('maskfry', { pact: 'reward' }), {
      ...fail,
      success: true,
      actualQiLoss: 0,
    }).reward,
    { summonTickets: 1 },
  );
  assert.equal(applyBeastUltimate(activate('gibber'), { ...fail, actualQiLoss: 30 }).refundQi, 10);
  assert.deepEqual(
    applyBeastUltimate(activate('gibber'), { ...fail, success: true, actualQiLoss: 0 }).reward,
    { qi: 5 },
  );
  const state = activate('humbug');
  assert.equal(
    applyBeastUltimate(state, event('fusion', { fusionTier: 'middle', success: true })).state
      .remaining,
    1,
  );
  const fusion = applyBeastUltimate(state, event('fusion', { fusionTier: 'basic', success: true }));
  assert.deepEqual(fusion.reward, { items: { middle: 1 } });
  assert.deepEqual(
    applyBeastUltimate(fusion.state, event('fusion', { fusionTier: 'basic', success: true }))
      .reward,
    {},
  );
  assert.deepEqual(
    applyBeastUltimate(state, event('fusion', { fusionTier: 'basic', success: false })).reward,
    { items: { basic: 1 } },
  );
});
