import { button, el } from '../ui/dom.js';
import { refreshLive } from '../core/live-data.js';
import { applySnapshot } from '../core/state.js';
const clock = value => new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
export function createSleepActions(context) {
    const { state, runtime, performLive, toast, render } = context;
    const now = () => (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    let expiryTimer;
    function renderSleepControls() {
        clearTimeout(expiryTimer);
        const root = el('section', undefined, 'settings-sleep-controls');
        root.setAttribute('aria-label', 'Ngủ và nghỉ ngơi');
        function draw() {
            root.replaceChildren();
            const sleep = state.sleepStatus ?? { asleep: state.rest?.reason === 'asleep', until: state.rest?.until, reportedAt: state.rest?.reportedAt, canUndo: false };
            const asleep = sleep.asleep && (!sleep.until || sleep.until > now());
            const row = el('div', undefined, 'settings-sleep-row'), copy = el('div', undefined, 'settings-sleep-copy');
            const label = el('p', asleep ? 'Đang ngủ' + (Number.isFinite(sleep.reportedAt) ? ' · từ ' + clock(sleep.reportedAt) : '') : 'Nghỉ ngơi', 'settings-sleep-label');
            label.setAttribute('role', 'status');
            copy.append(label, el('p', asleep ? 'Các lời nhắc đã đặt vẫn theo lịch.' : 'Đi ngủ khi cậu sẵn sàng nghỉ.', 'hint'));
            row.append(copy);
            const canUndo = asleep && sleep.canUndo && sleep.undoUntil > now();
            if (!asleep || canUndo) {
                const action = button(asleep ? 'Hoàn tác' : 'Đi ngủ', () => confirmAction(asleep ? 'undo' : 'report', sleep), asleep ? 'text-button sleep-undo' : 'secondary sleep-report');
                action.disabled = !state.live || state.needsSetup || runtime.saving || runtime.refreshPending;
                row.append(action);
            }
            root.append(row);
            if (canUndo) {
                root.append(el('p', 'Có thể hủy đến ' + clock(sleep.undoUntil), 'hint sleep-undo-limit'));
            }
            const boundary = Math.min(canUndo ? sleep.undoUntil : Infinity, asleep ? sleep.until ?? Infinity : Infinity);
            if (Number.isFinite(boundary)) {
                clearTimeout(expiryTimer);
                expiryTimer = setTimeout(() => { if (root.isConnected) draw(); }, Math.max(1, Math.min(2147483647, boundary - now() + 20)));
            }
            if (!state.live || state.needsSetup)
                root.append(el('p', !state.live ? 'Mở ứng dụng đã kết nối để ghi nhận giờ ngủ.' : 'Lưu giờ sinh hoạt trước để bắt đầu nhé.', 'hint'));
        }
        function confirmAction(operation, sleep) {
            if (runtime.saving || runtime.refreshPending)
                return;
            root.replaceChildren(el('h3', operation === 'undo' ? 'Hoàn tác báo ngủ?' : 'Đi ngủ bây giờ?', 'sleep-confirm-title'),
                el('p', operation === 'undo' ? 'Lần báo ngủ này sẽ được hủy, kể cả thưởng/phạt đi kèm.' : 'Tớ sẽ ngừng nhắc công việc. Các lời nhắc cậu đã đặt vẫn theo lịch.', 'hint'));
            const actions = el('div', undefined, 'actions sleep-confirm-actions');
            const confirm = button(operation === 'undo' ? 'Hoàn tác' : 'Đi ngủ', async () => {
                if (runtime.saving)
                    return;
                const input = operation === 'undo' ? { operation, generation: sleep.generation } : { operation };
                const result = await performLive('sleep', input, { keepSheet: true, silent: true });
                if (result) {
                    // These fields are acknowledged by the server even if the refresh fails.
                    if (result.sleep)
                        state.sleepStatus = result.sleep;
                    if (result.rest) {
                        state.rest = result.rest;
                        state.resting = result.rest.reason !== 'active';
                    }
                    if (runtime.refreshPending)
                        render();
                    if (!runtime.refreshPending)
                        toast(operation === 'undo' ? 'Đã hoàn tác báo ngủ.' : 'Ngủ ngon nhé 🌙');
                }
                else if (operation === 'undo' && state.live && state.loaded) {
                    const revision = runtime.revision;
                    try {
                        const latest = await refreshLive({ includeHistory: false, activeOffset: state.activeTasksOffset ?? 0 });
                        if (runtime.revision === revision && !runtime.saving) {
                            applySnapshot(state, latest);
                            render();
                        }
                    }
                    catch { /* Keep the original error and retry identity. */ }
                }
                if (root.isConnected)
                    draw();
            }, 'primary');
            actions.append(button(operation === 'undo' ? 'Giữ nguyên' : 'Để sau', draw, 'secondary'), confirm);
            root.append(actions);
            confirm.focus({ preventScroll: true });
        }
        draw();
        return root;
    }
    return { renderSleepControls };
}
