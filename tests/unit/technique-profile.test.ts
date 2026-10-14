import test from 'node:test';
import assert from 'node:assert/strict';
import { newBattleState, resolveBattleTurn, CURRENT_BATTLE_RULE, type EquippedTechnique } from '../../src/domain/battle.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';
import { newTimePracticeVersion, TIME_PRACTICE_RULE } from '../../src/domain/practice-progression.ts';
import { settlePracticeDay } from '../../src/domain/practice.ts';
import { practiceStrength, profileForPractice, perfectTierProfile, techniqueProfile, tierBattleTechnique } from '../../src/domain/technique-profile.ts';

const strength = (tier: number, factor = 1000) => ({ rule: TIME_PRACTICE_RULE as 'practice-v2', damageFactorMilli: factor,
    effectFactorMilli: 1000 + (tier - 1) * 180, gradeBonusMilli: 0, totalPurityBp: 2500 });
const equipped = (id: string, tier = 2, factor = 1000): EquippedTechnique =>
    ({ id, versionId: 'edition_' + id, tier, purityBp: 0, strength: strength(tier, factor) });
function battle(skills: EquippedTechnique[], damage = 0) {
    return newBattleState({ hp: 1000, maxHp: 1000, attack: 100, armor: 0 }, { hp: 100000, maxHp: 100000, attack: 100, armor: 0 },
        skills, Array.from({ length: 8 }, (_, index) => ({ id: 'intent_' + index, name: 'Đòn thử', description: '', hits: [damage],
            special: false, heal: 0, armorBuff: 0 })), 8, undefined, CURRENT_BATTLE_RULE);
}
const cast = (state: ReturnType<typeof battle>, techniqueId: string) => resolveBattleTurn(state,
    { techniqueId, acceptCost: true, contribution: { habits: 0, tasks: 0 } });

test('all 39 techniques have four finite profiles with common units, full effect rates and no invented crit', () => {
    for (const technique of TECHNIQUES) for (let tier = 1; tier <= 4; tier++) {
        const profile = perfectTierProfile(technique.id, tier);
        assert.ok(Number.isInteger(profile.damage) && profile.damage > 0);
        assert.ok(profile.hits >= 1);
        assert.equal(profile.damage, profile.perHit * profile.hits);
        assert.ok(profile.effects.every(effect => effect.label && effect.timing && (effect.amount === null || Number.isFinite(effect.amount))));
        assert.ok(!profile.effects.some(effect => /Chí mạng|Xuyên Giáp Ảo/.test(effect.label)));
    }
    const sword = perfectTierProfile('kiem-y', 2);
    assert.equal(sword.effects.find(effect => effect.label === 'Xuyên Phòng thủ')!.amount, 40);
    assert.equal(sword.effects.find(effect => effect.label === 'Tăng sát thương nối chiêu')!.amount, 5);
    assert.equal(perfectTierProfile('lien-van', 1).damage, 138);
});

test('derived profile is the engine main-strike value; bleed and conditional attacks do not inflate the headline', () => {
    for (const id of ['kiem-y', 'lien-van', 'huyen-quy', 'minh-ha', 'lac-tu', 'khong-minh', 'tran-son']) {
        const skill = equipped(id), state = battle([skill]);
        const profile = techniqueProfile(id, 2, 0, 100, 0, skill.strength);
        assert.equal(cast(state, id).rawPlayerDamage, profile.damage, id);
    }
    const bleed = techniqueProfile('minh-ha', 2, 0, 100, 0, strength(2));
    assert.equal(bleed.damage, 65);
    assert.ok(bleed.effects.find(effect => effect.label === 'Chảy máu'));
});

test('habit damage results never weaken tier shield and penetration; quality grade is not applied twice', () => {
    const strong = equipped('huyen-quy', 2, 1180), weak = equipped('huyen-quy', 2, 400);
    const full = cast(battle([strong]), 'huyen-quy'), poor = cast(battle([weak]), 'huyen-quy');
    assert.equal(full.state.statuses.find(status => status.kind === 'shield')!.value,
        poor.state.statuses.find(status => status.kind === 'shield')!.value);
    assert.ok(full.rawPlayerDamage > poor.rawPlayerDamage);
    const poorSword = techniqueProfile('kiem-y', 2, 0, 100, 0, strength(2, 400));
    assert.equal(poorSword.effects.find(effect => effect.label === 'Xuyên Phòng thủ')!.amount, 40);
    let version = newTimePracticeVersion('perfect', 'kiem-y', 20738);
    for (let offset = 0; offset < 21; offset++) version = settlePracticeDay(20738 + offset, 'perfect', [version], [],
        [{ habitId: 'one', successes: 1, misses: 0, mature: true, weekly: null }]).versions[0]!;
    assert.equal(practiceStrength(version)!.damageFactorMilli, 1540);
    assert.equal(profileForPractice(version)!.damagePower, 177);
});

test('Kiếm Ý buff requires a cast and only the next different Thiên Kiếm cast consumes its benefit', () => {
    const state = battle([equipped('kiem-y'), equipped('lien-van'), equipped('kim-than')]);
    const first = cast(state, 'kiem-y');
    assert.equal(first.rawPlayerDamage, 110);
    assert.equal(first.state.combo!.value, 50);
    assert.equal(cast(first.state, 'lien-van').rawPlayerDamage, 144, 'three 46 point hits gain five percent each');
    assert.equal(cast(first.state, 'kiem-y').rawPlayerDamage, 110, 'recasting is not a different technique');
    const different = cast(first.state, 'kim-than');
    assert.equal(different.state.combo, null);
    assert.equal(cast(different.state, 'lien-van').rawPlayerDamage, 138);
});

test('Huyền Quy passive triggers after a survived boss hit at low HP once; self sacrifice does not trigger it', () => {
    const state = battle([equipped('huyen-quy'), equipped('kiem-y'), equipped('huyet-sat')], 20);
    state.player.hp = 360;
    const first = cast(state, 'kiem-y');
    assert.deepEqual(first.state.passiveUses, ['huyen-quy']);
    assert.equal(first.state.statuses.find(status => status.key === 'huyen-quy:shield:passive')!.value, 200);
    const second = cast(first.state, 'kiem-y');
    assert.equal(second.entries.filter(entry => entry.source === 'huyen-quy').length, 0);
    const sacrifice = battle([equipped('huyen-quy'), equipped('huyet-sat')], 0);
    sacrifice.player.hp = 400;
    assert.equal(cast(sacrifice, 'huyet-sat').state.passiveUses?.length ?? 0, 0);
    const fatal = battle([equipped('huyen-quy'), equipped('kiem-y')], 400);
    fatal.player.hp = 360;
    assert.equal(cast(fatal, 'kiem-y').state.status, 'awaiting_rescue');
    assert.equal(cast(fatal, 'kiem-y').state.passiveUses?.length ?? 0, 0);
});

test('equipped Huyền Quy supports a damage rotation through a lethal sequence without casting itself', () => {
    const enabled = battle([equipped('huyen-quy'), equipped('kiem-y')], 20);
    enabled.player.hp = 360;
    enabled.intents[1]!.hits = [250]; enabled.intents[2]!.hits = [250];
    const spent = structuredClone(enabled); spent.passiveUses = ['huyen-quy'];
    let protectedRun = enabled, unprotectedRun = spent;
    for (let turn = 0; turn < 3; turn++) {
        protectedRun = cast(protectedRun, 'kiem-y').state;
        unprotectedRun = cast(unprotectedRun, 'kiem-y').state;
    }
    assert.equal(protectedRun.status, 'active'); assert.equal(protectedRun.player.hp, 40);
    assert.equal(unprotectedRun.status, 'awaiting_rescue'); assert.equal(unprotectedRun.player.hp, 0);
    assert.deepEqual(protectedRun.passiveUses, ['huyen-quy']);
    assert.equal(protectedRun.lastUses['huyen-quy'], undefined, 'The support activates from carrying the technique');
    assert.equal(protectedRun.boss.hp, unprotectedRun.boss.hp, 'Survival does not secretly add offensive power');
});

test('low-HP Thôn Thiên bonus requires its own cast and heals only actual HP loss', () => {
    const state = battle([equipped('thon-thien'), equipped('kiem-y')]);
    state.player.hp = 400;
    assert.equal(cast(state, 'thon-thien').state.player.hp, 445);
    assert.equal(cast(state, 'kiem-y').state.player.hp, 400);
    state.statuses.push({ key: 'boss:shield', target: 'boss', kind: 'shield', value: 1000, expiresTurn: 2, dueTurn: null });
    assert.equal(cast(state, 'thon-thien').state.player.hp, 400);
    assert.ok(tierBattleTechnique('thon-thien', 1).effects.every(effect => effect.kind !== 'lifesteal' || !effect.lowHpBonus));
});
