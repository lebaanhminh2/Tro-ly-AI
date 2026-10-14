// Isolated, disposable adapter for the standalone preview; never deployed as an app asset. All awarded values,
// upgrades, combat, rescue costs and discovery come from production domain code.
import { INITIAL_TECHNIQUES, TECHNIQUES, techniqueById } from '../../src/domain/techniques.ts';
import { bossForNewBattle, bossIntents, GAME_BOSSES, GAME_CHAPTERS, GAME_CONTENT_VERSION } from '../../src/domain/game-content.ts';
import { playerGameCatalog } from '../../src/domain/game-discovery.ts';
import { newTimePracticeVersion } from '../../src/domain/practice-progression.ts';
import { practicePresentation, practiceUpgrade } from '../../src/domain/practice-presentation.ts';
import { settlePracticeDay, type PracticeSource, type PracticeVersion, type PracticeWeek } from '../../src/domain/practice.ts';
import { practiceStrength } from '../../src/domain/technique-profile.ts';
import { CURRENT_BATTLE_RULE, newBattleState, publicBattleState, battleChoiceDetail, withdrawBattle } from '../../src/domain/battle.ts';
import { battleHabitContribution, settleBattleDay, type BattleRun } from '../../src/domain/battle-run.ts';
import { fighterForRank, payBattleDeath, payBattleRescue, rescueQuote } from '../../src/domain/battle-economy.ts';
import { earnedBattleRewards } from '../../src/domain/game-rewards.ts';
import { initialHealthy } from '../../src/domain/healthy.ts';
import { habitWeekStart } from '../../src/domain/habits.ts';

type Stored = { practice: PracticeVersion; maintained: boolean; version: number; created: number };
type Selection = { mode: 'practice' | 'battle' | 'idle'; practiceId: string | null; battleId: string | null; fromDay: number };
type DemoRun = BattleRun & { id: string; version: number; finishedDay: number | null; used: string[] };
type Input = Record<string, unknown>;
export const DEMO_SCENARIOS = [
    ['training', 'Đang luyện · có khuyết điểm'], ['new', 'Chưa học công pháp'],
    ['tier1', 'Tầng 1'], ['tier2', 'Tầng 2'], ['tier3', 'Tầng 3'], ['tier4', 'Hoàn tất 4 tầng'],
    ['perfect', 'Thông Thần'], ['pending', 'Chờ chốt cam kết tuần'], ['retrain', 'Hai bản luyện'],
    ['prepared', 'Đã chuẩn bị trận'], ['battle', 'Đang chiến đấu'], ['rescue', 'Chờ cứu mạng'], ['rescue-rank', 'Thử Nghịch Mệnh'],
    ['victory', 'Chiến thắng và thành tựu'], ['discovery', 'Bí tịch đã phát hiện'],
    ['all', 'Thử toàn bộ 39 môn / 40 boss'],
] as const;

export class CultivationDemoSession {
    day = 20740;
    version = 1;
    serial = 0;
    ratio = 100;
    scenario = 'training';
    healthy = initialHealthy();
    restrictions = { rankLockUntilDay: null as number | null };
    healthyVersion = 1;
    editions: Stored[] = [];
    weeks: PracticeWeek[] = [];
    victories: string[] = [];
    rewards: { kind: string; id: string }[] = [];
    runs: DemoRun[] = [];
    records: Record<string, unknown>[] = [];
    events: { battleId: string; day: number; kind: string; entries: unknown[]; result: Record<string, unknown> }[] = [];
    choices = new Map<string, { techniqueId: string; acceptCost: boolean }>();
    owned = [...INITIAL_TECHNIQUES];
    current: Selection = { mode: 'idle', practiceId: null, battleId: null, fromDay: this.day };
    pending: Selection | null = null;
    resume: Selection | null = null;
    presets: { id: string; name: string; versions: string[]; weaponId: null }[] = [];
    presetVersion = 1;
    private weeklyFixture: { start: number; end: number; successes: number } | null = null;

    constructor(scenario = 'training') { this.setup(scenario); }
    private id(prefix: string) { return prefix + '_' + ++this.serial; }
    private sources(percent = this.ratio): PracticeSource[] {
        if (this.weeklyFixture) return [{ habitId: 'demo-weekly', successes: percent && this.weeklyFixture.successes < 3 ? 1 : 0, misses: 0, mature: true,
            cadence: { kind: 'weekly', quota: 3 }, weekly: { startDay: this.weeklyFixture.start, endDay: this.weeklyFixture.end,
                quota: 3, successesBefore: this.weeklyFixture.successes, missesBefore: 0 } }];
        return Array.from({ length: 10 }, (_, index) => ({ habitId: 'demo-habit-' + index,
            successes: index < percent / 10 ? 1 : 0, misses: index < percent / 10 ? 0 : 1,
            mature: true, cadence: { kind: 'daily' as const }, weekly: null }));
    }
    private seedEdition(id: string, tier: number, ratios = [100, 100, 100, 100]): Stored {
        const spec = techniqueById(id), template = newTimePracticeVersion(this.id('demo_practice'), id, this.day, spec.trainingFactor,
            this.editions.filter(value => value.practice.techniqueId === id).length + 1);
        const span = template.time!.periods.slice(0, tier).reduce((sum, period) => sum + period.requiredDays, 0);
        let practice = newTimePracticeVersion(template.id, id, this.day - span, spec.trainingFactor, template.edition);
        for (let day = practice.createdDay; day < this.day; day++) {
            const result = settlePracticeDay(day, practice.id, [practice], [], this.sources(ratios[practice.tiers.length] ?? 100));
            practice = result.versions[0]!;
        }
        const stored = { practice, maintained: true, version: 1, created: this.serial };
        this.editions.push(stored); this.owned = [...new Set([...this.owned, id])]; return stored;
    }
    setup(scenario: string) {
        if (!DEMO_SCENARIOS.some(([id]) => id === scenario)) throw Error('UNKNOWN_DEMO_SCENARIO');
        this.day = 20740; this.version++; this.serial = 0; this.scenario = scenario; this.ratio = 100;
        this.healthy = { ...initialHealthy(), rank: 3, highestRank: 3, qi: 500 };
        this.restrictions = { rankLockUntilDay: null }; this.healthyVersion = 1;
        this.editions = []; this.weeks = []; this.victories = []; this.records = []; this.rewards = [];
        this.runs = []; this.events = []; this.choices.clear(); this.owned = [...INITIAL_TECHNIQUES];
        this.pending = this.resume = null; this.weeklyFixture = null; this.presets = []; this.presetVersion++;
        this.current = { mode: 'idle', practiceId: null, battleId: null, fromDay: this.day };
        if (scenario === 'new') return;
        const tier = /^tier[1-4]$/.test(scenario) ? Number(scenario.at(-1)) : scenario === 'perfect' ? 4 : 2;
        const stored = this.seedEdition('kiem-y', tier, scenario === 'perfect' ? [100, 100, 100, 100] : [100, 50, 100, 100]);
        this.current = { mode: 'practice', practiceId: stored.practice.id, battleId: null, fromDay: this.day };
        if (scenario === 'retrain') this.seedEdition('kiem-y', 1);
        if (scenario === 'pending') {
            this.day = habitWeekStart(this.day) + 3;
            this.editions = []; this.weeklyFixture = { start: this.day - 3, end: this.day + 4, successes: 0 }; this.ratio = 0;
            let practice = newTimePracticeVersion(this.id('demo_weekly'), 'kiem-y', this.day - 3);
            for (let day = practice.createdDay; day < this.day; day++) {
                const result = settlePracticeDay(day, practice.id, [practice], this.weeks, this.sources(0));
                practice = result.versions[0]!; this.weeks = result.weeks;
            }
            this.editions.push({ practice, maintained: true, version: 1, created: this.serial }); this.current.practiceId = practice.id;
        }
        if (scenario === 'discovery') this.victories = GAME_BOSSES.filter(boss => boss.chapter <= 4 && (!boss.kind || boss.kind === 'main')).map(boss => boss.id);
        if (scenario === 'all') {
            this.owned = TECHNIQUES.map(value => value.id); this.victories = GAME_BOSSES.map(value => value.id);
            for (const technique of TECHNIQUES) if (technique.id !== 'kiem-y') this.seedEdition(technique.id, 4);
            return;
        }
        if (['prepared', 'battle', 'rescue', 'rescue-rank', 'victory'].includes(scenario)) {
            this.seedEdition('lien-van', 2); this.seedEdition('huyen-quy', 2);
            if (scenario === 'rescue-rank') this.seedEdition('nghich-menh', 1);
            this.prepare(GAME_BOSSES[0]!.id, this.editions.filter(value => value.maintained).map(value => value.practice.id));
            if (scenario !== 'prepared') { this.current = this.pending!; this.pending = null; this.day++; }
            if (scenario === 'rescue' || scenario === 'rescue-rank') {
                const run = this.runs[0]!;
                // A labeled test fixture creates lethal incoming damage; the
                // engine still determines death/rescue and all following costs.
                run.state.player.hp = 1;
                run.state.boss.hp = run.state.boss.maxHp = Math.max(run.state.boss.maxHp, run.state.player.attack * 20);
                for (const intent of run.state.intents) intent.hits = [run.state.player.maxHp * 2];
                this.choices.set(run.id, { techniqueId: scenario === 'rescue-rank' ? 'nghich-menh' : 'vo-ky', acceptCost: true }); this.advanceDay();
            }
            if (scenario === 'victory') {
                for (let index = 0; index < 17 && this.runs[0]!.state.status === 'active'; index++) {
                    this.choices.set(this.runs[0]!.id, { techniqueId: 'kiem-y', acceptCost: true }); this.advanceDay();
                }
            }
        }
    }
    private presented(stored: Stored | undefined) {
        return stored ? { ...stored, ...practicePresentation(stored.practice, 100, { afterDay: this.day, weeks: this.weeks }),
            name: techniqueById(stored.practice.techniqueId).name } : null;
    }
    private best(values: Stored[]) {
        return [...values].sort((a, b) => b.practice.tiers.length - a.practice.tiers.length ||
            (this.presented(b)?.profile?.damage ?? 0) - (this.presented(a)?.profile?.damage ?? 0) ||
            (this.presented(b)?.training?.totalPurityBp ?? 0) - (this.presented(a)?.training?.totalPurityBp ?? 0) || a.created - b.created)[0];
    }
    private learned() { return [...new Set(this.editions.filter(value => value.practice.tiers.length).map(value => value.practice.techniqueId))]; }
    catalog() { return playerGameCatalog({ victories: this.victories, learned: this.learned(), owned: this.owned }); }
    overview() {
        return { day: { day: this.day }, version: this.version, settledThrough: this.day - 1, current: this.current, pending: this.pending,
            owned: this.owned, learned: this.learned(), victories: this.victories, rewards: this.rewards,
            currentPractice: this.presented(this.editions.find(value => value.practice.id === this.current.practiceId)),
            pendingPractice: this.presented(this.editions.find(value => value.practice.id === this.pending?.practiceId)),
            audits: [], recent: [], choices: [...this.choices].map(([battleId, value]) => ({ battleId, ...value })),
            combatEconomy: { healthyVersion: this.healthyVersion, qi: this.healthy.qi, rank: this.healthy.rank, ...this.restrictions },
            battles: this.runs.map(run => ({ ...run, status: run.startsDay > this.day ? run.finishedDay === null ? 'prepared' : 'cancelled' : run.state.status,
                state: publicBattleState(run.state), content: bossForNewBattle(run.bossId), rescue: rescueQuote(this.healthy, run.combatRank) })) };
    }
    read(path: string): unknown {
        const url = new URL(path, 'https://demo.invalid/'), key = url.pathname.replace(/^\/?(?:api\/)?/, '');
        const id = url.searchParams.get('techniqueId');
        if (key === 'game') return this.overview();
        if (key === 'game-catalog') return this.catalog();
        if (key === 'game-victories') return { victories: this.records };
        if (key === 'game-presets') return { version: this.presetVersion, presets: this.presets };
        if (key === 'battle-choice') {
            const run = this.runs.find(run => run.id === url.searchParams.get('battleId'));
            if (!run) throw Error('Không tìm thấy trận.');
            return { day: this.day, gameVersion: this.version, battleVersion: run.version,
                ...battleChoiceDetail(run.state, id ?? '') };
        }
        if (key === 'game-technique') {
            const technique = this.catalog().techniques.find(value => value.id === id);
            if (!technique || technique.discovery === 'sealed') throw Error('Bí tịch chưa phát hiện.');
            const versions = this.editions.filter(value => value.maintained && value.practice.techniqueId === id);
            const selectedId = url.searchParams.get('versionId'), selected = selectedId ? this.editions.find(value => value.practice.id === selectedId && value.practice.techniqueId === id) : this.best(versions);
            if (selectedId && !selected) throw Error('Không tìm thấy bản luyện.');
            return { technique, selected: this.presented(selected), versions: versions.map(value => this.presented(value)),
                upgrade: practiceUpgrade(selected?.practice ?? null, technique.id, 100, { afterDay: this.day, weeks: this.weeks }) };
        }
        if (key === 'practice-versions') return { versions: this.editions.filter(value => value.practice.techniqueId === id).reverse().map(value => this.presented(value)), next: null };
        if (key === 'battle-loadout') {
            const ids = url.searchParams.getAll('versionId'), candidates = ids.length ? this.editions.filter(value => ids.includes(value.practice.id)) :
                this.learned().flatMap(id => { const best = this.best(this.editions.filter(value => value.maintained && value.practice.techniqueId === id)); return best ? [best] : []; });
            return { versions: candidates.filter(value => value.maintained && value.practice.tiers.length).map(value => ({ techniqueId: value.practice.techniqueId,
                versionId: value.practice.id, edition: value.practice.edition, tier: value.practice.tiers.length,
                purityBp: value.practice.tiers.at(-1)!.purityBp, ...practicePresentation(value.practice) })) };
        }
        if (key === 'game-boss') {
            const boss = bossForNewBattle(url.searchParams.get('bossId') ?? '');
            if (this.catalog().bosses.find(value => value.id === boss.id)?.discovery === 'sealed') throw Error('Đối thủ chưa gặp.');
            return { boss: { ...boss, enterable: this.enterable(boss.id), pattern: undefined,
                victory: this.victories.includes(boss.id) ? boss.victory : undefined } };
        }
        if (key === 'battles') return { battles: this.overview().battles, next: null };
        if (key === 'battle-history') return { events: this.events.filter(value => value.battleId === url.searchParams.get('battleId')).reverse(), next: null };
        if (key === 'game-chapter') {
            const chapter = GAME_CHAPTERS.find(value => value.number === Number(url.searchParams.get('chapter')));
            if (!chapter) throw Error('Không tìm thấy chương.');
            return { chapter: { ...chapter, conclusion: chapter.encounters.every(id => this.victories.includes(id)) ? chapter.conclusion : undefined }, characters: [] };
        }
        throw Error('Chức năng chưa có trong demo: ' + key);
    }
    private enterable(id: string) {
        const boss = bossForNewBattle(id);
        return boss.requires.every(id => this.victories.includes(id)) && (boss.practicePrerequisites ?? []).every(id => this.learned().includes(id));
    }
    private equipped(ids: string[]) {
        if (ids.length > 5 || new Set(ids).size !== ids.length) throw Error('Chọn tối đa 5 bản luyện.');
        const values = ids.map(id => this.editions.find(value => value.practice.id === id));
        if (values.some(value => !value?.maintained || !value.practice.tiers.length) || new Set(values.map(value => value!.practice.techniqueId)).size !== values.length)
            throw Error('Mỗi môn chọn một bản đang được duy trì và đã mở tầng 1.');
        return values.map(value => ({ id: value!.practice.techniqueId, versionId: value!.practice.id, tier: value!.practice.tiers.length,
            purityBp: value!.practice.tiers.at(-1)!.purityBp, strength: practiceStrength(value!.practice) }));
    }
    private prepare(id: string, ids: string[]) {
        if (!this.enterable(id)) throw Error('Chưa đủ điều kiện thử thách.');
        if (this.runs.some(run => ['active', 'awaiting_rescue'].includes(run.state.status))) throw Error('Kết thúc trận hiện tại trước.');
        const boss = bossForNewBattle(id), rank = this.healthy.rank;
        const run: DemoRun = { id: this.id('demo_battle'), bossId: id, contentVersion: GAME_CONTENT_VERSION, combatRank: rank,
            state: newBattleState(fighterForRank(rank), boss.fighter, this.equipped(ids), bossIntents(boss), boss.maxTurns, boss.revival, CURRENT_BATTLE_RULE),
            startsDay: this.day + 1, lastDay: null, waitDays: 0, rescueUntilDay: null, deathPaid: false, version: 1, finishedDay: null, used: [] };
        this.resume = { ...this.current }; this.runs.unshift(run);
        this.pending = { fromDay: run.startsDay, mode: 'battle', practiceId: null, battleId: run.id };
    }
    command(path: string, input: Input) {
        if (path === 'game-presets') return this.presetCommand(input);
        if (path !== 'game' || input.day !== this.day || input.version !== this.version) throw Error('Ngày hoặc phiên bản đã thay đổi. Mở lại thao tác.');
        const operation = String(input.operation), battleId = String(input.battleId ?? '');
        const run = this.runs.find(value => value.id === battleId);
        if (operation.includes('battle') && operation !== 'prepare_battle' && (!run || input.battleVersion !== run.version)) throw Error('Trận vừa thay đổi.');
        if (operation === 'start_practice' || operation === 'continue_practice' || operation === 'stop_practice') {
            if (this.pending?.mode === 'battle' || this.current.mode === 'battle' && this.runs.some(value => value.id === this.current.battleId && ['active', 'awaiting_rescue'].includes(value.state.status)))
                throw Error('Kết thúc hoặc hủy trận trước khi đổi luyện.');
            let stored: Stored | undefined;
            if (operation === 'start_practice') {
                const id = String(input.techniqueId), existing = this.editions.filter(value => value.practice.techniqueId === id);
                if (!this.owned.includes(id)) throw Error('Chưa có quyền học.');
                if (existing.length && input.confirmRestart !== true) throw Error('Cần xác nhận luyện lại.');
                const retained = this.best(existing.filter(value => value.maintained));
                for (const value of existing) value.maintained = value === retained;
                stored = { practice: newTimePracticeVersion(this.id('demo_practice'), id, this.day, techniqueById(id).trainingFactor,
                    Math.max(0, ...existing.map(value => value.practice.edition)) + 1), maintained: true, version: 1, created: this.serial };
                this.editions.push(stored);
            } else if (operation === 'continue_practice') {
                stored = this.editions.find(value => value.practice.id === input.practiceId && value.maintained);
                if (!stored || stored.practice.tiers.length === 4) throw Error('Bản này không còn luyện tiếp.');
            }
            this.pending = { mode: stored ? 'practice' : 'idle', practiceId: stored?.practice.id ?? null, battleId: null, fromDay: this.day + 1 };
        } else if (operation === 'prepare_battle') this.prepare(String(input.bossId), input.versions as string[]);
        else if (operation === 'update_prepared_battle') {
            if (run!.startsDay <= this.day) throw Error('Trận đã bắt đầu.');
            const boss = bossForNewBattle(run!.bossId);
            run!.state = newBattleState(fighterForRank(run!.combatRank), boss.fighter, this.equipped(input.versions as string[]), bossIntents(boss), boss.maxTurns, boss.revival, CURRENT_BATTLE_RULE);
        } else if (operation === 'choose_battle') {
            if (run!.startsDay > this.day || !publicBattleState(run!.state).choices.some(value => value.id === input.techniqueId && value.available)) throw Error('Chiêu chưa dùng được.');
            this.choices.set(run!.id, { techniqueId: String(input.techniqueId), acceptCost: input.acceptCost === true });
        } else if (operation === 'cancel_battle') {
            if (run!.startsDay <= this.day) throw Error('Trận đã bắt đầu.');
            run!.state = withdrawBattle(run!.state); run!.finishedDay = this.day; this.pending = this.resume ? { ...this.resume, fromDay: this.day + 1 } : null;
        } else if (operation === 'withdraw_battle') { run!.state = withdrawBattle(run!.state); this.finish(run!); }
        else if (operation === 'rescue_battle') {
            if (input.healthyVersion !== this.healthyVersion || run!.rescueUntilDay === null || this.day >= run!.rescueUntilDay) throw Error('Quyền cứu đã thay đổi hoặc hết hạn.');
            const payment = payBattleRescue(this.healthy, run!.state, input.kind as 'qi' | 'rank', run!.combatRank, this.restrictions, this.day);
            this.healthy = payment.healthy; this.restrictions = payment.restrictions; this.healthyVersion++;
            run!.state = payment.battle; run!.combatRank = payment.combatRank; run!.rescueUntilDay = null;
        } else if (operation === 'accept_battle_death') { this.death(run!); this.finish(run!); }
        else if (operation === 'exchange_battle') {
            if (run!.state.exchangeAfterTurn !== run!.state.turn || this.choices.has(run!.id)) throw Error('Chưa có quyền đổi ô.');
            const slot = run!.state.loadout.findIndex(value => value.id === input.removeId), skill = this.equipped([String(input.practiceId)])[0]!;
            if (slot < 0 || run!.state.loadout.some(value => value.id === skill.id)) throw Error('Ô công pháp không phù hợp.');
            run!.state.loadout[slot] = skill; run!.state.exchangeAfterTurn = null;
        } else throw Error('Thao tác chưa được hỗ trợ trong demo.');
        if (run) run.version++;
        this.version++;
        return { saved: true, version: this.version, effectiveFrom: this.pending?.fromDay };
    }
    private presetCommand(input: Input) {
        if (input.version !== this.presetVersion) throw Error('Bộ chiêu đã thay đổi.');
        const previous = this.presets.find(value => value.id === input.presetId);
        if (input.operation === 'delete') this.presets = this.presets.filter(value => value !== previous);
        else {
            this.equipped(input.versions as string[]);
            const name = String(input.name ?? '').trim(); if (!name) throw Error('Đặt tên bộ chiêu.');
            if (!previous && this.presets.length >= 6) throw Error('Đã có 6 bộ chiêu.');
            const preset = { id: previous?.id ?? this.id('demo_preset'), name, versions: input.versions as string[], weaponId: null };
            this.presets = [...this.presets.filter(value => value !== previous), preset]; this.presetVersion++;
            return { saved: true, presetId: preset.id, version: this.presetVersion };
        }
        this.presetVersion++; return { saved: true, deleted: true, version: this.presetVersion };
    }
    private death(run: DemoRun) {
        if (run.deathPaid) return;
        const payment = payBattleDeath(this.healthy, run.state);
        this.healthy = payment.healthy; this.healthyVersion++; run.state = payment.battle; run.deathPaid = true;
    }
    private finish(run: DemoRun) {
        if (run.finishedDay !== null) return;
        run.finishedDay = this.day;
        if (run.state.status === 'won') {
            const boss = bossForNewBattle(run.bossId);
            if (!this.victories.includes(boss.id)) {
                this.victories.push(boss.id); this.owned = [...new Set([...this.owned, ...boss.unlocks])];
                this.records.push({ bossId: boss.id, battleId: run.id, wonDay: this.day, turn: run.state.turn, victory: boss.victory,
                    rescueUsed: run.state.rescueUsed, unlocks: boss.unlocks, usedTechniqueIds: run.used,
                    loadout: run.state.loadout.map(skill => ({ ...skill, edition: this.editions.find(value => value.practice.id === skill.versionId)?.practice.edition })) });
            }
            const rewards = earnedBattleRewards(boss, run.state);
            for (const id of rewards.achievements) if (!this.rewards.some(value => value.id === id)) this.rewards.push({ kind: 'achievement', id });
        }
        this.choices.delete(run.id);
        this.pending = this.resume ? { ...this.resume, fromDay: this.day + 1 } : { mode: 'idle', practiceId: null, battleId: null, fromDay: this.day + 1 };
    }
    advanceDay() {
        const sources = this.sources(), active = this.current.mode === 'practice' ? this.current.practiceId : null;
        const result = settlePracticeDay(this.day, active, this.editions.map(value => value.practice), this.weeks, sources);
        this.weeks = result.weeks;
        for (const stored of this.editions) stored.practice = result.versions.find(value => value.id === stored.practice.id)!;
        if (this.weeklyFixture) { this.weeklyFixture.successes += sources[0]!.successes; if (this.day + 1 >= this.weeklyFixture.end) this.weeklyFixture = null; }
        const run = this.runs.find(value => value.id === this.current.battleId);
        if (run && run.startsDay <= this.day && ['active', 'awaiting_rescue'].includes(run.state.status)) {
            const chosen = this.choices.get(run.id), contribution = { habits: battleHabitContribution(sources), tasks: 0 };
            const resolved = settleBattleDay(run, this.day, chosen ? { ...chosen, contribution } : null);
            Object.assign(run, resolved.run); run.version++;
            if (chosen && resolved.fought) { run.used = [...new Set([...run.used, chosen.techniqueId])]; this.choices.delete(run.id); }
            if (resolved.entries.length) this.events.push({ battleId: run.id, day: this.day, kind: 'settlement', entries: resolved.entries, result: { contribution } });
            if (resolved.automaticDeath) this.death(run);
            if (['won', 'dead', 'expired', 'withdrawn'].includes(run.state.status)) this.finish(run);
        }
        this.day++; this.version++;
        if (this.pending && this.pending.fromDay <= this.day) { this.current = this.pending; this.pending = null; }
        return this.overview();
    }
    advanceToNextTier() {
        if (this.current.mode !== 'practice') throw Error('Chọn luyện một công pháp trước.');
        const stored = this.editions.find(value => value.practice.id === this.current.practiceId)!;
        const current = stored.practice.tiers.length;
        if (current === 4) throw Error('Đã hoàn tất 4 tầng.');
        for (let index = 0; index < 61 && stored.practice.tiers.length === current; index++) this.advanceDay();
    }
}
