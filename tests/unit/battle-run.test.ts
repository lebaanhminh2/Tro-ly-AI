import test from 'node:test';
import assert from 'node:assert/strict';
import { newBattleState, resolveBattleTurn } from '../../src/domain/battle.ts';
import { settleBattleDay, assertBattleCanChange, type BattleRun } from '../../src/domain/battle-run.ts';
import { fighterForRank } from '../../src/domain/battle-economy.ts';
import { bossById, bossIntents, GAME_BOSSES, validateGameContent } from '../../src/domain/game-content.ts';
function run(): BattleRun {
    const boss = bossById('truy-lenh');
    return { id: 'battle_fixture', bossId: boss.id, contentVersion: 'than-lo-1', combatRank: 0, startsDay: 1, lastDay: null,
        waitDays: 0, rescueUntilDay: null, deathPaid: false, state: newBattleState(fighterForRank(0), boss.fighter, [], bossIntents(boss), boss.maxTurns) };
}
test('opening content has a reachable graph, finite announced actions and a no-habit Vo Ky first win', () => {
    validateGameContent();
    for (const boss of GAME_BOSSES) assert.equal(bossIntents(boss).length, boss.maxTurns);
    let state = run().state;
    while (state.status === 'active') state = resolveBattleTurn(state, { techniqueId: 'vo-ky', contribution: { habits: 0, tasks: 0 }, acceptCost: false }).state;
    assert.equal(state.status, 'won'); assert.ok(state.player.hp > 0);
});
test('three absent days withdraw safely without boss turns; old days and unprocessed history cannot be edited', () => {
    let battle = run();
    for (const day of [1, 2, 3]) battle = settleBattleDay(battle, day, null).run;
    assert.equal(battle.state.status, 'withdrawn'); assert.equal(battle.state.turn, 0);
    assert.equal(battle.state.player.hp, 180);
    assert.throws(() => settleBattleDay(battle, 3, null), /INVALID_BATTLE_DAY/);
    assert.throws(() => assertBattleCanChange(battle, 5, 4), /GAME_CATCHING_UP/);
});
test('a submitted choice advances one combat turn, waiting does not, and rescue has two operating days to decide', () => {
    let battle = run(); battle.state.intents.forEach(intent => { intent.hits = [999]; });
    battle = settleBattleDay(battle, 1, null).run;
    const fatal = settleBattleDay(battle, 2, { techniqueId: 'vo-ky', contribution: { habits: 0, tasks: 0 }, acceptCost: false });
    assert.equal(fatal.run.state.turn, 1); assert.equal(fatal.run.rescueUntilDay, 5);
    assert.equal(settleBattleDay(fatal.run, 3, null).automaticDeath, false);
    assert.equal(settleBattleDay(fatal.run, 4, null).automaticDeath, true);
    assert.throws(() => assertBattleCanChange(fatal.run, 5, 5), /BATTLE_RESCUE_EXPIRED/);
});
