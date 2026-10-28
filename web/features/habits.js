import { liveRequest, requestIdentity } from '../core/http.js';
import {
  cadenceLabel,
  habitDate,
  habitWeekdays,
  habitNumber,
  habitDisplayUnit,
  safeCsvCell,
} from '../models/habits.js';
import { button, el, field } from '../ui/dom.js';
import { habitJsonExport } from '../models/habit-export.js';
import { prefersReducedMotion } from '../core/experience.js';
import { waitForWrite } from '../core/state.js';
import { habitArchived, habitNeeded } from '../views/habits-today.js';
import { habitIcon } from '../ui/habit-icons.js';
const pendingLogKey = 'minh-anh-habit-pending-v1';
const queuedLogKey = 'minh-anh-habit-queue-v1';

export function createHabitActions(context) {
  const { state, runtime, render, toast, sheet, sheetContent, openSheet, performLive } = context;
  globalThis.document?.addEventListener('click', (event) => {
    if (!(event.target instanceof Node)) return;
    for (const menu of document.querySelectorAll('.hv2-menu[open], .hv2-row-options[open]'))
      if (!menu.contains(event.target)) menu.removeAttribute('open');
  });
  globalThis.document?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menus = document.querySelectorAll('.hv2-menu[open], .hv2-row-options[open]');
    if (!menus.length) return;
    event.preventDefault();
    for (const menu of menus) {
      menu.removeAttribute('open');
      menu.querySelector('summary')?.focus();
    }
  });
  let loadGeneration = 0,
    reportGeneration = 0,
    historyGeneration = 0;
  const progressCache = new Map(),
    progressRequests = new Map();
  let loading, loadingRevision;
  const logQueue = new Map();
  const pendingLogs = new Map(),
    recoveringLogs = new Set();
  function persistLogs() {
    try {
      if (pendingLogs.size)
        sessionStorage.setItem(pendingLogKey, JSON.stringify([...pendingLogs.values()]));
      else sessionStorage.removeItem(pendingLogKey);
      const queued = [...logQueue].filter(([id, intent]) => {
        const sent = pendingLogs.get(id)?.input;
        return (
          !sent ||
          sent.day !== intent.day ||
          Math.round(sent.value * 100) !== intent.value ||
          sent.note !== intent.note
        );
      });
      if (queued.length) sessionStorage.setItem(queuedLogKey, JSON.stringify(queued));
      else sessionStorage.removeItem(queuedLogKey);
    } catch {
      /* Recovery stays available in memory if storage is disabled. */
    }
  }
  try {
    const queued = JSON.parse(sessionStorage.getItem(queuedLogKey) ?? '[]');
    for (const [id, intent] of queued) {
      if (
        typeof id !== 'string' ||
        !Number.isSafeInteger(intent?.day) ||
        !Number.isFinite(intent?.value) ||
        typeof intent.note !== 'string'
      )
        continue;
      logQueue.set(id, { ...intent, session: runtime.session });
    }
    const entries = JSON.parse(sessionStorage.getItem(pendingLogKey) ?? '[]');
    for (const entry of entries) {
      if (
        entry?.input?.operation !== 'log' ||
        typeof entry.input.habitId !== 'string' ||
        typeof entry.id !== 'string'
      )
        continue;
      requestIdentity('habits', entry.input, entry.id);
      pendingLogs.set(entry.input.habitId, entry);
    }
  } catch {
    /* Ignore invalid or unavailable session storage. */
  }
  function resetHabitLogs() {
    logQueue.clear();
    pendingLogs.clear();
    recoveringLogs.clear();
    persistLogs();
    state.habitLogRecovery = {};
    state.habitLogIntents = {};
  }
  let drainingLogs = false;
  function loadHabits(force = true) {
    if (
      !force &&
      state.habitData &&
      Date.now() - (state.habitRefreshedAt ?? 0) < 15000 &&
      Date.now() < state.habitExpiresAt
    )
      return Promise.resolve();
    if (loading && loadingRevision === runtime.revision) return loading;
    loadingRevision = runtime.revision;
    const request = fetchHabits().finally(() => {
      if (loading === request) loading = null;
    });
    loading = request;
    return request;
  }
  async function fetchHabits() {
    const generation = ++loadGeneration,
      revision = runtime.revision;
    if (!state.habitData) {
      state.habitProgress = null;
      reportGeneration++;
    }
    state.habitLoading = true;
    state.habitError = null;
    render();
    try {
      const data = state.live
        ? await liveRequest('habits?archived=1')
        : { day: { day: Math.floor((Date.now() + 25200000) / 86400000) }, habits: [] };
      if (generation !== loadGeneration || revision !== runtime.revision) return;
      state.habitData = data;
      state.habitLogRecovery = Object.fromEntries(
        [...pendingLogs].map(([id, entry]) => [id, entry.input]),
      );
      for (const [id, intent] of logQueue) {
        if (intent.session === runtime.session) (state.habitLogIntents ??= {})[id] = intent;
      }
      state.habitRefreshedAt = Date.now();
      state.habitExpiresAt =
        Date.now() +
        data.day.endAt -
        (data.now ?? (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now()));
      if (state.habitPanel === 'progress') loadHabitProgress();
      if (logQueue.size) void drainLogs();
    } catch (error) {
      if (generation !== loadGeneration || revision !== runtime.revision) return;
      state.habitError = error.message;
    } finally {
      if (generation === loadGeneration) {
        state.habitLoading = false;
        render();
      }
    }
  }
  function setHabitFilter(filter) {
    state.habitFilter = filter;
    state.habitSelecting = false;
    state.habitSelected?.clear();
    render();
  }
  async function loadMoreHabits() {
    const cursor = state.habitData?.archivePage?.nextCursor;
    if (!state.live || cursor == null || state.habitArchiveLoading) return;
    const revision = runtime.revision,
      generation = loadGeneration,
      day = state.habitData.day.day;
    state.habitArchiveLoading = true;
    render();
    try {
      const page = await liveRequest('habits?archived=1&offset=' + cursor);
      if (revision !== runtime.revision || generation !== loadGeneration) return;
      if (page.day.day !== day) {
        await loadHabits();
        return;
      }
      state.habitData = {
        ...page,
        habits: [
          ...new Map(
            [...state.habitData.habits, ...page.habits].map((view) => [view.habit.id, view]),
          ).values(),
        ],
      };
    } catch (error) {
      toast(error.message);
    } finally {
      state.habitArchiveLoading = false;
      render();
    }
  }
  function showHabitPanel(panel) {
    state.habitPanel = panel;
    state.habitSelecting = false;
    state.habitSelected?.clear();
    render();
    if (panel === 'history') loadHabitHistory(state.habitHistoryId ?? '');
    if (panel === 'progress') loadHabitProgress();
  }
  async function moveHabit(view, other) {
    if (!other || state.habitOrdering) return;
    const session = runtime.session;
    state.habitOrdering = true;
    render();
    try {
      const swap = (result) => {
        const habits = state.habitData?.habits;
        if (!habits || runtime.session !== session) return;
        const a = habits.findIndex((item) => item.habit.id === view.habit.id);
        const b = habits.findIndex((item) => item.habit.id === other.habit.id);
        if (a < 0 || b < 0) return;
        habits[a].habit.version = result.version;
        habits[b].habit.version = result.otherVersion;
        [habits[a], habits[b]] = [habits[b], habits[a]];
      };
      if (!state.live)
        swap({ version: view.habit.version + 1, otherVersion: other.habit.version + 1 });
      else {
        const saved = await performLive(
          'habits',
          {
            operation: 'reorder',
            habitId: view.habit.id,
            version: view.habit.version,
            otherId: other.habit.id,
            otherVersion: other.habit.version,
          },
          { silent: true, keepSheet: true, reconciled: true, onCommitted: swap },
        );
        if (!saved && runtime.session === session) await loadHabits();
      }
    } finally {
      if (runtime.session === session) {
        state.habitOrdering = false;
        render();
        const target = document.querySelector(
          '[data-habit-id="' + view.habit.id + '"] .hv2-order button:not(:disabled)',
        );
        if (target instanceof HTMLElement) target.focus({ preventScroll: true });
      }
    }
  }
  async function loadHabitProgress() {
    if (!state.habitData) return;
    const revision = runtime.revision,
      generation = ++reportGeneration;
    const to = state.habitData.day.day - 1,
      from = to - (state.habitProgressSpan ?? 7) + 1;
    const key = revision + ':' + from + ':' + to;
    const cached = progressCache.get(key);
    state.habitProgress = cached && Date.now() - cached.loadedAt < 60000 ? cached.report : null;
    state.habitProgressError = null;
    if (state.habitProgress) {
      state.habitProgressLoading = false;
      render();
      return;
    }
    state.habitProgressLoading = true;
    render();
    try {
      if (!progressRequests.has(key))
        progressRequests.set(
          key,
          (state.live
            ? liveRequest(
                'habit-report?' + new URLSearchParams({ from: String(from), to: String(to) }),
              )
            : Promise.resolve({ from, to, byHabit: [] })
          ).finally(() => progressRequests.delete(key)),
        );
      const report = await progressRequests.get(key);
      if (generation !== reportGeneration || revision !== runtime.revision) return;
      progressCache.set(key, { report, loadedAt: Date.now() });
      state.habitProgress = report;
    } catch (error) {
      if (generation === reportGeneration && revision === runtime.revision)
        state.habitProgressError = error.message;
    } finally {
      if (generation === reportGeneration) {
        state.habitProgressLoading = false;
        render();
      }
    }
  }
  async function loadHabitHistory(habitId = '', more = false) {
    if (state.habitHistoryLoading || !state.habitData) return;
    const revision = runtime.revision,
      generation = ++historyGeneration;
    state.habitHistoryId = habitId;
    state.habitHistoryLoading = true;
    if (!more) state.habitHistory = null;
    render();
    const to = state.habitData.day.day;
    const span = state.habitReportSpan ?? 30;
    const params = new URLSearchParams({
      from: String(to - span + 1),
      to: String(to),
      limit: '50',
    });
    if (habitId) params.set('habitId', habitId);
    if (state.habitHistoryStatus && state.habitHistoryStatus !== 'all')
      params.set('status', state.habitHistoryStatus);
    if (more && state.habitHistory?.next) params.set('before', state.habitHistory.next);
    try {
      const [result, report] = state.live
        ? await Promise.all([
            liveRequest('habit-history?' + params),
            more ? Promise.resolve(state.habitReport) : liveRequest('habit-report?' + params),
          ])
        : [{ rows: [], next: null }, null];
      if (revision !== runtime.revision || generation !== historyGeneration) return;
      state.habitHistory = {
        ...result,
        rows: more ? [...state.habitHistory.rows, ...result.rows] : result.rows,
      };
      state.habitReport = report;
    } catch (error) {
      if (revision === runtime.revision && generation === historyGeneration) toast(error.message);
    } finally {
      if (generation === historyGeneration) {
        state.habitHistoryLoading = false;
        render();
      }
    }
  }
  function setHabitReportSpan(span) {
    if (state.habitPanel === 'progress') {
      state.habitProgressSpan = span;
      loadHabitProgress();
      return;
    }
    if (state.habitHistoryLoading) return;
    state.habitReportSpan = span;
    loadHabitHistory(state.habitHistoryId ?? '');
  }
  function setHabitHistoryStatus(status) {
    if (state.habitHistoryLoading) return;
    state.habitHistoryStatus = status;
    loadHabitHistory(state.habitHistoryId ?? '');
  }
  async function save(input, options) {
    if (!state.live) {
      toast('Bản mẫu không lưu dữ liệu. Mở app đã đăng nhập để theo dõi nhé.');
      return null;
    }
    const result = await performLive('habits', input, options);
    if (result) {
      if (state.tab === 'beasts' && ['training', 'companion'].includes(state.beastPanel))
        context.ui.loadBeastTrainingPreview?.(true);
      state.habitHistory = null;
      state.habitReport = null;
      state.habitProgress = null;
      progressCache.clear();
      reportGeneration++;
      historyGeneration++;
      state.habitProgressLoading = false;
      state.habitHistoryLoading = false;
    }
    return result;
  }
  async function manageHabit(view, operation) {
    const result = await save(
      { operation, habitId: view.habit.id, version: view.habit.version },
      { keepSheet: true, silent: true, reconciled: true },
    );
    if (result) {
      await loadHabits();
      render();
    }
    return result;
  }
  async function archiveHabit(view) {
    const archived = habitArchived(view, state.habitData.day.day);
    const result = await manageHabit(view, archived ? 'restore' : 'archive');
    if (result) {
      sheet.close();
      toast(archived ? 'Đã khôi phục thói quen' : 'Đã lưu trữ thói quen');
    }
  }
  async function setHabitToday(view, included = false) {
    const result = await save(
      {
        operation: included ? 'resume' : 'defer',
        day: state.habitData.day.day,
        habitId: view.habit.id,
        version: view.habit.version,
      },
      { keepSheet: true, silent: true, reconciled: true },
    );
    if (result) {
      await loadHabits();
      if (sheet.open) sheet.close();
      render();
    }
  }
  function deleteHabits(ids) {
    const items = ids
      .map((id) => state.habitData.habits.find((view) => view.habit.id === id))
      .filter(Boolean);
    if (!items.length) return;
    openSheet('Xóa ' + (items.length === 1 ? 'thói quen này' : items.length + ' thói quen') + '?');
    sheet.classList.add('settings-sheet-open', 'habit-v2-sheet');
    const layout = el('div', undefined, 'settings-sheet-body habit-editor'),
      body = el('div', undefined, 'habit-form-fields hv2-confirm');
    const symbol = el('div', undefined, 'hv2-confirm-symbol');
    symbol.append(habitIcon('trash'));
    const names = el('ul', undefined, 'hv2-confirm-items');
    items.forEach((view) => names.append(el('li', view.definition.name)));
    body.append(
      symbol,
      el('p', 'Thói quen và lịch sử ghi nhận sẽ bị xóa. Lời nhắc liên quan cũng sẽ dừng.'),
      names,
      el(
        'p',
        'Không thể hoàn tác. Phần thưởng đã nhận được giữ nguyên; cam kết đã phát sinh vẫn được tính.',
        'hint',
      ),
    );
    const controls = el('div', undefined, 'actions habit-form-footer');
    controls.append(
      button('Hủy', () => sheet.close(), 'secondary'),
      button(
        'Xóa ' + items.length + ' thói quen',
        async () => {
          sheet.close();
          let removed = 0;
          for (const item of items) {
            const current = state.habitData.habits.find((view) => view.habit.id === item.habit.id);
            if (current && (await manageHabit(current, 'delete'))) {
              removed++;
              state.habitSelected?.delete(item.habit.id);
            } else break;
          }
          if (removed === items.length) {
            state.habitSelecting = false;
            state.habitSelected?.clear();
          }
          render();
          toast(
            removed === items.length
              ? 'Đã xóa ' + removed + ' thói quen'
              : 'Đã xóa ' + removed + '/' + items.length + '. Các mục chưa xóa vẫn được giữ lại.',
          );
        },
        'secondary danger',
      ),
    );
    layout.append(body, controls);
    sheetContent.append(layout);
  }
  async function saveLog(view, day, value, note, options = {}) {
    let before = { value: view.log.value, note: view.log.note, version: view.log.version };
    const result = await save(
      {
        operation: 'log',
        habitId: view.habit.id,
        version: view.habit.version,
        logVersion: before.version,
        day,
        value,
        note,
      },
      {
        silent: true,
        ...options,
        resolveInput: () => {
          if (options.retryInput) return options.retryInput;
          const current = state.habitData?.habits.find((item) => item.habit.id === view.habit.id);
          if (!current || state.habitData.day.day !== day)
            throw Error('Ngày ghi nhận đã thay đổi. Mở lại thói quen nhé.');
          if (
            (options.expectedLogVersion != null &&
              current.log.version !== options.expectedLogVersion) ||
            (options.expectedHabitVersion != null &&
              current.habit.version !== options.expectedHabitVersion)
          )
            throw Error('Dữ liệu đã thay đổi. Mở ghi nhận để điều chỉnh nhé.');
          before = { ...current.log };
          return {
            operation: 'log',
            habitId: current.habit.id,
            version: current.habit.version,
            logVersion: current.log.version,
            day,
            value,
            note,
          };
        },
        onRequest: (input) => {
          pendingLogs.set(input.habitId, { input, id: requestIdentity('habits', input) });
          persistLogs();
        },
        onCommitted: (_result, input) => {
          pendingLogs.delete(input.habitId);
          if (state.habitLogRecovery) delete state.habitLogRecovery[input.habitId];
          persistLogs();
        },
        onError: (error, input) => {
          if (!['NETWORK_UNCONFIRMED', 'OPERATION_NOT_CONFIRMED'].includes(error.code)) {
            pendingLogs.delete(view.habit.id);
            if (state.habitLogRecovery) delete state.habitLogRecovery[view.habit.id];
            persistLogs();
          }
          options.onError?.(error, input);
        },
      },
    );
    if (!result || runtime.refreshPending || !state.live) return result;
    const saved = state.habitData?.habits.find((item) => item.habit.id === view.habit.id);
    if (!saved || state.habitData.day.day !== day || saved.log.version !== before.version + 1)
      return result;
    if (options.undo) {
      toast(
        options.keptTicket > 0
          ? 'Đã hoàn tác ghi nhận. Vé đã nhận được giữ lại; hoàn thành lại hôm nay không thêm vé.'
          : 'Đã hoàn tác.',
      );
      return result;
    }
    const session = runtime.session;
    const version = saved.habit.version,
      logVersion = saved.log.version;
    toast(
      result.ticketAwarded > 0
        ? '+' + result.ticketAwarded + ' vé quay'
        : value >= view.definition.target / 100
          ? 'Đã đạt mục tiêu hôm nay.'
          : 'Đã cập nhật hôm nay.',
      {
        label: 'Hoàn tác',
        run: async () => {
          const current = state.habitData?.habits.find((item) => item.habit.id === view.habit.id);
          const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
          if (
            !state.live ||
            runtime.session !== session ||
            runtime.refreshPending ||
            state.habitLogIntents?.[view.habit.id] ||
            state.habitData?.day.day !== day ||
            now >= state.habitData.day.endAt ||
            current?.habit.version !== version ||
            current.log.version !== logVersion
          ) {
            toast('Dữ liệu đã thay đổi. Mở ghi nhận để điều chỉnh nhé.');
            return;
          }
          return queueHabitLog(current, day, before.value, before.note, {
            undo: true,
            keptTicket: result.ticketAwarded ?? 0,
            expectedLogVersion: logVersion,
            expectedHabitVersion: version,
          });
        },
      },
      { kind: 'success', key: 'habit-log', amount: result.ticketAwarded ?? 0 },
    );
    return result;
  }
  function toggleHabit(view) {
    if (!state.live) return saveLog(view, state.habitData.day.day, 0, view.log.note);
    const id = view.habit.id;
    if (state.habitLogRecovery?.[id]) return recoverHabitLog(id);
    const log = state.habitLogIntents?.[id] ?? view.log;
    return queueHabitLog(
      view,
      state.habitData.day.day,
      log.value >= view.definition.target ? 0 : view.definition.target,
      log.note,
    );
  }
  function queueHabitLog(view, day, value, note, options = {}) {
    const id = view.habit.id;
    const intent = {
      day,
      value,
      note,
      options,
      session: runtime.session,
    };
    (state.habitLogIntents ??= {})[id] = intent;
    logQueue.set(id, intent);
    persistLogs();
    render();
    return drainLogs();
  }
  async function drainLogs() {
    if (drainingLogs) return;
    drainingLogs = true;
    try {
      while (logQueue.size) {
        await waitForWrite(runtime);
        if (!logQueue.size) return;
        const next = [...logQueue].find(([id]) => !state.habitLogRecovery?.[id]);
        if (!next) return;
        const [id, intent] = next;
        if (intent.session !== runtime.session || !state.live || !state.loaded) {
          logQueue.clear();
          return;
        }
        const view = state.habitData?.habits.find((item) => item.habit.id === id);
        if (
          view &&
          view.log.value === intent.value &&
          view.log.note === intent.note &&
          state.habitData.day.day === intent.day
        ) {
          logQueue.delete(id);
          delete state.habitLogIntents[id];
          persistLogs();
          render();
          continue;
        }
        const failure = { error: null, input: null };
        const result =
          view && state.habitData.day.day === intent.day
            ? await saveLog(view, intent.day, intent.value / 100, intent.note, {
                ...intent.options,
                queue: true,
                keepSheet: true,
                handleError: true,
                onError: (error, input) => {
                  failure.error = error;
                  failure.input = input;
                },
              })
            : null;
        if (intent.session !== runtime.session) return;
        if (logQueue.get(id) === intent || (!result && !failure.error)) {
          logQueue.delete(id);
          delete state.habitLogIntents[id];
        }
        persistLogs();
        if (!result) {
          const unconfirmed =
            failure.error &&
            ['NETWORK_UNCONFIRMED', 'OPERATION_NOT_CONFIRMED'].includes(failure.error.code);
          if (unconfirmed && failure.input) (state.habitLogRecovery ??= {})[id] = failure.input;
          toast(
            unconfirmed
              ? 'Chưa xác nhận được lần lưu. Kiểm tra lại kết quả nhé.'
              : (failure.error?.message ?? 'Chưa lưu được. Trạng thái trước đã được giữ lại.'),
            unconfirmed ? { label: 'Thử lại', run: () => recoverHabitLog(id) } : undefined,
            { kind: 'error' },
          );
          if (
            failure.error?.code === 'HABIT_LOG_CHANGED' ||
            failure.error?.code === 'HABIT_CHANGED'
          )
            void loadHabits();
        }
        render();
      }
    } finally {
      drainingLogs = false;
    }
  }
  async function recoverHabitLog(id) {
    if (recoveringLogs.has(id)) return;
    const input = state.habitLogRecovery?.[id],
      session = runtime.session;
    if (!input) return;
    const view = state.habitData?.habits.find((item) => item.habit.id === id);
    if (!view) return;
    recoveringLogs.add(id);
    try {
      const result = await saveLog(view, input.day, input.value, input.note, {
        queue: true,
        keepSheet: true,
        retryInput: input,
      });
      if (result && session === runtime.session) {
        delete state.habitLogRecovery[id];
        render();
        void drainLogs();
      }
      return result;
    } finally {
      recoveringLogs.delete(id);
    }
  }
  function openHabitLog(view) {
    if (runtime.saving) {
      toast('Đang lưu thao tác trước…');
      return;
    }
    const logDay = state.habitData.day.day,
      unit = habitDisplayUnit(view);
    openSheet(view.definition.name);
    sheet.classList.add('settings-sheet-open', 'habit-v2-sheet');
    const form = el('form', undefined, 'settings-sheet-body habit-form habit-editor');
    const preview = el('span'),
      progress = el('p', undefined, 'hv2-log-progress');
    progress.append(preview, el('small', ' / ' + habitNumber(view.definition.target) + ' ' + unit));
    const date = el('p', undefined, 'hv2-log-context');
    form.append(progress, date);
    const amount = field(
      (view.definition.metric === 'duration' ? 'Nhập chính xác' : 'Tổng hôm nay') +
        ' (' +
        unit +
        ')',
      'number',
      String(view.log.value / 100),
    );
    amount.input.min = '0';
    amount.input.max = '1000000';
    amount.input.step = '0.01';
    amount.input.inputMode = 'decimal';
    amount.input.name = 'amount';
    let range, rangeMax, less, more;
    const sync = () => {
      const value = amount.input.valueAsNumber,
        valid = Number.isFinite(value) && value >= 0 && value <= 1000000;
      preview.textContent = valid ? habitNumber(Math.round(value * 100)) : '—';
      date.textContent =
        'Hôm nay · ' +
        habitDate(logDay) +
        (valid && value * 100 >= view.definition.target ? ' · Đã đạt mục tiêu' : '');
      if (range && valid) {
        range.max = String(Math.max(Number(range.max), value));
        range.step = Number.isInteger(value) && Number.isInteger(Number(range.max)) ? '1' : '0.01';
        range.value = String(value);
        range.style.setProperty('--fill', (value / Number(range.max)) * 100 + '%');
        range.setAttribute('aria-valuetext', preview.textContent + ' phút');
        rangeMax.textContent = habitNumber(Number(range.max) * 100) + ' phút';
      }
      if (less) less.disabled = !valid || value <= 0;
      if (more) more.disabled = !valid || value >= 1000000;
    };
    if (view.definition.metric === 'duration') {
      range = el('input', undefined, 'hv2-duration-range');
      range.type = 'range';
      range.min = '0';
      range.max = String(Math.max(view.definition.target, view.log.value) / 100);
      range.setAttribute('aria-label', 'Thời lượng ' + view.definition.name);
      range.addEventListener('input', () => {
        amount.input.value = range.value;
        sync();
      });
      const block = el('div', undefined, 'hv2-log-range-block'),
        labels = el('div', undefined, 'hv2-range-labels');
      rangeMax = el('span');
      labels.append(el('span', '0 phút'), rangeMax);
      block.append(range, labels);
      form.append(block);
    } else if (view.definition.metric === 'quantity') {
      const counter = el('div', undefined, 'habit-counter');
      const step = (change) => {
        const next = Math.max(
          0,
          Math.min(1000000, Math.round(((amount.input.valueAsNumber || 0) + change) * 100) / 100),
        );
        amount.input.value = String(next);
        sync();
      };
      less = button('−', () => step(-1));
      more = button('+1', () => step(1));
      less.setAttribute('aria-label', 'Giảm 1 ' + unit);
      more.setAttribute('aria-label', 'Thêm 1 ' + unit);
      counter.append(less, amount.input, more);
      amount.wrap.append(counter);
    }
    const note = field('Ghi chú', 'text', view.log.note, false);
    note.input.maxLength = 300;
    const extra = el('details', undefined, 'habit-form-extra');
    extra.open = !!view.log.note;
    extra.append(el('summary', 'Thêm ghi chú'), note.wrap);
    const total = el('div', undefined, 'hv2-log-total');
    total.append(
      el('p', 'Mục tiêu ' + habitNumber(view.definition.target) + ' ' + unit),
      button(
        'Đủ mục tiêu',
        () => {
          amount.input.value = String(view.definition.target / 100);
          amount.input.dispatchEvent(new Event('input'));
        },
        'text-button',
      ),
    );
    form.append(amount.wrap, total, extra);
    amount.input.addEventListener('input', sync);
    sync();
    const controls = el('div', undefined, 'actions habit-form-footer'),
      submit = el('button', 'Lưu hôm nay', 'primary');
    submit.type = 'submit';
    const fields = el('div', undefined, 'habit-form-fields');
    fields.append(...form.childNodes);
    controls.append(submit);
    form.append(fields, controls);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await saveLog(view, logDay, amount.input.valueAsNumber, note.input.value);
    });
    sheetContent.append(form);
  }
  function openHabitDetails(view) {
    openSheet(view.definition.name);
    sheet.classList.add('settings-sheet-open', 'habit-v2-sheet');
    const day = state.habitData.day.day,
      session = runtime.session,
      { definition, log } = view,
      unit = habitDisplayUnit(view),
      archived = habitArchived(view, day),
      needed = habitNeeded(view, day),
      met = log.value >= definition.target;
    const layout = el('div', undefined, 'settings-sheet-body habit-editor habit-detail hv2-detail'),
      body = el('div', undefined, 'habit-form-fields');
    const today = el('div', undefined, 'hv2-detail-today');
    today.append(
      el(
        'p',
        archived
          ? 'Đã lưu trữ'
          : 'Hôm nay · ' + habitDate(day) + (!needed ? ' · Không cần làm hôm nay' : ''),
        'hv2-detail-caption',
      ),
    );
    if (!archived) {
      const number = el(
        'div',
        definition.metric === 'check'
          ? met
            ? 'Đã hoàn thành'
            : 'Chưa hoàn thành'
          : habitNumber(log.value),
        'hv2-detail-number habit-detail-progress',
      );
      if (definition.metric !== 'check') {
        number.append(el('small', ' / ' + habitNumber(definition.target) + ' ' + unit));
        const progress = el('progress', undefined, 'hv2-detail-progress');
        progress.max = definition.target;
        progress.value = Math.min(log.value, definition.target);
        progress.setAttribute('aria-label', 'Tiến độ ' + definition.name);
        today.append(number, progress);
      } else today.append(number);
      const status = met
        ? 'Đã đạt mục tiêu hôm nay.'
        : definition.cadence.kind === 'weekly'
          ? 'Tuần này ' +
            (view.preview?.period.completedDays.length ?? 0) +
            '/' +
            definition.cadence.quota +
            ' ngày.'
          : definition.metric !== 'check'
            ? 'Còn ' +
              habitNumber(Math.max(0, definition.target - log.value)) +
              ' ' +
              unit +
              ' để đạt mục tiêu.'
            : 'Một lần thực hiện là đủ.';
      today.append(el('p', status, 'hv2-detail-status'));
    } else
      today.append(
        el('p', 'Đã dừng theo dõi và nhắc giờ. Lịch sử vẫn được giữ.', 'hv2-detail-status'),
      );
    body.append(today);
    const info = el('dl', undefined, 'hv2-detail-info');
    for (const [label, value] of [
      [
        'Mục tiêu',
        definition.metric === 'check'
          ? 'Một lần thực hiện'
          : habitNumber(definition.target) + ' ' + unit,
      ],
      ['Lặp lại', cadenceLabel(definition.cadence)],
      [
        'Nhắc giờ',
        view.reminderTime
          ? view.reminderTime + (archived ? ' · Đã dừng' : !needed ? ' · Hôm nay nghỉ' : '')
          : 'Không đặt',
      ],
    ]) {
      const row = el('div');
      row.append(el('dt', label), el('dd', value));
      info.append(row);
    }
    body.append(info);
    if (view.pending)
      body.append(
        el(
          'p',
          'Từ ' +
            habitDate(view.pending.fromDay) +
            ': ' +
            view.pending.definition.name +
            ' · ' +
            (view.pending.definition.metric === 'check'
              ? ''
              : habitNumber(view.pending.definition.target) +
                ' ' +
                view.pending.definition.unit +
                ' · ') +
            cadenceLabel(view.pending.definition.cadence),
          'hv2-detail-note',
        ),
      );
    for (const note of [definition.note, log.note])
      if (note) body.append(el('p', note, 'habit-note hv2-detail-note'));
    const history = el('details', undefined, 'hv2-detail-history'),
      historyBody = el('div');
    history.append(el('summary', '7 ngày gần đây'), historyBody);
    let historyLoaded = false,
      historyLoading = false;
    const load = async () => {
      if (historyLoaded || historyLoading) return;
      historyLoading = true;
      historyBody.replaceChildren(el('p', 'Đang tải…', 'hint'));
      try {
        const report = state.live
          ? await liveRequest(
              'habit-report?' +
                new URLSearchParams({
                  from: String(day - 6),
                  to: String(day - 1),
                  habitId: view.habit.id,
                }),
            )
          : { byHabit: [] };
        if (session !== runtime.session || !historyBody.isConnected) return;
        const days = new Map(
          (report.byHabit.find((item) => item.habitId === view.habit.id)?.days ?? []).map(
            (item) => [item.day, item.status],
          ),
        );
        days.set(day, archived || !needed ? 'neutral' : met ? 'achieved' : 'missed');
        const week = el('div', undefined, 'hv2-week');
        for (let current = day - 6; current <= day; current++) {
          const status = days.get(current),
            achieved = status === 'achieved',
            missed = status === 'missed';
          const label = achieved
            ? 'Đạt mục tiêu'
            : missed
              ? current === day
                ? 'Chưa đạt hôm nay'
                : 'Chưa đạt'
              : 'Ngoài lịch / nghỉ';
          const cell = el('div', undefined, 'hv2-week-cell' + (achieved ? ' is-met' : ''));
          cell.setAttribute('aria-label', habitDate(current) + ': ' + label);
          cell.append(el('span', habitDate(current)), el('b', achieved ? '✓' : missed ? '·' : '–'));
          week.append(cell);
        }
        historyBody.replaceChildren(
          week,
          el('p', '✓ Đạt mục tiêu   · Chưa đạt   – Ngoài lịch / nghỉ', 'hint'),
        );
        historyLoaded = true;
      } catch (error) {
        if (historyBody.isConnected)
          historyBody.replaceChildren(
            el('p', error.message, 'hint'),
            button('Thử lại', load, 'text-button'),
          );
      } finally {
        historyLoading = false;
      }
    };
    history.addEventListener('toggle', () => {
      if (history.open) void load();
    });
    body.append(history);
    if (!archived && needed)
      body.append(
        button(
          view.slot ? 'Chỉnh thời gian · ' + view.slot.minutes + ' phút' : 'Xếp thời gian',
          () => openHabitSlot(view),
          'text-button hv2-slot-link',
        ),
      );
    const manage = el('div', undefined, 'hv2-manage');
    const link = (label, icon, action, danger = false) => {
      const control = button('', action, danger ? 'danger' : 'text-button');
      control.append(habitIcon(icon), document.createTextNode(label));
      manage.append(control);
    };
    if (!archived) {
      link('Chỉnh sửa', 'edit', () => openHabit(view));
      link('Lưu trữ', 'archive', () => archiveHabit(view));
    }
    link('Xóa thói quen', 'trash', () => deleteHabits([view.habit.id]), true);
    body.append(manage);
    const footer = el('div', undefined, 'actions habit-form-footer hv2-detail-footer');
    if (archived) footer.append(button('Khôi phục thói quen', () => archiveHabit(view), 'primary'));
    else if (!needed && view.preview?.reason !== 'archived')
      footer.append(button('Làm hôm nay', () => setHabitToday(view, true), 'primary'));
    else if (needed) {
      if (definition.cadence.kind === 'weekly' && !met) {
        const options = el('details', undefined, 'hv2-row-options'),
          menu = el('div', undefined, 'hv2-menu-items');
        options.append(el('summary', 'Khác'));
        menu.append(button('Để hôm khác', () => setHabitToday(view), 'text-button'));
        options.append(menu);
        footer.append(options);
      }
      footer.append(
        button(
          definition.metric === 'check'
            ? met
              ? 'Bỏ hoàn thành hôm nay'
              : 'Hoàn thành hôm nay'
            : 'Ghi nhận hôm nay',
          () => {
            if (definition.metric !== 'check') return openHabitLog(view);
            void toggleHabit(view);
            sheet.close();
          },
          'primary',
        ),
      );
    }
    layout.append(body);
    if (footer.childElementCount) layout.append(footer);
    sheetContent.append(layout);
  }
  function openHabitSlot(view) {
    if (runtime.saving) {
      toast('Đang lưu thao tác trước…');
      return;
    }
    const day = { ...state.habitData.day };
    openSheet('Thời gian cho ' + view.definition.name);
    sheet.classList.add('settings-sheet-open');
    const form = el('form', undefined, 'settings-sheet-body habit-form');
    const clock = (at) =>
      new Date(at).toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      });
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    const start = field(
      'Bắt đầu · ' + habitDate(day.day),
      'time',
      clock(view.slot?.startAt ?? Math.ceil(now / 300000) * 300000),
    );
    start.input.step = '300';
    const duration = field(
      'Dành bao nhiêu phút?',
      'number',
      String(
        view.slot?.minutes ??
          (view.definition.metric === 'duration'
            ? Math.min(240, Math.max(5, Math.ceil(view.definition.target / 500) * 5))
            : 20),
      ),
    );
    duration.input.min = '5';
    duration.input.max = '240';
    duration.input.step = '5';
    form.append(
      start.wrap,
      duration.wrap,
      el(
        'p',
        'Chỉ xếp vào khoảng còn trống, giữ nguyên lịch công việc. Xếp giờ không tự ghi nhận đã làm và không bật thêm lời nhắc.',
        'hint',
      ),
    );
    const controls = el('div', undefined, 'actions'),
      submit = el('button', 'Lưu thời gian', 'primary');
    submit.type = 'submit';
    controls.append(submit);
    if (view.slot)
      controls.append(
        button(
          'Bỏ khỏi lịch hôm nay',
          () =>
            save({
              operation: 'remove_slot',
              habitId: view.habit.id,
              version: view.habit.version,
              day: day.day,
            }),
          'text-button',
        ),
      );
    form.append(controls);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const [hour, minute] = start.input.value.split(':').map(Number);
      const base = Math.floor((day.startAt + 25200000) / 86400000) * 86400000 - 25200000;
      let startAt = base + (hour * 60 + minute) * 60000;
      if (startAt < day.startAt) startAt += 86400000;
      save({
        operation: 'slot',
        habitId: view.habit.id,
        version: view.habit.version,
        day: day.day,
        startAt,
        minutes: duration.input.valueAsNumber,
      });
    });
    sheetContent.append(form);
  }
  async function showHabitInList(habitId) {
    state.tab = 'habits';
    state.habitPanel = 'today';
    state.habitFilter = 'active';
    render();
    await loadHabits();
    document.querySelector('[data-habit-id="' + CSS.escape(habitId) + '"]')?.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    });
  }
  function openHabit(view) {
    if (runtime.saving) {
      toast('Đang lưu thao tác trước…');
      return;
    }
    const initial = view?.pending?.definition ?? view?.definition;
    openSheet(view ? 'Chỉnh thói quen' : 'Thêm thói quen');
    sheet.classList.add('settings-sheet-open', 'habit-v2-sheet');
    const form = el('form', undefined, 'settings-sheet-body habit-form habit-editor'),
      name = field('Tên thói quen', 'text', initial?.name ?? '');
    name.input.name = 'name';
    name.input.maxLength = 100;
    name.input.placeholder = 'Ví dụ: Đọc sách';
    const makeSelect = (label, options, value) => {
      const wrap = el('label', label, 'form-field'),
        input = el('select');
      input.setAttribute('aria-label', label);
      for (const [id, name] of options) {
        const option = el('option', name);
        option.value = id;
        input.append(option);
      }
      input.value = value;
      wrap.append(input);
      return { wrap, input };
    };
    const metric = makeSelect(
      'Cách ghi nhận',
      [
        ['check', 'Tích hoàn thành'],
        ['duration', 'Thời lượng · phút'],
        ['quantity', 'Số lượng'],
      ],
      initial?.metric ?? 'check',
    );
    const target = field('Mục tiêu mỗi ngày đạt', 'number', String((initial?.target ?? 100) / 100));
    target.input.min = '0.01';
    target.input.max = '1000000';
    target.input.step = '0.01';
    target.input.inputMode = 'decimal';
    target.input.name = 'target';
    const unit = field(
      'Đơn vị',
      'text',
      initial?.metric === 'quantity' ? initial.unit : 'ly',
      false,
    );
    unit.input.placeholder = 'ly, trang, km…';
    unit.input.maxLength = 20;
    unit.input.name = 'unit';
    const cadence = makeSelect(
      'Lặp lại',
      [
        ['daily', 'Mỗi ngày'],
        ['weekdays', 'Chọn ngày trong tuần'],
        ['weekly', 'Linh hoạt theo tuần'],
      ],
      initial?.cadence.kind ?? 'daily',
    );
    const quota = field('Số ngày đạt mỗi tuần', 'number', String(initial?.cadence.quota ?? 3));
    quota.input.min = '1';
    quota.input.max = '7';
    quota.input.step = '1';
    const weekdaySet = new Set(initial?.cadence.weekdays ?? [0, 2, 4]),
      days = el('fieldset', undefined, 'habit-weekdays');
    days.append(el('legend', 'Những ngày cam kết'));
    habitWeekdays.forEach((label, index) => {
      const control = button(
        index === 6 ? 'CN' : 'T' + (index + 2),
        () => {
          weekdaySet.has(index) ? weekdaySet.delete(index) : weekdaySet.add(index);
          control.setAttribute('aria-pressed', String(weekdaySet.has(index)));
        },
        'secondary',
      );
      control.setAttribute('aria-label', label);
      control.setAttribute('aria-pressed', String(weekdaySet.has(index)));
      days.append(control);
    });
    const note = field('Ghi chú', 'text', initial?.note ?? '', false);
    const noteInput = el('textarea');
    noteInput.value = note.input.value;
    noteInput.maxLength = 300;
    noteInput.rows = 3;
    noteInput.placeholder = 'Điều cậu muốn nhớ…';
    note.input.replaceWith(noteInput);
    note.input = noteInput;
    const remind = field('Giờ nhắc (tùy chọn)', 'time', view?.reminderTime ?? '', false);
    const explanation = el('p', '', 'hint habit-form-explanation');
    const targetRow = el('div', undefined, 'hv2-field-row');
    targetRow.append(target.wrap, unit.wrap);
    const drafts = { check: '1', duration: '20', quantity: '8' };
    let previousMetric = metric.input.value;
    drafts[previousMetric] = target.input.value;
    const update = () => {
      if (previousMetric !== metric.input.value) {
        drafts[previousMetric] = target.input.value;
        previousMetric = metric.input.value;
        target.input.value = drafts[previousMetric];
      }
      targetRow.hidden = metric.input.value === 'check';
      target.input.required = metric.input.value !== 'check';
      target.input.disabled = metric.input.value === 'check';
      target.wrap.firstChild.textContent =
        metric.input.value === 'duration' ? 'Mục tiêu mỗi ngày (phút)' : 'Mục tiêu mỗi ngày';
      unit.wrap.hidden = metric.input.value !== 'quantity';
      unit.input.required = metric.input.value === 'quantity';
      unit.input.disabled = metric.input.value !== 'quantity';
      days.hidden = cadence.input.value !== 'weekdays';
      quota.wrap.hidden = cadence.input.value !== 'weekly';
      quota.input.required = cadence.input.value === 'weekly';
      quota.input.disabled = cadence.input.value !== 'weekly';
      explanation.textContent =
        cadence.input.value === 'weekly'
          ? 'Làm vào bất kỳ ngày nào, mỗi ngày tính một lần. Cam kết mới áp dụng từ thứ Hai kế tiếp; hôm nay vẫn có thể theo dõi.'
          : 'Cam kết mới áp dụng từ ngày sinh hoạt kế tiếp. Mục tiêu hôm nay giữ nguyên.';
    };
    metric.input.addEventListener('change', update);
    cadence.input.addEventListener('change', update);
    update();
    const extra = el('details', undefined, 'habit-form-extra');
    extra.open = !!(initial?.note || view?.reminderTime);
    extra.append(el('summary', 'Nhắc giờ & ghi chú'), remind.wrap, note.wrap);
    form.append(
      name.wrap,
      metric.wrap,
      targetRow,
      cadence.wrap,
      days,
      quota.wrap,
      explanation,
      extra,
    );
    const controls = el('div', undefined, 'actions habit-form-footer'),
      submit = el('button', view ? 'Lưu thay đổi' : 'Thêm thói quen', 'primary');
    submit.type = 'submit';
    controls.append(
      button('Hủy', () => (view ? openHabitDetails(view) : sheet.close()), 'secondary'),
      submit,
    );
    const fields = el('div', undefined, 'habit-form-fields');
    fields.append(...form.childNodes);
    form.append(fields, controls);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (cadence.input.value === 'weekdays' && !weekdaySet.size) {
        toast('Chọn ít nhất một ngày nhé.');
        return;
      }
      const definition = {
        name: name.input.value,
        metric: metric.input.value,
        target: metric.input.value === 'check' ? 1 : target.input.valueAsNumber,
        unit: metric.input.value === 'duration' ? 'phút' : unit.input.value,
        cadence:
          cadence.input.value === 'weekly'
            ? { kind: 'weekly', quota: quota.input.valueAsNumber }
            : cadence.input.value === 'weekdays'
              ? { kind: 'weekdays', weekdays: [...weekdaySet].sort() }
              : { kind: 'daily' },
        note: note.input.value,
      };
      const reminderTime = remind.input.value || null;
      await save(
        view
          ? {
              operation: 'update',
              habitId: view.habit.id,
              version: view.habit.version,
              definition,
              reminderTime,
            }
          : { operation: 'create', definition, reminderTime },
      );
    });
    sheetContent.append(form);
  }
  function openHabitExport() {
    const span = state.habitReportSpan ?? 30;
    openSheet('Xuất dữ liệu thói quen');
    sheetContent.append(
      el(
        'p',
        span +
          ' ngày theo bộ lọc hiện tại. CSV để đọc trong bảng tính; JSON giữ lịch cam kết và dữ liệu chi tiết.',
        'hint',
      ),
      button('Tải CSV', () => exportHabits('csv'), 'secondary'),
      button('Tải JSON', () => exportHabits('json'), 'secondary'),
    );
  }
  async function exportHabits(format = 'csv') {
    if (!state.live || !state.habitData) return;
    if (!['csv', 'json'].includes(format)) return;
    let data = state.habitData;
    const revision = runtime.revision,
      to = data.day.day,
      span = state.habitReportSpan ?? 30,
      rows = [];
    const filters = {
      habitId: state.habitHistoryId ?? '',
      status: state.habitHistoryStatus ?? 'all',
    };
    let before = null;
    try {
      if (format === 'json') {
        data = { ...data, habits: [...data.habits] };
        let cursor = data.archivePage?.nextCursor;
        if (filters.habitId && data.habits.some((view) => view.habit.id === filters.habitId))
          cursor = null;
        while (cursor != null) {
          const page = await liveRequest('habits?archived=1&offset=' + cursor);
          if (revision !== runtime.revision || !state.live) return;
          if (page.day.day !== to)
            throw Error('Ngày sinh hoạt đã đổi. Tải lại trước khi xuất dữ liệu.');
          data.habits = [
            ...new Map(
              [...data.habits, ...page.habits].map((view) => [view.habit.id, view]),
            ).values(),
          ];
          if (filters.habitId && data.habits.some((view) => view.habit.id === filters.habitId))
            break;
          cursor = page.archivePage?.nextCursor;
          if (data.habits.length > 3000) throw Error('Chọn một thói quen để xuất phạm vi nhỏ hơn.');
        }
      }
      do {
        const params = new URLSearchParams({
          from: String(to - span + 1),
          to: String(to),
          limit: '100',
        });
        if (filters.habitId) params.set('habitId', filters.habitId);
        if (filters.status !== 'all') params.set('status', filters.status);
        if (before) params.set('before', before);
        const page = await liveRequest('habit-history?' + params);
        rows.push(...page.rows);
        before = page.next;
        if (revision !== runtime.revision || !state.live) return;
      } while (before && rows.length < 3000);
      if (before) {
        toast('Dữ liệu vượt giới hạn một lần xuất. Chọn khoảng ngắn hơn hoặc một thói quen nhé.');
        return;
      }
      const header = ['Ngày', 'Thói quen', 'Đã làm', 'Mục tiêu', 'Đơn vị', 'Trạng thái', 'Ghi chú'];
      const csv = [
        header,
        ...rows.map((row) => [
          new Date(row.day * 86400000).toISOString().slice(0, 10),
          row.name,
          row.value / 100,
          row.definition.target / 100,
          row.definition.unit,
          row.status,
          row.note,
        ]),
      ]
        .map((row) => row.map(safeCsvCell).join(','))
        .join('\r\n');
      const content =
        format === 'json'
          ? JSON.stringify(
              habitJsonExport(data, rows, { from: to - span + 1, to }, filters),
              null,
              2,
            ) + '\n'
          : '\uFEFF' + csv;
      const url = URL.createObjectURL(
          new Blob([content], {
            type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
          }),
        ),
        link = el('a');
      link.href = url;
      link.download = 'thoi-quen-' + span + '-ngay.' + format;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('Đã xuất lịch sử ' + span + ' ngày.');
    } catch (error) {
      toast(error.message);
    }
  }
  return {
    archiveHabit,
    setHabitToday,
    deleteHabits,
    moveHabit,
    loadHabits,
    loadMoreHabits,
    openHabit,
    openHabitDetails,
    openHabitLog,
    openHabitSlot,
    showHabitInList,
    toggleHabit,
    recoverHabitLog,
    resetHabitLogs,
    setHabitFilter,
    showHabitPanel,
    loadHabitHistory,
    setHabitReportSpan,
    setHabitHistoryStatus,
    exportHabits,
    openHabitExport,
  };
}
