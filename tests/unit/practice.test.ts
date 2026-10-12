import test from 'node:test';
import assert from 'node:assert/strict';
import { newPracticeVersion, practicePurity, settlePracticeDay, type PracticeSource,
    type PracticeVersion, type PracticeWeek } from '../../src/domain/practice.ts';
import { TECHNIQUES, INITIAL_TECHNIQUES, SCHOOLS } from '../../src/domain/techniques.ts';
const monday = 20738;
const daily = (met = true, mature = true, habitId = 'daily'): PracticeSource => ({ habitId, successes: Number(met), misses: Number(!met), mature, weekly: null });
const weekly = (day: number, success: boolean, miss: boolean): PracticeSource => ({ habitId: 'weekly', successes: Number(success), misses: Number(miss), mature: false,
    weekly: { startDay: monday, endDay: monday + 7, quota: 3, successesBefore: 0, missesBefore: 0 } });

test('one consistent habit reaches every tier at 100%; Outside requires twice the actual training days', () => {
    for (const [factor, totalDays] of [[1000, 34], [1500, 52], [2000, 68]]) {
        let versions = [newPracticeVersion('v1', 'kiem-y', monday, factor)], locked = 0;
        for (let offset = 0; offset < totalDays!; offset++) {
            const result = settlePracticeDay(monday + offset, 'v1', versions, [], [daily()]);
            versions = result.versions; locked += result.locked.length;
            if (offset < totalDays! - 1) assert.ok(versions[0]!.tiers.length < 4);
        }
        assert.equal(locked, 4);
        assert.equal(versions[0]!.effortMilli, 34 * factor!);
        assert.deepEqual(versions[0]!.tiers.map(tier => tier.purityBp), [10000, 10000, 10000, 10000]);
    }
});
test('partial and neutral days create no positive contribution; additional habits have a bounded mature bonus', () => {
    const initial = newPracticeVersion('v1', 'kiem-y', monday);
    const neutral = settlePracticeDay(monday, 'v1', [initial], [], [{ ...daily(false), misses: 0 }]);
    assert.equal(neutral.progressMilli, 0); assert.equal(neutral.versions[0]!.defectsMilli, 0);
    const failed = settlePracticeDay(monday, 'v1', [initial], [], [daily(false)]);
    assert.equal(failed.progressMilli, 0); assert.equal(failed.versions[0]!.defectsMilli, 1000);
    for (const mature of [false, true]) {
        const result = settlePracticeDay(monday, 'v1', [initial], [], Array.from({ length: 30 }, (_, i) => daily(true, mature, 'h' + i)));
        assert.equal(result.progressMilli, mature ? 1600 : 1000);
    }
    assert.equal(initial.progressMilli, 0, 'Transition never mutates its input');
    assert.throws(() => settlePracticeDay(monday, 'v1', [initial], [], [daily(), daily()]), /INVALID_PRACTICE_SOURCE/);
});
test('an early defect locks into the version; later perfect tiers cannot heal it and a fresh version starts at tier one', () => {
    let versions = [newPracticeVersion('v1', 'kiem-y', monday)];
    versions = settlePracticeDay(monday, 'v1', versions, [], [daily(false)]).versions;
    for (let day = monday + 1; day <= monday + 3; day++) versions = settlePracticeDay(day, 'v1', versions, [], [daily()]).versions;
    assert.equal(versions[0]!.tiers[0]!.purityBp, 6000);
    const first = structuredClone(versions[0]!.tiers[0]);
    for (let day = monday + 4; day < monday + 35; day++) versions = settlePracticeDay(day, 'v1', versions, [], [daily()]).versions;
    assert.deepEqual(versions[0]!.tiers[0], first);
    assert.ok(versions[0]!.tiers.every(tier => tier.purityBp <= 6000));
    const old = structuredClone(versions[0]); versions.push(newPracticeVersion('v2', 'kiem-y', monday + 35));
    for (let day = monday + 35; day < monday + 38; day++) versions = settlePracticeDay(day, 'v2', versions, [], [daily()]).versions;
    assert.equal(versions[1]!.tiers[0]!.purityBp, 10000); assert.equal(versions[1]!.tiers.length, 1);
    assert.deepEqual(versions[0], old);
});
test('weekly quality waits for unavoidable misses and survives stopping or moving into battle', () => {
    let versions = [newPracticeVersion('v1', 'kiem-y', monday)], weeks: PracticeWeek[] = [];
    for (let offset = 0; offset < 7; offset++) {
        const result = settlePracticeDay(monday + offset, offset < 3 ? 'v1' : null, versions, weeks,
            [daily(), weekly(monday + offset, offset === 0, offset >= 5)]);
        versions = result.versions; weeks = result.weeks;
        if (offset >= 2 && offset < 6) {
            assert.equal(versions[0]!.progressMilli, 3000);
            assert.equal(versions[0]!.tiers.length, 0);
            assert.equal(versions[0]!.pendingWeeks.length, 1);
        }
    }
    assert.equal(versions[0]!.tiers[0]!.purityBp, 4285);
    assert.equal(versions[0]!.tiers[0]!.defectsMilli, 2000);
    assert.equal(weeks[0]!.misses, 2);
    assert.deepEqual(weeks[0]!.allocations, [{ versionId: 'v1', tier: 1, defectsMilli: 2000 }]);
});
test('moving practice versions shares the whole weekly defect by actual borrowed progress, without duplicate defects', () => {
    let versions = ['a', 'b'].map(id => newPracticeVersion(id, 'kiem-y', monday)), weeks: PracticeWeek[] = [];
    for (let offset = 0; offset < 7; offset++) {
        const result = settlePracticeDay(monday + offset, offset < 3 ? 'a' : 'b', versions, weeks,
            [daily(), weekly(monday + offset, offset === 0, offset >= 5)]);
        versions = result.versions; weeks = result.weeks;
    }
    assert.deepEqual(versions.map(version => version.tiers[0]!.purityBp), [6000, 6000]);
    assert.equal(weeks[0]!.allocations.reduce((sum, row) => sum + row.defectsMilli, 0), 2000);
});
test('Sunday-only practice cannot erase misses that happened while idle earlier in the same commitment week', () => {
    const version = newPracticeVersion('a', 'kiem-y', monday + 6), source = weekly(monday + 6, true, false);
    source.weekly!.missesBefore = 2;
    const result = settlePracticeDay(monday + 6, 'a', [version], [], [source]);
    assert.equal(result.versions[0]!.progressMilli, 1000);
    assert.equal(result.versions[0]!.defectsMilli, 2000);
    assert.equal(practicePurity(1000, 2000, 1), 2000);
});
test('fulfilling Q early closes the quality obligation and permits the ready tier to lock immediately', () => {
    let versions = [newPracticeVersion('a', 'kiem-y', monday)], weeks: PracticeWeek[] = [];
    for (let offset = 0; offset < 3; offset++) {
        const result = settlePracticeDay(monday + offset, 'a', versions, weeks, [weekly(monday + offset, true, false)]);
        versions = result.versions; weeks = result.weeks;
    }
    assert.equal(versions[0]!.tiers[0]!.lockedDay, monday + 2);
    assert.equal(versions[0]!.tiers[0]!.purityBp, 10000); assert.deepEqual(versions[0]!.pendingWeeks, []);
    const tier = structuredClone(versions[0]!.tiers[0]);
    const result = settlePracticeDay(monday + 3, 'a', versions, weeks, [weekly(monday + 3, false, false)]);
    assert.deepEqual(result.versions[0]!.tiers[0], tier); assert.equal(result.progressMilli, 0);
});
test('a week with zero progress still retains defects on its last unfinished practice receiver', () => {
    let versions = [newPracticeVersion('a', 'kiem-y', monday)], weeks: PracticeWeek[] = [];
    for (let offset = 0; offset < 7; offset++) {
        const result = settlePracticeDay(monday + offset, offset < 2 ? 'a' : null, versions, weeks,
            [weekly(monday + offset, false, offset >= 4)]);
        versions = result.versions; weeks = result.weeks;
    }
    assert.equal(versions[0]!.effortMilli, 0); assert.equal(versions[0]!.defectsMilli, 3000);
    assert.equal(versions[0]!.tiers.length, 0);
});
test('catalog has all 39 stable identities and five distinct starter paths', () => {
    assert.equal(TECHNIQUES.length, 39); assert.equal(new Set(TECHNIQUES.map(technique => technique.id)).size, 39);
    assert.equal(TECHNIQUES.filter(technique => technique.kind === 'forbidden').length, 8);
    assert.equal(TECHNIQUES.filter(technique => technique.kind === 'outside').length, 6);
    assert.equal(INITIAL_TECHNIQUES.length, 5);
    for (const school of SCHOOLS) {
        assert.equal(TECHNIQUES.filter(technique => technique.school === school.id).length, 5);
        assert.ok(INITIAL_TECHNIQUES.some(id => TECHNIQUES.find(technique => technique.id === id)?.school === school.id));
    }
    assert.ok(TECHNIQUES.every(technique => technique.description && technique.identity));
});
