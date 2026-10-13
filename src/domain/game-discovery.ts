import { GAME_BOSSES, publicGameCatalog } from './game-content.ts';
import { INITIAL_TECHNIQUES } from './techniques.ts';

export type GameAccess = { victories: string[]; learned: string[]; owned: string[] };
export type DiscoveryStage = 'sealed' | 'discovered' | 'unlocked';
// Presentation only: stable encounter IDs and battle entry prerequisites remain
// unchanged. Acquired rights and editions never become hidden for old players.
export function discoveredBoss(id: string, access: GameAccess): boolean {
    const boss = GAME_BOSSES.find(boss => boss.id === id);
    return !!boss && (access.victories.includes(id) || boss.unlocks.some(technique =>
        access.owned.includes(technique) || access.learned.includes(technique)) ||
        boss.requires.every(prior => access.victories.includes(prior)));
}
export function playerGameCatalog(access: GameAccess) {
    const catalog = publicGameCatalog(), main = GAME_BOSSES.filter(boss => !boss.kind || boss.kind === 'main');
    const hiddenNames = GAME_BOSSES.filter(boss => !discoveredBoss(boss.id, access)).map(boss => boss.name);
    const floorOf = (id: string): number | null => { const index = main.findIndex(boss => boss.id === id); return index < 0 ? null : index + 1; };
    // A clue can name an upcoming main floor, but never an undiscovered side
    // opponent, technique, tactical identity or reward source.
    function clueFloor(ids: string[]): number | null {
        const seen = new Set<string>(), floors: number[] = [];
        const visit = (id: string) => {
            if (seen.has(id)) return; seen.add(id);
            const floor = floorOf(id);
            if (floor !== null) { floors.push(floor); return; }
            GAME_BOSSES.find(boss => boss.id === id)?.requires.forEach(visit);
        };
        ids.forEach(id => GAME_BOSSES.find(boss => boss.id === id)?.requires.forEach(visit));
        return floors.length ? Math.max(...floors) : null;
    }
    return { ...catalog, access: { owned: [...new Set([...INITIAL_TECHNIQUES, ...access.owned])].sort(),
        learned: [...new Set(access.learned)].sort(), victories: [...new Set(access.victories)].sort() },
        chapters: catalog.chapters.map(chapter => discoveredBoss(chapter.encounters[0]!, access)
            ? chapter : { ...chapter, name: 'Chương chưa mở', scene: null }),
        achievements: catalog.achievements.map(achievement => ({ ...achievement,
            description: hiddenNames.reduce((text, name) => text.replaceAll(name, 'đối thủ chưa gặp'), achievement.description) })),
        weapons: [], techniques: catalog.techniques.map(technique => {
        const owned = INITIAL_TECHNIQUES.includes(technique.id) || access.owned.includes(technique.id) || access.learned.includes(technique.id);
        const special = technique.kind === 'forbidden' || technique.kind === 'outside';
        const visible = owned || !special || technique.sources.some(id => discoveredBoss(id, access));
        const discovery: DiscoveryStage = owned ? 'unlocked' : visible ? 'discovered' : 'sealed';
        return { ...technique, ...(visible ? {} : { name: 'Bí tịch chưa phát hiện', description: '', identity: '', combatWarning: null,
            sources: [], trainingFactor: 0 }), discovery, clue: { floor: clueFloor(technique.sources) } };
    }), bosses: catalog.bosses.map(boss => {
        const visible = discoveredBoss(boss.id, access), discovery: DiscoveryStage = access.victories.includes(boss.id) ? 'unlocked' : visible ? 'discovered' : 'sealed';
        return { ...boss, ...(visible ? {} : { name: 'Đối thủ chưa gặp', mechanics: '', artId: null,
            practicePrerequisites: [], recommendedRank: 0, maxTurns: 0 }), discovery,
            floor: floorOf(boss.id), clue: { floor: clueFloor([boss.id]) } };
    }) };
}
