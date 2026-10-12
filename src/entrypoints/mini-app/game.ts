import { D1GameStore } from '../../adapters/d1/game-store.ts';
import { PracticeService } from '../../application/practice-service.ts';
import { SCHOOLS, TECHNIQUES } from '../../domain/techniques.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

export async function readGame({ env, owner, now }: MiniAppContext, url: URL): Promise<Response> {
    if (url.pathname === '/api/game-catalog') return json({ schools: SCHOOLS, techniques: TECHNIQUES });
    const store = new D1GameStore(env.DB);
    if (url.pathname === '/api/practice-versions') {
        const techniqueId = url.searchParams.get('techniqueId');
        if (!techniqueId) throw Error('INVALID_TECHNIQUE');
        return json(await store.versions(owner, techniqueId, url.searchParams.get('before'), Number(url.searchParams.get('limit') ?? 20)));
    }
    // Opportunistic bounded closure, based only on already immutable outcomes.
    // No model calls or client-controlled clock/day and no chosen action added.
    await store.settle(owner, now, 1);
    return json({ now, ...await store.read(owner, now) });
}
export async function handleGame({ env, owner, now }: MiniAppContext, input: MiniAppInput): Promise<Response> {
    const { id, ...command } = input;
    return json(await new PracticeService(new D1GameStore(env.DB)).execute(owner, id, command, now));
}
