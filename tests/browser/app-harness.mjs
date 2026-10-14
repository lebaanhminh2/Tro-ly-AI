import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createDemo } from '../../web/demo/state.js';
import { checkinProgress } from '../../web/models/cultivation.js';
import { assessHabitDay, newHabitPeriod } from '../../src/domain/habits.ts';
import { TECHNIQUES, SCHOOLS, INITIAL_TECHNIQUES } from '../../src/domain/techniques.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';
import { newTimePracticeVersion } from '../../src/domain/practice-progression.ts';
import { practicePresentation, practiceUpgrade } from '../../src/domain/practice-presentation.ts';
import { practiceStrength } from '../../src/domain/technique-profile.ts';
import { GAME_BOSSES, GAME_CHAPTERS, GAME_CONTENT_VERSION, bossById, bossIntents, publicGameCatalog } from '../../src/domain/game-content.ts';
import { GAME_CHARACTERS } from '../../src/domain/game-characters.ts';
import { playerGameCatalog } from '../../src/domain/game-discovery.ts';
import { newBattleState, publicBattleState, battleChoiceDetail, resolveBattleTurn } from '../../src/domain/battle.ts';
import { armedBattleState } from '../../src/domain/game-rewards.ts';
import { fighterForRank, rescueQuote, payBattleRescue } from '../../src/domain/battle-economy.ts';
import { GameExportService } from '../../src/application/game-export-service.ts';
// Real-browser smoke tests. Only localhost fixtures are used; no .env or cloud data.
const browserBin = process.env.BROWSER_BIN || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].find(existsSync);
const clone = value => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-10-05T10:00:00+07:00');
function fixture() {
    const demo = createDemo(), operatingDay = Math.floor((now + 25200000 - 270 * 60000) / 86400000);
    const start = operatingDay * 86400000 - 25200000 + 270 * 60000, target = start + 18 * 3600000;
    const tasks = demo.tasks.map((t, i) => ({
        id: 'task-' + i, public_code: t.code, title: t.title, note: '', version: 1, deadline: t.deadline || null,
        status: 'active', actual_minutes: 10, remaining_minutes: 90,
        steps: t.steps.map((s, j) => ({ id: 'step-' + j, step_code: j + 1, title: s.title, version: 1, status: s.done ? 'completed' : 'active' }))
    }));
    const state = {
        now, account: { version: 1, state: { ...demo.cultivation, earned: demo.cultivation.totalEarned, heartDay: null, peaceDay: null } },
        tasks, reminders: [{ id: 'reminder-1', version: 1, title: 'Uống nước', kind: 'daily', times: ['09:00', '15:00'], weekdays: [], startDate: '2026-10-05', endDate: null, enabled: true }],
        settings: { version: 1, start_minutes: 270, sleep_minutes: 1350, auto_plan_delay_minutes: 180 },
        day: { day: operatingDay, version: 1, start_at: start, target_sleep: target, end_at: start + 86400000, intervals_json: '{}', task_plan_status: 'active', task_plan_generation: 1 },
        dailyPlan: { version: 1, plan: { items: [{ taskId: 'task-0', minutes: 90, remaining: 90, actualMinutes: 10, scheduledMinutes: 90, windows: [{ start: now - 600000, end: now + 4800000 }] }], planned: 90, capacity: 480, risks: [] } },
        timeline: { window: { start, target }, blocks: [{ id: 'block-1', task_id: 'task-0', start_at: now - 600000, minutes: 90, version: 1 }], busy: [], free: [{ start, end: target }], events: [], stamp: 'test-stamp' },
        taskFocus: null, taskFocusTarget: { taskId: 'task-0', endsAt: now + 4800000 }, rest: { reason: 'active' }, sleepStatus: { asleep: false, canUndo: false }, resting: false, needsSetup: false,
        progress: { completions: [], milestones: [], achievements: [] }, sessions: [], events: []
    };
    const control = { state, authenticated: true, failBootstrap: false, calls: [], posts: [], receipts: new Map(),
        habits: { now, day: { day: operatingDay, startAt: start, endAt: start + 86400000 }, habits: [] },
        presets: { version: 0, presets: [] }, presetRequests: [],
        battleRuns: new Map(), practiceVersions: [], game: { now, day: { day: operatingDay, startAt: start, endAt: start + 86400000 }, version: 0,
            current: { fromDay: operatingDay, mode: 'idle', practiceId: null, battleId: null }, pending: null,
            currentPractice: null, pendingPractice: null, owned: INITIAL_TECHNIQUES, settledThrough: operatingDay - 1, audits: [], recent: [], battles: [], victories: [], choices: [], rewards: [],
            combatEconomy: { healthyVersion: state.account.version, qi: state.account.state.qi, rank: state.account.state.rank, rankLockUntilDay: null } } };
    control.bootstrap = () => ({ ...state, checkin: checkinProgress(state.account.state, now) });
    control.mutate = (path, input) => {
        if (control.receipts.has(input.id))
            return control.receipts.get(input.id);
        control.posts.push({ path, input: clone(input) });
        let result = { saved: true };
        const task = state.tasks.find(t => t.id === input.taskId);
        if (path === 'game-presets') {
            const presetId = input.presetId ?? 'set_' + input.id, index = control.presets.presets.findIndex(preset => preset.id === presetId);
            if (input.operation === 'delete') control.presets.presets.splice(index, 1);
            else {
                const preset = { id: presetId, name: input.name, versions: input.versions, weaponId: input.weaponId };
                if (index < 0) control.presets.presets.push(preset); else control.presets.presets[index] = preset;
            }
            result = { saved: true, version: ++control.presets.version, presetId, deleted: input.operation === 'delete' };
        }
        else if (path === 'game') {
            control.game.version++;
            if (input.operation.includes('battle')) {
                const game = control.game;
                if (input.operation === 'prepare_battle') {
                    const content = bossById(input.bossId), id = 'b_' + input.id, combatRank = state.account.state.rank;
                    const loadout = input.versions.map(id => control.practiceVersions.find(version => version.practice.id === id)?.practice).filter(Boolean)
                        .map(practice => ({ id: practice.techniqueId, versionId: practice.id, tier: practice.tiers.length, purityBp: practice.tiers.at(-1).purityBp, strength: practiceStrength(practice) }));
                    const run = { id, bossId: content.id, contentVersion: GAME_CONTENT_VERSION, combatRank, weaponId: null,
                        state: newBattleState(fighterForRank(combatRank), content.fighter, loadout, bossIntents(content), content.maxTurns, content.revival),
                        startsDay: game.day.day + 1, lastDay: null, waitDays: 0, rescueUntilDay: null, deathPaid: false };
                    control.battleRuns.set(id, run);
                    game.battles.unshift({ id, bossId: content.id, version: 1, status: 'prepared', startsDay: run.startsDay, weaponId: run.weaponId, content,
                        state: publicBattleState(run.state), rescue: rescueQuote(state.account.state, combatRank) });
                    game.pending = { fromDay: run.startsDay, mode: 'battle', practiceId: null, battleId: id };
                } else {
                    const battle = game.battles.find(battle => battle.id === input.battleId), run = control.battleRuns.get(battle.id);
                    battle.version++;
                    if (input.operation === 'update_prepared_battle') {
                        const loadout = input.versions.map(id => control.practiceVersions.find(version => version.practice.id === id)?.practice).filter(Boolean)
                            .map(practice => ({ id: practice.techniqueId, versionId: practice.id, tier: practice.tiers.length, purityBp: practice.tiers.at(-1).purityBp, strength: practiceStrength(practice) }));
                        run.state = newBattleState(fighterForRank(run.combatRank), battle.content.fighter, loadout, bossIntents(battle.content), battle.content.maxTurns, battle.content.revival);
                        battle.state = publicBattleState(run.state); run.weaponId = battle.weaponId = null;
                    }
                    if (input.operation === 'choose_battle') {
                        game.choices = [{ battleId: battle.id, techniqueId: input.techniqueId, acceptCost: input.acceptCost }];
                    } else if (input.operation === 'exchange_battle') {
                        const practice = control.practiceVersions.find(value => value.practice.id === input.practiceId)?.practice;
                        const slot = run.state.loadout.findIndex(value => value.id === input.removeId);
                        assert.ok(practice && slot >= 0 && run.state.exchangeAfterTurn === run.state.turn);
                        run.state.loadout[slot] = { id: practice.techniqueId, versionId: practice.id,
                            tier: practice.tiers.length, purityBp: practice.tiers.at(-1).purityBp, strength: practiceStrength(practice) };
                        run.state.exchangeAfterTurn = null; battle.state = publicBattleState(run.state);
                    } else if (input.operation === 'rescue_battle') {
                        const paid = payBattleRescue(state.account.state, run.state, input.kind, run.combatRank, { rankLockUntilDay: null }, game.day.day);
                        state.account.state = paid.healthy; state.account.version++;
                        state.account.combatRestrictions = paid.restrictions;
                        run.state = paid.battle; run.combatRank = paid.combatRank; run.rescueUntilDay = null;
                        battle.state = publicBattleState(run.state); battle.status = run.state.status;
                        game.combatEconomy = { healthyVersion: state.account.version, qi: paid.healthy.qi, rank: paid.healthy.rank, rankLockUntilDay: paid.restrictions.rankLockUntilDay };
                    } else if (input.operation === 'cancel_battle') {
                        battle.status = 'cancelled'; game.pending = null;
                    }
                }
                result = { saved: true, version: game.version };
                control.receipts.set(input.id, clone(result)); return result;
            }
            let stored;
            if (input.operation === 'start_practice') {
                const edition = control.practiceVersions.filter(item => item.practice.techniqueId === input.techniqueId).length + 1;
                stored = { practice: newTimePracticeVersion('p_' + input.id, input.techniqueId, control.game.day.day, TECHNIQUES.find(value => value.id === input.techniqueId).trainingFactor, edition), version: 1, created: now + edition };
                control.practiceVersions.unshift(stored);
            } else if (input.operation === 'continue_practice') stored = control.practiceVersions.find(item => item.practice.id === input.practiceId);
            control.game.pending = { fromDay: control.game.day.day + 1, mode: stored ? 'practice' : 'idle', practiceId: stored?.practice.id ?? null, battleId: null };
            control.game.pendingPractice = stored ?? null;
            result = { saved: true, effectiveFrom: control.game.pending.fromDay, practiceId: stored?.practice.id ?? null, version: control.game.version };
        }
        else if (path === 'habits') {
            const day = control.habits.day.day;
            let view = control.habits.habits.find(item => item.habit.id === input.habitId);
            if (input.operation === 'create') {
                const definition = { ...input.definition, target: input.definition.target * 100, unit: input.definition.metric === 'check' ? 'lần' : input.definition.metric === 'duration' ? 'phút' : input.definition.unit,
                    commitmentFrom: day + (input.definition.cadence.kind === 'weekly' ? 7 - ((day + 3) % 7) : 1) };
                view = { habit: { id: 'h_' + input.id, version: 1, createdDay: day, archivedFrom: null, revisions: [{ fromDay: day, definition }] },
                    definition, pending: null, log: { value: 0, note: '', version: 0 }, preview: null, slot: null, reminderTime: input.reminderTime ?? null };
                control.habits.habits.push(view); result = { saved: true, habitId: view.habit.id, version: 1 };
            } else if (input.operation === 'log') {
                view.log = { value: input.value * 100, note: input.note, version: view.log.version + 1 };
                result = { saved: true, version: view.log.version };
            } else if (input.operation === 'update') {
                view.habit.version++;
                view.pending = { fromDay: day + 1, definition: { ...input.definition, target: input.definition.target * 100, commitmentFrom: day + 1 } };
            } else if (input.operation === 'archive') {
                view.habit.version++; view.habit.archivedFrom = day + 1;
            } else if (input.operation === 'slot' || input.operation === 'remove_slot') {
                view.habit.version++;
                view.slot = input.operation === 'slot' ? { startAt: input.startAt, minutes: input.minutes, version: 1 } : null;
                state.timeline.habitSlots = control.habits.habits.filter(item => item.slot).map(item => ({ ...item.slot, habitId: item.habit.id, day, name: item.definition.name }));
                result = { saved: true, version: view.habit.version };
            }
            if (view) {
                const period = newHabitPeriod(view.definition, day); period.closedThrough = day - 1;
                view.preview = assessHabitDay(view.definition, day, view.log.value, period, view.habit.archivedFrom);
            }
        }
        else if (path === 'tasks') {
            if (input.operation === 'create') {
                const created = { id: 'new-task-' + state.tasks.length, public_code: 30 + state.tasks.length, title: input.title, note: input.note || '', version: 1, deadline: input.deadline || null, status: 'active', steps: [], remaining_minutes: input.remainingMinutes };
                state.tasks.push(created);
                result = { id: created.id };
            }
            else if (task) {
                task.version++;
                if (input.operation === 'edit') {
                    task.title = input.title;
                    task.note = input.note;
                    if ('remainingMinutes' in input)
                        task.remaining_minutes = input.remainingMinutes;
                    if ('deadline' in input)
                        task.deadline = input.deadline;
                }
                if (input.operation === 'delete_step')
                    task.steps = task.steps.filter(s => s.id !== input.stepId);
                if (input.operation === 'add_step')
                    task.steps.push({ id: 'added-step', step_code: task.steps.length + 1, title: input.title, version: 1, status: 'active' });
                if (input.operation === 'step_status')
                    task.steps.find(s => s.id === input.stepId).status = input.complete ? 'completed' : 'active';
                if (input.operation === 'complete')
                    task.status = input.complete ? 'completed' : 'active';
                result = { id: task.id };
            }
        }
        else if (path === 'task-focus') {
            state.taskFocus = input.operation === 'start' ? { ...state.taskFocusTarget, startedAt: now } : null;
            result = state.taskFocus ? { active: true, ...state.taskFocus } : { active: false };
        }
        else if (path === 'sleep') {
            const c = state.account.state;
            if (input.operation === 'report') {
                const generation = (state.sleepStatus.generation ?? 0) + 1;
                state.sleepStatus = { asleep: true, until: state.day.end_at, reportedAt: state.now, generation, canUndo: true, undoUntil: state.now + 300000 };
                state.rest = { reason: 'asleep', reportedAt: state.now, until: state.day.end_at };
                state.day.asleep_at = state.now;
                c.qi += 5;
                c.streak++;
            }
            else {
                state.sleepStatus = { ...state.sleepStatus, asleep: false, canUndo: false, undoUntil: null };
                state.rest = { reason: 'active' };
                state.day.asleep_at = null;
                c.qi -= 5;
                c.streak--;
            }
            state.resting = state.sleepStatus.asleep;
            result = { sleep: clone(state.sleepStatus), rest: clone(state.rest) };
        }
        else if (path === 'task-work') {
            task.actual_minutes = input.minutes;
            state.dailyPlan.plan.items.find(i => i.taskId === task.id).actualMinutes = input.minutes;
        }
        else if (path === 'day-plan') {
            state.dailyPlan.version++;
            state.dailyPlan.plan.items = input.items.map(i => ({ ...i, windows: [{ start: now, end: now + i.minutes * 60000 }], remaining: i.minutes, actualMinutes: 10 }));
        }
        else if (path === 'settings') {
            state.settings.version++;
            const minutes = value => {
                const [h, m] = value.split(':').map(Number);
                return h * 60 + m;
            };
            state.settings.start_minutes = minutes(input.start);
            state.settings.sleep_minutes = minutes(input.sleep);
            state.settings.auto_plan_delay_minutes = input.autoPlanDelayMinutes;
        }
        else if (path === 'reminders') {
            const rule = input.rule, existing = state.reminders.find(r => r.id === rule.id);
            if (existing)
                Object.assign(existing, rule, { version: existing.version + 1 });
            else
                state.reminders.push({ ...rule, id: 'new-reminder', version: 1 });
        }
        else if (path === 'cultivation') {
            const c = state.account.state;
            if (input.operation === 'checkin') {
                const progress = checkinProgress(c, now), reward = progress.rewards[progress.count];
                c.checkin = { cycleStartDay: progress.cycleStartDay ?? progress.calendarDay, count: reward.day, lastDay: progress.calendarDay };
                c.qi += reward.qi;
                c.earned += reward.qi;
                c.tickets += reward.tickets;
                for (const [key, amount] of Object.entries(reward.items))
                    c.inventory[key] += amount;
                result = { dailyReward: reward };
            }
            else if (input.operation === 'draw') {
                c.tickets--;
                c.inventory.basic++;
                result = { reward: 'basic' };
            }
            else if (input.operation === 'fuse') {
                c.inventory.basic -= 3;
                c.inventory.middle++;
                result = { success: true };
            }
            else if (input.operation === 'protect') {
                c.inventory[input.item]--;
                c[input.item + 'Day'] = operatingDay;
                result = { protected: true };
            }
            else if (input.operation === 'breakthrough') {
                c.rank++;
                result = { success: true, penalty: 0 };
            }
        }
        const response = clone({ result, ...(['cultivation', 'sleep'].includes(path) ? { account: state.account } : {}) });
        control.receipts.set(input.id, response);
        return response;
    };
    return control;
}
async function serve(control, baseline) {
    const root = resolve('web'), cache = new Map();
    const presented = stored => stored ? { ...stored, maintained: stored.maintained !== false,
        name: TECHNIQUES.find(value => value.id === stored.practice.techniqueId).name,
        ...practicePresentation(stored.practice, 100, { afterDay: control.game.day.day, weeks: control.game.audits }) } : null;
    const server = createServer(async (request, response) => {
        try {
            const path = new URL(request.url, 'http://localhost').pathname;
            if (path.startsWith('/api/')) {
                const endpoint = path.slice(5);
                control.calls.push(request.method + ' ' + endpoint);
                response.setHeader('Content-Type', 'application/json');
                if (endpoint.startsWith('browser-auth/')) {
                    if (endpoint.endsWith('logout'))
                        control.authenticated = false;
                    response.end(JSON.stringify(endpoint.endsWith('start') ? { code: 'TEST-CODE', authenticated: false } : { authenticated: control.authenticated }));
                    return;
                }
                if (!control.authenticated) {
                    response.statusCode = 401;
                    response.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
                    return;
                }
                if (request.method === 'GET') await control.readGates?.get(endpoint)?.();
                if (request.method === 'GET' && control.readDelays?.[endpoint]) await delay(control.readDelays[endpoint]);
                if (request.method === 'GET' && control.failedReads?.has(endpoint)) {
                    response.statusCode = 503;
                    response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' })); return;
                }
                if (endpoint === 'bootstrap') {
                    if (control.failBootstrap) {
                        response.statusCode = 503;
                        response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' }));
                    }
                    else
                        response.end(JSON.stringify(control.bootstrap()));
                }
                else if (endpoint === 'game' && request.method === 'GET') response.end(JSON.stringify({ ...control.game,
                    currentPractice: presented(control.game.currentPractice), pendingPractice: presented(control.game.pendingPractice) }));
                else if (endpoint === 'game-technique') {
                    const params = new URL(request.url, 'http://localhost').searchParams, id = params.get('techniqueId'), selectedId = params.get('versionId');
                    const catalog = playerGameCatalog({ victories: control.game.victories, learned: control.game.learned ?? [], owned: control.game.owned });
                    const technique = catalog.techniques.find(value => value.id === id);
                    const versions = control.practiceVersions.filter(value => value.practice.techniqueId === id && value.maintained !== false).slice(0, 2);
                    const selected = selectedId ? control.practiceVersions.find(value => value.practice.id === selectedId && value.practice.techniqueId === id) : versions[0] ?? null;
                    if (!technique || technique.discovery === 'sealed' || selectedId && !selected) {
                        response.statusCode = 409; response.end(JSON.stringify({ error: 'TECHNIQUE_LOCKED' })); return;
                    }
                    response.end(JSON.stringify({ technique, selected: presented(selected), versions: versions.map(presented),
                        upgrade: practiceUpgrade(selected?.practice ?? null, id, 100, { afterDay: control.game.day.day, weeks: control.game.audits }) }));
                }
                else if (endpoint === 'game-catalog') response.end(JSON.stringify(baseline ? publicGameCatalog() : playerGameCatalog({
                    victories: control.game.victories, learned: control.game.learned ?? [], owned: control.game.owned
                })));
                else if (endpoint === 'game-victories') response.end(JSON.stringify({ victories: control.victoryRecords ?? [] }));
                else if (endpoint === 'game-export') {
                    if (control.failGameExport) {
                        response.statusCode = 409; response.end(JSON.stringify({ error: 'GAME_EXPORT_TOO_LARGE', message: 'Dữ liệu vượt giới hạn một lần xuất.' })); return;
                    }
                    const params = new URL(request.url, 'http://localhost').searchParams;
                    const service = new GameExportService({ read: async () => ({ profile: { account: null, cultivation: control.state.account.state,
                        owned: control.game.owned, victories: control.game.victories, entitlements: control.game.rewards, presets: control.presets.presets },
                        selections: [], practiceVersions: control.practiceVersions, days: [], battles: [], events: [], weeklyAudits: [] }) });
                    response.end(JSON.stringify(await service.read('123', Number(params.get('from')), Number(params.get('to')), now)));
                }
                else if (endpoint === 'game-presets' && request.method === 'GET') response.end(JSON.stringify(control.presets));
                else if (endpoint === 'game-boss') {
                    const boss = bossById(new URL(request.url, 'http://localhost').searchParams.get('bossId'));
                    response.end(JSON.stringify({ boss: { ...boss, pattern: undefined, victory: control.game.victories.includes(boss.id) ? boss.victory : undefined } }));
                }
                else if (endpoint === 'game-chapter') {
                    const chapter = GAME_CHAPTERS.find(value => value.number === Number(new URL(request.url, 'http://localhost').searchParams.get('chapter')));
                    response.end(JSON.stringify({ chapter: { ...chapter, conclusion: chapter.encounters.every(id => control.game.victories.includes(id)) ? chapter.conclusion : undefined },
                        characters: GAME_CHARACTERS.filter(character => chapter.characters.includes(character.id)) }));
                }
                else if (endpoint === 'battle-loadout') {
                    const ids = new URL(request.url, 'http://localhost').searchParams.getAll('versionId');
                    if (ids.length) {
                        response.end(JSON.stringify({ versions: ids.flatMap(id => {
                            const practice = control.practiceVersions.find(entry => entry.maintained !== false && entry.practice.id === id)?.practice, tier = practice?.tiers.at(-1);
                            return tier ? [{ ...tier, techniqueId: practice.techniqueId, versionId: id, edition: practice.edition, tier: practice.tiers.length,
                                profile: practicePresentation(practice).profile, strength: practiceStrength(practice) }] : [];
                        }) })); return;
                    }
                    const best = new Map();
                    for (const entry of control.practiceVersions) {
                        const practice = entry.practice, tier = practice.tiers.at(-1); if (!tier || entry.maintained === false) continue;
                        const value = { techniqueId: practice.techniqueId, versionId: practice.id, edition: practice.edition, tier: practice.tiers.length, purityBp: tier.purityBp,
                            profile: practicePresentation(practice).profile, strength: practiceStrength(practice) }, previous = best.get(practice.techniqueId);
                        if (!previous || value.tier > previous.tier || value.tier === previous.tier &&
                            (value.profile.damage > previous.profile.damage || value.profile.damage === previous.profile.damage && value.purityBp > previous.purityBp)) best.set(practice.techniqueId, value);
                    }
                    response.end(JSON.stringify({ versions: [...best.values()] }));
                }
                else if (endpoint === 'battle-choice') {
                    const params = new URL(request.url, 'http://localhost').searchParams;
                    const run = control.battleRuns.get(params.get('battleId')), battle = control.game.battles.find(value => value.id === run?.id);
                    if (!run || !battle) { response.statusCode = 404; response.end(JSON.stringify({ error: 'BATTLE_NOT_FOUND' })); return; }
                    response.end(JSON.stringify({ day: control.game.day.day, gameVersion: control.game.version, battleVersion: battle.version,
                        ...battleChoiceDetail(run.state, params.get('techniqueId')) }));
                }
                else if (endpoint === 'battles') {
                    const before = new URL(request.url, 'http://localhost').searchParams.get('before') ?? '';
                    (control.archiveReads ??= []).push(before);
                    response.end(JSON.stringify(control.archivePages?.get(before) ?? { battles: control.game.battles, next: null }));
                }
                else if (endpoint === 'battle-history') {
                    const before = Number(new URL(request.url, 'http://localhost').searchParams.get('before'));
                    (control.historyReads ??= []).push(before);
                    response.end(JSON.stringify(control.historyPages?.get(before) ?? { events: [], next: null }));
                }
                else if (endpoint === 'practice-versions') {
                    const id = new URL(request.url, 'http://localhost').searchParams.get('techniqueId');
                    response.end(JSON.stringify({ versions: control.practiceVersions.filter(item => item.practice.techniqueId === id).map(presented), next: null }));
                }
                else if (endpoint === 'habits' && request.method === 'GET')
                    response.end(JSON.stringify(control.habits));
                else if (endpoint === 'habit-history') {
                    const params = new URL(request.url, 'http://localhost').searchParams;
                    const rows = control.habits.habits.filter(view => !params.get('habitId') || params.get('habitId') === view.habit.id)
                        .map(view => ({ habitId: view.habit.id, day: control.habits.day.day, name: view.definition.name,
                            definition: view.definition, value: view.log.value, note: view.log.note, status: 'processing', reason: 'day_open', successes: 0, misses: 0 }));
                    response.end(JSON.stringify({ rows, next: null }));
                }
                else if (endpoint === 'habit-report') {
                    const params = new URL(request.url, 'http://localhost').searchParams, from = Number(params.get('from')), to = Number(params.get('to'));
                    const outcomes = (control.habitOutcomes ?? []).filter(row => row.day >= from && row.day <= to
                        && (!params.get('habitId') || row.habitId === params.get('habitId')));
                    const byHabit = [], days = [];
                    for (const row of outcomes) {
                        let habit = byHabit.find(item => item.habitId === row.habitId), day = days.find(item => item.day === row.day);
                        if (!habit) { habit = { habitId: row.habitId, name: row.name, successes: 0, misses: 0, neutral: 0, rate: null, days: [] }; byHabit.push(habit); }
                        if (!day) { day = { day: row.day, successes: 0, misses: 0, neutral: 0 }; days.push(day); }
                        habit.successes += row.successes; habit.misses += row.misses; habit.neutral += +(row.status === 'neutral'); habit.days.push(row);
                        day.successes += row.successes; day.misses += row.misses; day.neutral += +(row.status === 'neutral');
                    }
                    for (const habit of byHabit) habit.rate = habit.successes + habit.misses ? Math.round(100 * habit.successes / (habit.successes + habit.misses)) : null;
                    const successes = days.reduce((sum, row) => sum + row.successes, 0), misses = days.reduce((sum, row) => sum + row.misses, 0);
                    response.end(JSON.stringify({ from, to, successes, misses, neutral: days.reduce((sum, row) => sum + row.neutral, 0),
                        rate: successes + misses ? Math.round(100 * successes / (successes + misses)) : null, days, totals: [], byHabit }));
                }
                else if (endpoint === 'history')
                    response.end(JSON.stringify({ result: { items: [], offset: 0, total: 0, hasMore: false } }));
                else if (endpoint === 'tasks-page') {
                    const offset = Number(new URL(request.url, 'http://localhost').searchParams.get('offset') ?? 0);
                    response.end(JSON.stringify({ result: { items: control.state.tasks.slice(offset, offset + 200), offset, total: control.state.tasks.length, hasMore: offset + 200 < control.state.tasks.length } }));
                }
                else {
                    let body = '';
                    for await (const part of request)
                        body += part;
                    if (endpoint === 'game') {
                        const input = JSON.parse(body), battle = control.game.battles.find(battle => battle.id === input.battleId);
                        if (!control.receipts.has(input.id) && (input.version !== control.game.version || input.day !== control.game.day.day || battle && input.battleVersion !== battle.version)) {
                            response.statusCode = 409;
                            response.end(JSON.stringify({ error: 'GAME_CHANGED', message: 'Tiến trình đã thay đổi. Tải lại trước khi lưu.' })); return;
                        }
                        if (control.gameAckOutage) {
                            control.gameAckOutage = false; control.mutate(endpoint, input); response.statusCode = 503;
                            response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' })); return;
                        }
                    }
                    if (endpoint === 'game-presets') {
                        const input = JSON.parse(body); control.presetRequests.push(input);
                        if (!control.receipts.has(input.id) && input.version !== control.presets.version) {
                            response.statusCode = 409;
                            response.end(JSON.stringify({ error: 'GAME_PRESETS_CHANGED', message: 'Bộ chiêu đã thay đổi ở nơi khác.' })); return;
                        }
                        if (control.presetAckOutage) {
                            control.presetAckOutage = false; control.mutate(endpoint, input); response.statusCode = 503;
                            response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' })); return;
                        }
                    }
                    if (endpoint === 'sleep' && control.sleepError) {
                        response.statusCode = 409;
                        response.end(JSON.stringify({ error: 'SLEEP_UNDO_LOCKED', message: 'Không thể hoàn tác sau khi đột phá.' }));
                        return;
                    }
                    response.end(JSON.stringify(control.mutate(endpoint, JSON.parse(body))));
                }
                return;
            }
            const relative = path === '/app/' || path === '/' ? 'index.html' : path.replace(/^\/app\//, '').replace(/^\//, '');
            const file = resolve(root, relative);
            if (!file.startsWith(root + sep)) {
                response.statusCode = 403;
                response.end();
                return;
            }
            let body;
            if (baseline) {
                if (!cache.has(relative))
                    cache.set(relative, execFileSync('git', ['show', baseline + ':web/' + relative], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }));
                body = cache.get(relative);
            }
            else
                body = await readFile(file);
            response.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.webp') ? 'image/webp' : relative.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
            response.end(body);
        }
        catch {
            response.statusCode = 404;
            response.end('Not found');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { url: 'http://127.0.0.1:' + server.address().port + '/app/', close: () => new Promise(resolve => server.close(resolve)) };
}
async function chrome() {
    const profile = await mkdtemp(join(tmpdir(), 'minh-anh-browser-'));
    const browserProcess = spawn(browserBin, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const cleanup = async () => {
        browserProcess.kill();
        await delay(250);
        const target = resolve(profile);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith('minh-anh-browser-'));
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    };
    try {
        let port;
        for (let i = 0; i < 120; i++) {
            try {
                port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
                break;
            }
            catch {
                await delay(100);
            }
        }
        if (!port)
            throw Error('Browser debugging port unavailable');
        const target = (await (await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(5000) })).json()).find(t => t.type === 'page');
        const socket = new WebSocket(target.webSocketDebuggerUrl), pending = new Map(), errors = [];
        let sequence = 0;
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                socket.close();
                reject(Error('Browser handshake timed out'));
            }, 5000);
            socket.addEventListener('open', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
            socket.addEventListener('error', error => {
                clearTimeout(timer);
                reject(error);
            }, { once: true });
        });
        socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const request = pending.get(message.id);
                if (!request)
                    return;
                pending.delete(message.id);
                clearTimeout(request.timer);
                message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result);
            }
            if (message.method === 'Runtime.exceptionThrown')
                errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        });
        const call = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++sequence, timer = setTimeout(() => {
                pending.delete(id);
                reject(Error('Browser command timed out: ' + method));
            }, 5000);
            pending.set(id, { resolve, reject, timer });
            socket.send(JSON.stringify({ id, method, params }));
        });
        await call('Runtime.enable');
        await call('Page.enable');
        const evaluate = async (expression) => {
            const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (result.exceptionDetails)
                throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        };
        const wait = async (expression) => {
            for (let i = 0; i < 150; i++) {
                if (await evaluate(expression))
                    return;
                await delay(80);
            }
            throw Error('Timed out waiting for ' + expression + '\n' + errors.join('\n') + '\n' + await evaluate('document.body.innerText'));
        };
        return {
            errors, evaluate, wait,
            async scaleText(factor = 1) {
                await evaluate(`(() => {
                    const originals = globalThis.__qaTextOriginals ??= new Map();
                    for (const [node, size] of originals) if (node.isConnected) node.style.fontSize = size;
                    originals.clear();
                    if (${factor} === 1) return;
                    const sizes = [...document.querySelectorAll('body *')].map(node => [node, getComputedStyle(node).fontSize]);
                    for (const [node, size] of sizes) {
                        originals.set(node, node.style.fontSize);
                        node.style.fontSize = parseFloat(size) * ${factor} + 'px';
                    }
                })()`);
            },
            async networkConditions(offline = false, latency = 150, bytesPerSecond = 102400) {
                await call('Network.enable');
                await call('Network.emulateNetworkConditions', { offline, latency, downloadThroughput: bytesPerSecond,
                    uploadThroughput: bytesPerSecond, connectionType: 'cellular3g' });
            },
            async press(key, code = key) {
                const windowsVirtualKeyCode = { Enter: 13, Escape: 27, Tab: 9 }[key];
                await call('Emulation.setFocusEmulationEnabled', { enabled: true });
                await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode });
                if (key === 'Enter') await call('Input.dispatchKeyEvent', { type: 'char', key, code, text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode });
                await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
            },
            async colorScheme(value) {
                await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
            },
            async screenshot(path) {
                const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path, Buffer.from(data, 'base64'));
            },
            async resize(width, height) {
                await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
                await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
            },
            async tap(selector) {
                await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
                const point = await evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)});if(!node)return null;const rect=node.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}; })()`);
                assert.ok(point, 'Missing tap target: ' + selector);
                await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
                await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
            },
            async navigate(url, width = 1440) {
                errors.length = 0;
                await call('Emulation.setDeviceMetricsOverride', { width, height: width < 900 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 900 });
                await call('Page.navigate', { url });
            },
            async click(label, selector = 'button') {
                const done = await evaluate(`(() => { const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.textContent.trim()===${JSON.stringify(label)}&&!n.disabled); if(!node)return false; node.click();return true; })()`);
                assert.equal(done, true, 'Missing enabled control: ' + label);
            },
            async close() {
                socket.close();
                await cleanup();
            }
        };
    }
    catch (error) {
        await cleanup();
        throw error;
    }
}
async function snapshot(browser) {
    return browser.evaluate(`(() => { const root=document.querySelector('#content');const rect=root.getBoundingClientRect();return {text:root.innerText,buttons:[...root.querySelectorAll('button')].map(b=>({text:b.innerText,disabled:b.disabled})),geometry:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
}


export { browserBin, fixture, serve, chrome, snapshot, clone, now };
