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
// Real-browser smoke tests. Only localhost fixtures are used; no .env or cloud data.
const browserBin =
  process.env.BROWSER_BIN ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find(existsSync);
const clone = (value) => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-10-05T10:00:00+07:00');
function fixture() {
  const demo = createDemo(),
    operatingDay = Math.floor((now + 25200000 - 270 * 60000) / 86400000);
  const start = operatingDay * 86400000 - 25200000 + 270 * 60000,
    target = start + 18 * 3600000;
  const tasks = demo.tasks.map((t, i) => ({
    id: 'task-' + i,
    public_code: t.code,
    title: t.title,
    note: '',
    version: 1,
    deadline: t.deadline || null,
    status: 'active',
    actual_minutes: 10,
    remaining_minutes: 90,
    steps: t.steps.map((s, j) => ({
      id: 'step-' + j,
      step_code: j + 1,
      title: s.title,
      version: 1,
      status: s.done ? 'completed' : 'active',
    })),
  }));
  const state = {
    now,
    account: {
      version: 1,
      state: {
        ...demo.cultivation,
        earned: demo.cultivation.totalEarned,
        heartDay: null,
        peaceDay: null,
      },
    },
    tasks,
    reminders: [
      {
        id: 'reminder-1',
        version: 1,
        title: 'Uống nước',
        kind: 'daily',
        times: ['09:00', '15:00'],
        weekdays: [],
        startDate: '2026-10-05',
        endDate: null,
        enabled: true,
      },
    ],
    settings: { version: 1, start_minutes: 270, sleep_minutes: 1350, auto_plan_delay_minutes: 180 },
    day: {
      day: operatingDay,
      version: 1,
      start_at: start,
      target_sleep: target,
      end_at: start + 86400000,
      intervals_json: '{}',
      task_plan_status: 'active',
      task_plan_generation: 1,
    },
    dailyPlan: {
      version: 1,
      plan: {
        items: [
          {
            taskId: 'task-0',
            minutes: 90,
            remaining: 90,
            actualMinutes: 10,
            scheduledMinutes: 90,
            windows: [{ start: now - 600000, end: now + 4800000 }],
          },
        ],
        planned: 90,
        capacity: 480,
        risks: [],
      },
    },
    timeline: {
      window: { start, target },
      blocks: [
        { id: 'block-1', task_id: 'task-0', start_at: now - 600000, minutes: 90, version: 1 },
      ],
      busy: [],
      free: [{ start, end: target }],
      events: [],
      stamp: 'test-stamp',
    },
    taskFocus: null,
    taskFocusTarget: { taskId: 'task-0', endsAt: now + 4800000 },
    rest: { reason: 'active' },
    sleepStatus: { asleep: false, canUndo: false },
    resting: false,
    needsSetup: false,
    progress: { completions: [], milestones: [], achievements: [] },
    sessions: [],
    events: [],
  };
  const control = {
    state,
    authenticated: true,
    failBootstrap: false,
    calls: [],
    posts: [],
    receipts: new Map(),
    habits: {
      now,
      day: { day: operatingDay, startAt: start, endAt: start + 86400000 },
      habits: [],
    },
  };
  control.bootstrap = () => ({ ...state, checkin: checkinProgress(state.account.state, now) });
  control.mutate = (path, input) => {
    if (control.receipts.has(input.id)) return control.receipts.get(input.id);
    control.posts.push({ path, input: clone(input) });
    let result = { saved: true };
    const task = state.tasks.find((t) => t.id === input.taskId);
    if (path === 'habits') {
      const day = control.habits.day.day;
      let view = control.habits.habits.find((item) => item.habit.id === input.habitId);
      if (input.operation === 'create') {
        const definition = {
          ...input.definition,
          target: input.definition.target * 100,
          unit:
            input.definition.metric === 'check'
              ? 'lần'
              : input.definition.metric === 'duration'
                ? 'phút'
                : input.definition.unit,
          commitmentFrom:
            day + (input.definition.cadence.kind === 'weekly' ? 7 - ((day + 3) % 7) : 1),
        };
        view = {
          habit: {
            id: 'h_' + input.id,
            version: 1,
            createdDay: day,
            archivedFrom: null,
            revisions: [{ fromDay: day, definition }],
          },
          definition,
          pending: null,
          log: { value: 0, note: '', version: 0 },
          preview: null,
          slot: null,
          reminderTime: input.reminderTime ?? null,
        };
        control.habits.habits.push(view);
        result = { saved: true, habitId: view.habit.id, version: 1 };
      } else if (input.operation === 'log') {
        const before = view.log.value;
        view.log = { value: input.value * 100, note: input.note, version: view.log.version + 1 };
        result = { saved: true, version: view.log.version, ticketAwarded: 0 };
        const period = newHabitPeriod(view.definition, day);
        period.closedThrough = day - 1;
        const key = view.habit.id + ':' + day;
        control.ticketAwards ??= new Set();
        if (
          before < view.definition.target &&
          assessHabitDay(view.definition, day, view.log.value, period, view.habit.archivedFrom)
            .successes === 1 &&
          !control.ticketAwards.has(key)
        ) {
          control.ticketAwards.add(key);
          state.account.state.tickets++;
          result.ticketAwarded = 1;
        }
      } else if (input.operation === 'update') {
        view.habit.version++;
        view.pending = {
          fromDay: day + 1,
          definition: {
            ...input.definition,
            target: input.definition.target * 100,
            commitmentFrom: day + 1,
          },
        };
      } else if (input.operation === 'archive') {
        view.habit.version++;
        view.habit.archivedFrom = day + 1;
      } else if (input.operation === 'slot' || input.operation === 'remove_slot') {
        view.habit.version++;
        view.slot =
          input.operation === 'slot'
            ? { startAt: input.startAt, minutes: input.minutes, version: 1 }
            : null;
        state.timeline.habitSlots = control.habits.habits
          .filter((item) => item.slot)
          .map((item) => ({
            ...item.slot,
            habitId: item.habit.id,
            day,
            name: item.definition.name,
          }));
        result = { saved: true, version: view.habit.version };
      }
      if (view) {
        const period = newHabitPeriod(view.definition, day);
        period.closedThrough = day - 1;
        view.preview = assessHabitDay(
          view.definition,
          day,
          view.log.value,
          period,
          view.habit.archivedFrom,
        );
      }
    } else if (path === 'tasks') {
      if (input.operation === 'create') {
        const created = {
          id: 'new-task-' + state.tasks.length,
          public_code: 30 + state.tasks.length,
          title: input.title,
          note: input.note || '',
          version: 1,
          deadline: input.deadline || null,
          status: 'active',
          steps: [],
          remaining_minutes: input.remainingMinutes,
        };
        state.tasks.push(created);
        result = { id: created.id };
      } else if (task) {
        task.version++;
        if (input.operation === 'edit') {
          task.title = input.title;
          task.note = input.note;
          if ('remainingMinutes' in input) task.remaining_minutes = input.remainingMinutes;
          if ('deadline' in input) task.deadline = input.deadline;
        }
        if (input.operation === 'delete_step')
          task.steps = task.steps.filter((s) => s.id !== input.stepId);
        if (input.operation === 'add_step')
          task.steps.push({
            id: 'added-step',
            step_code: task.steps.length + 1,
            title: input.title,
            version: 1,
            status: 'active',
          });
        if (input.operation === 'step_status')
          task.steps.find((s) => s.id === input.stepId).status = input.complete
            ? 'completed'
            : 'active';
        if (input.operation === 'complete') task.status = input.complete ? 'completed' : 'active';
        result = { id: task.id };
      }
    } else if (path === 'task-focus') {
      state.taskFocus =
        input.operation === 'start' ? { ...state.taskFocusTarget, startedAt: now } : null;
      result = state.taskFocus ? { active: true, ...state.taskFocus } : { active: false };
    } else if (path === 'sleep') {
      const c = state.account.state;
      if (input.operation === 'report') {
        const generation = (state.sleepStatus.generation ?? 0) + 1;
        state.sleepStatus = {
          asleep: true,
          until: state.day.end_at,
          reportedAt: state.now,
          generation,
          canUndo: true,
          undoUntil: state.now + 300000,
        };
        state.rest = { reason: 'asleep', reportedAt: state.now, until: state.day.end_at };
        state.day.asleep_at = state.now;
        c.qi += 5;
        c.streak++;
      } else {
        state.sleepStatus = {
          ...state.sleepStatus,
          asleep: false,
          canUndo: false,
          undoUntil: null,
        };
        state.rest = { reason: 'active' };
        state.day.asleep_at = null;
        c.qi -= 5;
        c.streak--;
      }
      state.resting = state.sleepStatus.asleep;
      result = { sleep: clone(state.sleepStatus), rest: clone(state.rest) };
    } else if (path === 'task-work') {
      task.actual_minutes = input.minutes;
      state.dailyPlan.plan.items.find((i) => i.taskId === task.id).actualMinutes = input.minutes;
    } else if (path === 'day-plan') {
      state.dailyPlan.version++;
      state.dailyPlan.plan.items = input.items.map((i) => ({
        ...i,
        windows: [{ start: now, end: now + i.minutes * 60000 }],
        remaining: i.minutes,
        actualMinutes: 10,
      }));
    } else if (path === 'settings') {
      state.settings.version++;
      const minutes = (value) => {
        const [h, m] = value.split(':').map(Number);
        return h * 60 + m;
      };
      state.settings.start_minutes = minutes(input.start);
      state.settings.sleep_minutes = minutes(input.sleep);
      state.settings.auto_plan_delay_minutes = input.autoPlanDelayMinutes;
    } else if (path === 'reminders') {
      const rule = input.rule,
        existing = state.reminders.find((r) => r.id === rule.id);
      if (existing) Object.assign(existing, rule, { version: existing.version + 1 });
      else state.reminders.push({ ...rule, id: 'new-reminder', version: 1 });
    } else if (path === 'cultivation') {
      const c = state.account.state;
      if (input.operation === 'checkin') {
        const progress = checkinProgress(c, now),
          reward = progress.rewards[progress.count];
        c.checkin = {
          cycleStartDay: progress.cycleStartDay ?? progress.calendarDay,
          count: reward.day,
          lastDay: progress.calendarDay,
        };
        c.qi += reward.qi;
        c.earned += reward.qi;
        c.tickets += reward.tickets;
        for (const [key, amount] of Object.entries(reward.items)) c.inventory[key] += amount;
        result = { dailyReward: reward };
      } else if (input.operation === 'draw') {
        const count = input.count ?? 1;
        assert.ok([1, 10].includes(count) && c.tickets >= count);
        c.tickets -= count;
        c.inventory.basic += count;
        result = {
          count,
          rewards: Array(count).fill('basic'),
          ...(count === 1 ? { reward: 'basic' } : {}),
        };
      } else if (input.operation === 'fuse') {
        c.inventory.basic -= 3;
        c.inventory.middle++;
        result = { success: true };
      } else if (input.operation === 'protect') {
        c.inventory[input.item]--;
        c[input.item + 'Day'] = operatingDay;
        result = { protected: true };
      } else if (input.operation === 'breakthrough') {
        c.rank++;
        result = { success: true, penalty: 0 };
      }
    }
    const response = clone({
      result,
      ...(['cultivation', 'sleep'].includes(path) ||
      (path === 'habits' && input.operation === 'log')
        ? { account: state.account }
        : {}),
    });
    control.receipts.set(input.id, response);
    return response;
  };
  return control;
}
async function serve(control, baseline) {
  const root = resolve('web'),
    cache = new Map();
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (path.startsWith('/api/')) {
        const endpoint = path.slice(5);
        control.calls.push(request.method + ' ' + endpoint);
        response.setHeader('Content-Type', 'application/json');
        if (endpoint.startsWith('browser-auth/')) {
          if (endpoint.endsWith('logout')) control.authenticated = false;
          response.end(
            JSON.stringify(
              endpoint.endsWith('start')
                ? { code: 'TEST-CODE', authenticated: false }
                : { authenticated: control.authenticated },
            ),
          );
          return;
        }
        if (!control.authenticated) {
          response.statusCode = 401;
          response.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
          return;
        }
        if (control.api) {
          const result = await control.api(request, endpoint);
          response.statusCode = result.status;
          response.end(await result.text());
          return;
        }
        if (request.method === 'GET') await control.readGates?.get(endpoint)?.();
        if (request.method === 'GET' && control.readDelays?.[endpoint])
          await delay(control.readDelays[endpoint]);
        if (request.method === 'GET' && control.failedReads?.has(endpoint)) {
          response.statusCode = 503;
          response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' }));
          return;
        }
        if (endpoint.startsWith('linh-thu') && control.beastApi) {
          const result = await control.beastApi(request, endpoint);
          response.statusCode = result.status ?? 200;
          response.end(JSON.stringify(result.body));
        } else if (endpoint === 'linh-thu/tower' && request.method === 'GET') {
          response.end(
            JSON.stringify({
              eligibility: { day: control.habits.day.day, eligible: false },
              run: null,
              account: { version: 1, state: { summonTickets: 0 } },
              wallet: control.state.account,
            }),
          );
        } else if (endpoint === 'bootstrap') {
          if (control.failBootstrap) {
            response.statusCode = 503;
            response.end(JSON.stringify({ error: 'OPERATION_NOT_CONFIRMED' }));
          } else response.end(JSON.stringify(control.bootstrap()));
        } else if (endpoint === 'habits' && request.method === 'GET')
          response.end(JSON.stringify(control.habits));
        else if (endpoint === 'habit-history') {
          const params = new URL(request.url, 'http://localhost').searchParams;
          const rows = control.habits.habits
            .filter((view) => !params.get('habitId') || params.get('habitId') === view.habit.id)
            .map((view) => ({
              habitId: view.habit.id,
              day: control.habits.day.day,
              name: view.definition.name,
              definition: view.definition,
              value: view.log.value,
              note: view.log.note,
              status: 'processing',
              reason: 'day_open',
              successes: 0,
              misses: 0,
            }));
          response.end(JSON.stringify({ rows, next: null }));
        } else if (endpoint === 'habit-report') {
          const params = new URL(request.url, 'http://localhost').searchParams,
            from = Number(params.get('from')),
            to = Number(params.get('to'));
          const outcomes = (control.habitOutcomes ?? []).filter(
            (row) =>
              row.day >= from &&
              row.day <= to &&
              (!params.get('habitId') || row.habitId === params.get('habitId')),
          );
          const byHabit = [],
            days = [];
          for (const row of outcomes) {
            let habit = byHabit.find((item) => item.habitId === row.habitId),
              day = days.find((item) => item.day === row.day);
            if (!habit) {
              habit = {
                habitId: row.habitId,
                name: row.name,
                successes: 0,
                misses: 0,
                neutral: 0,
                rate: null,
                days: [],
              };
              byHabit.push(habit);
            }
            if (!day) {
              day = { day: row.day, successes: 0, misses: 0, neutral: 0 };
              days.push(day);
            }
            habit.successes += row.successes;
            habit.misses += row.misses;
            habit.neutral += +(row.status === 'neutral');
            habit.days.push(row);
            day.successes += row.successes;
            day.misses += row.misses;
            day.neutral += +(row.status === 'neutral');
          }
          for (const habit of byHabit)
            habit.rate =
              habit.successes + habit.misses
                ? Math.round((100 * habit.successes) / (habit.successes + habit.misses))
                : null;
          const successes = days.reduce((sum, row) => sum + row.successes, 0),
            misses = days.reduce((sum, row) => sum + row.misses, 0);
          response.end(
            JSON.stringify({
              from,
              to,
              successes,
              misses,
              neutral: days.reduce((sum, row) => sum + row.neutral, 0),
              rate:
                successes + misses ? Math.round((100 * successes) / (successes + misses)) : null,
              days,
              totals: [],
              byHabit,
            }),
          );
        } else if (endpoint === 'history')
          response.end(
            JSON.stringify({ result: { items: [], offset: 0, total: 0, hasMore: false } }),
          );
        else if (endpoint === 'tasks-page') {
          const offset = Number(
            new URL(request.url, 'http://localhost').searchParams.get('offset') ?? 0,
          );
          response.end(
            JSON.stringify({
              result: {
                items: control.state.tasks.slice(offset, offset + 200),
                offset,
                total: control.state.tasks.length,
                hasMore: offset + 200 < control.state.tasks.length,
              },
            }),
          );
        } else {
          let body = '';
          for await (const part of request) body += part;
          if (endpoint === 'sleep' && control.sleepError) {
            response.statusCode = 409;
            response.end(
              JSON.stringify({
                error: 'SLEEP_UNDO_LOCKED',
                message: 'Không thể hoàn tác sau khi đột phá.',
              }),
            );
            return;
          }
          response.end(JSON.stringify(control.mutate(endpoint, JSON.parse(body))));
        }
        return;
      }
      const relative =
        path === '/app/' || path === '/'
          ? 'index.html'
          : path.replace(/^\/app\//, '').replace(/^\//, '');
      const file = resolve(root, relative);
      if (!file.startsWith(root + sep)) {
        response.statusCode = 403;
        response.end();
        return;
      }
      let body;
      if (control.staticFiles?.has(relative)) body = control.staticFiles.get(relative);
      else if (baseline) {
        if (!cache.has(relative))
          cache.set(
            relative,
            execFileSync('git', ['show', baseline + ':web/' + relative], {
              windowsHide: true,
              stdio: ['ignore', 'pipe', 'ignore'],
            }),
          );
        body = cache.get(relative);
      } else body = await readFile(file);
      response.setHeader(
        'Content-Type',
        relative.endsWith('.js')
          ? 'text/javascript'
          : relative.endsWith('.css')
            ? 'text/css'
            : relative.endsWith('.webp')
              ? 'image/webp'
              : relative.endsWith('.svg')
                ? 'image/svg+xml'
                : 'text/html',
      );
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: 'http://127.0.0.1:' + server.address().port + '/app/',
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
async function chrome() {
  const profile = await mkdtemp(join(tmpdir(), 'minh-anh-browser-'));
  const browserProcess = spawn(
    browserBin,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let startupError,
    diagnostics = '';
  let processClosed = false;
  const processExit = new Promise((resolve) => {
    browserProcess.once('close', () => {
      processClosed = true;
      resolve();
    });
  });
  const waitForExit = (ms) =>
    Promise.race([processExit.then(() => true), delay(ms, false, { ref: false })]);
  browserProcess.on('error', (error) => {
    startupError = error;
  });
  browserProcess.stderr.on('data', (data) => {
    diagnostics = (diagnostics + String(data)).slice(-2000);
  });
  const cleanup = async () => {
    if (!processClosed && !(await waitForExit(1000))) {
      browserProcess.kill();
      if (!(await waitForExit(5000))) {
        browserProcess.kill('SIGKILL');
        if (!(await waitForExit(5000)))
          throw Error('Owned browser process did not exit: ' + diagnostics);
      }
    }
    const target = resolve(profile);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('minh-anh-browser-'));
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    let port;
    for (let i = 0; i < 300; i++) {
      if (startupError) throw startupError;
      if (browserProcess.exitCode !== null || browserProcess.signalCode !== null)
        throw Error('Browser exited before readiness: ' + diagnostics);
      try {
        port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
        break;
      } catch {
        await delay(100);
      }
    }
    if (!port) throw Error('Browser debugging port unavailable: ' + diagnostics);
    const target = (
      await (
        await fetch('http://127.0.0.1:' + port + '/json/list', {
          signal: AbortSignal.timeout(5000),
        })
      ).json()
    ).find((t) => t.type === 'page');
    const socket = new WebSocket(target.webSocketDebuggerUrl),
      pending = new Map(),
      errors = [],
      consoleErrors = [],
      resourceFailures = [],
      requests = new Map(),
      lifecycle = new Map();
    let sequence = 0,
      documentFrame,
      offline = false,
      closing;
    const record = (list, value) => {
      list.push(value);
      if (list.length > 30) list.shift();
    };
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(Error('Browser handshake timed out'));
      }, 5000);
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        'error',
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
        { once: true },
      );
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        clearTimeout(request.timer);
        message.error
          ? request.reject(Error(message.error.message))
          : request.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown')
        errors.push(
          message.params.exceptionDetails.exception?.description ||
            message.params.exceptionDetails.text,
        );
      const params = message.params;
      if (message.method === 'Runtime.consoleAPICalled' && params.type === 'error')
        record(consoleErrors, params.args.map((arg) => arg.value ?? arg.description).join(' '));
      if (message.method === 'Network.requestWillBeSent')
        requests.set(params.requestId, {
          url: params.request.url,
          type: params.type,
          loaderId: params.loaderId,
        });
      if (message.method === 'Network.responseReceived' && params.response.status >= 400)
        record(resourceFailures, {
          ...requests.get(params.requestId),
          url: params.response.url,
          status: params.response.status,
        });
      if (message.method === 'Network.loadingFailed')
        record(resourceFailures, {
          ...requests.get(params.requestId),
          error: params.errorText,
          canceled: params.canceled ?? false,
          blockedReason: params.blockedReason,
        });
      if (['Network.loadingFinished', 'Network.loadingFailed'].includes(message.method))
        requests.delete(params.requestId);
      if (message.method === 'Page.frameNavigated' && !params.frame.parentId)
        documentFrame = params.frame;
      if (message.method === 'Page.lifecycleEvent') {
        if (!lifecycle.has(params.loaderId)) lifecycle.set(params.loaderId, new Set());
        lifecycle.get(params.loaderId).add(params.name);
        if (lifecycle.size > 30) lifecycle.delete(lifecycle.keys().next().value);
      }
    });
    socket.addEventListener('close', () => {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(Error('Browser connection closed'));
      }
      pending.clear();
    });
    const call = (method, params = {}) =>
      new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) {
          reject(Error('Browser connection is not open: ' + method));
          return;
        }
        const id = ++sequence,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(Error('Browser command timed out: ' + method));
          }, 5000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    await call('Runtime.enable');
    await call('Page.enable');
    await call('Page.setLifecycleEventsEnabled', { enabled: true });
    await call('Network.enable');
    const evaluate = async (expression) => {
      const result = await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const describe = async () => {
      let page;
      try {
        page = await evaluate(`({url:location.href,readyState:document.readyState,
          contentChildren:document.querySelector('#content')?.childElementCount,
          text:document.body?.innerText?.slice(0,8000)})`);
      } catch (error) {
        page = { error: error.message };
      }
      return JSON.stringify(
        {
          page,
          frame: documentFrame && {
            url: documentFrame.url,
            loaderId: documentFrame.loaderId,
            lifecycle: [...(lifecycle.get(documentFrame.loaderId) ?? [])],
          },
          errors,
          consoleErrors,
          resourceFailures,
          pendingResources: [...requests.values()],
          browserDiagnostics: diagnostics,
        },
        null,
        2,
      );
    };
    const wait = async (expression) => {
      for (let i = 0; i < 150; i++) {
        if (await evaluate(expression)) return;
        await delay(80);
      }
      throw Error('Timed out waiting for ' + expression + '\n' + (await describe()));
    };
    return {
      errors,
      evaluate,
      wait,
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
      async networkConditions(isOffline = false, latency = 150, bytesPerSecond = 102400) {
        await call('Network.emulateNetworkConditions', {
          offline: isOffline,
          latency,
          downloadThroughput: bytesPerSecond,
          uploadThroughput: bytesPerSecond,
          connectionType: 'cellular3g',
        });
        // Keep intentional offline navigations distinct from unexpected navigation errors.
        offline = isOffline;
      },
      async press(key, code = key) {
        const windowsVirtualKeyCode = { Enter: 13, Escape: 27, Tab: 9 }[key];
        await call('Emulation.setFocusEmulationEnabled', { enabled: true });
        await call('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          key,
          code,
          windowsVirtualKeyCode,
        });
        if (key === 'Enter')
          await call('Input.dispatchKeyEvent', {
            type: 'char',
            key,
            code,
            text: '\r',
            unmodifiedText: '\r',
            windowsVirtualKeyCode,
          });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
      },
      async colorScheme(value) {
        await call('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value }],
        });
      },
      async reducedMotion(enabled = true) {
        await call('Emulation.setEmulatedMedia', {
          features: [
            { name: 'prefers-reduced-motion', value: enabled ? 'reduce' : 'no-preference' },
          ],
        });
      },
      async screenshot(path) {
        const { data } = await call('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });
        await writeFile(path, Buffer.from(data, 'base64'));
      },
      async resize(width, height) {
        await call('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: width < 900,
        });
        await evaluate(
          'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
        );
      },
      async tap(selector) {
        await evaluate(
          'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
        );
        const point = await evaluate(
          `(() => { const node=document.querySelector(${JSON.stringify(selector)});if(!node)return null;const rect=node.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}; })()`,
        );
        assert.ok(point, 'Missing tap target: ' + selector);
        await call('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...point,
          button: 'left',
          clickCount: 1,
        });
        await call('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...point,
          button: 'left',
          clickCount: 1,
        });
      },
      async navigate(url, width = 1440) {
        errors.length = 0;
        consoleErrors.length = 0;
        resourceFailures.length = 0;
        requests.clear();
        await call('Emulation.setDeviceMetricsOverride', {
          width,
          height: width < 900 ? 844 : 1000,
          deviceScaleFactor: 1,
          mobile: width < 900,
        });
        const navigation = await call('Page.navigate', { url });
        if (navigation.errorText && !offline)
          throw Error('Navigation failed: ' + navigation.errorText + '\n' + (await describe()));
        // Events may arrive before Page.navigate resolves. Match the returned loader,
        // rather than accepting readiness or elements belonging to the old document.
        if (navigation.loaderId) {
          for (let i = 0; i < 150; i++) {
            if (
              documentFrame?.id === navigation.frameId &&
              documentFrame.loaderId === navigation.loaderId &&
              lifecycle.get(navigation.loaderId)?.has('DOMContentLoaded')
            )
              return navigation;
            await delay(80);
          }
          throw Error('Timed out loading new document: ' + url + '\n' + (await describe()));
        }
        return navigation;
      },
      async click(label, selector = 'button') {
        const done = await evaluate(
          `(() => { const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.textContent.trim()===${JSON.stringify(label)}&&!n.disabled); if(!node)return false; node.click();return true; })()`,
        );
        assert.equal(done, true, 'Missing enabled control: ' + label);
      },
      async close() {
        closing ??= (async () => {
          try {
            await call('Browser.close');
          } catch {
            // The connection can close before Chrome acknowledges Browser.close.
          } finally {
            socket.close();
            await cleanup();
          }
        })();
        await closing;
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
async function snapshot(browser) {
  return browser.evaluate(
    `(() => { const root=document.querySelector('#content');const rect=root.getBoundingClientRect();return {text:root.innerText,buttons:[...root.querySelectorAll('button')].map(b=>({text:b.innerText,disabled:b.disabled})),geometry:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},overflow:document.documentElement.scrollWidth>innerWidth+1};})()`,
  );
}

export { browserBin, fixture, serve, chrome, snapshot, clone, now };
