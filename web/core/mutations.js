import { checkinProgress, rewardLabels } from '../models/cultivation.js';
import { settleRequest } from './http.js';
import { liveMutation, mapAccount, refreshLive } from './live-data.js';
import { applySnapshot } from './state.js';
export function createMutations({
  state,
  runtime,
  sheet,
  render,
  toast,
  showBrowserLogin,
  refreshOnReturn,
  ui,
}) {
  async function performLive(path, input, options = {}) {
    if (runtime.saving) return null;
    if (runtime.pendingBeast) {
      toast('Còn một giao ước chưa xác nhận. Vào Linh thú và bấm Kiểm tra kết quả trước nhé.');
      return null;
    }
    if (runtime.pendingDraw?.revision !== runtime.revision) runtime.pendingDraw = null;
    if (
      runtime.pendingDraw &&
      (path !== 'cultivation' ||
        input.operation !== 'draw' ||
        (input.count ?? 1) !== runtime.pendingDraw.count)
    ) {
      toast('Còn một lượt quay chưa xác nhận. Mở Quay thưởng và kiểm tra lại lượt đó trước nhé.');
      return null;
    }
    runtime.saving = true;
    runtime.revision++;
    const writeRevision = runtime.revision;
    const featureWrite = path === 'habits';
    const drawWrite = path === 'cultivation' && input.operation === 'draw';
    let drawAttempt;
    if (featureWrite) {
      state.featureSaving = { path, habitId: input.habitId ?? null };
      if (!sheet.open) render();
    }
    const editor = sheet.querySelector('#sheet-content')?.firstElementChild;
    const controls = [
      .../** @type {NodeListOf<HTMLButtonElement>} */ (
        document.querySelectorAll(
          featureWrite ? '[data-write], #sheet-content button, #logout' : 'button',
        )
      ),
    ].map((button) => ({ button, disabled: button.disabled }));
    const save = sheet.querySelector('button[type=submit]'),
      oldLabel = save?.textContent;
    if (save) save.textContent = 'Đang lưu…';
    controls.forEach(({ button }) => (button.disabled = true));
    try {
      // Reconcile an acknowledged write before allowing another state-changing action.
      if (runtime.refreshPending) {
        applySnapshot(
          state,
          await refreshLive({
            activeOffset: state.activeTasksOffset ?? 0,
            includeHabits: runtime.pendingReceipt?.path === 'habits' || state.tab === 'habits',
          }),
        );
        if (runtime.pendingReceipt)
          settleRequest(runtime.pendingReceipt.path, runtime.pendingReceipt.input);
        runtime.pendingReceipt = null;
        runtime.refreshPending = false;
      }
      const includeHistory =
        path === 'tasks' ||
        path === 'tasks-delete' ||
        (state.tab === 'today' && state.mode === 'tasks');
      const refreshOptions = {
        includeHistory,
        activeOffset: state.activeTasksOffset ?? 0,
        includeHabits: path === 'habits' || state.tab === 'habits',
        scope: drawWrite ? 'draw' : featureWrite ? path : 'all',
      };
      if (drawWrite) {
        drawAttempt = runtime.pendingDraw ?? {
          count: input.count ?? 1,
          revision: runtime.revision,
        };
        runtime.pendingDraw = drawAttempt;
      }
      let data;
      if (options.effect) {
        const request = liveMutation(path, input, refreshOptions);
        const effect = Promise.resolve().then(options.effect);
        try {
          data = await request;
          await effect;
        } catch (error) {
          await effect.catch(() => {});
          if (options.revertEffect) await options.revertEffect();
          throw error;
        }
      } else data = await liveMutation(path, input, refreshOptions);
      if ((featureWrite || path === 'cultivation') && writeRevision !== runtime.revision)
        return null;
      if (drawWrite && runtime.pendingDraw === drawAttempt) runtime.pendingDraw = null;
      const result = data.result?.result ?? data.result;
      if (data.refreshError) {
        if (featureWrite) state.baseDirty = true;
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
        if (
          !options.keepSheet &&
          (!featureWrite || sheet.querySelector('#sheet-content')?.firstElementChild === editor)
        )
          sheet.close();
        toast(
          'Đã lưu trên server, nhưng chưa tải lại được dữ liệu. Mình sẽ kiểm tra lại trước thao tác tiếp theo.',
        );
        return result;
      }
      if (data.accountOnly) {
        state.cultivation = mapAccount(data.result.account, state.day?.day);
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
        state.checkin = checkinProgress(state.cultivation, now, state.checkin?.rewards);
        // Reconcile the other screens later without blocking the confirmed draw.
        state.baseDirty = true;
      } else applySnapshot(state, data);
      if (featureWrite) ui?.loadTower?.();
      if (featureWrite && data.result?.account) {
        state.cultivation = mapAccount(data.result.account, state.day?.day);
      }
      if (
        !options.keepSheet &&
        (!featureWrite || sheet.querySelector('#sheet-content')?.firstElementChild === editor)
      )
        sheet.close();
      if (!options.silent)
        toast(
          result?.reward
            ? 'Nhận ' + (rewardLabels[result.reward] ?? result.reward)
            : typeof result?.success === 'boolean'
              ? result.success
                ? 'Thành công ✦'
                : 'Chưa thành công. Kết quả đã lưu, không thử lại trong cùng lượt.'
              : result?.protected
                ? 'Đã kích hoạt bảo vệ cho hôm nay.'
                : 'Đã lưu.',
        );
      return result;
    } catch (error) {
      if ((featureWrite || path === 'cultivation') && writeRevision !== runtime.revision)
        return null;
      if (
        drawAttempt &&
        !['NETWORK_UNCONFIRMED', 'OPERATION_NOT_CONFIRMED'].includes(error.code) &&
        runtime.pendingDraw === drawAttempt
      )
        runtime.pendingDraw = null;
      options.onError?.(error);
      if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData) {
        showBrowserLogin();
        return null;
      }
      if (path === 'task-focus' || input.operation === 'checkin')
        try {
          applySnapshot(state, await refreshLive({ activeOffset: state.activeTasksOffset ?? 0 }));
        } catch {
          /* Keep the original action error. */
        }
      toast(error.message || 'Chưa lưu được, kiểm tra lại nhé.');
      return null;
    } finally {
      const authChanged = writeRevision !== runtime.revision;
      if (save?.isConnected) save.textContent = oldLabel;
      runtime.saving = false;
      state.featureSaving = null;
      runtime.revision++;
      if (runtime.pendingDraw === drawAttempt && drawAttempt) {
        if (authChanged) runtime.pendingDraw = null;
        else drawAttempt.revision = runtime.revision;
      }
      controls.forEach(({ button, disabled }) => {
        if (button.isConnected) button.disabled = disabled;
      });
      render();
      if (featureWrite && (state.tab !== path || authChanged)) refreshOnReturn();
      if (drawWrite && !authChanged && !sheet.open && state.baseDirty) refreshOnReturn?.();
    }
  }
  return { performLive };
}
