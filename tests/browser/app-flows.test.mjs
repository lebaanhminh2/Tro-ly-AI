import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createDemo } from '../../web/demo/state.js';
import { checkinProgress } from '../../web/models/cultivation.js';
import { assessHabitDay, newHabitPeriod } from '../../src/domain/habits.ts';
import { TECHNIQUES, SCHOOLS, INITIAL_TECHNIQUES } from '../../src/domain/techniques.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';
import { GAME_BOSSES, GAME_CHAPTERS, bossById, bossIntents, publicGameCatalog } from '../../src/domain/game-content.ts';
import { GAME_CHARACTERS } from '../../src/domain/game-characters.ts';
import { newBattleState, publicBattleState } from '../../src/domain/battle.ts';
import { armedBattleState } from '../../src/domain/game-rewards.ts';
import { fighterForRank, rescueQuote, payBattleRescue } from '../../src/domain/battle-economy.ts';
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
        if (path === 'game') {
            control.game.version++;
            if (input.operation.includes('battle')) {
                const game = control.game;
                if (input.operation === 'prepare_battle') {
                    const content = bossById(input.bossId), id = 'b_' + input.id, combatRank = state.account.state.rank;
                    const loadout = input.versions.map(id => control.practiceVersions.find(version => version.practice.id === id)?.practice).filter(Boolean)
                        .map(practice => ({ id: practice.techniqueId, versionId: practice.id, tier: practice.tiers.length, purityBp: practice.tiers.at(-1).purityBp }));
                    const run = { id, bossId: content.id, contentVersion: 'than-lo-2', combatRank, weaponId: input.weaponId ?? null,
                        state: armedBattleState(fighterForRank(combatRank), content, loadout, bossIntents(content), input.weaponId ?? null),
                        startsDay: game.day.day + 1, lastDay: null, waitDays: 0, rescueUntilDay: null, deathPaid: false };
                    control.battleRuns.set(id, run);
                    game.battles.unshift({ id, version: 1, status: 'prepared', startsDay: run.startsDay, weaponId: run.weaponId, content,
                        state: publicBattleState(run.state), rescue: rescueQuote(state.account.state, combatRank) });
                    game.pending = { fromDay: run.startsDay, mode: 'battle', practiceId: null, battleId: id };
                } else {
                    const battle = game.battles.find(battle => battle.id === input.battleId), run = control.battleRuns.get(battle.id);
                    battle.version++;
                    if (input.operation === 'choose_battle') {
                        game.choices = [{ battleId: battle.id, techniqueId: input.techniqueId, acceptCost: input.acceptCost }];
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
                stored = { practice: newPracticeVersion('p_' + input.id, input.techniqueId, control.game.day.day, 1000, edition), version: 1, created: now + edition };
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
                if (endpoint === 'bootstrap') {
                    if (control.failBootstrap) {
                        response.statusCode = 503;
                        response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' }));
                    }
                    else
                        response.end(JSON.stringify(control.bootstrap()));
                }
                else if (endpoint === 'game' && request.method === 'GET') response.end(JSON.stringify(control.game));
                else if (endpoint === 'game-catalog') response.end(JSON.stringify(publicGameCatalog()));
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
                    const best = new Map();
                    for (const entry of control.practiceVersions) {
                        const practice = entry.practice, tier = practice.tiers.at(-1); if (!tier) continue;
                        const value = { techniqueId: practice.techniqueId, versionId: practice.id, edition: practice.edition, tier: practice.tiers.length, purityBp: tier.purityBp }, previous = best.get(practice.techniqueId);
                        if (!previous || value.tier > previous.tier || value.tier === previous.tier && value.purityBp > previous.purityBp) best.set(practice.techniqueId, value);
                    }
                    response.end(JSON.stringify({ versions: [...best.values()] }));
                }
                else if (endpoint === 'battles') response.end(JSON.stringify({ battles: control.game.battles, next: null }));
                else if (endpoint === 'battle-history') response.end(JSON.stringify({ events: [], next: null }));
                else if (endpoint === 'practice-versions') {
                    const id = new URL(request.url, 'http://localhost').searchParams.get('techniqueId');
                    response.end(JSON.stringify({ versions: control.practiceVersions.filter(item => item.practice.techniqueId === id), next: null }));
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
                else if (endpoint === 'habit-report')
                    response.end(JSON.stringify({ from: control.habits.day.day - 29, to: control.habits.day.day, successes: 0, misses: 0, neutral: 0, rate: null, days: [], totals: [] }));
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
            response.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.webp') ? 'image/webp' : 'text/html');
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
            async colorScheme(value) {
                await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
            },
            async screenshot(path) {
                const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path, Buffer.from(data, 'base64'));
            },
            async resize(width, height) {
                await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
            },
            async tap(selector) {
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

test('battle mobile flow prepares tomorrow, keeps choice pending, exposes rescue costs and retains navigation at narrow widths', { skip: !browserBin, timeout: 90000 }, async () => {
    const control = fixture(); control.state.account.state.rank = 1;
    control.game.victories = ['truy-lenh', 'song-nha', 'thu-lenh'];
    const server = await serve(control); let browser;
    try {
        browser = await chrome(); await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')"); await browser.tap('[data-tab=game]');
        await browser.wait("!!document.querySelector('.practice-intro')"); await browser.click('Hành trình');
        await browser.wait("document.querySelector('.journey-chapter-scene').complete && document.querySelector('.journey-chapter-scene').naturalWidth>0");
        if (process.env.WEB_TEST_SCREENSHOT_PATH) {
            await browser.evaluate("document.querySelectorAll('.journey-boss img').forEach(image=>image.loading='eager')");
            await browser.wait("[...document.querySelectorAll('.journey-boss img')].every(image=>image.complete && image.naturalWidth>0)");
            await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-journey.png'));
            for (const boss of GAME_BOSSES.filter(boss => ['song-nha', 'thu-lenh', 'kiem-truyen'].includes(boss.id))) {
                await browser.evaluate("[...document.querySelectorAll('.journey-boss')].find(row=>row.innerText.includes(" + JSON.stringify(boss.name) + ")).scrollIntoView({block:'center'})");
                await delay(200);
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-boss-' + boss.id + '.png'));
            }
        }
        await browser.evaluate("[...document.querySelectorAll('.journey-boss')].find(row=>row.innerText.includes('Thiết Lệnh Sứ')).querySelector('button').click()");
        await browser.wait("!!document.querySelector('.battle-preparation>.primary')");
        if (process.env.WEB_TEST_SCREENSHOT_PATH) {
            await browser.wait("document.querySelector('.battle-preparation-art').complete && document.querySelector('.battle-preparation-art').naturalWidth>0");
            await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-battle-preparation.png'));
        }
        await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!!document.querySelector('.battle-card') && !document.querySelector('#sheet').open");
        assert.equal(control.game.current.mode, 'idle'); assert.equal(control.game.pending.mode, 'battle');
        const battle = control.game.battles[0];
        control.game.current = control.game.pending; control.game.pending = null; control.game.day.day++;
        control.game.settledThrough = control.game.day.day - 1;
        await browser.tap('[data-tab=today]'); await browser.tap('[data-tab=game]'); await browser.wait("!!document.querySelector('.battle-choices')");
        await browser.click('Võ Kỹ'); await browser.wait("document.querySelector('.battle-choices button')?.getAttribute('aria-pressed')==='true'");
        await browser.wait("!document.querySelector('#toast').classList.contains('visible')");
        await delay(200);
        assert.equal(control.game.choices[0].techniqueId, 'vo-ky'); assert.equal(battle.state.turn, 0, 'Choosing never resolves a turn');
        assert.equal(battle.state.player.hp, fighterForRank(1).maxHp);
        await browser.wait("document.querySelector('.battle-heading img').complete && document.querySelector('.battle-heading img').naturalWidth>0");
        for (const width of [320, 390, 1440]) {
            await browser.resize(width, 844); assert.equal((await snapshot(browser)).overflow, false);
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-battle-' + width + '.png'));
        }
        const run = control.battleRuns.get(battle.id);
        run.state.player.hp = 0; run.state.status = 'awaiting_rescue'; run.state.fatalTechnique = 'nghich-menh';
        run.rescueUntilDay = control.game.day.day + 2;
        battle.state = publicBattleState(run.state); battle.status = 'awaiting_rescue'; battle.rescueUntilDay = run.rescueUntilDay;
        battle.rescue = rescueQuote(control.state.account.state, 1);
        await browser.resize(390, 844); await browser.tap('[data-tab=today]'); await browser.tap('[data-tab=game]');
        await browser.wait("!!document.querySelector('.battle-rescue-actions')");
        assert.equal(await browser.evaluate("[...document.querySelectorAll('.battle-card button')].some(button=>button.innerText==='Rút lui')"), false);
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-battle-rescue.png'));
        await browser.click('Nghịch Mệnh · 1 cảnh giới'); await browser.wait("document.querySelector('#sheet').innerText.includes('Hy sinh một đại cảnh giới')");
        assert.equal(control.posts.filter(post => post.input.operation === 'rescue_battle').length, 0);
        await browser.click('Xác nhận'); await browser.wait("!!document.querySelector('.battle-choices') && !document.querySelector('#sheet').open");
        assert.equal(control.state.account.state.rank, 0); assert.equal(battle.state.rescueUsed, true);
        assert.ok(control.state.account.combatRestrictions.rankLockUntilDay > control.game.day.day);
        await browser.wait("!document.querySelector('#toast').classList.contains('visible')");
        await browser.evaluate("document.documentElement.dataset.theme='dark'"); await browser.resize(390, 844); await delay(350);
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-battle-dark.png'));
        assert.deepEqual(browser.errors, []);
    } finally { if (browser) await browser.close(); await server.close(); }
});

test('journey chapters keep future endings hidden, show original portraits and load boss details only for preparation', { skip: !browserBin, timeout: 90000 }, async () => {
    const control = fixture(); control.game.victories = ['truy-lenh', 'song-nha', 'thu-lenh', 'thiet-lenh-su'];
    const server = await serve(control); let browser;
    try {
        browser = await chrome(); await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')"); await browser.tap('[data-tab=game]');
        await browser.wait("!!document.querySelector('.practice-intro')"); await browser.click('Hành trình');
        await browser.wait("document.querySelector('.journey-chapter-picker select').value==='2'");
        await browser.wait("document.querySelector('.journey-chapter-scene').complete && document.querySelector('.journey-chapter-scene').naturalWidth>0");
        await browser.wait("[...document.querySelectorAll('.journey-boss img')].every(image=>image.complete && image.naturalWidth>0)");
        assert.equal((await snapshot(browser)).overflow, false);
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-chapter02.png'));
        await browser.click('Đọc truyện'); await browser.wait("!!document.querySelector('.game-story-people')");
        assert.equal(await browser.evaluate("document.querySelector('#sheet').innerText.includes('Sau hành trình')"), false);
        await browser.wait("[...document.querySelectorAll('.game-story-people img')].every(image=>image.complete && image.naturalWidth>0)");
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-chapter02-story.png'));
        await browser.tap('[data-sheet-close]'); await browser.wait("!document.querySelector('#sheet').open");
        await browser.evaluate("document.querySelector('.journey-chapter-picker select').value='3';document.querySelector('.journey-chapter-picker select').dispatchEvent(new Event('change'))");
        assert.equal(await browser.evaluate("[...document.querySelectorAll('.journey-page button')].some(button=>button.innerText==='Đọc truyện')"), false);
        assert.equal(await browser.evaluate("[...document.querySelectorAll('.journey-boss button')].every(button=>button.disabled)"), true);
        await browser.evaluate("document.querySelector('.journey-chapter-picker select').value='1';document.querySelector('.journey-chapter-picker select').dispatchEvent(new Event('change'))");
        await browser.click('Đọc truyện'); await browser.wait("document.querySelector('#sheet').innerText.includes('Sau hành trình')");
        assert.deepEqual(browser.errors, []);
    } finally { if (browser) await browser.close(); await server.close(); }
});

test('campaign images keep distinct chapter scenes and readable original cast crops in the journey and preparation sheets', { skip: !browserBin, timeout: 90000 }, async () => {
    const control = fixture(); control.game.victories = GAME_BOSSES.map(boss => boss.id); control.game.learned = TECHNIQUES.map(technique => technique.id);
    const server = await serve(control); let browser;
    try {
        browser = await chrome(); await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')"); await browser.tap('[data-tab=game]');
        await browser.wait("!!document.querySelector('.practice-intro')"); await browser.click('Hành trình');
        for (const chapter of [3, 4, 5, 6, 11]) {
            await browser.evaluate("document.querySelector('.journey-chapter-picker select').value='" + chapter + "';document.querySelector('.journey-chapter-picker select').dispatchEvent(new Event('change'))");
            await browser.wait("[...document.querySelectorAll('.journey-page img')].every(image=>image.complete && image.naturalWidth>0)");
            assert.equal((await snapshot(browser)).overflow, false);
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-campaign-chapter-' + chapter + '.png'));
            await browser.click('Đọc truyện');
            await browser.wait("[...document.querySelectorAll('.game-story-people img')].every(image=>image.complete && image.naturalWidth>0)");
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-campaign-story-' + chapter + '.png'));
            await browser.tap('[data-sheet-close]');
            if (chapter < 11) {
                await browser.evaluate("document.querySelector('.journey-boss button').click()");
                await browser.wait("!!document.querySelector('.battle-preparation>.primary') && document.querySelector('.battle-preparation-art').complete && document.querySelector('.battle-preparation-art').naturalWidth>0");
                if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-campaign-prepare-' + chapter + '.png'));
                await browser.tap('[data-sheet-close]');
            }
        }
        assert.equal(control.posts.length, 0, 'Reading story and viewing preparation never grants rewards');
        assert.deepEqual(browser.errors, []);
    } finally { if (browser) await browser.close(); await server.close(); }
});

test('collection, equipment, alternative editions and full battle archive remain readable on mobile', { skip: !browserBin, timeout: 90000 }, async () => {
    const control = fixture();
    control.game.rewards = [{ kind: 'weapon', id: 'thach-tam' }, { kind: 'achievement', id: 'mo-loi' }];
    control.game.victories = ['truy-lenh', 'song-nha', 'thu-lenh', 'thiet-lenh-su', 'ky-hanh-1'];
    for (const [id, edition, tierCount, purityBp] of [['browser_oldbest', 1, 2, 8000], ['browser_newdraft', 2, 1, 10000]]) {
        const practice = newPracticeVersion(id, 'kiem-y', control.game.day.day, 1000, edition);
        practice.tiers = Array.from({ length: tierCount }, (_, index) => ({ tier: index + 1, purityBp, effortMilli: 3000, defectsMilli: 0,
            startedDay: control.game.day.day, lockedDay: control.game.day.day }));
        control.practiceVersions.push({ practice, version: 1, created: now });
    }
    const server = await serve(control); let browser;
    try {
        browser = await chrome(); await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')"); await browser.tap('[data-tab=game]');
        await browser.wait("!!document.querySelector('.practice-intro')"); await browser.click('Sưu tập');
        assert.equal(await browser.evaluate("document.querySelector('.game-collection').innerText.includes('Chiến tích · 1 / 11')"), true);
        for (const [width, theme] of [[320, 'light'], [390, 'light'], [390, 'dark']]) {
            await browser.resize(width, 844); await browser.evaluate("document.documentElement.dataset.theme='" + theme + "'");
            await delay(220);
            assert.equal((await snapshot(browser)).overflow, false);
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-collection-' + width + '-' + theme + '.png'));
        }
        await browser.evaluate("document.documentElement.dataset.theme='light'"); await browser.click('Hành trình');
        await browser.wait("document.querySelector('.journey-chapter-picker select').value==='3'"); await browser.click('Đọc truyện');
        await browser.wait("[...document.querySelectorAll('.game-story-people img')].some(image=>image.src.includes('moc-an') && image.complete && image.naturalWidth>0)");
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-moc-an-story.png'));
        await browser.tap('[data-sheet-close]');
        await browser.evaluate("document.querySelector('.journey-chapter-picker select').value='1';document.querySelector('.journey-chapter-picker select').dispatchEvent(new Event('change'))");
        await browser.wait("document.querySelector('.journey-chapter-picker select').value==='1' && !!document.querySelector('.journey-boss button')");
        await browser.evaluate("document.querySelector('.journey-boss button').click()");
        await browser.wait("!!document.querySelector('.battle-loadout-form')");
        assert.equal(await browser.evaluate("[...document.querySelector('.battle-loadout-form select').options].some(option=>option.value==='browser_oldbest')"), true);
        await browser.evaluate("document.querySelector('.battle-version-picker').open=true");
        await browser.wait("!!document.querySelector('.battle-edition-row')"); await browser.click('Thêm vào bộ chọn');
        await browser.evaluate("document.querySelector('.battle-loadout-form select').value='browser_newdraft';document.querySelector('.battle-preparation>label select').value='thach-tam';document.querySelector('.battle-preparation>label select').dispatchEvent(new Event('change'))");
        assert.equal(await browser.evaluate("document.querySelector('.battle-preparation').innerText.includes('60% lực công nền')"), true);
        for (const width of [320, 390]) {
            await browser.resize(width, 844); assert.equal((await snapshot(browser)).overflow, false);
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-equipment-' + width + '.png'));
        }
        await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!!document.querySelector('.battle-card') && !document.querySelector('#sheet').open");
        const battle = control.game.battles[0], run = control.battleRuns.get(battle.id);
        assert.equal(run.weaponId, 'thach-tam'); assert.equal(run.state.loadout[0].versionId, 'browser_newdraft');
        assert.equal(run.state.statuses.filter(status => status.key === 'weapon:thach-tam').length, 1);
        assert.equal(await browser.evaluate("document.querySelector('.battle-card').innerText.includes('Thạch Tâm')"), true);
        await browser.click('Lịch sử tất cả trận'); await browser.wait("document.querySelector('#sheet').innerText.includes('Đã chuẩn bị')");
        assert.equal((await snapshot(browser)).overflow, false);
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-battle-archive.png'));
        await browser.click('Xem nhật ký'); await browser.wait("document.querySelector('#sheet').innerText.includes('Chưa có lượt giao chiến')");
        assert.deepEqual(browser.errors, []);
    } finally { if (browser) await browser.close(); await server.close(); }
});

test('practice mobile flow selects a future version, shows pending quality, confirms a fresh edition and preserves old versions', { skip: !browserBin, timeout: 90000 }, async () => {
    const control = fixture(), server = await serve(control), healthy = clone(control.state.account), tasks = clone(control.state.tasks);
    let browser;
    try {
        browser = await chrome(); await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.tap('[data-tab=game]'); await browser.wait("!!document.querySelector('.practice-intro img')");
        await browser.wait("document.querySelector('.practice-intro img').complete && document.querySelector('.practice-intro img').naturalWidth>0");
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-practice-intro.png'));
        await browser.click('Chọn công pháp'); await browser.wait("document.querySelectorAll('.technique-card').length===5");
        await browser.click('Xem và chọn luyện'); await browser.wait("!!document.querySelector('.technique-sheet > .primary')");
        await browser.click('Bắt đầu luyện'); await browser.wait("!!document.querySelector('.game-pending')");
        assert.equal(control.game.current.mode, 'idle'); assert.equal(control.game.pending.fromDay, control.game.day.day + 1);
        assert.equal(control.practiceVersions.length, 1);
        const version = control.practiceVersions[0];
        // This fixture represents a ready tier awaiting its weekly quality audit.
        // The real domain and D1 transition producing it are tested separately.
        version.practice.progressMilli = 3000; version.practice.effortMilli = 3000; version.practice.pendingWeeks = ['weekly:20731'];
        control.game.current = control.game.pending; control.game.currentPractice = version; control.game.pending = null; control.game.pendingPractice = null;
        control.game.day.day += 3; control.game.day.startAt += 3 * 86400000; control.game.day.endAt += 3 * 86400000; control.game.settledThrough = control.game.day.day - 1;
        await browser.tap('[data-tab=today]'); await browser.tap('[data-tab=game]');
        await browser.wait("document.querySelector('.practice-state')?.innerText.includes('chờ cam kết tuần')");
        for (const width of [320, 390, 1440]) {
            await browser.resize(width, 844); assert.equal((await snapshot(browser)).overflow, false);
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-practice-' + width + '.png'));
        }
        await browser.resize(390, 844); await browser.evaluate("document.documentElement.dataset.theme='dark'");
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-practice-dark.png'));
        await browser.evaluate("document.documentElement.dataset.theme='light'");
        const old = clone(version.practice);
        await browser.resize(320, 460); await browser.click('Đổi môn / bản'); await browser.click('Xem và chọn luyện');
        await browser.wait("!!document.querySelector('.practice-version-row')");
        await browser.evaluate("document.querySelector('.technique-sheet').scrollTop=9999");
        assert.equal(await browser.evaluate("(() => {const r=document.querySelector('[data-sheet-close]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), true);
        await browser.click('Luyện một bản mới'); await browser.click('Xác nhận');
        await browser.wait("!!document.querySelector('.game-pending')");
        assert.equal(control.practiceVersions.length, 2); assert.equal(control.game.pendingPractice.practice.edition, 2);
        assert.equal(control.game.pendingPractice.practice.progressMilli, 0);
        assert.deepEqual(control.practiceVersions[1].practice, old);
        assert.deepEqual(control.state.account, healthy); assert.deepEqual(control.state.tasks, tasks); assert.deepEqual(browser.errors, []);
    } finally { if (browser) await browser.close(); await server.close(); }
});
test('habit mobile flow creates three cadences, edits quantity without duplicate rewards and preserves fixed modal controls', { skip: !browserBin, timeout: 90000 }, async () => {
    const control = fixture(), server = await serve(control), original = clone(control.state.account), tasks = clone(control.state.tasks);
    let browser;
    try {
        browser = await chrome();
        await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.tap('[data-tab=habits]');
        await browser.wait("document.querySelector('.habits-page') && !document.querySelector('[aria-busy=true]')");
        const create = async (name, metric, cadence) => {
            await browser.tap('[aria-label="Thêm thói quen"]');
            await browser.evaluate(`(() => { const f=document.querySelector('.habit-form'); const inputs=f.querySelectorAll('input'); inputs[0].value=${JSON.stringify(name)}; const selects=f.querySelectorAll('select'); selects[0].value=${JSON.stringify(metric)}; selects[0].dispatchEvent(new Event('change')); if(${JSON.stringify(metric)}!=='check') inputs[1].value='20'; selects[1].value=${JSON.stringify(cadence)}; selects[1].dispatchEvent(new Event('change')); f.requestSubmit(); })()`);
            await browser.wait("!document.querySelector('#sheet').open && !document.querySelector('#content button:disabled')");
            await browser.wait(`document.querySelector('.habit-list')?.innerText.includes(${JSON.stringify(name)})`);
        };
        await create('Thiền', 'check', 'daily');
        await create('Đọc sách', 'duration', 'weekly');
        await create('Đi bộ', 'check', 'weekdays');
        assert.equal(control.habits.habits.length, 3);
        assert.deepEqual(control.habits.habits.map(view => view.definition.cadence.kind), ['daily', 'weekly', 'weekdays']);
        await browser.evaluate("document.querySelector('.habit-card .habit-check').click()");
        await browser.wait("document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='true'");
        assert.equal(control.habits.habits[0].log.value, 100);
        await browser.click('Ghi nhận', '.habit-card button');
        await browser.evaluate("document.querySelector('.habit-form input[type=number]').value='15';document.querySelector('.habit-form input[type=text]').value='<img src=x onerror=alert(1)>';document.querySelector('.habit-form').requestSubmit()");
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.habits.habits[1].log.value, 1500);
        assert.equal(control.habits.habits[1].preview.successes, 0);
        assert.equal(await browser.evaluate("document.querySelectorAll('.habit-note img').length"), 0);
        await browser.click('Xếp thời gian', '.habit-card button');
        await browser.evaluate("document.querySelector('.habit-form input[type=time]').value='12:00';document.querySelector('.habit-form input[type=number]').value='20';document.querySelector('.habit-form').requestSubmit()");
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.habits.habits[1].slot.minutes, 20);
        assert.equal(control.habits.habits[1].slot.startAt, Date.parse('2026-10-05T12:00:00+07:00'));
        await browser.tap('[data-tab=today]');
        await browser.wait("!!document.querySelector('.plan-habit')");
        assert.match((await snapshot(browser)).text, /Thói quen đã xếp giờ/);
        assert.equal(await browser.evaluate("document.querySelector('.plan-habit').innerText.includes('Đọc sách') && document.querySelector('.plan-habit').innerText.includes('12:00–12:20')"), true);
        for (const width of [390, 320]) {
            await browser.resize(width, 844);
            assert.equal((await snapshot(browser)).overflow, false);
            await browser.evaluate("document.querySelector('.plan-habits').scrollIntoView({block:'center'})");
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-habit-today-' + width + '.png'));
        }
        await browser.evaluate("document.querySelector('.plan-habit').click()");
        await browser.wait("document.querySelectorAll('.habit-card').length===3");
        for (const width of [390, 320, 1440]) {
            await browser.resize(width, 844);
            assert.equal((await snapshot(browser)).overflow, false);
            if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-habits-' + width + '.png'));
        }
        await browser.resize(320, 460);
        await browser.evaluate("document.querySelector('.habit-card .icon-button').click();document.querySelector('.habit-form').scrollTop=9999");
        assert.equal(await browser.evaluate("(() => {const r=document.querySelector('[data-sheet-close]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), true);
        await browser.tap('[data-sheet-close]');
        await browser.click('Nhịp đã qua', '#content button');
        await browser.wait("!!document.querySelector('.habit-history-tools')");
        await browser.wait("!!document.querySelector('.habit-report')");
        await browser.resize(390, 844);
        if (process.env.WEB_TEST_SCREENSHOT_PATH) await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-habit-report.png'));
        // Capture the actual download Blob; do not create files outside this
        // localhost browser fixture or substitute a hand-built export payload.
        await browser.evaluate("window.exportBlob=null;window.exportFilename=null;const originalCreate=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exportBlob=blob;return originalCreate(blob)};HTMLAnchorElement.prototype.click=function(){window.exportFilename=this.download}");
        const writes = control.posts.length;
        await browser.click('Xuất dữ liệu'); await browser.click('Tải JSON'); await browser.wait("!!window.exportBlob");
        const exported = JSON.parse(await browser.evaluate("window.exportBlob.text()"));
        assert.equal(exported.format, 'assistant-habits'); assert.equal(exported.version, 1); assert.equal(exported.valueScale, 100);
        assert.equal(exported.range.to, control.habits.day.day); assert.equal(exported.habits.length, 3);
        assert.ok(exported.history.some(row => row.value === 1500 && row.note === '<img src=x onerror=alert(1)>'));
        assert.equal('account' in exported, false); assert.equal('tasks' in exported, false);
        assert.equal(await browser.evaluate("window.exportFilename.endsWith('.json')"), true);
        assert.equal(control.posts.length, writes, 'Export cannot mutate any habit or game reward');
        assert.deepEqual(control.state.account, original);
        assert.deepEqual(control.state.tasks, tasks);
        assert.deepEqual(browser.errors, []);
    } finally { if (browser) await browser.close(); await server.close(); }
});

test('settings keep the title and close button visible when scrolling and when the viewport shrinks', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture(), server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        for (const width of [320, 390, 1440]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.evaluate("document.querySelector('#settings').click()");
            await browser.wait("!!document.querySelector('.settings-sheet-body')");
            const layout = await browser.evaluate(`(async () => {
                const sheet=document.querySelector('#sheet'),body=sheet.querySelector('.settings-sheet-body'),header=sheet.querySelector('.sheet-title-row'),close=sheet.querySelector('[data-sheet-close]');
                const before=header.getBoundingClientRect().top;
                body.scrollTop=body.scrollHeight;
                await new Promise(requestAnimationFrame);
                const rect=close.getBoundingClientRect(),sheetRect=sheet.getBoundingClientRect();
                return {scrolled:body.scrollTop>0,headerStayed:Math.abs(before-header.getBoundingClientRect().top)<1,
                    outerStayed:sheet.scrollTop===0,closeVisible:rect.top>=sheetRect.top&&rect.bottom<=sheetRect.bottom,
                    closeReachable:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.closest('[data-sheet-close]')===close,
                    bounded:sheetRect.top>=0&&sheetRect.bottom<=innerHeight+1,overflow:body.scrollWidth>body.clientWidth+1};
            })()`);
            assert.deepEqual(layout,{scrolled:true,headerStayed:true,outerStayed:true,closeVisible:true,closeReachable:true,bounded:true,overflow:false},width+'px');
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-settings-scrolled.png'));
            await browser.tap('[data-sheet-close]');
            await browser.wait("!document.querySelector('#sheet').open");
            assert.equal(await browser.evaluate("document.querySelector('#sheet').classList.contains('settings-sheet-open')"),false);
            await browser.evaluate("document.querySelector('#settings').click()");
            assert.equal(await browser.evaluate("document.querySelector('.settings-sheet-body').scrollTop"),0);
            // Navigating to another sheet clears the settings layout before rendering it.
            await browser.click('Hướng dẫn nhanh','#sheet button');
            assert.equal(await browser.evaluate("document.querySelector('#sheet').classList.contains('settings-sheet-open')"),false);
            assert.equal(await browser.evaluate("!!document.querySelector('.settings-sheet-body')"),false);
            await browser.tap('[data-sheet-close]');
            await browser.wait("!document.querySelector('#sheet').open");
            if (width === 390) {
                await browser.evaluate("document.querySelector('#settings').click()");
                await browser.resize(width,430);
                await browser.evaluate("document.querySelector('.settings-sheet-body input[type=number]').focus();document.querySelector('.settings-sheet-body').scrollTop=9999");
                assert.equal(await browser.evaluate("(() => { const close=document.querySelector('[data-sheet-close]'),r=close.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('[data-sheet-close]')===close; })()"),true);
                await browser.tap('[data-sheet-close]');
                await browser.wait("!document.querySelector('#sheet').open");
            }
            assert.deepEqual(browser.errors,[]);
        }
        assert.deepEqual(control.posts,[],'Scrolling and closing settings must not save drafts or mutate sleep');
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});
test('realm protection appears below the rank card before balances and hides when expired', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture(), server = await serve(control);
    const protectedUntil = now + 72 * 3600000;
    control.state.account.state.protectedUntil = protectedUntil;
    const account = clone(control.state.account);
    let browser;
    try {
        browser = await chrome();
        for (const width of [1440, 390, 320]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
            const layout = await browser.evaluate(`(() => {
                const card=document.querySelector('.rank-card'),note=document.querySelector('.rank-summary>.protection'),balances=document.querySelector('.cultivation-balances');
                const r=card.getBoundingClientRect(),n=note.getBoundingClientRect(),b=balances.getBoundingClientRect();
                return {text:note.textContent,outside:!card.contains(note),below:n.top>=r.bottom,beforeBalances:n.bottom<=b.top,
                    gap:n.top-r.bottom,fits:n.left>=0&&n.right<=innerWidth,share:!!card.querySelector('button')};
            })()`);
            assert.equal(layout.text,'🛡 Miễn hạ bậc đến '+new Date(protectedUntil).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}));
            assert.equal(layout.outside,true);assert.equal(layout.below,true);assert.equal(layout.beforeBalances,true);
            assert.equal(layout.gap,8);assert.equal(layout.fits,true);assert.equal(layout.share,true);
            assert.equal((await snapshot(browser)).overflow,false);
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH) {
                await browser.evaluate("document.querySelector('.rank-summary').scrollIntoView({block:'center'})");
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/,'-protection.png'));
            }
        }
        assert.deepEqual(control.state.account,account);assert.deepEqual(control.posts,[]);
        control.state.account.state.protectedUntil = now - 60000;
        await browser.navigate(server.url,390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
        assert.equal(await browser.evaluate("document.querySelectorAll('.protection').length"),0);
        assert.deepEqual(browser.errors,[]);
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('settings report sleep and undo with preserved drafts; achievements heading shows the saved daily bedtime on mobile', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture(), server = await serve(control);
    const tasks = clone(control.state.tasks), plan = clone(control.state.dailyPlan), focus = { ...control.state.taskFocusTarget, startedAt: now - 1000 };
    control.state.taskFocus = focus;
    let browser;
    try {
        browser = await chrome();
        for (const width of [390, 320]) {
            const beforePosts = control.posts.filter(p=>p.path==='sleep').length;
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
            const flame = await browser.evaluate("document.querySelector('.flame-card').innerText");
            assert.doesNotMatch(flame,/Giờ ngủ hôm nay|Chuỗi ngủ đúng giờ|không phải chuỗi điểm danh|chưa báo ngủ/);
            const bedtime = await browser.evaluate(`(() => {
                const header=document.querySelector('.achievements-page>.heading'),line=header.querySelector('.achievement-bedtime'),subtitle=header.querySelector('.subtitle'),rect=line.getBoundingClientRect(),sub=subtitle.getBoundingClientRect();
                return {text:line.textContent,below:rect.top>=sub.bottom,aligned:Math.abs(rect.left-sub.left)<1,fits:rect.left>=0&&rect.right<=innerWidth,count:document.querySelectorAll('.achievement-bedtime').length};
            })()`);
            assert.deepEqual(bedtime,{text:'Giờ ngủ hôm nay · 22:30',below:true,aligned:true,fits:true,count:1});
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-bedtime.png'));
            await browser.evaluate("document.querySelector('[data-tab=today]').click();document.querySelector('#settings').click()");
            await browser.wait("!!document.querySelector('.sleep-report')");
            assert.equal((await snapshot(browser)).overflow,false);
            const fits = await browser.evaluate("[...document.querySelectorAll('.settings-sleep-row>*')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})");
            assert.equal(fits,true);
            await browser.evaluate("document.querySelector('#sheet input[type=time]').value='05:30'");
            await browser.click('Đi ngủ','.settings-sleep-controls button');
            assert.equal(control.posts.filter(p=>p.path==='sleep').length,beforePosts,'Opening confirmation is read-only');
            assert.match(await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),/Đi ngủ bây giờ\?/);
            await browser.click('Để sau','.settings-sleep-controls button');
            assert.equal(await browser.evaluate("document.querySelector('#sheet input[type=time]').value"),'05:30');
            await browser.click('Đi ngủ','.settings-sleep-controls button');
            await browser.click('Đi ngủ','.sleep-confirm-actions button');
            await browser.wait("!!document.querySelector('.sleep-undo')");
            assert.equal(await browser.evaluate("document.querySelector('#sheet input[type=time]').value"),'05:30','Reporting sleep preserves the unsaved settings draft');
            assert.equal(control.posts.filter(p=>p.path==='settings').length,0);
            assert.equal(control.state.settings.start_minutes,270);
            const sleeping = await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText");
            assert.match(sleeping,/Đang ngủ · từ 10:00/);assert.match(sleeping,/Có thể hủy đến 10:05/);assert.doesNotMatch(sleeping,/1 lần|Bấm nhầm/);
            assert.deepEqual(control.state.taskFocus,focus);assert.deepEqual(control.state.tasks,tasks);assert.deepEqual(control.state.dailyPlan,plan);
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-settings-sleep.png'));
            await browser.click('Hoàn tác','.settings-sleep-controls button');
            await browser.click('Giữ nguyên','.settings-sleep-controls button');
            assert.equal(control.state.sleepStatus.asleep,true);
            await browser.click('Hoàn tác','.settings-sleep-controls button');
            await browser.click('Hoàn tác','.sleep-confirm-actions button');
            await browser.wait("!!document.querySelector('.sleep-report')");
            assert.equal(control.state.sleepStatus.asleep,false);
            assert.deepEqual(control.state.taskFocus,focus);
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
            await browser.wait("document.querySelector('.focus-flip-card')?.getAttribute('aria-pressed')==='true'");
            assert.deepEqual(browser.errors,[]);
        }
        assert.deepEqual(control.posts.filter(p=>p.path==='sleep').map(p=>p.input.operation),['report','undo','report','undo'],'Second correction is allowed on the same operating day');
        // The heading uses the day's saved target, not an unsaved or future-day setting.
        control.state.settings.sleep_minutes=1410;
        await browser.navigate(server.url,390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
        assert.match(await browser.evaluate("document.querySelector('.achievements-page>.heading').innerText"),/Giờ ngủ hôm nay · 22:30/);
        // Sleep is independent of a separate pause, even when that pause expires.
        Object.assign(control.state,{rest:{reason:'paused',until:now-1000},resting:true,
            sleepStatus:{asleep:true,until:control.state.day.end_at,reportedAt:now,generation:9,canUndo:true,undoUntil:now+300000}});
        await browser.navigate(server.url,320);
        await browser.wait("!!document.querySelector('.rest-state')");
        await browser.evaluate("document.querySelector('#settings').click()");
        assert.match(await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),/Đang ngủ/);
        await browser.click('Hoàn tác','.settings-sleep-controls button');
        control.state.sleepStatus.canUndo=false;
        control.sleepError=true;
        await browser.click('Hoàn tác','.sleep-confirm-actions button');
        await browser.wait("!document.querySelector('.sleep-undo')&&!document.querySelector('.sleep-confirm-actions')");
        assert.match(await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),/Đang ngủ/);
        control.sleepError=false;
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        // An open settings panel removes undo as its five-minute window expires.
        Object.assign(control.state,{rest:{reason:'asleep',reportedAt:now-297500,until:control.state.day.end_at},resting:true,
            sleepStatus:{asleep:true,reportedAt:now-297500,generation:10,canUndo:true,undoUntil:now+2500}});
        await browser.navigate(server.url,320);
        await browser.wait("!!document.querySelector('.sleep-card')");
        assert.doesNotMatch(await browser.evaluate("document.querySelector('.sleep-card').innerText"),/10:00|Nghỉ đến|Đã ghi nhận/);
        await browser.evaluate("document.querySelector('#settings').click()");
        await browser.wait("!!document.querySelector('.sleep-undo')");
        await browser.wait("!document.querySelector('.sleep-undo')");
        assert.doesNotMatch(await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),/Có thể hủy|Hoàn tác/);
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        // Acknowledged report remains visible even when the subsequent refresh fails.
        Object.assign(control.state,{rest:{reason:'active'},resting:false,sleepStatus:{asleep:false,canUndo:false}});
        await browser.navigate(server.url,390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('#settings').click()");
        await browser.click('Đi ngủ','.settings-sleep-controls button');
        control.failBootstrap=true;
        await browser.click('Đi ngủ','.sleep-confirm-actions button');
        await browser.wait("document.querySelector('.settings-sleep-label')?.textContent.startsWith('Đang ngủ')");
        assert.equal(await browser.evaluate("document.querySelector('.sleep-undo')?.disabled"),true,'No second mutation until the failed refresh is reconciled');
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        await browser.wait("!!document.querySelector('.sleep-card')");
        assert.deepEqual(browser.errors,[]);
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('sleep replaces the focus card without changing tasks or configured reminders and restores focus after wake', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture(), recorded = now - 60000, until = now + 18.5 * 3600000;
    Object.assign(control.state, { resting: true, rest: { reason: 'asleep', reportedAt: recorded, until } });
    control.state.day.asleep_at = recorded;
    control.state.taskFocus = { ...control.state.taskFocusTarget, startedAt: now - 120000 };
    const tasks = clone(control.state.tasks), plan = clone(control.state.dailyPlan);
    const server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        for (const width of [1440, 390, 320]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.sleep-card')");
            const view = await browser.evaluate(`(() => {
                const card=document.querySelector('.sleep-card'),rect=card.getBoundingClientRect();
                return {text:card.innerText,interactive:card.querySelectorAll('button,input').length,
                    focus:!!document.querySelector('.focus-flip-card'),rest:!!document.querySelector('.rest-state'),
                    duplicate:[...document.querySelectorAll('#content h2')].filter(node=>node.textContent==='Ngủ ngon nhé').length,
                    fits:rect.left>=0&&rect.right<=innerWidth,height:rect.height,
                    alignment:getComputedStyle(card).textAlign,artHidden:card.querySelector('.sleep-card-seal')?.getAttribute('aria-hidden')==='true',
                    moon:card.querySelector('.sleep-card-seal')?.textContent,role:card.getAttribute('role')};
            })()`);
            assert.match(view.text,/ĐANG NGỦ/);assert.match(view.text,/Ngủ ngon nhé/);assert.doesNotMatch(view.text,/Đã ghi nhận|Nghỉ đến|09:59|04:30/);
            assert.match(view.text,/Lời nhắc đã đặt vẫn theo lịch/);
            assert.equal(view.interactive,0);assert.equal(view.focus,false);assert.equal(view.rest,false);assert.equal(view.duplicate,1);assert.equal(view.fits,true);
            assert.equal(view.alignment,'center');assert.equal(view.artHidden,true);assert.equal(view.moon,'☾');assert.equal(view.role,'status');
            if (width < 900)
                assert.ok(view.height>=176&&view.height<=184,'The mobile sleep card should match the focus card sizing');
            else
                assert.equal(view.height,240,'The desktop sleep card should match the focus card sizing');
            assert.equal((await snapshot(browser)).overflow,false);
            await browser.click('Danh sách việc');
            assert.ok(await browser.evaluate("!!document.querySelector('.sleep-card')"));
            await browser.click('Lịch hôm nay');
            await browser.click('Chỉnh lịch');
            await browser.wait("!!document.querySelector('.plan-edit-row')");
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
            await browser.evaluate("document.querySelector('[data-tab=reminders]').click()");
            assert.match((await snapshot(browser)).text,/lời nhắc đã đặt ở đây vẫn gửi theo lịch/);
            assert.ok((await snapshot(browser)).buttons.some(button=>button.text==='+ Tạo lời nhắc'&&!button.disabled));
            await browser.click('+ Tạo lời nhắc');
            await browser.wait("!!document.querySelector('#sheet form')");
            await browser.evaluate("document.querySelector('[data-sheet-close]').click();document.querySelector('[data-tab=today]').click()");
            assert.deepEqual(browser.errors,[]);
            if (width === 390) {
                if (process.env.WEB_TEST_SCREENSHOT_PATH)
                    await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-sleep.png'));
                await browser.evaluate("(() => { document.querySelector('#settings').click();const theme=document.querySelector('#sheet .form-field select');theme.value='dark';theme.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-sheet-close]').click(); })()");
                await browser.wait("getComputedStyle(document.querySelector('.sleep-card')).color==='rgb(237, 218, 180)'");
                if (process.env.WEB_TEST_SCREENSHOT_PATH)
                    await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-sleep-dark.png'));
                await browser.evaluate("(() => { document.querySelector('#settings').click();const theme=document.querySelector('#sheet .form-field select');theme.value='light';theme.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-sheet-close]').click(); })()");
                await browser.wait("getComputedStyle(document.querySelector('.sleep-card')).color==='rgb(103, 83, 47)'");
            }
            else if (process.env.WEB_TEST_SCREENSHOT_PATH)
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, width === 320 ? '-sleep-small.png' : '-sleep-desktop.png'));
        }
        assert.deepEqual(control.posts,[],'Viewing sleep and opening editors must not mutate focus or reminders');
        assert.deepEqual(control.state.tasks,tasks);assert.deepEqual(control.state.dailyPlan,plan);
        Object.assign(control.state,{resting:false,rest:{reason:'active'},taskFocus:null});
        control.state.day.asleep_at=null;
        await browser.navigate(server.url,390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        assert.equal(await browser.evaluate("!!document.querySelector('.sleep-card')"),false);
        await browser.evaluate("document.querySelector('.focus-flip-card').click()");
        await browser.wait("document.querySelector('.focus-flip-card')?.getAttribute('aria-pressed')==='true'");
        assert.equal(control.posts.at(-1).path,'task-focus');
        assert.equal(control.posts.at(-1).input.operation,'start');
        assert.deepEqual(browser.errors,[]);
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('waiting Today separates its setup button from the hint and respects the app theme on mobile', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture();
    control.state.dailyPlan = null;
    control.state.taskFocusTarget = null;
    Object.assign(control.state.day, { task_plan_status: 'waiting', task_plan_due: now + 91 * 60000 });
    const server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        for (const width of [390, 320])
            for (const os of ['light', 'dark'])
                for (const theme of ['light', 'dark']) {
                    await browser.colorScheme(os);
                    await browser.navigate(server.url, width);
                    await browser.wait("!!document.querySelector('.plan-empty>.primary')");
                    await browser.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
                    await delay(180); // Allow the button's theme transition to finish before checking its colors.
                    const layout = await browser.evaluate(`(() => {
                        const button=document.querySelector('.plan-empty>.primary');
                        const hint=document.querySelector('.plan-empty>.hint');
                        const rect=button.getBoundingClientRect(),style=getComputedStyle(button);
                        const probe=document.createElement('span');
                        probe.style.backgroundColor=getComputedStyle(document.documentElement).getPropertyValue('--accent');
                        document.body.append(probe);
                        const accent=getComputedStyle(probe).backgroundColor;probe.remove();
                        const luminance=color=>{
                            const channels=color.match(/[0-9]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
                            return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
                        };
                        const foreground=luminance(style.color),background=luminance(style.backgroundColor);
                        return {gap:rect.top-hint.getBoundingClientRect().bottom,height:rect.height,color:style.color,
                            background:style.backgroundColor,accent,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05),
                            fits:rect.left>=0&&rect.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1};
                    })()`);
                    assert.ok(layout.gap >= 12, 'The button must have space above it');
                    assert.ok(layout.height >= 44);
                    assert.equal(layout.background, layout.accent, os + ' OS / ' + theme + ' app');
                    assert.equal(layout.color, theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 18, 34)');
                    assert.ok(layout.contrast >= 4.5);
                    assert.equal(layout.fits, true);
                    assert.equal(layout.overflow, false);
                    if (width === 390 && os === 'dark' && theme === 'light' && process.env.WEB_TEST_SCREENSHOT_PATH) {
                        await browser.evaluate("document.querySelector('.today-main').scrollIntoView({block:'start'})");
                        await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-waiting.png'));
                    }
                    await browser.click('Xếp thời gian hôm nay');
                    await browser.wait("!!document.querySelector('.schedule-form')");
                    await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
                    assert.deepEqual(browser.errors, []);
                }
        assert.deepEqual(control.posts, [], 'Opening the time editor must not save a schedule');
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('breakthrough screen shows decreasing realm odds, delayed capped failure bonuses and every charm boost', { skip: !browserBin, timeout: 120000 }, async () => {
    const control = fixture();
    Object.assign(control.state.account.state, { qi: 3000, streak: 45 });
    Object.assign(control.state.account.state.inventory, { basic: 1, middle: 1, high: 1, supreme: 1 });
    const server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        const cases = [65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15].map((base, rank) => ({ rank, failures: 0, base }));
        cases.push(...[60, 60, 65, 70, 75, 75, 75].map((base, failures) => ({ rank: 1, failures, base })));
        cases.push({ rank: 0, failures: 4, base: 80 }, { rank: 10, failures: 4, base: 30 });
        for (const { rank, failures, base } of cases) {
            Object.assign(control.state.account.state, { rank, highestRank: rank, failures });
            await browser.navigate(server.url, 390);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
            await browser.click('Đột phá');
            await browser.wait("!!document.querySelector('#sheet select')");
            const options = await browser.evaluate("[...document.querySelectorAll('#sheet select option')].map(option=>option.textContent)");
            assert.deepEqual(options, ['Không dùng phù', 'Sơ cấp · +5 điểm %', 'Trung cấp · +10 điểm %', 'Cao cấp · +20 điểm %', 'Cực phẩm · +25 điểm %']);
            const description = () => browser.evaluate("[...document.querySelectorAll('#sheet .hint')].find(node=>node.textContent.startsWith('Lần này có ')).textContent");
            assert.ok((await description()).startsWith('Lần này có ' + base + '%'));
            assert.match(await description(), /Tỷ lệ cơ bản lên .+: (65|60|55|50|45|40|35|30|25|20|15)%/);
            assert.match(await description(), /Thất bại 1 lần chưa cộng; 2\/3\/4 lần liên tiếp cộng 5\/10\/15 điểm %/);
            assert.match(await description(), /tối đa \+15 điểm %/);
            assert.doesNotMatch(await description(), /chắc chắn thành công/);
            for (const [key, boost] of [['basic', 5], ['middle', 10], ['high', 20], ['supreme', 25]]) {
                await browser.evaluate(`(() => { const select=document.querySelector('#sheet select');select.value=${JSON.stringify(key)};select.dispatchEvent(new Event('change')); })()`);
                assert.ok((await description()).startsWith('Lần này có ' + Math.min(100, base + boost) + '%'));
            }
            assert.equal((await snapshot(browser)).overflow, false);
            assert.deepEqual(browser.errors, []);
        }
        assert.deepEqual(control.posts, [], 'Reading odds must not attempt a breakthrough');
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('Today keeps every session visible and distinguishes work remaining from the deadline', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture();
    const at = time => Date.parse('2026-10-05T' + time + ':00+07:00');
    const windows = [
        { start: at('07:10'), end: at('09:10') },
        { start: at('09:20'), end: at('10:38') },
        { start: at('12:30'), end: at('14:30') }
    ];
    Object.assign(control.state.tasks[0], { title: 'Ôn kiểm tra tài trợ khởi nghiệp', remaining_minutes: 360, actual_minutes: 0, deadline: '2026-10-05T13:00:00+07:00' });
    Object.assign(control.state.tasks[1], { title: 'Ôn code quản trị rr', remaining_minutes: 240, actual_minutes: 0, deadline: '2026-10-06T09:00:00+07:00' });
    Object.assign(control.state.tasks[2], { remaining_minutes: null, actual_minutes: 0, deadline: null });
    control.state.dailyPlan.plan.items = [
        { taskId: 'task-0', minutes: 318, remaining: 360, actualMinutes: 0, scheduledMinutes: 318, windows },
        { taskId: 'task-1', minutes: 120, remaining: 240, actualMinutes: 0, scheduledMinutes: 120, windows: [{ start: at('20:00'), end: at('22:00') }] },
        { taskId: 'task-2', minutes: 30, remaining: null, actualMinutes: 0, scheduledMinutes: 0, windows: [] }
    ];
    control.state.dailyPlan.plan.planned = 468;
    const server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        for (const width of [1440, 390, 320]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.plan-position')");
            const layout = await browser.evaluate(`(() => {
                const row = document.querySelector('.daily-item');
                const slots = [...row.querySelectorAll('.session-window')];
                const active = row.querySelector('.session-window.is-current');
                const rect = active.getBoundingClientRect();
                return {
                    windows: slots.map(slot => slot.textContent),
                    visible: slots.every(slot => { const box=slot.getBoundingClientRect();return box.width>0 && box.left>=0 && box.right<=innerWidth; }),
                    past: row.querySelectorAll('.session-window.is-past').length,
                    current: row.querySelectorAll('.session-window.is-current').length,
                    marked: active.getAttribute('aria-current') === 'time',
                    highlighted: getComputedStyle(active).backgroundColor !== 'rgba(0, 0, 0, 0)' && rect.height>0,
                    metrics: [...row.querySelectorAll('.task-metric')].map(line => line.textContent),
                    today: row.innerText.includes('Hôm nay: 5 giờ 18 phút'),
                    done: row.querySelector('.check').checked,
                    position: document.querySelector('.plan-position').textContent
                };
            })()`);
            assert.deepEqual(layout.windows, ['07:10–09:10', '▶09:20–10:38', '12:30–14:30']);
            assert.equal(layout.visible, true, width + 'px: every session should fit without horizontal scrolling');
            assert.equal(layout.past, 1);
            assert.equal(layout.current, 1);
            assert.equal(layout.marked, true);
            assert.equal(layout.highlighted, true);
            assert.deepEqual(layout.metrics, ['Khối lượng còn lại:6 giờ', 'Đến hạn còn:3 giờ']);
            assert.equal(layout.today, true);
            assert.equal(layout.done, false, 'Elapsed sessions must not complete the task');
            assert.match(layout.position, /Bây giờ 10:00.*Đến giờ làm · Ôn kiểm tra tài trợ khởi nghiệp/);
            assert.equal((await snapshot(browser)).overflow, false);
            assert.equal(await browser.evaluate("document.querySelectorAll('.daily-item')[2].innerText.includes('Chưa có giờ làm') && document.querySelectorAll('.daily-item')[2].innerText.includes('Chưa có hạn')"), true);
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH) {
                await browser.evaluate("document.querySelector('.today-main').scrollIntoView({block:'start'})");
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH);
            }
            await browser.click('Danh sách việc');
            assert.deepEqual(await browser.evaluate("[...document.querySelector('.task-row .task-metrics').children].map(line=>line.textContent)"), layout.metrics);
            assert.equal(await browser.evaluate("document.querySelector('.task-row.is-current .session-window.is-current').getAttribute('aria-current')"), 'time');
            assert.equal((await snapshot(browser)).overflow, false);
        }
        // The same plan moves from a gap into a later session, with no automatic completion.
        for (const [time, current, past, next] of [
            ['09:10', false, 1, 'Sắp tới 09:20'],
            ['10:38', false, 2, 'Sắp tới 12:30'],
            ['12:30', true, 2, 'Đến giờ làm'],
            ['14:30', false, 3, 'Sắp tới 20:00']
        ]) {
            control.state.now = at(time);
            await browser.navigate(server.url, 320);
            await browser.wait("!!document.querySelector('.plan-position')");
            assert.equal(await browser.evaluate("document.querySelector('.daily-item').classList.contains('is-current')"), current);
            assert.equal(await browser.evaluate("document.querySelector('.daily-item').querySelectorAll('.session-window.is-past').length"), past);
            assert.equal(await browser.evaluate("document.querySelector('.daily-item .check').checked"), false);
            assert.ok((await browser.evaluate("document.querySelector('.plan-position').textContent")).includes(next));
        }
        assert.equal(await browser.evaluate("document.querySelector('.daily-item .task-deadline').textContent"), 'Quá hạn:2 giờ');
        control.state.now = at('10:00');
        control.state.tasks[0].status = 'completed';
        control.state.tasks[0].completed_at = at('09:55');
        for (const width of [390, 320]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.plan-position')");
            assert.equal(await browser.evaluate("document.querySelector('.daily-plan>.daily-list').querySelectorAll('.daily-item.done').length"), 0);
            assert.equal(await browser.evaluate("document.querySelector('.completed-today').open"), false);
            assert.equal(await browser.evaluate("document.querySelector('.completed-today .daily-item').checkVisibility()"), false);
            assert.ok((await browser.evaluate("document.querySelector('.plan-position').textContent")).includes('Sắp tới 20:00'));
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH) {
                await browser.evaluate("document.querySelector('.today-main').scrollIntoView({block:'start'})");
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-completed.png'));
            }
            await browser.click('Xem việc đã xong (1)', 'summary');
            assert.equal(await browser.evaluate("document.querySelector('.completed-today .check').checked"), true);
            assert.equal(await browser.evaluate("document.querySelector('.completed-today').querySelectorAll('.session-window.is-current').length"), 0);
            assert.equal(await browser.evaluate("document.querySelector('.completed-today .daily-item').checkVisibility()"), true);
            await browser.evaluate("document.querySelector('.completed-today .daily-item-open').click()");
            await browser.wait("!!document.querySelector('#task-sheet-form')");
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
            assert.equal((await snapshot(browser)).overflow, false);
            await browser.click('Danh sách việc');
            assert.equal(await browser.evaluate("document.querySelector('.completed-today').open"), false);
            assert.equal(await browser.evaluate("document.querySelector('.task-list-section>.task-board').querySelectorAll('.task-row.done').length"), 0);
            await browser.click('Xem việc đã xong (1)', 'summary');
            assert.equal(await browser.evaluate("document.querySelector('.completed-today .task-row').checkVisibility()"), true);
            assert.equal((await snapshot(browser)).overflow, false);
        }
        assert.deepEqual(browser.errors, []);
        assert.deepEqual(control.posts, [], 'Presentation must not write progress or completion');
        // Reopening a completed task uses the existing confirmation and returns it to the plan.
        await browser.evaluate("document.querySelector('.completed-today .check').click()");
        await browser.click('Xác nhận');
        await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('.completed-today')");
        assert.equal(control.state.tasks[0].status, 'active');
        await browser.click('Lịch hôm nay');
        assert.equal(await browser.evaluate("document.querySelector('.daily-plan>.daily-list .daily-item.is-current .check').checked"), false);
        assert.equal(control.posts.length, 1);
        assert.equal(control.posts[0].input.complete, false);
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('plan editor reorders only unfinished tasks and preserves completed minutes when saving', { skip: !browserBin, timeout: 60000 }, async () => {
    const control = fixture();
    Object.assign(control.state.tasks[1], { status: 'completed', completed_at: now - 60000 });
    control.state.dailyPlan.plan.items = [
        { taskId: 'task-0', minutes: 90, windows: [] },
        { taskId: 'task-1', minutes: 80, windows: [] },
        { taskId: 'task-2', minutes: 60, windows: [] }
    ];
    control.state.dailyPlan.plan.planned = 230;
    const server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        const order = () => browser.evaluate("[...document.querySelectorAll('#sheet .plan-edit-row')].map(row=>row.dataset.taskId)");
        for (const width of [390, 320]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.daily-plan')");
            await browser.click('Chỉnh lịch');
            assert.deepEqual(await order(), ['task-0', 'task-2']);
            assert.equal(await browser.evaluate("document.querySelector('.plan-completed-summary').textContent"), 'Đã xong 1 việc');
            assert.equal(await browser.evaluate("!!document.querySelector('#sheet [data-task-id=task-1]')"), false);
            assert.equal(await browser.evaluate("document.querySelector('#sheet [aria-label=\"Đưa lên\"]').disabled"), true);
            assert.equal(await browser.evaluate("[...document.querySelectorAll('#sheet [aria-label=\"Đưa xuống\"]')].at(-1).disabled"), true);
            await browser.evaluate("document.querySelector('#sheet [data-task-id=task-0] input').value='45';document.querySelector('#sheet [data-task-id=task-0] [aria-label=\"Đưa xuống\"]').click()");
            assert.deepEqual(await order(), ['task-2', 'task-0']);
            assert.equal(await browser.evaluate("document.querySelector('#sheet [data-task-id=task-0] input').value"), '45');
            await browser.evaluate("document.querySelector('#sheet [data-task-id=task-0] [aria-label=\"Đưa lên\"]').click()");
            assert.deepEqual(await order(), ['task-0', 'task-2']);
            assert.equal((await snapshot(browser)).overflow, false);
            if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
                await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-plan-editor.png'));
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        }
        await browser.click('Chỉnh lịch');
        await browser.evaluate("[...document.querySelectorAll('#sheet [data-task-id=task-0] button')].find(button=>button.textContent==='Để hôm khác').click()");
        assert.deepEqual(await order(), ['task-2']);
        assert.equal(await browser.evaluate("document.querySelector('#sheet form').innerText.includes('140 phút đã chọn')"), true);
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.plan-picker option')].map(option=>option.value)"), ['task-0']);
        await browser.click('+ Thêm vào hôm nay');
        assert.deepEqual(await order(), ['task-2', 'task-0']);
        await browser.evaluate("document.querySelector('#sheet [data-task-id=task-0] input').value='70'");
        await browser.click('Lưu kế hoạch hôm nay');
        await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled");
        assert.deepEqual(control.posts.at(-1).input.items, [
            { taskId: 'task-1', minutes: 80 },
            { taskId: 'task-2', minutes: 60 },
            { taskId: 'task-0', minutes: 70 }
        ]);
        assert.equal(control.state.dailyPlan.plan.items.reduce((sum, item) => sum + item.minutes, 0), 210);
        assert.equal(control.state.tasks[1].status, 'completed');
        // An entirely completed plan has no editable fields and still saves its recorded totals.
        control.state.tasks.forEach(task => Object.assign(task, { status: 'completed', completed_at: now }));
        await browser.navigate(server.url, 320);
        await browser.wait("!!document.querySelector('.daily-plan')");
        await browser.click('Chỉnh lịch');
        assert.deepEqual(await order(), []);
        assert.equal(await browser.evaluate("document.querySelectorAll('#sheet [data-plan-minutes]').length"), 0);
        assert.equal(await browser.evaluate("document.querySelector('.plan-completed-summary').textContent"), 'Đã xong 3 việc');
        assert.equal(await browser.evaluate("document.querySelector('#sheet form').innerText.includes('210 phút đã chọn')"), true);
        await browser.click('Lưu kế hoạch hôm nay');
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.posts.at(-1).input.items.reduce((sum, item) => sum + item.minutes, 0), 210);
        assert.deepEqual(browser.errors, []);
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});

test('real browser preserves desktop/mobile UI and feature flows', { skip: !browserBin, timeout: 120000 }, async (t) => {
    const control = fixture(), server = await serve(control);
    let browser;
    try {
        browser = await chrome();
        await t.test('desktop and mobile layouts, stable Today switching and bounded reward sheet', async () => {
            for (const width of [1440, 390, 320]) {
                await browser.navigate(server.url, width);
                await browser.wait("!!document.querySelector('.focus-flip-card')");
                assert.equal((await snapshot(browser)).overflow, false);
                await browser.evaluate("globalThis.frameBefore=document.querySelector('.focus-flip-card');globalThis.frameTop=frameBefore.getBoundingClientRect().top");
                await browser.click('Danh sách việc');
                await browser.wait("!!document.querySelector('.task-list-section')");
                assert.equal(await browser.evaluate("frameBefore===document.querySelector('.focus-flip-card')&&Math.abs(frameTop-frameBefore.getBoundingClientRect().top)<1"), true);
                await browser.click('Lịch hôm nay');
                await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
                await browser.wait("!!document.querySelector('.checkin-calendar-link')");
                assert.equal(await browser.evaluate("document.querySelectorAll('.reward-cell').length"), 0);
                await browser.evaluate("document.querySelector('.checkin-calendar-link').click()");
                await browser.wait("document.querySelectorAll('.reward-cell').length===30");
                const layout = await browser.evaluate("(() => { const sheet=document.querySelector('#sheet'),calendar=document.querySelector('.checkin-calendar-content');const header=document.querySelector('.sheet-title-row');const before=header.getBoundingClientRect().top;calendar.scrollTop=calendar.scrollHeight;return {bounded:sheet.getBoundingClientRect().bottom<=innerHeight+1,header:Math.abs(before-header.getBoundingClientRect().top)<1,scroll:calendar.scrollTop>0};})()");
                assert.deepEqual(layout, { bounded: true, header: true, scroll: true });
                await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
                assert.deepEqual(browser.errors, []);
            }
        });
        await t.test('task estimate, subtask deletion, creation and reminder editor use the same interactions', async () => {
            await browser.navigate(server.url);
            await browser.wait("!!document.querySelector('.daily-item-open')");
            await browser.evaluate("document.querySelector('.daily-item-open').click()");
            await browser.wait("!!document.querySelector('.remaining-editor input[type=number]')");
            await browser.evaluate("const input=document.querySelector('.remaining-editor input[type=number]');input.value='75';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#task-sheet-form').requestSubmit()");
            await browser.wait("!document.querySelector('#sheet').open");
            assert.equal(control.state.tasks[0].remaining_minutes, 75);
            await browser.evaluate("document.querySelector('.daily-item-open').click()");
            await browser.wait("!!document.querySelector('.step-delete')");
            await browser.evaluate("document.querySelector('.step-delete').click()");
            await browser.click('Xác nhận');
            await browser.wait("!document.querySelector('#sheet').open");
            await browser.wait("!document.querySelector('[data-tab=reminders]').disabled");
            assert.equal(control.state.tasks[0].steps.length, 2);
            await browser.evaluate("document.querySelector('[data-tab=reminders]').click()");
            await browser.wait("!!document.querySelector('.top-create')");
            await browser.click('+ Tạo lời nhắc');
            await browser.wait("document.querySelector('#sheet').open");
            await browser.evaluate("document.querySelector('#sheet input[type=text]').value='Nhắc kiểm thử';document.querySelector('#sheet form').requestSubmit()");
            await browser.wait("!document.querySelector('#sheet').open");
            assert.equal(control.state.reminders.at(-1).title, 'Nhắc kiểm thử');
            await browser.evaluate("document.querySelector('[data-tab=today]').click()");
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.click('Danh sách việc');
            await browser.click('+ Tạo task');
            await browser.wait("!!document.querySelector('#task-sheet-form')");
            await browser.evaluate("document.querySelector('#task-sheet-form input[type=text]').value='Task mới kiểm thử';document.querySelector('#task-sheet-form').requestSubmit()");
            await browser.wait("!document.querySelector('#sheet').open");
            assert.equal(control.state.tasks.at(-1).title, 'Task mới kiểm thử');
            assert.deepEqual(browser.errors, []);
        });
        await t.test('focus, checkin and reward mutations avoid unnecessary history reads', async () => {
            await browser.navigate(server.url);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            control.calls.length = 0;
            await browser.evaluate("document.querySelector('.focus-flip-card').click()");
            await browser.wait("!!document.querySelector('.focus-flip-card.is-focused')");
            assert.ok(control.state.taskFocus);
            assert.equal(control.calls.filter(c => c.includes('history')).length, 0);
            await browser.evaluate("document.querySelector('.focus-flip-card').click()");
            await browser.wait("!document.querySelector('.focus-flip-card.is-focused')");
            await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
            await browser.wait("!!document.querySelector('.checkin-claim')");
            await browser.evaluate("document.querySelector('.checkin-claim').click()");
            await browser.wait("document.querySelector('.checkin-claim').disabled");
            assert.equal(control.state.account.state.checkin.count, 1);
            assert.deepEqual(browser.errors, []);
        });
        await t.test('work progress, day plan, availability and settings keep their existing editors', async () => {
            await browser.navigate(server.url);
            await browser.wait("!!document.querySelector('.daily-item-open')");
            await browser.evaluate("document.querySelector('.daily-item-open').click()");
            await browser.click('Đã làm hôm nay');
            await browser.evaluate("(() => {const input=document.querySelector('.work-minutes');input.value='25';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#task-sheet-form').requestSubmit();})()");
            await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled");
            assert.equal(control.state.tasks[0].actual_minutes, 25);
            await browser.click('Chỉnh lịch');
            await browser.wait("!!document.querySelector('[data-plan-minutes]')");
            await browser.evaluate("(() => {const input=document.querySelector('[data-plan-minutes]');input.value='60';document.querySelector('#sheet form').requestSubmit();})()");
            await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled");
            assert.equal(control.state.dailyPlan.plan.items[0].minutes, 60);
            await browser.click('Giờ bận/rảnh');
            await browser.wait("!!document.querySelector('.schedule-form')");
            await browser.evaluate("document.querySelector('.schedule-form').requestSubmit()");
            await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled");
            assert.equal(control.posts.at(-1).path, 'schedule');
            await browser.evaluate("document.querySelector('#settings').click()");
            await browser.wait("!!document.querySelector('#sheet input[type=number]')");
            await browser.evaluate("document.querySelector('#sheet input[type=number]').value='240';document.querySelector('#sheet form').requestSubmit()");
            await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled");
            assert.equal(control.state.settings.auto_plan_delay_minutes, 240);
            assert.deepEqual(browser.errors, []);
        });
        await t.test('draw, fusion, protection and breakthrough remain usable through feature controllers', async () => {
            await browser.navigate(server.url);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
            await browser.wait("!!document.querySelector('.checkin-claim')");
            const tickets = control.state.account.state.tickets;
            await browser.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Quay thưởng ·')).click()");
            await browser.click('Dùng 1 vé');
            await browser.wait("!!document.querySelector('.mystery-revealed')");
            assert.equal(control.state.account.state.tickets, tickets - 1);
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
            await browser.click('Túi vật phẩm');
            await browser.click('Ghép 3 lá · 80%');
            await browser.click('Xác nhận');
            await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=achievements]').disabled");
            assert.equal(control.state.account.state.inventory.middle, 1);
            await browser.click('Túi vật phẩm');
            await browser.evaluate("[...document.querySelectorAll('#sheet button')].find(b=>b.textContent==='Dùng hôm nay').click()");
            await browser.click('Xác nhận');
            await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=achievements]').disabled");
            assert.equal(control.state.account.state.inventory.heart, 0);
            await browser.click('Đột phá');
            await browser.wait("!!document.querySelector('#sheet select')");
            await browser.click('Đột phá', '#sheet button');
            await browser.wait("document.querySelector('#sheet .loot-result').textContent.includes('Đột phá thành công')");
            assert.equal(control.state.account.state.rank, 2);
            assert.deepEqual(browser.errors, []);
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        });
        await t.test('committed save with refresh outage is acknowledged and not repeated', async () => {
            await browser.navigate(server.url);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            const before = control.posts.length;
            control.failBootstrap = true;
            await browser.evaluate("document.querySelector('.focus-flip-card').click()");
            await browser.wait("document.querySelector('#toast').textContent.includes('Đã lưu trên server')");
            assert.equal(control.posts.length, before + 1);
            control.failBootstrap = false;
            await browser.evaluate("document.querySelector('.focus-flip-card').click()");
            await browser.wait("!document.querySelector('.focus-flip-card.is-focused')");
            assert.equal(control.posts.length, before + 2);
            assert.deepEqual(browser.errors, []);
        });
        await t.test('Chrome pairing and logout remain usable without Telegram SDK', async () => {
            control.failBootstrap = false;
            control.authenticated = false;
            await browser.navigate(server.url);
            await browser.wait("!!document.querySelector('.login-card')");
            await browser.click('Lấy mã đăng nhập');
            await browser.wait("!!document.querySelector('.login-command')");
            control.authenticated = true;
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.evaluate("document.querySelector('#logout').click()");
            await browser.wait("!!document.querySelector('.login-card')");
            assert.equal(control.authenticated, false);
            assert.deepEqual(browser.errors, []);
            control.authenticated = true;
        });
        await t.test('more than200 active tasks remain reachable without loading every task initially', async () => {
            const large = fixture(), first = large.state.tasks[0];
            large.state.tasks = Array.from({ length: 205 }, (_, i) => ({ ...clone(first), id: 'task-' + i, public_code: i + 1, title: 'Task ' + (i + 1) }));
            const make = large.bootstrap;
            large.bootstrap = () => ({ ...make(), tasks: large.state.tasks.slice(0, 200), activeTasksPage: { offset: 200, total: 205, hasMore: true } });
            const largeServer = await serve(large);
            try {
                await browser.navigate(largeServer.url);
                await browser.wait("!!document.querySelector('.focus-flip-card')");
                await browser.click('Danh sách việc');
                assert.equal(await browser.evaluate("document.querySelectorAll('.task-open').length"), 200);
                await browser.click('Xem thêm công việc');
                await browser.wait("document.querySelectorAll('.task-open').length===205");
                assert.equal(await browser.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Xem thêm công việc')"), false);
                await browser.evaluate("document.querySelector('.task-open').click()");
                await browser.wait("!!document.querySelector('#task-sheet-form')");
                await browser.evaluate("const input=document.querySelector('.remaining-editor input[type=number]');input.value='70';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#task-sheet-form').requestSubmit()");
                await browser.wait("!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled");
                assert.equal(await browser.evaluate("document.querySelectorAll('.task-open').length"), 205);
                assert.deepEqual(browser.errors, []);
            }
            finally {
                await largeServer.close();
            }
        });
        if (process.env.UI_BASELINE_REF)
            await t.test('current layout matches the approved baseline on all three screens', async () => {
                const baselineControl = fixture(), baseline = await serve(baselineControl, process.env.UI_BASELINE_REF), currentControl = fixture(), current = await serve(currentControl);
                try {
                    for (const width of [1440, 390])
                        for (const tab of ['today', 'reminders', 'achievements']) {
                            const collect = async (url) => {
                                await browser.navigate(url, width);
                                await browser.wait("!!document.querySelector('.focus-flip-card')");
                                if (tab !== 'today')
                                    await browser.evaluate(`document.querySelector('[data-tab=${tab}]').click()`);
                                await delay(150);
                                return snapshot(browser);
                            };
                            const old = await collect(baseline.url), updated = await collect(current.url);
                            assert.deepEqual(updated, old, width + 'px / ' + tab);
                            assert.deepEqual(browser.errors, []);
                        }
                }
                finally {
                    await baseline.close();
                    await current.close();
                }
            });
    }
    finally {
        if (browser)
            await browser.close();
        await server.close();
    }
});
