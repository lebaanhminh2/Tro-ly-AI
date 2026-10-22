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
  assert.throws(
    () =>
      breakthrough({ ...before, qi: 14 }, 100, 1000, null, 0.99, {
        chancePoints: 0,
        preventLoss: false,
        penaltyMultiplier: 3,
      }),
    /BREAKTHROUGH_UNAVAILABLE/,
  );
});

test('final realm respects 60-day eligibility, capped pity, charms and v2 loss protection', () => {
  const before = {
    ...initialHealthy(),
    qi: 10000,
    earned: 12000,
    rank: 14,
    highestRank: 14,
    streak: 60,
    failures: 4,
  };
  before.inventory.supreme = 1;
  const failed = breakthrough(before, 100, 1000, 'supreme', 0.45, {
    chancePoints: 0,
    preventLoss: false,
    penaltyMultiplier: 3,
  });
  assert.equal(failed.chance, 45);
  assert.equal(failed.success, false);
  assert.equal(failed.penalty, 900);
  assert.equal(failed.state.qi, 9100);
  assert.equal(failed.state.rank, 14);
  assert.equal(failed.state.streak, 60);
  assert.equal(failed.state.earned, 12000);
  assert.equal(failed.state.inventory.supreme, 0);
  assert.throws(
    () => breakthrough({ ...before, streak: 59 }, 100, 1000, 'supreme', 0),
    /BREAKTHROUGH_UNAVAILABLE/,
  );
  const guarded = breakthrough(before, 100, 1000, 'supreme', 0.99, {
    chancePoints: 5,
    preventLoss: true,
    penaltyMultiplier: 3,
  });
  assert.equal(guarded.chance, 50);
  assert.equal(guarded.penalty, 0);
  assert.equal(guarded.state.qi, 10000);
  const success = breakthrough(before, 100, 1000, 'supreme', 0.4499);
  assert.equal(success.success, true);
  assert.equal(success.state.rank, 15);
  assert.equal(success.state.highestRank, 15);
  assert.equal(success.state.qi, 10000);
  assert.throws(
    () => breakthrough(success.state, 101, 1000 + 86400000, null, 0),
    /BREAKTHROUGH_UNAVAILABLE/,
  );
});
