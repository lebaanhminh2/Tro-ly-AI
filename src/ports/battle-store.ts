import type { HealthyState } from '../domain/healthy.ts';
import type { BattleRun } from '../domain/battle-run.ts';
import type { GameBoss } from '../domain/game-content.ts';
import type { CombatRestrictions } from '../domain/battle-economy.ts';
import type { EquippedTechnique } from '../domain/battle.ts';
import type { GameSelection } from './game-store.ts';
import type { HabitDay } from './habit-store.ts';
export type StoredBattle = { run: BattleRun; content: GameBoss; version: number; status: string; created: number; resumePracticeId: string | null };
export type BattleSnapshot = { day: HabitDay; gameVersion: number; nextSettlementDay: number; current: GameSelection; pending: GameSelection | null;
    healthy: { state: HealthyState; version: number }; restrictions: CombatRestrictions; battle: StoredBattle | null;
    live: StoredBattle | null; victories: string[]; learned: string[]; ownedWeapons: string[]; loadout: EquippedTechnique[] };
export type BattleSaved = { saved: true; version: number; battleId: string; battleVersion: number; effectiveFrom?: number; qiSpent?: number; rankSpent?: number };
export type BattleChange = { kind: 'prepare' | 'cancel' | 'choose' | 'withdraw' | 'rescue' | 'death' | 'exchange';
    battle: StoredBattle; selection?: GameSelection; choice?: { techniqueId: string; acceptCost: boolean };
    healthy?: HealthyState; restrictions?: CombatRestrictions; qiSpent?: number; rankSpent?: number };
export interface BattleStore {
    mutateBattle(owner: string, id: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: BattleSnapshot) => { change: BattleChange; result: BattleSaved }): Promise<BattleSaved>;
}
