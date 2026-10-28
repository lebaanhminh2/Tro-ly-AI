import { definitionOnDay, firstCommitmentDay, habitChangeDay, parseHabitCadence,
    parseHabitDefinition, validateRecordedValue } from '../domain/habits.ts';
import type { HabitSaved, HabitStore } from '../ports/habit-store.ts';
import { minutes } from '../domain/healthy.ts';
import { availableRanges } from '../domain/availability.ts';

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
            create: ['operation', 'definition', 'reminderTime'], update: ['operation', 'habitId', 'version', 'definition', 'reminderTime'],
            archive: ['operation', 'habitId', 'version'], restore: ['operation', 'habitId', 'version'],
            delete: ['operation', 'habitId', 'version'],
            reorder: ['operation', 'habitId', 'version', 'otherId', 'otherVersion'],
            defer: ['operation', 'habitId', 'version', 'day'], resume: ['operation', 'habitId', 'version', 'day'],
            log: ['operation', 'habitId', 'version', 'day', 'logVersion', 'value', 'note'],
            slot: ['operation', 'habitId', 'version', 'day', 'startAt', 'minutes'],
            remove_slot: ['operation', 'habitId', 'version', 'day'],
        };
        const operation = String(input.operation), allowed = fields[operation];
        if (!allowed || Object.keys(input).some(key => !allowed.includes(key))) throw Error('INVALID_HABIT_OPERATION');
        const reminderTime = input.reminderTime;
        if (reminderTime !== undefined && reminderTime !== null) {
            if (typeof reminderTime !== 'string') throw Error('INVALID_HABIT_REMINDER');
            minutes(reminderTime);
        }
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
                return { change: { kind: 'create', habitId, definition, reminderTime: reminderTime as string | null | undefined },
                    result: { saved: true, habitId, day, version: 1, effectiveFrom: definition.commitmentFrom } };
            }
            const habit = snapshot.habit;
            if (!habit) throw Error('HABIT_NOT_FOUND');
            if (habit.version !== version(input.version)) throw Error('HABIT_CHANGED');
            if (operation === 'reorder') {
                const other = snapshot.otherHabit;
                if (typeof input.otherId !== 'string' || input.otherId === habit.id || !/^[a-zA-Z0-9_-]{8,110}$/.test(input.otherId)) throw Error('INVALID_HABIT_ID');
                if (!other) throw Error('HABIT_NOT_FOUND');
                if (other.version !== version(input.otherVersion)) throw Error('HABIT_CHANGED');
                return { change: { kind: 'reorder', habitId: habit.id, version: habit.version, otherId: other.id, otherVersion: other.version },
                    result: { saved: true, habitId: habit.id, day, version: habit.version + 1, otherHabitId: other.id, otherVersion: other.version + 1 } };
            }
            const current = definitionOnDay(habit, day)?.definition;
            if (!current) throw Error('HABIT_NOT_FOUND');
            if (operation === 'defer' || operation === 'resume') {
                if (input.day !== day) throw Error('HABIT_DAY_CLOSED');
                if (habit.archivedFrom !== null) throw Error('HABIT_ARCHIVED');
                if (operation === 'defer' && (current.cadence.kind !== 'weekly' || snapshot.log.value >= current.target)) throw Error('INVALID_HABIT_DEFER');
                return { change: { kind: 'presentation', habitId: habit.id, version: habit.version, choice: operation === 'defer' ? 'deferred' : 'included' }, result: { saved: true, habitId: habit.id, day, version: habit.version + 1 } };
            }
            if (operation === 'delete') {
                if (habit.archivedFrom !== null) return { change: { kind: 'remove', habitId: habit.id, version: habit.version }, result: { saved: true, habitId: habit.id, day, version: habit.version + 1 } };
                const from = habit.archivedFrom ?? habitChangeDay(day, current.cadence, current.cadence);
                return { change: { kind: 'archive', habitId: habit.id, version: habit.version, from }, result: { saved: true, habitId: habit.id, day, version: habit.version + 1, effectiveFrom: from } };
            }
            if (operation === 'slot' || operation === 'remove_slot') {
                if (input.day !== day) throw Error('HABIT_DAY_CLOSED');
                if (operation === 'slot') {
                    if (habit.archivedFrom !== null && day >= habit.archivedFrom) throw Error('HABIT_ARCHIVED');
                    if (snapshot.log.value >= current.target) throw Error('HABIT_ALREADY_MET');
                    const at = Number(input.startAt), duration = Number(input.minutes);
                    if (typeof input.startAt !== 'number' || typeof input.minutes !== 'number' || !Number.isSafeInteger(at) || at % 300000 !== 0 ||
                        !Number.isInteger(duration) || duration < 5 || duration > 240 || duration % 5 !== 0) throw Error('INVALID_HABIT_SLOT');
                    const ranges = availableRanges(snapshot.schedule?.free ?? [], snapshot.schedule?.occupied ?? [], now);
                    if (!ranges.some(range => at >= range.start && at + duration * 60000 <= range.end)) throw Error('HABIT_SLOT_CONFLICT');
                }
                return { change: { kind: 'slot', habitId: habit.id, version: habit.version,
                    startAt: operation === 'slot' ? Number(input.startAt) : null, minutes: operation === 'slot' ? Number(input.minutes) : null },
                    result: { saved: true, habitId: habit.id, day, version: habit.version + 1 } };
            }
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
                return { change: { kind: 'revision', habitId: habit.id, version: habit.version, revision: { fromDay, definition }, reminderTime: reminderTime as string | null | undefined },
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
