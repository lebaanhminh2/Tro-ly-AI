import { newPracticeVersion } from '../domain/practice.ts';
import { techniqueById } from '../domain/techniques.ts';
import type { GameSaved, GameSelection, GameStore } from '../ports/game-store.ts';

export class PracticeService {
    private store: GameStore;
    constructor(store: GameStore) { this.store = store; }
    execute(owner: string, id: string, input: Record<string, unknown>, now: number): Promise<GameSaved> {
        const operation = input.operation;
        const fields: Record<string, string[]> = {
            start_practice: ['operation', 'day', 'version', 'techniqueId', 'confirmRestart'],
            continue_practice: ['operation', 'day', 'version', 'practiceId'],
            stop_practice: ['operation', 'day', 'version'],
        };
        if (typeof operation !== 'string' || !fields[operation] || Object.keys(input).some(key => !fields[operation]!.includes(key)))
            throw Error('INVALID_GAME_OPERATION');
        if (!Number.isSafeInteger(input.day) || !Number.isSafeInteger(input.version) || Number(input.version) < 0)
            throw Error('INVALID_GAME_VERSION');
        if (operation === 'start_practice') {
            if (typeof input.techniqueId !== 'string' || input.confirmRestart !== undefined && typeof input.confirmRestart !== 'boolean')
                throw Error('INVALID_TECHNIQUE');
            techniqueById(input.techniqueId);
        }
        if (operation === 'continue_practice' && (typeof input.practiceId !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(input.practiceId)))
            throw Error('INVALID_PRACTICE_ID');
        return this.store.mutate(owner, id, input, now, snapshot => {
            if (input.day !== snapshot.day.day) throw Error('GAME_DAY_CLOSED');
            if (input.version !== snapshot.version) throw Error('GAME_CHANGED');
            if (snapshot.current.mode === 'battle' || snapshot.pending?.mode === 'battle') throw Error('BATTLE_ACTIVE');
            let practice = null, practiceId: string | null = null;
            if (operation === 'start_practice') {
                const technique = techniqueById(input.techniqueId as string);
                if (!snapshot.owned.includes(technique.id)) throw Error('TECHNIQUE_LOCKED');
                if (snapshot.priorVersions && input.confirmRestart !== true) throw Error('CONFIRM_PRACTICE_RESTART');
                if (snapshot.createdToday >= 7) throw Error('PRACTICE_DAILY_LIMIT');
                practiceId = 'p_' + id;
                practice = newPracticeVersion(practiceId, technique.id, snapshot.day.day, technique.trainingFactor, snapshot.priorVersions + 1);
            }
            if (operation === 'continue_practice') {
                const stored = snapshot.requestedPractice;
                if (!stored) throw Error('PRACTICE_NOT_FOUND');
                if (stored.practice.tiers.length >= 4) throw Error('PRACTICE_COMPLETE');
                practiceId = stored.practice.id;
            }
            const selection: GameSelection = { fromDay: snapshot.day.day + 1,
                mode: practiceId ? 'practice' : 'idle', practiceId, battleId: null };
            return { change: { selection, practice }, result: { saved: true, version: snapshot.version + 1,
                effectiveFrom: selection.fromDay, practiceId } };
        });
    }
}
