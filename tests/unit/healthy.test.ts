import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialHealthy,
  assessSleep,
  undoSleepAssessment,
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
import { runFusionBatch } from '../../src/adapters/d1/cultivation-fusion.ts';
const window = dayWindow(20000, 270, 1350);
const assessment = {
  day: 20000,
  ...window,
  reportedAt: null,
  chatActive: false,
  assessedAt: window.end,
};

test('loot intervals match the published 100% table and a summon ticket never becomes a cultivation inventory item', async () => {
  const modelPath = '../../web/models/cultivation.js';
  const { loot }: { loot: { key: string; weight: number }[] } = await import(modelPath);
  assert.deepEqual(
    loot.map(({ key, weight }) => ({ key, weight })),
    LOOT,
  );
  const counts: Record<string, number> = {};
  const state = { ...initialHealthy(), tickets: 1 };
  for (let i = 0; i < 10000; i++) {
    const drawn = drawReward(state, (i + 0.5) / 10000);
    counts[drawn.reward] = (counts[drawn.reward] ?? 0) + 1;
    if (drawn.reward === 'summonTicket') {
      assert.equal(drawn.summonTickets, 1);
      assert.deepEqual(drawn.state.inventory, state.inventory);
    }
  }
  assert.deepEqual(counts, {
    qi1: 4000,
    qi2: 1500,
    basic: 3500,
    keepsake: 800,
    heart: 50,
    peace: 100,
    summonTicket: 50,
  });
  assert.equal(drawRewards({ ...state, tickets: 10 }, 10, () => 0.997).summonTickets, 10);
  assert.equal(state.tickets, 1);
});

test('ten draws use ten independent original rolls without mutating the input or spending partially', () => {
  const state = { ...initialHealthy(), tickets: 12 };
  const samples = [0, 0.399, 0.4, 0.549, 0.55, 0.899, 0.9, 0.979, 0.98, 0.985];
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
  assert.equal(fused.state.inventory.basic, 0);
  assert.equal(REALMS.at(-1)!.qi, 10000);
  assert.equal(REALMS.at(-1)!.days, 60);
});

test('breakthrough gets harder by realm; failure bonuses start at two and cap at four, with matching charms in server and demo', async () => {
  const webPath = '../../web/api.js',
    web = await import(webPath);
  const realmChances = [65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 12, 9, 7, 5];
  const failureBonuses = [0, 0, 5, 10, 15, 15, 15];
  const charms = [
    ['basic', 5],
    ['middle', 10],
    ['high', 20],
    ['supreme', 25],
    ['immortal', 25],
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

test('fusion batches require and burn three inputs per attempt on both success and failure', async () => {
  const demoPath = '../../web/demo/cultivation.js';
  const { demoFuseBatch } = await import(demoPath);
  for (const count of [1, 10, 100]) {
    for (const key of ['basic', 'middle', 'high', 'supreme'] as const) {
      const state = initialHealthy();
      state.inventory[key] = 3 * count;
      state.inventory.keepsake = 3 * count;
      for (const ingredient of key === 'supreme' ? ([key, 'keepsake'] as const) : [key]) {
        const short = { ...state, inventory: { ...state.inventory, [ingredient]: 3 * count - 1 } };
        const before = structuredClone(short);
        const noRoll = () => {
          throw Error('MUST_NOT_ROLL');
        };
        assert.throws(
          () => runFusionBatch({ state: short, item: key, count }, noRoll),
          /FUSION_UNAVAILABLE/,
        );
        const demo = { ...short, inventory: { ...short.inventory }, log: [] };
        assert.equal(demoFuseBatch(demo, key, count, noRoll), null);
        assert.deepEqual(short, before);
        assert.deepEqual(demo.inventory, before.inventory);
      }
      for (const sample of [0, 0.999999]) {
        let rolls = 0;
        const batch = runFusionBatch({ state, item: key, count }, () => {
          rolls++;
          return sample;
        });
        assert.equal(rolls, count);
        assert.equal(batch.result.count, count);
        assert.equal(batch.result.stoppedEarly, false);
        assert.equal(batch.result.consumed[key], count * 3);
        const demo = { ...state, inventory: { ...state.inventory }, log: [] };
        assert.deepEqual(
          demoFuseBatch(demo, key, count, () => sample),
          batch.result,
        );
        assert.deepEqual(demo.inventory, batch.state.inventory);
      }
    }
  }
});

test('immortal crafting uses a 20% boundary, burns both ingredients on failure, and requires the full recipe', async () => {
  const demoPath = '../../web/demo/cultivation.js';
  const { demoFuse } = await import(demoPath);
  const state = initialHealthy();
  state.inventory.supreme = 6;
  state.inventory.keepsake = 6;
  for (const roll of [0, 0.199999, 0.2, 0.999999]) {
    const outcome = fuseCharm(state, 'supreme', roll);
    assert.equal(outcome.success, roll < 0.2);
    assert.equal(outcome.state.inventory.supreme, 3);
    assert.equal(outcome.state.inventory.keepsake, 3);
    assert.equal(outcome.state.inventory.immortal, roll < 0.2 ? 1 : 0);
    const demo = { ...state, inventory: { ...state.inventory }, log: [] };
    assert.equal(
      demoFuse(demo, 'supreme', () => roll),
      outcome.success,
    );
    assert.deepEqual(demo.inventory, outcome.state.inventory);
  }
  for (const key of ['supreme', 'keepsake'] as const) {
    const short = { ...state, inventory: { ...state.inventory, [key]: 2 } };
    assert.throws(() => fuseCharm(short, 'supreme', 0), /FUSION_UNAVAILABLE/);
    assert.equal(short.inventory.immortal, 0);
  }
  assert.equal(state.inventory.supreme, 6);
  assert.equal(state.inventory.keepsake, 6);
});

test('immortal breakthrough has a one-qi base penalty, applies triple penalties, and is consumed on either outcome', () => {
  for (let rank = 0; rank < REALMS.length - 1; rank++) {
    const target = REALMS[rank + 1]!;
    const state = { ...initialHealthy(), qi: target.qi, streak: target.days, rank };
    state.inventory.immortal = 1;
    const failed = breakthrough(state, 1, 1000, 'immortal', 0.999999, {
      chancePoints: 0,
      preventLoss: false,
      penaltyMultiplier: 3,
    });
    assert.equal(failed.penalty, 3);
    assert.equal(failed.state.qi, state.qi - 3);
    assert.equal(breakthrough(state, 1, 1000, 'immortal', 0.999999).penalty, 1);
    assert.equal(failed.chance, Math.min(100, target.chance + 25));
    assert.equal(failed.state.inventory.immortal, 0);
    assert.equal(failed.state.immortalPity, true);
    assert.equal(failed.state.inventory.heart, 1);
    assert.equal(failed.state.inventory.peace, 1);
    const success = breakthrough(state, 1, 1000, 'immortal', 0);
    assert.equal(success.penalty, 0);
    assert.equal(success.state.inventory.immortal, 0);
    assert.equal(success.state.inventory.heart, 1);
    assert.equal(success.state.inventory.peace, 1);
    assert.equal(success.state.immortalPity, false, 'success does not unlock the pity floor');
  }
});

test('immortal pity skips the wait, never stacks, resets with the failure chain, and agrees with demo and display', async () => {
  const demoPath = '../../web/demo/cultivation.js';
  const modelPath = '../../web/models/cultivation.js';
  const { demoBreakthrough } = await import(demoPath);
  const { breakthroughPity } = await import(modelPath);
  const fresh = { ...initialHealthy(), qi: 1000, streak: 100 };
  fresh.inventory.immortal = 1;
  const failedWithCharm = breakthrough(fresh, 1, 1000, 'immortal', 0.99).state;
  assert.equal(failedWithCharm.failures, 1, 'charm does not fabricate extra failed attempts');
  assert.equal(
    breakthrough(failedWithCharm, 2, 2000, null, 0.99).chance,
    70,
    'next attempt gets the five-point floor immediately',
  );
  for (const failures of [0, 1, 2, 3, 4, 100]) {
    for (const item of [null, 'immortal'] as const) {
      const state = { ...initialHealthy(), qi: 1000, streak: 100, immortalPity: true, failures };
      state.inventory.immortal = 1;
      const expected = Math.max(5, 5 * Math.min(Math.max(failures - 1, 0), 3));
      assert.equal(breakthroughPity(state), expected);
      for (const sample of [0, 0.999999]) {
        const outcome = breakthrough(state, 1, 1000, item, sample);
        assert.equal(outcome.chance, Math.min(100, 65 + expected + (item ? 25 : 0)));
        assert.equal(outcome.state.immortalPity, !outcome.success);
        const demo = { ...state, inventory: { ...state.inventory }, log: [] };
        demoBreakthrough(demo, 1, item, 1000, () => sample);
        assert.equal(demo.immortalPity, !outcome.success);
        assert.deepEqual(demo.inventory, outcome.state.inventory);
      }
    }
  }
  const won = breakthrough(
    { ...initialHealthy(), qi: 1000, streak: 100, immortalPity: true },
    1,
    1000,
    null,
    0,
  ).state;
  assert.equal(won.failures, 0);
  assert.equal(won.immortalPity, false);
  assert.equal(breakthrough(won, 2, 2000, null, 0).chance, 60, 'new realm has no carried support');
  const demoted = assessSleep(
    { ...won, qi: 15, protectedUntil: 0, immortalPity: true },
    {
      day: 2,
      target: 2000,
      end: 3000,
      reportedAt: null,
      chatActive: true,
      assessedAt: 3000,
    },
  );
  assert.equal(demoted.demoted, true);
  assert.equal(demoted.state.immortalPity, false);
  const restored = undoSleepAssessment(
    demoted.state,
    { ...won, qi: 15, protectedUntil: 0, immortalPity: true },
    demoted.state,
  );
  assert.equal(
    restored.immortalPity,
    true,
    'undo restores only the support cleared by sleep demotion',
  );
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
    assert.equal(success.state.rank, rank + 1);
    assert.equal(success.state.streak, s.streak);
    assert.throws(
      () => breakthrough({ ...s, qi: target.qi - 1 }, 1, 1000, null, 0),
      /BREAKTHROUGH_UNAVAILABLE/,
    );
    assert.throws(
      () => breakthrough({ ...s, streak: target.days - 1 }, 1, 1000, null, 0),
      /BREAKTHROUGH_UNAVAILABLE/,
    );
  }
});
