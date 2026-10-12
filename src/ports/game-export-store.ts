import type { PracticeWeek } from '../domain/practice.ts';
import type { BattleRun } from '../domain/battle-run.ts';
import type { publicBattleState } from '../domain/battle.ts';
import type { GameSelection, StoredPractice } from './game-store.ts';

export type GameExportSnapshot = {
    profile: { account: Record<string, unknown> | null; cultivation: Record<string, unknown> | null;
        owned: string[]; victories: string[]; entitlements: Record<string, unknown>[]; presets: Record<string, unknown>[] };
    selections: GameSelection[];
    practiceVersions: StoredPractice[];
    days: { day: number; startAt: number; endAt: number; mode: string; practiceId: string | null; battleId: string | null;
        rule: string; result: Record<string, unknown>; settledAt: number }[];
    battles: { id: string; bossId: string; bossName: string; chapter: number; contentVersion: string; version: number;
        startsDay: number; lastDay: number | null; waitDays: number; rescueUntilDay: number | null;
        created: number; updated: number; state: ReturnType<typeof publicBattleState>; victory: string | null }[];
    events: { battleId: string; sequence: number; day: number; kind: string; entries: unknown[]; result: Record<string, unknown> }[];
    weeklyAudits: PracticeWeek[];
};
export type StoredExportBattle = { run: BattleRun; version: number; bossName: string; chapter: number;
    created: number; updated: number; victory: string | null };
export interface GameExportStore { read(owner: string, from: number, to: number): Promise<GameExportSnapshot>; }
