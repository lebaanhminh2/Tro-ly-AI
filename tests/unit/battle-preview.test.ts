import test from 'node:test';
import assert from 'node:assert/strict';
import { battleChoiceDetail, publicBattleState, newBattleState, resolveBattleTurn, CURRENT_BATTLE_RULE } from '../../src/domain/battle.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';
import { absorbBattleHit } from '../../src/domain/battle-armor.ts';

function battle(id = 'kiem-y', tier = 4) {
    return newBattleState({ hp: 1800, maxHp: 2000, attack: 100, armor: 20 },
        { hp: 5000, maxHp: 5000, attack: 100, armor: 30 },
        [{ id, versionId: 'preview_edition', tier, purityBp: 10000, strength: { rule: 'practice-v2',
            damageFactorMilli: 1000 + (tier - 1) * 180, effectFactorMilli: 1000 + (tier - 1) * 180,
            gradeBonusMilli: tier === 4 ? 150 : 0, totalPurityBp: tier * 2500 } }],
        Array.from({ length: 5 }, (_, index) => ({ id: 'intent_' + index, name: 'Đòn đã báo', description: 'Hai đòn',
            hits: [100, 80], special: index % 2 === 0, heal: 0, armorBuff: 0 })), 5, { remaining: 1, hpPercent: 350 }, CURRENT_BATTLE_RULE);
}

test('every technique preview is a pure production-resolution result with one raw damage profile', () => {
    for (const technique of TECHNIQUES) {
        const state = battle(technique.id), before = structuredClone(state);
        state.foresightThrough = 2; before.foresightThrough = 2;
        state.statuses.push({ key: 'fixture:shield', kind: 'shield', target: 'boss', value: 50, expiresTurn: 2, dueTurn: null });
        before.statuses = structuredClone(state.statuses);
        const detail = battleChoiceDetail(state, technique.id);
        const actual = resolveBattleTurn(state, { techniqueId: technique.id, acceptCost: true, contribution: { habits: 0, tasks: 0 } });
        assert.equal(detail.preview.kind, 'resolved', technique.id);
        if (detail.preview.kind !== 'resolved') throw Error(technique.id);
        assert.equal(detail.preview.playerHp, actual.state.player.hp, technique.id);
        assert.equal(detail.preview.bossHpLost, actual.bossHpLost, technique.id);
        assert.deepEqual(detail.preview.entries, actual.entries, technique.id);
        assert.equal(publicBattleState(state).choices.find(choice => choice.id === technique.id)!.damage, detail.profile.damage);
        assert.deepEqual(state, before, 'preview must not mutate ' + technique.id);
    }
});

test('hidden swapped intent cannot be inferred from preview numbers, costs, logs or outcomes', () => {
    const first = battle('nghich-thien'), second = structuredClone(first);
    second.intents[1]!.hits = [2000]; second.intents[1]!.name = 'Secret next attack';
    assert.deepEqual(battleChoiceDetail(first, 'nghich-thien'), battleChoiceDetail(second, 'nghich-thien'));
    assert.equal(battleChoiceDetail(first, 'nghich-thien').preview.kind, 'hidden_intent');
    assert.equal(JSON.stringify(battleChoiceDetail(second, 'nghich-thien')).includes('Secret next attack'), false);
    second.foresightThrough = 2;
    assert.equal(battleChoiceDetail(second, 'nghich-thien').preview.kind, 'resolved');
    assert.equal(publicBattleState(second).announced.length, 2);
});

test('preview reflects actual HP affordability, cooldown and survival separately from raw profile', () => {
    const cost = battle('huyet-sat'); cost.player.hp = 100;
    assert.equal(battleChoiceDetail(cost, 'huyet-sat').preview.kind, 'unavailable');
    const cooldown = battle('phong-than'); cooldown.turn = 1; cooldown.lastUses['phong-than'] = 1;
    assert.equal(battleChoiceDetail(cooldown, 'phong-than').preview.kind, 'unavailable');
    const lastHp = battle('tang-nhat');
    const detail = battleChoiceDetail(lastHp, 'tang-nhat');
    assert.equal(detail.profile.cost.endAtOneHp, true);
    assert.equal(detail.preview.kind, 'resolved');
    if (detail.preview.kind === 'resolved') assert.equal(detail.preview.status, 'awaiting_rescue');
    assert.throws(() => battleChoiceDetail(lastHp, 'not-equipped'), /NOT_EQUIPPED/);
});

test('hit breakdown reconciles each layer, its break between hits, incoming amplification and overkill', () => {
    const original = { hp: 100, armor: 20, shield: 15, virtualArmor: 10, reduction: 200 };
    const first = absorbBattleHit(original, 100, 500);
    assert.deepEqual(first.breakdown, { raw: 100, reductionAdjustment: 20, armorBlocked: 10, virtualReduced: 28,
        virtualAbsorbed: 10, shieldAbsorbed: 15, hpLost: 17, overflow: 0 });
    assert.equal(original.hp, 100, 'inspection does not mutate its input');
    const next = absorbBattleHit(first.defense, 100, 500);
    assert.equal(next.breakdown.virtualReduced, 0, 'a broken layer gives no reduction on the next hit');
    assert.equal(next.hpLost, 70);
    const amplified = absorbBattleHit({ hp: 50, armor: 0, shield: 0, virtualArmor: 0, reduction: -250 }, 100);
    assert.equal(amplified.breakdown.reductionAdjustment, -25);
    assert.equal(amplified.breakdown.overflow, 75);
    const blocked = absorbBattleHit({ ...original, armor: 1000 }, 10);
    assert.equal(blocked.breakdown.armorBlocked, 8, 'only actual incoming damage is counted as blocked');
    for (const result of [first, next, amplified, blocked]) {
        const { raw, ...parts } = result.breakdown;
        assert.equal(Object.values(parts).reduce((sum, value) => sum + value, 0), raw);
        assert.equal(result.breakdown.hpLost, result.hpLost);
    }
});

test('v2 log explains each hit without changing legacy combat or legacy entry text', () => {
    const legacy = newBattleState({ hp: 500, maxHp: 500, attack: 100, armor: 20 },
        { hp: 500, maxHp: 500, attack: 50, armor: 20 }, [],
        [{ id: 'log_hit', name: 'Đòn đã báo', description: '', hits: [100, 80], special: false, heal: 0, armorBuff: 0 }], 1);
    legacy.statuses.push({ key: 'log:virtual', kind: 'virtual_armor', target: 'boss', value: 10, expiresTurn: 1, dueTurn: null },
        { key: 'log:shield', kind: 'shield', target: 'boss', value: 15, expiresTurn: 1, dueTurn: null });
    const modern = structuredClone(legacy); modern.rule = CURRENT_BATTLE_RULE;
    const input = { techniqueId: 'vo-ky', acceptCost: false, contribution: { habits: 0, tasks: 0 } };
    const oldResult = resolveBattleTurn(legacy, input), newResult = resolveBattleTurn(modern, input);
    assert.deepEqual(newResult.state.player, oldResult.state.player);
    assert.deepEqual(newResult.state.boss, oldResult.state.boss);
    assert.deepEqual(newResult.state.statuses, oldResult.state.statuses);
    assert.equal(newResult.state.status, oldResult.state.status);
    assert.equal(newResult.rawPlayerDamage, oldResult.rawPlayerDamage);
    assert.equal(newResult.playerHpLost, oldResult.playerHpLost);
    assert.equal(oldResult.entries.some(entry => entry.hit), false);
    assert.match(oldResult.entries[0]!.text, /^Đối thủ mất \d+ HP\.$/);
    assert.match(newResult.entries[0]!.text, /Sát thương thô 100.*Phòng thủ chặn 20.*Giáp Ảo.*Khiên hấp thụ/);
    assert.equal(newResult.entries.filter(entry => entry.hit).length, 3);
});
