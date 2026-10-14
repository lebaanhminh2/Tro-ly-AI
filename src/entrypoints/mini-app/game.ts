import { D1GameStore } from '../../adapters/d1/game-store.ts';
import { PracticeService } from '../../application/practice-service.ts';
import { BattleService } from '../../application/battle-service.ts';
import { D1BattleStore } from '../../adapters/d1/battle-store.ts';
import { D1GamePresetStore } from '../../adapters/d1/game-preset-store.ts';
import { GamePresetService } from '../../application/game-preset-service.ts';
import { GameExportService } from '../../application/game-export-service.ts';
import { D1GameExportStore } from '../../adapters/d1/game-export-store.ts';
import { bossById, GAME_CHAPTERS } from '../../domain/game-content.ts';
import { discoveredBoss, playerGameCatalog } from '../../domain/game-discovery.ts';
import { GAME_CHARACTERS } from '../../domain/game-characters.ts';
import { practicePresentation, practiceUpgrade } from '../../domain/practice-presentation.ts';
import type { PracticeForecastContext } from '../../domain/practice-progression.ts';
import type { StoredPractice } from '../../ports/game-store.ts';
import { techniqueById } from '../../domain/techniques.ts';
import { battleChoiceDetail } from '../../domain/battle.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

function presentPractice(value: StoredPractice | null, context: PracticeForecastContext = {}) {
    if (!value) return null;
    const derived = practicePresentation(value.practice, 100, context);
    const practice = value.practice.time ? { ...value.practice, time: { ...value.practice.time,
        periods: value.practice.time.periods.map(period => ({ ...period, members: [] })) } } : value.practice;
    return { ...value, practice, name: techniqueById(practice.techniqueId).name, ...derived };
}

export async function readGame({ env, owner, now }: MiniAppContext, url: URL): Promise<Response> {
    if (url.pathname === '/api/game-catalog') {
        const response = json(playerGameCatalog(await new D1BattleStore(env.DB).access(owner)));
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
    }
    if (url.pathname === '/api/game-export') {
        if (!/^\d+$/.test(url.searchParams.get('from') ?? '') || !/^\d+$/.test(url.searchParams.get('to') ?? '')) throw Error('INVALID_GAME_EXPORT');
        return json(await new GameExportService(new D1GameExportStore(env.DB))
            .read(owner, Number(url.searchParams.get('from')), Number(url.searchParams.get('to')), now));
    }
    if (url.pathname === '/api/game-presets') return json(await new D1GamePresetStore(env.DB).read(owner));
    if (url.pathname === '/api/game-victories') return json(await new D1BattleStore(env.DB).victories(owner));
    const store = new D1GameStore(env.DB);
    const battles = new D1BattleStore(env.DB);
    if (url.pathname === '/api/battle-choice') {
        const battleId = url.searchParams.get('battleId') ?? '';
        if (!/^[a-zA-Z0-9_-]{8,110}$/.test(battleId)) throw Error('INVALID_BATTLE_ID');
        const [battle, game] = await Promise.all([battles.readBattle(owner, battleId), store.read(owner, now)]);
        if (!battle) throw Error('BATTLE_NOT_FOUND');
        const response = json({ day: game.day.day, gameVersion: game.version, battleVersion: battle.version,
            ...battleChoiceDetail(battle.run.state, url.searchParams.get('techniqueId') ?? '') });
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
    }
    if (url.pathname === '/api/game-technique') {
        const techniqueId = url.searchParams.get('techniqueId') ?? '';
        const [access, overview] = await Promise.all([battles.access(owner), store.read(owner, now)]);
        const technique = playerGameCatalog(access).techniques.find(value => value.id === techniqueId);
        if (!technique) throw Error('INVALID_TECHNIQUE');
        if (technique.discovery === 'sealed') throw Error('TECHNIQUE_LOCKED');
        const result = await store.technique(owner, techniqueId, url.searchParams.get('versionId'));
        const context = { afterDay: overview.day.day, weeks: overview.audits };
        const response = json({ technique, selected: presentPractice(result.selected, context),
            versions: result.versions.map(value => presentPractice(value, context)),
            upgrade: practiceUpgrade(result.selected?.practice ?? null, techniqueId, 100, context) });
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
    }
    if (url.pathname === '/api/game-boss' || url.pathname === '/api/game-chapter') {
        const access = await battles.access(owner);
        const canEnter = (id: string) => { const boss = bossById(id); return boss.requires.every(value => access.victories.includes(value))
            && (boss.practicePrerequisites ?? []).every(value => access.learned.includes(value)); };
        if (url.pathname === '/api/game-boss') {
            const boss = bossById(url.searchParams.get('bossId') ?? '');
            if (!discoveredBoss(boss.id, access)) throw Error('BOSS_LOCKED');
            return json({ boss: { ...boss, rewards: undefined, pattern: undefined, enterable: canEnter(boss.id),
                victory: access.victories.includes(boss.id) ? boss.victory : undefined } });
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
        const page = await store.versions(owner, techniqueId, url.searchParams.get('before'), Number(url.searchParams.get('limit') ?? 20));
        return json({ ...page, versions: page.versions.map(value => presentPractice(value)) });
    }
    // Opportunistic bounded closure, based only on already immutable outcomes.
    // No model calls or client-controlled clock/day and no chosen action added.
    const started = performance.now();
    await store.settle(owner, now, 1);
    const settled = performance.now();
    const game = await store.read(owner, now);
    const read = performance.now();
    const battle = await battles.overview(owner, game.day);
    const context = { afterDay: game.day.day, weeks: game.audits };
    const response = json({ now, ...game, ...battle,
        currentPractice: presentPractice(game.currentPractice, context), pendingPractice: presentPractice(game.pendingPractice, context),
        audits: game.audits.map(({ key, habitId, startDay, endDay, quota, successes, misses, closedDay }) =>
            ({ key, habitId, startDay, endDay, quota, successes, misses, closedDay })) });
    response.headers.set('Server-Timing', `settle;dur=${(settled - started).toFixed(1)}, practice;dur=${(read - settled).toFixed(1)}, battle;dur=${(performance.now() - read).toFixed(1)}`);
    return response;
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
