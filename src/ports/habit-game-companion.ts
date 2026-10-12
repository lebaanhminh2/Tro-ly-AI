import type { PreparedWrite } from './work-store.ts';
export interface HabitGameCompanion {
    context(owner: string, now: number): Promise<Record<string, unknown>>;
    findHabits(owner: string, query: string, cursor: number, now: number, status?: 'active' | 'all'): Promise<Record<string, unknown>>;
    game(owner: string, section: 'status' | 'library' | 'versions', now: number, techniqueId?: string, before?: string | null): Promise<Record<string, unknown>>;
    prepare(owner: string, id: string, kind: 'habit' | 'practice', input: Record<string, unknown>, now: number):
        Promise<{ result: Record<string, unknown>; statements: PreparedWrite[]; validUntil: number }>;
}
