import { TECHNIQUES } from './techniques.ts';

export type BattleEffect =
    | { kind: 'strike'; power: number; hits: number; pierce: number; execute?: number; lowHp?: number }
    | { kind: 'shield' | 'virtual_armor' | 'heal' | 'reduction' | 'reflect' | 'bleed' | 'attack_buff'; value: number; turns: number }
    | { kind: 'guard'; value: number }
    | { kind: 'guard_strike'; powerPerStack: number; maximum: number }
    | { kind: 'illusion'; consume: boolean; use: 'guard' | 'heal' | 'strike' | 'dodge'; value: number }
    | { kind: 'lifesteal'; percent: number }
    | { kind: 'foresight'; turns: number }
    | { kind: 'mark'; power: number; delay: number }
    | { kind: 'mark_combo'; powerPerMark: number; maximum: number }
    | { kind: 'convert_intent'; percent: number; cap: number }
    | { kind: 'intent_swap' | 'dispel' | 'reverse_buff' | 'copy' | 'exchange' | 'rank_rescue' }
    | { kind: 'seal'; turns: number }
    | { kind: 'max_hp_strike'; percent: number; cap: number }
    | { kind: 'echo'; power: number }
    | { kind: 'sword_seal'; id: string }
    | { kind: 'four_seals'; power: number }
    | { kind: 'domain'; power: number; delay: number };
export type BattleTechnique = { id: string; effects: BattleEffect[];
    cost: { hpPercent: number; maxHpPercent: number; endAtOneHp: boolean }; warning: string | null };
const strike = (power: number, hits = 1, pierce = 0): BattleEffect => ({ kind: 'strike', power, hits, pierce });
const shield = (value: number, turns = 1): BattleEffect => ({ kind: 'shield', value, turns });
const specs: [id: string, effects: BattleEffect[], hpPercent?: number, maxHpPercent?: number, endAtOneHp?: boolean, warning?: string][] = [
    ['kiem-y', [strike(1100, 1, 500)]],
    ['lien-van', [strike(460, 3, 100)]],
    ['tuyet-menh', [{ kind: 'strike', power: 1100, hits: 1, pierce: 200, execute: 1000 }]],
    ['vo-hoi', [strike(2000), { kind: 'reduction', value: -250, turns: 1 }], 0, 0, false, 'Đòn phản công hôm nay gây thêm 25% sát thương.'],
    ['kiem-vuc', [strike(700), { kind: 'domain', power: 2400, delay: 1 }, { kind: 'attack_buff', value: 180, turns: 2 }]],
    ['kim-than', [strike(550), { kind: 'guard', value: 1 }, { kind: 'reduction', value: 300, turns: 1 }]],
    ['huyen-quy', [strike(500), shield(700, 2)]],
    ['phan-chan', [strike(650), { kind: 'reflect', value: 550, turns: 1 }]],
    ['tran-son', [strike(700), { kind: 'guard_strike', powerPerStack: 500, maximum: 3 }]],
    ['chien-the', [strike(800), { kind: 'guard', value: 1 }, { kind: 'attack_buff', value: 350, turns: 2 }, shield(600, 2)]],
    ['thon-thien', [strike(1000), { kind: 'lifesteal', percent: 500 }]],
    ['huyet-sat', [strike(1700), { kind: 'bleed', value: 200, turns: 2 }], 150, 0, false, 'Hiến 15% HP tối đa từ HP hiện tại.'],
    ['minh-ha', [strike(650), { kind: 'bleed', value: 350, turns: 3 }]],
    ['tan-menh', [{ kind: 'strike', power: 1000, hits: 1, pierce: 300, lowHp: 1300 }]],
    ['huyet-hai', [strike(1600), { kind: 'bleed', value: 450, turns: 3 }, { kind: 'lifesteal', percent: 350 }], 0, 120, false, 'Mất 12% HP tối đa trong trận; không tự hồi sau đòn này.'],
    ['thai-hu-bo', [strike(650), { kind: 'illusion', consume: false, use: 'guard', value: 350 }]],
    ['hu-khong', [strike(450), { kind: 'illusion', consume: false, use: 'heal', value: 500 }]],
    ['khong-minh', [strike(800, 1, 200), { kind: 'illusion', consume: true, use: 'strike', value: 1300 }]],
    ['hoan-hinh', [strike(600), { kind: 'illusion', consume: true, use: 'dodge', value: 1000 }]],
    ['quy-hu', [strike(1000), { kind: 'dispel' }, { kind: 'illusion', consume: false, use: 'guard', value: 250 }]],
    ['quan-thien', [strike(650), { kind: 'foresight', turns: 2 }]],
    ['lac-tu', [strike(600), { kind: 'mark', power: 1400, delay: 2 }]],
    ['dan-kiep', [strike(600), { kind: 'convert_intent', percent: 350, cap: 1200 }]],
    ['that-tinh', [strike(800), { kind: 'mark_combo', powerPerMark: 700, maximum: 2 }]],
    ['nghich-thien', [strike(1100), { kind: 'intent_swap' }]],
    ['nghich-menh', [strike(550), { kind: 'rank_rescue' }], 0, 0, false, 'Nếu bị hạ trong lượt này, Nghịch Mệnh được dùng để cứu bằng một đại cảnh giới. Chung một quyền cứu với Hộ Mệnh.'],
    ['thau-thien', [strike(600), { kind: 'max_hp_strike', percent: 120, cap: 1800 }, { kind: 'lifesteal', percent: 700 }], 0, 150, false, 'Mất 15% HP tối đa trong trận.'],
    ['tang-nhat', [strike(3400, 1, 700)], 0, 0, true, 'Thi triển xong chỉ còn 1 HP; boss còn sống vẫn phản công.'],
    ['dong-menh', [strike(700), { kind: 'reflect', value: 900, turns: 2 }], 100, 0, false, 'Hiến 10% HP tối đa từ HP hiện tại; phản thương chỉ từ HP thật đã mất.'],
    ['cuu-u', [strike(700), { kind: 'copy' }]],
    ['phong-than', [strike(650), { kind: 'seal', turns: 2 }], 0, 180, false, 'Mất 18% HP tối đa trong trận để niêm phong một tuyệt kỹ; boss vẫn đánh thường.'],
    ['tam-nhat', [strike(550), { kind: 'mark', power: 3300, delay: 3 }], 100, 0, false, 'Hiến 10% HP tối đa; một Tử Ấn duy nhất, không chồng thêm.'],
    ['nghich-luan', [strike(800), { kind: 'reverse_buff' }]],
    ['vo-mon', [strike(750), { kind: 'exchange' }]],
    ['son-ha', [strike(500), { kind: 'virtual_armor', value: 1200, turns: 2 }, { kind: 'sword_seal', id: 'mountain' }]],
    ['huyet-trieu', [strike(800), { kind: 'max_hp_strike', percent: 80, cap: 1400 }, { kind: 'bleed', value: 200, turns: 2 }, { kind: 'sword_seal', id: 'blood' }]],
    ['kiep-dong', [strike(700), { kind: 'convert_intent', percent: 450, cap: 1400 }, { kind: 'sword_seal', id: 'storm' }]],
    ['van-co', [strike(650), { kind: 'echo', power: 600 }, { kind: 'heal', value: 450, turns: 1 }, { kind: 'sword_seal', id: 'echo' }]],
    ['van-thien', [strike(1050, 1, 350), { kind: 'four_seals', power: 3800 }]],
];
export const BATTLE_TECHNIQUES: BattleTechnique[] = specs.map(([id, effects, hpPercent = 0, maxHpPercent = 0, endAtOneHp = false, warning]) => ({
    id, effects, cost: { hpPercent, maxHpPercent, endAtOneHp }, warning: warning ?? null,
}));
export function battleTechnique(id: string): BattleTechnique {
    const value = BATTLE_TECHNIQUES.find(technique => technique.id === id);
    if (!value) throw Error('INVALID_BATTLE_TECHNIQUE');
    return value;
}
export function validateBattleTechniques(): void {
    if (BATTLE_TECHNIQUES.length !== 39 || new Set(BATTLE_TECHNIQUES.map(technique => technique.id)).size !== 39 ||
        TECHNIQUES.some(technique => !BATTLE_TECHNIQUES.some(spec => spec.id === technique.id))) throw Error('INVALID_BATTLE_CATALOG');
    for (const technique of BATTLE_TECHNIQUES) {
        if (!technique.effects.length || technique.effects.length > 8 || !Number.isInteger(technique.cost.hpPercent) ||
            technique.cost.hpPercent < 0 || technique.cost.hpPercent > 250 || technique.cost.maxHpPercent < 0 || technique.cost.maxHpPercent > 250)
            throw Error('INVALID_BATTLE_CATALOG');
        for (const effect of technique.effects) {
            for (const value of Object.values(effect)) if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < -500 || value > 5000))
                throw Error('INVALID_BATTLE_CATALOG');
            if ('turns' in effect && (effect.turns < 1 || effect.turns > 3)) throw Error('INVALID_BATTLE_CATALOG');
        }
    }
}
