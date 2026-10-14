import test from 'node:test';
import assert from 'node:assert/strict';
import { newTimePracticeVersion, timePracticeSummary, timePeriodMaximum } from '../../src/domain/practice-progression.ts';
import { newPracticeVersion, settlePracticeDay, type PracticeSource, type PracticeVersion, type PracticeWeek } from '../../src/domain/practice.ts';

const monday = 20738;
const daily = (met: boolean, habitId = 'daily'): PracticeSource =>
    ({ habitId, successes: +met, misses: +!met, mature: true, weekly: null, cadence: { kind: 'daily' } });
const weekly = (offset: number, met = offset === 0): PracticeSource => ({ habitId: 'weekly', successes: +met,
    misses: +(!met && offset >= 5), mature: true, cadence: { kind: 'weekly', quota: 3 },
    weekly: { startDay: monday, endDay: monday + 7, quota: 3, successesBefore: 0, missesBefore: 0 } });

function train(outcomes: boolean[], factor = 1000) {
    let versions = [newTimePracticeVersion('time_a', 'kiem-y', monday, factor)];
    let weeks: PracticeWeek[] = [];
    for (const [offset, met] of outcomes.entries()) {
        const result = settlePracticeDay(monday + offset, 'time_a', versions, weeks, [daily(met)]);
        versions = result.versions; weeks = result.weeks;
    }
    return versions[0]!;
}

test('time opens each tier even at zero completions; extra habits never accelerate the clock', () => {
    for (const [factor, days] of [[1000, 21], [1500, 32], [2000, 42]]) {
        const version = train(Array(days).fill(false), factor);
        assert.equal(version.tiers.length, 4);
        assert.deepEqual(version.time!.periods.map(period => period.ratioBp), [0, 0, 0, 0]);
        assert.equal(timePracticeSummary(version).totalPurityBp, 0);
        assert.equal(timePracticeSummary(version).damageFactorMilli, 400);
    }
    const initial = newTimePracticeVersion('time_a', 'kiem-y', monday);
    const result = settlePracticeDay(monday, 'time_a', [initial], [],
        Array.from({ length: 30 }, (_, index) => daily(true, 'h_' + index)));
    assert.equal(result.progressMilli, 1000);
    assert.equal(result.versions[0]!.time!.periods[0]!.days, 1);
    assert.equal(initial.time!.periods[0]!.days, 0);
});

test('each period earns independent damage while old defects cap purity; neutral is distinct from failure', () => {
    // Tier 2 has two of four commitments; later periods are perfect.
    const version = train([...Array(3).fill(true), true, false, true, false, ...Array(14).fill(true)]);
    assert.deepEqual(version.time!.periods.map(period => period.ratioBp), [10000, 5000, 10000, 10000]);
    assert.deepEqual(version.time!.periods.map(period => period.qualityBp), [10000, 5000, 5000, 5000]);
    const summary = timePracticeSummary(version);
    assert.equal(summary.damageFactorMilli, 1450);
    assert.equal(summary.totalPurityBp, 6250); assert.equal(summary.maximumPurityBp, 6250);
    assert.equal(summary.grade, null);
    let neutral = newTimePracticeVersion('neutral', 'kiem-y', monday);
    for (let offset = 0; offset < 3; offset++) neutral = settlePracticeDay(monday + offset, 'neutral', [neutral], [], []).versions[0]!;
    assert.equal(neutral.time!.periods[0]!.hasObligation, false);
    for (let offset = 3; offset < 9; offset++) neutral = settlePracticeDay(monday + offset, 'neutral', [neutral], [], [daily(true)]).versions[0]!;
    assert.equal(neutral.time!.periods[1]!.qualityBp, 10000);
    assert.equal(timePracticeSummary(neutral).totalPurityBp, 2500, 'empty period grants no free purity');
});

test('a 50% first period never cuts a later 100% damage increment', () => {
    let version = newTimePracticeVersion('time_a', 'kiem-y', monday);
    for (let offset = 0; offset < 9; offset++) {
        const sources = offset < 3 ? [daily(true, 'one'), daily(false, 'two')] : [daily(true, 'one'), daily(true, 'two')];
        version = settlePracticeDay(monday + offset, 'time_a', [version], [], sources).versions[0]!;
    }
    assert.equal(timePracticeSummary(version).damageFactorMilli, 880, '0.4 + 0.6×0.5 + 0.18×1');
    assert.equal(version.time!.periods[1]!.qualityBp, 5000);
});

test('persisted 34-day v2 schedules continue unchanged when new editions use 21 days', () => {
    let persisted = newTimePracticeVersion('persisted_34', 'kiem-y', monday);
    const originalDays = [3, 6, 10, 15];
    persisted.time!.periods.forEach((period, index) => { period.requiredDays = originalDays[index]!; });
    persisted.costsMilli = originalDays.map(days => days * 1000);
    for (let offset = 0; offset < 9; offset++) persisted = settlePracticeDay(monday + offset, persisted.id,
        [persisted], [], [daily(true)]).versions[0]!;
    assert.equal(persisted.tiers.length, 2);
    assert.deepEqual(persisted.tiers.map(tier => tier.lockedDay), [monday + 2, monday + 8]);
    const paused = settlePracticeDay(monday + 20, null, [persisted], [], []);
    assert.deepEqual(paused.versions[0], persisted);
    persisted = settlePracticeDay(monday + 21, persisted.id, paused.versions, [], [daily(true)]).versions[0]!;
    assert.deepEqual(persisted.time!.periods.map(period => period.requiredDays), originalDays);
    assert.equal(persisted.time!.periods[2]!.days, 1, 'Elapsed paused days cannot accelerate a stored clock');
    assert.equal(timePracticeSummary(persisted).damageFactorMilli, 1180);
    assert.deepEqual(newTimePracticeVersion('fresh_21', 'kiem-y', monday).costsMilli, [3000, 4000, 6000, 8000]);
});

test('weekly audit spans two opened tiers, stopping and battle days without delaying effects or duplicating misses', () => {
    let versions = [newTimePracticeVersion('time_a', 'kiem-y', monday)], weeks: PracticeWeek[] = [];
    for (let offset = 0; offset < 7; offset++) {
        const result = settlePracticeDay(monday + offset, offset < 5 ? 'time_a' : null, versions, weeks, [weekly(offset)]);
        versions = result.versions; weeks = result.weeks;
        if (offset === 2) {
            assert.equal(versions[0]!.tiers.length, 1, 'tier opens on its time deadline');
            assert.equal(versions[0]!.time!.periods[0]!.ratioBp, null);
            assert.equal(timePracticeSummary(versions[0]!).awaitingAudit, true);
        }
    }
    assert.equal(weeks[0]!.allocations.reduce((sum, item) => sum + item.defectsMilli, 0), 2000);
    assert.deepEqual(weeks[0]!.allocations.map(item => [item.tier, item.defectsMilli]), [[1, 1200], [2, 800]]);
    assert.equal(versions[0]!.time!.periods[0]!.ratioBp, 4545);
    assert.equal(versions[0]!.time!.periods[1]!.members[0]!.missesMilli, 800);
    assert.deepEqual(versions[0]!.pendingWeeks, []);
    assert.throws(() => settlePracticeDay(monday + 4, 'time_a', versions, weeks, []), /PRACTICE_DAY_REPLAY/);
});

test('later period damage settles independently while inherited quality awaits an earlier week', () => {
    let version = newTimePracticeVersion('time_a', 'kiem-y', monday);
    version.time!.periods[0]!.requiredDays = 1; version.costsMilli[0] = 1000;
    version.time!.periods[1]!.requiredDays = 1; version.costsMilli[1] = 1000;
    let weeks: PracticeWeek[] = [];
    let result = settlePracticeDay(monday, 'time_a', [version], weeks, [weekly(0)]);
    version = result.versions[0]!; weeks = result.weeks;
    result = settlePracticeDay(monday + 1, 'time_a', [version], weeks, [daily(true)]);
    version = result.versions[0]!;
    assert.equal(version.tiers.length, 2);
    assert.equal(version.time!.periods[0]!.ratioBp, null);
    assert.equal(version.time!.periods[1]!.ratioBp, 10000);
    assert.equal(version.time!.periods[1]!.qualityBp, null);
    assert.equal(timePracticeSummary(version).damageFactorMilli, 580);
});

test('membership freezes per tier, grade uses settled totals only, legacy transitions retain exact behavior', () => {
    let version = newTimePracticeVersion('time_a', 'kiem-y', monday);
    for (let offset = 0; offset < 3; offset++) version = settlePracticeDay(monday + offset, 'time_a', [version], [],
        offset === 0 ? [daily(false)] : [daily(false), daily(true, 'new')]).versions[0]!;
    assert.equal(version.time!.periods[0]!.ratioBp, 0);
    version = settlePracticeDay(monday + 3, 'time_a', [version], [], [daily(true), daily(true, 'new')]).versions[0]!;
    assert.equal(version.time!.periods[1]!.members.length, 2);
    const perfect = train(Array(21).fill(true));
    assert.equal(timePracticeSummary(perfect).grade!.name, 'Thông Thần');
    assert.equal(timePracticeSummary(perfect).grade!.bonusMilli, 150);
    const legacy = newPracticeVersion('legacy', 'kiem-y', monday);
    const mixed: PracticeVersion[] = [legacy, perfect];
    const result = settlePracticeDay(monday + 40, 'legacy', mixed, [], [daily(true)]);
    assert.equal(result.versions[0]!.progressMilli, 1000);
    assert.deepEqual(result.versions[1], perfect);
});

test('cadence revisions and paused clocks only change provisional forecasts, never settled losses or earned damage', () => {
    let version = train([true, false]);
    const before = timePracticeSummary(version);
    assert.equal(before.maximumPurityBp, 6666);
    assert.equal(before.permanentLossBp, 0, 'period is not settled yet');
    version.time!.periods[0]!.members[0]!.cadence = { kind: 'weekdays', weekdays: [0] };
    const unscheduled = timePracticeSummary(version, { afterDay: monday + 2 });
    const resumedMonday = timePracticeSummary(version, { afterDay: monday + 7 });
    assert.equal(unscheduled.maximumPurityBp, 5000);
    assert.equal(resumedMonday.maximumPurityBp, 6666);
    assert.equal(resumedMonday.permanentLossBp, 0);
    const stopped = settlePracticeDay(monday + 6, null, [version], [], []);
    assert.deepEqual(stopped.versions[0], version, 'pause does not advance training');
    version = settlePracticeDay(monday + 7, version.id, stopped.versions, stopped.weeks,
        [{ ...daily(true), cadence: { kind: 'weekdays', weekdays: [0] } }]).versions[0]!;
    const settled = timePracticeSummary(version);
    assert.equal(settled.maximumPurityBp, 6666); assert.equal(settled.permanentLossBp, 3334);
    assert.equal(settled.damageFactorMilli, 799);
    const laterContext = timePracticeSummary(version, { afterDay: monday + 100 });
    assert.equal(laterContext.permanentLossBp, settled.permanentLossBp);
    assert.equal(laterContext.damageFactorMilli, settled.damageFactorMilli);
});

test('weekly forecast uses remaining quota rather than counting every remaining training day as a success', () => {
    const version = newTimePracticeVersion('quota_forecast', 'kiem-y', monday);
    const period = version.time!.periods[0]!;
    period.bound = true; period.startedDay = monday; period.days = 1; version.time!.lastTrainingDay = monday;
    period.members = [{ habitId: 'quota', successesMilli: 1000, missesMilli: 1000, cadence: { kind: 'weekly', quota: 3 } }];
    const context: PracticeWeek = { key: 'quota:' + monday, habitId: 'quota', startDay: monday, endDay: monday + 7,
        quota: 3, successes: 2, misses: 0, claims: [], fallback: null, allocations: [], closedDay: null };
    assert.equal(timePeriodMaximum(version, 0, { afterDay: monday + 1, weeks: [context] }).bp, 6666);
    context.successes = 3;
    assert.equal(timePeriodMaximum(version, 0, { afterDay: monday + 1, weeks: [context] }).bp, 5000);
});
