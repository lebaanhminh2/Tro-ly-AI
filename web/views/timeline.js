import { taskBuckets } from '../models/tasks.js';
const SCALE = 2.4 / 60000;
const clock = t => new Date(t).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
export function updateTimelineClock(state) {
    const line = document.querySelector('.time-now');
    if (!line)
        return;
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    const start = Number(line.dataset.start), end = Number(line.dataset.end);
    line.hidden = now < start || now >= end;
    line.style.top = (now - start) * SCALE + 'px';
    line.firstChild.textContent = clock(now);
    for (const block of document.querySelectorAll('.time-task')) {
        const start = Number(block.dataset.start), end = Number(block.dataset.end);
        block.classList.toggle('current', now >= start && now < end);
        const status = block.querySelector('.time-status');
        if (status)
            status.textContent = now >= end ? 'Chưa xác nhận xong' : now >= start ? 'Đến giờ làm' : 'Dự kiến';
    }
}
export function renderTimeline(ui, state) {
    const { el, button } = ui, root = el('div', undefined, 'day-timeline');
    const data = state.timeline;
    if (!data) {
        root.append(el('p', state.live ? 'Chưa có lịch để hiển thị. Cậu mở “Thời gian hôm nay” để cập nhật nhé.' : 'Mở từ Telegram để xem lịch thật.', 'hint'), button('Điều chỉnh thời gian', ui.openAvailability));
        return root;
    }
    const { window: range, blocks, busy, free } = data;
    const legend = el('div', undefined, 'time-legend');
    legend.append(el('span', '● Công việc'), el('span', '▧ Bận / ngoài giờ rảnh'), el('span', '━ Bây giờ'));
    root.append(legend);
    if (data.habitSlots?.length) {
        const summary = el('details', undefined, 'time-habit-summary');
        summary.append(el('summary', data.habitSlots.length + ' thói quen đã xếp giờ'));
        for (const slot of data.habitSlots) summary.append(button(slot.name + ' · ' + clock(slot.startAt) + '–' + clock(slot.startAt + slot.minutes * 60000), () => ui.showHabitInList(slot.habitId), 'text-button'));
        root.append(summary);
    }
    root.append(el('p', 'Chạm tên việc để xem chi tiết · □ để đánh dấu xong', 'hint'));
    const scroll = el('div', undefined, 'time-scroll'), canvas = el('div', undefined, 'time-canvas');
    scroll.tabIndex = 0;
    scroll.setAttribute('aria-label', 'Lịch theo giờ, cuộn để xem');
    canvas.style.height = (range.target - range.start) * SCALE + 24 + 'px';
    scroll.append(canvas);
    root.append(scroll);
    for (let t = range.start; t <= range.target; t += 3600000) {
        const row = el('div', undefined, 'time-hour');
        row.style.top = (t - range.start) * SCALE + 'px';
        row.append(el('span', clock(t)));
        canvas.append(row);
    }
    // Shade the complement of actual availability, including user busy intervals/events.
    let cursor = range.start;
    const unavailable = [];
    for (const r of free) {
        if (r.start > cursor)
            unavailable.push({ start: cursor, end: r.start });
        cursor = Math.max(cursor, r.end);
    }
    if (cursor < range.target)
        unavailable.push({ start: cursor, end: range.target });
    for (const r of unavailable) {
        const block = el('div', undefined, 'time-busy');
        block.style.top = (r.start - range.start) * SCALE + 'px';
        block.style.height = (r.end - r.start) * SCALE + 'px';
        const event = data.events.find(e => e.start_at < r.end && (e.end_at ?? e.start_at + 3600000) > r.start);
        block.append(el('span', '🔒 ' + (event?.title ?? 'Bận / ngoài giờ rảnh')), el('small', clock(r.start) + '–' + clock(r.end)));
        canvas.append(block);
    }
    for (const b of blocks) {
        const task = state.tasks.find(t => t.id === b.task_id);
        if (!task || task.done)
            continue;
        const block = el('article', undefined, 'time-task');
        block.dataset.start = b.start_at;
        block.dataset.end = b.start_at + b.minutes * 60000;
        block.style.top = (b.start_at - range.start) * SCALE + 'px';
        block.style.height = Math.max(38, b.minutes * 60000 * SCALE - 3) + 'px';
        const check = el('input');
        check.type = 'checkbox';
        check.className = 'check';
        check.setAttribute('aria-label', 'Hoàn thành ' + task.title);
        check.addEventListener('change', () => {
            check.checked = false;
            ui.toggleTask(task);
        });
        const label = button('', () => ui.openTask(task), 'time-task-label');
        label.append(el('strong', '#' + task.code + ' ' + task.title), el('small', clock(b.start_at) + '–' + clock(b.start_at + b.minutes * 60000)), el('small', 'Dự kiến', 'time-status'));
        block.append(check, label);
        canvas.append(block);
    }
    for (const slot of data.habitSlots ?? []) {
        const block = el('div', undefined, 'time-habit');
        block.style.top = (slot.startAt - range.start) * SCALE + 'px';
        block.style.height = Math.max(9, slot.minutes * 60000 * SCALE - 3) + 'px';
        const text = slot.name + ' · ' + clock(slot.startAt) + '–' + clock(slot.startAt + slot.minutes * 60000);
        block.setAttribute('aria-label', text); block.title = text;
        if (slot.minutes >= 10) block.append(el('strong', slot.name));
        if (slot.minutes >= 20) block.append(el('small', clock(slot.startAt) + '–' + clock(slot.startAt + slot.minutes * 60000)));
        canvas.append(block);
    }
    const now = el('div', undefined, 'time-now');
    now.dataset.start = range.start;
    now.dataset.end = range.target;
    now.append(el('span', ''));
    canvas.append(now);
    const foot = el('p', clock(range.target) + ' · Giờ ngủ mục tiêu', 'footer-note');
    root.append(foot);
    const done = taskBuckets(state.tasks, state.operatingDay, state.start).completedToday;
    if (done.length) {
        const details = el('details', undefined, 'time-completed');
        details.append(el('summary', done.length + ' việc đã xong hôm nay'));
        for (const t of done)
            details.append(button('✓ #' + t.code + ' ' + t.title, () => ui.openTask(t), 'text-button'));
        root.append(details);
    }
    requestAnimationFrame(() => {
        if (!root.isConnected)
            return;
        updateTimelineClock(state);
        if (state.timelineScroll !== undefined)
            scroll.scrollTop = state.timelineScroll;
        else
            scroll.scrollTop = Math.max(0, (Math.min(state.serverNow ?? Date.now(), range.target) - range.start) * SCALE - 100);
    });
    return root;
}
