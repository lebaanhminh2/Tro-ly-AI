import type { PreparedWrite } from './work-store.ts';
export interface HabitCompanion {
    context(owner: string, now: number): Promise<Record<string, unknown>>;
    findHabits(owner: string, query: string, cursor: number, now: number, status?: 'active' | 'all'): Promise<Record<string, unknown>>;
    prepare(owner: string, id: string, input: Record<string, unknown>, now: number):
        Promise<{ result: Record<string, unknown>; statements: PreparedWrite[]; validUntil: number }>;
}
