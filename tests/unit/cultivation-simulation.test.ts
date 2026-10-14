import test from 'node:test';
import assert from 'node:assert/strict';
import { CULTIVATION_PROFILES, simulateProfileJourney } from '../../scripts/simulate-game-profiles.ts';
import { INITIAL_TECHNIQUES, TECHNIQUES } from '../../src/domain/techniques.ts';
import { GAME_BOSSES } from '../../src/domain/game-content.ts';
import { purityGrade } from '../../src/domain/practice-progression.ts';

test('v2 earned campaign and collection keep real rights, per-period increments, snapshots and exact day accounting', () => {
    const result = simulateProfileJourney('thien-kiem', 'one-daily-80', false, 82131,
        { practiceRule: 'practice-v2', collectAll: true });
    assert.equal(result.practiceRule, 'practice-v2'); assert.equal(result.battleRule, 'battle-v2');
    assert.equal(result.finalWon, true); assert.equal(result.totalWins, GAME_BOSSES.length);
    assert.equal(result.editions.length, TECHNIQUES.length);
    assert.equal(result.trainingDays + result.battleDays + result.waitingDays, result.days);
    assert.equal(result.trainingDays, result.editions.reduce((sum, edition) =>
        sum + edition.periods!.reduce((days, period) => days + period.requiredDays, 0), 0));
    assert.ok(result.days > result.campaignDays); assert.deepEqual(result.weapons, []);
    const owned = new Set(INITIAL_TECHNIQUES), won = new Set<string>();
    for (const event of result.events) {
        const boss = GAME_BOSSES.find(value => value.id === event.boss)!;
        assert.ok(boss.requires.every(id => won.has(id)));
        assert.ok((boss.practicePrerequisites ?? []).every(id => event.learned.includes(id)));
        for (const skill of event.skills) {
            assert.ok(owned.has(skill.id) && skill.tier >= 1);
            assert.equal(skill.strength?.rule, 'practice-v2');
            assert.equal(skill.strength?.gradeBonusMilli, purityGrade(skill.strength!.totalPurityBp)?.bonusMilli ?? 0);
        }
        event.unlocks.forEach(id => owned.add(id)); won.add(event.boss);
    }
    assert.ok(result.editions.some(edition => edition.periods!.some(period =>
        period.ratioBp! > period.qualityBp!)), 'Later earned damage must survive inherited defects');
    assert.ok(result.events.some(event => event.skills.some(skill => {
        const final = result.editions.find(edition => edition.id === 'profile_' + skill.id)!;
        return skill.strength!.damageFactorMilli !== final.strength!.damageFactorMilli;
    })), 'Continued collection must preserve the older battle snapshots');
    assert.ok(result.milestones.some(value => value.kind === 'first_victory'));
    assert.ok(result.milestones.some(value => value.kind === 'first_complete_technique'));
    assert.ok(result.editions.every(edition => edition.tiers.length === 4 && !edition.summary!.awaitingAudit));
});

test('zero-habit v2 timelines still open time tiers, keep zero quality, and report bounded search failures honestly', () => {
    const result = simulateProfileJourney('bat-diet', 'one-daily-0', false, 82131, { practiceRule: 'practice-v2' });
    assert.equal(result.successes, 0); assert.ok(result.misses > 0);
    assert.ok(result.editions.some(edition => edition.tiers.length >= 1));
    assert.ok(result.editions.every(edition => edition.summary!.totalPurityBp === 0));
    assert.ok(result.editions.every(edition => edition.strength!.damageFactorMilli === 400));
    assert.equal(result.trainingDays + result.battleDays + result.waitingDays, result.days);
    assert.ok(result.events.every(event => event.contribution.every(value => value === 0)));
    if (!result.finalWon) assert.ok(result.failures.length > 0);
});

test('flexible-week v2 profiles settle neutral days and pending audits while using earned mixed-school editions', () => {
    const result = simulateProfileJourney('thien-kiem', 'six-weekly-80', true, 82131,
        { practiceRule: 'practice-v2', collectAll: true });
    assert.equal(result.finalWon, true); assert.equal(result.totalWins, GAME_BOSSES.length);
    assert.ok(result.neutral > result.successes && result.misses > 0);
    assert.equal(result.editions.length, TECHNIQUES.length);
    assert.ok(result.editions.every(edition => !edition.summary!.awaitingAudit));
    assert.ok(result.events.some(event => event.skills.some(skill => !['kiem-y', 'lien-van', 'tuyet-menh', 'vo-hoi', 'kiem-vuc'].includes(skill.id))));
    assert.equal(result.trainingDays + result.battleDays + result.waitingDays, result.days);
    for (const rate of [0, 50, 80, 100]) for (const count of ['one', 'six'])
        for (const cadence of ['daily', 'weekdays', 'weekly']) assert.ok(CULTIVATION_PROFILES[count + '-' + cadence + '-' + rate]);
});
