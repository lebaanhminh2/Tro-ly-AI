import test from 'node:test';
import assert from 'node:assert/strict';
import { newPracticeVersion, settlePracticeDay, type PracticeVersion } from '../../src/domain/practice.ts';
import { newTimePracticeVersion, timePeriodMaximum, timePracticeSummary } from '../../src/domain/practice-progression.ts';
import { practicePresentation, practiceUpgrade } from '../../src/domain/practice-presentation.ts';
import { perfectTierProfile, profileForPractice, techniquePowers, practiceStrength } from '../../src/domain/technique-profile.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';
import { battleTechnique } from '../../src/domain/battle-techniques.ts';

const monday = 20738;
function train(days: number, techniqueId = 'kiem-y', misses = 0) {
    let version = newTimePracticeVersion('edition_test', techniqueId, monday);
    for (let offset = 0; offset < days; offset++) version = settlePracticeDay(monday + offset, version.id, [version], [],
        ['one', 'two'].map(habitId => ({ habitId, successes: habitId === 'two' && offset < misses ? 0 : 1,
            misses: habitId === 'two' && offset < misses ? 1 : 0, mature: true, weekly: null, cadence: { kind: 'daily' as const } }))).versions[0]!;
    return version;
}

test('upgrade reference is separate from ownership and all four tiers show actual combat benefits', () => {
    const unlearned = practiceUpgrade(null, 'kiem-y');
    assert.equal(unlearned.current, null);
    assert.equal(unlearned.nextMaximum!.damage, 110);
    assert.equal(unlearned.nextTier, 1);
    assert.deepEqual(unlearned.referenceRoadmap.map(value => value.totalDays), [3, 7, 13, 21]);
    for (const step of unlearned.referenceRoadmap) assert.deepEqual(step.profile, perfectTierProfile('kiem-y', step.tier));
    const owned = practiceUpgrade(train(3), 'kiem-y');
    assert.equal(owned.current!.damage, 110);
    assert.equal(owned.nextMaximum!.damage, 129);
    assert.equal(owned.rows.find(row => row.label === 'Xuyên Phòng thủ')!.next, 40);
    assert.equal(owned.rows.find(row => row.label === 'Tăng sát thương nối chiêu')!.kind, 'unlock');
});

test('attainable edition never repairs lost early damage or inherited purity using perfect reference tiers', () => {
    const version = train(9, 'kiem-y', 3), original = structuredClone(version);
    const upgrade = practiceUpgrade(version, 'kiem-y');
    assert.equal(practiceStrength(version)!.damageFactorMilli, 880);
    assert.equal(upgrade.current!.damage, profileForPractice(version)!.damage);
    assert.equal(upgrade.editionMaximum!.damagePower, 124);
    assert.equal(upgrade.editionMaximum!.totalPurityBp, 5000);
    assert.equal(practicePresentation(version).training!.permanentLossBp, 5000, 'settled inherited defects cannot be repaired');
    assert.ok(upgrade.editionMaximum!.damage < upgrade.referenceRoadmap[3]!.profile.damage);
    assert.deepEqual(version, original, 'opening upgrade information never mutates an earned edition');
});

test('owned upgrade time uses the persisted edition schedule while fresh references use the new one', () => {
    const version = train(3);
    const oldDays = [3, 6, 10, 15];
    version.time!.periods.forEach((period, index) => { period.requiredDays = oldDays[index]!; });
    version.costsMilli = oldDays.map(days => days * 1000);
    const result = practiceUpgrade(version, 'kiem-y');
    assert.equal(result.remainingDays, 6);
    assert.equal(practicePresentation(version).training!.current!.requiredDays, 6);
    assert.deepEqual(result.referenceRoadmap.map(step => step.totalDays), [3, 7, 13, 21]);
    assert.equal(result.current!.damage, 110);
});

test('forecast respects selected weekdays and weekly quota rather than granting one success every day', () => {
    let version = newTimePracticeVersion('weekday_edition', 'kiem-y', monday);
    for (let offset = 0; offset < 2; offset++) version = settlePracticeDay(monday + offset, version.id, [version], [],
        [{ habitId: 'one', successes: 0, misses: offset === 1 ? 1 : 0, mature: true,
            weekly: null, cadence: { kind: 'weekdays', weekdays: [1] } }]).versions[0]!;
    assert.equal(timePeriodMaximum(version, 0).bp, 0, 'Wednesday is outside the Tuesday-only commitment');
    assert.equal(timePracticeSummary(version).maximumPurityBp, 0);
    const quota = newTimePracticeVersion('weekly_edition', 'kiem-y', monday);
    quota.time!.periods[0] = { ...quota.time!.periods[0]!, bound: true, requiredDays: 6, days: 1, startedDay: monday,
        members: [{ habitId: 'weekly', successesMilli: 0, missesMilli: 1000, cadence: { kind: 'weekly', quota: 1 } }] };
    quota.time!.lastTrainingDay = monday;
    assert.equal(timePeriodMaximum(quota, 0).bp, 5000, 'one remaining weekly success, not five');
});

test('open weekly forecast retains inevitable misses and remains an estimate, not an awarded grade', () => {
    const version = newTimePracticeVersion('weekly_edition', 'kiem-y', monday);
    version.time!.periods[0] = { ...version.time!.periods[0]!, bound: true, days: 3, openedDay: monday + 2, startedDay: monday,
        members: [{ habitId: 'weekly', successesMilli: 1000, missesMilli: 0, cadence: { kind: 'weekly', quota: 3 } }] };
    version.tiers = [{ tier: 1, purityBp: 0, effortMilli: 0, defectsMilli: 0, startedDay: monday, lockedDay: monday + 2 }];
    version.time!.lastTrainingDay = monday + 5;
    const weeks = [{ key: 'weekly:' + monday, habitId: 'weekly', startDay: monday, endDay: monday + 7,
        quota: 3, successes: 1, misses: 1, closedDay: null,
        claims: [{ versionId: version.id, tier: 1, effortMilli: 3000 }], fallback: null, allocations: [] }];
    const presentation = practicePresentation(version, 100, { afterDay: monday + 6, weeks });
    assert.ok(presentation.training!.maximumPurityBp < 10000);
    assert.equal(presentation.training!.totalPurityBp, 0);
    assert.equal(presentation.training!.provisional, true);
    assert.equal(presentation.training!.grade, null);
    assert.equal(presentation.training!.permanentLossBp, 0, 'a provisional weekly allocation is not declared a settled loss');
});

test('public training projection is compact, keeps settlement dates and does not expose member ledgers', () => {
    const version = train(21), value = practicePresentation(version);
    assert.equal(value.training!.current, null);
    assert.equal(value.training!.periods.length, 4);
    assert.equal(value.training!.periods[0]!.openedDay, monday + 2);
    assert.equal(value.training!.periods[0]!.ratioSettledDay, monday + 2);
    assert.equal(value.training!.periods[0]!.qualitySettledDay, monday + 2);
    assert.equal(value.training!.periods[0]!.memberCount, 2);
    assert.ok(!JSON.stringify(value.training).includes('successesMilli'));
    assert.equal(practiceUpgrade(version, 'kiem-y').nextMaximum, null);
    assert.equal(value.training!.grade!.name, 'Thông Thần');
});

test('legacy profiles retain their earned force while new training references stay separate', () => {
    const legacy: PracticeVersion = newPracticeVersion('legacy_edition', 'kiem-y', monday);
    legacy.tiers.push({ tier: 1, purityBp: 5000, effortMilli: 3000, defectsMilli: 1000, startedDay: monday, lockedDay: monday + 3 });
    const value = practiceUpgrade(legacy, 'kiem-y');
    assert.equal(value.current!.damage, 77);
    assert.equal(value.nextMaximum, null);
    assert.equal(value.editionMaximum, null);
    assert.equal(value.legacy, true);
    assert.equal(practicePresentation(legacy).training, null);
});

test('strength validation rejects forged quality bonuses and quality above opened tiers', () => {
    const strength = practiceStrength(train(3))!;
    assert.throws(() => techniquePowers(100, 1, 10000, 0, { ...strength, gradeBonusMilli: 150 }), /INVALID_TECHNIQUE_STRENGTH/);
    assert.throws(() => techniquePowers(100, 1, 10000, 0, { ...strength, totalPurityBp: 8000, gradeBonusMilli: 50 }), /INVALID_TECHNIQUE_STRENGTH/);
});

test('upgrades expose growing damage caps even when the advertised rate stays unchanged', () => {
    const kinds = ['convert_intent', 'max_hp_strike', 'copy', 'echo'];
    const techniques = TECHNIQUES.filter(value => battleTechnique(value.id).effects.some(effect => kinds.includes(effect.kind)));
    assert.ok(techniques.length >= 4, 'all cap-based families must be exercised');
    for (const technique of techniques) {
        const firstDays = newTimePracticeVersion('reference', technique.id, monday, technique.trainingFactor).time!.periods[0]!.requiredDays;
        const upgrade = practiceUpgrade(train(firstDays, technique.id), technique.id);
        for (const effect of upgrade.current!.effects.filter(effect => kinds.some(kind => effect.id.startsWith(kind + ':')))) {
            const row = upgrade.rows.find(value => value.id === effect.id);
            assert.ok(row, technique.id + ': growing cap is visible');
            assert.equal(row.kind, 'habit', technique.id + ': cap comes from earned damage');
            assert.equal(row.current, row.next, 'the source rate is unchanged');
            assert.ok(row.changes!.includes('limit'));
            assert.notEqual(row.previous!.limit, row.limit);
        }
    }
});

test('the four-tier roadmap includes support improvements and distinguishes a finished but unsettled edition', () => {
    const roadmap = practiceUpgrade(null, 'huyen-quy').referenceRoadmap;
    const shield = roadmap[1]!.changes.find(row => row.label === 'Khiên')!;
    assert.ok(shield.next! > shield.current!);
    assert.equal(shield.kind, 'tier');
    assert.ok(roadmap[1]!.changes.some(row => row.group === 'Nội tại' && row.kind === 'unlock'));
    const finished = train(21);
    assert.equal(practiceUpgrade(finished, 'kiem-y').awaitingSettlement, false);
    let pending = newTimePracticeVersion('pending_edition', 'kiem-y', monday), weeks: Parameters<typeof settlePracticeDay>[3] = [];
    pending.time!.periods.forEach((period, index) => { period.requiredDays = 1; pending.costsMilli[index] = 1000; });
    for (let offset = 0; offset < 4; offset++) {
        const result = settlePracticeDay(monday + offset, pending.id, [pending], weeks, [{ habitId: 'weekly',
            successes: offset === 0 ? 1 : 0, misses: 0, mature: true, cadence: { kind: 'weekly', quota: 3 },
            weekly: { startDay: monday, endDay: monday + 7, quota: 3, successesBefore: offset ? 1 : 0, missesBefore: 0 } }]);
        pending = result.versions[0]!; weeks = result.weeks;
    }
    const final = practiceUpgrade(pending, 'kiem-y', 100, { weeks });
    assert.equal(final.nextTier, null);
    assert.equal(final.awaitingSettlement, true);
});
