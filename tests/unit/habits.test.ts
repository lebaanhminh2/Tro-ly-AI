import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHabitDay, cumulativeWeeklyMisses, firstCommitmentDay, habitChangeDay,
    habitSpeedMultiplier, habitWeekday, habitWeekStart, newHabitPeriod, parseHabitDefinition,
    scaledHabitValue, validateRecordedValue, type HabitDefinition } from '../../src/domain/habits.ts';

const monday = Math.floor(Date.parse('2026-10-12T00:00:00Z') / 86_400_000);
function definition(quota: number): HabitDefinition {
    return parseHabitDefinition({ name: 'Đọc sách', metric: 'duration', target: 20, cadence: { kind: 'weekly', quota } }, monday);
}

test('all 896 quota/week patterns settle once per day and preserve the exact quota', () => {
    assert.equal(habitWeekday(monday), 0);
    for (let quota = 1; quota <= 7; quota++) for (let mask = 0; mask < 128; mask++) {
        const habit = definition(quota);
        let period = newHabitPeriod(habit, monday), successes = 0, misses = 0;
        for (let offset = 0; offset < 7; offset++) {
            const value = mask & (1 << offset) ? 2000 : 1500;
            const outcome = assessHabitDay(habit, monday + offset, value, period);
            assert.ok(outcome.misses === 0 || outcome.misses === 1);
            assert.ok(outcome.period.misses >= period.misses);
            if (outcome.status === 'neutral') assert.equal(outcome.successes + outcome.misses, 0);
            successes += outcome.successes; misses += outcome.misses; period = outcome.period;
            assert.equal(misses, period.misses);
        }
        assert.equal(successes + misses, quota, `quota=${quota}, mask=${mask}`);
        assert.equal(period.completedDays.length, successes);
        assert.throws(() => assessHabitDay(habit, monday + 6, 2000, period), /OUT_OF_ORDER/);
    }
});

test('flexible weekly quota follows the day1/day6/day7 example without inventing completed neutral days', () => {
    const habit = definition(3);
    let period = newHabitPeriod(habit, monday);
    for (let offset = 0; offset <= 5; offset++) {
        const outcome = assessHabitDay(habit, monday + offset, offset === 0 ? 2000 : 0, period);
        assert.equal(outcome.status, offset === 0 ? 'achieved' : offset === 5 ? 'missed' : 'neutral');
        period = outcome.period;
    }
    const seventh = assessHabitDay(habit, monday + 6, 2000, period);
    assert.equal(seventh.status, 'achieved'); assert.equal(seventh.successes, 1);
    assert.equal(seventh.misses, 0); assert.equal(seventh.period.misses, 1);
});

test('current-day quantity corrections are precise and previews do not award partial targets', () => {
    const habit = definition(3), initial = newHabitPeriod(habit, monday);
    assert.equal(assessHabitDay(habit, monday, validateRecordedValue(habit, 15), initial).successes, 0);
    assert.equal(assessHabitDay(habit, monday, validateRecordedValue(habit, 20), initial).successes, 1);
    assert.equal(assessHabitDay(habit, monday, validateRecordedValue(habit, 15), initial).successes, 0);
    assert.equal(scaledHabitValue(0.29), 29);
    for (const bad of [-1, NaN, Infinity, 0.001, 1_000_001, '20']) assert.throws(() => scaledHabitValue(bad), /INVALID_HABIT/);
    const check = parseHabitDefinition({ name: 'Thiền', metric: 'check', target: 1, cadence: { kind: 'daily' } }, monday);
    assert.throws(() => validateRecordedValue(check, 0.5), /INVALID_HABIT_VALUE/);
});

test('weekday commitments, future activation and archiving never forge success or erase earlier misses', () => {
    const habit = parseHabitDefinition({ name: 'Tập', metric: 'check', target: 1, cadence: { kind: 'weekdays', weekdays: [0, 2, 4] } }, monday);
    assert.equal(assessHabitDay(habit, monday, 0, newHabitPeriod(habit, monday)).misses, 1);
    assert.equal(assessHabitDay(habit, monday + 1, 0, newHabitPeriod(habit, monday + 1)).reason, 'not_scheduled');
    assert.equal(assessHabitDay(habit, monday, 100, newHabitPeriod(habit, monday), monday).reason, 'archived');
    const future = { ...habit, commitmentFrom: monday + 1 };
    assert.equal(assessHabitDay(future, monday, 100, newHabitPeriod(future, monday)).reason, 'not_started');
    assert.equal(firstCommitmentDay(monday + 2, { kind: 'weekly', quota: 3 }), monday + 7);
    assert.equal(habitChangeDay(monday + 6, habit.cadence, { kind: 'weekly', quota: 2 }), monday + 7);
    assert.equal(habitChangeDay(monday, habit.cadence, { kind: 'daily' }), monday + 1);
    assert.equal(habitWeekStart(monday + 6), monday);
});

test('invalid definitions and unbounded speed are rejected without judging the habit content', () => {
    const base = { name: 'A', metric: 'quantity', target: 1, unit: 'ly', cadence: { kind: 'daily' } };
    for (const patch of [{ name: '' }, { target: 0 }, { metric: 'sensor' }, { owner: '456' },
        { cadence: { kind: 'weekly', quota: 8 } }, { cadence: { kind: 'weekdays', weekdays: [0, 0] } }])
        assert.throws(() => parseHabitDefinition({ ...base, ...patch }, monday), /INVALID_HABIT/);
    assert.equal(habitSpeedMultiplier(1), 1);
    assert.equal(habitSpeedMultiplier(6), habitSpeedMultiplier(60));
    assert.throws(() => cumulativeWeeklyMisses(3, 0, -1), /INVALID_HABIT_PERIOD/);
});
