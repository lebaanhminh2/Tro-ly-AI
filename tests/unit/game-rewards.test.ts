import test from 'node:test';
import assert from 'node:assert/strict';
import { armedBattleState, battleWeapon, earnedBattleRewards } from '../../src/domain/game-rewards.ts';
import { bossById, bossIntents } from '../../src/domain/game-content.ts';
import { fighterForRank, payBattleRescue } from '../../src/domain/battle-economy.ts';
import { resolveBattleTurn } from '../../src/domain/battle.ts';
import { initialHealthy } from '../../src/domain/healthy.ts';

test('weapons add a single declared tradeoff or opening shield, never stacks or renewal from ordinary casts', () => {
    const boss = structuredClone(bossById('truy-lenh')); boss.fighter.hp = boss.fighter.maxHp = 2000;
    const base = fighterForRank(3), wind = armedBattleState(base, boss, [], bossIntents(boss), 'thuan-phong'), calm = armedBattleState(base, boss, [], bossIntents(boss), 'dinh-tam');
    assert.equal(wind.player.maxHp, 342); assert.equal(wind.player.attack, 71);
    assert.equal(calm.player.maxHp, 396); assert.equal(calm.player.attack, 62);
    let stone = armedBattleState(base, boss, [], bossIntents(boss), 'thach-tam');
    assert.equal(stone.statuses[0]!.value, 39);
    for (let turn = 0; turn < 3; turn++) stone = resolveBattleTurn(stone, { techniqueId: 'vo-ky', contribution: { habits: 0, tasks: 0 }, acceptCost: false }).state;
    assert.equal(stone.statuses.some(status => status.key === 'weapon:thach-tam'), false);
    assert.throws(() => battleWeapon('client-invention'), /INVALID_GAME_WEAPON/);
});

test('rank rescue retains weapon tradeoffs and prior HP sacrifices without reapplying equipment or refreshing its opening shield', () => {
    const boss = bossById('truy-lenh'), state = armedBattleState(fighterForRank(3), boss,
        [{ id: 'nghich-menh', versionId: 'fixture_nghich', tier: 1, purityBp: 10000 }], bossIntents(boss), 'dinh-tam');
    state.player.maxHp -= 80; state.player.hp = 0; state.status = 'awaiting_rescue'; state.fatalTechnique = 'nghich-menh';
    const paid = payBattleRescue({ ...initialHealthy(), rank: 3, qi: 100 }, state, 'rank', 3, { rankLockUntilDay: null }, 1);
    assert.equal(paid.battle.player.maxHp, 263); assert.equal(paid.battle.player.hp, 92); assert.equal(paid.battle.player.attack, 50);
    assert.equal(paid.battle.statuses.length, 0); assert.equal(paid.healthy.qi, 100);
});

test('derived achievements require a winning snapshot and recorded casts; swapping away another school never forges a pure victory', () => {
    const boss = bossById('truy-lenh'), state = armedBattleState(fighterForRank(3), boss,
        [{ id: 'kiem-y', versionId: 'fixture_kiem', tier: 1, purityBp: 10000 }], bossIntents(boss), null);
    assert.deepEqual(earnedBattleRewards(boss, state), { weapons: [], achievements: [] });
    state.status = 'won'; state.boss.hp = 0; state.turn = 2; state.lastUses = { 'kiem-y': 1, 'vo-ky': 2 };
    assert.ok(earnedBattleRewards(boss, state).achievements.includes('thuan-thien-kiem'));
    state.lastUses['kim-than'] = 1;
    assert.ok(earnedBattleRewards(boss, state).achievements.includes('di-giao'));
    assert.equal(earnedBattleRewards(boss, state).achievements.includes('thuan-thien-kiem'), false);
    state.rescueUsed = true;
    assert.ok(earnedBattleRewards(boss, state).achievements.includes('vuot-tu-canh'));
    assert.equal(earnedBattleRewards(boss, state).achievements.includes('khong-cuu'), false);
    assert.equal(earnedBattleRewards(boss, state).achievements.includes('diet-than'), false);
    assert.ok(earnedBattleRewards(bossById('than-chu'), state).achievements.includes('diet-than'));
});
