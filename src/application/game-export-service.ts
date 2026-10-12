import type { GameExportStore } from '../ports/game-export-store.ts';

export const GAME_EXPORT_MAX_BYTES = 2 * 1024 * 1024;
export class GameExportService {
    private store: GameExportStore;
    constructor(store: GameExportStore) { this.store = store; }
    async read(owner: string, from: number, to: number, now: number) {
        if (!/^\d+$/.test(owner) || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from
            || to - from >= 366 || to > Math.floor((now + 25200000) / 86400000) + 1) throw Error('INVALID_GAME_EXPORT');
        const snapshot = await this.store.read(owner, from, to);
        const result = { format: 'assistant-than-lo', version: 1, exportedAt: new Date(now).toISOString(),
            range: { from, to, inclusive: true, basis: 'operating-day' },
            scope: 'saved-profile-and-editions-with-journal-in-range', ...snapshot };
        if (new TextEncoder().encode(JSON.stringify(result)).byteLength > GAME_EXPORT_MAX_BYTES) throw Error('GAME_EXPORT_TOO_LARGE');
        return result;
    }
}
