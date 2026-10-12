export type BattleDefense = { hp: number; armor: number; shield: number; virtualArmor: number; reduction: number };
export type BattleHit = { damage: number; defense: BattleDefense; hpLost: number; virtualAbsorbed: number; shieldAbsorbed: number };

// Each hit checks whether virtual armor existed at its start. Its 40% reduction
// does not survive breaking and is applied before this layer absorbs damage.
export function absorbBattleHit(current: BattleDefense, raw: number, pierce = 0): BattleHit {
    if (![current.hp, current.armor, current.shield, current.virtualArmor, current.reduction, raw, pierce].every(Number.isSafeInteger) ||
        current.hp < 0 || current.armor < 0 || current.shield < 0 || current.virtualArmor < 0 || raw < 0 || pierce < 0 || pierce > 1000 ||
        current.reduction < -500 || current.reduction > 700) throw Error('INVALID_BATTLE_HIT');
    const defense = { ...current };
    let damage = Math.max(0, Math.floor(raw * (1000 - defense.reduction) / 1000) - Math.floor(defense.armor * (1000 - pierce) / 1000));
    if (defense.virtualArmor > 0) damage = Math.floor(damage * .6);
    const virtualAbsorbed = Math.min(defense.virtualArmor, damage); defense.virtualArmor -= virtualAbsorbed; damage -= virtualAbsorbed;
    const shieldAbsorbed = Math.min(defense.shield, damage); defense.shield -= shieldAbsorbed; damage -= shieldAbsorbed;
    const hpLost = Math.min(defense.hp, damage); defense.hp -= hpLost;
    return { damage, defense, hpLost, virtualAbsorbed, shieldAbsorbed };
}
