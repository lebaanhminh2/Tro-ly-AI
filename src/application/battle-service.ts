import { fighterForRank, payBattleDeath, payBattleRescue } from '../domain/battle-economy.ts';
import { assertBattleCanChange } from '../domain/battle-run.ts';
import { resolveBattleTurn, withdrawBattle } from '../domain/battle.ts';
import { bossById, bossIntents, GAME_CONTENT_VERSION } from '../domain/game-content.ts';
import { armedBattleState, battleWeapon } from '../domain/game-rewards.ts';
import type { BattleChange, BattleSaved, BattleStore, StoredBattle } from '../ports/battle-store.ts';
import type { GameSelection } from '../ports/game-store.ts';

export class BattleService {
    private store: BattleStore;
    constructor(store: BattleStore) { this.store = store; }
    execute(owner: string, id: string, input: Record<string, unknown>, now: number): Promise<BattleSaved> {
        const fields: Record<string, string[]> = {
            prepare_battle: ['bossId', 'versions', 'weaponId'], cancel_battle: ['battleId', 'battleVersion'],
            choose_battle: ['battleId', 'battleVersion', 'techniqueId', 'acceptCost'],
            withdraw_battle: ['battleId', 'battleVersion', 'confirm'],
            rescue_battle: ['battleId', 'battleVersion', 'kind', 'healthyVersion', 'acceptCost'],
            accept_battle_death: ['battleId', 'battleVersion', 'healthyVersion', 'confirm'],
            exchange_battle: ['battleId', 'battleVersion', 'removeId', 'practiceId'],
        };
        const operation = input.operation;
        if (typeof operation !== 'string' || !fields[operation] ||
            Object.keys(input).some(key => !['operation', 'day', 'version', ...fields[operation]!].includes(key))) throw Error('INVALID_BATTLE_OPERATION');
        if (!Number.isSafeInteger(input.day) || !Number.isSafeInteger(input.version) || Number(input.version) < 0) throw Error('INVALID_GAME_VERSION');
        if (operation === 'prepare_battle') {
            if (typeof input.bossId !== 'string' || !Array.isArray(input.versions) || input.versions.length > 5 ||
                input.versions.some(value => typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(value)) ||
                new Set(input.versions).size !== input.versions.length) throw Error('INVALID_BATTLE_LOADOUT');
            bossById(input.bossId);
            if (input.weaponId !== undefined && input.weaponId !== null) {
                if (typeof input.weaponId !== 'string') throw Error('INVALID_GAME_WEAPON');
                battleWeapon(input.weaponId);
            }
        } else if (typeof input.battleId !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(input.battleId) ||
            !Number.isSafeInteger(input.battleVersion) || Number(input.battleVersion) < 1) throw Error('INVALID_BATTLE_ID');
        return this.store.mutateBattle(owner, id, input, now, snapshot => {
            if (input.day !== snapshot.day.day) throw Error('GAME_DAY_CLOSED');
            if (input.version !== snapshot.gameVersion) throw Error('GAME_CHANGED');
            if (snapshot.healthy.state.suspended) throw Error('ACCOUNT_SUSPENDED');
            const day = snapshot.day.day;
            let battle: StoredBattle;
            let change: BattleChange;
            const restore = (value: StoredBattle): GameSelection => ({ fromDay: day + 1,
                mode: value.resumePracticeId ? 'practice' : 'idle', practiceId: value.resumePracticeId, battleId: null });
            if (operation === 'prepare_battle') {
                if (snapshot.live || snapshot.current.mode === 'battle') throw Error('BATTLE_ACTIVE');
                const boss = bossById(input.bossId as string);
                if (boss.requires.some(id => !snapshot.victories.includes(id)) || (boss.practicePrerequisites ?? []).some(id => !snapshot.learned.includes(id))) throw Error('BOSS_LOCKED');
                if (snapshot.loadout.length !== (input.versions as string[]).length) throw Error('INVALID_BATTLE_LOADOUT');
                const rank = snapshot.healthy.state.rank;
                const weaponId = input.weaponId as string | null | undefined ?? null;
                if (weaponId && !snapshot.ownedWeapons.includes(weaponId)) throw Error('GAME_WEAPON_LOCKED');
                const previousSelection = snapshot.pending ?? snapshot.current;
                battle = { version: 1, status: 'prepared', created: now, content: structuredClone(boss),
                    resumePracticeId: previousSelection.mode === 'practice' ? previousSelection.practiceId : null,
                    run: { id: 'b_' + id, bossId: boss.id, contentVersion: GAME_CONTENT_VERSION, combatRank: rank, weaponId,
                        state: armedBattleState(fighterForRank(rank), boss, snapshot.loadout, bossIntents(boss), weaponId),
                        startsDay: day + 1, lastDay: null, waitDays: 0, rescueUntilDay: null, deathPaid: false } };
                change = { kind: 'prepare', battle, selection: { fromDay: day + 1, mode: 'battle', practiceId: null, battleId: battle.run.id } };
            } else {
                if (!snapshot.battle) throw Error('BATTLE_NOT_FOUND');
                battle = structuredClone(snapshot.battle);
                if (battle.version !== input.battleVersion) throw Error('BATTLE_CHANGED');
                if (operation === 'cancel_battle') {
                    if (day >= battle.run.startsDay || battle.status !== 'prepared') throw Error('BATTLE_CANCEL_UNAVAILABLE');
                    battle.status = 'cancelled';
                    change = { kind: 'cancel', battle, selection: restore(battle) };
                } else {
                    assertBattleCanChange(battle.run, day, snapshot.nextSettlementDay);
                    if (snapshot.current.battleId !== battle.run.id) throw Error('BATTLE_NOT_CURRENT');
                    if (operation === 'choose_battle') {
                        if (typeof input.techniqueId !== 'string' || typeof input.acceptCost !== 'boolean') throw Error('INVALID_BATTLE_CHOICE');
                        // Validate selection/costs against the current server snapshot. Its
                        // final contribution is computed at closure, not taken from input.
                        resolveBattleTurn(battle.run.state, { techniqueId: input.techniqueId, acceptCost: input.acceptCost,
                            contribution: { habits: 0, tasks: 0 } });
                        change = { kind: 'choose', battle, choice: { techniqueId: input.techniqueId, acceptCost: input.acceptCost } };
                    } else if (operation === 'withdraw_battle') {
                        if (input.confirm !== true) throw Error('CONFIRM_BATTLE_WITHDRAWAL');
                        battle.run.state = withdrawBattle(battle.run.state); battle.status = 'withdrawn';
                        change = { kind: 'withdraw', battle, selection: restore(battle) };
                    } else if (operation === 'exchange_battle') {
                        const state = battle.run.state;
                        if (state.status !== 'active' || state.exchangeAfterTurn !== state.turn || typeof input.removeId !== 'string' ||
                            typeof input.practiceId !== 'string' || snapshot.loadout.length !== 1) throw Error('BATTLE_EXCHANGE_UNAVAILABLE');
                        const index = state.loadout.findIndex(value => value.id === input.removeId), replacement = snapshot.loadout[0]!;
                        if (index < 0 || state.loadout.some(value => value.id === replacement.id)) throw Error('INVALID_BATTLE_LOADOUT');
                        state.loadout[index] = replacement; state.exchangeAfterTurn = null;
                        change = { kind: 'exchange', battle };
                    } else {
                        if (input.healthyVersion !== snapshot.healthy.version) throw Error('HEALTHY_CHANGED');
                        if (operation === 'rescue_battle') {
                            if (input.acceptCost !== true || !['qi', 'rank'].includes(String(input.kind))) throw Error('BATTLE_COST_NOT_ACCEPTED');
                            const paid = payBattleRescue(snapshot.healthy.state, battle.run.state, input.kind as 'qi' | 'rank',
                                battle.run.combatRank, snapshot.restrictions, day);
                            battle.run.state = paid.battle; battle.run.combatRank = paid.combatRank; battle.run.rescueUntilDay = null;
                            battle.status = paid.battle.status;
                            change = { kind: 'rescue', battle, healthy: paid.healthy, restrictions: paid.restrictions,
                                qiSpent: paid.qiSpent, rankSpent: paid.rankSpent,
                                ...(['won', 'expired'].includes(paid.battle.status) ? { selection: restore(battle) } : {}) };
                        } else {
                            if (input.confirm !== true) throw Error('CONFIRM_BATTLE_DEATH');
                            if (battle.run.deathPaid) throw Error('BATTLE_DEATH_UNAVAILABLE');
                            const paid = payBattleDeath(snapshot.healthy.state, battle.run.state);
                            battle.run.state = paid.battle; battle.run.deathPaid = true; battle.status = 'dead';
                            change = { kind: 'death', battle, healthy: paid.healthy, qiSpent: paid.qiSpent, selection: restore(battle) };
                        }
                    }
                }
                battle.version++;
            }
            return { change, result: { saved: true, version: snapshot.gameVersion + 1, battleId: battle.run.id, battleVersion: battle.version,
                ...(change.selection ? { effectiveFrom: change.selection.fromDay } : {}),
                ...(change.qiSpent !== undefined ? { qiSpent: change.qiSpent } : {}), ...(change.rankSpent !== undefined ? { rankSpent: change.rankSpent } : {}) } };
        });
    }
}
