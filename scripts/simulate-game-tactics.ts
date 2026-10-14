import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveBattleTurn, type BattleState } from '../src/domain/battle.ts';
import { GAME_BOSSES, GAME_CONTENT_VERSION, bossIntents, bossForNewBattle } from '../src/domain/game-content.ts';
import { armedBattleState } from '../src/domain/game-rewards.ts';
import { fighterForRank } from '../src/domain/battle-economy.ts';
import { TECHNIQUES } from '../src/domain/techniques.ts';
import { purityGrade } from '../src/domain/practice-progression.ts';

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

export function simulateRepeatedTactics(v2 = false) {
    const cases: ({ boss: string; chapter: number; technique: string; tier: number; purityBp: number } & ReturnType<typeof repeatTactic>)[] = [];
    for (const original of GAME_BOSSES) for (const purityBp of [6000, 10000]) for (const id of ['vo-ky', ...TECHNIQUES.map(value => value.id)])
        for (const tier of v2 ? [1, 2, 3, 4] : [original.chapter <= 3 ? 1 : original.chapter <= 9 ? 2 : 3]) {
        const boss = v2 ? bossForNewBattle(original.id) : original;
        const totalPurityBp = purityBp * tier / 4;
        const strength = v2 ? { rule: 'practice-v2' as const,
            damageFactorMilli: 400 + Math.floor(600 * purityBp / 10000) + (tier - 1) * Math.floor(180 * purityBp / 10000),
            effectFactorMilli: 1000 + (tier - 1) * 180, totalPurityBp, gradeBonusMilli: purityGrade(totalPurityBp)?.bonusMilli ?? 0 } : null;
        const state = armedBattleState(fighterForRank(boss.recommendedRank), boss,
            id === 'vo-ky' ? [] : [{ id, versionId: 'tactic_' + id, tier, purityBp, ...(strength ? { strength } : {}) }], bossIntents(boss), null, v2 ? 'battle-v2' : 'battle-v1');
        cases.push({ boss: boss.id, chapter: boss.chapter, technique: id, tier, purityBp, ...repeatTactic(state, id, 300) });
    }
    const summary = ['vo-ky', ...TECHNIQUES.map(value => value.id)].map(id => ({ technique: id,
        results: [6000, 10000].flatMap(purityBp => (v2 ? [1, 2, 3, 4] : [null]).map(tier => {
            const values = cases.filter(value => value.technique === id && value.purityBp === purityBp && (tier === null || value.tier === tier));
            return { purityBp, ...(tier ? { tier } : {}), wins: values.filter(value => value.won).length,
                mainWins: values.filter(value => value.won && (!GAME_BOSSES.find(boss => boss.id === value.boss)!.kind || GAME_BOSSES.find(boss => boss.id === value.boss)!.kind === 'main')).length,
                finalWins: values.filter(value => value.won && value.chapter === 15).map(value => value.boss),
                total: values.length, maxTurns: Math.max(...values.map(value => value.turns)), maxStatuses: Math.max(...values.map(value => value.statuses)) };
        })) }));
    return { contentVersion: GAME_CONTENT_VERSION, rule: v2 ? 'battle-v2' : 'battle-v1', fixture: v2
        ? 'Inspection fixtures for all four tiers, equal per-period ratios6000/10000 with inherited Q=tier*ratio/4 and production grade. Recommended rank, habit bonus300 every turn, no weapons/tasks/rescue. Repetition/fallback probe, not earned progression or proof of all combo balance.'
        : 'standalone repeated cast, basic fallback only for cooldown/HP affordability, granted edition tier1 chapters1–3/tier2 chapters4–9/tier3 chapters10–15, purity6000/10000, recommended rank, one habit bonus300 every turn; no weapon/tasks/rescue/grants proof; detects simple repetition and defensive timeouts, not all combos or earned balance',
        total: cases.length, summary, candidates: summary.filter(value => value.results.some(result => result.mainWins >= 20 && result.finalWins.length === 3)), cases };
}

if (process.argv[1]?.endsWith('simulate-game-tactics.ts')) {
    const result = simulateRepeatedTactics(process.argv.includes('--v2')), index = process.argv.indexOf('--output');
    const sources = ['scripts/simulate-game-tactics.ts', 'src/domain/battle.ts', 'src/domain/battle-techniques.ts',
        'src/domain/technique-profile.ts', 'src/domain/game-content.ts', 'src/domain/game-balance.ts'].map(file =>
        ({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }));
    if (index >= 0) { const output = process.argv[index + 1]; if (!output) throw Error('MISSING_OUTPUT'); writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), sources, ...result }, null, 2) + '\n', 'utf8'); }
    console.log(JSON.stringify({ total: result.total, candidates: result.candidates, summary: result.summary }, null, 2));
}
