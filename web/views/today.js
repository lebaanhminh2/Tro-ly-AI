import { checkinProgress, dailyRewardLabel, flameLevel } from '../models/cultivation.js';
import { taskBuckets } from '../models/tasks.js';
function dayLabel(state) {
    const liveDate = state.live && state.serverNow ? new Date(state.serverNow) : null;
    return liveDate
        ? liveDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'long' })
        : 'Chủ nhật, 13 tháng 9 · Dữ liệu mẫu';
}
function deadlineLabel(value, now) {
    if (!value)
        return null;
    const at = Date.parse(value.length === 10 ? value + 'T23:59:00+07:00' : value);
    if (!Number.isFinite(at))
        return null;
    const diff = at - now, past = diff < 0, minutes = Math.ceil(Math.abs(diff) / 60000);
    let amount;
    if (minutes < 60)
        amount = minutes + ' phút';
    else if (minutes < 48 * 60)
        amount = Math.ceil(minutes / 60) + ' giờ';
    else
        amount = Math.ceil(minutes / 1440) + ' ngày';
    return past ? 'quá hạn ' + amount : 'còn ' + amount;
}
const clock = value => new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const duration = value => {
    const minutes = Math.max(0, Number(value) || 0), hours = Math.floor(minutes / 60), rest = minutes % 60;
    return hours ? hours + ' giờ' + (rest ? ' ' + rest + ' phút' : '') : minutes + ' phút';
};
function renderPlanNotice(ui, state) {
    const plan = state.dailyPlan?.plan;
    if (!plan)
        return null;
    const notices = [], now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    if (plan.overflow > 0)
        notices.push('Cậu đã thêm ' + plan.overflow + ' phút vượt thời gian rảnh hôm nay.');
    if (plan.unscheduled > 0)
        notices.push(plan.unscheduled + ' phút chưa có khung giờ để đặt lời nhắc.');
    const overdue = plan.items.filter(item => {
        const task = state.tasks.find(t => t.id === item.taskId);
        return task && !task.done && deadlineLabel(task.deadline, now)?.startsWith('quá hạn');
    }).length;
    if (overdue)
        notices.push(overdue + ' việc trong lịch đã quá hạn. Cậu có thể điều chỉnh hạn hoặc chia nhỏ để làm tiếp.');
    else if (plan.risks?.length)
        notices.push('Một số việc trong lịch có nguy cơ không kịp hạn với thời gian hiện tại.');
    if (!notices.length)
        return null;
    const notice = ui.el('aside', undefined, 'plan-notice');
    notice.setAttribute('aria-label', 'Điều cần chú ý trong lịch hôm nay');
    const copy = ui.el('div', undefined, 'notice-copy');
    copy.append(ui.el('strong', 'Điều cần chú ý'), ui.el('p', notices.slice(0, 2).join(' ')));
    notice.append(ui.el('span', '!', 'notice-mark'), copy);
    return notice;
}
function renderSessionLabels(ui, windows, now, done) {
    const times = ui.el('span', undefined, 'daily-item-windows');
    for (const slot of [...windows].sort((a, b) => a.start - b.start)) {
        const active = !done && slot.start <= now && now < slot.end;
        times.append(ui.el('span', clock(slot.start) + '–' + clock(slot.end) + (active ? ' · Hiện tại' : ''), 'session-window' + (active ? ' is-current' : '')));
    }
    if (!windows.length)
        times.append(ui.el('span', 'Chưa có giờ làm', 'session-window is-unscheduled'));
    return times;
}
export function renderWorkState(ui, state, plan, now) {
    const { el, button } = ui;
    const focused = state.taskFocus?.endsAt > now;
    const target = focused ? state.taskFocus : state.taskFocusTarget;
    const task = target?.taskId ? state.tasks.find(task => task.id === target.taskId && !task.done) : null;
    const slots = (plan?.items ?? []).flatMap(item => (item.windows ?? []).map(slot => ({ ...slot, task: state.tasks.find(t => t.id === item.taskId && !t.done) })))
        .filter(slot => slot.task && slot.end > now).sort((a, b) => a.start - b.start || a.end - b.end || a.task.id.localeCompare(b.task.id));
    const current = slots.find(slot => slot.start <= now), next = slots.find(slot => slot.start > now);
    const root = el('section', undefined, 'work-state');
    root.setAttribute('aria-label', 'Việc hiện tại và trạng thái làm việc');
    const shown = slots.find(slot => slot.task.id === task?.id) ?? current ?? next;
    const flame = flameLevel(state.cultivation?.streak);
    const card = button('', () => ui.toggleTaskFocus(card), 'focus-flip-card is-interactive' + (focused ? ' is-focused' : ''));
    card.style.setProperty('--flame', flame.color);
    card.setAttribute('aria-pressed', String(!!focused));
    const until = target?.endsAt > now ? clock(target.endsAt) : '';
    card.setAttribute('aria-label', focused ? 'Đang làm' + (task ? ': ' + task.title : '') + ' đến ' + until + '. Minh Anh ngừng nhắc để cậu tập trung. Chạm để dừng.' : 'Bắt đầu nhé?' + (task ? ' ' + task.title + '.' : '') + ' Chạm để bắt đầu. Minh Anh ngừng nhắc để cậu tập trung' + (until ? ' đến ' + until : '') + '.');
    const inner = el('span', undefined, 'focus-flip-inner');
    card.append(inner);
    const addFace = (side, mark, title, detail) => {
        const face = el('span', undefined, 'focus-flip-face focus-flip-' + side + ' ' + (side === 'front' ? 'companion-flame' : 'companion-rank'));
        face.setAttribute('aria-hidden', 'true');
        face.append(el('span', mark, 'focus-flip-mark'), el('strong', title, 'focus-flip-title'));
        if (task || shown)
            face.append(el('span', task?.title ?? shown.task.title, 'focus-flip-task'));
        if (side === 'back')
            face.append(el('span', 'Đang làm' + (until ? ' đến ' + until : ''), 'focus-session-time'));
        else if (shown)
            face.append(el('span', (shown.start > now ? 'Sắp tới · ' : 'Hiện tại · ') + clock(shown.start) + '–' + clock(shown.end), 'focus-session-time'));
        else
            face.append(el('span', plan ? 'Không còn phiên làm việc trong lịch' : 'Chưa có lịch làm việc', 'focus-session-time'));
        face.append(el('span', detail, 'focus-flip-detail'));
        inner.append(face);
    };
    addFace('front', '🔥', 'Bắt đầu nhé?', 'Chạm để bắt đầu' + (!current && task ? ' sớm' : '') + ' · Minh Anh ngừng nhắc để cậu tập trung');
    addFace('back', '✧', 'Cậu cứ tập trung nhé', 'Chạm để dừng');
    root.append(card);
    if (state.resting)
        root.append(el('p', 'Đang nghỉ · Lời nhắc vẫn tạm ngừng.', 'work-state-detail'));
    if (next)
        root.append(el('p', 'Tiếp theo · ' + clock(next.start) + '–' + clock(next.end) + ' · ' + next.task.title, 'work-state-next'));
    return root;
}
export function renderToday(ui, state) {
    const { el, button, heading, card, openTask, render } = ui;
    const buckets = taskBuckets(state.tasks, state.operatingDay, state.start);
    const plan = state.dailyPlan?.plan;
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    const root = el('section', undefined, 'today-page');
    const top = heading('Một ngày, từng bước.', dayLabel(state)), attendance = checkinProgress(state.cultivation, now, state.checkin?.rewards);
    const rewardLink = button(attendance.canClaim ? 'Quà hôm nay' : 'Quà hằng ngày', () => ui.openRewardCalendar(), 'secondary daily-reward-entry');
    rewardLink.setAttribute('aria-label', attendance.canClaim ? 'Quà hôm nay: ' + dailyRewardLabel(attendance.rewards[attendance.count]) + '. Xem lịch quà.' : 'Xem lịch quà điểm danh 30 ngày');
    top.append(rewardLink);
    root.append(top);
    if (state.resting) {
        const reason = state.rest?.reason;
        const until = state.rest?.until
            ? new Date(state.rest.until).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
            : null;
        const title = ({ bedtime: 'Đến giờ ngủ rồi, cậu 🌙', asleep: 'Cậu đã báo ngủ 🌙', paused: 'Đang tạm dừng lời nhắc', inactive: 'Tạm ngưng vì lâu chưa trò chuyện' }[reason] ?? 'Nghỉ ngơi thôi, cậu 🌙');
        const detail = reason === 'bedtime'
            ? 'Tớ không giao thêm việc. Cậu vẫn chỉnh lịch, công việc và nhận thưởng bình thường.'
            : reason === 'inactive'
                ? 'Nhắn cho Minh Anh để hoạt động lại. Cậu vẫn có thể chỉnh công việc.'
                : 'Tớ đang ngừng nhắn chủ động' + (until ? ' đến ' + until : '') + '. Cậu vẫn chỉnh lịch và công việc bình thường.';
        const rest = card('rest-state');
        rest.append(el('h2', title), el('p', detail, 'subtitle'));
        if (!state.live)
            rest.append(button('Hoạt động lại', () => {
                state.resting = false;
                render();
            }, 'secondary'));
        root.append(rest);
    }
    root.append(renderWorkState(ui, state, plan, now));
    const main = el('div', undefined, 'today-main'), panel = el('div', undefined, 'today-view-panel');
    panel.id = 'today-view-panel';
    const toggle = el('div', undefined, 'segment today-view-switch');
    toggle.setAttribute('aria-label', 'Cách xem công việc');
    const controls = [];
    const updatePanel = () => panel.replaceChildren(state.mode === 'timeline' ? renderDailyPlan(ui, state) : renderTaskList(ui, state, buckets, card, button, openTask, render));
    for (const [value, label] of [['timeline', 'Lịch hôm nay'], ['tasks', 'Danh sách việc']]) {
        const b = button(label, () => {
            if (state.mode === value)
                return;
            const top = toggle.getBoundingClientRect?.().top;
            state.mode = value;
            controls.forEach(([mode, control]) => control.setAttribute('aria-pressed', String(mode === value)));
            updatePanel();
            ui.keepViewAnchor?.(toggle, top);
        });
        b.setAttribute('aria-pressed', String(state.mode === value));
        b.setAttribute('aria-controls', panel.id);
        b.setAttribute('data-today-mode', value);
        toggle.append(b);
        controls.push([value, b]);
    }
    updatePanel();
    main.append(toggle, panel);
    root.append(main);
    return root;
}
function renderTaskList(ui, state, buckets, card, button, openTask, render) {
    const { el } = ui;
    const section = el('section', undefined, 'task-list-section');
    const headingRow = el('div', undefined, 'section-heading task-list-heading today-panel-heading');
    const copy = el('div', undefined, 'section-heading-copy');
    const actions = el('div', undefined, 'heading-actions today-panel-actions');
    const selectButton = button(state.selecting ? 'Thoát chọn' : 'Chọn nhiều', () => {
        state.selecting = !state.selecting;
        state.selected.clear();
        render();
    }, 'text-button selection-toggle');
    selectButton.setAttribute('aria-pressed', String(state.selecting));
    actions.append(button('+ Tạo task', () => openTask(null), 'primary task-create'), selectButton);
    copy.append(el('h2', (state.activeTasksHasMore ? state.activeTasksTotal : buckets.active.length) + ' việc chưa xong'), el('p', 'Tất cả công việc · Bấm vào việc để điều chỉnh.', 'section-kicker'));
    headingRow.append(copy, actions);
    section.append(headingRow);
    const notice = renderPlanNotice(ui, state);
    if (notice)
        section.append(notice);
    const taskList = (tasks, className = '', groupHistory = false) => {
        const list = card(('task-board ' + className).trim());
        let month = '';
        for (const task of tasks) {
            if (groupHistory) {
                const key = task.completedAt
                    ? new Date(task.completedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', month: 'long', year: 'numeric' })
                    : 'Ngày chưa rõ';
                if (key !== month) {
                    month = key;
                    list.append(el('p', key, 'history-month'));
                }
            }
            const row = el('div', undefined, 'task-row' + (task.done ? ' done' : ''));
            const check = el('input');
            check.type = 'checkbox';
            check.className = 'check';
            check.checked = state.selecting ? state.selected.has(task.code) : task.done;
            check.setAttribute('aria-label', (state.selecting ? 'Chọn ' : 'Hoàn thành ') + task.title);
            check.addEventListener('change', () => {
                if (state.selecting) {
                    check.checked ? state.selected.add(task.code) : state.selected.delete(task.code);
                    render();
                }
                else
                    ui.toggleTask(task);
            });
            const name = button('', () => openTask(task), 'task-open'), relative = deadlineLabel(task.deadline, (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now()));
            const exact = task.deadline ? (task.deadline.length === 10 ? task.deadline.split('-').reverse().join('/') : new Date(task.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })) : null;
            const planned = state.dailyPlan?.plan?.items.find(item => item.taskId === task.id), now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
            name.append(renderSessionLabels(ui, planned?.windows ?? [], now, task.done), el('strong', '#' + task.code + ' ' + task.title));
            const details = [task.remainingMinutes !== null && task.remainingMinutes !== undefined ? 'Còn ' + duration(task.remainingMinutes) : null, exact ? 'Hạn ' + exact + (relative ? ' · ' + relative : '') : 'Chưa có hạn'].filter(Boolean);
            name.append(el('small', details.join(' · ')));
            row.append(check, name);
            list.append(row);
        }
        return list;
    };
    if (buckets.active.length)
        section.append(taskList(buckets.active));
    else {
        const empty = el('div', undefined, 'task-empty');
        empty.append(el('p', 'Các việc đều đã hoàn thành. Ui giỏi ghê :>', 'hint'));
        section.append(empty);
    }
    if (state.activeTasksHasMore) {
        const more = button(state.activeTasksLoading ? 'Đang tải…' : 'Xem thêm công việc', () => ui.loadActiveTasks(), 'secondary history-more');
        more.disabled = !!state.activeTasksLoading;
        section.append(more);
    }
    if (buckets.completedToday.length) {
        const done = el('details', undefined, 'daily-later completed-today');
        done.open = true;
        done.append(el('summary', buckets.completedToday.length + ' việc xong hôm nay'), taskList(buckets.completedToday, 'completed-list'));
        section.append(done);
    }
    if (buckets.history.length) {
        const history = el('details', undefined, 'daily-later history-section');
        const ordered = [...buckets.history].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
        const visible = ordered.slice(0, 20), footer = el('div', undefined, 'history-footer');
        footer.append(el('p', 'Lịch sử chỉ để xem, không đưa lại vào hôm nay.', 'footer-note'));
        if (state.historyHasMore)
            footer.append(button(state.historyLoading ? 'Đang tải…' : 'Xem thêm lịch sử', () => ui.loadHistory?.(), 'secondary'));
        history.append(el('summary', 'Lịch sử · ' + (state.historyTotal ?? ordered.length) + ' việc đã hoàn thành'), taskList(visible, 'history-list', true), footer);
        section.append(history);
    }
    if (state.selecting) {
        const remove = button('Xóa ' + state.selected.size + ' việc đã chọn', () => ui.confirmDelete(), 'danger');
        remove.disabled = !state.selected.size;
        section.append(remove);
    }
    return section;
}
function renderDailyPlan(ui, state) {
    const { el, button, openTask } = ui;
    const root = el('section', undefined, 'daily-plan');
    const plan = state.dailyPlan?.plan;
    if (!plan) {
        const empty = el('div', undefined, 'plan-empty');
        if (state.day?.task_plan_status === 'waiting') {
            const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now()), left = Math.max(0, Number(state.day.task_plan_due ?? now) - now), minutes = Math.ceil(left / 60000), wait = minutes >= 60 ? Math.floor(minutes / 60) + ' giờ ' + (minutes % 60 ? minutes % 60 + ' phút' : '') : minutes + ' phút';
            empty.append(el('p', 'CHƯA XẾP LỊCH HÔM NAY', 'eyebrow'), el('h2', 'Cậu cập nhật thời gian hôm nay nhé'), el('p', 'Nếu chưa cập nhật, Minh Anh sẽ tự xếp sau ' + wait + '.', 'hint'), button('Xếp thời gian hôm nay', () => ui.openAvailability(), 'primary'));
        }
        else
            empty.append(el('p', 'CHƯA CÓ LỊCH HÔM NAY', 'eyebrow'), el('h2', 'Cài giờ sinh hoạt để bắt đầu'), el('p', 'Khi biết giờ rảnh, Minh Anh sẽ chọn một vài việc phù hợp thay vì đưa cả danh sách vào hôm nay.', 'hint'));
        root.append(empty);
        return root;
    }
    const completed = plan.items.filter(item => state.tasks.find(task => task.id === item.taskId)?.done).length;
    const actualTotal = plan.items.reduce((sum, item) => sum + Number(item.actualMinutes ?? 0), 0);
    const overview = el('section', undefined, 'plan-overview today-panel-heading');
    const copy = el('div', undefined, 'plan-overview-copy');
    copy.append(el('h2', plan.items.length ? plan.items.length + ' việc trong lịch' : 'Chưa có việc cho hôm nay'));
    const summaryParts = [completed + ' đã xong', duration(plan.planned) + ' đã xếp', duration(plan.capacity) + ' rảnh'];
    if (actualTotal)
        summaryParts.unshift(duration(actualTotal) + ' đã làm');
    copy.append(el('p', summaryParts.join(' · '), 'plan-summary'));
    const actions = el('div', undefined, 'heading-actions plan-actions today-panel-actions');
    actions.append(button('Chỉnh lịch', () => ui.openTodayPlan(), 'secondary plan-action plan-action-main'), button('Giờ bận/rảnh', () => ui.openAvailability(), 'secondary plan-action'));
    overview.append(copy, actions);
    root.append(overview);
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    const notice = renderPlanNotice(ui, state);
    if (notice)
        root.append(notice);
    const list = el('div', undefined, 'daily-list');
    const ordered = [...plan.items].sort((a, b) => Math.min(...(a.windows ?? []).map(w => w.start)) - Math.min(...(b.windows ?? []).map(w => w.start)));
    for (const item of ordered) {
        const task = state.tasks.find(t => t.id === item.taskId);
        if (!task)
            continue;
        const windows = [...(item.windows ?? [])].sort((a, b) => a.start - b.start), current = !task.done && windows.some(w => w.start <= now && now < w.end);
        const row = el('article', undefined, 'daily-item' + (task.done ? ' done' : '') + (current ? ' is-current' : ''));
        const check = el('input');
        check.type = 'checkbox';
        check.className = 'check';
        check.checked = task.done;
        check.setAttribute('aria-label', (task.done ? 'Mở lại ' : 'Hoàn thành ') + task.title);
        check.addEventListener('change', () => {
            check.checked = task.done;
            ui.toggleTask(task);
        });
        const info = button('', () => openTask(task), 'daily-item-open');
        const actual = Number(item.actualMinutes ?? task.actualMinutes ?? 0), remaining = task.remainingMinutes ?? item.remaining;
        const times = renderSessionLabels(ui, windows, now, task.done);
        const details = [duration(item.minutes) + ' hôm nay'];
        if (actual)
            details.push('đã làm ' + duration(actual));
        if (remaining !== null && remaining !== undefined)
            details.push('còn ' + duration(remaining));
        if ((item.scheduledMinutes ?? item.minutes) < item.minutes)
            details.push(`${item.minutes - (item.scheduledMinutes ?? item.minutes)} phút chưa có giờ nhắc`);
        const deadline = deadlineLabel(task.deadline, (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now()));
        if (deadline)
            details.push(deadline);
        info.append(times, el('strong', '#' + task.code + ' ' + task.title), el('small', details.join(' · ')));
        row.append(check, info);
        list.append(row);
    }
    if (!list.children.length) {
        const empty = el('div', undefined, 'plan-empty-inline');
        empty.append(el('h3', 'Hôm nay chưa có việc'), el('p', 'Các task còn lại đang nằm trong danh sách việc.', 'hint'));
        list.append(empty);
    }
    root.append(list);
    const later = taskBuckets(state.tasks, state.operatingDay, state.start).active.filter(t => !plan.items.some(i => i.taskId === t.id));
    if (later.length) {
        const details = el('details', undefined, 'daily-later later-tasks');
        details.append(el('summary', later.length + ' việc chưa chọn cho hôm nay'), el('p', 'Đây là các việc cậu có thể thêm khi muốn; chúng không nằm trong lịch hiện tại.', 'hint'));
        for (const t of later) {
            const row = el('div', undefined, 'later-task'), info = button('', () => openTask(t), 'later-task-open');
            info.append(el('span', '#' + t.code, 'code'), el('strong', t.title));
            row.append(info, button('+ Hôm nay', () => ui.openTodayPlan(t.id), 'secondary'));
            details.append(row);
        }
        root.append(details);
    }
    return root;
}
