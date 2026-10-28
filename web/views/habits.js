import { cadenceLabel, habitDate, habitNumber } from '../models/habits.js';
import { renderHabitToday } from './habits-today.js';
import { renderJournals } from './journals.js';

export function renderHabits(ui, state) {
  if (state.habitPanel === 'journals') return renderJournals(ui, state);
  if (!['progress', 'history'].includes(state.habitPanel)) return renderHabitToday(ui, state);
  const root = ui.el('section', undefined, 'habits-page');
  root.append(
    ui.button('‹ Thói quen', () => ui.showHabitPanel('today'), 'text-button feature-back'),
    ui.heading(
      state.habitPanel === 'progress' ? 'Tiến bộ thói quen' : 'Lịch sử thói quen',
      'Nhìn lại những cam kết đã qua.',
    ),
  );
  if (!state.habitData) return root;
  return state.habitPanel === 'progress'
    ? renderProgress(ui, state, root)
    : renderHistory(ui, state, root);
}

function renderProgress(ui, state, root) {
  const { el, button } = ui,
    ranges = el('div', undefined, 'habit-progress-toolbar');
  const report = state.habitProgress,
    span = state.habitProgressSpan ?? 7;
  for (const count of [7, 30]) {
    const control = button(count + ' ngày', () => ui.setHabitReportSpan(count), 'text-button');
    control.setAttribute('aria-pressed', String(span === count));
    ranges.append(control);
  }
  ranges.append(
    button(
      'Lịch sử & xuất dữ liệu',
      () => ui.showHabitPanel('history'),
      'text-button habit-history-link',
    ),
  );
  root.append(
    ranges,
    el(
      'p',
      'Các ngày đã kết thúc. Ngày ngoài cam kết không tính vào tỷ lệ đạt.',
      'hint habit-progress-intro',
    ),
  );
  if (state.habitProgressLoading) root.append(el('p', 'Đang tải tiến bộ…', 'hint'));
  if (state.habitProgressError)
    root.append(
      el('p', state.habitProgressError, 'hint'),
      button('Thử lại', () => ui.showHabitPanel('progress'), 'secondary'),
    );
  if (!report) return root;
  const reports = new Map((report.byHabit ?? []).map((item) => [item.habitId, item]));
  const habits = new Map(
    state.habitData.habits
      .filter(
        (view) =>
          view.habit.archivedFrom === null ||
          state.habitData.day.day < view.habit.archivedFrom ||
          reports.has(view.habit.id),
      )
      .map((view) => [view.habit.id, view.definition.name]),
  );
  for (const item of reports.values())
    if (!habits.has(item.habitId)) habits.set(item.habitId, item.name);
  if (!habits.size) {
    root.append(el('p', 'Tiến bộ sẽ hiện ở đây khi cậu bắt đầu theo dõi.', 'habit-empty hint'));
    return root;
  }
  if (span === 7) {
    const table = el('table', undefined, 'habit-progress-table');
    const caption = el(
      'caption',
      'Tiến bộ ' + habitDate(report.from) + ' – ' + habitDate(report.to),
    );
    table.append(caption);
    const head = el('thead'),
      tr = el('tr'),
      first = el('th', 'Thói quen');
    first.scope = 'col';
    tr.append(first);
    for (let day = report.from; day <= report.to; day++) {
      const th = el('th');
      th.scope = 'col';
      th.append(
        el(
          'small',
          ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(day * 86400000).getUTCDay()],
        ),
        el('span', String(new Date(day * 86400000).getUTCDate())),
      );
      tr.append(th);
    }
    head.append(tr);
    table.append(head);
    const body = el('tbody');
    for (const [id, name] of habits) {
      const row = el('tr'),
        label = el('th', name);
      label.scope = 'row';
      row.append(label);
      const days = new Map((reports.get(id)?.days ?? []).map((item) => [item.day, item]));
      for (let day = report.from; day <= report.to; day++) {
        const status = days.get(day)?.status,
          cell = el('td'),
          mark = el(
            'span',
            status === 'achieved' ? '✓' : status === 'missed' ? '×' : '—',
            'habit-day-mark ' + (status ?? 'unknown'),
          );
        const text =
          habitDate(day) +
          ': ' +
          ({ achieved: 'Đạt', missed: 'Thiếu', neutral: 'Ngoài cam kết' }[status] ??
            'Chưa có kết quả');
        mark.title = text;
        mark.setAttribute('aria-label', text);
        cell.append(mark);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    root.append(table);
    const key = el(
      'p',
      '✓ Đạt    × Thiếu    — Ngoài cam kết / chưa có kết quả',
      'hint habit-progress-key',
    );
    root.append(key);
  } else {
    const list = el('div', undefined, 'habit-rates');
    for (const [id, name] of habits) {
      const item = reports.get(id),
        count = (item?.successes ?? 0) + (item?.misses ?? 0),
        row = el('article', undefined, 'habit-rate');
      const head = el('div', undefined, 'habit-rate-head');
      head.append(el('h3', name), el('span', count ? item.rate + '%' : '—'));
      const bar = el('progress');
      bar.max = 100;
      bar.value = item?.rate ?? 0;
      bar.setAttribute(
        'aria-label',
        name + ': ' + (count ? item.rate + '% đạt cam kết' : 'Chưa có cam kết đã kết toán'),
      );
      row.append(
        head,
        bar,
        el(
          'p',
          count
            ? item.successes + '/' + count + ' ngày cam kết đạt mục tiêu'
            : 'Chưa có cam kết đã kết toán',
          'hint',
        ),
      );
      list.append(row);
    }
    root.append(el('p', habitDate(report.from) + ' – ' + habitDate(report.to), 'hint'), list);
  }
  return root;
}

function renderHistory(ui, state, root) {
  const { el, button } = ui,
    history = state.habitHistory;
  const tools = el('div', undefined, 'habit-history-tools'),
    select = el('select');
  select.setAttribute('aria-label', 'Lọc lịch sử theo thói quen');
  for (const [id, name] of [
    ['', 'Tất cả thói quen'],
    ...state.habitData.habits.map((view) => [view.habit.id, view.definition.name]),
  ]) {
    const option = el('option', name);
    option.value = id;
    select.append(option);
  }
  if (state.habitData.archivePage?.nextCursor != null) {
    const more = button(
      'Tải thêm bộ lọc thói quen lưu trữ',
      () => ui.loadMoreHabits(),
      'text-button',
    );
    more.disabled = !!state.habitArchiveLoading;
    root.append(more);
  }
  select.value = state.habitHistoryId ?? '';
  select.disabled = !!state.habitHistoryLoading;
  select.addEventListener('change', () => ui.loadHabitHistory(select.value));
  const statusFilter = el('select');
  statusFilter.setAttribute('aria-label', 'Lọc kết quả cam kết');
  for (const [value, label] of [
    ['all', 'Mọi kết quả'],
    ['achieved', 'Đạt'],
    ['missed', 'Thiếu'],
    ['neutral', 'Ngoài cam kết'],
    ['processing', 'Chưa kết toán'],
  ]) {
    const option = el('option', label);
    option.value = value;
    statusFilter.append(option);
  }
  statusFilter.value = state.habitHistoryStatus ?? 'all';
  statusFilter.disabled = !!state.habitHistoryLoading;
  statusFilter.addEventListener('change', () => ui.setHabitHistoryStatus(statusFilter.value));
  tools.append(
    select,
    statusFilter,
    button('Xuất dữ liệu', () => ui.openHabitExport(), 'text-button'),
  );
  root.append(tools);
  if (state.habitHistoryLoading && !history) root.append(el('p', 'Đang tải lịch sử…', 'hint'));
  if (!history) return root;
  const report = state.habitReport;
  const ranges = el('div', undefined, 'habit-filters');
  for (const [span, label] of [
    [7, '7 ngày'],
    [30, '30 ngày'],
  ]) {
    const control = button(label, () => ui.setHabitReportSpan(span), 'text-button');
    control.setAttribute('aria-pressed', String((state.habitReportSpan ?? 30) === span));
    control.disabled = !!state.habitHistoryLoading;
    ranges.append(control);
  }
  root.append(ranges);
  if (report) {
    const summary = ui.card('habit-report'),
      stats = el('div', undefined, 'habit-report-stats');
    for (const [value, label] of [
      [report.rate === null ? '—' : report.rate + '%', 'Giữ cam kết'],
      [report.successes, 'Lần đạt'],
      [report.misses, 'Cam kết thiếu'],
    ]) {
      const stat = el('div');
      stat.append(el('strong', String(value)), el('small', label));
      stats.append(stat);
    }
    summary.append(
      stats,
      el('p', habitDate(report.from) + ' – ' + habitDate(report.to), 'habit-report-range'),
      el(
        'p',
        'Tính từ các cam kết đã kết toán. Ngày ngoài lịch và ngày linh hoạt không được coi là đạt.',
        'hint',
      ),
    );
    const calendar = el('div', undefined, 'habit-calendar');
    calendar.setAttribute('aria-label', 'Nhịp thực hiện theo ngày');
    for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      const weekday = el('span', label, 'habit-calendar-weekday');
      weekday.setAttribute('aria-hidden', 'true');
      calendar.append(weekday);
    }
    const pad = (((report.from + 3) % 7) + 7) % 7;
    for (let i = 0; i < pad; i++) calendar.append(el('span'));
    for (let day = report.from; day <= report.to; day++) {
      const result = report.days.find((item) => item.day === day),
        cell = el(
          'span',
          String(new Date(day * 86400000).getUTCDate()),
          'habit-calendar-day' +
            (result?.successes ? ' is-met' : '') +
            (result?.misses ? ' is-missed' : '') +
            (day === state.habitData.day.day ? ' is-today' : ''),
        );
      const text =
        habitDate(day) +
        (result
          ? ': ' + result.successes + ' lần đạt, ' + result.misses + ' cam kết thiếu'
          : ': chưa kết toán hoặc chưa có cam kết');
      cell.title = text;
      cell.setAttribute('aria-label', text);
      calendar.append(cell);
    }
    summary.append(calendar);
    root.append(summary);
    if (report.totals.length) {
      const totals = el('details', undefined, 'habit-totals');
      totals.append(el('summary', 'Lượng thực hiện đã ghi'));
      for (const total of report.totals)
        totals.append(
          el('p', total.name + ' · ' + habitNumber(total.value) + ' ' + total.unit, 'hint'),
        );
      root.append(totals);
    }
  }
  if (!history.rows.length) root.append(el('p', 'Chưa có lịch sử trong khoảng này.', 'hint'));
  const status = {
    achieved: 'Đạt',
    missed: 'Thiếu',
    neutral: 'Ngoài cam kết',
    processing: 'Chưa kết toán',
  };
  for (const row of history.rows) {
    const item = el('article', undefined, 'habit-history-row'),
      copy = el('div');
    copy.append(
      el('h3', row.name),
      el('p', habitDate(row.day) + ' · ' + cadenceLabel(row.definition.cadence), 'hint'),
    );
    if (row.note) copy.append(el('p', row.note, 'habit-note'));
    const detail = el('div', undefined, 'habit-history-value');
    detail.append(
      el(
        'span',
        habitNumber(row.value) +
          ' / ' +
          habitNumber(row.definition.target) +
          ' ' +
          row.definition.unit,
      ),
      el('small', status[row.status]),
    );
    item.append(copy, detail);
    root.append(item);
  }
  if (history.next) {
    const more = button(
      state.habitHistoryLoading ? 'Đang tải…' : 'Xem thêm',
      () => ui.loadHabitHistory(state.habitHistoryId, true),
      'secondary',
    );
    more.disabled = !!state.habitHistoryLoading;
    root.append(more);
  }
  return root;
}
