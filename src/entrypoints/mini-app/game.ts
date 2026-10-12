import { D1GameStore } from '../../adapters/d1/game-store.ts';
import { PracticeService } from '../../application/practice-service.ts';
import { BattleService } from '../../application/battle-service.ts';
import { D1BattleStore } from '../../adapters/d1/battle-store.ts';
import { GAME_BOSSES, GAME_CONTENT_VERSION } from '../../domain/game-content.ts';
import { SCHOOLS, TECHNIQUES } from '../../domain/techniques.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

export async function readGame({ env, owner, now }: MiniAppContext, url: URL): Promise<Response> {
    if (url.pathname === '/api/game-catalog') return json({ schools: SCHOOLS, techniques: TECHNIQUES, bosses: GAME_BOSSES.map(boss => ({ ...boss, pattern: undefined })), contentVersion: GAME_CONTENT_VERSION });
    const store = new D1GameStore(env.DB);
    const battles = new D1BattleStore(env.DB);
    if (url.pathname === '/api/battle-loadout') return json({ versions: await battles.availableLoadout(owner) });
    if (url.pathname === '/api/battle-history') return json(await battles.history(owner, url.searchParams.get('battleId') ?? '', Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER)));
    if (url.pathname === '/api/practice-versions') {
        const techniqueId = url.searchParams.get('techniqueId');
        if (!techniqueId) throw Error('INVALID_TECHNIQUE');
        return json(await store.versions(owner, techniqueId, url.searchParams.get('before'), Number(url.searchParams.get('limit') ?? 20)));
    }
    // Opportunistic bounded closure, based only on already immutable outcomes.
    // No model calls or client-controlled clock/day and no chosen action added.
    await store.settle(owner, now, 1);
    const game = await store.read(owner, now);
    return json({ now, ...game, ...await battles.overview(owner, game.day) });
}
export async function handleGame({ env, owner, now }: MiniAppContext, input: MiniAppInput): Promise<Response> {
    const { id, ...command } = input;
    return json(typeof command.operation === 'string' && command.operation.includes('battle')
        ? await new BattleService(new D1BattleStore(env.DB)).execute(owner, id, command, now)
        : await new PracticeService(new D1GameStore(env.DB)).execute(owner, id, command, now));
}
