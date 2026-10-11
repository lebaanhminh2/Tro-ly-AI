// Self-reported tracking is separate from committed game contributions.
// All values use hundredths internally; the caller supplies server time/day.
export type HabitMetric = 'check' | 'quantity' | 'duration';
export type HabitCadence =
    | { kind: 'daily' }
    | { kind: 'weekdays'; weekdays: number[] }
    | { kind: 'weekly'; quota: number };
export type HabitDefinition = {
    name: string;
    metric: HabitMetric;
    target: number;
    unit: string;
    cadence: HabitCadence;
    note: string;
    commitmentFrom: number;
};
export type HabitRevision = { fromDay: number; definition: HabitDefinition; archivedFrom?: number | null };
export type HabitRecord = {
    id: string; version: number; createdDay: number; archivedFrom: number | null;
    revisions: HabitRevision[];
};
export type HabitPeriod = {
    startDay: number; endDay: number; quota: number;
    completedDays: number[]; misses: number; closedThrough: number;
};
export type HabitDayOutcome = {
    status: 'achieved' | 'missed' | 'neutral';
    reason: 'target_met' | 'target_missed' | 'not_scheduled' | 'still_flexible' | 'quota_met' | 'not_started' | 'archived';
    attained: boolean; successes: number; misses: number;
    value: number; remainingDays: number; period: HabitPeriod;
};

const MAX_VALUE = 100_000_000;
export function scaledHabitValue(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE / 100)
        throw Error('INVALID_HABIT_VALUE');
    const scaled = Math.round(value * 100);
    if (Math.abs(value * 100 - scaled) > 0.000001) throw Error('INVALID_HABIT_PRECISION');
    return scaled;
}
export function habitWeekday(day: number): number {
    requireDay(day);
    return ((day + 3) % 7 + 7) % 7; // Monday=0; epoch Thursday=3.
}
export function habitWeekStart(day: number): number { return day - habitWeekday(day); }
export function requireDay(day: number): void {
    if (!Number.isSafeInteger(day) || day < 0 || day > 365_000) throw Error('INVALID_HABIT_DAY');
}
function shortText(value: unknown, maximum: number, required: boolean): string {
    if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))
        throw Error('INVALID_HABIT_TEXT');
    const text = value.trim();
    if (required && !text) throw Error('INVALID_HABIT_TEXT');
    return text;
}
export function parseHabitCadence(input: unknown): HabitCadence {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_HABIT_CADENCE');
    const value = input as Record<string, unknown>;
    if (value.kind === 'daily' && Object.keys(value).every(key => key === 'kind')) return { kind: 'daily' };
    if (value.kind === 'weekly' && Object.keys(value).every(key => ['kind', 'quota'].includes(key)) &&
        Number.isInteger(value.quota) && Number(value.quota) >= 1 && Number(value.quota) <= 7)
        return { kind: 'weekly', quota: Number(value.quota) };
    if (value.kind === 'weekdays' && Object.keys(value).every(key => ['kind', 'weekdays'].includes(key)) &&
        Array.isArray(value.weekdays) && value.weekdays.length >= 1 && value.weekdays.length <= 7 &&
        value.weekdays.every(day => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6) &&
        new Set(value.weekdays).size === value.weekdays.length)
        return { kind: 'weekdays', weekdays: [...value.weekdays].sort((a, b) => a - b) as number[] };
    throw Error('INVALID_HABIT_CADENCE');
}
export function parseHabitDefinition(input: unknown, commitmentFrom: number): HabitDefinition {
    requireDay(commitmentFrom);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_HABIT_DEFINITION');
    const value = input as Record<string, unknown>;
    if (Object.keys(value).some(key => !['name', 'metric', 'target', 'unit', 'cadence', 'note'].includes(key)))
        throw Error('INVALID_HABIT_DEFINITION');
    if (!['check', 'quantity', 'duration'].includes(String(value.metric))) throw Error('INVALID_HABIT_METRIC');
    const metric = value.metric as HabitMetric;
    const target = scaledHabitValue(value.target);
    if (target === 0 || metric === 'check' && target !== 100) throw Error('INVALID_HABIT_TARGET');
    return {
        name: shortText(value.name, 100, true), metric, target,
        unit: metric === 'check' ? 'lần' : metric === 'duration' ? 'phút' : shortText(value.unit, 20, true),
        cadence: parseHabitCadence(value.cadence), note: shortText(value.note ?? '', 300, false), commitmentFrom,
    };
}
export function validateRecordedValue(definition: HabitDefinition, value: unknown): number {
    const scaled = scaledHabitValue(value);
    if (definition.metric === 'check' && scaled !== 0 && scaled !== 100) throw Error('INVALID_HABIT_VALUE');
    return scaled;
}
export function firstCommitmentDay(day: number, cadence: HabitCadence): number {
    requireDay(day);
    return cadence.kind === 'weekly' ? habitWeekStart(day) + 7 : day + 1;
}
export function habitChangeDay(day: number, oldCadence: HabitCadence, nextCadence: HabitCadence): number {
    return oldCadence.kind === 'weekly' || nextCadence.kind === 'weekly' ? habitWeekStart(day) + 7 : day + 1;
}
export function definitionOnDay(habit: HabitRecord, day: number): HabitRevision | null {
    requireDay(day);
    return habit.revisions.filter(revision => revision.fromDay <= day)
        .sort((a, b) => b.fromDay - a.fromDay)[0] ?? null;
}
export function newHabitPeriod(definition: HabitDefinition, day: number): HabitPeriod {
    requireDay(day);
    const weekly = definition.cadence.kind === 'weekly';
    const startDay = weekly ? habitWeekStart(day) : day;
    return { startDay, endDay: weekly ? startDay + 7 : day + 1,
        quota: definition.cadence.kind === 'weekly' ? definition.cadence.quota : 1,
        completedDays: [], misses: 0, closedThrough: startDay - 1 };
}
export function isHabitScheduled(definition: HabitDefinition, day: number): boolean {
    return day >= definition.commitmentFrom &&
        (definition.cadence.kind !== 'weekdays' || definition.cadence.weekdays.includes(habitWeekday(day)));
}
export function cumulativeWeeklyMisses(quota: number, successes: number, remainingDays: number): number {
    if (![quota, successes, remainingDays].every(Number.isInteger) || quota < 1 || quota > 7 ||
        successes < 0 || remainingDays < 0 || remainingDays > 7) throw Error('INVALID_HABIT_PERIOD');
    return Math.max(0, quota - Math.min(successes, quota) - remainingDays);
}

export function assessHabitDay(definition: HabitDefinition, day: number, value: number,
    previous: HabitPeriod, archivedFrom: number | null = null): HabitDayOutcome {
    requireDay(day);
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_VALUE ||
        definition.metric === 'check' && value !== 0 && value !== 100) throw Error('INVALID_HABIT_VALUE');
    if (day < previous.startDay || day >= previous.endDay || day !== previous.closedThrough + 1)
        throw Error('HABIT_PERIOD_OUT_OF_ORDER');
    if (new Set(previous.completedDays).size !== previous.completedDays.length ||
        previous.completedDays.some(completed => completed < previous.startDay || completed > previous.closedThrough) ||
        previous.misses < 0 || previous.misses > previous.quota) throw Error('INVALID_HABIT_PERIOD');
    const period: HabitPeriod = { ...previous, completedDays: [...previous.completedDays], closedThrough: day };
    const remainingDays = previous.endDay - day - 1, attained = value >= definition.target;
    const result: HabitDayOutcome = { status: 'neutral', reason: 'not_started', attained, successes: 0, misses: 0, value, remainingDays, period };
    if (day < definition.commitmentFrom) return result;
    if (archivedFrom !== null && day >= archivedFrom) return { ...result, reason: 'archived' };
    if (!isHabitScheduled(definition, day)) return { ...result, reason: 'not_scheduled' };
    if (definition.cadence.kind === 'weekly') {
        if (period.completedDays.length >= period.quota) return { ...result, reason: 'quota_met' };
        if (attained) {
            period.completedDays.push(day);
            result.status = 'achieved'; result.reason = 'target_met'; result.successes = 1;
        } else result.reason = 'still_flexible';
        const cumulative = cumulativeWeeklyMisses(period.quota, period.completedDays.length, remainingDays);
        const newMisses = cumulative - previous.misses;
        if (newMisses < 0 || newMisses > 1) throw Error('INVALID_HABIT_PERIOD');
        period.misses = cumulative;
        result.misses = newMisses;
        if (newMisses > 0) { result.status = 'missed'; result.reason = 'target_missed'; }
        return result;
    }
    if (attained) {
        period.completedDays.push(day);
        return { ...result, status: 'achieved', reason: 'target_met', successes: 1 };
    }
    period.misses = 1;
    return { ...result, status: 'missed', reason: 'target_missed', misses: 1 };
}

export function habitPreview(habit: HabitRecord, day: number, value: number, period: HabitPeriod | null): HabitDayOutcome | null {
    const revision = definitionOnDay(habit, day);
    if (!revision) return null;
    const initial = period ?? newHabitPeriod(revision.definition, day);
    // A new weekly habit can be tracked before next Monday without creating
    // obligations for days before its activation.
    if (!period && day < revision.definition.commitmentFrom) initial.closedThrough = day - 1;
    const archivedFrom = revision.archivedFrom === undefined ? habit.archivedFrom : revision.archivedFrom;
    return assessHabitDay(revision.definition, day, value, initial, archivedFrom);
}

export function habitSpeedMultiplier(matureHabits: number): number {
    if (!Number.isInteger(matureHabits) || matureHabits < 0) throw Error('INVALID_HABIT_COUNT');
    return 1 + Math.min(Math.max(matureHabits - 1, 0), 5) * 0.12;
}
