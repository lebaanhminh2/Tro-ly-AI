import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CULTIVATION_PROFILES, simulateEarnedRescue, simulateProfileJourney } from './simulate-game-profiles.ts';
import { SCHOOLS } from '../src/domain/techniques.ts';

// Offline earned timelines. No D1, provider, user session or administrative
// grants. Full-pattern beam search is an optimistic tactical bound, not a
// claim that a person knows future boss actions or a proof of optimal play.
const arg = (name: string) => {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) throw Error('MISSING_ARGUMENT:' + name);
    return value;
};
const school = arg('--school'), profile = arg('--profile'), output = arg('--output');
if (school && !SCHOOLS.some(value => value.id === school)) throw Error('UNKNOWN_SCHOOL');
if (profile && !CULTIVATION_PROFILES[profile]) throw Error('UNKNOWN_JOURNEY_PROFILE');
const width = Number(arg('--width') ?? 48), seed = Number(arg('--seed') ?? 82131);
if (!Number.isSafeInteger(width) || width < 1 || width > 256 || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw Error('INVALID_SIMULATION_CONFIG');
const proposedDays = arg('--days')?.split(',').map(Number);
const config = { practiceRule: 'practice-v2' as const, searchWidth: width, collectAll: process.argv.includes('--collect'),
    masteryFirst: process.argv.includes('--mastery-first'),
    ...(proposedDays ? { trainingDays: proposedDays } : {}) };
const sourceFiles = ['scripts/simulate-cultivation.ts', 'scripts/simulate-game-profiles.ts', 'scripts/simulate-game.ts',
    'src/domain/practice.ts', 'src/domain/practice-progression.ts', 'src/domain/technique-profile.ts',
    'src/domain/battle.ts', 'src/domain/battle-techniques.ts', 'src/domain/battle-armor.ts', 'src/domain/battle-run.ts',
    'src/domain/battle-economy.ts', 'src/domain/healthy.ts', 'src/domain/habits.ts', 'src/domain/techniques.ts',
    'src/domain/game-content.ts', 'src/domain/game-campaign.ts', 'src/domain/game-branches.ts',
    'src/domain/game-balance.ts', 'src/domain/game-rewards.ts'];
const sources = sourceFiles.map(file => ({ file, sha256: createHash('sha256').update(readFileSync(
    fileURLToPath(new URL('../' + file, import.meta.url)))).digest('hex') }));
const journeys = [];
for (const selected of SCHOOLS.filter(value => !school || value.id === school)) {
    for (const name of Object.keys(CULTIVATION_PROFILES).filter(value => !profile || value === profile)) {
        const started = performance.now();
        const journey = simulateProfileJourney(selected.id, name, process.argv.includes('--mixed'), seed, config);
        let rescue = null;
        if (process.argv.includes('--rescue') && journey.finalWon) {
            try { rescue = simulateEarnedRescue(journey); }
            catch (error) {
                if (!(error instanceof Error) || !error.message.startsWith('EARNED_RESCUE_NO_VICTORY:')) throw error;
                rescue = { status: 'not_found', reason: error.message,
                    limitation: 'The deliberate repeated-opening recovery strategy found no victory; not proof that all rescues fail.' };
            }
        }
        journeys.push({ ...journey, rescue });
        console.log(JSON.stringify({ school: selected.id, profile: name, mixed: journey.mixedBuild,
            campaignDays: journey.campaignDays, totalDays: journey.days, trainingDays: journey.trainingDays,
            battleDays: journey.battleDays, waitingDays: journey.waitingDays, milestones: journey.milestones,
            wins: journey.totalWins, finalWon: journey.finalWon, editions: journey.editions.length,
            failures: journey.failures, rescueStatus: rescue?.status ?? null, durationMs: Math.round(performance.now() - started) }));
    }
}
if (output) writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), config, seed, sources,
    limitations: ['Seeded checkin/on-time sleep every day; healthy economics is earned but favorable.',
        'Complete-pattern bounded beam search; not a human playtest or proof that a failed search is unwinnable.',
        'Failed tactical searches are not committed as battles; no loss, rescue fee or preparation day is charged for those searches.',
        'Calendar rates are long-run targets. Short periods and flexible-week allocations may have different ratios.',
        'Collection trains only rights earned by victories. No parallel training, day buffs from tasks or administrative grants.',
        'Offline domain evidence; D1, concurrency, live providers and UI performance are verified separately.'], journeys }, null, 2) + '\n', 'utf8');
