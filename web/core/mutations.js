import { checkinProgress, rewardLabels } from '../models/cultivation.js';
import { settleRequest } from './http.js';
import { liveMutation, mapAccount, refreshLive } from './live-data.js';
import { applySnapshot } from './state.js';
export function createMutations({ state, runtime, sheet, render, toast, showBrowserLogin }) {
    async function performLive(path, input, options = {}) {
        if (runtime.saving)
            return null;
        runtime.saving = true;
        runtime.revision++;
        const controls = [...document.querySelectorAll('button')].map(button => ({ button, disabled: button.disabled }));
        const save = sheet.querySelector('button[type=submit]'), oldLabel = save?.textContent;
        if (save)
            save.textContent = 'Đang lưu…';
        controls.forEach(({ button }) => button.disabled = true);
        try {
            // Reconcile an acknowledged write before allowing another state-changing action.
            if (runtime.refreshPending) {
                applySnapshot(state, await refreshLive({ activeOffset: state.activeTasksOffset ?? 0 }));
                if (runtime.pendingReceipt)
                    settleRequest(runtime.pendingReceipt.path, runtime.pendingReceipt.input);
                runtime.pendingReceipt = null;
                runtime.refreshPending = false;
            }
            const includeHistory = path === 'tasks' || path === 'tasks-delete' || (state.tab === 'today' && state.mode === 'tasks');
            const refreshOptions = { includeHistory, activeOffset: state.activeTasksOffset ?? 0 };
            let data;
            if (options.effect) {
                const request = liveMutation(path, input, refreshOptions);
                const effect = Promise.resolve().then(options.effect);
                try {
                    data = await request;
                    await effect;
                }
                catch (error) {
                    await effect.catch(() => {
                    });
                    if (options.revertEffect)
                        await options.revertEffect();
                    throw error;
                }
            }
            else
                data = await liveMutation(path, input, refreshOptions);
            const result = data.result?.result ?? data.result;
            if (data.refreshError) {
                runtime.refreshPending = true;
                runtime.pendingReceipt = { path, input };
                // Display only changes explicitly acknowledged in the POST response.
                if (data.result?.account) {
                    state.cultivation = mapAccount(data.result.account, state.day?.day);
                    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
                    state.checkin = checkinProgress(state.cultivation, now, state.checkin?.rewards);
                }
                if (path === 'task-focus')
                    state.taskFocus = result.active ? { ...state.taskFocusTarget, ...result } : null;
                if (!options.keepSheet)
                    sheet.close();
                toast('Đã lưu trên server, nhưng chưa tải lại được dữ liệu. Mình sẽ kiểm tra lại trước thao tác tiếp theo.');
                return result;
            }
            applySnapshot(state, data);
            if (!options.keepSheet)
                sheet.close();
            if (!options.silent)
                toast(result?.reward ? 'Nhận ' + (rewardLabels[result.reward] ?? result.reward) : typeof result?.success === 'boolean' ? (result.success ? 'Thành công ✦' : 'Chưa thành công. Kết quả đã lưu, không thử lại trong cùng lượt.') : result?.protected ? 'Đã kích hoạt bảo vệ cho hôm nay.' : 'Đã lưu.');
            return result;
        }
        catch (error) {
            if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData) {
                showBrowserLogin();
                return null;
            }
            if (path === 'task-focus' || input.operation === 'checkin')
                try {
                    applySnapshot(state, await refreshLive({ activeOffset: state.activeTasksOffset ?? 0 }));
                }
                catch { /* Keep the original action error. */
                }
            toast(error.message || 'Chưa lưu được, kiểm tra lại nhé.');
            return null;
        }
        finally {
            if (save?.isConnected)
                save.textContent = oldLabel;
            runtime.saving = false;
            runtime.revision++;
            controls.forEach(({ button, disabled }) => {
                if (button.isConnected)
                    button.disabled = disabled;
            });
            render();
        }
    }
    return { performLive };
}
