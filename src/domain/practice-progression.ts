import { habitWeekStart, habitWeekday, parseHabitCadence, requireDay, type HabitCadence } from './habits.ts';
import type { PracticeSource, PracticeVersion, PracticeWeek } from './practice.ts';

export const TIME_PRACTICE_RULE = 'practice-v2';
// Only new editions use this schedule. Each edition persists its own periods,
// so deployed schedules and battle snapshots retain their original timing.
export const TIME_PRACTICE_DAYS = [3, 4, 6, 8] as const;
export type PracticeMember = { habitId: string; successesMilli: number; missesMilli: number; cadence: HabitCadence };
export type TimePracticePeriod = {
    tier: number; requiredDays: number; days: number; bound: boolean; startedDay: number | null; openedDay: number | null;
    ratioBp: number | null; qualityBp: number | null; hasObligation: boolean; members: PracticeMember[];
    ratioSettledDay?: number | null; qualitySettledDay?: number | null;
};
export type TimePractice = { periods: TimePracticePeriod[]; lastTrainingDay: number | null };

// The time clock and the two results are deliberately separate:
// ratio earns this period's damage; inherited quality earns total purity.
export function newTimePracticeVersion(id: string, techniqueId: string, createdDay: number, factor = 1000, edition = 1): PracticeVersion {
    requireDay(createdDay);
    if (!id || !techniqueId || ![1000, 1500, 2000].includes(factor) || !Number.isSafeInteger(edition) || edition < 1)
        throw Error('INVALID_PRACTICE_VERSION');
    const days = TIME_PRACTICE_DAYS.map(value => Math.ceil(value * factor / 1000));
    return { id, techniqueId, edition, rule: TIME_PRACTICE_RULE, createdDay, costsMilli: days.map(value => value * 1000),
        tiers: [], progressMilli: 0, effortMilli: 0, defectsMilli: 0, draftStartedDay: null, pendingWeeks: [],
        time: { lastTrainingDay: null, periods: days.map((requiredDays, index) => ({
            tier: index + 1, requiredDays, days: 0, bound: false, startedDay: null, openedDay: null,
            ratioBp: null, qualityBp: null, hasObligation: false, members: [], ratioSettledDay: null, qualitySettledDay: null,
        })) } };
}

export function validateTimePractice(version: PracticeVersion): void {
    if (version.rule !== TIME_PRACTICE_RULE || !version.time || version.time.periods.length !== 4)
        throw Error('INVALID_TIME_PRACTICE');
    if (version.time.lastTrainingDay !== null) requireDay(version.time.lastTrainingDay);
    for (const [index, period] of version.time.periods.entries()) {
        if (period.tier !== index + 1 || !Number.isSafeInteger(period.requiredDays) || period.requiredDays < 1 || period.requiredDays > 60 ||
            !Number.isSafeInteger(period.days) || period.days < 0 || period.days > period.requiredDays ||
            typeof period.bound !== 'boolean' || typeof period.hasObligation !== 'boolean' || period.members.length > 30 ||
            new Set(period.members.map(member => member.habitId)).size !== period.members.length ||
            [period.ratioBp, period.qualityBp].some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 10000)) ||
            period.openedDay !== null && period.days !== period.requiredDays ||
            period.ratioBp !== null && period.openedDay === null ||
            period.qualityBp !== null && period.ratioBp === null)
            throw Error('INVALID_TIME_PRACTICE');
        for (const day of [period.startedDay, period.openedDay]) if (day !== null) requireDay(day);
        for (const day of [period.ratioSettledDay, period.qualitySettledDay]) if (day != null) {
            requireDay(day);
            if (period.openedDay === null || day < period.openedDay) throw Error('INVALID_TIME_PRACTICE');
        }
        for (const member of period.members) if (!member.habitId ||
            ![member.successesMilli, member.missesMilli].every(value => Number.isSafeInteger(value) && value >= 0))
            throw Error('INVALID_TIME_PRACTICE');
        for (const member of period.members) parseHabitCadence(member.cadence);
        if (index < version.tiers.length && period.openedDay === null || index >= version.tiers.length && period.openedDay !== null)
            throw Error('INVALID_TIME_PRACTICE');
    }
}

export function advanceTimePracticeDay(version: PracticeVersion, day: number, sources: PracticeSource[], weeks: PracticeWeek[]): number {
    validateTimePractice(version);
    if (version.time!.lastTrainingDay !== null && day <= version.time!.lastTrainingDay!) throw Error('PRACTICE_DAY_REPLAY');
    const period = version.time!.periods[version.tiers.length];
    if (!period) return 0;
    if (!period.bound) {
        // Membership starts with this training period. New habits track immediately
        // but join the next tier; creating/deleting rows cannot rewrite this sample.
        period.members = sources.filter(source => source.eligible !== false).map(source => ({
            habitId: source.habitId, successesMilli: 0, missesMilli: 0,
            cadence: source.cadence ?? (source.weekly ? { kind: 'weekly', quota: source.weekly.quota } : { kind: 'daily' }),
        }));
        if (period.members.length > 30) throw Error('INVALID_TIME_PRACTICE');
        period.bound = true; period.startedDay = day;
    }
    version.time!.lastTrainingDay = day;
    period.days++;
    version.progressMilli = period.days * 1000;
    version.draftStartedDay = period.startedDay;
    for (const source of sources) {
        const member = period.members.find(member => member.habitId === source.habitId);
        if (!member) continue;
        if (source.cadence) member.cadence = parseHabitCadence(source.cadence);
        member.successesMilli += source.successes * 1000;
        version.effortMilli += source.successes * 1000;
        if (!source.weekly) {
            member.missesMilli += source.misses * 1000; version.defectsMilli += source.misses * 1000;
        } else {
            const week = weeks.find(week => week.key === source.habitId + ':' + source.weekly!.startDay);
            if (week && week.closedDay === null) {
                let claim = week.claims.find(claim => claim.versionId === version.id && claim.tier === period.tier);
                if (!claim) { claim = { versionId: version.id, tier: period.tier, effortMilli: 0 }; week.claims.push(claim); }
                // Time bindings include neutral/no-success days; v1 retains its
                // original effort weights. Both remain single audited receivers.
                claim.effortMilli += 1000;
                if (!version.pendingWeeks.includes(week.key)) version.pendingWeeks.push(week.key);
            }
        }
    }
    if (period.days === period.requiredDays) {
        period.openedDay = day;
        version.tiers.push({ tier: period.tier, purityBp: 0, effortMilli: 0, defectsMilli: 0,
            startedDay: period.startedDay!, lockedDay: day });
        version.progressMilli = 0; version.draftStartedDay = null;
    }
    return 1000;
}

export function applyTimeWeeklyMiss(version: PracticeVersion, tier: number, habitId: string, missesMilli: number): void {
    const period = version.time?.periods[tier - 1], member = period?.members.find(member => member.habitId === habitId);
    if (!period || !member || period.ratioBp !== null) throw Error('PRACTICE_AUDIT_LOCKED');
    member.missesMilli += missesMilli; version.defectsMilli += missesMilli;
}

function ratio(members: PracticeMember[]): { bp: number; hasObligation: boolean } {
    const obligated = members.filter(member => member.successesMilli + member.missesMilli > 0);
    if (!obligated.length) return { bp: 0, hasObligation: false };
    return { bp: Math.floor(obligated.reduce((sum, member) =>
        sum + 10000 * member.successesMilli / (member.successesMilli + member.missesMilli), 0) / obligated.length),
        hasObligation: true };
}

export function finalizeTimePractice(version: PracticeVersion, weeks: PracticeWeek[], day: number): void {
    requireDay(day);
    validateTimePractice(version);
    for (const period of version.time!.periods) {
        if (period.openedDay === null || period.ratioBp !== null) continue;
        if (weeks.some(week => week.closedDay === null && week.claims.some(claim =>
            claim.versionId === version.id && claim.tier === period.tier))) continue;
        const result = ratio(period.members);
        period.ratioBp = result.bp; period.hasObligation = result.hasObligation;
        period.ratioSettledDay = day;
        const tier = version.tiers[period.tier - 1]!;
        tier.effortMilli = period.members.reduce((sum, member) => sum + member.successesMilli, 0);
        tier.defectsMilli = period.members.reduce((sum, member) => sum + member.missesMilli, 0);
    }
    let ceiling = 10000;
    for (const period of version.time!.periods) {
        if (period.ratioBp === null) break; // damage results above do not wait for this chain
        if (period.hasObligation) ceiling = Math.min(ceiling, period.ratioBp);
        if (period.qualityBp === null) period.qualitySettledDay = day;
        period.qualityBp = period.hasObligation ? ceiling : 0;
        version.tiers[period.tier - 1]!.purityBp = period.qualityBp;
    }
}

export type PracticeForecastContext = { afterDay?: number; weeks?: readonly PracticeWeek[] };
// A forecast is an upper bound under the currently recorded cadence and
// continuous training. It is not an awarded result, and open weekly allocations
// may lower it. Future cadence changes are never claimed as settled losses.
export function timePeriodMaximum(version: PracticeVersion, index: number, context: PracticeForecastContext = {}) {
    const period = version.time!.periods[index]!;
    if (period.ratioBp !== null) return { bp: period.ratioBp, hasObligation: period.hasObligation };
    if (!period.bound) return { bp: 10000, hasObligation: true };
    const afterDay = context.afterDay ?? (version.time!.lastTrainingDay ?? version.createdDay) + 1;
    const remaining = period.requiredDays - period.days;
    const projected = period.members.map(member => {
        let successes = 0, pendingMisses = 0;
        const perWeek = new Map<number, number>();
        for (let offset = 0; offset < remaining; offset++) {
            const day = afterDay + offset, cadence = member.cadence;
            if (cadence.kind === 'weekdays' && !cadence.weekdays.includes(habitWeekday(day))) continue;
            if (cadence.kind === 'weekly') {
                const start = habitWeekStart(day), audit = context.weeks?.find(week => week.habitId === member.habitId && week.startDay === start);
                const available = Math.max(0, cadence.quota - (audit?.successes ?? 0) - (audit?.misses ?? 0));
                if ((perWeek.get(start) ?? 0) >= available) continue;
                perWeek.set(start, (perWeek.get(start) ?? 0) + 1);
            }
            successes++;
        }
        for (const week of context.weeks ?? []) {
            if (week.closedDay !== null || week.habitId !== member.habitId || !week.misses) continue;
            const claim = week.claims.find(value => value.versionId === version.id && value.tier === period.tier);
            if (!claim) continue;
            // Even if every remaining day creates the largest legacy claim,
            // this much of the already inevitable weekly miss belongs here.
            const maximumWeight = week.claims.reduce((sum, value) => sum + value.effortMilli, 0) + Math.max(0, week.endDay - afterDay) * 1600;
            pendingMisses += Math.floor(week.misses * 1000 * claim.effortMilli / maximumWeight);
        }
        return { ...member, successesMilli: member.successesMilli + successes * 1000, missesMilli: member.missesMilli + pendingMisses };
    });
    return ratio(projected);
}

export function purityGrade(totalPurityBp: number): { name: string; bonusMilli: number } | null {
    if (!Number.isInteger(totalPurityBp) || totalPurityBp < 0 || totalPurityBp > 10000) throw Error('INVALID_PRACTICE_PURITY');
    return totalPurityBp === 10000 ? { name: 'Thông Thần', bonusMilli: 150 } :
        totalPurityBp >= 9000 ? { name: 'Chí Thuần', bonusMilli: 100 } :
            totalPurityBp >= 8000 ? { name: 'Tinh Thuần', bonusMilli: 50 } : null;
}

export function timePracticeSummary(version: PracticeVersion, context: PracticeForecastContext = {}) {
    validateTimePractice(version);
    const periods = version.time!.periods;
    let purityBp = 0, maximumSum = 0, ceiling = 10000, pending = false;
    for (const [index, period] of periods.entries()) {
        if (period.qualityBp !== null) {
            purityBp += period.qualityBp;
            maximumSum += period.qualityBp;
            if (period.hasObligation) ceiling = period.qualityBp;
            continue;
        }
        pending = true;
        const result = timePeriodMaximum(version, index, context);
        if (result.hasObligation) ceiling = Math.min(ceiling, result.bp);
        maximumSum += result.hasObligation ? ceiling : 0;
    }
    let knownMaximumSum = 0, knownCeiling = 10000;
    for (const period of periods) {
        if (period.qualityBp !== null) {
            knownMaximumSum += period.qualityBp;
            if (period.hasObligation) knownCeiling = period.qualityBp;
        } else if (period.ratioBp !== null) {
            if (period.hasObligation) knownCeiling = Math.min(knownCeiling, period.ratioBp);
            knownMaximumSum += period.hasObligation ? knownCeiling : 0;
        } else knownMaximumSum += knownCeiling;
    }
    const totalPurityBp = Math.floor(purityBp / 4), maximumPurityBp = Math.floor(maximumSum / 4);
    const permanentLossBp = 10000 - Math.floor(knownMaximumSum / 4);
    const damageFactorMilli = 400 + periods.reduce((sum, period, index) =>
        sum + Math.floor((index === 0 ? 600 : 180) * (period.ratioBp ?? 0) / 10000), 0);
    const grade = purityGrade(totalPurityBp);
    return { totalPurityBp, maximumPurityBp, permanentLossBp, provisional: pending, damageFactorMilli, grade,
        tier: version.tiers.length, current: periods[version.tiers.length] ?? null,
        awaitingAudit: periods.some(period => period.openedDay !== null && period.qualityBp === null) };
}
