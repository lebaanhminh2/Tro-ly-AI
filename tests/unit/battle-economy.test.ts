import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHealthy, undoSleepAssessment, assessSleep, DAY_MS } from '../../src/domain/healthy.ts';
import { newBattleState, resolveBattleTurn, type BossIntent } from '../../src/domain/battle.ts';
import { fighterForRank, payBattleRescue, payBattleDeath, rescueQuote, assertCombatBreakthroughAllowed } from '../../src/domain/battle-economy.ts';

const intent: BossIntent = { id: 'fatal', name: 'Tử kích', description: 'Đòn mạnh đã báo.', hits: [999], special: true, heal: 0, armorBuff: 0 };
function fatal(rank: number, id = 'nghich-menh') {
    const before = newBattleState(fighterForRank(rank), { hp: 10000, maxHp: 10000, attack: 999, armor: 0 },
        [{ id, versionId: 'v_' + id, tier: 1, purityBp: 10000 }], [intent, intent], 2);
    return resolveBattleTurn(before, { techniqueId: id, contribution: { habits: 0, tasks: 0 }, acceptCost: true }).state;
}
function account(rank = 3) { return { ...initialHealthy(), rank, highestRank: 7, qi: 150, earned: 700, tickets: 3,
    streak: 8, bestStreak: 12, protectedUntil: 9 * DAY_MS, attemptDay: 1, failures: 2 }; }

test('Ho Menh debits only the quoted qi and never touches ordinary rewards, rank or sleep state', () => {
    const before = account(), battle = fatal(3);
    const result = payBattleRescue(before, battle, 'qi', 3, { rankLockUntilDay: null }, 5);
    assert.equal(result.qiSpent, rescueQuote(before, 3).qiCost);
    assert.equal(result.healthy.qi, before.qi - result.qiSpent);
    assert.deepEqual({ ...result.healthy, qi: before.qi }, before);
    assert.equal(result.battle.player.hp, Math.floor(fighterForRank(3).maxHp * 350 / 1000));
    assert.equal(result.battle.rescueUsed, true); assert.equal(battle.player.hp, 0);
    assert.throws(() => payBattleRescue({ ...before, qi: 0 }, battle, 'qi', 3, { rankLockUntilDay: null }, 5), /UNAFFORDABLE/);
    assert.throws(() => payBattleRescue(before, result.battle, 'qi', 3, result.restrictions, 5), /UNAVAILABLE/);
});

test('Nghich Menh sacrifices a live major rank with no qi fee, keeps earned/highest/protection and applies an independent cooldown', () => {
    const before = account(), result = payBattleRescue(before, fatal(3), 'rank', 3, { rankLockUntilDay: null }, 5);
    assert.equal(result.healthy.rank, 2); assert.equal(result.healthy.qi, before.qi); assert.equal(result.qiSpent, 0);
    assert.equal(result.healthy.earned, before.earned); assert.equal(result.healthy.highestRank, before.highestRank);
    assert.equal(result.healthy.protectedUntil, before.protectedUntil); assert.equal(result.healthy.streak, before.streak);
    assert.equal(result.healthy.attemptDay, 5); assert.equal(result.healthy.failures, 0);
    assert.equal(result.restrictions.rankLockUntilDay, 8); assert.equal(result.combatRank, 2);
    assert.equal(result.battle.player.maxHp, fighterForRank(2).maxHp); assert.equal(result.battle.player.attack, fighterForRank(2).attack);
    for (const day of [5, 6, 7]) assert.throws(() => assertCombatBreakthroughAllowed(result.restrictions, day), /COMBAT_COOLDOWN/);
    assert.doesNotThrow(() => assertCombatBreakthroughAllowed(result.restrictions, 8));
    assert.throws(() => payBattleRescue(account(0), fatal(0), 'rank', 0, { rankLockUntilDay: null }, 5), /UNAFFORDABLE/);
    assert.throws(() => payBattleRescue(before, fatal(3, 'kiem-y'), 'rank', 3, { rankLockUntilDay: null }, 5), /UNAVAILABLE/);
});

test('a concurrent external rank loss never charges a stale higher rank or erases prior max-HP sacrifices', () => {
    const battle = fatal(5); battle.player.maxHp = 400;
    const result = payBattleRescue(account(2), battle, 'rank', 5, { rankLockUntilDay: 9 }, 5);
    assert.equal(result.healthy.rank, 1); assert.equal(result.combatRank, 1);
    assert.equal(result.battle.player.maxHp, Math.floor(400 * fighterForRank(1).maxHp / fighterForRank(5).maxHp));
    assert.equal(result.restrictions.rankLockUntilDay, 9);
});

test('combat payments cannot be erased by undoing sleep; qi-only rescue does not rewind unrelated balances', () => {
    const before = account(), sleep = assessSleep(before, { day: 5, target: 6 * DAY_MS - 100, end: 6 * DAY_MS,
        reportedAt: 6 * DAY_MS - 200, chatActive: true, assessedAt: 6 * DAY_MS - 200 }).state;
    const ranked = payBattleRescue(sleep, fatal(3), 'rank', 3, { rankLockUntilDay: null }, 5);
    assert.throws(() => undoSleepAssessment(ranked.healthy, before, sleep), /SLEEP_UNDO_LOCKED/);
    const qi = payBattleRescue(sleep, fatal(3), 'qi', 3, { rankLockUntilDay: null }, 5);
    const undo = undoSleepAssessment(qi.healthy, before, sleep);
    assert.equal(undo.qi, before.qi - qi.qiSpent); assert.equal(undo.earned, before.earned);
});

test('death charges a bounded qi delta and never auto-demotes or consumes inventory', () => {
    for (const qi of [0, 2, 50, 10000]) {
        const before = { ...account(), qi }, result = payBattleDeath(before, fatal(3));
        assert.ok(result.qiSpent <= 60 && result.qiSpent <= qi);
        assert.equal(result.battle.status, 'dead'); assert.equal(result.healthy.rank, before.rank);
        assert.deepEqual({ ...result.healthy, qi }, before);
    }
});
