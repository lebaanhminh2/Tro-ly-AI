import { writeFileSync } from 'node:fs';
import { resolveBattleTurn, type BattleState } from '../src/domain/battle.ts';
import { GAME_BOSSES, GAME_CONTENT_VERSION, bossIntents } from '../src/domain/game-content.ts';
import { armedBattleState } from '../src/domain/game-rewards.ts';
import { fighterForRank } from '../src/domain/battle-economy.ts';
import { TECHNIQUES } from '../src/domain/techniques.ts';

export function repeatTactic(before: BattleState, id: string, habits: number) {
    let state = before, sacrifices = 0, casts = 0, fallback = 0;
    while (state.status === 'active') {
        let result;
        try { result = resolveBattleTurn(state, { techniqueId: id, acceptCost: true, contribution: { habits, tasks: 0 } }); casts++; }
        catch (error) {
            if (!(error instanceof Error) || !['BATTLE_INSUFFICIENT_HP', 'BATTLE_TECHNIQUE_COOLDOWN'].includes(error.message)) throw error;
            result = resolveBattleTurn(state, { techniqueId: 'vo-ky', acceptCost: false, contribution: { habits, tasks: 0 } }); fallback++;
        }
        sacrifices += result.entries.filter(entry => entry.kind === 'cost').reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
        state = result.state;
    }
    return { won: state.status === 'won', status: state.status, turns: state.turn, hp: state.player.hp,
        bossHp: state.boss.hp, casts, fallback, sacrifices, statuses: state.statuses.length };
}

export function simulateRepeatedTactics() {
    const cases = [];
    for (const boss of GAME_BOSSES) for (const purityBp of [6000, 10000]) for (const id of ['vo-ky', ...TECHNIQUES.map(value => value.id)]) {
        const tier = boss.chapter <= 3 ? 1 : boss.chapter <= 9 ? 2 : 3;
        const state = armedBattleState(fighterForRank(boss.recommendedRank), boss,
            id === 'vo-ky' ? [] : [{ id, versionId: 'tactic_' + id, tier, purityBp }], bossIntents(boss), null);
        cases.push({ boss: boss.id, chapter: boss.chapter, technique: id, tier, purityBp, ...repeatTactic(state, id, 300) });
    }
    const summary = ['vo-ky', ...TECHNIQUES.map(value => value.id)].map(id => ({ technique: id,
        results: [6000, 10000].map(purityBp => {
            const values = cases.filter(value => value.technique === id && value.purityBp === purityBp);
            return { purityBp, wins: values.filter(value => value.won).length,
                mainWins: values.filter(value => value.won && (!GAME_BOSSES.find(boss => boss.id === value.boss)!.kind || GAME_BOSSES.find(boss => boss.id === value.boss)!.kind === 'main')).length,
                finalWins: values.filter(value => value.won && value.chapter === 15).map(value => value.boss),
                total: values.length, maxTurns: Math.max(...values.map(value => value.turns)), maxStatuses: Math.max(...values.map(value => value.statuses)) };
        }) }));
    return { contentVersion: GAME_CONTENT_VERSION, fixture: 'standalone repeated cast, basic fallback only for cooldown/HP affordability, granted edition tier1 chapters1–3/tier2 chapters4–9/tier3 chapters10–15, purity6000/10000, recommended rank, one habit bonus300 every turn; no weapon/tasks/rescue/grants proof; detects simple repetition and defensive timeouts, not all combos or earned balance',
        total: cases.length, summary, candidates: summary.filter(value => value.results.some(result => result.mainWins >= 20 && result.finalWins.length === 3)), cases };
}

if (process.argv[1]?.endsWith('simulate-game-tactics.ts')) {
    const result = simulateRepeatedTactics(), index = process.argv.indexOf('--output');
    if (index >= 0) { const output = process.argv[index + 1]; if (!output) throw Error('MISSING_OUTPUT'); writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8'); }
    console.log(JSON.stringify({ total: result.total, candidates: result.candidates, summary: result.summary }, null, 2));
}
