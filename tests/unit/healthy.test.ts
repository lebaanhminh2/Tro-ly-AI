import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialHealthy,
  assessSleep,
  resumeHealthy,
  breakthrough,
  drawReward,
  drawRewards,
  fuseCharm,
  useProtection,
  dayWindow,
  operatingDay,
  minutes,
  DAY_MS,
  REALMS,
  LOOT,
  CHARMS,
  DAILY_REWARDS,
  BREAKTHROUGH_PENALTIES,
  claimDailyReward,
  dailyCheckinProgress,
} from '../../src/domain/healthy.ts';
import { healthyCommand } from '../../src/application/healthy-command.ts';
import { scheduleEntry } from '../../src/application/schedule-command.ts';
const window = dayWindow(20000, 270, 1350);
const assessment = {
  day: 20000,
  ...window,
  reportedAt: null,
  chatActive: false,
  assessedAt: window.end,
};

test('ten draws use ten independent original rolls without mutating the input or spending partially', () => {
  const state = { ...initialHealthy(), tickets: 12 };
  const samples = [0, 0.399, 0.4, 0.549, 0.55, 0.899, 0.9, 0.959, 0.96, 0.98];
  let calls = 0;
  const result = drawRewards(state, 10, () => samples[calls++]!);
  assert.equal(calls, 10);
  assert.equal(result.state.tickets, 2);
  assert.equal(state.tickets, 12);
  assert.deepEqual(result.rewards, [
    'qi1',
    'qi1',
    'qi2',
    'qi2',
    'basic',
    'basic',
    'keepsake',
    'keepsake',
    'heart',
    'peace',
  ]);
  assert.equal(result.state.qi, 6);
  assert.equal(result.state.earned, 6);
  assert.equal(result.state.inventory.basic, 2);
  assert.equal(state.inventory.basic, 0);
  calls = 0;
  assert.throws(
    () =>
      drawRewards({ ...state, tickets: 9 }, 10, () => {
        calls++;
        return 0;
      }),
    /NO_TICKETS/,
  );
  assert.equal(calls, 0);
  assert.throws(() => drawRewards(state, 2 as 10, () => 0), /INVALID_DRAW_COUNT/);
  assert.throws(() => drawRewards({ ...state, suspended: true }, 10, () => 0), /ACCOUNT_SUSPENDED/);
  assert.throws(() => drawRewards(state, 10, () => 1), /INVALID_RANDOM_SAMPLE/);
  assert.equal(state.tickets, 12);
  assert.deepEqual(drawRewards(state, 1, () => 0.55).rewards, ['basic']);
});
test('sleep command preserves companion text and cannot accidentally match another command', () => {
  assert.deepEqual(healthyCommand('/ngu mai làm báo cáo nhé'), {
    kind: 'sleep',
    message: 'mai làm báo cáo nhé',
  });
  assert.equal(healthyCommand('/ngung'), null);
  assert.deepEqual(scheduleEntry('/lich chiều nay bận'), {
    kind: 'setup',
    message: 'chiều nay bận',
  });
  assert.equal(scheduleEntry('tớ bận'), null);
});
test('late sleep demotes below rank threshold, not below zero; only once per day', () => {
  const s = { ...initialHealthy(), qi: 30, earned: 100, rank: 2, highestRank: 3 };
  const r = assessSleep(s, assessment);
  assert.equal(r.state.qi, 10);
  assert.equal(r.state.rank, 1);
  assert.equal(r.state.earned, 100);
  assert.equal(r.state.highestRank, 3);
  assert.equal(assessSleep(r.state, assessment).applied, false);
  assert.equal(s.qi, 30);
});
test('72h prevents demotion but not qi penalty, expiry alone changes nothing', () => {
  const s = { ...initialHealthy(), qi: 10, rank: 2, protectedUntil: window.end + 1 };
  const r = assessSleep(s, assessment);
  assert.equal(r.state.qi, 0);
  assert.equal(r.state.rank, 2);
  const nextWindow = dayWindow(20001, 270, 1350);
  const later = assessSleep(r.state, {
    day: 20001,
    ...nextWindow,
    reportedAt: null,
    chatActive: false,
    assessedAt: nextWindow.end,
  });
  assert.equal(later.state.rank, 1);
  assert.equal(later.state.qi, 0);
});
test('on-time earns5; heart and peace affect different rules', () => {
  const s = { ...initialHealthy(), streak: 4, qi: 30, rank: 2 };
  const good = assessSleep(s, { ...assessment, reportedAt: window.target });
  assert.equal(good.state.qi, 35);
  assert.equal(good.state.earned, 5);
  assert.equal(good.state.streak, 5);
  s.inventory.heart = 1;
  s.inventory.peace = 1;
  const protectedState = useProtection(useProtection(s, 'heart', 20000), 'peace', 20000);
  const late = assessSleep(protectedState, assessment);
  assert.equal(late.state.qi, 30);
  assert.equal(late.state.rank, 2);
  assert.equal(late.state.streak, 4);
  assert.throws(() => useProtection(late.state, 'heart', 20000));
});
test('only three inactive days penalized; resume never charges absent days', () => {
  let s = { ...initialHealthy(), qi: 200 };
  for (let n = 0; n < 10; n++) {
    const w = dayWindow(20000 + n, 270, 1350);
    s = assessSleep(s, {
      day: 20000 + n,
      ...w,
      reportedAt: null,
      chatActive: false,
      assessedAt: w.end,
    }).state;
  }
  assert.equal(s.qi, 140);
  assert.equal(s.suspended, true);
  s = resumeHealthy(s, 20020);
  assert.equal(s.qi, 140);
  assert.equal(s.lastScoredDay, 20019);
  assert.equal(assessSleep(s, assessment).applied, false);
});
test('day crosses midnight; exact sleep target is on time', () => {
  const now = Date.parse('2026-09-14T01:00:00+07:00'),
    day = operatingDay(now, minutes('04:30'));
  const w = dayWindow(day, 270, minutes('01:30'));
  assert.equal(new Date(w.target).toISOString(), '2026-09-13T18:30:00.000Z');
  assert.throws(() => minutes('24:00'));
  assert.equal(
    assessSleep(initialHealthy(), {
      day,
      ...w,
      reportedAt: w.target,
      assessedAt: w.target,
      chatActive: true,
    }).state.qi,
    5,
  );
});
test('odds, pity, daily attempts, fusion and lifetime rewards', () => {
  assert.equal(
    LOOT.reduce((n, i) => n + i.weight, 0),
    100,
  );
  let s = { ...initialHealthy(), qi: 100, rank: 1, streak: 3, tickets: 1 };
  const draw = drawReward(s, 0.55);
  assert.equal(draw.reward, 'basic');
  assert.equal(draw.state.tickets, 0);
  s = breakthrough(s, 1, 1000, null, 0.99).state;
  assert.throws(() => breakthrough(s, 1, 1001, null, 0));
  s = breakthrough(s, 2, 2000, null, 0.99).state;
  const third = breakthrough(s, 3, 3000, null, 0.99);
  assert.equal(third.success, false);
  assert.equal(third.chance, 65);
  s = third.state;
  const fourth = breakthrough(s, 4, 4000, null, 0.99);
  assert.equal(fourth.success, false);
  assert.equal(fourth.chance, 70);
  s = fourth.state;
  const r = breakthrough(s, 5, 5000, null, 0.74);
  assert.equal(r.success, true);
  assert.equal(r.chance, 75);
  assert.equal(r.state.failures, 0);
  assert.equal(r.state.protectedUntil, 5000 + 72 * 3600000);
  s.inventory.basic = 3;
  const fused = fuseCharm(s, 'basic', 0.99);
  assert.equal(fused.state.inventory.basic, 2);
  assert.equal(REALMS.at(-1)!.qi, 2000);
  assert.equal(REALMS.at(-1)!.days, 45);
});

test('breakthrough gets harder by realm; failure bonuses start at two and cap at four, with matching charms in server and demo', async () => {
  const webPath = '../../web/api.js',
    web = await import(webPath);
  const realmChances = [65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15];
  const failureBonuses = [0, 0, 5, 10, 15, 15, 15];
  const charms = [
    ['basic', 5],
    ['middle', 10],
    ['high', 20],
    ['supreme', 25],
  ] as const;
  assert.deepEqual(
    REALMS.slice(1).map((realm) => realm.chance),
    realmChances,
  );
  assert.deepEqual(web.realms, REALMS);
  for (const [key, boost] of charms) {
    assert.equal(CHARMS[key].boost, boost);
    assert.equal(web.talismans.find((charm: any) => charm.key === key).boost, boost);
  }
  for (const [rank, base] of realmChances.entries()) {
    for (const [failures, bonus] of [...failureBonuses.entries(), [100, 15] as const]) {
      for (const [key, boost] of [[null, 0], ...charms] as const) {
        const chance = Math.min(100, base + bonus + boost);
        for (const random of [chance / 100 - 0.000001, Math.min(chance / 100, 0.999999)]) {
          const target = REALMS[rank + 1]!;
          const state = {
            ...initialHealthy(),
            qi: target.qi,
            rank,
            highestRank: rank,
            streak: target.days,
            failures,
          };
          if (key) state.inventory[key] = 1;
          const demo = { ...state, inventory: { ...state.inventory }, log: [] };
          const result = breakthrough(state, 1, 1000, key, random);
          const shown = web.demoBreakthrough(demo, 1, key, 1000, () => random);
          assert.equal(result.chance, chance);
          assert.equal(result.success, random * 100 < chance);
          assert.deepEqual(shown, {
            success: result.success,
            chance: result.chance,
            penalty: result.penalty,
          });
          assert.equal(demo.qi, result.state.qi);
          assert.equal(demo.failures, result.state.failures);
          assert.equal(demo.rank, result.state.rank);
          assert.deepEqual(demo.inventory, result.state.inventory);
          assert.equal(result.state.failures, result.success ? 0 : failures + 1);
          if (key)
            assert.equal(
              result.state.inventory[key],
              0,
              'The selected charm is consumed on success and failure',
            );
        }
      }
    }
  }
});

test('published daily calendar varies rewards and preserves all four milestones', async () => {
  assert.equal(DAILY_REWARDS.length, 30);
  assert.deepEqual(
    DAILY_REWARDS.map((r) => r.day),
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  assert.ok(DAILY_REWARDS.some((r) => r.qi && !r.tickets));
  assert.ok(DAILY_REWARDS.some((r) => r.tickets && !r.qi));
  assert.equal(DAILY_REWARDS[6]!.tickets, 2);
  assert.equal(DAILY_REWARDS[6]!.items.basic, 3);
  assert.equal(DAILY_REWARDS[13]!.items.middle, 3);
  assert.equal(DAILY_REWARDS[20]!.items.high, 3);
  assert.ok(
    DAILY_REWARDS.slice(0, 29).every((reward) => !reward.items.supreme),
    'Cực phẩm is only awarded at day30',
  );
  assert.deepEqual(DAILY_REWARDS[29], {
    day: 30,
    qi: 30,
    tickets: 5,
    items: { supreme: 1 },
    milestone: true,
  });
  const webPath = '../../web/api.js',
    demo = await import(webPath);
  assert.deepEqual(demo.dailyRewards, DAILY_REWARDS);
  assert.deepEqual(demo.breakthroughPenalties, BREAKTHROUGH_PENALTIES);
});

test('30 claims survive two missed dates, day32 is eligible and day33 resets only progress', () => {
  const start = Date.parse('2026-10-05T00:00:00+07:00');
  let s = initialHealthy();
  for (let date = 0; date < 32; date++) {
    if (date === 3 || date === 18) continue;
    const before = s,
      outcome = claimDailyReward(s, start + date * DAY_MS);
    s = outcome.state;
    assert.equal(outcome.reward.day, (before.checkin?.count ?? 0) + 1);
    assert.notEqual(s.inventory, before.inventory);
    assert.throws(() => claimDailyReward(s, start + date * DAY_MS), /ALREADY_CHECKED_IN/);
  }
  const progress = dailyCheckinProgress(s, start + 31 * DAY_MS);
  assert.equal(progress.count, 30);
  assert.equal(progress.missedDays, 2);
  assert.equal(progress.daysLeft, 1);
  assert.equal(progress.canComplete, true);
  assert.equal(s.inventory.basic, 3);
  assert.equal(s.inventory.middle, 3);
  assert.equal(s.inventory.high, 3);
  assert.equal(s.inventory.supreme, 1);
  assert.equal(
    s.qi,
    DAILY_REWARDS.reduce((sum, r) => sum + r.qi, 0),
  );
  assert.equal(s.earned, s.qi);
  assert.equal(
    s.tickets,
    DAILY_REWARDS.reduce((sum, r) => sum + r.tickets, 0),
  );
  assert.throws(() => claimDailyReward(s, start + 31 * DAY_MS + 60000), /ALREADY_CHECKED_IN/);
  const fresh = dailyCheckinProgress(s, start + 32 * DAY_MS);
  assert.equal(fresh.expired, true);
  assert.equal(fresh.count, 0);
  const reset = claimDailyReward(s, start + 32 * DAY_MS).state;
  assert.equal(reset.checkin!.count, 1);
  assert.equal(reset.qi, s.qi + 1);
  assert.equal(reset.inventory.supreme, 1);
  assert.equal(reset.tickets, s.tickets);
});

test('milestone bundles can be fused and do not replace previously owned items or checkin progress', () => {
  const now = Date.parse('2026-10-05T09:00:00+07:00'),
    day = operatingDay(now, 0),
    seed = initialHealthy();
  seed.checkin = { cycleStartDay: day - 6, count: 6, lastDay: day - 1 };
  seed.inventory = { ...seed.inventory, basic: 2, middle: 1, high: 1, supreme: 1 };
  const { state, reward } = claimDailyReward(seed, now);
  assert.equal(reward.day, 7);
  assert.equal(state.checkin!.count, 7);
  assert.deepEqual(state.inventory, { ...seed.inventory, basic: 5 });
  assert.equal(seed.inventory.basic, 2);
  assert.equal(seed.checkin.count, 6);
  const fused = fuseCharm(state, 'basic', 0).state;
  assert.equal(fused.inventory.basic, 2);
  assert.equal(fused.inventory.middle, 2);
  assert.equal(fused.inventory.supreme, 1);
});

test('completed cycle waits until32 days; three misses cannot reach the final reward', () => {
  const start = Date.parse('2026-10-05T08:00:00+07:00');
  let s = initialHealthy();
  for (let i = 0; i < 30; i++) s = claimDailyReward(s, start + i * DAY_MS).state;
  assert.throws(() => claimDailyReward(s, start + 30 * DAY_MS), /CHECKIN_COMPLETE/);
  assert.equal(dailyCheckinProgress(s, start + 31 * DAY_MS).canClaim, false);
  s = claimDailyReward(initialHealthy(), start).state;
  assert.equal(dailyCheckinProgress(s, start + 3 * DAY_MS).canComplete, true);
  assert.equal(dailyCheckinProgress(s, start + 4 * DAY_MS).canComplete, false);
  const reset = claimDailyReward(s, start + 32 * DAY_MS);
  assert.equal(reset.reward.day, 1);
});

test('checkin uses Vietnam midnight, independent of sleep day, and never resumes suspension', async () => {
  const before = Date.parse('2026-10-05T23:59:59+07:00'),
    after = before + 1000;
  let s = { ...initialHealthy(), suspended: true, inactiveDays: 3, streak: 4 };
  const first = claimDailyReward(s, before);
  s = first.state;
  const second = claimDailyReward(s, after);
  assert.equal(second.reward.day, 2);
  assert.equal(operatingDay(before, 270), operatingDay(after, 270));
  assert.equal(second.calendarDay, first.calendarDay + 1);
  assert.equal(second.state.suspended, true);
  assert.equal(second.state.inactiveDays, 3);
  assert.equal(second.state.streak, 4);
  assert.throws(() => claimDailyReward(second.state, before), /INVALID_CHECKIN_DAY/);
  const webPath = '../../web/api.js',
    demo = await import(webPath);
  for (const now of [before, after, after + 33 * DAY_MS])
    assert.deepEqual(
      demo.checkinProgress(second.state, now),
      dailyCheckinProgress(second.state, now),
    );
});

test('failed breakthrough penalties increase gently, never demote or reduce lifetime/streak, and success costs0', () => {
  for (let rank = 0; rank < REALMS.length - 1; rank++) {
    const target = REALMS[rank + 1]!,
      s = {
        ...initialHealthy(),
        rank,
        highestRank: rank,
        qi: target.qi,
        earned: 9999,
        streak: target.days,
      };
    const failure = breakthrough(s, 1, 1000, null, 0.99);
    assert.equal(failure.success, false);
    assert.equal(failure.penalty, BREAKTHROUGH_PENALTIES[rank]);
    assert.equal(failure.state.qi, target.qi - BREAKTHROUGH_PENALTIES[rank]!);
    assert.ok(failure.state.qi >= 0);
    assert.equal(failure.state.rank, rank);
    assert.equal(failure.state.highestRank, rank);
    assert.equal(failure.state.earned, 9999);
    assert.equal(failure.state.streak, target.days);
    assert.equal(failure.state.failures, 1);
    assert.equal(s.qi, target.qi);
    const success = breakthrough(s, 1, 1000, null, 0);
    assert.equal(success.penalty, 0);
    assert.equal(success.state.qi, s.qi);
  }
});
