import test from 'node:test';
import assert from 'node:assert/strict';
import { absorbBattleHit, type BattleDefense } from '../../src/domain/battle-armor.ts';
import { BATTLE_TECHNIQUES, battleTechnique, validateBattleTechniques } from '../../src/domain/battle-techniques.ts';
import { newBattleState, resolveBattleTurn, rescueBattle, publicBattleState, validateBattleState, withdrawBattle, acceptBattleDeath, type BossIntent } from '../../src/domain/battle.ts';

test('virtual armor applies its reduction per hit and loses it immediately after breaking', () => {
    for (const [armor, hits, losses] of [[20, [100, 100], [40, 100]], [110, [100, 100, 100], [0, 10, 100]]] as const) {
        let defense: BattleDefense = { hp: 1000, armor: 0, shield: 0, virtualArmor: armor, reduction: 0 };
        const actual = hits.map(hit => { const result = absorbBattleHit(defense, hit); defense = result.defense; return result.hpLost; });
        assert.deepEqual(actual, losses);
    }
});

test('stored snapshots reject corrupt statuses, impossible outcomes, invented skills and nonfinite values', () => {
    const cases = [
        (state: ReturnType<typeof battle>) => { state.player.attack = Number.MAX_SAFE_INTEGER; },
        (state: ReturnType<typeof battle>) => { state.status = 'won'; },
        (state: ReturnType<typeof battle>) => { state.revival.remaining = -1; },
        (state: ReturnType<typeof battle>) => { state.loadout[0]!.id = 'invented'; },
        (state: ReturnType<typeof battle>) => { state.intents[0]!.heal = NaN; },
        (state: ReturnType<typeof battle>) => { state.statuses.push({ key: 'evil', kind: 'shield', target: 'player', value: -50, expiresTurn: 1, dueTurn: null }); },
        (state: ReturnType<typeof battle>) => { state.lastUses['vo-ky'] = 100; },
        (state: ReturnType<typeof battle>) => { state.seals = ['invented']; },
    ];
    for (const corrupt of cases) { const state = battle(); corrupt(state); assert.throws(() => validateBattleState(state)); }
});

test('Lac Tu leaves a preparation day for That Tinh; consuming a mark prevents its later duplicate explosion', () => {
    const initial = battle(['lac-tu', 'that-tinh'], 1000, 9000, [1]);
    const prepared = resolveBattleTurn(initial, choose('lac-tu')).state;
    const combined = resolveBattleTurn(prepared, choose('that-tinh'));
    const unprepared = resolveBattleTurn(initial, choose('that-tinh'));
    assert.ok(combined.rawPlayerDamage > unprepared.rawPlayerDamage);
    assert.equal(combined.state.statuses.filter(status => status.kind === 'mark').length, 0);
    assert.equal(resolveBattleTurn(combined.state, choose('vo-ky')).entries.filter(entry => entry.source?.includes('mark')).length, 0);
});

test('mutual fatal reflection waits for a paid rescue or death; announced revival cannot be bypassed', () => {
    const initial = battle(['phan-chan'], 100, 74, [100]);
    let fatal = resolveBattleTurn(initial, choose('phan-chan')).state;
    assert.equal(fatal.player.hp, 0); assert.equal(fatal.boss.hp, 0); assert.equal(fatal.status, 'awaiting_rescue');
    assert.equal(rescueBattle(fatal, 'qi').status, 'won');
    assert.equal(acceptBattleDeath(fatal).status, 'dead');
    assert.throws(() => withdrawBattle(fatal), /BATTLE_WITHDRAWAL_UNAVAILABLE/);
    initial.revival = { remaining: 1, hpPercent: 500 };
    fatal = resolveBattleTurn(initial, choose('phan-chan')).state;
    assert.equal(fatal.revival.remaining, 0); assert.equal(fatal.boss.hp, 37);
    assert.equal(rescueBattle(fatal, 'qi').status, 'active');
});

test('public view reveals only announced intent, foresight adds two upcoming actions, and swaps retain the final action', () => {
    const initial = battle(['quan-thien', 'nghich-thien'], 1000, 9000, [1], 4);
    initial.intents.forEach((action, index) => { action.id = 'intent-' + index; });
    let state = resolveBattleTurn(initial, choose('quan-thien')).state;
    assert.deepEqual(publicBattleState(initial).announced.map(row => row.intent.id), ['intent-0']);
    assert.deepEqual(publicBattleState(state).announced.map(row => row.intent.id), ['intent-1', 'intent-2']);
    state = resolveBattleTurn(state, choose('nghich-thien')).state;
    assert.equal(state.lastBossIntent!.id, 'intent-2');
    assert.equal(publicBattleState(state).announced[0]!.intent.id, 'intent-1');
    state = resolveBattleTurn(state, choose('vo-ky')).state;
    state = resolveBattleTurn(state, choose('nghich-thien')).state;
    assert.equal(state.lastBossIntent!.id, 'intent-3'); assert.equal(state.status, 'expired');
    assert.equal(publicBattleState(state).announced.length, 0);
});
test('armor penetration, bounded reduction, shield and actual HP loss have a single deterministic order', () => {
    const before = { hp: 50, armor: 20, shield: 10, virtualArmor: 0, reduction: 300 };
    const result = absorbBattleHit(before, 100, 500);
    assert.equal(result.hpLost, 50); assert.equal(result.shieldAbsorbed, 10); assert.equal(result.defense.hp, 0);
    assert.deepEqual(before, { hp: 50, armor: 20, shield: 10, virtualArmor: 0, reduction: 300 });
    assert.throws(() => absorbBattleHit(before, 100, 2000), /INVALID_BATTLE_HIT/);
    assert.equal(absorbBattleHit({ ...before, armor: 500 }, 100).hpLost, 0);
});
test('all 39 techniques define finite effects, distinct tactical combinations and explicit sacrifice warnings', () => {
    validateBattleTechniques();
    assert.equal(new Set(BATTLE_TECHNIQUES.map(spec => JSON.stringify(spec.effects))).size, 39);
    assert.equal(battleTechnique('nghich-menh').cost.hpPercent, 0);
    assert.equal(battleTechnique('nghich-menh').cost.maxHpPercent, 0);
    assert.ok(battleTechnique('nghich-menh').effects.some(effect => effect.kind === 'rank_rescue'));
    for (const spec of BATTLE_TECHNIQUES) if (spec.cost.hpPercent || spec.cost.maxHpPercent || spec.cost.endAtOneHp)
        assert.ok(spec.warning, spec.id + ' must expose its sacrifice before choosing');
    const seals = BATTLE_TECHNIQUES.flatMap(spec => spec.effects.filter(effect => effect.kind === 'sword_seal'));
    assert.equal(new Set(seals.map(effect => effect.kind === 'sword_seal' ? effect.id : '')).size, 4);
});

const intent = (hits = [20], special = false): BossIntent => ({ id: 'counter', name: 'Phản công', hits, special, heal: 0, armorBuff: 0, description: 'Đòn đã báo trước.' });
function battle(ids = ['kiem-y'], hp = 120, bossHp = 300, hits = [20], turns = 8) {
    return newBattleState({ hp, maxHp: hp, armor: 0, attack: 30 }, { hp: bossHp, maxHp: bossHp, armor: 0, attack: 20 },
        ids.map(id => ({ id, versionId: 'v_' + id, tier: 1, purityBp: 10000 })), Array.from({ length: turns }, () => intent(hits)), turns);
}
const choose = (techniqueId: string, acceptCost = true) => ({ techniqueId, acceptCost, contribution: { habits: 0, tasks: 0 } });
test('player attacks first, true death has no counterattack, and a announced revival remains part of the current turn', () => {
    const initial = battle(['kiem-y'], 100, 20, [999]);
    const won = resolveBattleTurn(initial, choose('kiem-y'));
    assert.equal(won.state.status, 'won'); assert.equal(won.state.player.hp, 100); assert.equal(won.playerHpLost, 0);
    assert.equal(initial.boss.hp, 20, 'Input snapshot is immutable');
    initial.revival = { remaining: 1, hpPercent: 1000 };
    const revived = resolveBattleTurn(initial, choose('kiem-y'));
    assert.equal(revived.state.revival.remaining, 0); assert.equal(revived.state.status, 'awaiting_rescue');
    assert.equal(revived.playerHpLost, 100); assert.ok(revived.entries.some(entry => entry.kind === 'revive'));
});
test('fatal multi-hit pauses at the lethal hit and a shared rescue cannot be used twice or chosen retroactively', () => {
    let state = battle(['nghich-menh'], 100, 1000, [80, 80, 80]);
    const fatal = resolveBattleTurn(state, choose('nghich-menh'));
    assert.equal(fatal.state.status, 'awaiting_rescue'); assert.equal(fatal.rankRescuePrepared, true);
    assert.equal(fatal.entries.filter(entry => entry.kind === 'boss').length, 2);
    state = rescueBattle(fatal.state, 'rank');
    assert.equal(state.player.hp, 35); assert.equal(state.rescueUsed, true); assert.equal(state.turn, 1);
    const second = resolveBattleTurn(state, choose('vo-ky'));
    assert.equal(second.state.status, 'dead'); assert.throws(() => rescueBattle(second.state, 'qi'), /BATTLE_RESCUE_UNAVAILABLE/);
    const unprepared = resolveBattleTurn(battle(['kiem-y'], 50, 1000, [80]), choose('kiem-y'));
    assert.throws(() => rescueBattle(unprepared.state, 'rank'), /BATTLE_RESCUE_UNAVAILABLE/);
    assert.equal(rescueBattle(unprepared.state, 'qi').rescueUsed, true);
});
test('sacrifices are explicit, retained on a winning cast, and never charge for a cast skipped after a delayed killing effect', () => {
    const state = battle(['tang-nhat'], 120, 20, [999]);
    assert.throws(() => resolveBattleTurn(state, choose('tang-nhat', false)), /BATTLE_COST_NOT_ACCEPTED/);
    const won = resolveBattleTurn(state, choose('tang-nhat'));
    assert.equal(won.state.status, 'won'); assert.equal(won.state.player.hp, 1);
    state.statuses.push({ key: 'mark', kind: 'mark', target: 'boss', value: 50, expiresTurn: 2, dueTurn: 1 });
    const delayed = resolveBattleTurn(state, choose('tang-nhat'));
    assert.equal(delayed.state.status, 'won'); assert.equal(delayed.state.player.hp, 120);
    assert.equal(delayed.entries.filter(entry => entry.kind === 'cost').length, 0);
    const blood = battle(['huyet-sat']); blood.player.hp = 10;
    assert.throws(() => resolveBattleTurn(blood, choose('huyet-sat')), /BATTLE_INSUFFICIENT_HP/);
});
test('four different seals need four preparation days, duplicates do not count, and the fifth cast is a one-use burst', () => {
    let state = battle(['son-ha', 'huyet-trieu', 'kiep-dong', 'van-co', 'van-thien'], 1000, 5000, [1], 17);
    const cast = (id: string) => { const result = resolveBattleTurn(state, choose(id)); state = result.state; return result; };
    cast('son-ha'); cast('son-ha'); assert.equal(state.seals.length, 1);
    cast('huyet-trieu'); cast('kiep-dong'); cast('van-co'); assert.equal(state.seals.length, 4);
    const burst = cast('van-thien'); assert.equal(state.burstUsed, true); assert.equal(state.seals.length, 0);
    const normal = cast('van-thien'); assert.ok(burst.rawPlayerDamage > normal.rawPlayerDamage * 2);
});
test('marks, echoes and seals remain bounded; repeated sealing leaves an unsealed counter turn', () => {
    let state = battle(['phong-than', 'van-co'], 1000, 9000, [300], 17);
    state.intents.forEach(action => { action.special = true; });
    const sealed = resolveBattleTurn(state, choose('phong-than')); state = sealed.state;
    assert.equal(sealed.playerHpLost, 20);
    assert.throws(() => resolveBattleTurn(state, choose('phong-than')), /BATTLE_TECHNIQUE_COOLDOWN/);
    const echo = resolveBattleTurn(state, choose('van-co')); state = echo.state;
    assert.equal(echo.playerHpLost, 20);
    const gap = resolveBattleTurn(state, choose('vo-ky'));
    assert.equal(gap.playerHpLost, 300); assert.equal(gap.state.statuses.filter(status => status.kind === 'echo').length, 0);
    assert.equal(gap.entries.filter(entry => entry.source?.includes('echo')).length, 1);
});
test('all 39 casts preserve finite HP/status bounds at every tier and purity sample with both low and full habit contributions', () => {
    for (const technique of BATTLE_TECHNIQUES) for (const tier of [1, 2, 3, 4]) for (const purityBp of [100, 5000, 10000]) for (const habits of [0, 600]) {
        const state = battle([technique.id], 1000, 9000, [20, 20], 17);
        state.loadout[0]!.tier = tier; state.loadout[0]!.purityBp = purityBp;
        const result = resolveBattleTurn(state, { ...choose(technique.id), contribution: { habits, tasks: 100 } });
        assert.ok(Number.isSafeInteger(result.state.player.hp) && result.state.player.hp >= 0 && result.state.player.hp <= result.state.player.maxHp, technique.id);
        if (result.state.player.hp === 0) assert.ok(['awaiting_rescue', 'dead'].includes(result.state.status), technique.id);
        if (technique.id === 'tang-nhat') {
            assert.equal(result.state.status, 'awaiting_rescue');
            assert.ok(result.entries.some(entry => entry.kind === 'cost' && entry.text.includes('1 HP')));
        }
        assert.ok(Number.isSafeInteger(result.state.boss.hp) && result.state.boss.hp >= 0 && result.state.boss.hp <= result.state.boss.maxHp, technique.id);
        assert.ok(result.state.statuses.length <= 24); assert.equal(result.state.turn, 1);
    }
});
