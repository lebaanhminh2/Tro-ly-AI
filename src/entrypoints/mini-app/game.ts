import { D1GameStore } from '../../adapters/d1/game-store.ts';
import { PracticeService } from '../../application/practice-service.ts';
import { BattleService } from '../../application/battle-service.ts';
import { D1BattleStore } from '../../adapters/d1/battle-store.ts';
import { D1GamePresetStore } from '../../adapters/d1/game-preset-store.ts';
import { GamePresetService } from '../../application/game-preset-service.ts';
import { bossById, GAME_CHAPTERS, publicGameCatalog } from '../../domain/game-content.ts';
import { GAME_CHARACTERS } from '../../domain/game-characters.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

export async function readGame({ env, owner, now }: MiniAppContext, url: URL): Promise<Response> {
    if (url.pathname === '/api/game-catalog') return json(publicGameCatalog());
    if (url.pathname === '/api/game-presets') return json(await new D1GamePresetStore(env.DB).read(owner));
    const store = new D1GameStore(env.DB);
    const battles = new D1BattleStore(env.DB);
    if (url.pathname === '/api/game-boss' || url.pathname === '/api/game-chapter') {
        const game = await store.read(owner, now), access = await battles.overview(owner, game.day);
        const canEnter = (id: string) => { const boss = bossById(id); return boss.requires.every(value => access.victories.includes(value))
            && (boss.practicePrerequisites ?? []).every(value => access.learned.includes(value)); };
        if (url.pathname === '/api/game-boss') {
            const boss = bossById(url.searchParams.get('bossId') ?? '');
            if (!canEnter(boss.id)) throw Error('BOSS_LOCKED');
            return json({ boss: { ...boss, pattern: undefined, victory: access.victories.includes(boss.id) ? boss.victory : undefined } });
        }
        const chapter = GAME_CHAPTERS.find(value => value.number === Number(url.searchParams.get('chapter')));
        if (!chapter) throw Error('INVALID_GAME_CHAPTER');
        if (!canEnter(chapter.encounters[0]!)) throw Error('BOSS_LOCKED');
        return json({ chapter: { ...chapter, conclusion: chapter.encounters.every(id => access.victories.includes(id)) ? chapter.conclusion : undefined },
            characters: GAME_CHARACTERS.filter(character => chapter.characters.includes(character.id)) });
    }
    if (url.pathname === '/api/battle-loadout') {
        const ids = url.searchParams.getAll('versionId');
        return json({ versions: ids.length ? await battles.resolveLoadout(owner, ids) : await battles.availableLoadout(owner) });
    }
    if (url.pathname === '/api/battles') return json(await battles.list(owner, url.searchParams.get('before'), Number(url.searchParams.get('limit') ?? 20)));
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
export async function handleGamePresets({ env, owner, now }: MiniAppContext, input: MiniAppInput): Promise<Response> {
    const { id, ...command } = input;
    return json(await new GamePresetService(new D1GamePresetStore(env.DB)).execute(owner, id, command, now));
}
