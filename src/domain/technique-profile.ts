import { battleTechnique, type BattleEffect, type BattleTechnique } from './battle-techniques.ts';
import type { PracticeVersion } from './practice.ts';
import { TIME_PRACTICE_RULE, purityGrade, timePracticeSummary } from './practice-progression.ts';
import { techniqueById } from './techniques.ts';

export type TechniqueStrength = { rule: 'practice-v2'; damageFactorMilli: number; effectFactorMilli: number;
    gradeBonusMilli: number; totalPurityBp: number };
export type EffectDescriptor = { id: string; group: 'Đặc tính' | 'Hiệu ứng' | 'Điều kiện' | 'Cái giá' | 'Nội tại';
    label: string; amount: number | null; unit: string; timing: string; condition: string | null; limit: string | null;
    growth?: 'habit' | 'tier' };
export type TechniqueProfile = { id: string; tier: number; rule: string; attack: number; bonusMilli: number;
    damage: number; hits: number; perHit: number; damagePower: number; effectPower: number;
    totalPurityBp: number | null; effects: EffectDescriptor[]; cost: BattleTechnique['cost']; warning: string | null };
const scale = (amount: number, factor: number) => Math.floor(amount * factor / 1000);

export function practiceStrength(version: PracticeVersion): TechniqueStrength | undefined {
    if (version.rule !== TIME_PRACTICE_RULE) return undefined;
    const summary = timePracticeSummary(version);
    return { rule: TIME_PRACTICE_RULE, damageFactorMilli: summary.damageFactorMilli,
        effectFactorMilli: 1000 + Math.max(0, version.tiers.length - 1) * 180,
        gradeBonusMilli: summary.grade?.bonusMilli ?? 0, totalPurityBp: summary.totalPurityBp };
}

// Tiers increase advertised rates in full. Earned damage is a separate
// coefficient; it never shrinks penetration, duration or a passive unlock.
export function tierBattleTechnique(id: string, tier: number, upgraded = true): BattleTechnique {
    if (!Number.isInteger(tier) || tier < 1 || tier > 4) throw Error('INVALID_TECHNIQUE_TIER');
    const spec = structuredClone(battleTechnique(id));
    if (!upgraded) return spec;
    const rate = [700, 800, 900, 1000][tier - 1]!;
    for (const effect of spec.effects) {
        if (effect.kind === 'strike') effect.pierce = scale(effect.pierce, rate);
        if (effect.kind === 'lifesteal') {
            effect.percent = scale(effect.percent, rate);
            if (id === 'thon-thien' && tier >= 2) { effect.lowHpThreshold = 400; effect.lowHpBonus = (tier - 1) * 50; }
        }
        if (['reduction', 'reflect', 'attack_buff'].includes(effect.kind) && 'value' in effect && effect.value > 0)
            effect.value = scale(effect.value, rate);
        if (effect.kind === 'illusion' && effect.use === 'guard') effect.value = scale(effect.value, rate);
        if (effect.kind === 'bleed') effect.value = scale(effect.value, rate);
    }
    if (id === 'kiem-y' && tier >= 2) spec.effects.push({ kind: 'school_combo', school: 'thien-kiem', value: (tier - 1) * 50 });
    return spec;
}

export function techniquePowers(attack: number, tier: number, purityBp: number, bonusMilli = 0, strength?: TechniqueStrength) {
    if (![attack, tier, purityBp, bonusMilli].every(Number.isSafeInteger) || attack < 1 || tier < 1 || tier > 4 ||
        purityBp < 0 || purityBp > 10000 || bonusMilli < 0 || bonusMilli > 700) throw Error('INVALID_TECHNIQUE_PROFILE');
    if (strength) {
        if (strength.rule !== TIME_PRACTICE_RULE || ![strength.damageFactorMilli, strength.effectFactorMilli,
            strength.gradeBonusMilli, strength.totalPurityBp].every(Number.isSafeInteger) ||
            strength.damageFactorMilli < 400 || strength.damageFactorMilli > 1540 ||
            strength.effectFactorMilli !== 1000 + (tier - 1) * 180 ||
            strength.totalPurityBp < 0 || strength.totalPurityBp > tier * 2500 ||
            strength.gradeBonusMilli !== (purityGrade(strength.totalPurityBp)?.bonusMilli ?? 0))
            throw Error('INVALID_TECHNIQUE_STRENGTH');
        return { damagePower: Math.max(1, scale(scale(scale(attack, strength.damageFactorMilli), 1000 + strength.gradeBonusMilli), 1000 + bonusMilli)),
            effectPower: Math.max(1, scale(scale(attack, strength.effectFactorMilli), 1000 + bonusMilli)) };
    }
    const power = Math.max(1, scale(scale(scale(attack, 1000 + (tier - 1) * 180), 400 + Math.floor(purityBp * .06)), 1000 + bonusMilli));
    return { damagePower: power, effectPower: power };
}

export function techniqueProfile(id: string, tier: number, purityBp: number, attack: number, bonusMilli = 0, strength?: TechniqueStrength): TechniqueProfile {
    const spec = tierBattleTechnique(id, tier, !!strength), powers = techniquePowers(attack, tier, purityBp, bonusMilli, strength);
    const effects: EffectDescriptor[] = [];
    const add = (effect: BattleEffect, group: EffectDescriptor['group'], label: string, amount: number | null, unit: string,
        timing = 'Khi thi triển', condition: string | null = null, limit: string | null = null) =>
        effects.push({ id: effect.kind + ':' + effects.length, group, label, amount, unit, timing, condition, limit,
            growth: ['bleed', 'guard_strike', 'mark', 'domain', 'mark_combo', 'convert_intent', 'max_hp_strike', 'copy', 'echo', 'four_seals'].includes(effect.kind) ||
                effect.kind === 'strike' && group === 'Hiệu ứng' || effect.kind === 'illusion' && effect.use === 'strike' ? 'habit' : 'tier' });
    let damage = 0, hits = 0, perHit = 0;
    for (const effect of spec.effects) {
        switch (effect.kind) {
            case 'strike':
                perHit = scale(powers.damagePower, effect.power); hits += effect.hits; damage += perHit * effect.hits;
                if (effect.pierce) add(effect, 'Đặc tính', 'Xuyên Phòng thủ', effect.pierce / 10, '%');
                if (effect.execute) add(effect, 'Hiệu ứng', 'Kết liễu: sát thương thêm mỗi đòn', scale(powers.damagePower, effect.execute), 'điểm', 'Khi thi triển', 'Boss ≤30% HP');
                if (effect.lowHp) add(effect, 'Hiệu ứng', 'Sát thương thêm theo HP đã mất', scale(powers.damagePower, effect.lowHp), 'điểm tối đa', 'Khi thi triển', 'Tăng theo tỷ lệ HP người dùng đã mất');
                break;
            case 'shield': case 'virtual_armor': case 'heal':
                add(effect, 'Hiệu ứng', effect.kind === 'shield' ? 'Khiên' : effect.kind === 'virtual_armor' ? 'Giáp Ảo' : 'Hồi phục',
                    scale(powers.effectPower, effect.value), 'điểm', effect.kind === 'heal' ? 'Khi thi triển' : effect.turns + ' lượt',
                    null, effect.kind === 'heal' ? 'Không vượt HP tối đa' : 'Trần mỗi nguồn 65% HP tối đa' +
                        (effect.kind === 'virtual_armor' ? '; giảm 40% khi còn ở đầu đòn' : '')); break;
            case 'reduction': case 'reflect': case 'attack_buff':
                add(effect, effect.value < 0 ? 'Cái giá' : 'Hiệu ứng', effect.kind === 'reflect' ? 'Phản thương' :
                    effect.kind === 'attack_buff' ? 'Tăng sát thương' : effect.value < 0 ? 'Tăng sát thương nhận' : 'Giảm thương',
                    Math.abs(effect.value) / 10, '%', effect.turns + ' lượt', effect.kind === 'reflect' ? 'Theo HP thật mất do boss' : null,
                    effect.kind === 'reflect' ? 'Không phản cái giá tự trả' : null); break;
            case 'bleed': add(effect, 'Hiệu ứng', 'Chảy máu', scale(powers.damagePower, effect.value), 'điểm/lượt',
                effect.turns + ' lượt tiếp theo', null, 'Xuyên 100% Phòng thủ; vẫn gặp Giáp Ảo/Khiên'); break;
            case 'lifesteal':
                add(effect, 'Đặc tính', 'Hút máu', effect.percent / 10, '% HP thật lấy được', 'Đòn trực tiếp được phép');
                if (effect.lowHpBonus) add(effect, 'Đặc tính', 'Hút máu thêm', effect.lowHpBonus / 10, 'điểm %', 'Khi thi triển', 'HP ≤40%');
                break;
            case 'guard': add(effect, 'Hiệu ứng', 'Cương Kình', effect.value, 'điểm', 'Khi thi triển', null, 'Tối đa 3'); break;
            case 'guard_strike': add(effect, 'Hiệu ứng', 'Đòn bổ sung mỗi Cương Kình', scale(powers.damagePower, effect.powerPerStack),
                'điểm', 'Khi thi triển', 'Tiêu Cương Kình', 'Tối đa ' + effect.maximum + ' điểm'); break;
            case 'illusion': {
                const label = { guard: 'Giảm thương và tạo Hư Ảnh', heal: 'Hồi phục', strike: 'Đòn bổ sung', dodge: 'Né đòn' }[effect.use];
                const amount = effect.use === 'guard' ? effect.value / 10 : effect.use === 'dodge' ? 1 :
                    scale(effect.use === 'heal' ? powers.effectPower : powers.damagePower, effect.value);
                add(effect, 'Hiệu ứng', label, amount, effect.use === 'guard' ? '%' : effect.use === 'dodge' ? 'đòn' : 'điểm',
                    'Khi thi triển', effect.use === 'guard' ? null : (effect.consume ? 'Tiêu' : 'Cần có') + ' Hư Ảnh',
                    effect.use === 'strike' ? 'Đòn thêm xuyên 70% Phòng thủ' : 'Tối đa 1 Hư Ảnh'); break;
            }
            case 'foresight': add(effect, 'Hiệu ứng', 'Xem trước', effect.turns, 'hành động thêm', 'Sau thi triển'); break;
            case 'mark': case 'domain': add(effect, 'Hiệu ứng', 'Đòn trễ', scale(powers.damagePower, effect.power), 'điểm',
                'Sau ' + effect.delay + ' lượt', null, id === 'tam-nhat' ? 'Một Tử Ấn duy nhất' : 'Xuyên 20% Phòng thủ'); break;
            case 'mark_combo': add(effect, 'Hiệu ứng', 'Đòn bổ sung mỗi ấn', scale(powers.damagePower, effect.powerPerMark), 'điểm',
                'Khi thi triển', 'Tiêu ấn đã đặt', 'Tối đa ' + effect.maximum + '; ấn đã tiêu không nổ lại'); break;
            case 'convert_intent': add(effect, 'Hiệu ứng', 'Chuyển lực', effect.percent / 10, '% lực boss đã báo', 'Khi thi triển',
                null, 'Trần ' + scale(powers.damagePower, effect.cap)); break;
            case 'max_hp_strike': add(effect, 'Hiệu ứng', 'Đòn theo HP tối đa boss', effect.percent / 10, '% HP tối đa',
                'Khi thi triển', null, 'Trần ' + scale(powers.damagePower, effect.cap) + '; xuyên 60% Phòng thủ'); break;
            case 'copy': add(effect, 'Hiệu ứng', 'Sao chép sát thương', null, '', 'Khi thi triển', 'Có hành động boss trước',
                'Trần ' + scale(powers.damagePower, 1500) + '; không sao chép hiệu ứng'); break;
            case 'echo': add(effect, 'Hiệu ứng', 'Tái hiện sát thương', effect.power / 10, '% sát thương thô', 'Lượt tiếp theo', null,
                'Trần ' + scale(powers.damagePower, 1200) + '; không lặp đệ quy'); break;
            case 'seal': add(effect, 'Hiệu ứng', 'Niêm phong tuyệt kỹ', effect.turns, 'lượt', 'Sau thi triển', 'Hồi chiêu 3 lượt', 'Boss vẫn đánh thường'); break;
            case 'intent_swap': add(effect, 'Hiệu ứng', 'Đổi thứ tự chiêu', 2, 'hành động', 'Hôm nay và lượt kế', 'Có lượt kế', 'Không xóa chiêu'); break;
            case 'dispel': add(effect, 'Hiệu ứng', 'Giải trừ', null, 'Khiên / Tăng sát thương / Giảm thương');
                add(effect, 'Hiệu ứng', 'Giảm Phòng thủ', scale(powers.effectPower, 250), 'điểm'); break;
            case 'reverse_buff': add(effect, 'Hiệu ứng', 'Đảo lợi thế vừa nhận', null, 'Giảm Phòng thủ vừa tăng / xóa Tăng sát thương',
                'Khi thi triển', 'Có lợi thế tương ứng', 'Trần giảm ' + scale(powers.effectPower, 700)); break;
            case 'rank_rescue': add(effect, 'Hiệu ứng', 'Chuẩn bị Nghịch Mệnh', null, '', 'Lượt thi triển', 'Bị hạ trong lượt này',
                'Trả một cảnh giới khi chọn cứu; chung quyền cứu'); break;
            case 'exchange': add(effect, 'Hiệu ứng', 'Đổi công pháp', 1, 'ô', 'Ngày giao chiến sau', null, 'Không bỏ trạng thái/cái giá'); break;
            case 'sword_seal': add(effect, 'Hiệu ứng', 'Tạo ấn', null, { mountain: 'Sơn Ấn', blood: 'Huyết Ấn', storm: 'Kiếp Ấn', echo: 'Cổ Ấn' }[effect.id] ?? effect.id,
                'Khi thi triển', null, 'Mỗi loại giữ một'); break;
            case 'four_seals': add(effect, 'Hiệu ứng', 'Đòn bùng nổ', scale(powers.damagePower, effect.power), 'điểm', 'Khi thi triển',
                'Tiêu đủ bốn ấn khác loại', 'Một lần/trận; xuyên 70% Phòng thủ'); break;
            case 'school_combo': add(effect, 'Hiệu ứng', 'Tăng sát thương nối chiêu', effect.value / 10, '%',
                'Lượt giao chiến kế tiếp', 'Thi triển một chiêu Thiên Kiếm khác', 'Một lần; không cộng dồn'); break;
        }
    }
    if (strength && id === 'huyen-quy' && tier >= 2) effects.push({ id: 'huyen-quy:passive', group: 'Nội tại', label: 'Khiên lúc nguy cấp',
        amount: [0, 20, 25, 35][tier - 1]!, unit: '% HP tối đa', timing: 'Sau đòn boss, giữ 2 lượt',
        condition: 'Còn sống và HP ≤35%', limit: 'Một lần/trận; không kích từ hiến HP' });
    if (spec.cost.hpPercent) effects.push({ id: 'hp-cost', group: 'Cái giá', label: 'Hiến HP', amount: spec.cost.hpPercent / 10,
        unit: '% HP tối đa', timing: 'Trước thi triển', condition: 'Phải còn HP sau khi trả', limit: null });
    if (spec.cost.maxHpPercent) effects.push({ id: 'max-hp-cost', group: 'Cái giá', label: 'Giảm HP tối đa', amount: spec.cost.maxHpPercent / 10,
        unit: '%', timing: 'Trong phần còn lại của trận', condition: null, limit: null });
    if (spec.cost.endAtOneHp) effects.push({ id: 'one-hp-cost', group: 'Cái giá', label: 'Sau thi triển còn', amount: 1,
        unit: 'HP', timing: 'Kể cả khi thắng', condition: null, limit: 'Boss sống vẫn phản công' });
    return { id, tier, rule: strength?.rule ?? 'practice-v1', attack, bonusMilli, damage, hits, perHit,
        ...powers, totalPurityBp: strength?.totalPurityBp ?? null, effects, cost: spec.cost, warning: spec.warning };
}

export function profileForPractice(version: PracticeVersion, attack = 100): TechniqueProfile | null {
    const tier = version.tiers.at(-1);
    return tier ? techniqueProfile(version.techniqueId, version.tiers.length, tier.purityBp, attack, 0, practiceStrength(version)) : null;
}

export function perfectTierProfile(id: string, tier: number, attack = 100): TechniqueProfile {
    techniqueById(id);
    const totalPurityBp = tier * 2500;
    return techniqueProfile(id, tier, 10000, attack, 0, { rule: TIME_PRACTICE_RULE,
        damageFactorMilli: 1000 + (tier - 1) * 180, effectFactorMilli: 1000 + (tier - 1) * 180,
        gradeBonusMilli: tier === 4 ? 150 : 0, totalPurityBp });
}
