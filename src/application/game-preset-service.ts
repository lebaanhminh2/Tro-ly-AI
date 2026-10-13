import { GAME_PRESET_LIMIT, presetName, presetVersionIds } from '../domain/game-presets.ts';
import { battleWeapon } from '../domain/game-rewards.ts';
import type { GamePresetSaved, GamePresetStore } from '../ports/game-preset-store.ts';

export class GamePresetService {
    private store: GamePresetStore;
    constructor(store: GamePresetStore) { this.store = store; }
    execute(owner: string, id: string, input: Record<string, unknown>, now: number): Promise<GamePresetSaved> {
        const deleted = input.operation === 'delete';
        if (!['save', 'delete'].includes(String(input.operation)) || Object.keys(input).some(key => !(deleted
            ? ['operation', 'version', 'presetId'] : ['operation', 'version', 'presetId', 'name', 'versions', 'weaponId']).includes(key)) ||
            !Number.isSafeInteger(input.version) || Number(input.version) < 0) throw Error('INVALID_GAME_PRESET');
        if ((deleted || input.presetId !== undefined) && (typeof input.presetId !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(input.presetId))) throw Error('INVALID_GAME_PRESET');
        const versions = deleted ? [] : presetVersionIds(input.versions), name = deleted ? '' : presetName(input.name), weaponId = input.weaponId ?? null;
        if (!deleted && weaponId !== null) { if (typeof weaponId !== 'string') throw Error('INVALID_GAME_WEAPON'); battleWeapon(weaponId); }
        return this.store.mutate(owner, id, input, now, snapshot => {
            if (input.version !== snapshot.version) throw Error('GAME_PRESETS_CHANGED');
            const prior = snapshot.presets.find(preset => preset.id === input.presetId);
            if ((deleted || input.presetId !== undefined) && !prior) throw Error('GAME_PRESET_NOT_FOUND');
            if (!deleted) {
                if (!prior && snapshot.presets.length >= GAME_PRESET_LIMIT) throw Error('GAME_PRESET_LIMIT');
                if (snapshot.available.length !== versions.length || new Set(snapshot.available.map(skill => skill.id)).size !== versions.length) throw Error('INVALID_BATTLE_LOADOUT');
            }
            // Accept known legacy weapon fields when re-saving an old set, but
            // new and edited sets contain only techniques. Unedited rows survive.
            const preset = prior && deleted ? prior : { id: prior?.id ?? 'set_' + id, name, versions, weaponId: null };
            return { preset, deleted, result: { saved: true, version: snapshot.version + 1, presetId: preset.id, deleted } };
        });
    }
}
