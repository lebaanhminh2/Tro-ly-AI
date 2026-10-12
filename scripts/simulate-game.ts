import { writeFileSync } from 'node:fs';
import { newBattleState, resolveBattleTurn, type BattleState } from '../src/domain/battle.ts';
import { assessSleep, breakthrough, claimDailyReward, dailyCheckinProgress, dayWindow, initialHealthy, REALMS } from '../src/domain/healthy.ts';
import { assessHabitDay, newHabitPeriod, parseHabitDefinition } from '../src/domain/habits.ts';
import { newPracticeVersion, settlePracticeDay, type PracticeVersion } from '../src/domain/practice.ts';
import { earnedBattleRewards } from '../src/domain/game-rewards.ts';
import { fighterForRank } from '../src/domain/battle-economy.ts';
import { bossIntents, GAME_BOSSES, GAME_CONTENT_VERSION, validateGameContent } from '../src/domain/game-content.ts';
import { SCHOOLS, TECHNIQUES, INITIAL_TECHNIQUES, techniqueById, type SchoolId } from '../src/domain/techniques.ts';

// Offline fixture search using production rules. It grants already learned
// versions to compare tactics; it does not establish the real unlock journey.
export function searchBattle(state: BattleState, habits: number | number[], width = 64) {
    type Candidate = { state: BattleState; sequence: string[] };
    const score = (candidate: Candidate) => -candidate.state.boss.hp * 3 + candidate.state.player.hp
        + candidate.state.statuses.filter(status => status.target === 'boss').reduce((sum, status) => sum + status.value, 0) * .6
        + candidate.state.guard * candidate.state.player.attack * .2 + (candidate.state.illusion ? 15 : 0);
    let beam: Candidate[] = [{ state, sequence: [] }];
    for (let turn = 0; turn < state.maxTurns; turn++) {
        const next: Candidate[] = [], won: Candidate[] = [], seen = new Set<string>();
        for (const candidate of beam) for (const id of ['vo-ky', ...candidate.state.loadout.map(skill => skill.id)]) {
            try {
                const bonus = typeof habits === 'number' ? habits : habits[turn % habits.length];
                const result = resolveBattleTurn(candidate.state, { techniqueId: id, acceptCost: true, contribution: { habits: bonus!, tasks: 0 } });
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

export function simulateCampaign() {
    validateGameContent();
    const cases = [];
    const profiles = [
        { name: 'one-100', contributions: [300] },
        { name: 'one-80', contributions: [300, 300, 0, 300, 300] },
        { name: 'one-60', contributions: [300, 0, 300, 0, 300] },
        { name: 'six-80', contributions: [600, 600, 0, 600, 600] },
    ];
    for (const school of SCHOOLS) for (const boss of GAME_BOSSES) for (const purityBp of [6000, 10000]) for (const profile of profiles) {
        const tier = boss.chapter <= 3 ? 1 : boss.chapter <= 9 ? 2 : 3;
        const loadout = TECHNIQUES.filter(technique => technique.school === school.id)
            .map(technique => ({ id: technique.id, versionId: 'fixture_' + technique.id, tier, purityBp }));
        const result = searchBattle(newBattleState(fighterForRank(boss.recommendedRank), boss.fighter, loadout, bossIntents(boss), boss.maxTurns, boss.revival), profile.contributions, 48);
        cases.push({ school: school.id, boss: boss.id, chapter: boss.chapter, rank: boss.recommendedRank, tier, purityBp, profile: profile.name,
            won: !!result, turns: result?.state.turn ?? null, hp: result?.state.player.hp ?? null, sequence: result?.sequence ?? [] });
    }
    return { contentVersion: GAME_CONTENT_VERSION, rule: 'battle-v1', fixture: 'five school techniques granted; tier1 chapters1-3, tier2 chapters4-9, tier3 chapters10-15; recommended rank; no rescue/tasks/weapon; contribution profiles are exogenous, not proof of earned purity or unlock traversal',
        total: cases.length, wins: cases.filter(result => result.won).length, failures: cases.filter(result => !result.won), cases };
}

// Fresh state, only production domain transitions. No administrative grants:
// rights come from victories, versions from settled habit days, rank from the
// existing sleep/checkin/breakthrough economy. Persistence is tested separately.
export function simulateEarnedJourney(schoolId: SchoolId, collection = false) {
    let day = 20738, healthy = initialHealthy(), versions: PracticeVersion[] = [];
    const startedDay = day, owned = new Set(INITIAL_TECHNIQUES), victories = new Set<string>(), achievements = new Set<string>(), weapons = new Set<string>();
    const definition = parseHabitDefinition({ name: 'Journey fixture', metric: 'check', target: 1, cadence: { kind: 'daily' } }, day + 1);
    const events: { boss: string; day: number; rank: number; turns: number; versions: string[]; unlocks: string[]; hp: number; learned: string[] }[] = [];
    const transitions: { day: number; kind: string; id?: string }[] = [];
    let practiceId: string | null = null;
    let pendingPractice: { id: string | null; fromDay: number } | null = null;
    function closeDay() {
        if (pendingPractice && pendingPractice.fromDay <= day) { practiceId = pendingPractice.id; pendingPractice = null; }
        const window = dayWindow(day, 330, 1395), checkin = dailyCheckinProgress(healthy, window.start + 2 * 3600000);
        if (checkin.canClaim) healthy = claimDailyReward(healthy, window.start + 2 * 3600000).state;
        const habit = assessHabitDay(definition, day, day >= definition.commitmentFrom ? 100 : 0, newHabitPeriod(definition, day));
        const outcome = settlePracticeDay(day, practiceId, versions, [], [{ habitId: 'journey_habit',
            successes: habit.successes, misses: habit.misses, mature: day - definition.commitmentFrom >= 7, weekly: null }]);
        versions = outcome.versions;
        for (const locked of outcome.locked) transitions.push({ day, kind: 'tier:' + locked.tier, id: locked.versionId });
        healthy = assessSleep(healthy, { day, target: window.target, end: window.end, reportedAt: window.target - 60000,
            chatActive: true, assessedAt: window.target }).state;
        day++;
        if (day - startedDay > 2000) throw Error('JOURNEY_DAY_LIMIT');
    }
    function reachRank(rank: number) {
        while (healthy.rank < rank) {
            const target = REALMS[healthy.rank + 1]!;
            if (healthy.qi >= target.qi && healthy.streak >= target.days && healthy.attemptDay !== day) {
                const now = dayWindow(day, 330, 1395).start + 2 * 3600000;
                // Explicit favorable RNG fixture, first attempt success; no
                // claim about expected real-world campaign duration.
                healthy = breakthrough(healthy, day, now, null, 0).state;
                transitions.push({ day, kind: 'breakthrough:' + healthy.rank });
            } else closeDay();
        }
    }
    function train(id: string, tier: number) {
        if (!owned.has(id)) throw Error('JOURNEY_TECHNIQUE_LOCKED:' + id);
        let practice = versions.find(version => version.techniqueId === id);
        if (!practice) { practice = newPracticeVersion('earned_' + id, id, day, techniqueById(id).trainingFactor); versions.push(practice); }
        pendingPractice = { id: practice.id, fromDay: day + 1 }; closeDay();
        while (versions.find(version => version.id === practice!.id)!.tiers.length < tier) closeDay();
        pendingPractice = { id: null, fromDay: day + 1 };
    }
    function learned() { return versions.filter(version => version.tiers.length).map(version => version.techniqueId); }
    function fight(boss: typeof GAME_BOSSES[number]) {
        if (boss.requires.some(id => !victories.has(id)) || (boss.practicePrerequisites ?? []).some(id => !learned().includes(id)))
            throw Error('JOURNEY_BOSS_LOCKED:' + boss.id);
        const loadout = versions.filter(version => techniqueById(version.techniqueId).school === schoolId && version.tiers.length)
            .map(version => ({ id: version.techniqueId, versionId: version.id, tier: version.tiers.length, purityBp: version.tiers.at(-1)!.purityBp }));
        const initial = newBattleState(fighterForRank(healthy.rank), boss.fighter, loadout, bossIntents(boss), boss.maxTurns, boss.revival);
        const solution = searchBattle(initial, 300);
        if (!solution) return false;
        const learnedBefore = learned();
        pendingPractice = { id: null, fromDay: day + 1 }; closeDay(); // preparation applies tomorrow, current practice keeps today
        let state = initial;
        for (const techniqueId of solution.sequence) {
            state = resolveBattleTurn(state, { techniqueId, acceptCost: true, contribution: { habits: 300, tasks: 0 } }).state;
            closeDay();
        }
        if (state.status !== 'won') throw Error('JOURNEY_NOT_WON:' + boss.id);
        victories.add(boss.id); boss.unlocks.forEach(id => owned.add(id));
        const rewards = earnedBattleRewards(boss, state);
        rewards.achievements.forEach(id => achievements.add(id)); rewards.weapons.forEach(id => weapons.add(id));
        events.push({ boss: boss.id, day, rank: healthy.rank, turns: state.turn, hp: state.player.hp, versions: loadout.map(skill => skill.versionId), unlocks: boss.unlocks, learned: learnedBefore });
        return true;
    }
    // Main story needs no inheritance, forbidden technique, weapon or rescue.
    for (const chapter of Array.from({ length: 15 }, (_, index) => index + 1)) {
        for (const boss of GAME_BOSSES.filter(boss => boss.chapter === chapter && (boss.kind === undefined || boss.kind === 'main'))) {
            reachRank(boss.recommendedRank);
            const tier = chapter <= 3 ? 1 : chapter <= 9 ? 2 : 3;
            if (victories.size) for (const technique of TECHNIQUES.filter(technique => technique.school === schoolId && technique.kind === 'ordinary' && owned.has(technique.id)))
                if ((versions.find(version => version.techniqueId === technique.id)?.tiers.length ?? 0) < tier) train(technique.id, tier);
            let won = fight(boss), investment = tier;
            // A failed tactical preview is not a fabricated victory. Invest
            // actual settled days in the same four ordinary techniques first.
            while (!won && investment < 4) {
                investment++;
                transitions.push({ day, kind: 'prepare-more:' + boss.id });
                for (const technique of TECHNIQUES.filter(technique => technique.school === schoolId && technique.kind === 'ordinary' && owned.has(technique.id)))
                    if ((versions.find(version => version.techniqueId === technique.id)?.tiers.length ?? 0) < investment) train(technique.id, investment);
                won = fight(boss);
            }
            if (!won) throw Error('JOURNEY_NO_WIN:' + schoolId + ':' + boss.id);
        }
    }
    if (collection) {
        // A legitimate late-game collection route, after the main ending.
        // Required editions are trained from owned rights; branch definitions
        // and the earned school loadout remain the production combat rules.
        const remaining = GAME_BOSSES.filter(boss => !victories.has(boss.id));
        while (remaining.length) {
            const index = remaining.findIndex(boss => boss.requires.every(id => victories.has(id)));
            if (index < 0) throw Error('COLLECTION_BOSS_UNREACHABLE');
            const boss = remaining.splice(index, 1)[0]!;
            for (const id of boss.practicePrerequisites ?? []) if (!learned().includes(id)) train(id, 1);
            reachRank(boss.recommendedRank);
            let won = fight(boss);
            for (let investment = 2; !won && investment <= 4; investment++) {
                for (const technique of TECHNIQUES.filter(technique => technique.school === schoolId && technique.kind === 'ordinary'))
                    if ((versions.find(version => version.techniqueId === technique.id)?.tiers.length ?? 0) < investment) train(technique.id, investment);
                won = fight(boss);
            }
            if (!won) throw Error('COLLECTION_NO_WIN:' + schoolId + ':' + boss.id);
        }
        for (const technique of TECHNIQUES) if (!learned().includes(technique.id)) train(technique.id, 1);
        if (owned.size !== 39 || learned().length !== 39) throw Error('COLLECTION_TECHNIQUES_MISSING');
    }
    if (!victories.has('than-chu') || !achievements.has('diet-than')) throw Error('JOURNEY_FINAL_REWARD_MISSING');
    const mainWins = GAME_BOSSES.filter(boss => victories.has(boss.id) && (!boss.kind || boss.kind === 'main')).length;
    return { school: schoolId, contentVersion: GAME_CONTENT_VERSION, rule: 'battle-v1', days: day - startedDay, mainWins, branchWins: victories.size - mainWins,
        fixture: 'one daily habit always met, sleep on time and eligible checkin daily, favorable breakthrough RNG=0, no grants/equipment/rescue; ' +
            (collection ? 'side collection follows the main ending, all 39 editions trained from earned rights; ' : 'main story without inheritance; ') +
            'pure domain traversal, not D1 persistence, imperfect/weekly balance or expected duration; tactical solver sees the complete pattern',
        rank: healthy.rank, qi: healthy.qi, earned: healthy.earned, achievements: [...achievements], weapons: [...weapons], owned: [...owned],
        editions: versions.map(version => ({ id: version.id, techniqueId: version.techniqueId, tiers: version.tiers.map(tier => ({ tier: tier.tier, purityBp: tier.purityBp, lockedDay: tier.lockedDay })) })),
        events, transitions };
}

if (process.argv[1]?.endsWith('simulate-game.ts')) {
    const result = process.argv.includes('--earned-collection') ? { journeys: SCHOOLS.map(school => simulateEarnedJourney(school.id, true)) }
        : process.argv.includes('--earned-journey') ? { journeys: SCHOOLS.map(school => simulateEarnedJourney(school.id)) }
        : process.argv.includes('--campaign') ? simulateCampaign() : simulateOpening(), output = process.argv.indexOf('--output');
    if (output >= 0) {
        if (!process.argv[output + 1]) throw Error('MISSING_SIMULATION_OUTPUT');
        writeFileSync(process.argv[output + 1]!, JSON.stringify(result, null, 2) + '\n', 'utf8');
    }
    console.log(JSON.stringify('journeys' in result ? result.journeys.map(journey => ({ school: journey.school, days: journey.days, wins: journey.mainWins + journey.branchWins, rank: journey.rank, editions: journey.editions.length }))
        : { total: result.total, wins: result.wins, failures: result.failures }, null, 2));
}
