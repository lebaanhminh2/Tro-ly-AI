import type { EquippedTechnique } from '../domain/battle.ts';
import type { GamePreset } from '../domain/game-presets.ts';
export type GamePresetSaved = { saved: true; version: number; presetId: string; deleted: boolean };
export type GamePresetSnapshot = { version: number; presets: GamePreset[]; available: EquippedTechnique[]; ownedWeapons: string[] };
export interface GamePresetStore {
    read(owner: string): Promise<{ version: number; presets: GamePreset[] }>;
    mutate(owner: string, id: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: GamePresetSnapshot) => { preset: GamePreset; deleted: boolean; result: GamePresetSaved }): Promise<GamePresetSaved>;
}
