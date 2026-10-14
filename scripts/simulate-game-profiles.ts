import { writeFileSync } from 'node:fs';
import { assessHabitDay, firstCommitmentDay, habitWeekday, newHabitPeriod, parseHabitDefinition,
    type HabitCadence, type HabitDefinition, type HabitPeriod } from '../src/domain/habits.ts';
import { newPracticeVersion, settlePracticeDay, type PracticeSource, type PracticeVersion, type PracticeWeek } from '../src/domain/practice.ts';
import { newTimePracticeVersion, TIME_PRACTICE_RULE, timePracticeSummary } from '../src/domain/practice-progression.ts';
import { practiceStrength, profileForPractice, type TechniqueStrength } from '../src/domain/technique-profile.ts';
import { assessSleep, breakthrough, claimDailyReward, dailyCheckinProgress, dayWindow, initialHealthy, REALMS, type Charm } from '../src/domain/healthy.ts';
import { armedBattleState, earnedBattleRewards } from '../src/domain/game-rewards.ts';
import { fighterForRank, payBattleRescue } from '../src/domain/battle-economy.ts';
import { battleHabitContribution } from '../src/domain/battle-run.ts';
import { resolveBattleTurn } from '../src/domain/battle.ts';
import { bossIntents, bossForNewBattle, GAME_BOSSES, GAME_CONTENT_VERSION, validateGameContent } from '../src/domain/game-content.ts';
import { INITIAL_TECHNIQUES, SCHOOLS, TECHNIQUES, techniqueById, type SchoolId } from '../src/domain/techniques.ts';
import { searchBattle } from './simulate-game.ts';

type HabitPlan = { cadence: HabitCadence; pattern: number[]; phase: number; weeklyCounts?: number[] };
const daily = (pattern: number[], phase = 0): HabitPlan => ({ cadence: { kind: 'daily' }, pattern, phase });
const weekly = (phase = 0): HabitPlan => ({ cadence: { kind: 'weekly', quota: 3 }, pattern: [1, 1, 1, 1, 0], phase });
const weekdays = (phase = 0): HabitPlan => ({ cadence: { kind: 'weekdays', weekdays: [0, 2, 4] }, pattern: [1, 1, 0, 1, 1], phase });
export const JOURNEY_PROFILES: Record<string, HabitPlan[]> = {
    'daily-80': [daily([1, 1, 0, 1, 1])],
    'daily-60': [daily([1, 0, 1, 0, 1])],
    'six-80': Array.from({ length: 6 }, (_, phase) => daily([1, 1, 0, 1, 1], phase)),
    'weekdays-80': [weekdays()],
    'weekly-3': [weekly()],
    'mixed-six': [daily([1, 1, 0, 1, 1]), daily([1, 0, 1, 0, 1], 1), weekdays(), weekdays(2), weekly(), weekly(2)],
};
// The original profiles remain v1 evidence. These profiles measure the new
// calendar clock, earned increments and inherited quality separately.
export const CULTIVATION_PROFILES: Record<string, HabitPlan[]> = {};
for (const rate of [0, 50, 80, 100]) {
    const pattern = rate === 0 ? [0] : rate === 50 ? [1, 0] : rate === 80 ? [1, 1, 1, 1, 0] : [1];
    for (const count of [1, 6]) {
        const label = count === 1 ? 'one' : 'six';
        CULTIVATION_PROFILES[label + '-daily-' + rate] = Array.from({ length: count }, (_, phase) => daily(pattern, phase));
        CULTIVATION_PROFILES[label + '-weekdays-' + rate] = Array.from({ length: count }, (_, phase) => ({
            cadence: { kind: 'weekdays', weekdays: [0, 2, 4] }, pattern, phase,
        }));
        CULTIVATION_PROFILES[label + '-weekly-' + rate] = Array.from({ length: count }, (_, phase) => ({
            cadence: { kind: 'weekly', quota: 3 }, pattern, phase,
            weeklyCounts: rate === 0 ? [0] : rate === 50 ? [1, 2] : rate === 80 ? [3, 3, 2, 2, 2] : [3],
        }));
    }
}
export type JourneyOptions = { practiceRule?: 'practice-v1' | 'practice-v2'; collectAll?: boolean; searchWidth?: number;
    trainingDays?: readonly number[]; masteryFirst?: boolean };
type HabitFixture = { id: string; definition: HabitDefinition; plan: HabitPlan };
function valueOnDay(habit: HabitFixture, day: number, start: number) {
    const offset = day - start, weekday = habitWeekday(day);
    if (habit.plan.cadence.kind === 'weekly') {
        if (habit.plan.weeklyCounts) {
            const count = habit.plan.weeklyCounts[(Math.floor(offset / 7) + habit.plan.phase) % habit.plan.weeklyCounts.length]!;
            return [0, 3, 6].slice(0, count).includes(weekday) ? 100 : 0;
        }
        // Four weeks achieve Q=3 on Mon/Thu/Sun. Every fifth week does only
        // Monday: neutral until Saturday, then one new miss on each last day.
        const full = habit.plan.pattern[(Math.floor(offset / 7) + habit.plan.phase) % habit.plan.pattern.length];
        return weekday === 0 || full && [3, 6].includes(weekday) ? 100 : 0;
    }
    if (habit.plan.cadence.kind === 'weekdays') {
        if (!habit.plan.cadence.weekdays.includes(weekday)) return 0;
        const obligation = Math.floor(offset / 7) * 3 + habit.plan.cadence.weekdays.indexOf(weekday);
        return habit.plan.pattern[(obligation + habit.plan.phase) % habit.plan.pattern.length] ? 100 : 0;
    }
    return habit.plan.pattern[(offset + habit.plan.phase) % habit.plan.pattern.length] ? 100 : 0;
}
function outcomes(day: number, fixtures: HabitFixture[], periods: Map<string, HabitPeriod>, start: number): PracticeSource[] {
    return fixtures.map(habit => {
        let period = periods.get(habit.id);
        if (!period || day >= period.endDay) period = newHabitPeriod(habit.definition, day);
        const result = assessHabitDay(habit.definition, day, valueOnDay(habit, day, start), period);
        periods.set(habit.id, result.period);
        return { habitId: habit.id, successes: result.successes, misses: result.misses, mature: day - habit.definition.commitmentFrom >= 7,
            cadence: habit.definition.cadence,
            weekly: habit.definition.cadence.kind === 'weekly' ? { startDay: period.startDay, endDay: period.endDay,
                quota: period.quota, successesBefore: period.completedDays.length, missesBefore: period.misses } : null };
    });
}

// Actual earned editions and rights, early optional paths and production weekly
// audits. Never connects to D1, Telegram or a user's data. Tactical preview has
// complete patterns (an upper bound on informed play, not a human playtest).
export function simulateProfileJourney(schoolId: SchoolId, profile: string, mixedBuild = false, seed = 82131, options: JourneyOptions = {}) {
    validateGameContent();
    const timeBased = options.practiceRule === TIME_PRACTICE_RULE;
    if (options.trainingDays && (!timeBased || options.trainingDays.length !== 4 || options.trainingDays.some((days, index) =>
        !Number.isSafeInteger(days) || days < 1 || days > 30 || index > 0 && days < options.trainingDays![index - 1]!)))
        throw Error('INVALID_SIMULATION_TRAINING_DAYS');
    const battleRule = timeBased ? 'battle-v2' : 'battle-v1';
    const plans = (timeBased ? CULTIVATION_PROFILES : JOURNEY_PROFILES)[profile]; if (!plans) throw Error('UNKNOWN_JOURNEY_PROFILE');
    let day = 20742; while (habitWeekday(day) !== 0) day++;
    const startedDay = day;
    const fixtures = plans.map((plan, index) => ({ id: 'habit_' + index, plan,
        definition: parseHabitDefinition({ name: 'Offline fixture ' + index, metric: 'check', target: 1, cadence: plan.cadence }, firstCommitmentDay(day - 1, plan.cadence)) }));
    let healthy = initialHealthy(), versions: PracticeVersion[] = [], weeks: PracticeWeek[] = [], active: string | null = null;
    let pending: { id: string | null; day: number } | null = null;
    const periods = new Map<string, HabitPeriod>(), owned = new Set(INITIAL_TECHNIQUES), victories = new Set<string>(), weapons = new Set<string>(), achievements = new Set<string>();
    let successes = 0, misses = 0, neutral = 0, breakthroughAttempts = 0, breakthroughFailures = 0, random = seed;
    let trainingDays = 0, battleDays = 0, waitingDays = 0, preparationDays = 0;
    const milestones: { kind: 'first_technique' | 'first_complete_technique' | 'three_techniques' | 'first_victory' | 'ending'; day: number; id: string }[] = [];
    const mark = (kind: typeof milestones[number]['kind'], id: string) => {
        if (!milestones.some(value => value.kind === kind)) milestones.push({ kind, id, day: day - startedDay + 1 });
    };
    const events: { boss: string; chapter: number; day: number; rank: number; turns: number; hp: number; skills: { id: string; tier: number; purityBp: number; strength?: TechniqueStrength }[]; weapon: string | null; contribution: number[]; used: string[]; unlocks: string[]; learned: string[] }[] = [];
    const failures: { boss: string; rank: number; day: number; reason: string }[] = [];
    function closeDay(activity: 'idle' | 'preparation' | 'battle' = 'idle') {
        if (pending && pending.day <= day) { active = pending.id; pending = null; }
        const receiver = versions.find(version => version.id === active);
        if (activity === 'battle' && receiver && receiver.tiers.length < 4) throw Error('PROFILE_DOUBLE_RECEIVER');
        if (activity === 'battle') battleDays++;
        else if (receiver && receiver.tiers.length < 4) trainingDays++;
        else waitingDays++;
        if (activity === 'preparation') preparationDays++;
        const sources = outcomes(day, fixtures, periods, startedDay);
        const result = settlePracticeDay(day, active, versions, weeks, sources); versions = result.versions; weeks = result.weeks;
        for (const opened of result.locked) {
            if (opened.tier === 1) mark('first_technique', opened.versionId);
            if (opened.tier === 4) mark('first_complete_technique', opened.versionId);
        }
        if (versions.filter(version => version.tiers.length).length >= 3) mark('three_techniques', versions.find(version => version.id === active)?.techniqueId ?? '');
        successes += sources.reduce((sum, source) => sum + source.successes, 0); misses += sources.reduce((sum, source) => sum + source.misses, 0);
        neutral += sources.filter(source => !source.successes && !source.misses).length;
        const window = dayWindow(day, 330, 1395), time = window.start + 2 * 3600000;
        if (dailyCheckinProgress(healthy, time).canClaim) healthy = claimDailyReward(healthy, time).state;
        healthy = assessSleep(healthy, { day, target: window.target, end: window.end, reportedAt: window.target - 60000,
            chatActive: true, assessedAt: window.target }).state;
        day++; if (day - startedDay > 2400) throw Error('PROFILE_DAY_LIMIT:' + profile);
        return battleHabitContribution(sources);
    }
    function reachRank(rank: number) {
        while (healthy.rank < rank) {
            const target = REALMS[healthy.rank + 1]!;
            if (healthy.qi >= target.qi && healthy.streak >= target.days && healthy.attemptDay !== day) {
                random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
                const charm = (['supreme', 'high', 'middle', 'basic'] as Charm[]).find(id => healthy.inventory[id] > 0) ?? null;
                const result = breakthrough(healthy, day, dayWindow(day, 330, 1395).start + 2 * 3600000, charm, random / 4294967296);
                healthy = result.state; breakthroughAttempts++; if (!result.success) breakthroughFailures++;
            } else closeDay();
        }
    }
    function best(id: string) { return versions.find(version => version.techniqueId === id)!; }
    function train(id: string, tier: number) {
        if (!owned.has(id)) throw Error('PROFILE_RIGHT_NOT_EARNED:' + id);
        let version = versions.find(item => item.techniqueId === id);
        if (!version) {
            version = (timeBased ? newTimePracticeVersion : newPracticeVersion)('profile_' + id, id, day, techniqueById(id).trainingFactor);
            // Counterfactual pacing uses the same persisted-period contract and
            // production clock/settlement/resolver. It is explicitly reported
            // as a proposal; the runtime factory remains unchanged until chosen.
            if (options.trainingDays) {
                const days = options.trainingDays.map(value => Math.ceil(value * techniqueById(id).trainingFactor / 1000));
                version.costsMilli = days.map(value => value * 1000);
                version.time!.periods.forEach((period, index) => { period.requiredDays = days[index]!; });
            }
            versions.push(version);
        }
        if (version.tiers.length >= tier) return;
        pending = { id: version.id, day: day + 1 }; closeDay();
        while (best(id).tiers.length < tier) closeDay();
        pending = { id: null, day: day + 1 };
    }
    function learned() { return versions.filter(version => version.tiers.length).map(version => version.techniqueId); }
    function combatSkills(mixed: boolean) {
        const school = versions.filter(version => version.tiers.length && techniqueById(version.techniqueId).school === schoolId);
        const other = versions.filter(version => version.tiers.length && techniqueById(version.techniqueId).school !== schoolId && techniqueById(version.techniqueId).kind !== 'forbidden');
        const chosen = mixed && other.length ? [...school.slice(0, 3), ...other.slice(0, 2)] : school.slice(0, 5);
        return chosen.map(version => ({ id: version.techniqueId, versionId: version.id, tier: version.tiers.length,
            purityBp: version.tiers.at(-1)!.purityBp, ...(timeBased ? { strength: practiceStrength(version) } : {}) }));
    }
    function fight(boss: typeof GAME_BOSSES[number]) {
        boss = bossForNewBattle(boss.id);
        if (boss.requires.some(id => !victories.has(id)) || (boss.practicePrerequisites ?? []).some(id => !learned().includes(id))) throw Error('PROFILE_BOSS_NOT_EARNED:' + boss.id);
        // Preview begins tomorrow, after the preparation day's obligations.
        const simulated = structuredClone(periods); outcomes(day, fixtures, simulated, startedDay);
        const contributions = Array.from({ length: boss.maxTurns }, (_, index) => battleHabitContribution(outcomes(day + 1 + index, fixtures, simulated, startedDay)));
        const loadout = combatSkills(mixedBuild), weapon = null;
        const initial = armedBattleState(fighterForRank(healthy.rank), boss, loadout, bossIntents(boss), weapon, battleRule);
        const solution = searchBattle(initial, contributions, options.searchWidth ?? 48); if (!solution) return false;
        const learnedBefore = learned(); pending = { id: null, day: day + 1 }; closeDay('preparation');
        let state = initial; const actual: number[] = [];
        for (const id of solution.sequence) {
            const contribution = closeDay('battle'); actual.push(contribution);
            state = resolveBattleTurn(state, { techniqueId: id, acceptCost: true, contribution: { habits: contribution, tasks: 0 } }).state;
        }
        if (state.status !== 'won' || actual.some((value, index) => value !== contributions[index])) throw Error('PROFILE_PREVIEW_DIVERGED');
        victories.add(boss.id); boss.unlocks.forEach(id => owned.add(id));
        // closeDay has already advanced, so record this end-of-day milestone
        // at the same offset as the event, rather than adding a phantom day.
        if (!milestones.some(value => value.kind === 'first_victory')) milestones.push({ kind: 'first_victory', id: boss.id, day: day - startedDay });
        if (boss.id === 'than-chu') milestones.push({ kind: 'ending', id: boss.id, day: day - startedDay });
        const reward = earnedBattleRewards(boss, state); reward.weapons.forEach(id => weapons.add(id)); reward.achievements.forEach(id => achievements.add(id));
        events.push({ boss: boss.id, chapter: boss.chapter, day: day - startedDay, rank: healthy.rank, turns: state.turn, hp: state.player.hp,
            skills: loadout.map(({ id, tier, purityBp, strength }) => ({ id, tier, purityBp, ...(strength ? { strength } : {}) })), weapon, contribution: actual, used: Object.keys(state.lastUses), unlocks: boss.unlocks, learned: learnedBefore });
        return true;
    }
    function attempt(boss: typeof GAME_BOSSES[number], optional: boolean) {
        for (const id of boss.practicePrerequisites ?? []) train(id, 1);
        reachRank(boss.recommendedRank);
        const tier = boss.chapter <= 3 ? 1 : boss.chapter <= 9 ? 2 : 3;
        const school = TECHNIQUES.filter(technique => technique.school === schoolId && owned.has(technique.id));
        if (victories.size) for (const technique of school) train(technique.id, tier);
        let won = fight(boss);
        for (let investment = tier + 1; !won && investment <= 4; investment++) {
            for (const technique of school) train(technique.id, investment);
            won = fight(boss);
        }
        // Three real calendar starting points cover neutral/failed days, rather
        // than pretending every battle has the habit bonus on every turn.
        for (let retry = 0; !won && retry < 2; retry++) { closeDay(); won = fight(boss); }
        if (!won && !optional) {
            // Record the extra investment: a reasonable two ranks of cushion
            // is permitted, but no silent grant to endgame rank for early paths.
            for (let rank = healthy.rank + 1; !won && rank <= Math.min(10, boss.recommendedRank + 2); rank++) { reachRank(rank); won = fight(boss); }
        }
        if (!won) failures.push({ boss: boss.id, rank: healthy.rank, day: day - startedDay, reason: optional ? 'early_branch_needs_more_strength' : 'no_win_after_real_investment' });
        return won;
    }
    // A separate earned strategy measures the first complete technique instead
    // of confusing the campaign policy's optional tier 4 with earliest mastery.
    if (options.masteryFirst) train(TECHNIQUES.find(technique => technique.school === schoolId && owned.has(technique.id))!.id, 4);
    for (const boss of GAME_BOSSES.filter(boss => !boss.kind || boss.kind === 'main')) {
        if (!attempt(boss, false)) break;
        // Enter side paths as soon as their preceding victories are earned.
        for (const branch of GAME_BOSSES.filter(value => value.kind && value.kind !== 'main' && value.chapter <= boss.chapter && !victories.has(value.id)
            && value.requires.every(id => victories.has(id)))) attempt(branch, true);
    }
    const campaignDays = day - startedDay;
    const campaignTimeline = { days: campaignDays, trainingDays, battleDays, waitingDays, preparationDays,
        milestones: structuredClone(milestones) };
    if (options.collectAll) {
        for (const technique of TECHNIQUES.filter(technique => owned.has(technique.id))) train(technique.id, 4);
        // Finish audits after the last opened tier, without converting waiting
        // days to training days or fabricating the week's missing successes.
        pending = { id: null, day: day + 1 };
        while (versions.some(version => version.pendingWeeks.length)) closeDay();
    }
    const days = day - startedDay;
    if (trainingDays + battleDays + waitingDays !== days) throw Error('PROFILE_DAY_ACCOUNTING');
    return { school: schoolId, profile, mixedBuild, seed, practiceRule: timeBased ? TIME_PRACTICE_RULE : 'practice-v1', battleRule,
        contentVersion: GAME_CONTENT_VERSION, proposedTrainingDays: options.trainingDays ?? null, strategy: options.masteryFirst ? 'mastery-first' : 'campaign',
        days, campaignDays, campaignTimeline, trainingDays, battleDays, waitingDays, preparationDays, milestones,
        currentDay: day, healthy, habitSnapshot: { startedDay, fixtures, periods: [...periods] },
        fixture: 'fresh domain, fixed habit profile, production weekly audit, checkin/on-time sleep every day, seeded breakthrough RNG and earned charms; early branches; no weapons/tasks/rescue/grants; complete-pattern solver; tactical failures do not commit a battle or loss; not expected human completion time or D1 proof',
        rank: healthy.rank, successes, misses, neutral, breakthroughAttempts, breakthroughFailures, mainWins: events.filter(event => !GAME_BOSSES.find(boss => boss.id === event.boss)!.kind || GAME_BOSSES.find(boss => boss.id === event.boss)!.kind === 'main').length,
        totalWins: victories.size, finalWon: victories.has('than-chu'), achievements: [...achievements], weapons: [...weapons], owned: [...owned],
        editions: versions.map(version => ({ id: version.id, techniqueId: version.techniqueId, rule: version.rule,
            tiers: version.tiers, defectsMilli: version.defectsMilli, strength: practiceStrength(version),
            summary: timeBased ? timePracticeSummary(version, { afterDay: day, weeks }) : null,
            periods: version.time?.periods, profile: profileForPractice(version) })), events, failures };
}

// A deliberate repeated risky opening followed by a paid recovery, from the exact
// account and editions earned in the journey above. Replaying a boss does not
// grant any additional entitlement or item. Calendar habit contributions are
// continued from the saved period state; no sleep/checkin rewards are added
// during this short isolated combat fixture.
export function simulateEarnedRescue(journey: ReturnType<typeof simulateProfileJourney>) {
    if (!journey.finalWon) throw Error('RESCUE_REQUIRES_EARNED_JOURNEY');
    const { startedDay, fixtures } = journey.habitSnapshot;
    const loadout = journey.editions.filter(version => techniqueById(version.techniqueId).school === journey.school && version.tiers.length)
        .slice(0, 5).map(version => ({ id: version.techniqueId, versionId: version.id, tier: version.tiers.length,
            purityBp: version.tiers.at(-1)!.purityBp, ...(version.strength ? { strength: version.strength } : {}) }));
    const risky = loadout.some(skill => skill.id === 'vo-hoi') ? 'vo-hoi' : 'vo-ky';
    for (const boss of GAME_BOSSES.filter(value => journey.events.some(event => event.boss === value.id)).map(value => bossForNewBattle(value.id)).reverse()) {
        const periods = new Map(structuredClone(journey.habitSnapshot.periods)); let day = journey.currentDay;
        outcomes(day++, fixtures, periods, startedDay); // preparation closes today
        let state = armedBattleState(fighterForRank(journey.rank), boss, loadout, bossIntents(boss), null, journey.battleRule);
        const opening: { day: number; techniqueId: string; contribution: number }[] = [];
        while (state.status === 'active') {
            const contribution = battleHabitContribution(outcomes(day, fixtures, periods, startedDay));
            opening.push({ day: day++, techniqueId: risky, contribution });
            state = resolveBattleTurn(state, { techniqueId: risky, acceptCost: true, contribution: { habits: contribution, tasks: 0 } }).state;
        }
        if (state.status !== 'awaiting_rescue') continue;
        const paid = payBattleRescue(journey.healthy, state, 'qi', journey.rank, { rankLockUntilDay: null }, day);
        const preview = structuredClone(periods), remaining = state.maxTurns - state.turn;
        const contributions = Array.from({ length: remaining }, (_, index) => battleHabitContribution(outcomes(day + index, fixtures, preview, startedDay)));
        const solution = searchBattle(paid.battle, contributions); if (!solution) continue;
        state = paid.battle; const recovery: { day: number; techniqueId: string; contribution: number }[] = [];
        for (const techniqueId of solution.sequence) {
            const contribution = battleHabitContribution(outcomes(day, fixtures, periods, startedDay));
            recovery.push({ day: day++, techniqueId, contribution });
            state = resolveBattleTurn(state, { techniqueId, acceptCost: true, contribution: { habits: contribution, tasks: 0 } }).state;
        }
        if (state.status !== 'won') throw Error('EARNED_RESCUE_DIVERGED');
        return { boss: boss.id, school: journey.school, profile: journey.profile, fixture: 'earned journey account/editions, deliberately repeated risky opening, qi rescue paid from existing balance, same calendar habit profile, full-pattern solver; no duplicate rewards, no D1 persistence or rank-rescue claim',
            beforeQi: journey.healthy.qi, afterQi: paid.healthy.qi, qiSpent: paid.qiSpent, rank: paid.healthy.rank,
            restoredHp: paid.battle.player.hp, hp: state.player.hp, turn: state.turn, status: state.status, rescueUsed: state.rescueUsed,
            achievements: earnedBattleRewards(boss, state).achievements,
            opening, recovery, loadout };
    }
    throw Error('EARNED_RESCUE_NO_VICTORY:' + journey.school + ':' + journey.profile);
}

if (process.argv[1]?.endsWith('simulate-game-profiles.ts')) {
    const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
    const school = arg('--school'), profile = arg('--profile');
    if (school && !SCHOOLS.some(value => value.id === school)) throw Error('UNKNOWN_SCHOOL');
    if (profile && !JOURNEY_PROFILES[profile]) throw Error('UNKNOWN_JOURNEY_PROFILE');
    const journeys = [];
    for (const selected of SCHOOLS.filter(value => !school || value.id === school)) for (const name of Object.keys(JOURNEY_PROFILES).filter(value => !profile || value === profile)) {
        const journey = simulateProfileJourney(selected.id, name, process.argv.includes('--mixed'));
        const rescue = process.argv.includes('--rescue') ? simulateEarnedRescue(journey) : null;
        journeys.push({ ...journey, rescue }); console.log(JSON.stringify({ school: selected.id, profile: name, days: journey.days, wins: journey.totalWins, finalWon: journey.finalWon, failures: journey.failures, rescue: rescue ? { boss: rescue.boss, qiSpent: rescue.qiSpent, hp: rescue.hp } : null }));
    }
    const output = arg('--output'); if (output) writeFileSync(output, JSON.stringify({ journeys }, null, 2) + '\n', 'utf8');
}
