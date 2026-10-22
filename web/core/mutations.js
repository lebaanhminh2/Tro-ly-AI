import { checkinProgress, rewardLabels } from '../models/cultivation.js';
import { settleRequest } from './http.js';
import { liveMutation, mapAccount, mapTask, refreshLive } from './live-data.js';
import { applySnapshot, claimWrite, releaseWrite, waitForWrite } from './state.js';

export function createMutations({
  state,
  runtime,
  sheet,
  render,
  toast,
  showBrowserLogin,
  refreshOnReturn,
}) {
  let refreshTimer;
  function scheduleRefresh(deferForSheet = false) {
    clearTimeout(refreshTimer);
    const session = runtime.session;
    refreshTimer = setTimeout(() => {
      if (
        session === runtime.session &&
        state.live &&
        state.loaded &&
        state.baseDirty &&
        (!deferForSheet || !sheet.open)
      )
        void refreshOnReturn?.({ force: true, background: true });
    }, 200);
  }
  async function performLive(path, input, options = {}) {
    const session = runtime.session;
    if (options.queue) {
      while (runtime.saving) await waitForWrite(runtime);
      if (session !== runtime.session || !state.live || !state.loaded) return null;
    } else if (runtime.saving) {
      toast('Thao tác trước đang được lưu. Bạn có thể tiếp tục xem các mục khác.');
      return null;
    }
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
    const writeToken = claimWrite(runtime);
    const writeRevision = ++runtime.revision;
    const featureWrite = path === 'habits';
    const drawWrite = path === 'cultivation' && input.operation === 'draw';
    const editor = sheet.querySelector('#sheet-content')?.firstElementChild;
    state.featureSaving = { path, habitId: input.habitId ?? null };
    // Only the submitted editor is busy. Navigation and queued checks stay usable.
    const controls = [
      .../** @type {NodeListOf<HTMLButtonElement|HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} */ (
        document.querySelectorAll(
          '#sheet-content button:not([data-sheet-close]), #sheet-content input, #sheet-content select, #sheet-content textarea',
        )
      ),
    ].map((control) => ({ control, disabled: control.disabled }));
    const save = sheet.querySelector('button[type=submit]'),
      oldLabel = save?.textContent;
    if (save) save.textContent = 'Đang lưu…';
    controls.forEach(({ control }) => (control.disabled = true));
    let drawAttempt;
    try {
      if (runtime.refreshPending) {
        const snapshot = await refreshLive({
          includeHistory: false,
          activeOffset: state.activeTasksOffset ?? 0,
          includeHabits: runtime.pendingReceipt?.path === 'habits' || state.tab === 'habits',
          scope: runtime.pendingReceipt?.path === 'habits' ? 'habits' : 'all',
        });
        if (writeRevision !== runtime.revision || session !== runtime.session) return null;
        applySnapshot(state, snapshot);
        if (runtime.pendingReceipt)
          settleRequest(runtime.pendingReceipt.path, runtime.pendingReceipt.input);
        runtime.pendingReceipt = null;
        runtime.refreshPending = false;
      }
      input = options.resolveInput?.() ?? input;
      if (drawWrite) {
        drawAttempt = runtime.pendingDraw ?? {
          count: input.count ?? 1,
          revision: runtime.revision,
        };
        runtime.pendingDraw = drawAttempt;
      }
      if (options.effect)
        void Promise.resolve()
          .then(options.effect)
          .catch(() => {});
      options.onRequest?.(input);
      const data = await liveMutation(path, input, { acknowledge: true });
      if (writeRevision !== runtime.revision || session !== runtime.session) return null;
      if (drawWrite && runtime.pendingDraw === drawAttempt) runtime.pendingDraw = null;
      const result = data.result?.result ?? data.result;
      let reconciled = false;
      if (data.result?.account?.state) {
        state.cultivation = mapAccount(data.result.account, state.day?.day);
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
        state.checkin = checkinProgress(state.cultivation, now, state.checkin?.rewards);
        reconciled = path === 'cultivation' || path === 'sleep';
      }
      if (path === 'task-focus') {
        state.taskFocus = result.active ? { ...state.taskFocusTarget, ...result } : null;
        reconciled = true;
      }
      if (path === 'tasks' && 'task' in data.result) {
        const task = data.result.task;
        const id = task?.id ?? input.taskId;
        const index = state.tasks.findIndex((item) => item.id === id);
        if (!task) state.tasks = state.tasks.filter((item) => item.id !== id);
        else if (index < 0) state.tasks.push(mapTask(task));
        else state.tasks[index] = mapTask(task);
        reconciled = true;
      }
      if (path === 'tasks-delete' && result.deleted === input.items?.length) {
        const ids = new Set(input.items.map((item) => item.id));
        state.tasks = state.tasks.filter((task) => !ids.has(task.id));
        reconciled = true;
      }
      if (path === 'sleep') {
        if (result.sleep) state.sleepStatus = result.sleep;
        if (result.rest) {
          state.rest = result.rest;
          state.resting = result.rest.reason !== 'active';
        }
      }
      if (featureWrite && input.operation === 'log' && Number.isSafeInteger(result.version)) {
        const view = state.habitData?.habits.find((item) => item.habit.id === input.habitId);
        if (view && state.habitData.day.day === input.day) {
          // The receipt confirms this exact normalized log and its new version.
          view.log = {
            value: Math.round(input.value * 100),
            note: input.note,
            version: result.version,
          };
          state.habitRefreshedAt = Date.now();
          reconciled = true;
        }
      }
      options.onCommitted?.(result, input, data.result);
      if (options.reconciled) reconciled = true;
      state.baseDirty = true;
      if (featureWrite) {
        state.towerRefreshedAt = 0;
        state.beastRefreshedAt = 0;
        if (input.operation !== 'log') state.habitRefreshedAt = 0;
      }
      if (!reconciled) {
        runtime.refreshPending = true;
        runtime.pendingReceipt = { path, input };
      }
      // A late save cannot close an editor opened in the meantime.
      if (!options.keepSheet && sheet.querySelector('#sheet-content')?.firstElementChild === editor)
        sheet.close();
      if (!options.silent)
        toast(
          result?.reward
            ? 'Nhận ' + (rewardLabels[result.reward] ?? result.reward)
            : typeof result?.success === 'boolean'
              ? result.success
                ? 'Thành công ✦'
                : 'Chưa thành công. Kết quả đã lưu.'
              : result?.protected
                ? 'Đã kích hoạt bảo vệ cho hôm nay.'
                : 'Đã lưu.',
          undefined,
          { kind: 'success' },
        );
      return result;
    } catch (error) {
      if (writeRevision !== runtime.revision || session !== runtime.session) return null;
      if (
        drawAttempt &&
        !['NETWORK_UNCONFIRMED', 'OPERATION_NOT_CONFIRMED'].includes(error.code) &&
        runtime.pendingDraw === drawAttempt
      )
        runtime.pendingDraw = null;
      options.onError?.(error, input);
      if (options.revertEffect)
        void Promise.resolve()
          .then(options.revertEffect)
          .catch(() => {});
      if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData) {
        showBrowserLogin();
        return null;
      }
      if (!options.handleError)
        toast(error.message || 'Chưa lưu được, kiểm tra lại nhé.', undefined, { kind: 'error' });
      return null;
    } finally {
      if (runtime.writeToken === writeToken) {
        const authChanged = writeRevision !== runtime.revision || session !== runtime.session;
        if (save?.isConnected) save.textContent = oldLabel;
        state.featureSaving = null;
        runtime.revision++;
        if (runtime.pendingDraw === drawAttempt && drawAttempt) {
          if (authChanged) runtime.pendingDraw = null;
          else drawAttempt.revision = runtime.revision;
        }
        controls.forEach(({ control, disabled }) => {
          if (control.isConnected) control.disabled = disabled;
        });
        releaseWrite(runtime, writeToken);
        render();
        if (!authChanged && (runtime.refreshPending || (!featureWrite && state.baseDirty)))
          scheduleRefresh(drawWrite);
      }
    }
  }
  return { performLive };
}
