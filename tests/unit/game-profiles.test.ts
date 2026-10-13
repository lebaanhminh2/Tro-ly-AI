import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateEarnedRescue, simulateProfileJourney } from '../../scripts/simulate-game-profiles.ts';
import { bossIntents, GAME_BOSSES } from '../../src/domain/game-content.ts';
import { INITIAL_TECHNIQUES } from '../../src/domain/techniques.ts';
import { battleHabitContribution } from '../../src/domain/battle-run.ts';
import { fighterForRank, payBattleRescue } from '../../src/domain/battle-economy.ts';
import { armedBattleState, earnedBattleRewards } from '../../src/domain/game-rewards.ts';
import { resolveBattleTurn } from '../../src/domain/battle.ts';

test('settled habit contribution excludes neutral and partial days and caps six mature successes', () => {
    assert.equal(battleHabitContribution([{ successes: 0, mature: true }]), 0);
    assert.equal(battleHabitContribution([{ successes: 1, mature: false }]), 300);
    assert.equal(battleHabitContribution(Array.from({ length: 12 }, () => ({ successes: 1, mature: true }))), 600);
    assert.equal(battleHabitContribution([{ successes: 1, mature: false }, { successes: 1, mature: true }]), 360);
});

test('weekly earned journey preserves neutral days and defects, opens branches before the ending, and never grants a right or edition', () => {
    const result = simulateProfileJourney('thien-kiem', 'weekly-3');
    assert.equal(result.finalWon, true); assert.equal(result.totalWins, 40);
    assert.deepEqual(result.weapons, []); assert.ok(result.events.every(event => event.weapon === null));
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

test('earned imperfect account can pay a real rescue after a losing opening, change tactics and win without replacing its editions or rank', () => {
    const journey = simulateProfileJourney('thien-kiem', 'daily-80');
    const before = structuredClone(journey), rescue = simulateEarnedRescue(journey);
    assert.deepEqual(journey, before, 'Offline tactical branches must not mutate the earned account');
    assert.equal(rescue.status, 'won'); assert.equal(rescue.rescueUsed, true);
    assert.equal(rescue.beforeQi - rescue.afterQi, rescue.qiSpent); assert.ok(rescue.qiSpent > 0);
    assert.equal(rescue.rank, journey.rank); assert.ok(rescue.hp > 0);
    assert.ok(rescue.achievements.includes('vuot-tu-canh')); assert.ok(!rescue.achievements.includes('khong-cuu'));
    for (const skill of rescue.loadout) {
        const edition = journey.editions.find(value => value.id === skill.versionId)!;
        assert.ok(edition); assert.equal(skill.id, edition.techniqueId);
        assert.equal(skill.tier, edition.tiers.length); assert.equal(skill.purityBp, edition.tiers.at(-1)!.purityBp);
    }
    const boss = GAME_BOSSES.find(value => value.id === rescue.boss)!;
    assert.ok(journey.events.some(event => event.boss === boss.id), 'Replay encounter was already legitimately unlocked and won');
    let battle = armedBattleState(fighterForRank(journey.rank), boss, rescue.loadout, bossIntents(boss), null);
    const cast = (entry: typeof rescue.opening[number]) => {
        battle = resolveBattleTurn(battle, { techniqueId: entry.techniqueId, acceptCost: true,
            contribution: { habits: entry.contribution, tasks: 0 } }).state;
    };
    rescue.opening.forEach(cast); assert.equal(battle.status, 'awaiting_rescue'); assert.equal(battle.player.hp, 0);
    const paid = payBattleRescue(journey.healthy, battle, 'qi', journey.rank, { rankLockUntilDay: null }, rescue.recovery[0]!.day);
    assert.equal(paid.healthy.qi, rescue.afterQi); assert.equal(paid.healthy.rank, journey.rank);
    assert.equal(paid.battle.player.hp, rescue.restoredHp); assert.equal(paid.battle.turn, battle.turn);
    battle = paid.battle; rescue.recovery.forEach(cast);
    assert.equal(battle.status, 'won'); assert.equal(battle.player.hp, rescue.hp); assert.equal(battle.turn, rescue.turn);
    assert.deepEqual(earnedBattleRewards(boss, battle).achievements, rescue.achievements);
    assert.ok(new Set(rescue.recovery.map(entry => entry.techniqueId)).size > 1);
    assert.equal(rescue.recovery[0]!.day, rescue.opening.at(-1)!.day + 1);
});
