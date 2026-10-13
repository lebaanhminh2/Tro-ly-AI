import { browserAuthRequest } from './core/http.js';
import { createLifecycle } from './core/lifecycle.js';
import { createMutations } from './core/mutations.js';
import { createAppState, createRuntimeState } from './core/state.js';
import { applyTheme } from './core/theme.js';
import { applyExperiencePreferences, experienceStorageKey, reloadExperiencePreferences } from './core/experience.js';
import { createBrowserLoginActions } from './features/browser-login.js';
import { createCultivationActions } from './features/cultivation.js';
import { createReminderActions } from './features/reminders.js';
import { createScheduleActions } from './features/schedule.js';
import { createSleepActions } from './features/sleep.js';
import { createTaskActions } from './features/tasks.js';
import { createTodayPlanActions } from './features/today-plan.js';
import { createHabitActions } from './features/habits.js';
import { createGameActions } from './features/game.js';
import { createGameGuideActions } from './features/game-guide.js';
import { createGameExportActions } from './features/game-export.js';
import { createBattleActions } from './features/battle.js';
import * as dom from './ui/dom.js';
import { createFeedback } from './ui/feedback.js';
import { createSheets } from './ui/sheets.js';
// Composition root: connect controllers, do not put feature behavior here.
const state = createAppState(location.pathname.startsWith('/app/'));
const runtime = createRuntimeState();
const content = document.querySelector('#content'), sheet = document.querySelector('#sheet'), sheetContent = document.querySelector('#sheet-content');
const actions = {};
const forward = {};
for (const name of ['loadGame', 'loadGameVictories', 'showGamePanel', 'openTechnique', 'selectGameSchool', 'stopPractice', 'followGameGoal', 'chooseBattle', 'cancelBattle', 'withdrawBattle', 'rescueBattle', 'acceptBattleDeath', 'prepareBoss', 'openBattleHistory', 'openBattleExchange', 'openGameChapter', 'selectGameChapter', 'openBattleArchive', 'openGameGuide', 'dismissGameGuide', 'openGameExport'])
    forward[name] = (...args) => actions[name](...args);
for (const name of ['loadHabits', 'openHabit', 'openHabitDetails', 'openHabitLog', 'openHabitSlot', 'showHabitInList', 'toggleHabit', 'setHabitFilter', 'showHabitPanel', 'loadHabitHistory', 'setHabitReportSpan', 'setHabitHistoryStatus', 'exportHabits', 'openHabitExport'])
    forward[name] = (...args) => actions[name](...args);
forward.loadActiveTasks = (...args) => actions.loadActiveTasks(...args);
forward.renderSleepControls = (...args) => actions.renderSleepControls(...args);
for (const name of ["render", "toast", "openSheet", "closeSheet", "confirm", "performLive", "toggleTask", "openTask", "confirmDelete", "loadHistory", "toggleTaskFocus", "openTodayPlan", "openReminder", "openSettings", "openAvailability", "openShare", "demoDay", "claimCheckin", "openRewardCalendar", "openDailyReward", "openDraw", "openInventory", "openBreakthrough", "showBrowserLogin", "connected", "renderBrowserLogin", "refreshOnReturn", "startConnection"])
    forward[name] = (...args) => actions[name](...args);
const ui = { ...dom, ...forward, state: () => state, cultivation: () => state.cultivation, keepViewAnchor(node, top) {
        if (Number.isFinite(top))
            window.scrollBy({ top: node.getBoundingClientRect().top - top, behavior: 'instant' });
    } };
const context = { state, runtime, ui, content, sheet, sheetContent, ...forward };
Object.assign(actions, createFeedback(context));
Object.assign(actions, createSheets(context));
Object.assign(actions, createMutations(context));
Object.assign(actions, createTaskActions(context));
Object.assign(actions, createTodayPlanActions(context));
Object.assign(actions, createReminderActions(context));
Object.assign(actions, createScheduleActions(context));
Object.assign(actions, createSleepActions(context));
Object.assign(actions, createCultivationActions(context));
Object.assign(actions, createHabitActions(context));
Object.assign(actions, createGameActions(context));
Object.assign(actions, createGameGuideActions(context));
Object.assign(actions, createGameExportActions(context));
Object.assign(actions, createBattleActions(context));
Object.assign(actions, createBrowserLoginActions(context));
Object.assign(actions, createLifecycle(context));
applyTheme();
applyExperiencePreferences();
window.addEventListener('storage', event => {
    if (event.key === experienceStorageKey || event.key === null) { reloadExperiencePreferences(); actions.render(); }
});
actions.installSheetEvents();
actions.installLifecycleEvents();
document.querySelector('#settings').replaceChildren(dom.icon('settings'));
document.querySelector('#settings').addEventListener('click', actions.openSettings);
document.querySelector('#logout').addEventListener('click', async () => {
    const control = document.querySelector('#logout');
    control.disabled = true;
    try {
        await browserAuthRequest('logout');
        actions.showBrowserLogin();
    }
    catch (error) {
        actions.toast(error.message);
    }
    finally {
        control.disabled = false;
    }
});
for (const b of document.querySelectorAll('[data-tab]'))
    b.addEventListener('click', () => {
        if (state.live && !state.loaded) {
            actions.toast('Mở lại từ Telegram để tải dữ liệu thật.');
            return;
        }
        state.tab = b.dataset.tab;
        state.screenState = 'ready';
        actions.render();
        actions.refreshOnReturn();
        if (state.tab !== 'habits' && state.tab !== 'game') window.scrollTo(0, 0);
    });
if (state.live)
    actions.startConnection();
else
    actions.render();
