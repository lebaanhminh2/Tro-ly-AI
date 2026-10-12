export const GAME_PRESET_LIMIT = 6;
export type GamePreset = { id: string; name: string; versions: string[]; weaponId: string | null };
export function presetVersionIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 5 || value.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(id)) ||
        new Set(value).size !== value.length) throw Error('INVALID_GAME_PRESET');
    return [...value] as string[];
}
export function presetName(value: unknown): string {
    if (typeof value !== 'string' || value.length > 50 || !value.trim() || /[\u0000-\u001F\u007F]/.test(value)) throw Error('INVALID_GAME_PRESET');
    return value.trim();
}
