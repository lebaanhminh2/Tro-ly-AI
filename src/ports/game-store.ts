import type { PracticeVersion, PracticeWeek } from '../domain/practice.ts';
import type { HabitDay } from './habit-store.ts';
export type GameSelection = { fromDay: number; mode: 'idle' | 'practice' | 'battle'; practiceId: string | null; battleId: string | null };
export type StoredPractice = { practice: PracticeVersion; version: number; created: number };
export type GameSnapshot = { day: HabitDay; version: number; current: GameSelection; pending: GameSelection | null;
    owned: string[]; requestedPractice: StoredPractice | null; priorVersions: number; createdToday: number };
export type GameChange = { selection: GameSelection; practice: PracticeVersion | null };
export type GameSaved = { saved: true; version: number; effectiveFrom: number; practiceId: string | null };
export type GameOverview = { day: HabitDay; version: number; current: GameSelection; pending: GameSelection | null;
    currentPractice: StoredPractice | null; pendingPractice: StoredPractice | null; owned: string[];
    settledThrough: number | null; audits: PracticeWeek[]; recent: { day: number; mode: string; result: Record<string, unknown> }[] };
export interface GameStore {
    read(owner: string, now: number): Promise<GameOverview>;
    mutate(owner: string, id: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: GameSnapshot) => { change: GameChange; result: GameSaved }): Promise<GameSaved>;
    versions(owner: string, techniqueId: string, before: string | null, limit: number): Promise<{ versions: StoredPractice[]; next: string | null }>;
    settle(owner: string, now: number, limit?: number): Promise<{ processed: number; pending: boolean }>;
}
