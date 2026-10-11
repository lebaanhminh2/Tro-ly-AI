import { cadenceLabel, habitDate, habitNumber, habitStatus } from '../models/habits.js';

export function renderHabits(ui, state) {
    const { el, button, card, heading } = ui, root = el('section', undefined, 'habits-page');
    const top = heading('Nhịp mỗi ngày.', 'Vài việc nhỏ, đều đặn theo cách của cậu.');
    root.append(top);
    const modes = el('div', undefined, 'habit-navigation');
    modes.setAttribute('aria-label', 'Xem thói quen');
    for (const [mode, label] of [['today', 'Hôm nay'], ['history', 'Nhịp đã qua']]) {
        const control = button(label, () => ui.showHabitPanel(mode), 'text-button');
        control.setAttribute('aria-pressed', String((state.habitPanel ?? 'today') === mode));
        modes.append(control);
    }
    const add = button('+ Thêm', () => ui.openHabit(), 'primary');
    add.setAttribute('aria-label', 'Thêm thói quen'); modes.append(add);
    root.append(modes);
    if (state.habitError) {
        const failure = card('habit-notice');
        failure.append(el('p', state.habitError), button('Tải lại', () => ui.loadHabits(), 'secondary'));
        root.append(failure);
    }
    if (!state.habitData) {
        root.append(el('p', state.habitLoading ? 'Đang tải thói quen…' : 'Thêm một thói quen vừa sức để bắt đầu.', 'hint'));
        if (state.habitLoading) root.setAttribute('aria-busy', 'true');
        return root;
    }
    if (state.habitPanel === 'history') return renderHistory(ui, state, root);
    const day = state.habitData.day.day, all = state.habitData.habits;
    const filters = el('div', undefined, 'habit-filters');
    for (const [value, label] of [['active', 'Đang theo dõi'], ['archived', 'Đã lưu trữ']]) {
        const control = button(label, () => ui.setHabitFilter(value), 'text-button');
        control.setAttribute('aria-pressed', String((state.habitFilter ?? 'active') === value));
        filters.append(control);
    }
    root.append(filters);
    const list = all.filter(view => state.habitFilter === 'archived'
        ? view.habit.archivedFrom !== null && day >= view.habit.archivedFrom
        : view.habit.archivedFrom === null || day < view.habit.archivedFrom);
    if (!list.length) root.append(el('p', state.habitFilter === 'archived' ? 'Chưa có thói quen lưu trữ.' : 'Một cam kết vừa sức là đủ để bắt đầu. Cậu có thể chọn các ngày hoặc linh hoạt theo tuần.', 'hint habit-empty'));
    const container = el('div', undefined, 'habit-list');
    for (const view of list) {
        const { habit, definition, pending, log, preview } = view;
        const archived = habit.archivedFrom !== null && day >= habit.archivedFrom;
        const met = log.value >= definition.target;
        const row = card('habit-card' + (met ? ' is-met' : '') + (archived ? ' is-archived' : ''));
        row.dataset.habitId = habit.id;
        const head = el('div', undefined, 'habit-card-head'), copy = el('div', undefined, 'habit-copy');
        copy.append(el('h2', definition.name), el('p', cadenceLabel(definition.cadence), 'habit-cadence'));
        const edit = button('···', () => ui.openHabit(view), 'icon-button');
        edit.setAttribute('aria-label', 'Chỉnh ' + definition.name); head.append(copy, edit); row.append(head);
        const body = el('div', undefined, 'habit-card-body'), progress = el('div');
        if (definition.metric !== 'check') {
            const value = el('p', undefined, 'habit-value');
            value.append(el('strong', habitNumber(log.value)), el('span', ' / ' + habitNumber(definition.target) + ' ' + definition.unit));
            progress.append(value);
        }
        progress.append(el('p', habitStatus(view, day), 'habit-status'));
        if (definition.cadence.kind === 'weekly' && day >= definition.commitmentFrom && !archived && preview) {
            const count = preview.period.completedDays.length;
            progress.append(el('p', count + ' / ' + definition.cadence.quota + ' ngày đạt · còn ' + preview.remainingDays + ' ngày sau hôm nay', 'habit-week'));
            if (preview.misses) progress.append(el('p', 'Nếu hôm nay chưa đạt, cam kết tuần sẽ thiếu thêm 1 ngày.', 'habit-week'));
        }
        body.append(progress);
        if (!archived) {
            const control = definition.metric === 'check'
                ? button(met ? '✓ Đã làm' : 'Đánh dấu', () => ui.toggleHabit(view), 'habit-check' + (met ? ' checked' : ''))
                : button(met ? 'Điều chỉnh' : 'Ghi nhận', () => ui.openHabitLog(view), 'secondary habit-log-button');
            if (definition.metric === 'check') control.setAttribute('aria-pressed', String(met));
            body.append(control);
        }
        row.append(body);
        if (pending && pending.archivedFrom == null && !archived) row.append(el('p', 'Mục tiêu mới từ ' + habitDate(pending.fromDay), 'habit-pending'));
        if (habit.archivedFrom !== null && day < habit.archivedFrom) row.append(el('p', 'Lưu trữ từ ' + habitDate(habit.archivedFrom) + ' · cam kết hiện tại vẫn giữ.', 'habit-pending'));
        if (log.note) row.append(el('p', log.note, 'habit-note'));
        container.append(row);
    }
    root.append(container);
    return root;
}

function renderHistory(ui, state, root) {
    const { el, button } = ui, history = state.habitHistory;
    const tools = el('div', undefined, 'habit-history-tools'), select = el('select');
    select.setAttribute('aria-label', 'Lọc lịch sử theo thói quen');
    for (const [id, name] of [['', 'Tất cả thói quen'], ...state.habitData.habits.map(view => [view.habit.id, view.definition.name])]) {
        const option = el('option', name); option.value = id; select.append(option);
    }
    select.value = state.habitHistoryId ?? '';
    select.disabled = !!state.habitHistoryLoading;
    select.addEventListener('change', () => ui.loadHabitHistory(select.value));
    tools.append(select, button('Xuất CSV', () => ui.exportHabits(), 'text-button')); root.append(tools);
    if (state.habitHistoryLoading && !history) root.append(el('p', 'Đang tải lịch sử…', 'hint'));
    if (!history) return root;
    const successes = history.rows.reduce((sum, row) => sum + row.successes, 0), misses = history.rows.reduce((sum, row) => sum + row.misses, 0);
    const summary = el('p', history.rows.length ? successes + ' ngày đạt · ' + misses + ' cam kết thiếu trong các lần đã tải.' : 'Chưa có lịch sử trong 30 ngày gần đây.', 'habit-history-summary');
    root.append(summary);
    const status = { achieved: 'Đạt', missed: 'Thiếu', neutral: 'Ngoài cam kết', processing: 'Chưa kết toán' };
    for (const row of history.rows) {
        const item = el('article', undefined, 'habit-history-row'), copy = el('div');
        copy.append(el('h3', row.name), el('p', habitDate(row.day) + ' · ' + cadenceLabel(row.definition.cadence), 'hint'));
        if (row.note) copy.append(el('p', row.note, 'habit-note'));
        const detail = el('div', undefined, 'habit-history-value');
        detail.append(el('span', habitNumber(row.value) + ' / ' + habitNumber(row.definition.target) + ' ' + row.definition.unit), el('small', status[row.status]));
        item.append(copy, detail); root.append(item);
    }
    if (history.next) {
        const more = button(state.habitHistoryLoading ? 'Đang tải…' : 'Xem thêm', () => ui.loadHabitHistory(state.habitHistoryId, true), 'secondary');
        more.disabled = !!state.habitHistoryLoading; root.append(more);
    }
    return root;
}
