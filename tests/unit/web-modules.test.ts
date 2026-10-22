import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const paths = readdirSync('web', { recursive: true })
  .filter((p) => typeof p === 'string' && p.endsWith('.js'))
  .map((p) => resolve('web', String(p)));
const modulePath = '../../web/api.js';
const httpPath = '../../web/core/http.js';
const livePath = '../../web/core/live-data.js';
const statePath = '../../web/core/state.js';
const lifecyclePath = '../../web/core/lifecycle.js';
const mutationPath = '../../web/core/mutations.js';

test('a late acknowledgement from a logged-out session cannot clear a new retry identity', async (t) => {
  const { liveMutation } = await import(livePath);
  const { browserAuthRequest, requestIdentity, settleRequest } = await import(httpPath);
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const input = { operation: 'log', habitId: 'session_retry', version: 1 };
  globalThis.fetch = async (url) => {
    if (String(url).includes('browser-auth/logout')) return json({ authenticated: false });
    await gate;
    return json({ saved: true, version: 2 });
  };
  const oldId = requestIdentity('session-test', input);
  const late = liveMutation('session-test', input, { acknowledge: true });
  await browserAuthRequest('logout');
  const newId = requestIdentity('session-test', input);
  assert.notEqual(oldId, newId);
  release();
  await late;
  assert.equal(requestIdentity('session-test', input), newId);
  settleRequest('session-test', input);
});

test('habit receipt confirms its log and ticket balance without waiting for any refresh', async (t) => {
  const { createMutations } = await import(mutationPath),
    { createAppState, createRuntimeState } = await import(statePath);
  const oldFetch = globalThis.fetch,
    oldDocument = (globalThis as any).document;
  t.after(() => {
    globalThis.fetch = oldFetch;
    (globalThis as any).document = oldDocument;
  });
  (globalThis as any).document = { querySelectorAll: () => [] };
  const state = createAppState(true),
    runtime = createRuntimeState();
  state.live = true;
  state.loaded = true;
  state.tab = 'habits';
  state.habitData = {
    day: { day: 1 },
    habits: [{ habit: { id: 'habit' }, log: { version: 0, value: 0, note: '' } }],
  };
  let balance = 7,
    offline = false;
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push((options?.method ?? 'GET') + ' ' + url);
    if (options?.method === 'POST')
      return new Response(
        JSON.stringify({
          saved: true,
          version: JSON.parse(String(options.body)).logVersion + 1,
          ticketAwarded: 1,
          account: { state: { earned: 0, tickets: balance } },
        }),
      );
    if (offline) throw Error('REFRESH_OFFLINE');
    return new Response(JSON.stringify({ day: { day: 1 }, habits: [] }));
  };
  const controller = createMutations({
    state,
    runtime,
    sheet: { open: false, querySelector: () => null, close() {} },
    render() {},
    toast() {},
    showBrowserLogin() {},
  });
  const first = await controller.performLive(
    'habits',
    { operation: 'log', habitId: 'habit', day: 1, logVersion: 0, value: 1, note: '' },
    { silent: true },
  );
  assert.equal(first.ticketAwarded, 1);
  assert.equal(state.cultivation.tickets, 7);
  assert.equal(
    calls.some((call) => call.includes('bootstrap')),
    false,
  );
  balance = 8;
  offline = true;
  await controller.performLive(
    'habits',
    { operation: 'log', habitId: 'habit', day: 1, logVersion: 1, value: 2, note: '' },
    { silent: true },
  );
  assert.equal(state.cultivation.tickets, 8);
  assert.equal(runtime.refreshPending, false);
  assert.equal(state.habitData.habits[0].log.version, 2);
  assert.equal(state.habitData.habits[0].log.value, 200);
  assert.ok(calls.every((call) => call.startsWith('POST')));
});

test('an unconfirmed x10 blocks other writes and retries the same receipt before allowing another draw', async (t) => {
  const { createMutations } = await import(mutationPath),
    { createAppState, createRuntimeState } = await import(statePath);
  const oldFetch = globalThis.fetch,
    oldDocument = (globalThis as any).document;
  t.after(() => {
    globalThis.fetch = oldFetch;
    (globalThis as any).document = oldDocument;
  });
  (globalThis as any).document = { querySelectorAll: () => [] };
  const state = createAppState(true),
    runtime: any = createRuntimeState();
  state.live = true;
  state.loaded = true;
  state.tab = 'achievements';
  let tickets = 12,
    lost = true;
  const posts: any[] = [],
    receipts = new Map();
  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'POST') {
      const input = JSON.parse(String(options.body));
      posts.push(input);
      if (!receipts.has(input.id)) {
        tickets -= input.count;
        receipts.set(input.id, {
          result: { count: input.count, rewards: Array(input.count).fill('basic') },
          account: { state: { earned: 0, tickets } },
        });
      }
      if (lost) {
        lost = false;
        throw Error('RESPONSE_LOST');
      }
      return new Response(JSON.stringify(receipts.get(input.id)));
    }
    const data = bootstrap();
    data.account.state = { ...data.account.state, tickets } as any;
    return new Response(JSON.stringify(data));
  };
  const controller = createMutations({
    state,
    runtime,
    sheet: { open: false, querySelector: () => null, close() {} },
    render() {},
    toast() {},
    showBrowserLogin() {},
  });
  assert.equal(await controller.performLive('cultivation', { operation: 'draw', count: 10 }), null);
  assert.equal(tickets, 2);
  assert.equal(runtime.pendingDraw.count, 10);
  assert.equal(await controller.performLive('cultivation', { operation: 'draw', count: 1 }), null);
  assert.equal(await controller.performLive('habits', { operation: 'log', value: 1 }), null);
  assert.equal(posts.length, 1);
  const saved = await controller.performLive('cultivation', { operation: 'draw', count: 10 });
  assert.equal(saved.rewards.length, 10);
  assert.equal(tickets, 2);
  assert.equal(posts[0].id, posts[1].id);
  assert.equal(runtime.pendingDraw, null);
  assert.equal(state.cultivation.tickets, 2);
  await controller.performLive('cultivation', { operation: 'draw', count: 1 });
  assert.equal(tickets, 1);
  assert.notEqual(posts[2].id, posts[0].id);
});
test('habit archive pagination keeps active rows, merges IDs and discards an obsolete account response', async (t) => {
  const path = '../../web/features/habits.js',
    { createHabitActions } = await import(path);
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const active = { habit: { id: 'active' }, log: { version: 1 } },
    old = { habit: { id: 'old' }, log: { version: 1 } };
  const state: any = {
    live: true,
    habitData: { day: { day: 1 }, habits: [active, old], archivePage: { nextCursor: 50 } },
  };
  const runtime = { revision: 0 };
  let renders = 0;
  const actions = createHabitActions({ state, runtime, render: () => renders++, toast: () => {} });
  globalThis.fetch = async (url) => {
    assert.match(String(url), /archived=1&offset=50$/);
    return json({
      day: { day: 1 },
      habits: [
        { ...active, log: { version: 2 } },
        { habit: { id: 'older' }, log: { version: 1 } },
      ],
      archivePage: { nextCursor: 100 },
    });
  };
  await actions.loadMoreHabits();
  assert.deepEqual(
    state.habitData.habits.map((view: any) => view.habit.id),
    ['active', 'old', 'older'],
  );
  assert.equal(state.habitData.habits[0].log.version, 2);
  assert.equal(state.habitData.archivePage.nextCursor, 100);
  assert.ok(renders >= 2);
  let release!: (response: Response) => void;
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => {
      release = resolve;
    });
  const pending = actions.loadMoreHabits();
  runtime.revision++;
  release(
    json({
      day: { day: 1 },
      habits: [{ habit: { id: 'obsolete' } }],
      archivePage: { nextCursor: null },
    }),
  );
  await pending;
  assert.ok(!state.habitData.habits.some((view: any) => view.habit.id === 'obsolete'));
});
test('reminder pagination keeps existing appointments and maps every later rule once', async (t) => {
  const path = '../../web/features/reminders.js',
    { createReminderActions } = await import(path);
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const state: any = {
    live: true,
    remindersNextCursor: 100,
    reminders: [{ id: 'appointment', origin: 'appointment' }],
  };
  globalThis.fetch = async (url) => {
    assert.match(String(url), /reminders\?offset=100$/);
    return json({
      reminders: [{ id: 'later', times: ['08:00'], startDate: '2026-10-12', endDate: null }],
      nextCursor: null,
    });
  };
  const actions = createReminderActions({
    state,
    runtime: { revision: 0 },
    render: () => {},
    toast: () => {},
  });
  await actions.loadMoreReminders();
  await actions.loadMoreReminders();
  assert.equal(state.reminders.length, 2);
  assert.equal(state.reminders[0].origin, 'appointment');
  assert.equal(state.reminders[1].times, '08:00');
  assert.equal(state.remindersNextCursor, null);
});
test('habit summary keeps one primary fact, counts hidden facts and prioritizes weekly risk', async () => {
  const path = '../../web/models/habits.js';
  const { habitSummary, habitFacts } = await import(path);
  const day = 20731;
  const view = {
    habit: { archivedFrom: null },
    definition: {
      name: 'Đọc sách',
      target: 2000,
      metric: 'duration',
      unit: 'phút',
      cadence: { kind: 'weekly', quota: 3 },
      commitmentFrom: day - 7,
      note: '',
    },
    log: { value: 1500, note: '' },
    preview: { misses: 0, period: { completedDays: [day - 2] } },
    slot: { startAt: Date.parse('2026-10-05T19:00:00+07:00'), minutes: 20 },
    reminderTime: '18:55',
    pending: { fromDay: day + 7, definition: {} },
  };
  assert.deepEqual(habitSummary(view, day), {
    primary: { key: 'slot', text: 'Lịch 19:00 · 20 phút', priority: 20, urgent: false },
    extra: 3,
  });
  assert.equal(habitFacts(view, day).length, 4);
  view.preview.misses = 1;
  assert.equal(habitSummary(view, day).primary.urgent, true);
  assert.equal(habitSummary(view, day).extra, 4);
  view.definition.commitmentFrom = day + 1;
  assert.equal(habitSummary(view, day).primary.key, 'status');
  assert.match(habitSummary(view, day).primary.text, /Cam kết từ/);
  view.habit.archivedFrom = day as any;
  assert.equal(habitSummary(view, day).primary.text, 'Đã lưu trữ');
  assert.ok(!habitFacts(view, day).some((fact: any) => ['slot', 'reminder'].includes(fact.key)));
});
test('compatibility facade keeps every public frontend export', async () => {
  const api = await import(modulePath);
  assert.deepEqual(
    Object.keys(api).sort(),
    [
      'flameLevels',
      'flameLevel',
      'createDemo',
      'breakthroughPenalties',
      'dailyRewards',
      'checkinProgress',
      'dailyRewardLabel',
      'demoCheckin',
      'taskBuckets',
      'realms',
      'loot',
      'talismans',
      'demoDraw',
      'demoCompleteTask',
      'demoFuse',
      'demoBreakthrough',
      'themePreference',
      'applyTheme',
      'setThemePreference',
      'connectLive',
      'browserAuthRequest',
      'historyPage',
      'refreshLive',
      'liveMutation',
    ].sort(),
  );
});
test('web modules have resolvable imports, no circular dependencies and no missing identifiers', () => {
  const graph = new Map<string, string[]>();
  for (const path of paths) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const dependencies: string[] = [];
    for (const statement of source.statements) {
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const dependency = resolve(dirname(path), statement.moduleSpecifier.text);
        assert.ok(paths.includes(dependency), 'Unresolved module: ' + dependency);
        dependencies.push(dependency);
      }
    }
    graph.set(path, dependencies);
  }
  const done = new Set<string>(),
    active = new Set<string>();
  const visit = (path: string) => {
    assert.ok(!active.has(path), 'Circular dependency at ' + path);
    if (done.has(path)) return;
    active.add(path);
    for (const dependency of graph.get(path) ?? []) visit(dependency);
    active.delete(path);
    done.add(path);
  };
  for (const path of paths) visit(path);
  const program = ts.createProgram(paths, {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  });
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => [2304, 2305, 2306, 2307, 2552].includes(d.code));
  assert.deepEqual(
    diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')),
    [],
  );
});
function bootstrap(title = 'Current') {
  return {
    now: Date.now(),
    account: { state: { earned: 10, heartDay: null, peaceDay: null } },
    progress: { completions: [], milestones: [], achievements: [] },
    tasks: [{ id: 'task', public_code: 1, title, status: 'active', version: 1, steps: [] }],
    settings: { start_minutes: 270, sleep_minutes: 1350, version: 1 },
    reminders: [],
    day: { day: 1 },
    rest: { reason: 'active' },
    sessions: [],
    events: [],
  };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
test('transport retains retry ID on ambiguous errors, clears rejected requests and never sends browser header for Telegram', async (t) => {
  const { liveRequest } = await import(httpPath);
  const originalFetch = globalThis.fetch;
  const telegram = (globalThis as any).Telegram;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (telegram === undefined) delete (globalThis as any).Telegram;
    else (globalThis as any).Telegram = telegram;
  });
  const requests: any[] = [];
  let mode = 'lost';
  globalThis.fetch = async (_url, options) => {
    requests.push({ body: JSON.parse(String(options?.body)), headers: options?.headers });
    if (mode === 'lost') throw Error('NETWORK_LOST');
    return mode === 'reject'
      ? json({ error: 'INVALID_REQUEST' }, 400)
      : json({ result: { saved: true } });
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
  const { refreshLive } = await import(livePath),
    { applySnapshot, createAppState } = await import(statePath);
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const calls: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
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
  await new Promise((resolve) => setImmediate(resolve));
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
  const tasks = Array.from({ length: 205 }, (_, i) => ({
    id: 'task-' + i,
    public_code: i + 1,
    title: 'Task ' + i,
    status: 'active',
    version: 1,
    steps: [],
  }));
  const snapshot = {
    ...bootstrap(),
    tasks: [...tasks.slice(0, 200), tasks[204]],
    activeTasksPage: { offset: 200, total: 205, hasMore: true },
  };
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return String(url).includes('bootstrap')
      ? json(snapshot)
      : json({ result: { items: tasks.slice(200), offset: 200, total: 205, hasMore: false } });
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
    if (failed) throw Error('REFRESH_OFFLINE');
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
  const { createLifecycle } = await import(lifecyclePath),
    { createAppState, createRuntimeState } = await import(statePath);
  const originalFetch = globalThis.fetch,
    originalDocument = (globalThis as any).document;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = originalDocument;
  });
  const state = createAppState(true);
  state.loaded = true;
  state.tasks = [{ id: 'task', title: 'Newer write' }];
  const runtime = createRuntimeState();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
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
  const lifecycle = createLifecycle({
    state,
    runtime,
    ui: {},
    content: {},
    sheet: { open: false },
    renderBrowserLogin() {},
    showBrowserLogin() {},
    connected() {},
    toast() {},
  });
  const request = lifecycle.refreshOnReturn();
  runtime.revision++;
  release();
  await request;
  assert.equal(state.tasks[0].title, 'Newer write');
});
test('controller returns acknowledged rewards immediately and reconciles incomplete receipts before another POST', async (t) => {
  const { createMutations } = await import(mutationPath),
    { createAppState, createRuntimeState } = await import(statePath);
  const oldFetch = globalThis.fetch,
    oldDocument = (globalThis as any).document;
  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldDocument === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = oldDocument;
  });
  (globalThis as any).document = { querySelectorAll: () => [] };
  const state = createAppState(true);
  state.loaded = true;
  state.tab = 'achievements';
  const runtime = createRuntimeState(),
    messages: string[] = [],
    calls: string[] = [];
  let offline = true;
  globalThis.fetch = async (url, options) => {
    calls.push((options?.method ?? 'GET') + ' ' + url);
    if (options?.method === 'POST')
      return json({
        result: { dailyReward: { day: 1, qi: 1 } },
        account: {
          state: { earned: 1, qi: 1, checkin: { cycleStartDay: 1, count: 1, lastDay: 1 } },
        },
      });
    if (offline) throw Error('REFRESH_OFFLINE');
    return String(url).includes('history')
      ? json({ result: { items: [], offset: 0, total: 0, hasMore: false } })
      : json(bootstrap());
  };
  const controller = createMutations({
    state,
    runtime,
    sheet: { querySelector: () => null, close() {} },
    render() {},
    toast: (message: string) => messages.push(message),
    showBrowserLogin() {},
  });
  const pending = controller.performLive('cultivation', { operation: 'checkin' });
  assert.equal(await controller.performLive('cultivation', { operation: 'checkin' }), null);
  const result = await pending;
  assert.equal(result.dailyReward.day, 1);
  assert.equal(runtime.refreshPending, false);
  assert.ok(calls.every((call) => call.startsWith('POST')));
  assert.ok(messages.includes('Đã lưu.'));
  // An incomplete receipt needs a fresh version before the next command.
  runtime.refreshPending = true;
  runtime.pendingReceipt = { path: 'settings', input: { operation: 'configure' } };
  calls.length = 0;
  offline = false;
  await controller.performLive('cultivation', { operation: 'draw' });
  const firstPost = calls.findIndex((call) => call.startsWith('POST'));
  assert.ok(firstPost > 0);
  assert.ok(calls.slice(0, firstPost).includes('GET /api/bootstrap'));
  assert.equal(runtime.refreshPending, false);
});
