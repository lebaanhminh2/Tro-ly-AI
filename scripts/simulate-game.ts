import { writeFileSync } from 'node:fs';
import { newBattleState, resolveBattleTurn, type BattleState } from '../src/domain/battle.ts';
import { fighterForRank } from '../src/domain/battle-economy.ts';
import { bossIntents, GAME_BOSSES, GAME_CONTENT_VERSION, validateGameContent } from '../src/domain/game-content.ts';
import { SCHOOLS, TECHNIQUES } from '../src/domain/techniques.ts';

// Offline fixture search using production rules. It grants already learned
// versions to compare tactics; it does not establish the real unlock journey.
export function searchBattle(state: BattleState, habits: number, width = 64) {
    type Candidate = { state: BattleState; sequence: string[] };
    const score = (candidate: Candidate) => -candidate.state.boss.hp * 3 + candidate.state.player.hp
        + candidate.state.statuses.filter(status => status.target === 'boss').reduce((sum, status) => sum + status.value, 0) * .6
        + candidate.state.guard * candidate.state.player.attack * .2 + (candidate.state.illusion ? 15 : 0);
    let beam: Candidate[] = [{ state, sequence: [] }];
    for (let turn = 0; turn < state.maxTurns; turn++) {
        const next: Candidate[] = [], won: Candidate[] = [], seen = new Set<string>();
        for (const candidate of beam) for (const id of ['vo-ky', ...candidate.state.loadout.map(skill => skill.id)]) {
            try {
                const result = resolveBattleTurn(candidate.state, { techniqueId: id, acceptCost: true, contribution: { habits, tasks: 0 } });
                const value = { state: result.state, sequence: [...candidate.sequence, id] };
                if (result.state.status === 'won') won.push(value);
                else if (result.state.status === 'active') {
                    const key = JSON.stringify(result.state);
                    if (!seen.has(key)) { seen.add(key); next.push(value); }
                }
            } catch (error) {
                if (!(error instanceof Error) || !['BATTLE_INSUFFICIENT_HP', 'BATTLE_TECHNIQUE_COOLDOWN'].includes(error.message)) throw error;
            }
        }
        if (won.length) return won.sort((a, b) => b.state.player.hp - a.state.player.hp)[0]!;
        beam = next.sort((a, b) => score(b) - score(a)).slice(0, width);
        if (!beam.length) break;
    }
    return null;
}

export function simulateOpening() {
    validateGameContent();
    const cases = [];
    for (const school of SCHOOLS) for (const boss of GAME_BOSSES.filter(boss => boss.chapter === 1))
        for (const purityBp of [6000, 10000]) for (const habits of [0, 300]) {
            const loadout = TECHNIQUES.filter(technique => technique.school === school.id && technique.kind === 'ordinary')
                .map(technique => ({ id: technique.id, versionId: 'fixture_' + technique.id, tier: 1, purityBp }));
            const result = searchBattle(newBattleState(fighterForRank(boss.recommendedRank), boss.fighter, loadout, bossIntents(boss), boss.maxTurns, boss.revival), habits);
            cases.push({ school: school.id, boss: boss.id, rank: boss.recommendedRank, tier: 1, purityBp, habits,
                won: !!result, turns: result?.state.turn ?? null, hp: result?.state.player.hp ?? null, sequence: result?.sequence ?? [] });
        }
    return { contentVersion: GAME_CONTENT_VERSION, rule: 'battle-v1', fixture: 'four ordinary techniques, tier 1, recommended rank; no rescue, tasks or weapon',
        total: cases.length, wins: cases.filter(result => result.won).length,
        failures: cases.filter(result => !result.won), cases };
}

if (process.argv[1]?.endsWith('simulate-game.ts')) {
    const result = simulateOpening(), output = process.argv.indexOf('--output');
    if (output >= 0) {
        if (!process.argv[output + 1]) throw Error('MISSING_SIMULATION_OUTPUT');
        writeFileSync(process.argv[output + 1]!, JSON.stringify(result, null, 2) + '\n', 'utf8');
    }
    console.log(JSON.stringify({ total: result.total, wins: result.wins, failures: result.failures }, null, 2));
}
