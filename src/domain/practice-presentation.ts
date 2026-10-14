import type { PracticeVersion } from './practice.ts';
import { newTimePracticeVersion, purityGrade, timePeriodMaximum, timePracticeSummary, TIME_PRACTICE_RULE,
    type PracticeForecastContext } from './practice-progression.ts';
import { perfectTierProfile, profileForPractice, techniqueProfile, type EffectDescriptor, type TechniqueProfile } from './technique-profile.ts';
import { techniqueById } from './techniques.ts';

export function practicePresentation(version: PracticeVersion, attack = 100, context: PracticeForecastContext = {}) {
    const profile = profileForPractice(version, attack);
    if (version.rule !== TIME_PRACTICE_RULE) return { profile, training: null };
    const { current, ...summary } = timePracticeSummary(version, context);
    return { profile, training: { ...summary,
        forecastBasis: 'current-cadence-continuous-training' as const,
        current: current ? { tier: current.tier, days: current.days, requiredDays: current.requiredDays,
            remainingDays: current.requiredDays - current.days, memberCount: current.members.length } : null,
        periods: version.time!.periods.map(period => ({ tier: period.tier, days: period.days, requiredDays: period.requiredDays,
            openedDay: period.openedDay, ratioBp: period.ratioBp, qualityBp: period.qualityBp,
            ratioSettledDay: period.ratioSettledDay ?? null, qualitySettledDay: period.qualitySettledDay ?? null,
            hasObligation: period.hasObligation, memberCount: period.members.length })),
    } };
}
export type PracticePresentation = ReturnType<typeof practicePresentation>;
export type UpgradeRow = { id: string; group: 'Đòn đánh' | EffectDescriptor['group']; label: string;
    current: number | null; next: number | null; unit: string; kind: 'habit' | 'tier' | 'unlock';
    timing: string; condition: string | null; limit: string | null;
    previous?: EffectDescriptor | null; changes?: Array<'amount' | 'unit' | 'timing' | 'condition' | 'limit'> };

function effectUpgradeRows(current: TechniqueProfile | null, next: TechniqueProfile): UpgradeRow[] {
    const prior = new Map(current?.effects.map(effect => [effect.id, effect]) ?? []);
    const fields = ['amount', 'unit', 'timing', 'condition', 'limit'] as const;
    return next.effects.flatMap(effect => {
        const before = prior.get(effect.id) ?? null;
        const changes = fields.filter(field => !before || before[field] !== effect[field]);
        if (!changes.length) return [];
        return [{ id: effect.id, group: effect.group, label: effect.label, current: before?.amount ?? null,
            next: effect.amount, unit: effect.unit, kind: before ? effect.growth ?? 'tier' : 'unlock',
            timing: effect.timing, condition: effect.condition, limit: effect.limit, previous: before, changes }];
    });
}

// Forecasts preserve every settled award/defect. Reference profiles describe
// perfect fresh training and remain explicitly separate from owned editions.
function attainableProfile(version: PracticeVersion, tier: number, attack: number, context: PracticeForecastContext): TechniqueProfile {
    let factor = 400, quality = 0, ceiling = 10000;
    for (let index = 0; index < tier; index++) {
        const period = version.time!.periods[index]!, result = timePeriodMaximum(version, index, context);
        factor += Math.floor((index === 0 ? 600 : 180) * result.bp / 10000);
        if (result.hasObligation) ceiling = Math.min(ceiling, result.bp);
        quality += period.qualityBp ?? (result.hasObligation ? ceiling : 0);
    }
    const totalPurityBp = Math.floor(quality / 4);
    return techniqueProfile(version.techniqueId, tier, 0, attack, 0, { rule: TIME_PRACTICE_RULE,
        damageFactorMilli: factor, effectFactorMilli: 1000 + (tier - 1) * 180,
        totalPurityBp, gradeBonusMilli: purityGrade(totalPurityBp)?.bonusMilli ?? 0 });
}

export function practiceUpgrade(version: PracticeVersion | null, techniqueId: string, attack = 100, context: PracticeForecastContext = {}) {
    const technique = techniqueById(techniqueId);
    if (version && version.techniqueId !== techniqueId) throw Error('INVALID_TECHNIQUE');
    const reference = newTimePracticeVersion('reference', techniqueId, 1, technique.trainingFactor);
    const current = version ? profileForPractice(version, attack) : null;
    const legacy = !!version && version.rule !== TIME_PRACTICE_RULE;
    const tier = version?.tiers.length ?? 0, target = tier < 4 ? tier + 1 : null;
    const projected = version ?? reference;
    const nextMaximum = target && !legacy ? attainableProfile(projected, target, attack, context) : null;
    const editionMaximum = legacy ? null : attainableProfile(projected, 4, attack, context);
    const rows: UpgradeRow[] = [];
    if (nextMaximum) {
        rows.push({ id: 'main-damage', group: 'Đòn đánh', label: 'Sát thương', current: current?.damage ?? null,
            next: nextMaximum.damage, unit: 'điểm', kind: 'habit', timing: 'Sau kết toán cam kết của kỳ',
            condition: 'Theo habit hoàn thành; mức tối đa giả định đạt mọi cam kết còn khả thi', limit: null });
        rows.push(...effectUpgradeRows(current, nextMaximum));
    }
    let totalDays = 0;
    return { techniqueId, context: { attack, bonusMilli: 0, kind: 'comparison' as const }, current, nextTier: target,
        nextMaximum, editionMaximum, maximumProvisional: !!target || !!version?.pendingWeeks.length,
        awaitingSettlement: !!version && !legacy && timePracticeSummary(version, context).awaitingAudit,
        legacy, rows, remainingDays: target && !legacy ? projected.time!.periods[target - 1]!.requiredDays - projected.time!.periods[target - 1]!.days : null,
        referenceRoadmap: reference.time!.periods.map(period => {
            totalDays += period.requiredDays;
            const profile = perfectTierProfile(techniqueId, period.tier, attack);
            return { tier: period.tier, requiredDays: period.requiredDays, totalDays,
                profile, changes: effectUpgradeRows(period.tier === 1 ? null : perfectTierProfile(techniqueId, period.tier - 1, attack), profile), reference: true as const };
        }),
        explanation: legacy ? 'Bản luyện theo cơ chế trước. Lộ trình tham chiếu áp dụng khi luyện lại từ tầng 1.' :
            'Mức tối đa tạm tính theo lịch habit hiện tại và luyện liên tục. Cam kết tuần, thay lịch hoặc đổi chế độ có thể thay đổi dự kiến; chỉ kết quả đã chốt được dùng trong trận.',
    };
}
