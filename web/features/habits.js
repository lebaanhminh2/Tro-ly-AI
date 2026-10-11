import { liveRequest } from '../core/http.js';
import { cadenceLabel, habitDate, habitWeekdays, safeCsvCell } from '../models/habits.js';
import { button, el, field } from '../ui/dom.js';

export function createHabitActions(context) {
    const { state, runtime, render, toast, sheet, sheetContent, openSheet, performLive, confirm } = context;
    let loadGeneration = 0;
    async function loadHabits() {
        const generation = ++loadGeneration, revision = runtime.revision;
        state.habitLoading = true; state.habitError = null; render();
        try {
            const data = state.live ? await liveRequest('habits?archived=1') : { day: { day: Math.floor((Date.now() + 25200000) / 86400000) }, habits: [] };
            if (generation !== loadGeneration || revision !== runtime.revision) return;
            state.habitData = data;
        } catch (error) {
            if (generation !== loadGeneration || revision !== runtime.revision) return;
            state.habitError = error.message;
        } finally {
            if (generation === loadGeneration) { state.habitLoading = false; render(); }
        }
    }
    function setHabitFilter(filter) { state.habitFilter = filter; render(); }
    function showHabitPanel(panel) {
        state.habitPanel = panel; render();
        if (panel === 'history') loadHabitHistory(state.habitHistoryId ?? '');
    }
    async function loadHabitHistory(habitId = '', more = false) {
        if (state.habitHistoryLoading || !state.habitData) return;
        const revision = runtime.revision;
        state.habitHistoryId = habitId; state.habitHistoryLoading = true;
        if (!more) state.habitHistory = null;
        render();
        const to = state.habitData.day.day;
        const params = new URLSearchParams({ from: String(to - 29), to: String(to), limit: '50' });
        if (habitId) params.set('habitId', habitId);
        if (more && state.habitHistory?.next) params.set('before', state.habitHistory.next);
        try {
            const result = state.live ? await liveRequest('habit-history?' + params) : { rows: [], next: null };
            if (revision !== runtime.revision) return;
            state.habitHistory = { ...result, rows: more ? [...state.habitHistory.rows, ...result.rows] : result.rows };
        } catch (error) { toast(error.message); }
        finally { state.habitHistoryLoading = false; render(); }
    }
    async function save(input, options) {
        if (!state.live) { toast('Bản mẫu không lưu dữ liệu. Mở app đã đăng nhập để theo dõi nhé.'); return null; }
        const result = await performLive('habits', input, options);
        if (result) state.habitHistory = null;
        return result;
    }
    function toggleHabit(view) {
        const { habit, log, definition } = view;
        return save({ operation: 'log', habitId: habit.id, version: habit.version, logVersion: log.version,
            day: state.habitData.day.day, value: log.value >= definition.target ? 0 : 1, note: log.note }, { silent: true });
    }
    function openHabitLog(view) {
        const logDay = state.habitData.day.day;
        openSheet(view.definition.name); sheet.classList.add('settings-sheet-open');
        const form = el('form', undefined, 'settings-sheet-body habit-form');
        form.append(el('p', cadenceLabel(view.definition.cadence) + ' · hôm nay ' + habitDate(state.habitData.day.day), 'hint'));
        const amount = field('Tổng đã làm hôm nay (' + view.definition.unit + ')', 'number', String(view.log.value / 100));
        amount.input.min = '0'; amount.input.max = '1000000'; amount.input.step = '0.01'; amount.input.inputMode = 'decimal';
        const note = field('Ghi chú', 'text', view.log.note, false); note.input.maxLength = 300;
        form.append(amount.wrap, note.wrap, el('p', 'Đủ ' + view.definition.target / 100 + ' ' + view.definition.unit + ' mới được tính đóng góp. Cậu có thể điều chỉnh trong ngày.', 'hint'));
        const controls = el('div', undefined, 'actions'), submit = el('button', 'Lưu', 'primary'); submit.type = 'submit';
        controls.append(submit); form.append(controls);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            await save({ operation: 'log', habitId: view.habit.id, version: view.habit.version,
                day: logDay, logVersion: view.log.version, value: amount.input.valueAsNumber, note: note.input.value });
        });
        sheetContent.append(form);
    }
    function openHabit(view) {
        const initial = view?.pending?.definition ?? view?.definition;
        openSheet(view ? 'Chỉnh thói quen' : 'Thêm thói quen'); sheet.classList.add('settings-sheet-open');
        const form = el('form', undefined, 'settings-sheet-body habit-form'), name = field('Tên thói quen', 'text', initial?.name ?? '');
        name.input.maxLength = 100;
        const makeSelect = (label, options, value) => {
            const wrap = el('label', label, 'form-field'), input = el('select');
            for (const [id, name] of options) { const option = el('option', name); option.value = id; input.append(option); }
            input.value = value; wrap.append(input); return { wrap, input };
        };
        const metric = makeSelect('Cách ghi nhận', [['check', 'Đánh dấu đã làm'], ['duration', 'Số phút'], ['quantity', 'Số lượng']], initial?.metric ?? 'check');
        const target = field('Mục tiêu mỗi ngày đạt', 'number', String((initial?.target ?? 100) / 100));
        target.input.min = '0.01'; target.input.max = '1000000'; target.input.step = '0.01'; target.input.inputMode = 'decimal';
        const unit = field('Đơn vị (trang, ly, km…)', 'text', initial?.unit ?? '', false); unit.input.maxLength = 20;
        const cadence = makeSelect('Lịch cam kết', [['daily', 'Mỗi ngày'], ['weekdays', 'Chọn các thứ'], ['weekly', 'Linh hoạt theo tuần']], initial?.cadence.kind ?? 'daily');
        const quota = field('Số ngày đạt mỗi tuần', 'number', String(initial?.cadence.quota ?? 3));
        quota.input.min = '1'; quota.input.max = '7'; quota.input.step = '1';
        const weekdaySet = new Set(initial?.cadence.weekdays ?? [0, 2, 4]), days = el('fieldset', undefined, 'habit-weekdays');
        days.append(el('legend', 'Những ngày cam kết'));
        habitWeekdays.forEach((label, index) => {
            const control = button(index === 6 ? 'CN' : 'T' + (index + 2), () => {
                weekdaySet.has(index) ? weekdaySet.delete(index) : weekdaySet.add(index);
                control.setAttribute('aria-pressed', String(weekdaySet.has(index)));
            }, 'secondary');
            control.setAttribute('aria-label', label); control.setAttribute('aria-pressed', String(weekdaySet.has(index))); days.append(control);
        });
        const note = field('Ghi chú', 'text', initial?.note ?? '', false); note.input.maxLength = 300;
        const explanation = el('p', '', 'hint habit-form-explanation');
        const update = () => {
            target.wrap.hidden = metric.input.value === 'check'; target.input.required = metric.input.value !== 'check';
            unit.wrap.hidden = metric.input.value !== 'quantity'; unit.input.required = metric.input.value === 'quantity';
            days.hidden = cadence.input.value !== 'weekdays'; quota.wrap.hidden = cadence.input.value !== 'weekly';
            quota.input.required = cadence.input.value === 'weekly';
            explanation.textContent = cadence.input.value === 'weekly' ? 'Làm vào bất kỳ ngày nào, mỗi ngày tính một lần. Cam kết mới áp dụng từ thứ Hai kế tiếp; hôm nay vẫn có thể theo dõi.' : 'Cam kết mới áp dụng từ ngày sinh hoạt kế tiếp. Mục tiêu hôm nay giữ nguyên.';
        };
        metric.input.addEventListener('change', update); cadence.input.addEventListener('change', update); update();
        form.append(name.wrap, metric.wrap, target.wrap, unit.wrap, cadence.wrap, days, quota.wrap, note.wrap, explanation);
        const controls = el('div', undefined, 'actions'), submit = el('button', view ? 'Lưu thay đổi' : 'Thêm thói quen', 'primary'); submit.type = 'submit';
        const archived = view && view.habit.archivedFrom !== null;
        if (!archived) controls.append(submit);
        if (view) controls.append(button(archived ? 'Khôi phục' : 'Lưu trữ', () => {
            const from = initial.cadence.kind === 'weekly' ? state.habitData.day.day - ((state.habitData.day.day + 3) % 7) + 7 : state.habitData.day.day + 1;
            confirm(archived ? 'Khôi phục thói quen?' : 'Lưu trữ thói quen?',
                (archived ? 'Hoạt động lại' : 'Ngừng theo dõi') + ' từ ' + habitDate(from) + '. Lịch sử được giữ; cam kết đang có vẫn tính đến mốc này.',
                () => save({ operation: archived ? 'restore' : 'archive', habitId: view.habit.id, version: view.habit.version }));
        }, 'text-button'));
        form.append(controls);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (cadence.input.value === 'weekdays' && !weekdaySet.size) { toast('Chọn ít nhất một ngày nhé.'); return; }
            const definition = { name: name.input.value, metric: metric.input.value,
                target: metric.input.value === 'check' ? 1 : target.input.valueAsNumber,
                unit: metric.input.value === 'duration' ? 'phút' : unit.input.value,
                cadence: cadence.input.value === 'weekly' ? { kind: 'weekly', quota: quota.input.valueAsNumber }
                    : cadence.input.value === 'weekdays' ? { kind: 'weekdays', weekdays: [...weekdaySet].sort() } : { kind: 'daily' }, note: note.input.value };
            await save(view ? { operation: 'update', habitId: view.habit.id, version: view.habit.version, definition } : { operation: 'create', definition });
        });
        sheetContent.append(form);
    }
    async function exportHabits() {
        if (!state.live || !state.habitData) return;
        const to = state.habitData.day.day, rows = []; let before = null;
        try {
            do {
                const params = new URLSearchParams({ from: String(to - 29), to: String(to), limit: '100' });
                if (state.habitHistoryId) params.set('habitId', state.habitHistoryId);
                if (before) params.set('before', before);
                const page = await liveRequest('habit-history?' + params); rows.push(...page.rows); before = page.next;
            } while (before && rows.length < 3000);
            const header = ['Ngày', 'Thói quen', 'Đã làm', 'Mục tiêu', 'Đơn vị', 'Trạng thái', 'Ghi chú'];
            const csv = [header, ...rows.map(row => [new Date(row.day * 86400000).toISOString().slice(0, 10), row.name,
                row.value / 100, row.definition.target / 100, row.definition.unit, row.status, row.note])]
                .map(row => row.map(safeCsvCell).join(',')).join('\r\n');
            const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })), link = el('a');
            link.href = url; link.download = 'thoi-quen-30-ngay.csv'; document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            toast('Đã xuất lịch sử 30 ngày.');
        } catch (error) { toast(error.message); }
    }
    return { loadHabits, openHabit, openHabitLog, toggleHabit, setHabitFilter, showHabitPanel, loadHabitHistory, exportHabits };
}
