import { button, el, field } from '../ui/dom.js';
import { focusEffect, revertFocusEffect } from '../ui/effects.js';
export function createTodayPlanActions(context) {
    const { state, runtime, sheetContent, openSheet, performLive, render, toast } = context;
    function toggleTaskFocus(target) {
        if (runtime.saving || runtime.focusAnimating)
            return;
        if (!state.live) {
            const active = state.taskFocus?.endsAt > Date.now();
            runtime.focusAnimating = true;
            target.disabled = true;
            focusEffect(target).then(() => {
                const localDay = Math.floor((Date.now() + 7 * 3600000) / 86400000);
                state.taskFocus = active ? null : (state.taskFocusTarget ?? { taskId: null, endsAt: (localDay + 1) * 86400000 - 7 * 3600000 });
                runtime.focusAnimating = false;
                render();
            });
            return;
        }
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
        const active = state.taskFocus?.endsAt > now;
        performLive('task-focus', { operation: active ? 'stop' : 'start' }, { silent: true, effect: () => focusEffect(target), revertEffect: () => revertFocusEffect(target) }).then(result => {
            if (!result)
                return;
            if (runtime.refreshPending)
                return;
            if (active) {
                toast('Minh Anh có thể nhắc lại khi cần nhé.');
                return;
            }
            const end = new Date(result.endsAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
            toast('Minh Anh biết rồi · Cậu cứ tập trung đến ' + end + ' nhé.');
        });
    }
    function openTodayPlan(addTaskId = null) {
        openSheet('Chỉnh kế hoạch hôm nay');
        if (!state.live || !state.dailyPlan?.plan) {
            sheetContent.append(el('p', 'Chưa có kế hoạch để chỉnh. Cài giờ sinh hoạt trước nhé.', 'hint'));
            return;
        }
        const plan = state.dailyPlan.plan;
        const completed = plan.items.filter(item => state.tasks.find(task => task.id === item.taskId)?.done)
            .map(item => ({ taskId: item.taskId, minutes: item.minutes }));
        const entries = plan.items.filter(item => !completed.some(done => done.taskId === item.taskId))
            .map(item => ({ taskId: item.taskId, minutes: item.minutes }));
        const totalMinutes = () => [...completed, ...entries].reduce((sum, item) => sum + (Number.isInteger(item.minutes) ? item.minutes : 0), 0);
        const suggestedMinutes = task => {
            const remaining = Number(task.remainingMinutes), spare = Math.max(0, (plan.capacity ?? 0) - totalMinutes());
            if (!Number.isFinite(remaining) || remaining <= 0)
                return null;
            return Math.max(5, Math.min(960, remaining, spare || remaining));
        };
        if (addTaskId && !entries.some(item => item.taskId === addTaskId)) {
            const task = state.tasks.find(item => item.id === addTaskId);
            if (task && !task.done)
                entries.push({ taskId: task.id, minutes: suggestedMinutes(task) });
        }
        const intro = el('p', 'Đổi phút, sắp xếp hoặc để việc chưa xong sang hôm khác.', 'hint'), rows = el('div'), picker = el('div', undefined, 'plan-picker'), feedback = el('p', '', 'hint');
        const sync = () => {
            [...rows.querySelectorAll('[data-task-id]')].forEach(row => {
                const item = entries.find(entry => entry.taskId === row.dataset.taskId), input = row.querySelector('[data-plan-minutes]');
                if (item && input && !input.disabled)
                    item.minutes = input.value === '' ? null : Number(input.value);
            });
        };
        const draw = () => {
            rows.replaceChildren();
            for (const [index, item] of entries.entries()) {
                const task = state.tasks.find(value => value.id === item.taskId);
                if (!task)
                    continue;
                const row = el('section', undefined, 'plan-edit-row');
                row.dataset.taskId = item.taskId;
                const info = el('div', undefined, 'plan-edit-info');
                info.append(el('strong', '#' + task.code + ' ' + task.title), el('small', 'Trong kế hoạch hôm nay'));
                const minutes = field('Phút hôm nay', 'number', item.minutes === null ? '' : String(item.minutes));
                minutes.input.min = '5';
                minutes.input.max = '960';
                minutes.input.step = '5';
                minutes.input.dataset.planMinutes = '';
                minutes.input.placeholder = 'Nhập phút';
                const controls = el('div', undefined, 'plan-order');
                const up = button('↑', () => {
                    sync();
                    [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
                    draw();
                }, 'secondary');
                up.disabled = index === 0;
                up.setAttribute('aria-label', 'Đưa lên');
                const down = button('↓', () => {
                    sync();
                    [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
                    draw();
                }, 'secondary');
                down.disabled = index === entries.length - 1;
                down.setAttribute('aria-label', 'Đưa xuống');
                controls.append(up, down);
                controls.append(button('Để hôm khác', () => {
                    sync();
                    entries.splice(index, 1);
                    draw();
                }, 'text-button'));
                row.append(info, minutes.wrap, controls);
                rows.append(row);
            }
            if (!entries.length)
                rows.append(el('p', 'Không còn việc chưa xong trong kế hoạch.', 'hint'));
            picker.replaceChildren();
            const available = state.tasks.filter(task => !task.done && !entries.some(item => item.taskId === task.id));
            if (available.length) {
                const select = el('select');
                for (const task of available) {
                    const option = el('option', '#' + task.code + ' · ' + task.title);
                    option.value = task.id;
                    select.append(option);
                }
                picker.append(select, button('+ Thêm vào hôm nay', () => {
                    sync();
                    const task = available.find(item => item.id === select.value);
                    if (!task)
                        return;
                    entries.push({ taskId: task.id, minutes: suggestedMinutes(task) });
                    draw();
                    if (entries.at(-1)?.minutes === null)
                        rows.querySelector('[data-task-id="' + task.id + '"] [data-plan-minutes]')?.focus();
                }, 'secondary'));
            }
            else
                picker.append(el('p', 'Không còn task nào để thêm.', 'hint'));
            const total = totalMinutes(), capacity = plan.capacity ?? 0, missing = entries.filter(item => !Number.isInteger(item.minutes)).length;
            feedback.textContent = (missing ? missing + ' task cần nhập số phút · ' : '') + total + ' phút đã chọn · sức chứa hôm nay ' + capacity + ' phút' + (total > capacity ? ' · vượt ' + (total - capacity) + ' phút' : '') + '.';
        };
        draw();
        const form = el('form'), save = el('button', 'Lưu kế hoạch hôm nay', 'primary');
        save.type = 'submit';
        form.append(intro);
        if (completed.length)
            form.append(el('p', 'Đã xong ' + completed.length + ' việc', 'hint plan-completed-summary'));
        form.append(rows, picker, feedback, save);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            sync();
            if (entries.some(item => !Number.isInteger(item.minutes) || item.minutes < 5 || item.minutes > 960)) {
                toast('Nhập từ 5 đến 960 phút cho mỗi task hôm nay nhé.');
                return;
            }
            const result = await performLive('day-plan', { version: state.dailyPlan.version, items: [...completed, ...entries] });
            if (result?.unscheduled)
                toast('Đã lưu, nhưng còn ' + result.unscheduled + ' phút chưa có khung giờ thật để nhắc.');
        });
        sheetContent.append(form);
    }
    return { toggleTaskFocus, openTodayPlan };
}
