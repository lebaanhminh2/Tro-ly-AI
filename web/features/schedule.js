import { setThemePreference, themePreference } from '../core/theme.js';
import { button, el, field } from '../ui/dom.js';
export function createScheduleActions(context) {
    const { state, sheet, sheetContent, openSheet, performLive, render, toast } = context;
    function openHelp() {
        openSheet('Hướng dẫn nhanh');
        for (const [command, description] of [['Chat thường', 'Trò chuyện, không tự ghi công việc.'], ['/ thêm bài toán hạn mai', 'Thực hiện yêu cầu. Thiếu thông tin thì tớ hỏi.'], ['/ mai 7h nhắc tớ dậy', 'Đặt nhắc một lần; lời nhắc vẫn tuân theo chế độ nghỉ.'], ['/lich', 'Mở phần “Thời gian hôm nay” để cậu tự ghi giờ rảnh, giờ bận và thời lượng task cho chính xác.'], ['/ngu', 'Báo nghỉ, dừng nhắc chủ động; vẫn sửa dữ liệu được.'], ['/huy', 'Thoát phiên nhập đang mở.']]) {
            const box = el('section', undefined, 'item-row');
            box.append(el('strong', command), el('p', description, 'hint'));
            sheetContent.append(box);
        }
    }
    function openSettings() {
        openSheet('Cài đặt');
        const form = el('form'), start = field('Bắt đầu ngày', 'time', state.start), sleep = field('Giờ nghỉ mục tiêu', 'time', state.sleep), autoDelay = field('Tự xếp lịch nếu chưa cập nhật sau (phút)', 'number', String(state.autoPlanDelayMinutes ?? 180));
        autoDelay.input.min = '30';
        autoDelay.input.max = '720';
        autoDelay.input.step = '30';
        form.append(start.wrap, sleep.wrap, autoDelay.wrap, el('p', 'Thời gian chờ áp dụng từ ngày tiếp theo. Giờ nghỉ là mục tiêu; /ngu mới xác nhận cậu bắt đầu nghỉ.', 'hint'));
        const save = el('button', state.live ? 'Lưu giờ sinh hoạt' : 'Lưu trong bản mẫu', 'primary');
        save.type = 'submit';
        form.append(save);
        form.addEventListener('submit', e => {
            e.preventDefault();
            const delay = Number(autoDelay.input.value);
            if (start.input.value === sleep.input.value) {
                toast('Giờ bắt đầu và giờ nghỉ cần khác nhau.');
                return;
            }
            if (!Number.isInteger(delay) || delay < 30 || delay > 720 || delay % 30) {
                toast('Chọn thời gian chờ từ 30 đến 720 phút, theo nấc 30 phút nhé.');
                return;
            }
            if (state.live) {
                performLive('settings', { start: start.input.value, sleep: sleep.input.value, autoPlanDelayMinutes: delay, version: state.settingsVersion });
                return;
            }
            state.start = start.input.value;
            state.sleep = sleep.input.value;
            state.autoPlanDelayMinutes = delay;
            sheet.close();
            render();
            toast('Demo: chưa đổi giờ sinh hoạt trên bot.');
        });
        const themeLabel = el('label', 'Giao diện', 'form-field'), theme = el('select');
        for (const [value, label] of [['auto', globalThis.Telegram?.WebApp?.initData ? 'Theo Telegram' : 'Theo hệ thống'], ['light', 'Sáng'], ['dark', 'Tối']]) {
            const option = el('option', label);
            option.value = value;
            theme.append(option);
        }
        theme.value = themePreference();
        theme.addEventListener('change', () => setThemePreference(theme.value));
        themeLabel.append(theme);
        sheetContent.append(form, themeLabel, button('Hướng dẫn nhanh', openHelp, 'secondary'));
    }
    function openAvailability() {
        if (state.live) {
            openSheet('Xếp lịch hôm nay');
            sheet.classList.add('schedule-sheet-open');
            if (!state.day) {
                sheetContent.append(el('p', state.needsSetup ? 'Chọn giờ sinh hoạt trước nhé.' : 'Giờ sinh hoạt đã lưu. Chưa bắt đầu ngày hoạt động tiếp theo; cậu không cần cài lại.', 'hint'), button('Cài đặt', openSettings, 'primary'));
                return;
            }
            let saved = {};
            try {
                saved = JSON.parse(state.day.intervals_json ?? '{}');
            }
            catch {
            }
            const form = el('form', undefined, 'schedule-form');
            const ranges = (title, initial) => {
                const box = el('fieldset', undefined, 'time-slots');
                box.append(el('legend', title));
                const rows = el('div');
                box.append(rows);
                const add = (r = {}) => {
                    if (rows.children.length >= 20)
                        return;
                    const local = n => n ? new Date(n + 25200000).toISOString().slice(11, 16) : '';
                    const row = el('div', undefined, 'availability-row'), from = field('Từ', 'time', local(r.start)), to = field('Đến', 'time', local(r.end));
                    row.append(from.wrap, to.wrap, button('Bỏ', () => row.remove(), 'secondary'));
                    rows.append(row);
                };
                box.append(button('+ Thêm khoảng', () => add(), 'text-button'));
                for (const r of initial ?? [])
                    add(r);
                form.append(box);
                return rows;
            };
            form.append(el('p', 'Chọn giờ cậu có thể làm và giờ bận. Kế hoạch mới chỉ tính từ lúc cậu bấm lưu.', 'schedule-intro'), el('h3', 'Thời gian', 'schedule-section-title'));
            const freeRows = ranges('Có thể làm việc', saved.free), busyRows = ranges('Bận', saved.busy);
            form.append(el('h3', 'Task cần chỉnh thời lượng', 'schedule-section-title'), el('p', 'Không chọn thì task giữ nguyên thời lượng đã lưu. Task chưa có thời lượng sẽ chưa được xếp vào lịch.', 'estimate-help'));
            const activeTasks = state.tasks.filter(t => !t.done), picker = el('div', undefined, 'duration-picker'), select = el('select'), addTask = button('Chọn task', () => {
            }, 'secondary'), estimateList = el('div', undefined, 'estimate-list');
            const estimates = [];
            const refreshPicker = () => {
                const selected = new Set(estimates.map(item => item.task.id));
                select.replaceChildren();
                const placeholder = el('option', 'Chọn một task…');
                placeholder.value = '';
                select.append(placeholder);
                for (const task of activeTasks.filter(task => !selected.has(task.id))) {
                    const option = el('option', '#' + task.code + ' · ' + task.title + (task.remainingMinutes == null ? ' · chưa có thời lượng' : ' · ' + task.remainingMinutes + ' phút'));
                    option.value = task.id;
                    select.append(option);
                }
                addTask.disabled = !select.value;
                select.disabled = select.options.length === 1;
            };
            const addEstimate = task => {
                const old = saved.estimates?.find(e => e.id === task.id), remaining = task.remainingMinutes ?? old?.minutes ?? '';
                const box = el('section', undefined, 'estimate-editor'), title = el('div', undefined, 'estimate-title'), f = field('Còn cần làm (phút)', 'number', remaining === null ? '' : String(remaining));
                title.append(el('strong', '#' + task.code + ' · ' + task.title), button('Bỏ', () => {
                    const index = estimates.findIndex(item => item.task.id === task.id);
                    if (index >= 0)
                        estimates.splice(index, 1);
                    box.remove();
                    refreshPicker();
                }, 'text-button'));
                f.input.min = '5';
                f.input.max = '100000';
                f.input.step = '5';
                f.input.placeholder = 'Nhập ít nhất 5 phút';
                const slider = el('input');
                slider.type = 'range';
                slider.min = '5';
                slider.max = String(Math.max(600, Math.min(100000, Number(remaining) || 600)));
                slider.step = '5';
                slider.value = String(Math.max(5, Number(remaining) || 60));
                slider.className = 'work-slider';
                slider.setAttribute('aria-label', 'Kéo thời lượng còn lại của ' + task.title);
                slider.addEventListener('input', () => {
                    f.input.value = slider.value;
                });
                f.input.addEventListener('input', () => {
                    const value = Number(f.input.value);
                    if (Number.isFinite(value) && value >= 5) {
                        if (value > Number(slider.max))
                            slider.max = String(value);
                        slider.value = String(value);
                    }
                });
                box.append(title, f.wrap, slider);
                estimateList.append(box);
                estimates.push({ task, f });
                refreshPicker();
            };
            select.addEventListener('change', () => {
                addTask.disabled = !select.value;
            });
            addTask.addEventListener('click', () => {
                const task = activeTasks.find(item => item.id === select.value);
                if (task)
                    addEstimate(task);
            });
            picker.append(select, addTask);
            form.append(picker, estimateList);
            refreshPicker();
            const submit = el('button', 'Lưu và xếp lại kế hoạch', 'primary');
            submit.type = 'submit';
            const footer = el('div', undefined, 'sheet-submit');
            footer.append(submit);
            form.append(footer);
            form.addEventListener('submit', e => {
                e.preventDefault();
                const date = new Date(state.day.start_at + 25200000).toISOString().slice(0, 10);
                const convert = rows => [...rows.children].map(row => {
                    const inputs = row.querySelectorAll('input');
                    let start = Date.parse(date + 'T' + inputs[0].value + ':00+07:00'), end = Date.parse(date + 'T' + inputs[1].value + ':00+07:00');
                    if (start < state.day.start_at)
                        start += 86400000;
                    if (end <= start)
                        end += 86400000;
                    return { start, end };
                });
                performLive('schedule', { version: state.day.version, free: convert(freeRows), busy: convert(busyRows), estimates: estimates.map(({ task, f }) => ({ id: task.id, minutes: Number(f.input.value) })) });
            });
            sheetContent.append(form);
            return;
        }
        openSheet('Xếp lịch hôm nay');
        sheetContent.append(el('p', 'Bản mẫu không lưu dữ liệu. Mở Mini App từ Telegram để xếp lịch thật.', 'hint'));
    }
    return { openHelp, openSettings, openAvailability };
}
