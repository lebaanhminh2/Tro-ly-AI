import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessSleep,
  breakthrough,
  dayWindow,
  initialHealthy,
  undoSleepAssessment,
} from '../../src/domain/healthy.ts';

test('v2 sleep multiplier applies before clamp and demotion and preserves protected days', () => {
  const window = dayWindow(100, 300, 1320);
  const before = { ...initialHealthy(), qi: 50, rank: 1, streak: 30 };
  const late = assessSleep(before, {
    day: 100,
    target: window.target,
    end: window.end,
    reportedAt: null,
    chatActive: false,
    assessedAt: window.end,
    rewardMultiplier: 3,
  });
  assert.equal(late.delta, -50);
  assert.equal(late.state.qi, 0);
  assert.equal(late.state.streak, 0);
  assert.equal(late.state.rank, 0);
  assert.equal(late.demoted, true);
  const guarded = assessSleep(
    { ...before, peaceDay: 100, heartDay: 100 },
    {
      day: 100,
      target: window.target,
      end: window.end,
      reportedAt: null,
      chatActive: true,
      assessedAt: window.end,
      rewardMultiplier: 3,
    },
  );
  assert.equal(guarded.delta, 0);
  assert.equal(guarded.state.streak, 30);
  assert.equal(guarded.demoted, false);
});

test('v2 on-time +15 reward and earned are both reversed exactly by existing undo', () => {
  const window = dayWindow(100, 300, 1320);
  const before = { ...initialHealthy(), qi: 40, earned: 40, streak: 30 };
  const scored = assessSleep(before, {
    day: 100,
    target: window.target,
    end: window.end,
    reportedAt: window.target,
    chatActive: true,
    assessedAt: window.target,
    rewardMultiplier: 3,
  });
  assert.equal(scored.delta, 15);
  assert.equal(scored.state.earned, 55);
  assert.equal(scored.state.streak, 31);
  assert.deepEqual(undoSleepAssessment(scored.state, before, scored.state), before);
});

test('v2 breakthrough modifier changes pre-roll chance, cap, and loss without changing original defaults', () => {
  const before = { ...initialHealthy(), qi: 100, rank: 0, streak: 30 };
  const legacy = breakthrough(before, 100, 1000, null, 0.67);
  assert.equal(legacy.chance, 65);
  assert.equal(legacy.success, false);
  assert.equal(legacy.penalty, 3);
  const boosted = breakthrough(before, 100, 1000, null, 0.67, {
    chancePoints: 5,
    preventLoss: true,
  });
  assert.equal(boosted.chance, 70);
  assert.equal(boosted.success, true);
  const protectedFailure = breakthrough(before, 100, 1000, null, 0.99, {
    chancePoints: 5,
    preventLoss: true,
  });
  assert.equal(protectedFailure.success, false);
  assert.equal(protectedFailure.penalty, 0);
  assert.equal(protectedFailure.state.failures, 1);
  const maximum = breakthrough(before, 100, 1000, null, 0.99, {
    chancePoints: 100,
    preventLoss: false,
  });
  assert.equal(maximum.chance, 100);
  assert.equal(maximum.success, true);
  const tripled = breakthrough(before, 100, 1000, null, 0.99, {
    chancePoints: 0,
    preventLoss: false,
    penaltyMultiplier: 3,
  });
  assert.equal(tripled.penalty, 9);
  const clamped = breakthrough({ ...before, qi: 6 }, 100, 1000, null, 0.99, {
    chancePoints: 0,
    preventLoss: false,
    penaltyMultiplier: 3,
  });
  assert.equal(clamped.penalty, 6);
  assert.equal(clamped.state.qi, 0);
});
