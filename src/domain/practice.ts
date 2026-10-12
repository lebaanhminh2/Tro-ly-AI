import { requireDay } from './habits.ts';

export const PRACTICE_RULE = 'practice-v1';
export const PRACTICE_TIERS = ['Nhập môn', 'Tiểu thành', 'Đại thành', 'Viên mãn'];
export type PracticeTier = { tier: number; purityBp: number; effortMilli: number; defectsMilli: number;
    startedDay: number; lockedDay: number };
export type PracticeVersion = {
    id: string; techniqueId: string; edition: number; rule: string; createdDay: number; costsMilli: number[];
    tiers: PracticeTier[]; progressMilli: number; effortMilli: number; defectsMilli: number;
    draftStartedDay: number | null; pendingWeeks: string[];
};
export type PracticeClaim = { versionId: string; tier: number; effortMilli: number };
export type PracticeWeek = {
    key: string; habitId: string; startDay: number; endDay: number; quota: number;
    successes: number; misses: number; closedDay: number | null;
    claims: PracticeClaim[]; fallback: { versionId: string; tier: number } | null;
    allocations: { versionId: string; tier: number; defectsMilli: number }[];
};
export type PracticeSource = { habitId: string; successes: number; misses: number; mature: boolean;
    weekly: null | { startDay: number; endDay: number; quota: number; successesBefore: number; missesBefore: number } };
export type PracticeDayResult = { versions: PracticeVersion[]; weeks: PracticeWeek[];
    progressMilli: number; directMisses: number; weeklyMisses: number; closedWeeks: string[]; locked: { versionId: string; tier: number; purityBp: number }[] };

export function newPracticeVersion(id: string, techniqueId: string, createdDay: number, factor = 1000, edition = 1): PracticeVersion {
    requireDay(createdDay);
    if (!id || !techniqueId || ![1000, 1500, 2000].includes(factor) || !Number.isSafeInteger(edition) || edition < 1) throw Error('INVALID_PRACTICE_VERSION');
    return { id, techniqueId, edition, rule: PRACTICE_RULE, createdDay, costsMilli: [3, 6, 10, 15].map(cost => cost * factor),
        tiers: [], progressMilli: 0, effortMilli: 0, defectsMilli: 0, draftStartedDay: null, pendingWeeks: [] };
}
export function practicePurity(effortMilli: number, defectsMilli: number, tier: number, ceiling = 10000): number {
    if (![effortMilli, defectsMilli, tier, ceiling].every(Number.isSafeInteger) || effortMilli < 0 || defectsMilli < 0 ||
        tier < 1 || tier > 4 || ceiling < 100 || ceiling > 10000) throw Error('INVALID_PRACTICE_PURITY');
    if (!effortMilli) return 100;
    if (!defectsMilli) return ceiling;
    return Math.min(ceiling, Math.max(100, Math.floor(10000 * (effortMilli / (effortMilli + 2 * defectsMilli)) ** (1 + .35 * (tier - 1)))));
}
function copyVersion(value: PracticeVersion): PracticeVersion {
    if (value.rule !== PRACTICE_RULE) throw Error('PRACTICE_RULE_UNSUPPORTED');
    if (value.tiers.length > 4 || value.costsMilli.length !== 4 ||
        ![value.progressMilli, value.effortMilli, value.defectsMilli, ...value.costsMilli].every(Number.isSafeInteger) ||
        value.progressMilli < 0 || value.effortMilli < 0 || value.defectsMilli < 0 || value.costsMilli.some(cost => cost <= 0))
        throw Error('INVALID_PRACTICE_VERSION');
    return { ...value, tiers: value.tiers.map(tier => ({ ...tier })), pendingWeeks: [...value.pendingWeeks], costsMilli: [...value.costsMilli] };
}
function allocate(total: number, claims: PracticeClaim[]): { versionId: string; tier: number; defectsMilli: number }[] {
    const sum = claims.reduce((count, claim) => count + claim.effortMilli, 0);
    if (!sum || !total) return [];
    const parts = claims.map(claim => ({ versionId: claim.versionId, tier: claim.tier,
        defectsMilli: Math.floor(total * claim.effortMilli / sum), remainder: total * claim.effortMilli % sum }));
    const missing = total - parts.reduce((count, part) => count + part.defectsMilli, 0);
    parts.sort((a, b) => b.remainder - a.remainder || (a.versionId < b.versionId ? -1 : a.versionId > b.versionId ? 1 : a.tier - b.tier));
    for (let index = 0; index < missing; index++) parts[index]!.defectsMilli++;
    return parts.map(({ remainder: _remainder, ...part }) => part);
}

// Receives only immutable, fully settled habit outcomes for this server day.
// Persistence owns ordering, receipts and selecting a single mode/receiver.
export function settlePracticeDay(day: number, activeId: string | null, existingVersions: PracticeVersion[],
    existingWeeks: PracticeWeek[], sources: PracticeSource[]): PracticeDayResult {
    requireDay(day);
    if (new Set(sources.map(source => source.habitId)).size !== sources.length) throw Error('INVALID_PRACTICE_SOURCE');
    for (const source of sources) {
        if (![0, 1].includes(source.successes) || ![0, 1].includes(source.misses) || source.successes && source.misses)
            throw Error('INVALID_PRACTICE_SOURCE');
        if (source.weekly && (!Number.isInteger(source.weekly.quota) || source.weekly.quota < 1 || source.weekly.quota > 7 ||
            source.weekly.endDay !== source.weekly.startDay + 7 || day < source.weekly.startDay || day >= source.weekly.endDay))
            throw Error('INVALID_PRACTICE_SOURCE');
    }
    const versions = existingVersions.map(copyVersion);
    const weeks = existingWeeks.map(week => ({ ...week, claims: week.claims.map(claim => ({ ...claim })),
        allocations: week.allocations.map(allocation => ({ ...allocation })), fallback: week.fallback ? { ...week.fallback } : null }));
    for (const source of sources) if (source.weekly) {
        const period = source.weekly, key = source.habitId + ':' + period.startDay;
        let week = weeks.find(item => item.key === key);
        if (!week) {
            week = { key, habitId: source.habitId, startDay: period.startDay, endDay: period.endDay, quota: period.quota,
                successes: period.successesBefore, misses: period.missesBefore, closedDay: null, claims: [], fallback: null, allocations: [] };
            weeks.push(week);
        }
        if (week.closedDay !== null) continue;
        week.successes += source.successes; week.misses += source.misses;
        if (week.successes + week.misses > week.quota) throw Error('INVALID_PRACTICE_WEEK');
    }
    const active = activeId ? versions.find(version => version.id === activeId) : null;
    if (activeId && !active) throw Error('PRACTICE_NOT_FOUND');
    const directMisses = sources.filter(source => !source.weekly).reduce((total, source) => total + source.misses, 0);
    const receivesPractice = !!active && active.tiers.length < 4;
    let progressMilli = 0;
    if (active && active.tiers.length < 4) {
        const tier = active.tiers.length + 1, successful = sources.filter(source => source.successes);
        const speed = successful.length ? 1000 + Math.min(Math.max(successful.filter(source => source.mature).length - 1, 0), 5) * 120 : 0;
        progressMilli = Math.min(speed, active.costsMilli[tier - 1]! - active.progressMilli);
        if (progressMilli < 0) throw Error('INVALID_PRACTICE_VERSION');
        active.progressMilli += progressMilli; active.effortMilli += progressMilli;
        active.defectsMilli += directMisses * 1000;
        if (active.draftStartedDay === null && (progressMilli || directMisses)) active.draftStartedDay = day;
        for (const week of weeks.filter(week => week.closedDay === null && week.startDay <= day && day < week.endDay)) {
            week.fallback = { versionId: active.id, tier };
            if (progressMilli) {
                let claim = week.claims.find(claim => claim.versionId === active.id && claim.tier === tier);
                if (!claim) { claim = { versionId: active.id, tier, effortMilli: 0 }; week.claims.push(claim); }
                claim.effortMilli += progressMilli;
                if (!active.pendingWeeks.includes(week.key)) active.pendingWeeks.push(week.key);
            }
        }
    }
    const closedWeeks: string[] = [];
    let weeklyMisses = 0;
    for (const week of weeks) {
        if (week.closedDay !== null || day < week.endDay - 1 && week.successes < week.quota) continue;
        week.closedDay = day; closedWeeks.push(week.key); weeklyMisses += week.misses;
        week.allocations = allocate(week.misses * 1000, week.claims);
        if (week.misses && !week.claims.length && week.fallback)
            week.allocations.push({ ...week.fallback, defectsMilli: week.misses * 1000 });
        for (const allocation of week.allocations) {
            const version = versions.find(version => version.id === allocation.versionId);
            if (!version) throw Error('PRACTICE_NOT_FOUND');
            if (version.tiers.length + 1 !== allocation.tier) throw Error('PRACTICE_AUDIT_LOCKED');
            version.defectsMilli += allocation.defectsMilli;
            if (version.draftStartedDay === null) version.draftStartedDay = day;
        }
        for (const version of versions) version.pendingWeeks = version.pendingWeeks.filter(key => key !== week.key);
    }
    const locked: PracticeDayResult['locked'] = [];
    for (const version of versions) {
        if (version.tiers.length >= 4 || version.pendingWeeks.length || version.progressMilli < version.costsMilli[version.tiers.length]!) continue;
        const tier = version.tiers.length + 1;
        const purityBp = practicePurity(version.effortMilli, version.defectsMilli, tier, version.tiers.at(-1)?.purityBp ?? 10000);
        version.tiers.push({ tier, purityBp, effortMilli: version.effortMilli, defectsMilli: version.defectsMilli,
            startedDay: version.draftStartedDay ?? day, lockedDay: day });
        version.progressMilli = 0; version.draftStartedDay = null;
        locked.push({ versionId: version.id, tier, purityBp });
    }
    return { versions, weeks, progressMilli, directMisses: receivesPractice ? directMisses : 0,
        weeklyMisses, closedWeeks, locked };
}
