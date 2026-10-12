import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateProfileJourney } from '../../scripts/simulate-game-profiles.ts';
import { GAME_BOSSES } from '../../src/domain/game-content.ts';
import { INITIAL_TECHNIQUES } from '../../src/domain/techniques.ts';
import { battleHabitContribution } from '../../src/domain/battle-run.ts';

test('settled habit contribution excludes neutral and partial days and caps six mature successes', () => {
    assert.equal(battleHabitContribution([{ successes: 0, mature: true }]), 0);
    assert.equal(battleHabitContribution([{ successes: 1, mature: false }]), 300);
    assert.equal(battleHabitContribution(Array.from({ length: 12 }, () => ({ successes: 1, mature: true }))), 600);
    assert.equal(battleHabitContribution([{ successes: 1, mature: false }, { successes: 1, mature: true }]), 360);
});

test('weekly earned journey preserves neutral days and defects, opens branches before the ending, and never grants a right or edition', () => {
    const result = simulateProfileJourney('thien-kiem', 'weekly-3');
    assert.equal(result.finalWon, true); assert.equal(result.totalWins, 40);
    assert.ok(result.misses > 0 && result.neutral > result.successes); assert.ok(result.breakthroughFailures > 0);
    const rights = new Set(INITIAL_TECHNIQUES), won = new Set<string>();
    for (const event of result.events) {
        const boss = GAME_BOSSES.find(value => value.id === event.boss)!;
        assert.ok(boss.requires.every(id => won.has(id)));
        assert.ok((boss.practicePrerequisites ?? []).every(id => event.learned.includes(id)));
        assert.ok(event.skills.every(skill => rights.has(skill.id) && skill.tier >= 1));
        assert.ok(event.hp > 0); event.unlocks.forEach(id => rights.add(id)); won.add(event.boss);
    }
    assert.ok(result.events.findIndex(event => event.boss === 'kiem-truyen') < result.events.findIndex(event => event.boss === 'than-chu'));
    assert.ok(result.editions.some(version => version.defectsMilli > 0 && version.tiers.some(tier => tier.purityBp < 10000)));
    assert.ok(result.events.some(event => event.contribution.includes(0)));
});

test('imperfect mixed build earns its school and foreign editions and receives Di Giao only after actual casts', () => {
    const result = simulateProfileJourney('thien-kiem', 'daily-80', true);
    assert.equal(result.finalWon, true); assert.equal(result.totalWins, 40); assert.ok(result.achievements.includes('di-giao'));
    assert.ok(result.events.some(event => event.used.length > 1 && event.skills.some(skill => !['kiem-y', 'lien-van', 'tuyet-menh', 'kiem-vuc', 'nghich-thien'].includes(skill.id))));
    assert.ok(result.successes > result.misses && result.misses > 0); assert.ok(result.editions.some(version => version.defectsMilli > 0));
});
