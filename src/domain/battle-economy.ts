import { REALMS, type HealthyState } from './healthy.ts';
import { acceptBattleDeath, rescueBattle, validateBattleState, type BattleFighter, type BattleState } from './battle.ts';

export type CombatRestrictions = { rankLockUntilDay: number | null };
export type BattlePayment = { healthy: HealthyState; battle: BattleState; restrictions: CombatRestrictions;
    combatRank: number; qiSpent: number; rankSpent: number };

export function fighterForRank(rank: number): BattleFighter {
    if (!Number.isInteger(rank) || rank < 0 || rank >= REALMS.length) throw Error('INVALID_COMBAT_RANK');
    const maxHp = 180 + rank * 60;
    return { hp: maxHp, maxHp, attack: 30 + rank * 12, armor: rank * 2 };
}

export function rescueQuote(healthy: HealthyState, combatRank: number) {
    fighterForRank(combatRank);
    if (!Number.isInteger(healthy.rank) || healthy.rank < 0 || healthy.rank >= REALMS.length ||
        !Number.isSafeInteger(healthy.qi) || healthy.qi < 0) throw Error('INVALID_COMBAT_ACCOUNT');
    const qiCost = Math.max(5, Math.min(100, Math.ceil(REALMS[combatRank]!.qi * .08)));
    return { qiCost, qiAvailable: !healthy.suspended && healthy.qi >= qiCost, rankCost: 1,
        rankAvailable: !healthy.suspended && healthy.rank > 0, restoresPercent: 35, rankLockDays: 3 };
}

export function payBattleRescue(healthy: HealthyState, before: BattleState, kind: 'qi' | 'rank',
    combatRank: number, restrictions: CombatRestrictions, day: number): BattlePayment {
    if (!Number.isSafeInteger(day)) throw Error('INVALID_COMBAT_DAY');
    const quote = rescueQuote(healthy, combatRank);
    if (kind === 'qi' ? !quote.qiAvailable : kind !== 'rank' || !quote.rankAvailable) throw Error('BATTLE_RESCUE_UNAFFORDABLE');
    let battle = rescueBattle(before, kind);
    const next: HealthyState = { ...healthy, inventory: { ...healthy.inventory }, checkin: healthy.checkin ? { ...healthy.checkin } : null };
    let nextRank = combatRank;
    const locks = { ...restrictions };
    if (kind === 'qi') next.qi -= quote.qiCost;
    else {
        next.rank--; next.failures = 0; next.attemptDay = day;
        locks.rankLockUntilDay = Math.max(restrictions.rankLockUntilDay ?? day, day + quote.rankLockDays);
        nextRank = Math.min(combatRank, next.rank);
        if (nextRank < combatRank) {
            const oldBase = fighterForRank(combatRank), newBase = fighterForRank(nextRank);
            // Preserve prior max-HP sacrifices and never heal from changing rank.
            battle.player.maxHp = Math.max(1, Math.floor(battle.player.maxHp * newBase.maxHp / oldBase.maxHp));
            battle.player.hp = Math.max(1, Math.floor(battle.player.maxHp * 350 / 1000));
            battle.player.attack = Math.max(1, Math.floor(battle.player.attack * newBase.attack / oldBase.attack));
            battle.player.armor = Math.min(battle.player.armor, newBase.armor);
            for (const status of battle.statuses) if (status.target === 'player' && ['shield', 'virtual_armor'].includes(status.kind))
                status.value = Math.min(status.value, Math.floor(battle.player.maxHp * .65));
        }
    }
    validateBattleState(battle);
    return { healthy: next, battle, restrictions: locks, combatRank: nextRank,
        qiSpent: kind === 'qi' ? quote.qiCost : 0, rankSpent: kind === 'rank' ? 1 : 0 };
}

export function payBattleDeath(healthy: HealthyState, before: BattleState): { healthy: HealthyState; battle: BattleState; qiSpent: number } {
    if (!Number.isSafeInteger(healthy.qi) || healthy.qi < 0) throw Error('INVALID_COMBAT_ACCOUNT');
    // A second lethal hit is already dead. The transaction adapter still guards
    // its economic receipt; callers cannot replay this pure delta as a reward.
    const battle = before.status === 'dead' ? structuredClone(before) : acceptBattleDeath(before);
    validateBattleState(battle);
    const qiSpent = Math.min(healthy.qi, Math.min(60, Math.max(5, Math.ceil(healthy.qi * .08))));
    return { healthy: { ...healthy, inventory: { ...healthy.inventory }, checkin: healthy.checkin ? { ...healthy.checkin } : null,
        qi: healthy.qi - qiSpent }, battle, qiSpent };
}

export function assertCombatBreakthroughAllowed(restrictions: CombatRestrictions, day: number): void {
    if (restrictions.rankLockUntilDay !== null && day < restrictions.rankLockUntilDay) throw Error('BREAKTHROUGH_COMBAT_COOLDOWN');
}
