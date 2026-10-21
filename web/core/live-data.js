import { liveRequest, settleRequest } from './http.js';
import { applyTheme } from './theme.js';
let viewportApp;
function connectViewport(app) {
  if (viewportApp === app) return;
  viewportApp = app;
  const sync = (event) => {
    if (event?.isStateStable === false) return;
    const root = document.documentElement;
    if (Number.isFinite(app.viewportStableHeight) && app.viewportStableHeight > 0)
      root.style.setProperty('--app-viewport-height', app.viewportStableHeight + 'px');
    for (const edge of ['top', 'right', 'bottom', 'left'])
      root.style.setProperty(
        '--app-host-safe-' + edge,
        Math.max(0, app.safeAreaInset?.[edge] ?? 0, app.contentSafeAreaInset?.[edge] ?? 0) + 'px',
      );
  };
  for (const name of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged'])
    app.onEvent?.(name, sync);
  sync();
}
export async function connectLive() {
  if (!globalThis.Telegram?.WebApp && location.hash.includes('tgWebAppData')) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = resolve;
      script.onerror = () => reject(Error('Không tải được Telegram SDK.'));
      document.head.append(script);
    });
  }
  const app = globalThis.Telegram?.WebApp;
  const theme = () => applyTheme();
  theme();
  if (app?.initData) {
    connectViewport(app);
    app.onEvent?.('themeChanged', theme);
    app.ready();
    app.expand();
  }
  return refreshLive();
}
export function mapTask(t, completions = new Map()) {
  const completedAt = t.completed_at ?? t.completedAt ?? completions.get(t.id) ?? null;
  return {
    id: t.id,
    code: t.public_code ?? t.code,
    title: t.title,
    note: t.note ?? '',
    version: t.version,
    deadline: t.deadline ?? '',
    done: t.status === 'completed' || t.done === true,
    completedAt,
    archivedAt: t.archived_at ?? null,
    actualMinutes: Number(t.actual_minutes ?? t.actualMinutes ?? 0),
    remainingMinutes: t.remaining_minutes ?? t.remainingMinutes ?? null,
    remainingBalance:
      t.remaining_balance ??
      t.remainingBalance ??
      t.remaining_minutes ??
      t.remainingMinutes ??
      null,
    steps: (t.steps ?? []).map((s) => ({
      id: s.id,
      code: s.code ?? (t.public_code ?? t.code) + '.' + s.step_code,
      title: s.title,
      done: s.status === 'completed' || s.done === true,
      version: s.version,
    })),
  };
}
export async function historyPage(offset = 0) {
  const response = await liveRequest('history?offset=' + Math.max(0, Math.floor(offset)));
  const page = response.result ?? {};
  return {
    items: (page.items ?? []).map((item) => mapTask(item)),
    offset: Number(page.offset ?? offset),
    limit: Number(page.limit ?? 20),
    total: Number(page.total ?? 0),
    hasMore: !!page.hasMore,
  };
}
export function mapAccount(account, day) {
  const c = account.state;
  return {
    ...c,
    totalEarned: c.earned,
    active: { heart: c.heartDay === day, peace: c.peaceDay === day },
    log: [],
    rewardedTasks: [],
  };
}
export async function activeTaskPage(offset = 0) {
  const response = await liveRequest('tasks-page?offset=' + Math.max(0, Math.floor(offset)));
  const page = response.result ?? {};
  return { ...page, items: (page.items ?? []).map((task) => mapTask(task)) };
}
export async function refreshLive({
  includeHistory = true,
  activeOffset = 0,
  includeHabits = false,
  scope = 'all',
} = {}) {
  if (scope === 'habits') {
    const data = await liveRequest('habits?archived=1');
    return { habitData: data, baseDirty: true };
  }
  // Start independent reads together; history errors still do not block bootstrap.
  const historyRequest = includeHistory ? historyPage(0).catch(() => null) : Promise.resolve(null);
  const habitsRequest = includeHabits ? liveRequest('habits?archived=1') : Promise.resolve(null);
  const [data, page, habitData] = await Promise.all([
    liveRequest('bootstrap'),
    historyRequest,
    habitsRequest,
  ]);
  const completions = new Map(
    data.progress.completions.map((item) => [item.task_id, item.completed_at]),
  );
  const clock = (n) =>
    String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const history = page ?? { items: [], offset: 0, limit: 20, total: 0, hasMore: false };
  const baseTasks = data.tasks.map((t) => mapTask(t, completions));
  for (const item of history.items)
    if (!baseTasks.some((task) => task.id === item.id)) baseTasks.push(item);
  let activeTasksOffset = data.activeTasksPage?.offset ?? 0;
  let activeTasksHasMore = !!data.activeTasksPage?.hasMore;
  let activeTasksTotal =
    data.activeTasksPage?.total ?? baseTasks.filter((task) => !task.done).length;
  // Keep explicitly opened pages visible when polling or saving refreshes state.
  const target = Math.min(100000, Math.max(0, Number(activeOffset) || 0));
  const positions = new Map(baseTasks.map((task, index) => [task.id, index]));
  while (activeTasksHasMore && activeTasksOffset < target) {
    const page = await activeTaskPage(activeTasksOffset);
    for (const task of page.items) {
      const existing = positions.get(task.id);
      if (existing !== undefined) baseTasks[existing] = task;
      else {
        positions.set(task.id, baseTasks.length);
        baseTasks.push(task);
      }
    }
    const next = page.offset + page.items.length;
    if (next <= activeTasksOffset) break;
    activeTasksOffset = next;
    activeTasksHasMore = !!page.hasMore;
    activeTasksTotal = page.total;
  }
  return {
    live: true,
    loaded: true,
    checkin: data.checkin,
    breakthroughPenalties: data.breakthroughPenalties,
    resting: data.resting,
    rest: data.rest,
    sleepStatus: data.sleepStatus,
    needsSetup: data.needsSetup,
    serverNow: data.now,
    settingsVersion: data.settings?.version ?? 0,
    start: clock(data.settings?.start_minutes ?? 270),
    sleep:
      data.settings?.sleep_minutes === null || !data.settings
        ? ''
        : clock(data.settings.sleep_minutes),
    autoPlanDelayMinutes: Number(data.settings?.auto_plan_delay_minutes ?? 180),
    tasks: baseTasks,
    activeTasksOffset,
    activeTasksTotal,
    activeTasksHasMore,
    activeTasksLoading: false,
    historyRefreshed: includeHistory,
    ...(includeHistory
      ? {
          historyOffset: history.offset + history.items.length,
          historyHasMore: history.hasMore,
          historyTotal: history.total,
          historyLoading: false,
        }
      : {}),
    reminders: data.reminders.map((r) => ({
      ...r,
      times: r.times.join(', '),
      start: r.startDate,
      end: r.endDate ?? '',
    })),
    remindersNextCursor: data.remindersPage?.nextCursor ?? null,
    cultivation: mapAccount(data.account, data.day?.day),
    ...(includeHabits ? { habitData } : {}),
    day: data.day,
    operatingDay: data.day?.day ?? null,
    dailyPlan: data.dailyPlan,
    taskFocus: data.taskFocus ?? null,
    taskFocusTarget: data.taskFocusTarget ?? null,
    timeline: data.timeline,
    loadedAt: Date.now(),
    progress: data.progress,
    sessions: data.sessions,
    events: data.events,
    baseDirty: false,
  };
}
export async function liveMutation(path, input, options = {}) {
  const result = await liveRequest(path, input);
  // A draw receipt includes the complete wallet. Showing its confirmed rewards
  // does not depend on reading the schedule, task pages or habit reports again.
  if (
    path === 'cultivation' &&
    input.operation === 'draw' &&
    options.scope === 'draw' &&
    result.account?.state
  ) {
    settleRequest(path, input);
    return { result, committed: true, accountOnly: true };
  }
  try {
    const refreshed = await refreshLive(options);
    settleRequest(path, input);
    return { result, ...refreshed, committed: true };
  } catch (refreshError) {
    // The POST was acknowledged. Never describe a failed refresh as a failed save.
    // Keep its retry identity until the controller has reconciled with the server.
    return { result, committed: true, refreshError };
  }
}
