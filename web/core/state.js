import { createDemo } from '../demo/state.js';
export function createAppState(live) {
  const state = createDemo();
  state.habitData = null;
  state.habitHistory = null;
  state.beastData = null;
  state.beastCollection = null;
  state.beastCollectionSpecies = null;
  state.beastSpeciesPage = null;
  state.beastSpeciesLoading = false;
  state.beastSpeciesError = null;
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
      inventory: { basic: 0, middle: 0, high: 0, supreme: 0, heart: 0, peace: 0, keepsake: 0 },
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
  };
}
/** Apply authoritative data without throwing away separately paged history. */
export function applySnapshot(state, snapshot) {
  const next = { ...snapshot };
  if (snapshot.historyRefreshed === false && snapshot.tasks) {
    const ids = new Set(snapshot.tasks.map((task) => task.id));
    next.tasks = [
      ...snapshot.tasks,
      ...state.tasks.filter((task) => task.done && !ids.has(task.id)),
    ];
  }
  Object.assign(state, next);
}
