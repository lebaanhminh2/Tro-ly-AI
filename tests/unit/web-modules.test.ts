import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const paths = readdirSync('web', { recursive: true }).filter(p => typeof p === 'string' && p.endsWith('.js')).map(p => resolve('web', String(p)));
const modulePath = '../../web/api.js';
const httpPath = '../../web/core/http.js';
const livePath = '../../web/core/live-data.js';
const statePath = '../../web/core/state.js';
const lifecyclePath = '../../web/core/lifecycle.js';
const mutationPath = '../../web/core/mutations.js';
test('compatibility facade keeps every public frontend export', async () => {
    const api = await import(modulePath);
    assert.deepEqual(Object.keys(api).sort(), ['flameLevels', 'flameLevel', 'createDemo', 'breakthroughPenalties', 'dailyRewards', 'checkinProgress', 'dailyRewardLabel', 'demoCheckin', 'taskBuckets', 'realms', 'loot', 'talismans', 'demoDraw', 'demoCompleteTask', 'demoFuse', 'demoBreakthrough', 'themePreference', 'applyTheme', 'setThemePreference', 'connectLive', 'browserAuthRequest', 'historyPage', 'refreshLive', 'liveMutation'].sort());
});
test('web modules have resolvable imports, no circular dependencies and no missing identifiers', () => {
    const graph = new Map<string, string[]>();
    for (const path of paths) {
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const dependencies: string[] = [];
        for (const statement of source.statements) {
            if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
                const dependency = resolve(dirname(path), statement.moduleSpecifier.text);
                assert.ok(paths.includes(dependency), 'Unresolved module: ' + dependency);
                dependencies.push(dependency);
            }
        }
        graph.set(path, dependencies);
    }
    const done = new Set<string>(), active = new Set<string>();
    const visit = (path: string) => {
        assert.ok(!active.has(path), 'Circular dependency at ' + path);
        if (done.has(path))
            return;
        active.add(path);
        for (const dependency of graph.get(path) ?? [])
            visit(dependency);
        active.delete(path);
        done.add(path);
    };
    for (const path of paths)
        visit(path);
    const program = ts.createProgram(paths, { allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => [2304, 2305, 2306, 2307, 2552].includes(d.code));
    assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')), []);
});
function bootstrap(title = 'Current') {
    return { now: Date.now(), account: { state: { earned: 10, heartDay: null, peaceDay: null } }, progress: { completions: [], milestones: [], achievements: [] }, tasks: [{ id: 'task', public_code: 1, title, status: 'active', version: 1, steps: [] }], settings: { start_minutes: 270, sleep_minutes: 1350, version: 1 }, reminders: [], day: { day: 1 }, rest: { reason: 'active' }, sessions: [], events: [] };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
test('transport retains retry ID on ambiguous errors, clears rejected requests and never sends browser header for Telegram', async (t) => {
    const { liveRequest } = await import(httpPath);
    const originalFetch = globalThis.fetch;
    const telegram = (globalThis as any).Telegram;
    t.after(() => {
        globalThis.fetch = originalFetch;
        if (telegram === undefined)
            delete (globalThis as any).Telegram;
        else
            (globalThis as any).Telegram = telegram;
    });
    const requests: any[] = [];
    let mode = 'lost';
    globalThis.fetch = async (_url, options) => {
        requests.push({ body: JSON.parse(String(options?.body)), headers: options?.headers });
        if (mode === 'lost')
            throw Error('NETWORK_LOST');
        return mode === 'reject' ? json({ error: 'INVALID_REQUEST' }, 400) : json({ result: { saved: true } });
    };
    delete (globalThis as any).Telegram;
    const input = { operation: 'create', title: 'Retry identity' };
    await assert.rejects(liveRequest('transport-test', input));
    mode = 'ok';
    await liveRequest('transport-test', input);
    assert.equal(requests[0].body.id, requests[1].body.id);
    assert.equal(requests[0].headers['X-Minh-Anh-Request'], '1');
    mode = 'reject';
    await assert.rejects(liveRequest('transport-rejected', input));
    mode = 'ok';
    await liveRequest('transport-rejected', input);
    assert.notEqual(requests[2].body.id, requests[3].body.id);
    (globalThis as any).Telegram = { WebApp: { initData: 'signed-test-data' } };
    await liveRequest('transport-telegram', input);
    assert.equal(requests[4].headers['X-Telegram-Init-Data'], 'signed-test-data');
    assert.equal(requests[4].headers['X-Minh-Anh-Request'], undefined);
});
test('ordinary refresh reads bootstrap and history concurrently; narrow refresh preserves history', async (t) => {
    const { refreshLive } = await import(livePath), { applySnapshot, createAppState } = await import(statePath);
    const original = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = original;
    });
    const calls: string[] = [];
    let release: () => void = () => {
    };
    const gate = new Promise<void>(resolve => {
        release = resolve;
    });
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        if (String(url).includes('bootstrap')) {
            await gate;
            return json(bootstrap());
        }
        return json({ result: { items: [], offset: 0, total: 0, hasMore: false } });
    };
    const request = refreshLive();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.sort(), ['/api/bootstrap', '/api/history?offset=0']);
    release();
    await request;
    calls.length = 0;
    const state = createAppState(true);
    state.tasks = [{ id: 'history', done: true, title: 'Earlier', steps: [] }];
    state.historyOffset = 40;
    state.historyHasMore = true;
    state.historyTotal = 60;
    applySnapshot(state, await refreshLive({ includeHistory: false }));
    assert.deepEqual(calls, ['/api/bootstrap']);
    assert.equal(state.tasks.length, 2);
    assert.equal(state.historyOffset, 40);
    assert.equal(state.historyHasMore, true);
    assert.equal(state.historyTotal, 60);
});
test('refresh retains explicitly loaded active pages and deduplicates planned tasks', async (t) => {
    const { refreshLive } = await import(livePath);
    const original = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = original;
    });
    const tasks = Array.from({ length: 205 }, (_, i) => ({ id: 'task-' + i, public_code: i + 1, title: 'Task ' + i, status: 'active', version: 1, steps: [] }));
    const snapshot = { ...bootstrap(), tasks: [...tasks.slice(0, 200), tasks[204]], activeTasksPage: { offset: 200, total: 205, hasMore: true } };
    const calls: string[] = [];
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        return String(url).includes('bootstrap') ? json(snapshot) : json({ result: { items: tasks.slice(200), offset: 200, total: 205, hasMore: false } });
    };
    const result = await refreshLive({ includeHistory: false, activeOffset: 205 });
    assert.equal(result.tasks.length, 205);
    assert.equal(new Set(result.tasks.map((task: any) => task.id)).size, 205);
    assert.equal(result.activeTasksOffset, 205);
    assert.equal(result.activeTasksHasMore, false);
    assert.deepEqual(calls, ['/api/bootstrap', '/api/tasks-page?offset=200']);
});
test('acknowledged mutation survives refresh failure and reuses its receipt until reconciliation', async (t) => {
    const { liveMutation } = await import(livePath);
    const original = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = original;
    });
    const requests: any[] = [];
    let failed = true;
    globalThis.fetch = async (url, options) => {
        if (options?.method === 'POST') {
            requests.push(JSON.parse(String(options.body)));
            return json({ result: { reward: 'qi1' } });
        }
        if (failed)
            throw Error('REFRESH_OFFLINE');
        return json(bootstrap());
    };
    const input = { operation: 'draw' };
    const saved = await liveMutation('receipt-test', input, { includeHistory: false });
    assert.equal(saved.committed, true);
    assert.equal(saved.result.result.reward, 'qi1');
    assert.ok(saved.refreshError);
    failed = false;
    await liveMutation('receipt-test', input, { includeHistory: false });
    assert.equal(requests[0].id, requests[1].id);
    await liveMutation('receipt-test', input, { includeHistory: false });
    assert.notEqual(requests[1].id, requests[2].id);
});
test('background response cannot replace state after a newer mutation', async (t) => {
    const { createLifecycle } = await import(lifecyclePath), { createAppState, createRuntimeState } = await import(statePath);
    const originalFetch = globalThis.fetch, originalDocument = (globalThis as any).document;
    t.after(() => {
        globalThis.fetch = originalFetch;
        if (originalDocument === undefined)
            delete (globalThis as any).document;
        else
            (globalThis as any).document = originalDocument;
    });
    const state = createAppState(true);
    state.loaded = true;
    state.tasks = [{ id: 'task', title: 'Newer write' }];
    const runtime = createRuntimeState();
    let release: () => void = () => {
    };
    const gate = new Promise<void>(resolve => {
        release = resolve;
    });
    globalThis.fetch = async (url) => {
        if (String(url).includes('bootstrap')) {
            await gate;
            return json(bootstrap('Older snapshot'));
        }
        return json({ result: { items: [], offset: 0, total: 0, hasMore: false } });
    };
    (globalThis as any).document = {};
    const lifecycle = createLifecycle({ state, runtime, ui: {}, content: {}, sheet: { open: false }, renderBrowserLogin() {
        }, showBrowserLogin() {
        }, connected() {
        }, toast() {
        } });
    const request = lifecycle.refreshOnReturn();
    runtime.revision++;
    release();
    await request;
    assert.equal(state.tasks[0].title, 'Newer write');
});
test('controller reports successful write, prevents concurrent writes and reconciles before the next POST', async (t) => {
    const { createMutations } = await import(mutationPath), { createAppState, createRuntimeState } = await import(statePath);
    const oldFetch = globalThis.fetch, oldDocument = (globalThis as any).document;
    t.after(() => {
        globalThis.fetch = oldFetch;
        if (oldDocument === undefined)
            delete (globalThis as any).document;
        else
            (globalThis as any).document = oldDocument;
    });
    (globalThis as any).document = { querySelectorAll: () => [] };
    const state = createAppState(true);
    state.loaded = true;
    state.tab = 'achievements';
    const runtime = createRuntimeState(), messages: string[] = [], calls: string[] = [];
    let offline = true;
    globalThis.fetch = async (url, options) => {
        calls.push((options?.method ?? 'GET') + ' ' + url);
        if (options?.method === 'POST')
            return json({ result: { dailyReward: { day: 1, qi: 1 } }, account: { state: { earned: 1, qi: 1, checkin: { cycleStartDay: 1, count: 1, lastDay: 1 } } } });
        if (offline)
            throw Error('REFRESH_OFFLINE');
        return String(url).includes('history') ? json({ result: { items: [], offset: 0, total: 0, hasMore: false } }) : json(bootstrap());
    };
    const controller = createMutations({ state, runtime, sheet: { querySelector: () => null, close() {
            } }, render() {
        }, toast: (message: string) => messages.push(message), showBrowserLogin() {
        } });
    const pending = controller.performLive('cultivation', { operation: 'checkin' });
    assert.equal(await controller.performLive('cultivation', { operation: 'checkin' }), null);
    const result = await pending;
    assert.equal(result.dailyReward.day, 1);
    assert.equal(runtime.refreshPending, true);
    assert.match(messages[0]!, /Đã lưu trên server/);
    calls.length = 0;
    offline = false;
    await controller.performLive('cultivation', { operation: 'draw' });
    const firstPost = calls.findIndex(call => call.startsWith('POST'));
    assert.ok(firstPost > 0);
    assert.ok(calls.slice(0, firstPost).includes('GET /api/bootstrap'));
    assert.equal(runtime.refreshPending, false);
});
