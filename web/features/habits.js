import { liveRequest, requestIdentity } from '../core/http.js';
import {
  cadenceLabel,
  habitDate,
  habitWeekdays,
  habitFacts,
  habitNumber,
  safeCsvCell,
} from '../models/habits.js';
import { button, el, field } from '../ui/dom.js';
import { habitJsonExport } from '../models/habit-export.js';
import { prefersReducedMotion } from '../core/experience.js';
import { waitForWrite } from '../core/state.js';
const pendingLogKey = 'minh-anh-habit-pending-v1';
const queuedLogKey = 'minh-anh-habit-queue-v1';

export function createHabitActions(context) {
  const { state, runtime, render, toast, sheet, sheetContent, openSheet, performLive, confirm } =
    context;
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
    render();
    if (panel === 'history') loadHabitHistory(state.habitHistoryId ?? '');
    if (panel === 'progress') loadHabitProgress();
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
    const logDay = state.habitData.day.day;
    openSheet(view.definition.name);
    sheet.classList.add('settings-sheet-open');
    const form = el('form', undefined, 'settings-sheet-body habit-form habit-editor');
    form.append(
      el(
        'p',
        cadenceLabel(view.definition.cadence) + ' · hôm nay ' + habitDate(state.habitData.day.day),
        'hint',
      ),
    );
    const amount = field(
      'Tổng đã làm hôm nay (' + view.definition.unit + ')',
      'number',
      String(view.log.value / 100),
    );
    amount.input.min = '0';
    amount.input.max = '1000000';
    amount.input.step = '0.01';
    amount.input.inputMode = 'decimal';
    amount.input.name = 'amount';
    if (view.definition.metric === 'duration') {
      const range = el('input');
      range.type = 'range';
      range.min = '0';
      range.step = '0.01';
      range.setAttribute('aria-label', 'Thời lượng ' + view.definition.name);
      const sync = () => {
        range.max = String(Math.max(view.definition.target / 100, amount.input.valueAsNumber || 0));
        range.value = amount.input.value;
      };
      sync();
      range.addEventListener('input', () => {
        amount.input.value = range.value;
      });
      amount.input.addEventListener('input', sync);
      form.append(el('p', 'Kéo để chọn thời lượng, hoặc nhập số chính xác.', 'hint'), range);
    } else if (view.definition.metric === 'quantity') {
      const counter = el('div', undefined, 'habit-counter');
      const step = (change) => {
        const next = Math.max(
          0,
          Math.min(1000000, Math.round(((amount.input.valueAsNumber || 0) + change) * 100) / 100),
        );
        amount.input.value = String(next);
      };
      const less = button('−', () => step(-1)),
        more = button('+1', () => step(1));
      less.setAttribute('aria-label', 'Giảm 1 ' + view.definition.unit);
      more.setAttribute('aria-label', 'Thêm 1 ' + view.definition.unit);
      counter.append(less, amount.input, more);
      amount.wrap.append(counter);
    }
    const note = field('Ghi chú', 'text', view.log.note, false);
    note.input.maxLength = 300;
    const extra = el('details', undefined, 'habit-form-extra');
    extra.append(el('summary', 'Thêm ghi chú'), note.wrap);
    form.append(
      amount.wrap,
      el(
        'p',
        'Lưu sẽ thay tổng hôm nay. Đạt ' +
          view.definition.target / 100 +
          ' ' +
          view.definition.unit +
          ' mới góp tiến độ.',
        'hint',
      ),
      extra,
    );
    const controls = el('div', undefined, 'actions habit-form-footer'),
      submit = el('button', 'Lưu', 'primary');
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
    sheet.classList.add('settings-sheet-open');
    const body = el('div', undefined, 'settings-sheet-body habit-detail');
    for (const fact of habitFacts(view, state.habitData.day.day))
      body.append(el('p', fact.text, fact.key.endsWith('Note') ? 'habit-note' : 'hint'));
    if (view.definition.metric !== 'check')
      body.append(
        el(
          'p',
          'Hôm nay ' +
            view.log.value / 100 +
            ' / ' +
            view.definition.target / 100 +
            ' ' +
            view.definition.unit,
          'habit-detail-progress',
        ),
      );
    if (view.definition.metric === 'check')
      body.append(
        el(
          'p',
          view.log.value >= view.definition.target ? 'Đã đạt hôm nay' : 'Chưa đạt hôm nay',
          'habit-detail-progress',
        ),
      );
    if (view.pending)
      body.append(
        el(
          'p',
          'Sắp áp dụng: ' +
            view.pending.definition.name +
            ' · ' +
            cadenceLabel(view.pending.definition.cadence) +
            (view.pending.definition.metric === 'check'
              ? ''
              : ' · ' +
                habitNumber(view.pending.definition.target) +
                ' ' +
                view.pending.definition.unit),
          'hint',
        ),
      );
    const archived =
      view.habit.archivedFrom !== null && state.habitData.day.day >= view.habit.archivedFrom;
    if (!archived) {
      body.append(
        button(
          'Điều chỉnh hôm nay',
          () => (view.definition.metric === 'check' ? toggleHabit(view) : openHabitLog(view)),
          'secondary',
        ),
        button(
          view.slot ? 'Chỉnh thời gian' : 'Xếp thời gian',
          () => openHabitSlot(view),
          'secondary',
        ),
      );
    }
    body.append(button('Chỉnh thói quen', () => openHabit(view), 'text-button'));
    sheetContent.append(body);
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
    sheet.classList.add('settings-sheet-open');
    const form = el('form', undefined, 'settings-sheet-body habit-form habit-editor'),
      name = field('Tên thói quen', 'text', initial?.name ?? '');
    name.input.name = 'name';
    name.input.maxLength = 100;
    const makeSelect = (label, options, value) => {
      const wrap = el('fieldset', undefined, 'habit-choice-field'),
        input = el('select');
      wrap.append(el('legend', label));
      input.hidden = true;
      input.setAttribute('aria-label', label);
      const choices = el('div', undefined, 'habit-choices');
      for (const [id, name] of options) {
        const option = el('option', name);
        option.value = id;
        input.append(option);
      }
      const sync = () => {
        for (const control of choices.children)
          control.setAttribute('aria-pressed', String(control.dataset.value === input.value));
      };
      for (const [id, name] of options) {
        const control = button(name, () => {
          input.value = id;
          input.dispatchEvent(new Event('change'));
        });
        control.dataset.value = id;
        choices.append(control);
      }
      input.value = value;
      input.addEventListener('change', sync);
      sync();
      wrap.append(input, choices);
      return { wrap, input };
    };
    const metric = makeSelect(
      'Cách ghi nhận',
      [
        ['check', 'Đánh dấu'],
        ['duration', 'Thời lượng'],
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
    const unit = field('Đơn vị (trang, ly, km…)', 'text', initial?.unit ?? '', false);
    unit.input.maxLength = 20;
    unit.input.name = 'unit';
    const cadence = makeSelect(
      'Lịch lặp',
      [
        ['daily', 'Hằng ngày'],
        ['weekdays', 'Chọn thứ'],
        ['weekly', 'X ngày/tuần'],
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
    note.input.maxLength = 300;
    const remind = field('Giờ nhắc (tùy chọn)', 'time', view?.reminderTime ?? '', false);
    const explanation = el('p', '', 'hint habit-form-explanation');
    const targetRange = el('input');
    targetRange.type = 'range';
    targetRange.min = '0.01';
    targetRange.step = '0.01';
    targetRange.setAttribute('aria-label', 'Mục tiêu thời lượng');
    const syncTarget = () => {
      targetRange.max = String(Math.max(60, target.input.valueAsNumber || 0));
      targetRange.value = target.input.value;
    };
    targetRange.addEventListener('input', () => {
      target.input.value = targetRange.value;
    });
    target.input.addEventListener('input', syncTarget);
    syncTarget();
    const drafts = { check: '1', duration: '20', quantity: '8' };
    let previousMetric = metric.input.value;
    drafts[previousMetric] = target.input.value;
    const update = () => {
      if (previousMetric !== metric.input.value) {
        drafts[previousMetric] = target.input.value;
        previousMetric = metric.input.value;
        target.input.value = drafts[previousMetric];
        syncTarget();
      }
      target.wrap.hidden = metric.input.value === 'check';
      target.input.required = metric.input.value !== 'check';
      target.input.disabled = metric.input.value === 'check';
      targetRange.hidden = metric.input.value !== 'duration';
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
    extra.append(
      el('summary', 'Nhắc giờ & ghi chú'),
      note.wrap,
      remind.wrap,
      el('p', 'Giờ nhắc cập nhật ngay và vẫn gửi khi ngủ hoặc tập trung.', 'hint'),
    );
    form.append(
      name.wrap,
      metric.wrap,
      target.wrap,
      targetRange,
      unit.wrap,
      cadence.wrap,
      days,
      quota.wrap,
      explanation,
      extra,
    );
    const controls = el('div', undefined, 'actions habit-form-footer'),
      submit = el('button', view ? 'Lưu thay đổi' : 'Thêm thói quen', 'primary');
    submit.type = 'submit';
    const archived = view && view.habit.archivedFrom !== null;
    if (!archived) controls.append(submit);
    if (view)
      controls.append(
        button(
          archived ? 'Khôi phục' : 'Lưu trữ',
          () => {
            const from =
              initial.cadence.kind === 'weekly'
                ? state.habitData.day.day - ((state.habitData.day.day + 3) % 7) + 7
                : state.habitData.day.day + 1;
            confirm(
              archived ? 'Khôi phục thói quen?' : 'Lưu trữ thói quen?',
              (archived ? 'Hoạt động lại' : 'Ngừng theo dõi') +
                ' từ ' +
                habitDate(from) +
                '. Lịch sử được giữ; cam kết đang có vẫn tính đến mốc này.',
              () =>
                save({
                  operation: archived ? 'restore' : 'archive',
                  habitId: view.habit.id,
                  version: view.habit.version,
                }),
            );
          },
          'text-button',
        ),
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
