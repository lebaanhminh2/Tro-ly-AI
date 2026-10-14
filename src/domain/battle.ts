import { absorbBattleHit, type BattleDefense, type BattleHitBreakdown } from './battle-armor.ts';
import { techniqueById } from './techniques.ts';
import { tierBattleTechnique, techniquePowers, techniqueProfile, type TechniqueProfile, type TechniqueStrength } from './technique-profile.ts';

export const BATTLE_RULE = 'battle-v1';
export const CURRENT_BATTLE_RULE = 'battle-v2';
const MAX_STAT = 1000000;
const STATUS_KINDS = ['shield', 'virtual_armor', 'reduction', 'reflect', 'bleed', 'attack_buff', 'mark', 'echo', 'seal'];
const SWORD_SEALS = ['mountain', 'blood', 'storm', 'echo'];
export type BossIntent = { id: string; name: string; hits: number[]; special: boolean;
    heal: number; armorBuff: number; description: string; repeatWard?: number };
export type BattleFighter = { hp: number; maxHp: number; attack: number; armor: number };
export type EquippedTechnique = { id: string; versionId: string; tier: number; purityBp: number; strength?: TechniqueStrength };
export type BattleStatus = { key: string; kind: 'shield' | 'virtual_armor' | 'reduction' | 'reflect' | 'bleed' | 'attack_buff' | 'mark' | 'echo' | 'seal';
    target: 'player' | 'boss'; value: number; expiresTurn: number; dueTurn: number | null };
export type BattleState = {
    rule: string; turn: number; maxTurns: number; status: 'active' | 'won' | 'awaiting_rescue' | 'dead' | 'expired' | 'withdrawn';
    player: BattleFighter; boss: BattleFighter; loadout: EquippedTechnique[]; intents: BossIntent[];
    statuses: BattleStatus[]; guard: number; illusion: boolean; seals: string[]; burstUsed: boolean;
    lastUses: Record<string, number>;
    rescueUsed: boolean; fatalTechnique: string | null; foresightThrough: number; exchangeAfterTurn: number | null;
    revival: { remaining: number; hpPercent: number }; lastBossIntent: BossIntent | null;
    combo?: { source: string; school: string; value: number; turn: number } | null;
    passiveUses?: string[];
};
export type BattleTurnInput = { techniqueId: string; contribution: { habits: number; tasks: number }; acceptCost: boolean };
export type BattleLogEntry = { kind: 'strike' | 'defend' | 'heal' | 'cost' | 'effect' | 'boss' | 'revive' | 'end';
    text: string; amount?: number; source?: string; hit?: BattleHitBreakdown };
export type BattleTurnResult = { state: BattleState; entries: BattleLogEntry[]; intent: BossIntent; rankRescuePrepared: boolean;
    rawPlayerDamage: number; bossHpLost: number; playerHpLost: number };
const scale = (value: number, factor: number) => Math.max(0, Math.floor(value * factor / 1000));
const health = (fighter: BattleFighter, amount: number) => { const added = Math.min(Math.max(0, amount), fighter.maxHp - fighter.hp); fighter.hp += added; return added; };
export function validateBattleState(state: BattleState): void {
    if (![BATTLE_RULE, CURRENT_BATTLE_RULE].includes(state.rule)) throw Error('BATTLE_RULE_UNSUPPORTED');
    if (state.turn < 0 || state.turn > 17 || !Number.isInteger(state.turn) || !Number.isInteger(state.maxTurns) || state.maxTurns < 1 || state.maxTurns > 17 ||
        state.loadout.length > 5 || new Set(state.loadout.map(item => item.id)).size !== state.loadout.length || state.intents.length < state.maxTurns ||
        state.intents.length > 17 || state.statuses.length > 24 || !Number.isInteger(state.guard) || state.guard < 0 || state.guard > 3 ||
        state.seals.length > 4 || new Set(state.seals).size !== state.seals.length || state.seals.some(id => !SWORD_SEALS.includes(id)) ||
        !['active', 'won', 'awaiting_rescue', 'dead', 'expired', 'withdrawn'].includes(state.status) ||
        ![state.illusion, state.burstUsed, state.rescueUsed].every(value => typeof value === 'boolean') ||
        !Number.isInteger(state.foresightThrough) || state.foresightThrough < 0 || state.foresightThrough > 19 ||
        state.exchangeAfterTurn !== null && (!Number.isInteger(state.exchangeAfterTurn) || state.exchangeAfterTurn !== state.turn) ||
        state.fatalTechnique !== null && state.fatalTechnique !== 'nghich-menh' ||
        !Number.isInteger(state.revival.remaining) || state.revival.remaining < 0 || state.revival.remaining > 3 ||
        !Number.isInteger(state.revival.hpPercent) || state.revival.hpPercent < 1 || state.revival.hpPercent > 1000)
        throw Error('INVALID_BATTLE_STATE');
    for (const fighter of [state.player, state.boss]) if (![fighter.hp, fighter.maxHp, fighter.attack, fighter.armor].every(Number.isSafeInteger) ||
        fighter.hp < 0 || fighter.hp > fighter.maxHp || fighter.maxHp < 1 || fighter.maxHp > MAX_STAT ||
        fighter.attack < 1 || fighter.attack > MAX_STAT || fighter.armor < 0 || fighter.armor > MAX_STAT) throw Error('INVALID_BATTLE_STATE');
    for (const skill of state.loadout) {
        if (!/^[a-zA-Z0-9_-]{2,110}$/.test(skill.versionId) || !Number.isInteger(skill.tier) || skill.tier < 1 || skill.tier > 4 ||
            !Number.isInteger(skill.purityBp) || skill.purityBp < (skill.strength ? 0 : 100) || skill.purityBp > 10000 ||
            skill.strength && state.rule !== CURRENT_BATTLE_RULE) throw Error('INVALID_BATTLE_LOADOUT');
        techniqueById(skill.id);
        if (skill.strength) techniquePowers(state.player.attack, skill.tier, skill.purityBp, 0, skill.strength);
    }
    if (state.combo && (state.rule !== CURRENT_BATTLE_RULE || state.combo.source !== 'kiem-y' || state.combo.school !== 'thien-kiem' ||
        ![50, 100, 150].includes(state.combo.value) || state.combo.turn !== state.turn + 1)) throw Error('INVALID_BATTLE_COMBO');
    if (state.passiveUses && (state.passiveUses.length > 1 || new Set(state.passiveUses).size !== state.passiveUses.length ||
        state.passiveUses.some(id => id !== 'huyen-quy'))) throw Error('INVALID_BATTLE_PASSIVE');
    function validateIntent(intent: BossIntent) {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(intent.id) || typeof intent.name !== 'string' || intent.name.length < 1 || intent.name.length > 120 ||
            typeof intent.description !== 'string' || intent.description.length > 600 || typeof intent.special !== 'boolean' ||
            intent.hits.length < 1 || intent.hits.length > 5 ||
            intent.repeatWard !== undefined && (!Number.isInteger(intent.repeatWard) || intent.repeatWard < 0 || intent.repeatWard > 850) ||
            ![...intent.hits, intent.heal, intent.armorBuff].every(value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_STAT))
            throw Error('INVALID_BATTLE_INTENT');
    }
    state.intents.forEach(validateIntent);
    if (state.lastBossIntent) validateIntent(state.lastBossIntent);
    for (const [id, turn] of Object.entries(state.lastUses)) {
        if (id !== 'vo-ky') techniqueById(id);
        if (!Number.isInteger(turn) || turn < 1 || turn > state.turn) throw Error('INVALID_BATTLE_STATE');
    }
    if (Object.keys(state.lastUses).length > 40 || new Set(state.statuses.map(status => status.key)).size !== state.statuses.length)
        throw Error('INVALID_BATTLE_STATE');
    for (const status of state.statuses) if (!STATUS_KINDS.includes(status.kind) || !['player', 'boss'].includes(status.target) ||
        !/^[a-zA-Z0-9_:-]{1,150}$/.test(status.key) || !Number.isSafeInteger(status.value) || status.value < (status.kind === 'reduction' ? -500 : 0) ||
        status.value > MAX_STAT || !Number.isInteger(status.expiresTurn) || status.expiresTurn < state.turn || status.expiresTurn > state.turn + 4 ||
        status.dueTurn !== null && (!Number.isInteger(status.dueTurn) || status.dueTurn < 1 || status.dueTurn > status.expiresTurn) ||
        state.statuses.filter(peer => peer.kind === status.kind && peer.target === status.target).length > 2)
        throw Error('INVALID_BATTLE_STATE');
    if (state.status === 'active' && (!state.player.hp || !state.boss.hp || state.turn >= state.maxTurns) ||
        state.status === 'won' && (!state.player.hp || state.boss.hp !== 0 || state.revival.remaining !== 0) ||
        ['awaiting_rescue', 'dead'].includes(state.status) && state.player.hp !== 0 ||
        state.status === 'awaiting_rescue' && state.rescueUsed || state.status === 'expired' && state.turn < state.maxTurns)
        throw Error('INVALID_BATTLE_STATE');
}
export function newBattleState(player: BattleFighter, boss: BattleFighter, loadout: EquippedTechnique[], intents: BossIntent[],
    maxTurns: number, revival = { remaining: 0, hpPercent: 350 }, rule = BATTLE_RULE): BattleState {
    const value: BattleState = { rule, turn: 0, maxTurns, status: 'active', player: { ...player }, boss: { ...boss },
        loadout: loadout.map(item => ({ ...item })), intents: intents.map(intent => ({ ...intent, hits: [...intent.hits] })),
        statuses: [], guard: 0, illusion: false, seals: [], burstUsed: false, lastUses: {}, rescueUsed: false, fatalTechnique: null,
        foresightThrough: 0, exchangeAfterTurn: null, revival: { ...revival }, lastBossIntent: null };
    validateBattleState(value); return value;
}

export function resolveBattleTurn(before: BattleState, input: BattleTurnInput): BattleTurnResult {
    validateBattleState(before);
    if (before.status !== 'active' || before.player.hp <= 0 || before.boss.hp <= 0 || before.turn >= before.maxTurns) throw Error('BATTLE_NOT_ACTIVE');
    if (![input.contribution.habits, input.contribution.tasks].every(Number.isInteger) || input.contribution.habits < 0 || input.contribution.habits > 600 ||
        input.contribution.tasks < 0 || input.contribution.tasks > 100 || typeof input.acceptCost !== 'boolean') throw Error('INVALID_BATTLE_CONTRIBUTION');
    const equipped = before.loadout.find(item => item.id === input.techniqueId);
    if (input.techniqueId !== 'vo-ky' && !equipped) throw Error('BATTLE_TECHNIQUE_NOT_EQUIPPED');
    const spec = input.techniqueId === 'vo-ky' ? null : tierBattleTechnique(input.techniqueId, equipped!.tier, !!equipped?.strength);
    if (spec?.warning && !input.acceptCost) throw Error('BATTLE_COST_NOT_ACCEPTED');
    if (input.techniqueId === 'phong-than' && before.lastUses[input.techniqueId] !== undefined && before.turn + 1 - before.lastUses[input.techniqueId]! < 3)
        throw Error('BATTLE_TECHNIQUE_COOLDOWN');
    const state = structuredClone(before), entries: BattleLogEntry[] = [];
    state.turn++; state.fatalTechnique = null; state.exchangeAfterTurn = null;
    state.statuses = state.statuses.filter(status => status.expiresTurn >= state.turn);
    let intent = state.intents[state.turn - 1]!;
    let rawPlayerDamage = 0, bossHpLost = 0, playerHpLost = 0, rankRescuePrepared = false, lifeSteal = 0, dodge = false;
    // A defender's announced stance anticipates a repeated cast. Old saved
    // intents have no ward and retain their exact battle-v1 behavior. The
    // stance is fixed before an intent swap, and also covers delayed damage
    // and reflect in this turn; switching casts breaks it completely.
    const repeatWard = before.lastUses[input.techniqueId] === before.turn ? (intent.repeatWard ?? 0) : 0;
    if (repeatWard) entries.push({ kind: 'effect', text: 'Đối thủ đọc được chiêu lặp: sát thương gây ra lượt này giảm ' + repeatWard / 10 + '%.' });
    const bonus = input.contribution.habits + input.contribution.tasks;
    const powers = equipped ? techniquePowers(state.player.attack, equipped.tier, equipped.purityBp, bonus, equipped.strength) :
        { damagePower: Math.max(1, scale(state.player.attack, 1000 + bonus)), effectPower: Math.max(1, scale(state.player.attack, 1000 + bonus)) };
    const basePower = powers.damagePower, supportPower = powers.effectPower;
    const combo = state.combo;
    const comboBonus = combo && combo.turn === state.turn && combo.source !== input.techniqueId && equipped &&
        techniqueById(equipped.id).school === combo.school ? combo.value : 0;
    if (state.rule === CURRENT_BATTLE_RULE) state.combo = null; // next giao chiến only, even when another school casts
    const active = (kind: BattleStatus['kind'], target: BattleStatus['target']) => state.statuses.filter(item => item.kind === kind && item.target === target);
    const total = (kind: BattleStatus['kind'], target: BattleStatus['target']) => active(kind, target).reduce((sum, item) => sum + item.value, 0);
    function addStatus(kind: BattleStatus['kind'], target: BattleStatus['target'], value: number, turns: number, suffix = '', dueTurn: number | null = null) {
        const key = input.techniqueId + ':' + kind + ':' + suffix;
        // A kind occupies at most two slots per target; repeated use refreshes,
        // never creates an unbounded stack or indefinitely stored giant shield.
        state.statuses = state.statuses.filter(item => item.key !== key);
        const peers = active(kind, target);
        if (peers.length >= 2) state.statuses = state.statuses.filter(item => item !== peers[0]);
        state.statuses.push({ key, kind, target, value, expiresTurn: state.turn + turns - 1, dueTurn });
    }
    function consume(kind: BattleStatus['kind'], target: BattleStatus['target'], amount: number) {
        for (const status of active(kind, target)) { const used = Math.min(amount, status.value); status.value -= used; amount -= used; }
    }
    function hit(target: BattleStatus['target'], raw: number, pierce: number, source: string): number {
        if (target === 'boss' && repeatWard) raw = scale(raw, 1000 - repeatWard);
        const fighter = state[target];
        const defense: BattleDefense = { hp: fighter.hp, armor: fighter.armor, shield: total('shield', target), virtualArmor: total('virtual_armor', target),
            reduction: Math.max(-500, Math.min(700, total('reduction', target))) };
        const result = absorbBattleHit(defense, raw, pierce);
        fighter.hp = result.defense.hp; consume('shield', target, result.shieldAbsorbed); consume('virtual_armor', target, result.virtualAbsorbed);
        if (target === 'boss') { rawPlayerDamage += raw; bossHpLost += result.hpLost; }
        else playerHpLost += result.hpLost;
        const entry: BattleLogEntry = { kind: target === 'boss' ? 'strike' : 'boss',
            text: (target === 'boss' ? 'Đối thủ mất ' : 'Cậu mất ') + result.hpLost + ' HP.', amount: result.hpLost, source };
        if (state.rule === CURRENT_BATTLE_RULE) {
            entry.hit = result.breakdown;
            const parts = ['Sát thương thô ' + raw], hit = result.breakdown;
            if (hit.reductionAdjustment > 0) parts.push('Giảm thương chặn ' + hit.reductionAdjustment);
            if (hit.reductionAdjustment < 0) parts.push('Tăng sát thương nhận thêm ' + -hit.reductionAdjustment);
            if (hit.armorBlocked) parts.push('Phòng thủ chặn ' + hit.armorBlocked);
            if (hit.virtualReduced) parts.push('Giáp Ảo giảm ' + hit.virtualReduced);
            if (hit.virtualAbsorbed) parts.push('Giáp Ảo hấp thụ ' + hit.virtualAbsorbed);
            if (hit.shieldAbsorbed) parts.push('Khiên hấp thụ ' + hit.shieldAbsorbed);
            if (hit.overflow) parts.push('Sát thương dư ' + hit.overflow);
            entry.text += ' ' + parts.join(' · ') + '.';
        }
        entries.push(entry);
        return result.hpLost;
    }
    function bossAlive(): boolean {
        if (state.boss.hp > 0) return true;
        if (state.revival.remaining > 0) {
            state.revival.remaining--; state.boss.hp = Math.max(1, scale(state.boss.maxHp, state.revival.hpPercent));
            entries.push({ kind: 'revive', text: 'Đối thủ dùng lần hồi sinh đã báo trước.', amount: state.boss.hp }); return true;
        }
        state.status = 'won'; entries.push({ kind: 'end', text: 'Chiến thắng. Đối thủ đã bị hạ.' }); return false;
    }
    function strike(power: number, hits = 1, pierce = 0) {
        const buff = 1000 + Math.min(600, total('attack_buff', 'player') + comboBonus);
        for (let index = 0; index < hits; index++) {
            const damage = hit('boss', scale(scale(basePower, power), buff), pierce, input.techniqueId);
            if (lifeSteal) entries.push({ kind: 'heal', text: 'Đoạt lại sinh lực.', amount: health(state.player, scale(damage, lifeSteal)) });
            if (!bossAlive()) break;
        }
    }
    // Pending marks/echo/bleed are player attacks too: a boss truly killed here
    // never gets a counterattack or a new cast's sacrifice. Delayed effects
    // cannot spawn another echo.
    for (const status of [...state.statuses]) {
        if (status.target !== 'boss' || !['mark', 'echo', 'bleed'].includes(status.kind) || status.dueTurn !== null && status.dueTurn > state.turn) continue;
        hit('boss', status.value, status.kind === 'bleed' ? 1000 : 200, status.key);
        if (status.kind !== 'bleed') state.statuses = state.statuses.filter(item => item !== status);
        if (!bossAlive()) { validateBattleState(state); return { state, entries, intent, rankRescuePrepared, rawPlayerDamage, bossHpLost, playerHpLost }; }
    }
    state.lastUses[input.techniqueId] = state.turn;
    if (spec) {
        if (spec.cost.maxHpPercent) {
            const cost = Math.min(state.player.maxHp - 1, scale(state.player.maxHp, spec.cost.maxHpPercent));
            state.player.maxHp -= cost; state.player.hp = Math.min(state.player.hp, state.player.maxHp);
            entries.push({ kind: 'cost', text: 'Hiến ' + cost + ' HP tối đa trong trận.', amount: cost });
        }
        if (spec.cost.hpPercent) {
            const cost = scale(state.player.maxHp, spec.cost.hpPercent);
            if (state.player.hp <= cost) throw Error('BATTLE_INSUFFICIENT_HP');
            state.player.hp -= cost; entries.push({ kind: 'cost', text: 'Hiến ' + cost + ' HP.', amount: cost });
        }
        lifeSteal = spec.effects.filter(effect => effect.kind === 'lifesteal').reduce((sum, effect) =>
            sum + (effect.kind === 'lifesteal' ? effect.percent + (effect.lowHpThreshold &&
                state.player.hp * 1000 <= state.player.maxHp * effect.lowHpThreshold ? effect.lowHpBonus ?? 0 : 0) : 0), 0);
    }
    if (!spec) strike(1000);
    else for (const effect of spec.effects) {
        if (state.status !== 'active') break;
        switch (effect.kind) {
            case 'strike': {
                let power = effect.power;
                if (effect.execute && state.boss.hp * 1000 <= state.boss.maxHp * 300) power += effect.execute;
                if (effect.lowHp) power += scale(effect.lowHp, Math.floor(1000 * (state.player.maxHp - state.player.hp) / state.player.maxHp));
                strike(power, effect.hits, effect.pierce); break;
            }
            case 'shield': case 'virtual_armor':
                addStatus(effect.kind, 'player', Math.min(scale(supportPower, effect.value), scale(state.player.maxHp, 650)), effect.turns); break;
            case 'heal': entries.push({ kind: 'heal', text: 'Hồi phục sinh lực.', amount: health(state.player, scale(supportPower, effect.value)) }); break;
            case 'reduction': case 'reflect': case 'attack_buff': addStatus(effect.kind, 'player', effect.value, effect.turns); break;
            case 'bleed': addStatus('bleed', 'boss', scale(basePower, effect.value), effect.turns + 1, '', state.turn + 1); break;
            case 'guard': state.guard = Math.min(3, state.guard + effect.value); break;
            case 'guard_strike': strike(Math.min(state.guard, effect.maximum) * effect.powerPerStack); state.guard = 0; break;
            case 'illusion': {
                const has = state.illusion;
                if (effect.consume) state.illusion = false; else state.illusion = true;
                if (effect.use === 'guard') addStatus('reduction', 'player', effect.value, 1);
                if (has && effect.use === 'heal') entries.push({ kind: 'heal', text: 'Hư Ảnh giữ khoảng hồi phục.', amount: health(state.player, scale(supportPower, effect.value)) });
                if (has && effect.use === 'strike') strike(effect.value, 1, 700);
                if (has && effect.use === 'dodge') dodge = true;
                break;
            }
            case 'foresight': state.foresightThrough = Math.max(state.foresightThrough, state.turn + effect.turns); break;
            case 'mark': {
                if (input.techniqueId === 'tam-nhat' && active('mark', 'boss').some(status => status.key.startsWith('tam-nhat:'))) break;
                addStatus('mark', 'boss', scale(basePower, effect.power), effect.delay + 1, '', state.turn + effect.delay); break;
            }
            case 'mark_combo': { const marks = active('mark', 'boss').slice(0, effect.maximum); strike(marks.length * effect.powerPerMark);
                state.statuses = state.statuses.filter(item => !marks.includes(item)); break; }
            case 'convert_intent': strike(Math.min(effect.cap, Math.floor(intent.hits.reduce((sum, value) => sum + value, 0) * effect.percent / Math.max(1, basePower))));
                addStatus('reduction', 'player', Math.min(300, effect.percent), 1); break;
            case 'intent_swap': {
                if (state.turn < state.maxTurns) { const next = state.intents[state.turn]!; state.intents[state.turn] = intent; state.intents[state.turn - 1] = next; intent = next; }
                entries.push({ kind: 'effect', text: 'Đổi thứ tự hành động hôm nay và ngày giao chiến kế tiếp.' }); break;
            }
            case 'dispel': state.statuses = state.statuses.filter(status => !(status.target === 'boss' && ['shield', 'attack_buff', 'reduction'].includes(status.kind)));
                state.boss.armor = Math.max(0, state.boss.armor - scale(supportPower, 250)); break;
            case 'rank_rescue': rankRescuePrepared = true; break;
            case 'max_hp_strike': hit('boss', Math.min(scale(state.boss.maxHp, effect.percent), scale(basePower, effect.cap)), 600, input.techniqueId); bossAlive(); break;
            case 'copy': {
                if (state.lastBossIntent) hit('boss', Math.min(state.lastBossIntent.hits.reduce((sum, value) => sum + value, 0), scale(basePower, 1500)), 300, 'cuu-u:copy');
                bossAlive(); break;
            }
            case 'seal': addStatus('seal', 'boss', 1, effect.turns); break;
            case 'reverse_buff': state.boss.armor = Math.max(0, state.boss.armor - Math.min(state.lastBossIntent?.armorBuff ?? 0, scale(supportPower, 700)));
                state.statuses = state.statuses.filter(status => !(status.target === 'boss' && status.kind === 'attack_buff')); break;
            case 'echo': addStatus('echo', 'boss', Math.min(scale(rawPlayerDamage, effect.power), scale(basePower, 1200)), 2, '', state.turn + 1); break;
            case 'exchange': state.exchangeAfterTurn = state.turn; break;
            case 'sword_seal': if (!state.seals.includes(effect.id)) state.seals.push(effect.id); break;
            case 'four_seals': if (state.seals.length === 4 && !state.burstUsed) { strike(effect.power, 1, 700); state.seals = []; state.burstUsed = true; } break;
            case 'domain': addStatus('mark', 'boss', scale(basePower, effect.power), effect.delay + 1, 'domain', state.turn + effect.delay); break;
            case 'lifesteal': break;
            case 'school_combo':
                state.combo = { source: input.techniqueId, school: effect.school, value: effect.value, turn: state.turn + 1 }; break;
        }
    }
    // The sacrifice still occurs on a winning turn. Explicit costs never vanish
    // simply because the opponent did not survive to counterattack.
    if (spec?.cost.endAtOneHp) {
        const amount = state.player.hp - 1; state.player.hp = 1;
        entries.push({ kind: 'cost', text: state.rule === CURRENT_BATTLE_RULE ? 'Táng Nhật hiến ' + amount + ' HP, còn 1 HP.' : 'Táng Nhật để lại 1 HP.', amount });
    }
    if (state.status === 'won') { validateBattleState(state); return { state, entries, intent, rankRescuePrepared, rawPlayerDamage, bossHpLost, playerHpLost }; }
    const sealed = !!active('seal', 'boss').length && intent.special;
    if (sealed) entries.push({ kind: 'effect', text: 'Tuyệt kỹ bị niêm phong; boss dùng đòn thường.' });
    const hits = sealed ? [state.boss.attack] : intent.hits;
    for (const damage of hits) {
        if (dodge) { dodge = false; entries.push({ kind: 'defend', text: 'Hư Ảnh đỡ một hit.' }); continue; }
        const actual = hit('player', damage, 0, intent.id);
        const reflect = Math.min(1000, total('reflect', 'player'));
        if (reflect && actual) hit('boss', scale(actual, reflect), 1000, 'reflect');
        if (state.player.hp === 0) {
            // A simultaneous fatal reflect cannot skip an announced revival.
            if (state.boss.hp === 0 && state.revival.remaining > 0) {
                state.revival.remaining--; state.boss.hp = Math.max(1, scale(state.boss.maxHp, state.revival.hpPercent));
                entries.push({ kind: 'revive', text: 'Đối thủ dùng lần hồi sinh đã báo trước.', amount: state.boss.hp });
            }
            state.fatalTechnique = rankRescuePrepared ? input.techniqueId : null;
            state.status = state.rescueUsed ? 'dead' : 'awaiting_rescue';
            entries.push({ kind: 'end', text: state.rescueUsed ? 'Tử trận. Quyền cứu trong trận đã dùng.' : 'Sinh lực đã cạn. Chọn cứu mạng hoặc chấp nhận tử trận.' }); break;
        }
        const turtle = state.loadout.find(skill => skill.id === 'huyen-quy' && skill.strength && skill.tier >= 2);
        if (state.rule === CURRENT_BATTLE_RULE && actual > 0 && turtle && !state.passiveUses?.includes('huyen-quy') &&
            state.player.hp * 1000 <= state.player.maxHp * 350) {
            const value = scale(state.player.maxHp, [0, 200, 250, 350][turtle.tier - 1]!);
            state.passiveUses = [...(state.passiveUses ?? []), 'huyen-quy'];
            const key = 'huyen-quy:shield:passive';
            const peers = active('shield', 'player');
            if (peers.length >= 2) state.statuses = state.statuses.filter(status => status !== peers[0]);
            state.statuses.push({ key, kind: 'shield', target: 'player', value, expiresTurn: state.turn + 1, dueTurn: null });
            entries.push({ kind: 'effect', text: 'Nội tại Huyền Quy tạo Khiên ' + value + ', giữ 2 lượt. Quyền kích hoạt đã dùng.', amount: value, source: 'huyen-quy' });
        }
        if (!bossAlive()) break;
    }
    if (state.status === 'active') {
        if (!sealed && intent.heal) entries.push({ kind: 'heal', text: 'Boss hồi sinh lực.', amount: health(state.boss, intent.heal) });
        if (!sealed && intent.armorBuff) state.boss.armor = Math.min(Math.floor(state.boss.attack * .7), state.boss.armor + intent.armorBuff);
        if (state.turn >= state.maxTurns) { state.status = 'expired'; entries.push({ kind: 'end', text: 'Đã hết số ngày giao chiến. Trận kết thúc.' }); }
    }
    state.lastBossIntent = structuredClone(intent);
    state.statuses = state.statuses.filter(status => status.value !== 0 && status.expiresTurn >= state.turn);
    validateBattleState(state);
    return { state, entries, intent, rankRescuePrepared, rawPlayerDamage, bossHpLost, playerHpLost };
}
export function rescueBattle(before: BattleState, kind: 'qi' | 'rank'): BattleState {
    validateBattleState(before);
    if (!['qi', 'rank'].includes(kind) || before.status !== 'awaiting_rescue' || before.rescueUsed || kind === 'rank' && before.fatalTechnique !== 'nghich-menh') throw Error('BATTLE_RESCUE_UNAVAILABLE');
    const state = structuredClone(before); state.rescueUsed = true; state.player.hp = Math.max(1, scale(state.player.maxHp, 350));
    state.status = state.boss.hp <= 0 ? 'won' : state.turn >= state.maxTurns ? 'expired' : 'active';
    state.fatalTechnique = null; validateBattleState(state); return state;
}

// A browser receives only announced intent. Stored future actions remain on the
// server; the foresight technique explicitly increases the revealed horizon.
export function battleChoiceProfile(state: BattleState, id: string): TechniqueProfile {
    if (id === 'vo-ky') return { id, tier: 0, rule: state.rule, attack: state.player.attack, bonusMilli: 0,
        damage: state.player.attack, hits: 1, perHit: state.player.attack, damagePower: state.player.attack,
        effectPower: state.player.attack, totalPurityBp: null, effects: [], warning: null,
        cost: { hpPercent: 0, maxHpPercent: 0, endAtOneHp: false } };
    const skill = state.loadout.find(skill => skill.id === id);
    if (!skill) throw Error('BATTLE_TECHNIQUE_NOT_EQUIPPED');
    return techniqueProfile(id, skill.tier, skill.purityBp, state.player.attack, 0, skill.strength);
}

// A read-only preview uses exactly the settlement resolver. It must not turn
// a hidden future intent into public HP numbers via an intent-swap technique.
export function battleChoiceDetail(state: BattleState, techniqueId: string) {
    validateBattleState(state);
    const profile = battleChoiceProfile(state, techniqueId);
    const unavailable = (reason: string) => ({ profile, preview: { kind: 'unavailable' as const, reason } });
    if (state.status !== 'active') return unavailable('Trận này không còn nhận lựa chọn chiêu.');
    if (techniqueId === 'phong-than' && state.lastUses[techniqueId] !== undefined && state.turn + 1 - state.lastUses[techniqueId]! < 3)
        return unavailable('Hồi chiêu đến lượt ' + (state.lastUses[techniqueId]! + 3) + '.');
    const spec = techniqueId === 'vo-ky' ? null : tierBattleTechnique(techniqueId, profile.tier, profile.rule === 'practice-v2');
    if (state.turn + 1 < state.maxTurns && spec?.effects.some(effect => effect.kind === 'intent_swap') && state.foresightThrough < state.turn + 2)
        return { profile, preview: { kind: 'hidden_intent' as const,
            reason: 'Chiêu này đổi hành động hôm nay với lượt kế. Chưa xem được hành động kế tiếp nên chưa thể dự kiến kết quả.' } };
    try {
        const result = resolveBattleTurn(state, { techniqueId, acceptCost: true, contribution: { habits: 0, tasks: 0 } });
        return { profile, preview: { kind: 'resolved' as const, contribution: { habits: 0, tasks: 0 },
            playerHp: result.state.player.hp, playerMaxHp: result.state.player.maxHp, bossHp: result.state.boss.hp,
            bossMaxHp: result.state.boss.maxHp, bossHpLost: result.bossHpLost, playerHpLost: result.playerHpLost,
            status: result.state.status, revivalRemaining: result.state.revival.remaining, entries: result.entries } };
    } catch (error) {
        if (error instanceof Error && error.message === 'BATTLE_INSUFFICIENT_HP') return unavailable('Không đủ HP để trả cái giá của chiêu.');
        throw error;
    }
}

export function publicBattleState(state: BattleState) {
    validateBattleState(state);
    const count = state.status === 'active' ? Math.max(1, state.foresightThrough - state.turn) : 0;
    return { rule: state.rule, turn: state.turn, maxTurns: state.maxTurns, status: state.status,
        player: { ...state.player }, boss: { ...state.boss }, loadout: structuredClone(state.loadout),
        statuses: structuredClone(state.statuses), guard: state.guard, illusion: state.illusion,
        seals: [...state.seals], burstUsed: state.burstUsed, rescueUsed: state.rescueUsed,
        rankRescueAvailable: state.status === 'awaiting_rescue' && state.fatalTechnique === 'nghich-menh',
        exchangeAvailable: state.exchangeAfterTurn === state.turn,
        revival: { ...state.revival },
        ...(state.rule === CURRENT_BATTLE_RULE ? { combo: state.combo ?? null, passiveUses: state.passiveUses ?? [] } : {}),
        announced: structuredClone(state.intents.slice(state.turn, state.turn + count)).map((intent, offset) => ({ turn: state.turn + offset + 1, intent })),
        choices: ['vo-ky', ...state.loadout.map(skill => skill.id)].map(id => {
            const equipped = state.loadout.find(skill => skill.id === id);
            const spec = id === 'vo-ky' ? null : tierBattleTechnique(id, equipped!.tier, !!equipped?.strength);
            const readyAfter = id === 'phong-than' && state.lastUses[id] !== undefined ? state.lastUses[id]! + 3 : 0;
            const profile = battleChoiceProfile(state, id);
            return { id, name: id === 'vo-ky' ? 'Võ Kỹ' : techniqueById(id).name, warning: spec?.warning ?? null,
                damage: profile.damage,
                repeatDamagePenalty: state.lastUses[id] === state.turn ? (state.intents[state.turn]?.repeatWard ?? 0) : 0,
                available: state.status === 'active' && state.turn + 1 >= readyAfter,
                readyTurn: readyAfter,
                hpCost: spec ? scale(state.player.maxHp, spec.cost.hpPercent) : 0,
                maxHpCost: spec ? Math.min(state.player.maxHp - 1, scale(state.player.maxHp, spec.cost.maxHpPercent)) : 0,
                endAtOneHp: spec?.cost.endAtOneHp ?? false };
        }) };
}

export function withdrawBattle(before: BattleState): BattleState {
    validateBattleState(before);
    if (before.status !== 'active') throw Error('BATTLE_WITHDRAWAL_UNAVAILABLE');
    const state = structuredClone(before); state.status = 'withdrawn'; return state;
}

export function acceptBattleDeath(before: BattleState): BattleState {
    validateBattleState(before);
    if (before.status !== 'awaiting_rescue') throw Error('BATTLE_DEATH_UNAVAILABLE');
    const state = structuredClone(before); state.status = 'dead'; state.fatalTechnique = null; return state;
}
