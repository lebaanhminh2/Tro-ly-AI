import type { HabitDefinition, HabitDayOutcome, HabitRecord, HabitRevision } from '../domain/habits.ts';

export type HabitDay = { day: number; startAt: number; endAt: number };
export type HabitLog = { value: number; note: string; version: number; updatedAt: number };
export type HabitView = {
    habit: HabitRecord; definition: HabitDefinition; pending: HabitRevision | null;
    log: HabitLog; preview: HabitDayOutcome | null;
};
export type HabitSnapshot = { day: HabitDay; habit: HabitRecord | null; log: HabitLog; activeCount: number };
export type HabitChange =
    | { kind: 'create'; habitId: string; definition: HabitDefinition }
    | { kind: 'revision'; habitId: string; version: number; revision: HabitRevision }
    | { kind: 'archive'; habitId: string; version: number; from: number | null }
    | { kind: 'log'; habitId: string; habitVersion: number; logVersion: number; value: number; note: string };
export type HabitSaved = { saved: true; habitId: string; day: number; version: number; effectiveFrom?: number };
export type HabitHistoryRow = {
    habitId: string; day: number; name: string; definition: HabitDefinition;
    value: number; note: string; status: 'achieved' | 'missed' | 'neutral' | 'processing';
    reason: string; successes: number; misses: number;
};
export interface HabitStore {
    today(owner: string, now: number, archived?: boolean): Promise<{ day: HabitDay; habits: HabitView[] }>;
    mutate(owner: string, requestId: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: HabitSnapshot) => { change: HabitChange; result: HabitSaved }): Promise<HabitSaved>;
    history(owner: string, from: number, to: number, habitId: string | null, before: string | null,
        limit: number): Promise<{ rows: HabitHistoryRow[]; next: string | null }>;
    settle(owner: string, now: number, limit?: number): Promise<{ processed: number; pending: boolean }>;
}
