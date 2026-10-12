import { absorbBattleHit, type BattleDefense } from './battle-armor.ts';
import { battleTechnique } from './battle-techniques.ts';
import { techniqueById } from './techniques.ts';

export const BATTLE_RULE = 'battle-v1';
const MAX_STAT = 1000000;
const STATUS_KINDS = ['shield', 'virtual_armor', 'reduction', 'reflect', 'bleed', 'attack_buff', 'mark', 'echo', 'seal'];
const SWORD_SEALS = ['mountain', 'blood', 'storm', 'echo'];
export type BossIntent = { id: string; name: string; hits: number[]; special: boolean;
    heal: number; armorBuff: number; description: string };
export type BattleFighter = { hp: number; maxHp: number; attack: number; armor: number };
export type EquippedTechnique = { id: string; versionId: string; tier: number; purityBp: number };
export type BattleStatus = { key: string; kind: 'shield' | 'virtual_armor' | 'reduction' | 'reflect' | 'bleed' | 'attack_buff' | 'mark' | 'echo' | 'seal';
    target: 'player' | 'boss'; value: number; expiresTurn: number; dueTurn: number | null };
export type BattleState = {
    rule: string; turn: number; maxTurns: number; status: 'active' | 'won' | 'awaiting_rescue' | 'dead' | 'expired' | 'withdrawn';
    player: BattleFighter; boss: BattleFighter; loadout: EquippedTechnique[]; intents: BossIntent[];
    statuses: BattleStatus[]; guard: number; illusion: boolean; seals: string[]; burstUsed: boolean;
    lastUses: Record<string, number>;
    rescueUsed: boolean; fatalTechnique: string | null; foresightThrough: number; exchangeAfterTurn: number | null;
    revival: { remaining: number; hpPercent: number }; lastBossIntent: BossIntent | null;
};
export type BattleTurnInput = { techniqueId: string; contribution: { habits: number; tasks: number }; acceptCost: boolean };
export type BattleLogEntry = { kind: 'strike' | 'defend' | 'heal' | 'cost' | 'effect' | 'boss' | 'revive' | 'end';
    text: string; amount?: number; source?: string };
export type BattleTurnResult = { state: BattleState; entries: BattleLogEntry[]; intent: BossIntent; rankRescuePrepared: boolean;
    rawPlayerDamage: number; bossHpLost: number; playerHpLost: number };
const scale = (value: number, factor: number) => Math.max(0, Math.floor(value * factor / 1000));
const health = (fighter: BattleFighter, amount: number) => { const added = Math.min(Math.max(0, amount), fighter.maxHp - fighter.hp); fighter.hp += added; return added; };
export function validateBattleState(state: BattleState): void {
    if (state.rule !== BATTLE_RULE) throw Error('BATTLE_RULE_UNSUPPORTED');
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
            !Number.isInteger(skill.purityBp) || skill.purityBp < 100 || skill.purityBp > 10000) throw Error('INVALID_BATTLE_LOADOUT');
        techniqueById(skill.id);
    }
    function validateIntent(intent: BossIntent) {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(intent.id) || typeof intent.name !== 'string' || intent.name.length < 1 || intent.name.length > 120 ||
            typeof intent.description !== 'string' || intent.description.length > 600 || typeof intent.special !== 'boolean' ||
            intent.hits.length < 1 || intent.hits.length > 5 ||
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
    maxTurns: number, revival = { remaining: 0, hpPercent: 350 }): BattleState {
    const value: BattleState = { rule: BATTLE_RULE, turn: 0, maxTurns, status: 'active', player: { ...player }, boss: { ...boss },
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
    const spec = input.techniqueId === 'vo-ky' ? null : battleTechnique(input.techniqueId);
    if (spec?.warning && !input.acceptCost) throw Error('BATTLE_COST_NOT_ACCEPTED');
    if (input.techniqueId === 'phong-than' && before.lastUses[input.techniqueId] !== undefined && before.turn + 1 - before.lastUses[input.techniqueId]! < 3)
        throw Error('BATTLE_TECHNIQUE_COOLDOWN');
    const state = structuredClone(before), entries: BattleLogEntry[] = [];
    state.turn++; state.fatalTechnique = null; state.exchangeAfterTurn = null;
    state.statuses = state.statuses.filter(status => status.expiresTurn >= state.turn);
    let intent = state.intents[state.turn - 1]!;
    let rawPlayerDamage = 0, bossHpLost = 0, playerHpLost = 0, rankRescuePrepared = false, lifeSteal = 0, dodge = false;
    const tierFactor = equipped ? 1000 + (equipped.tier - 1) * 180 : 1000;
    const purityFactor = equipped ? 400 + Math.floor(equipped.purityBp * .06) : 1000;
    const effortFactor = 1000 + input.contribution.habits + input.contribution.tasks;
    const basePower = Math.max(1, scale(scale(scale(state.player.attack, tierFactor), purityFactor), effortFactor));
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
        const fighter = state[target];
        const defense: BattleDefense = { hp: fighter.hp, armor: fighter.armor, shield: total('shield', target), virtualArmor: total('virtual_armor', target),
            reduction: Math.max(-500, Math.min(700, total('reduction', target))) };
        const result = absorbBattleHit(defense, raw, pierce);
        fighter.hp = result.defense.hp; consume('shield', target, result.shieldAbsorbed); consume('virtual_armor', target, result.virtualAbsorbed);
        if (target === 'boss') { rawPlayerDamage += raw; bossHpLost += result.hpLost; }
        else playerHpLost += result.hpLost;
        entries.push({ kind: target === 'boss' ? 'strike' : 'boss', text: target === 'boss' ? 'Đối thủ mất ' + result.hpLost + ' HP.' : 'Cậu mất ' + result.hpLost + ' HP.', amount: result.hpLost, source });
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
        const buff = 1000 + Math.min(600, total('attack_buff', 'player'));
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
        lifeSteal = spec.effects.filter(effect => effect.kind === 'lifesteal').reduce((sum, effect) => sum + (effect.kind === 'lifesteal' ? effect.percent : 0), 0);
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
                addStatus(effect.kind, 'player', Math.min(scale(basePower, effect.value), scale(state.player.maxHp, 650)), effect.turns); break;
            case 'heal': entries.push({ kind: 'heal', text: 'Hồi phục sinh lực.', amount: health(state.player, scale(basePower, effect.value)) }); break;
            case 'reduction': case 'reflect': case 'attack_buff': addStatus(effect.kind, 'player', effect.value, effect.turns); break;
            case 'bleed': addStatus('bleed', 'boss', scale(basePower, effect.value), effect.turns + 1, '', state.turn + 1); break;
            case 'guard': state.guard = Math.min(3, state.guard + effect.value); break;
            case 'guard_strike': strike(Math.min(state.guard, effect.maximum) * effect.powerPerStack); state.guard = 0; break;
            case 'illusion': {
                const has = state.illusion;
                if (effect.consume) state.illusion = false; else state.illusion = true;
                if (effect.use === 'guard') addStatus('reduction', 'player', effect.value, 1);
                if (has && effect.use === 'heal') entries.push({ kind: 'heal', text: 'Hư Ảnh giữ khoảng hồi phục.', amount: health(state.player, scale(basePower, effect.value)) });
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
                state.boss.armor = Math.max(0, state.boss.armor - scale(basePower, 250)); break;
            case 'rank_rescue': rankRescuePrepared = true; break;
            case 'max_hp_strike': hit('boss', Math.min(scale(state.boss.maxHp, effect.percent), scale(basePower, effect.cap)), 600, input.techniqueId); bossAlive(); break;
            case 'copy': {
                if (state.lastBossIntent) hit('boss', Math.min(state.lastBossIntent.hits.reduce((sum, value) => sum + value, 0), scale(basePower, 1500)), 300, 'cuu-u:copy');
                bossAlive(); break;
            }
            case 'seal': addStatus('seal', 'boss', 1, effect.turns); break;
            case 'reverse_buff': state.boss.armor = Math.max(0, state.boss.armor - Math.min(state.lastBossIntent?.armorBuff ?? 0, scale(basePower, 700)));
                state.statuses = state.statuses.filter(status => !(status.target === 'boss' && status.kind === 'attack_buff')); break;
            case 'echo': addStatus('echo', 'boss', Math.min(scale(rawPlayerDamage, effect.power), scale(basePower, 1200)), 2, '', state.turn + 1); break;
            case 'exchange': state.exchangeAfterTurn = state.turn; break;
            case 'sword_seal': if (!state.seals.includes(effect.id)) state.seals.push(effect.id); break;
            case 'four_seals': if (state.seals.length === 4 && !state.burstUsed) { strike(effect.power, 1, 700); state.seals = []; state.burstUsed = true; } break;
            case 'domain': addStatus('mark', 'boss', scale(basePower, effect.power), effect.delay + 1, 'domain', state.turn + effect.delay); break;
            case 'lifesteal': break;
        }
    }
    // The sacrifice still occurs on a winning turn. Explicit costs never vanish
    // simply because the opponent did not survive to counterattack.
    if (spec?.cost.endAtOneHp) { const amount = state.player.hp - 1; state.player.hp = 1; entries.push({ kind: 'cost', text: 'Táng Nhật để lại 1 HP.', amount }); }
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
        announced: structuredClone(state.intents.slice(state.turn, state.turn + count)).map((intent, offset) => ({ turn: state.turn + offset + 1, intent })),
        choices: ['vo-ky', ...state.loadout.map(skill => skill.id)].map(id => {
            const spec = id === 'vo-ky' ? null : battleTechnique(id);
            const readyAfter = id === 'phong-than' && state.lastUses[id] !== undefined ? state.lastUses[id]! + 3 : 0;
            return { id, name: id === 'vo-ky' ? 'Võ Kỹ' : techniqueById(id).name, warning: spec?.warning ?? null,
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
