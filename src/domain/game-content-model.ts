import type { BattleFighter } from './battle.ts';

export type BossAction = { name: string; description: string; factors: number[]; heal: number; armorBuff: number; special: boolean };
export type GameBoss = { id: string; name: string; chapter: number; requires: string[]; recommendedRank: number;
    kind?: 'main' | 'heritage' | 'forbidden' | 'outside'; practicePrerequisites?: string[];
    maxTurns: number; fighter: BattleFighter; revival: { remaining: number; hpPercent: number }; pattern: BossAction[];
    introduction: string; victory: string; defeat: string; mechanics: string; advice: string[];
    unlocks: string[]; artId: string | null; artPosition?: [number, number]; rewards?: { weapons: string[]; achievements: string[] } };
export type GameChapter = { number: number; name: string; subtitle: string; scene: string | null; encounters: string[];
    introduction: string; conclusion: string; characters: string[] };
export const contentFighter = (hp: number, attack: number, armor = 0): BattleFighter => ({ hp, maxHp: hp, attack, armor });
export const bossAction = (name: string, description: string, factors: number[], special = false, heal = 0, armorBuff = 0): BossAction => ({ name, description, factors, special, heal, armorBuff });
