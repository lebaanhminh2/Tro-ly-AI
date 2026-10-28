import { cadenceLabel, habitDate, habitNumber, habitDisplayUnit } from '../models/habits.js';
import { renderBeastTowerEntry } from './linh-thu.js';
import { habitIcon } from '../ui/habit-icons.js';

export function habitArchived(view, day) {
  if (view.presentation?.hidden === 'archived') return true;
  if (view.presentation && view.presentation.hidden === '' && view.pending?.archivedFrom === null)
    return false;
  return view.habit.archivedFrom !== null && day >= view.habit.archivedFrom;
}
export function habitNeeded(view, day) {
  const choice = view.presentation?.choiceDay === day ? view.presentation.choice : '';
  if (choice === 'included') return true;
  if (choice === 'deferred' && view.log.value < view.definition.target) return false;
  const cadence = view.definition.cadence;
  if (cadence.kind === 'weekdays' && !cadence.weekdays.includes((day + 3) % 7)) return false;
  if (view.preview?.reason === 'archived') return false;
  if (cadence.kind === 'weekly' && view.preview?.reason === 'quota_met') return false;
  return true;
}

export function renderHabitToday(ui, state) {
  const { el, button } = ui,
    root = el('section', undefined, 'habits-page habits-v2');
  const archived = state.habitFilter === 'archived',
    selecting = !!state.habitSelecting;
  state.habitSelected ??= new Set();
  const selection = state.habitSelected;
  if (archived)
    root.append(
      button('‹ Thói quen', () => ui.setHabitFilter('active'), 'text-button feature-back'),
    );
  const title = el('div', undefined, 'heading hv2-header'),
    copy = el('div');
  copy.append(
    el('h1', archived ? 'Đã lưu trữ' : 'Thói quen'),
    el(
      'p',
      archived
        ? 'Giữ lịch sử, tạm dừng theo dõi và nhắc giờ.'
        : 'Một chút mỗi ngày, theo nhịp của cậu.',
      'subtitle',
    ),
  );
  title.append(copy);
  const actions = el('div', undefined, 'hv2-actions');
  const add = button('', () => ui.openHabit(), 'primary');
  add.append(habitIcon('plus'), el('span', 'Thêm'));
  add.setAttribute('aria-label', 'Thêm thói quen');
  actions.append(add);
  const menu = el('details', undefined, 'hv2-menu'),
    summary = el('summary');
  summary.append(habitIcon('more'));
  summary.setAttribute('aria-label', 'Tùy chọn thói quen');
  menu.append(summary);
  const menuItems = el('div', undefined, 'hv2-menu-items');
  for (const { label, icon, action } of [
    { label: 'Nhật ký', icon: 'journal', action: () => ui.showJournals() },
    { label: 'Đã lưu trữ', icon: 'archive', action: () => ui.setHabitFilter('archived') },
    { label: 'Tiến bộ', icon: 'leaf', action: () => ui.showHabitPanel('progress') },
    { label: 'Lịch sử & báo cáo', icon: 'journal', action: () => ui.showHabitPanel('history') },
  ]) {
    const item = button('', action, 'text-button');
    item.append(habitIcon(icon), document.createTextNode(label));
    menuItems.append(item);
  }
  menu.append(menuItems);
  actions.append(menu);
  if (!archived) title.append(actions);
  root.append(title);
  if (state.habitError)
    root.append(
      el('p', state.habitError, 'hint'),
      button('Tải lại', () => ui.loadHabits()),
    );
  if (!state.habitData) {
    root.append(
      el(
        'p',
        state.habitLoading ? 'Đang tải thói quen…' : 'Thêm một thói quen vừa sức để bắt đầu.',
        'hint',
      ),
    );
    return root;
  }
  const day = state.habitData.day.day;
  const all = state.habitData.habits
    .map((view) => {
      const intent = state.habitLogIntents?.[view.habit.id];
      return intent?.day === day
        ? { ...view, log: { ...view.log, value: intent.value, note: intent.note } }
        : view;
    })
    .filter((view) => view.presentation?.hidden !== 'deleted');
  const list = all.filter((view) => habitArchived(view, day) === archived);
  const validIds = new Set(list.map((view) => view.habit.id));
  for (const id of selection) if (!validIds.has(id)) selection.delete(id);
  const needed = list.filter((view) => habitNeeded(view, day));
  const unresolved = (view) =>
    state.habitLogIntents?.[view.habit.id] || state.habitLogRecovery?.[view.habit.id];
  const done = needed.filter(
    (view) => view.log.value >= view.definition.target && !unresolved(view),
  );
  const panel = el('div', undefined, 'hv2-panel');
  if (!archived && !selecting && needed.length) {
    const overview = el('section', undefined, 'hv2-today');
    overview.setAttribute(
      'aria-label',
      done.length + ' trên ' + needed.length + ' thói quen đã hoàn thành',
    );
    overview.append(
      el(
        'p',
        new Intl.DateTimeFormat('vi-VN', {
          timeZone: 'UTC',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date(day * 86400000)),
        'hv2-date',
      ),
    );
    const number = el('p', undefined, 'hv2-number');
    number.setAttribute('aria-hidden', 'true');
    number.append(el('strong', String(done.length)), el('span', ' / ' + needed.length));
    overview.append(number, el('p', 'Đã hoàn thành hôm nay', 'hv2-summary-title'));
    panel.append(overview);
  }
  const toolbar = el('div', undefined, 'hv2-toolbar');
  toolbar.append(el('h2', selecting || archived ? list.length + ' thói quen' : 'Cần thực hiện'));
  const selectionTools = el('div', undefined, 'hv2-section-actions');
  if (selecting)
    selectionTools.append(
      button(
        selection.size === list.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả',
        () => {
          selection.size === list.length
            ? selection.clear()
            : list.forEach((view) => selection.add(view.habit.id));
          ui.render();
        },
        'text-button',
      ),
    );
  if (list.length) {
    const select = button(
      selecting ? 'Thoát chọn' : 'Chọn nhiều',
      () => {
        state.habitSelecting = !selecting;
        selection.clear();
        ui.render();
      },
      'text-button selection-toggle',
    );
    select.setAttribute('aria-pressed', String(selecting));
    selectionTools.append(select);
  }
  toolbar.append(selectionTools);
  panel.append(toolbar);
  const toggleSelected = (view) => {
    selection.has(view.habit.id) ? selection.delete(view.habit.id) : selection.add(view.habit.id);
    ui.render();
  };
  function renderRow(view, outside = false, peers = []) {
    const { habit, definition, log } = view,
      unit = habitDisplayUnit(view),
      met = log.value >= definition.target;
    const row = el(
      'div',
      undefined,
      'hv2-row habit-card' +
        (met ? ' is-met' : '') +
        (outside ? ' is-outside' : '') +
        (selecting && selection.has(habit.id) ? ' is-selected' : ''),
    );
    row.dataset.habitId = habit.id;
    if (selecting || (!outside && !archived)) {
      const check = button(
        selecting ? (selection.has(habit.id) ? '✓' : '') : met ? '✓' : '',
        () => (selecting ? toggleSelected(view) : ui.toggleHabit(view)),
        'hv2-check habit-check' + (met ? ' checked' : ''),
      );
      check.setAttribute('aria-pressed', String(selecting ? selection.has(habit.id) : met));
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', String(selecting ? selection.has(habit.id) : met));
      check.setAttribute(
        'aria-label',
        (selecting ? 'Chọn ' : met ? 'Bỏ hoàn thành ' : 'Hoàn thành ') + definition.name,
      );
      check.dataset.write = selecting ? 'habit-select' : 'habit-log';
      const wrap = el('span', undefined, 'hv2-check-wrap');
      wrap.append(check);
      row.append(wrap);
    } else {
      const space = el('span', undefined, 'hv2-check-space');
      if (archived) space.append(habitIcon('archive'));
      row.append(space);
    }
    const copy = el('div', undefined, 'hv2-copy');
    const open = button(
      '',
      () => (selecting ? toggleSelected(view) : ui.openHabitDetails(view)),
      'hv2-name habit-name',
    );
    open.append(el('strong', definition.name));
    const urgent = definition.cadence.kind === 'weekly' && view.preview?.misses && !met;
    const weekly = definition.cadence.kind === 'weekly';
    let subtitle = cadenceLabel(definition.cadence);
    if (weekly && view.preview && day >= definition.commitmentFrom)
      subtitle =
        'Tuần này ' +
        view.preview.period.completedDays.length +
        '/' +
        definition.cadence.quota +
        ' ngày';
    if (archived)
      subtitle =
        cadenceLabel(definition.cadence) +
        ' · ' +
        (definition.metric === 'check'
          ? 'Một lần thực hiện'
          : habitNumber(definition.target) + ' ' + unit);
    else if (view.reminderTime && !outside) subtitle += ' · Nhắc ' + view.reminderTime;
    if (outside && view.presentation?.choiceDay === day && view.presentation.choice === 'deferred')
      subtitle = 'Để hôm khác · ' + subtitle;
    else if (outside && view.preview?.reason === 'quota_met') subtitle = 'Đã đủ cam kết tuần';
    else if (outside && view.preview?.reason === 'not_scheduled') subtitle = 'Hôm nay ngoài lịch';
    if (view.habit.archivedFrom !== null && day < view.habit.archivedFrom)
      subtitle += ' · Dừng cam kết từ ' + habitDate(view.habit.archivedFrom);
    if (view.pending?.archivedFrom === null && view.preview?.reason === 'archived')
      subtitle = 'Hoạt động lại từ ' + habitDate(view.pending.fromDay);
    const meta = el('span', subtitle, 'hv2-meta');
    if (urgent)
      meta.append(
        el(
          'span',
          'Cần làm hôm nay để đủ ' + definition.cadence.quota + ' ngày/tuần',
          'hv2-urgent',
        ),
      );
    open.append(meta);
    copy.append(open);
    if (weekly && !met && definition.metric !== 'check' && !selecting && !archived && !outside)
      copy.append(
        button(
          habitNumber(log.value) + ' / ' + habitNumber(definition.target) + ' ' + unit,
          () => ui.openHabitLog(view),
          'text-button hv2-inline-amount habit-log-button',
        ),
      );
    row.append(copy);
    if (selecting) {
      const order = el('div', undefined, 'hv2-order'),
        index = peers.indexOf(view);
      for (const [direction, offset, label] of [
        ['up', -1, 'Đưa lên'],
        ['down', 1, 'Đưa xuống'],
      ]) {
        const neighbor = peers[index + Number(offset)];
        const control = button('', () => ui.moveHabit(view, neighbor), 'text-button');
        control.append(habitIcon(direction));
        control.setAttribute('aria-label', label + ' · ' + definition.name);
        control.disabled = !neighbor || !!state.habitOrdering;
        order.append(control);
      }
      row.append(order);
    }
    if (!selecting && !archived) {
      if (((weekly && !met) || outside) && view.preview?.reason !== 'archived') {
        const options = el('details', undefined, 'hv2-row-options'),
          other = el('summary', 'Khác');
        other.setAttribute('aria-label', 'Khác · ' + definition.name);
        options.append(other);
        const menu = el('div', undefined, 'hv2-menu-items');
        menu.append(
          button(
            outside ? 'Làm hôm nay' : 'Để hôm khác',
            () => ui.setHabitToday(view, outside),
            'text-button',
          ),
        );
        options.append(menu);
        row.append(options);
      } else if (!outside && definition.metric !== 'check') {
        const amount = button('', () => ui.openHabitLog(view), 'hv2-amount habit-log-button');
        const value = habitNumber(log.value),
          target = habitNumber(definition.target),
          compact = (value + target).length > 6;
        amount.setAttribute(
          'aria-label',
          'Ghi nhận ' + definition.name + ': ' + value + ' trên ' + target + ' ' + unit,
        );
        amount.title = value + ' / ' + target + ' ' + unit;
        if (compact) amount.classList.add('hv2-amount-compact');
        amount.append(el('strong', value + (compact ? '/' : ' / ') + target), el('small', unit));
        row.append(amount);
      }
    }
    if (!selecting) {
      const chevron = button('', () => ui.openHabitDetails(view), 'hv2-row-chevron');
      chevron.setAttribute('aria-label', 'Xem ' + definition.name);
      chevron.append(habitIcon('chevron'));
      row.append(chevron);
    }
    if (state.habitLogRecovery?.[habit.id]) {
      const recovery = el('div', undefined, 'hv2-recovery habit-log-recovery');
      recovery.append(
        el('span', 'Chưa xác nhận lần lưu'),
        button('Thử lại', () => ui.recoverHabitLog(habit.id), 'text-button'),
      );
      row.append(recovery);
    }
    return row;
  }
  const pending = needed.filter(
    (view) => view.log.value < view.definition.target || unresolved(view),
  );
  const empty = (title, description, icon = 'check', add = false) => {
    const box = el('div', undefined, 'hv2-empty');
    box.append(habitIcon(icon), el('h3', title), el('p', description));
    if (add) box.append(button('Thêm thói quen', () => ui.openHabit(), 'primary'));
    return box;
  };
  if (archived)
    list.forEach((view) => panel.append(renderRow(view, !habitNeeded(view, day), list)));
  else {
    pending.forEach((view) => panel.append(renderRow(view, false, pending)));
    if (!list.length)
      panel.append(
        empty(
          'Bắt đầu bằng một việc nhỏ',
          'Chọn một thói quen vừa sức. Cậu có thể điều chỉnh sau.',
          'leaf',
          true,
        ),
      );
    else if (!pending.length)
      panel.append(
        empty(
          needed.length ? 'Hôm nay đã đủ rồi.' : 'Hôm nay chưa có lịch.',
          needed.length
            ? 'Các thói quen trong lịch đều đã hoàn thành.'
            : 'Cậu vẫn có thể ghi nhận nếu muốn làm thêm.',
        ),
      );
    const groups = [
      ['done', 'Đã hoàn thành', done],
      ['outside', 'Không cần làm hôm nay', list.filter((view) => !habitNeeded(view, day))],
    ];
    state.habitGroups ??= {};
    for (const [key, label, items] of groups) {
      if (!items.length) continue;
      const group = el('details', undefined, 'hv2-group');
      group.open = selecting || !!state.habitGroups[key];
      group.append(el('summary', label + ' · ' + items.length));
      items.forEach((view) => group.append(renderRow(view, key === 'outside', items)));
      group.addEventListener('toggle', () => {
        if (!selecting && group.isConnected) state.habitGroups[key] = group.open;
      });
      panel.append(group);
    }
  }
  if (archived && !list.length)
    panel.append(
      empty(
        'Chưa có thói quen lưu trữ',
        'Thói quen ngừng theo dõi sẽ nằm ở đây. Cậu có thể khôi phục bất cứ lúc nào.',
        'archive',
      ),
    );
  root.append(panel);
  if (selecting) {
    const bulk = el('div', undefined, 'hv2-bulk');
    const remove = button(
      'Xóa ' + selection.size + ' đã chọn',
      () => ui.deleteHabits([...selection]),
      'secondary danger',
    );
    remove.disabled = !selection.size;
    bulk.append(el('p', selection.size + ' thói quen đã chọn'), remove);
    root.append(bulk);
  } else if (!archived) {
    const diary = button(
      '',
      (event) => ui.openJournal(undefined, false, event.currentTarget),
      'hv2-diary-entry',
    );
    diary.disabled = !!state.journalOpening;
    if (state.journalOpening) diary.setAttribute('aria-busy', 'true');
    diary.append(habitIcon('journal'));
    const copy = el('span');
    copy.append(
      el('strong', 'Nhật ký ngày'),
      el(
        'small',
        state.journalDrafts?.[day]
          ? 'Đang viết · Tiếp tục nhật ký'
          : state.journalData?.entries.some((entry) => entry.day === day)
            ? 'Đã lưu · Xem lại hôm nay'
            : 'Hôm nay làm được gì, ngày mai tốt hơn thế nào?',
      ),
    );
    diary.append(copy, habitIcon('chevron'));
    root.append(diary);
    if (state.live) root.append(renderBeastTowerEntry(ui, state));
  }
  if (archived && state.habitData.archivePage?.nextCursor != null)
    root.append(button('Tải thêm thói quen lưu trữ', () => ui.loadMoreHabits()));
  return root;
}
