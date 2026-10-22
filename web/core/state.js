import { createDemo } from '../demo/state.js';
export function createAppState(live) {
  const state = createDemo();
  state.habitData = null;
  state.habitHistory = null;
  state.beastData = null;
  state.beastV2 = null;
  state.beastCollection = null;
  state.beastCollectionSpecies = null;
  state.beastSpeciesPage = null;
  state.beastSpeciesLoading = false;
  state.beastSpeciesError = null;
  state.beastSacrifice = null;
  state.beastTower = null;
  state.beastPanel = 'training';
  state.live = live;
  if (live) {
    state.tasks = [];
    state.reminders = [];
    state.cultivation = {
      ...state.cultivation,
      qi: 0,
      totalEarned: 0,
      rank: 0,
      highestRank: 0,
      streak: 0,
      tickets: 0,
      inventory: {
        basic: 0,
        middle: 0,
        high: 0,
        supreme: 0,
        immortal: 0,
        heart: 0,
        peace: 0,
        keepsake: 0,
      },
    };
  }
  return state;
}
export function createRuntimeState() {
  return {
    saving: false,
    focusAnimating: false,
    revision: 0,
    refreshPending: false,
    pendingReceipt: null,
    session: 0,
    writeWaiters: new Set(),
  };
}
export function waitForWrite(runtime) {
  if (!runtime.saving) return Promise.resolve();
  return new Promise((resolve) => (runtime.writeWaiters ??= new Set()).add(resolve));
}
export function claimWrite(runtime) {
  const token = {};
  runtime.writeToken = token;
  runtime.saving = true;
  return token;
}
export function releaseWrite(runtime, token = runtime.writeToken) {
  if (runtime.writeToken !== token) return;
  runtime.saving = false;
  runtime.writeToken = null;
  for (const resolve of runtime.writeWaiters ?? []) resolve();
  runtime.writeWaiters?.clear();
}
/** Apply authoritative data without throwing away separately paged history. */
export function applySnapshot(state, snapshot) {
  const next = { ...snapshot };
  if (next.habitData) {
    const now =
      next.habitData.now ??
      (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    next.habitExpiresAt = Date.now() + next.habitData.day.endAt - now;
  }
  if (snapshot.historyRefreshed === false && snapshot.tasks) {
    const ids = new Set(snapshot.tasks.map((task) => task.id));
    next.tasks = [
      ...snapshot.tasks,
      ...state.tasks.filter((task) => task.done && !ids.has(task.id)),
    ];
  }
  Object.assign(state, next);
}
