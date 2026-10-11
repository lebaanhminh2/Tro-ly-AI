import { definitionOnDay, firstCommitmentDay, habitChangeDay, parseHabitCadence,
    parseHabitDefinition, validateRecordedValue } from '../domain/habits.ts';
import type { HabitSaved, HabitStore } from '../ports/habit-store.ts';

function version(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw Error('INVALID_HABIT_VERSION');
    return Number(value);
}
function note(value: unknown): string {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 300 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))
        throw Error('INVALID_HABIT_NOTE');
    return value.trim();
}
export class HabitService {
    private store: HabitStore;
    constructor(store: HabitStore) { this.store = store; }
    async execute(owner: string, requestId: string, input: Record<string, unknown>, now: number): Promise<HabitSaved> {
        const fields: Record<string, string[]> = {
            create: ['operation', 'definition'], update: ['operation', 'habitId', 'version', 'definition'],
            archive: ['operation', 'habitId', 'version'], restore: ['operation', 'habitId', 'version'],
            log: ['operation', 'habitId', 'version', 'day', 'logVersion', 'value', 'note'],
        };
        const operation = String(input.operation), allowed = fields[operation];
        if (!allowed || Object.keys(input).some(key => !allowed.includes(key))) throw Error('INVALID_HABIT_OPERATION');
        if (operation !== 'create' && (typeof input.habitId !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(input.habitId)))
            throw Error('INVALID_HABIT_ID');
        return this.store.mutate(owner, requestId, input, now, snapshot => {
            const day = snapshot.day.day;
            if (operation === 'create') {
                if (snapshot.activeCount >= 30) throw Error('HABIT_LIMIT');
                const candidate = input.definition as Record<string, unknown> | null;
                const cadence = parseHabitCadence(candidate?.cadence);
                const definition = parseHabitDefinition(input.definition, firstCommitmentDay(day, cadence));
                const habitId = 'h_' + requestId;
                return { change: { kind: 'create', habitId, definition },
                    result: { saved: true, habitId, day, version: 1, effectiveFrom: definition.commitmentFrom } };
            }
            const habit = snapshot.habit;
            if (!habit) throw Error('HABIT_NOT_FOUND');
            if (habit.version !== version(input.version)) throw Error('HABIT_CHANGED');
            const current = definitionOnDay(habit, day)?.definition;
            if (!current) throw Error('HABIT_NOT_FOUND');
            if (operation === 'log') {
                if (input.day !== day) throw Error('HABIT_DAY_CLOSED');
                if (habit.archivedFrom !== null && day >= habit.archivedFrom) throw Error('HABIT_ARCHIVED');
                if (version(input.logVersion) !== snapshot.log.version) throw Error('HABIT_LOG_CHANGED');
                return { change: { kind: 'log', habitId: habit.id, habitVersion: habit.version,
                    logVersion: snapshot.log.version, value: validateRecordedValue(current, input.value), note: note(input.note) },
                    result: { saved: true, habitId: habit.id, day, version: snapshot.log.version + 1 } };
            }
            if (operation === 'update') {
                if (habit.archivedFrom !== null) throw Error('HABIT_ARCHIVED');
                const candidate = input.definition as Record<string, unknown> | null;
                const cadence = parseHabitCadence(candidate?.cadence), fromDay = habitChangeDay(day, current.cadence, cadence);
                const definition = parseHabitDefinition(input.definition, Math.max(current.commitmentFrom, fromDay));
                return { change: { kind: 'revision', habitId: habit.id, version: habit.version, revision: { fromDay, definition } },
                    result: { saved: true, habitId: habit.id, day, version: habit.version + 1, effectiveFrom: fromDay } };
            }
            if (operation === 'archive') {
                if (habit.archivedFrom !== null) throw Error('HABIT_ARCHIVED');
                const from = habitChangeDay(day, current.cadence, current.cadence);
                return { change: { kind: 'archive', habitId: habit.id, version: habit.version, from },
                    result: { saved: true, habitId: habit.id, day, version: habit.version + 1, effectiveFrom: from } };
            }
            if (habit.archivedFrom === null) throw Error('HABIT_NOT_ARCHIVED');
            if (habit.revisions.some(revision => revision.fromDay > day && revision.archivedFrom === null))
                throw Error('HABIT_CHANGED');
            if (snapshot.activeCount >= 30) throw Error('HABIT_LIMIT');
            const from = firstCommitmentDay(day, current.cadence);
            // Restore is future-facing; historical archived days remain immutable.
            return { change: { kind: 'revision', habitId: habit.id, version: habit.version,
                revision: { fromDay: from, definition: { ...current, commitmentFrom: from } } },
                result: { saved: true, habitId: habit.id, day, version: habit.version + 1, effectiveFrom: from } };
        });
    }
}
