import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createDemo } from '../../web/demo/state.js';
import { checkinProgress } from '../../web/models/cultivation.js';
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
        taskFocus: null, taskFocusTarget: { taskId: 'task-0', endsAt: now + 4800000 }, rest: { reason: 'active' }, resting: false, needsSetup: false,
        progress: { completions: [], milestones: [], achievements: [] }, sessions: [], events: []
    };
    const control = { state, authenticated: true, failBootstrap: false, calls: [], posts: [], receipts: new Map() };
    control.bootstrap = () => ({ ...state, checkin: checkinProgress(state.account.state, now) });
    control.mutate = (path, input) => {
        if (control.receipts.has(input.id))
            return control.receipts.get(input.id);
        control.posts.push({ path, input: clone(input) });
        let result = { saved: true };
        const task = state.tasks.find(t => t.id === input.taskId);
        if (path === 'tasks') {
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
        const response = clone({ result, ...(path === 'cultivation' ? { account: state.account } : {}) });
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
            response.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript' : relative.endsWith('.css') ? 'text/css' : 'text/html');
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
