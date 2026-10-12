import { cadenceLabel, habitDate, habitNumber, habitStatus } from '../models/habits.js';

export function renderHabits(ui, state) {
    const { el, button, card, heading } = ui, root = el('section', undefined, 'habits-page');
    const historyOpen = state.habitPanel === 'history';
    const top = heading(historyOpen ? 'Lịch sử thói quen' : 'Thói quen', historyOpen ? 'Nhìn lại những cam kết đã qua.' : 'Từng việc nhỏ, theo nhịp của cậu.');
    const add = button('+ Thêm', () => ui.openHabit(), 'primary');
    add.setAttribute('aria-label', 'Thêm thói quen'); top.append(add); root.append(top);
    if (historyOpen) root.append(button('‹ Thói quen', () => ui.showHabitPanel('today'), 'text-button feature-back'));
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
    const list = all.filter(view => state.habitFilter === 'archived'
        ? view.habit.archivedFrom !== null && day >= view.habit.archivedFrom
        : view.habit.archivedFrom === null || day < view.habit.archivedFrom);
    const summary = el('div', undefined, 'habit-day-summary');
    summary.append(el('span', state.habitFilter === 'archived' ? 'Đã lưu trữ' : 'Hôm nay · ' + habitDate(day)),
        el('span', list.filter(view => view.log.value >= view.definition.target).length + ' đã đạt', 'habit-day-count'));
    if (state.habitLoading) summary.append(el('small', 'Đang cập nhật…', 'feature-updating'));
    root.append(summary);
    if (!list.length) root.append(el('p', state.habitFilter === 'archived' ? 'Chưa có thói quen lưu trữ.' : 'Một cam kết vừa sức là đủ để bắt đầu. Cậu có thể chọn các ngày hoặc linh hoạt theo tuần.', 'hint habit-empty'));
    const container = el('div', undefined, 'habit-list');
    for (const view of list) {
        const { habit, definition, pending, log, preview } = view;
        const archived = habit.archivedFrom !== null && day >= habit.archivedFrom;
        const met = log.value >= definition.target;
        const row = card('habit-card' + (met ? ' is-met' : '') + (archived ? ' is-archived' : ''));
        row.dataset.habitId = habit.id;
        const head = el('div', undefined, 'habit-card-head'), copy = el('div', undefined, 'habit-copy');
        const name = button(definition.name, () => ui.openHabitDetails(view), 'habit-name');
        const title = el('div', undefined, 'habit-title'); title.append(name); copy.append(title);
        const schedule = definition.cadence.kind === 'weekly' && preview && day >= definition.commitmentFrom
            ? 'Tuần này ' + preview.period.completedDays.length + ' / ' + definition.cadence.quota + ' ngày'
            : cadenceLabel(definition.cadence);
        copy.append(el('p', schedule, 'habit-cadence'));
        const edit = button('···', () => ui.openHabitDetails(view), 'icon-button');
        edit.setAttribute('aria-label', 'Tùy chọn ' + definition.name); title.append(edit); head.append(copy); row.append(head);
        const body = el('div', undefined, 'habit-card-body'), progress = el('div');
        if (definition.metric !== 'check') {
            const value = el('p', undefined, 'habit-value');
            value.append(el('strong', habitNumber(log.value)), el('span', ' / ' + habitNumber(definition.target) + ' ' + definition.unit));
            progress.append(value);
        }
        const status = habitStatus(view, day);
        if (!['Chưa đạt hôm nay', 'Đã đạt hôm nay', 'Linh hoạt trong tuần'].includes(status)) progress.append(el('p', status, 'habit-status'));
        if (definition.cadence.kind === 'weekly' && day >= definition.commitmentFrom && !archived && preview) {
            const count = preview.period.completedDays.length;
            if (preview.misses) progress.append(el('p', 'Hôm nay chưa đạt sẽ thiếu thêm 1 ngày.', 'habit-week'));
        }
        body.append(progress);
        if (!archived) {
            const control = definition.metric === 'check'
                ? button(met ? '✓ Đã làm' : 'Đánh dấu', () => ui.toggleHabit(view), 'habit-check' + (met ? ' checked' : ''))
                : button(met ? 'Điều chỉnh' : 'Ghi nhận', () => ui.openHabitLog(view), 'secondary habit-log-button');
            if (definition.metric === 'check') control.setAttribute('aria-pressed', String(met));
            control.dataset.write = 'habit-log';
            if (state.featureSaving) {
                control.disabled = true;
                if (state.featureSaving.habitId === habit.id) { control.textContent = 'Đang lưu…'; control.setAttribute('aria-busy', 'true'); }
            }
            head.append(control);
        }
        if (progress.childElementCount) row.append(body);
        if (!archived && view.slot) {
            const slotLabel = view.slot ? new Date(view.slot.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) + ' · ' + view.slot.minutes + ' phút' : 'Xếp thời gian';
            row.append(button(slotLabel, () => ui.openHabitSlot(view), 'text-button habit-slot-link'));
        }
        if (pending && pending.archivedFrom == null && !archived) row.append(el('p', 'Đã hẹn thay đổi · ' + habitDate(pending.fromDay), 'habit-pending'));
        if (habit.archivedFrom !== null && day < habit.archivedFrom) row.append(el('p', 'Lưu trữ từ ' + habitDate(habit.archivedFrom), 'habit-pending'));
        container.append(row);
    }
    root.append(container);
    const tools = el('div', undefined, 'habit-secondary-links');
    tools.append(button('Lịch sử & báo cáo', () => ui.showHabitPanel('history'), 'text-button'),
        button(state.habitFilter === 'archived' ? 'Đang theo dõi' : 'Đã lưu trữ', () => ui.setHabitFilter(state.habitFilter === 'archived' ? 'active' : 'archived'), 'text-button'));
    root.append(tools);
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
    const statusFilter = el('select'); statusFilter.setAttribute('aria-label', 'Lọc kết quả cam kết');
    for (const [value, label] of [['all', 'Mọi kết quả'], ['achieved', 'Đạt'], ['missed', 'Thiếu'], ['neutral', 'Ngoài cam kết'], ['processing', 'Chưa kết toán']]) {
        const option = el('option', label); option.value = value; statusFilter.append(option);
    }
    statusFilter.value = state.habitHistoryStatus ?? 'all'; statusFilter.disabled = !!state.habitHistoryLoading;
    statusFilter.addEventListener('change', () => ui.setHabitHistoryStatus(statusFilter.value));
    tools.append(select, statusFilter, button('Xuất dữ liệu', () => ui.openHabitExport(), 'text-button')); root.append(tools);
    if (state.habitHistoryLoading && !history) root.append(el('p', 'Đang tải lịch sử…', 'hint'));
    if (!history) return root;
    const report = state.habitReport;
    const ranges = el('div', undefined, 'habit-filters');
    for (const [span, label] of [[7, '7 ngày'], [30, '30 ngày']]) {
        const control = button(label, () => ui.setHabitReportSpan(span), 'text-button');
        control.setAttribute('aria-pressed', String((state.habitReportSpan ?? 30) === span));
        control.disabled = !!state.habitHistoryLoading; ranges.append(control);
    }
    root.append(ranges);
    if (report) {
        const summary = ui.card('habit-report'), stats = el('div', undefined, 'habit-report-stats');
        for (const [value, label] of [[report.rate === null ? '—' : report.rate + '%', 'Giữ cam kết'], [report.successes, 'Lần đạt'], [report.misses, 'Cam kết thiếu']]) {
            const stat = el('div'); stat.append(el('strong', String(value)), el('small', label)); stats.append(stat);
        }
        summary.append(stats, el('p', habitDate(report.from) + ' – ' + habitDate(report.to), 'habit-report-range'), el('p', 'Tính từ các cam kết đã kết toán. Ngày ngoài lịch và ngày linh hoạt không được coi là đạt.', 'hint'));
        const calendar = el('div', undefined, 'habit-calendar'); calendar.setAttribute('aria-label', 'Nhịp thực hiện theo ngày');
        for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
            const weekday = el('span', label, 'habit-calendar-weekday'); weekday.setAttribute('aria-hidden', 'true'); calendar.append(weekday);
        }
        const pad = ((report.from + 3) % 7 + 7) % 7;
        for (let i = 0; i < pad; i++) calendar.append(el('span'));
        for (let day = report.from; day <= report.to; day++) {
            const result = report.days.find(item => item.day === day), cell = el('span', String(new Date(day * 86400000).getUTCDate()),
                'habit-calendar-day' + (result?.successes ? ' is-met' : '') + (result?.misses ? ' is-missed' : '') + (day === state.habitData.day.day ? ' is-today' : ''));
            const text = habitDate(day) + (result ? ': ' + result.successes + ' lần đạt, ' + result.misses + ' cam kết thiếu' : ': chưa kết toán hoặc chưa có cam kết');
            cell.title = text; cell.setAttribute('aria-label', text); calendar.append(cell);
        }
        summary.append(calendar); root.append(summary);
        if (report.totals.length) {
            const totals = el('details', undefined, 'habit-totals'); totals.append(el('summary', 'Lượng thực hiện đã ghi'));
            for (const total of report.totals) totals.append(el('p', total.name + ' · ' + habitNumber(total.value) + ' ' + total.unit, 'hint'));
            root.append(totals);
        }
    }
    if (!history.rows.length) root.append(el('p', 'Chưa có lịch sử trong khoảng này.', 'hint'));
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
