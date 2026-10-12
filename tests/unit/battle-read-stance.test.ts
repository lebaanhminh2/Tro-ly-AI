import test from 'node:test';
import assert from 'node:assert/strict';
import { newBattleState, publicBattleState, resolveBattleTurn, type BattleState } from '../../src/domain/battle.ts';
import { bossById, bossIntents, publicGameCatalog, supportsContentVersion, validateGameContent } from '../../src/domain/game-content.ts';
import { repeatTactic } from '../../scripts/simulate-game-tactics.ts';
import { fighterForRank } from '../../src/domain/battle-economy.ts';
import { armedBattleState } from '../../src/domain/game-rewards.ts';
import { searchBattle } from '../../scripts/simulate-game.ts';

const input = (techniqueId: string) => ({ techniqueId, acceptCost: true, contribution: { habits: 0, tasks: 0 } });
function fixture(ids = ['kiem-y', 'lien-van'], ward?: number): BattleState {
    return newBattleState({ hp: 300, maxHp: 300, attack: 40, armor: 0 }, { hp: 3000, maxHp: 3000, attack: 20, armor: 0 },
        ids.map(id => ({ id, versionId: 'read_' + id, tier: 1, purityBp: 10000 })),
        Array.from({ length: 12 }, (_, index) => ({ id: 'intent_' + index, name: 'Đọc thế', hits: [20], special: false,
            description: 'Đòn đã báo', heal: 0, armorBuff: 0, ...(ward === undefined ? {} : { repeatWard: ward }) })), 12);
}

test('new read stance is announced, only repeats trigger it, and old saved intents preserve repeated damage without defaulting to the new content', () => {
    const legacy = fixture(), first = resolveBattleTurn(legacy, input('kiem-y'));
    assert.equal(first.rawPlayerDamage, 44);
    const second = resolveBattleTurn(first.state, input('kiem-y')); assert.equal(second.rawPlayerDamage, 44);
    const saved = JSON.parse(JSON.stringify(first.state)); assert.equal('repeatWard' in saved.intents[1], false);
    assert.equal(resolveBattleTurn(saved, input('kiem-y')).rawPlayerDamage, 44);
    const warded = fixture(undefined, 750), opening = resolveBattleTurn(warded, input('kiem-y'));
    assert.equal(opening.rawPlayerDamage, 44);
    const repeated = resolveBattleTurn(opening.state, input('kiem-y')); assert.equal(repeated.rawPlayerDamage, 11);
    const publicView = publicBattleState(opening.state);
    assert.equal(publicView.choices.find(choice => choice.id === 'kiem-y')!.repeatDamagePenalty, 750);
    assert.equal(publicView.choices.find(choice => choice.id === 'lien-van')!.repeatDamagePenalty, 0);
    assert.ok(repeated.entries.some(entry => entry.text.includes('75%')));
    const changed = resolveBattleTurn(opening.state, input('lien-van'));
    assert.equal(changed.rawPlayerDamage, resolveBattleTurn(first.state, input('lien-van')).rawPlayerDamage);
    assert.equal(first.state.turn, 1, 'Branch previews never mutate the saved snapshot');
    assert.ok(supportsContentVersion('than-lo-1') && supportsContentVersion('than-lo-2') && supportsContentVersion('than-lo-3'));
});

test('read stance covers pending domain and reflection without changing the sacrifice, incoming attack or defensive benefit', () => {
    for (const id of ['kiem-vuc', 'dong-menh']) {
        const legacy = resolveBattleTurn(fixture([id]), input(id)).state;
        const warded = structuredClone(legacy); warded.intents[1]!.repeatWard = 750;
        const normal = resolveBattleTurn(legacy, input(id)), guarded = resolveBattleTurn(warded, input(id));
        assert.ok(guarded.rawPlayerDamage < normal.rawPlayerDamage / 2, id);
        assert.equal(guarded.playerHpLost, normal.playerHpLost, id);
        assert.deepEqual(guarded.entries.filter(entry => entry.kind === 'cost'), normal.entries.filter(entry => entry.kind === 'cost'), id);
        assert.deepEqual(guarded.state.statuses.filter(status => status.target === 'player'), normal.state.statuses.filter(status => status.target === 'player'), id);
        assert.equal(guarded.state.player.maxHp, normal.state.player.maxHp);
    }
});

test('late phase blocks the former dominant single cast while two genuinely different offensive choices have a winning path', () => {
    const boss = bossById('than-chu'), loadout = ['kiem-vuc', 'lien-van', 'tuyet-menh'].map(id => ({ id, versionId: 'read_' + id, tier: 3, purityBp: 10000 }));
    const initial = armedBattleState(fighterForRank(boss.recommendedRank), boss, loadout, bossIntents(boss), null);
    assert.equal(repeatTactic(initial, 'kiem-vuc', 300).won, false);
    const solution = searchBattle(initial, 300); assert.ok(solution); assert.ok(new Set(solution.sequence).size >= 2);
    assert.ok(solution.state.player.hp > 0);
    assert.match(initial.intents[0]!.description, /Lặp chiêu/);
    assert.equal(publicGameCatalog().bosses.find(value => value.id === boss.id)!.repeatWard, boss.repeatWard);
    const invalid = structuredClone(initial); invalid.intents[0]!.repeatWard = 851;
    assert.throws(() => resolveBattleTurn(invalid, input('kiem-vuc')), /INVALID_BATTLE_INTENT/);
    const content = structuredClone([boss]); content[0]!.repeatWard = -1;
    assert.throws(() => validateGameContent(content), /INVALID_GAME_CONTENT/);
});
