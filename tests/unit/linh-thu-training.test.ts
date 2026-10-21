import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateAlchemy,
  BEAST_TRAINING,
  craftBeastElixir,
  initialBeastAlchemy,
  newBeastAttempt,
  resetBeastWithElixir,
  sealBeast,
  trainBeast,
  trainingView,
  evolveBeast,
} from '../../src/domain/linh-thu-training.ts';
import {
  beastTowerPublic,
  beginBeastTower,
  claimBeastTower,
  continueBeastTower,
  expireBeastTower,
  pickBeastTower,
} from '../../src/domain/linh-thu-tower.ts';

test('approved rank journeys distinguish entering T4 from completing it', () => {
  const species = { R: 'hootlet', SR: 'flameow', SSR: 'punchimp', UR: 'rubblet' } as const;
  for (const rank of ['R', 'SR', 'SSR', 'UR'] as const) {
    const rule = BEAST_TRAINING[rank];
    for (const [i, threshold] of rule.thresholds.entries()) {
      const before = {
        ...newBeastAttempt(species[rank]),
        form: (i + 1) as 1 | 2 | 3,
        status: 'training' as const,
        earned: threshold - 1,
      };
      assert.equal(trainingView(before).form, i + 1);
      assert.equal(trainingView({ ...before, earned: threshold }).form, i + 1);
      assert.equal(trainingView(evolveBeast({ ...before, earned: threshold })).form, i + 2);
    }
    const t4 = trainingView({
      ...newBeastAttempt(species[rank]),
      form: 4,
      earned: rule.thresholds[2],
    });
    assert.equal(t4.form, 4);
    assert.equal(t4.perfect, false);
    assert.equal(t4.awakened, false);
    const finished = trainingView({
      ...newBeastAttempt(species[rank]),
      form: 4,
      earned: rule.capacity,
    });
    assert.equal(finished.perfect, true);
  }
});

test('final day allocates remaining capacity by habit fraction and never rounds a miss to perfect', () => {
  for (let remaining = 1; remaining <= 16; remaining++) {
    for (let completed = 0; completed <= 4; completed++) {
      const attempt = {
        ...newBeastAttempt('frostnip'),
        form: 4 as const,
        status: 'training' as const,
        earned: 1200 - remaining,
      };
      const outcomes = [
        ...Array(completed).fill('achieved'),
        ...Array(4 - completed).fill('missed'),
      ];
      const result = trainBeast(attempt, outcomes);
      assert.equal(result.attempt.earned + result.attempt.gray, 1200);
      assert.equal(result.delta.earned + result.delta.gray, remaining);
      assert.equal(result.attempt.status, 'completed');
      assert.equal(trainingView(result.attempt).perfect, completed === 4);
      if (completed < 4) assert.ok(result.delta.gray >= 1);
    }
  }
  const oneLeft = { ...newBeastAttempt('frostnip'), status: 'training' as const, earned: 1199 };
  assert.deepEqual(trainBeast(oneLeft, ['achieved', 'achieved', 'achieved', 'missed']).delta, {
    earned: 0,
    gray: 1,
  });
});

test('gray persists, neutral adds nothing, switching seals exact settled state and an elixir creates a ready attempt', () => {
  const start = {
    ...newBeastAttempt('frostnip'),
    status: 'training' as const,
    earned: 720,
    gray: 120,
    form: 3 as const,
  };
  const settled = trainBeast(start, ['achieved', 'achieved', 'achieved', 'missed']).attempt;
  assert.deepEqual({ earned: settled.earned, gray: settled.gray }, { earned: 732, gray: 124 });
  const rest = trainBeast(settled, ['neutral']).attempt;
  assert.deepEqual(rest, settled);
  const sealed = sealBeast(rest);
  assert.equal(sealed.status, 'sealed');
  assert.equal(sealed.earned, 732);
  assert.equal(trainingView(sealed).form, 3);
  assert.throws(() => trainBeast(sealed, ['achieved']), /NOT_TRAINING/);
  const reset = resetBeastWithElixir(sealed, { days: 24, failures: 1, inventory: 1 });
  assert.deepEqual(reset.attempt, newBeastAttempt('frostnip'));
  assert.deepEqual(reset.alchemy, { days: 24, failures: 1, inventory: 0 });
  assert.throws(() => resetBeastWithElixir(sealed, initialBeastAlchemy()), /NO_ELIXIR/);
  assert.throws(
    () => resetBeastWithElixir(start, { days: 0, failures: 0, inventory: 1 }),
    /NOT_AVAILABLE/,
  );
  assert.deepEqual(start, {
    ...newBeastAttempt('frostnip'),
    status: 'training',
    earned: 720,
    gray: 120,
    form: 3,
  });
});

test('alchemy pauses on neutral, breaks on missed, holds a charge and consumes every attempted batch', () => {
  let state = initialBeastAlchemy();
  state = accumulateAlchemy(state, ['achieved']);
  assert.equal(state.days, 1);
  state = accumulateAlchemy(state, ['neutral']);
  assert.equal(state.days, 1);
  state = accumulateAlchemy(state, ['achieved', 'missed']);
  assert.equal(state.days, 0);
  for (let i = 0; i < 30; i++) state = accumulateAlchemy(state, ['achieved']);
  assert.equal(accumulateAlchemy(state, ['missed']).days, 30);
  assert.throws(() => craftBeastElixir(initialBeastAlchemy(), () => 0), /NOT_READY/);
  for (let i = 0; i < 2; i++) {
    const crafted = craftBeastElixir({ ...state, days: 30 }, () => 0.4);
    assert.equal(crafted.success, false);
    assert.equal(crafted.state.days, 0);
    state = crafted.state;
  }
  const guaranteed = craftBeastElixir({ ...state, days: 30 }, () => {
    throw Error('must not roll');
  });
  assert.deepEqual(guaranteed, {
    state: { days: 0, failures: 0, inventory: 1 },
    success: true,
    guaranteed: true,
  });
});

test('tower stops pay only the last cleared floor; claims and terminal failures cannot repeat', () => {
  let state = beginBeastTower(20000, false, () => 0);
  for (let floor = 1; floor <= 4; floor++) {
    state = pickBeastTower(state, 1, () => 0);
    assert.equal(state.cleared, floor);
    const claimed = claimBeastTower(state);
    assert.deepEqual(
      claimed.reward,
      floor === 1
        ? { tickets: 2, summonTickets: 0 }
        : floor === 2
          ? { tickets: 3, summonTickets: 0 }
          : floor === 3
            ? { tickets: 5, summonTickets: 0 }
            : { tickets: 0, summonTickets: 1 },
    );
    assert.throws(() => claimBeastTower(claimed.state));
    assert.throws(() => pickBeastTower(state, 2, () => 0));
    if (floor < 4) state = continueBeastTower(state, () => 0);
  }
  assert.throws(() => continueBeastTower(state, () => 0));
  const failed = pickBeastTower(
    beginBeastTower(20000, false, () => 0),
    0,
    () => 0,
  );
  assert.equal(failed.status, 'failed');
  assert.deepEqual(beastTowerPublic(failed).atRisk, { tickets: 0, summonTickets: 0 });
  assert.throws(() => claimBeastTower(failed));
});

test('Rockong reshuffles only one trap at floors 1–3 and never saves floor 4', () => {
  let state = beginBeastTower(20000, true, () => 0);
  state = pickBeastTower(state, 0, () => 0.99);
  assert.equal(state.status, 'choosing');
  assert.equal(state.trap, 3);
  assert.equal(state.rescued, true);
  assert.equal(pickBeastTower(state, 3, () => 0).status, 'failed');
  state = beginBeastTower(20000, true, () => 0);
  for (let floor = 1; floor <= 3; floor++) {
    state = pickBeastTower(state, 1, () => 0);
    state = continueBeastTower(state, () => 0);
  }
  assert.equal(pickBeastTower(state, 0, () => 0).status, 'failed');
});

test('tower public state never leaks traps; cross-day expiry pays cleared floors once', () => {
  const state = beginBeastTower(20000, false, () => 0.99);
  assert.equal(Object.hasOwn(beastTowerPublic(state), 'trap'), false);
  assert.deepEqual(expireBeastTower(state).reward, { tickets: 0, summonTickets: 0 });
  const won = pickBeastTower(state, 0, () => 0);
  const pending = continueBeastTower(won, () => 0);
  const expired = expireBeastTower(pending);
  assert.equal(expired.state.status, 'expired');
  assert.deepEqual(expired.reward, { tickets: 2, summonTickets: 0 });
  assert.deepEqual(expireBeastTower(expired.state).reward, { tickets: 0, summonTickets: 0 });
});
