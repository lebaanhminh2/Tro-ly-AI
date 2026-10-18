import { liveRequest } from '../core/http.js';
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

export function createHabitActions(context) {
  const { state, runtime, render, toast, sheet, sheetContent, openSheet, performLive, confirm } =
    context;
  let loadGeneration = 0,
    reportGeneration = 0,
    historyGeneration = 0;
  const progressCache = new Map(),
    progressRequests = new Map();
  let loading, loadingRevision;
  function loadHabits() {
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
      if (state.habitPanel === 'progress') loadHabitProgress();
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
  async function saveLog(view, day, value, note) {
    const before = { value: view.log.value, note: view.log.note, version: view.log.version };
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
      { silent: true },
    );
    if (!result || runtime.refreshPending || !state.live) return result;
    const revision = runtime.revision,
      saved = state.habitData?.habits.find((item) => item.habit.id === view.habit.id);
    if (!saved || state.habitData.day.day !== day || saved.log.version !== before.version + 1)
      return result;
    const version = saved.habit.version,
      logVersion = saved.log.version;
    const expires = Date.now() + 6000;
    toast(
      value >= view.definition.target / 100 ? 'Đã đạt mục tiêu hôm nay.' : 'Đã cập nhật hôm nay.',
      {
        label: 'Hoàn tác',
        run: async () => {
          const current = state.habitData?.habits.find((item) => item.habit.id === view.habit.id);
          const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
          if (
            Date.now() > expires ||
            !state.live ||
            runtime.saving ||
            runtime.refreshPending ||
            runtime.revision !== revision ||
            state.habitData?.day.day !== day ||
            now >= state.habitData.day.endAt ||
            current?.habit.version !== version ||
            current.log.version !== logVersion
          ) {
            toast('Dữ liệu đã thay đổi. Mở ghi nhận để điều chỉnh nhé.');
            return;
          }
          const undone = await save(
            {
              operation: 'log',
              habitId: current.habit.id,
              version,
              logVersion,
              day,
              value: before.value / 100,
              note: before.note,
            },
            { silent: true },
          );
          if (undone && !runtime.refreshPending) toast('Đã hoàn tác.');
        },
      },
    );
    return result;
  }
  function toggleHabit(view) {
    const { log, definition } = view;
    return saveLog(
      view,
      state.habitData.day.day,
      log.value >= definition.target ? 0 : definition.target / 100,
      log.note,
    );
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
    setHabitFilter,
    showHabitPanel,
    loadHabitHistory,
    setHabitReportSpan,
    setHabitHistoryStatus,
    exportHabits,
    openHabitExport,
  };
}
