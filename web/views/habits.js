import { cadenceLabel, habitDate, habitNumber, habitSummary } from '../models/habits.js';
import { renderBeastTowerEntry } from './linh-thu.js';

export function renderHabits(ui, state) {
  const { el, button, card, heading } = ui,
    root = el('section', undefined, 'habits-page');
  const historyOpen = state.habitPanel === 'history';
  const top = heading(
    historyOpen ? 'Lịch sử thói quen' : 'Thói quen',
    historyOpen ? 'Nhìn lại những cam kết đã qua.' : 'Từng việc nhỏ, theo nhịp của cậu.',
  );
  const add = button('+ Thêm', () => ui.openHabit(), 'primary');
  add.setAttribute('aria-label', 'Thêm thói quen');
  top.append(add);
  root.append(top);
  if (historyOpen)
    root.append(
      button('‹ Thói quen', () => ui.showHabitPanel('today'), 'text-button feature-back'),
    );
  if (state.habitError) {
    const failure = card('habit-notice');
    failure.append(
      el('p', state.habitError),
      button('Tải lại', () => ui.loadHabits(), 'secondary'),
    );
    root.append(failure);
  }
  if (!state.habitData) {
    root.append(
      el(
        'p',
        state.habitLoading ? 'Đang tải thói quen…' : 'Thêm một thói quen vừa sức để bắt đầu.',
        'hint',
      ),
    );
    if (state.habitLoading) root.setAttribute('aria-busy', 'true');
    return root;
  }
  if (state.habitPanel === 'history') return renderHistory(ui, state, root);
  const navigation = el('div', undefined, 'segment habit-tabs');
  for (const [panel, label] of [
    ['today', 'Hôm nay'],
    ['progress', 'Tiến bộ'],
  ]) {
    const control = button(label, () => ui.showHabitPanel(panel));
    control.setAttribute('aria-pressed', String((state.habitPanel ?? 'today') === panel));
    navigation.append(control);
  }
  root.append(navigation);
  if (state.habitPanel === 'progress') return renderProgress(ui, state, root);
  const day = state.habitData.day.day,
    all = state.habitData.habits;
  const list = all.filter((view) =>
    state.habitFilter === 'archived'
      ? view.habit.archivedFrom !== null && day >= view.habit.archivedFrom
      : view.habit.archivedFrom === null || day < view.habit.archivedFrom,
  );
  const summary = el('div', undefined, 'habit-day-summary');
  summary.append(
    el('span', state.habitFilter === 'archived' ? 'Đã lưu trữ' : 'Hôm nay · ' + habitDate(day)),
    el(
      'span',
      list.filter((view) => view.log.value >= view.definition.target).length + ' đã đạt',
      'habit-day-count',
    ),
  );
  if (state.habitLoading) summary.append(el('small', 'Đang cập nhật…', 'feature-updating'));
  root.append(summary);
  if (state.habitFilter !== 'archived')
    root.append(
      el(
        'p',
        'Đạt mục tiêu đúng ngày cam kết: +1 vé quay. Tối đa 1 vé mỗi thói quen/ngày; lịch tuần giới hạn theo số ngày cam kết.',
        'hint habit-ticket-hint',
      ),
    );
  if (!list.length)
    root.append(
      el(
        'p',
        state.habitFilter === 'archived'
          ? 'Chưa có thói quen lưu trữ.'
          : 'Một cam kết vừa sức là đủ để bắt đầu. Cậu có thể chọn các ngày hoặc linh hoạt theo tuần.',
        'hint habit-empty',
      ),
    );
  const container = el('div', undefined, 'habit-list');
  for (const view of list) {
    const { habit, definition, log } = view;
    const archived = habit.archivedFrom !== null && day >= habit.archivedFrom;
    const met = log.value >= definition.target;
    const row = card('habit-card' + (met ? ' is-met' : '') + (archived ? ' is-archived' : ''));
    row.dataset.habitId = habit.id;
    const head = el('div', undefined, 'habit-card-head'),
      copy = el('div', undefined, 'habit-copy');
    const name = button(definition.name, () => ui.openHabitDetails(view), 'habit-name');
    copy.append(name);
    const { primary, extra } = habitSummary(view, day),
      meta = el('div', undefined, 'habit-meta');
    const line = el('span', primary.text, 'habit-meta-text' + (primary.urgent ? ' urgent' : ''));
    line.title = primary.text;
    meta.append(line);
    if (extra) {
      const more = button('+' + extra, () => ui.openHabitDetails(view), 'habit-more');
      more.setAttribute('aria-label', extra + ' thông tin khác về ' + definition.name);
      meta.append(more);
    }
    copy.append(meta);
    const check = button(
      met ? '✓' : '',
      () => ui.toggleHabit(view),
      'habit-check' + (met ? ' checked' : ''),
    );
    check.setAttribute('aria-label', (met ? 'Bỏ đánh dấu ' : 'Hoàn thành ') + definition.name);
    check.setAttribute('aria-pressed', String(met));
    check.dataset.write = 'habit-log';
    check.disabled = archived || !!state.featureSaving;
    if (state.featureSaving?.habitId === habit.id) {
      check.setAttribute('aria-busy', 'true');
      check.textContent = 'Đang lưu…';
    }
    head.append(check, copy);
    if (!archived) {
      if (definition.metric !== 'check') {
        const control = button('', () => ui.openHabitLog(view), 'habit-log-button');
        control.append(
          el('strong', habitNumber(log.value)),
          el('span', '/' + habitNumber(definition.target) + ' ' + definition.unit),
        );
        control.setAttribute(
          'aria-label',
          'Ghi nhận ' +
            definition.name +
            ': ' +
            habitNumber(log.value) +
            '/' +
            habitNumber(definition.target) +
            ' ' +
            definition.unit,
        );
        control.disabled = !!state.featureSaving;
        head.append(control);
      }
    }
    row.append(head);
    container.append(row);
  }
  root.append(container);
  if (state.live && state.habitFilter !== 'archived') root.append(renderBeastTowerEntry(ui, state));
  if (state.habitFilter === 'archived' && state.habitData.archivePage?.nextCursor != null) {
    const more = button(
      state.habitArchiveLoading ? 'Đang tải…' : 'Tải thêm thói quen lưu trữ',
      () => ui.loadMoreHabits(),
      'secondary',
    );
    more.disabled = !!state.habitArchiveLoading;
    root.append(more);
  }
  const tools = el('div', undefined, 'habit-secondary-links');
  tools.append(
    button('Lịch sử & báo cáo', () => ui.showHabitPanel('history'), 'text-button'),
    button(
      state.habitFilter === 'archived' ? 'Đang theo dõi' : 'Đã lưu trữ',
      () => ui.setHabitFilter(state.habitFilter === 'archived' ? 'active' : 'archived'),
      'text-button',
    ),
  );
  root.append(tools);
  return root;
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
