export function renderReminders(ui, state) {
    const { el, button, heading } = ui, root = el('section', undefined, 'reminders-page');
    const top = heading('Nhớ việc, nhẹ đầu.', 'Chỉ những lời nhắc cậu chủ động đặt.');
    top.append(button('+ Tạo lời nhắc', () => ui.openReminder(null), 'primary top-create'));
    root.append(top);
    if (state.rest?.reason === 'asleep')
        root.append(el('p', 'Cậu đã báo ngủ. Các lời nhắc đã đặt ở đây vẫn gửi theo lịch.', 'footer-note'));
    if (['paused', 'inactive'].includes(state.rest?.reason))
        root.append(el('p', 'Đang ngừng gửi nhắc chủ động. Cậu vẫn sửa được các lịch bên dưới; “đang bật” không có nghĩa sẽ gửi trong lúc nghỉ.', 'footer-note'));
    const filter = ['all', 'recurring', 'once'].includes(state.reminderFilter) ? state.reminderFilter : 'all';
    const matches = (r, value) => value === 'all' || (r.kind === 'once') === (value === 'once');
    const toolbar = el('div', undefined, 'reminder-toolbar'), toggle = el('div', undefined, 'segment reminder-filters');
    toggle.setAttribute('aria-label', 'Lọc lời nhắc');
    for (const [value, label] of [['all', 'Tất cả'], ['recurring', 'Định kỳ'], ['once', 'Một lần']]) {
        const total = state.reminders.filter(r => matches(r, value)).length;
        const b = button(label + ' · ' + total, () => {
            state.reminderFilter = value;
            ui.render();
        });
        b.setAttribute('aria-pressed', String(value === filter));
        toggle.append(b);
    }
    toolbar.append(toggle, el('p', state.reminders.filter(r => r.enabled && !r.past && !r.delivered).length + ' lịch đang bật', 'reminder-total'));
    root.append(toolbar);
    const rows = state.reminders.filter(r => matches(r, filter));
    const list = el('div', undefined, 'reminder-list');
    root.append(list);
    for (const r of rows) {
        const row = button('', () => ui.openReminder(r), 'reminder-row' + (r.enabled ? '' : ' off'));
        const main = el('div', undefined, 'reminder-main');
        const repeat = r.kind === 'daily' ? 'Hằng ngày' : r.kind === 'once' ? 'Ngày ' + r.start.split('-').reverse().join('/') : (r.weekdays ?? []).map(n => n === 7 ? 'Chủ nhật' : 'Thứ ' + (n + 1)).join(', ');
        main.append(el('strong', r.title), el('small', repeat, 'reminder-repeat'));
        const note = r.delivered ? 'Đã gửi lời nhắc · tự ẩn khi sang ngày mới' : r.past ? 'Đã qua giờ · tự ẩn khi sang ngày mới' : r.skipped ? 'Bỏ lần kế tiếp · lịch lặp vẫn giữ' : !r.enabled ? 'Không gửi lời nhắc mới' : r.kind !== 'once' ? (r.end ? 'Đến ' + r.end.split('-').reverse().join('/') : 'Tiếp tục đến khi cậu tắt') : '';
        if (note)
            main.append(el('small', note, 'reminder-note'));
        const badge = el('span', r.delivered ? 'Đã nhắc' : r.past ? 'Đã qua giờ' : r.enabled ? 'Đang bật' : 'Đã tắt', 'reminder-badge' + (r.enabled && !r.past && !r.delivered ? ' is-enabled' : ''));
        const times = el('span', undefined, 'reminder-times');
        for (const time of r.times.split(',').map(t => t.trim()))
            times.append(el('strong', time));
        row.append(times, main, badge, el('span', '›', 'chevron'));
        list.append(row);
    }
    if (!rows.length) {
        const empty = el('div', undefined, 'reminder-empty');
        empty.append(el('span', '◷', 'reminder-empty-mark'), el('h2', state.reminders.length ? 'Nhóm này chưa có lịch' : 'Một lời nhắc, nhẹ đầu hơn'), el('p', state.reminders.length ? 'Cậu vẫn có lời nhắc ở nhóm khác.' : 'Đặt giờ cho việc cậu muốn Minh Anh nhắc.', 'hint'), button(state.reminders.length ? 'Xem tất cả lời nhắc' : '+ Tạo lời nhắc', () => {
            if (state.reminders.length) {
                state.reminderFilter = 'all';
                ui.render();
            }
            else
                ui.openReminder(null);
        }, 'secondary'));
        root.append(empty);
    }
    root.append(el('p', 'Lời nhắc bắt đầu task nằm trong “Hôm nay”. Nhắc ngủ theo giờ nghỉ ở Cài đặt.', 'footer-note'));
    return root;
}
