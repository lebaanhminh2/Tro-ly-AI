import { button, el, empty, heading } from '../ui/dom.js';
import { focusEffect } from '../ui/effects.js';
import { renderAchievements } from '../views/achievements.js';
import { renderReminders } from '../views/reminders.js';
import { updateTimelineClock } from '../views/timeline.js';
import { renderToday } from '../views/today.js';
import { renderHabits } from '../views/habits.js';
import { settleRequest } from './http.js';
import { connectLive, refreshLive } from './live-data.js';
import { applySnapshot } from './state.js';
export function createLifecycle({ state, runtime, ui, content, sheet, renderBrowserLogin, showBrowserLogin, connected, toast }) {
    let focusExpiryTimer, refreshing = false, lastRefresh = 0;
    async function expireTaskFocus() {
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
        if (!state.taskFocus || state.taskFocus.endsAt > now) {
            render();
            refreshOnReturn();
            return;
        }
        if (runtime.saving || runtime.focusAnimating) {
            focusExpiryTimer = setTimeout(expireTaskFocus, 150);
            return;
        }
        runtime.focusAnimating = true;
        const target = document.querySelector('.focus-flip-card.is-focused');
        if (target) {
            target.disabled = true;
            await focusEffect(target);
        }
        state.taskFocus = null;
        runtime.focusAnimating = false;
        render();
        refreshOnReturn();
    }
    function render() {
        if (runtime.focusAnimating)
            return;
        clearTimeout(focusExpiryTimer);
        const previousScroll = document.querySelector('.time-scroll');
        if (previousScroll)
            state.timelineScroll = previousScroll.scrollTop;
        content.removeAttribute('aria-busy');
        for (const b of document.querySelectorAll('[data-tab]')) {
            if (b.dataset.tab === state.tab)
                b.setAttribute('aria-current', 'page');
            else
                b.removeAttribute('aria-current');
        }
        content.replaceChildren();
        const login = state.live && state.screenState === 'login';
        document.body.classList.toggle('login-screen', login);
        document.querySelector('#settings').disabled = state.live && !state.loaded;
        document.querySelector('#logout').hidden = !state.live || !state.loaded || !!globalThis.Telegram?.WebApp?.initData;
        if (login) {
            content.append(renderBrowserLogin());
            return;
        }
        if (state.live && !state.loaded && state.screenState === 'error') {
            content.append(heading('Chưa kết nối được', 'Cậu kiểm tra kết nối rồi thử lại nhé.'), button('Thử lại', startConnection, 'primary'));
            return;
        }
        if (state.screenState === 'empty')
            content.append(heading('Bắt đầu nhẹ thôi.', 'Mọi thứ sẽ hiện ở đây khi cậu thêm dữ liệu.'), empty('Một khoảng mới cho cậu', 'Không có biểu đồ rỗng hay thành tích được bịa ra.', () => {
                state.screenState = 'ready';
                render();
            }, 'Xem dữ liệu mẫu'));
        else if (state.screenState === 'error')
            content.append(heading('Chưa tải được dữ liệu', 'Đây là trạng thái lỗi giả lập.'), empty('Không có thay đổi nào được lưu', 'Trong bản thật, thử lại sẽ giữ nguyên thao tác đang làm.', () => {
                state.screenState = 'ready';
                render();
            }, 'Thử lại'));
        else if (state.screenState === 'loading') {
            content.append(heading('Minh Anh đang chuẩn bị…', 'Trạng thái tải giả lập'), el('div', undefined, 'loading'));
            content.setAttribute('aria-busy', 'true');
        }
        else {
            content.removeAttribute('aria-busy');
            content.append(state.tab === 'today' ? renderToday(ui, state) : state.tab === 'habits' ? renderHabits(ui, state) : state.tab === 'reminders' ? renderReminders(ui, state) : renderAchievements(ui, state));
        }
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
        const boundaries = (state.dailyPlan?.plan?.items ?? []).flatMap(item => (item.windows ?? []).flatMap(slot => [slot.start, slot.end]));
        if (state.taskFocus)
            boundaries.push(state.taskFocus.endsAt);
        const nextBoundary = Math.min(...boundaries.filter(at => at > now));
        if (Number.isFinite(nextBoundary))
            focusExpiryTimer = setTimeout(expireTaskFocus, Math.max(0, Math.min(2147483647, nextBoundary - now + 20)));
        const controls = el('div', undefined, 'demo-controls');
        for (const [mode, label] of [['ready', 'Có dữ liệu'], ['empty', 'Trống'], ['loading', 'Đang tải'], ['error', 'Lỗi']])
            controls.append(button(label, () => {
                state.screenState = mode;
                render();
            }, 'text-button'));
        controls.append(button('Sáng / tối', () => {
            const dark = document.documentElement.dataset.theme === 'dark';
            document.documentElement.dataset.theme = dark ? 'light' : 'dark';
        }, 'text-button'), button('Xem chế độ nghỉ', () => {
            state.resting = !state.resting;
            state.tab = 'today';
            state.screenState = 'ready';
            render();
        }, 'text-button'));
        if (!state.live)
            content.append(controls);
    }
    async function refreshOnReturn() {
        if (!state.live || !state.loaded || runtime.saving || runtime.focusAnimating || refreshing || sheet.open || state.timelineDragging || state.historyLoading || state.activeTasksLoading || Date.now() - lastRefresh < 2000)
            return;
        refreshing = true;
        const revision = runtime.revision;
        try {
            const latest = await refreshLive({ activeOffset: state.activeTasksOffset ?? 0, includeHabits: state.tab === 'habits' });
            // A newer write, logout or open editor makes this response obsolete.
            if (revision !== runtime.revision || runtime.saving || !state.loaded || sheet.open || state.timelineDragging || state.historyLoading || state.activeTasksLoading)
                return;
            applySnapshot(state, latest);
            if (runtime.pendingReceipt)
                settleRequest(runtime.pendingReceipt.path, runtime.pendingReceipt.input);
            runtime.pendingReceipt = null;
            runtime.refreshPending = false;
            lastRefresh = Date.now();
            render();
        }
        catch (error) {
            if (revision !== runtime.revision)
                return;
            if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData)
                showBrowserLogin();
            else
                toast(error.message);
        }
        finally {
            refreshing = false;
        }
    }
    function startConnection() {
        document.querySelector('.demo-strip').textContent = 'MINH ANH · Dữ liệu của cậu';
        state.tasks = [];
        state.reminders = [];
        state.screenState = 'loading';
        render();
        const revision = ++runtime.revision;
        connectLive().then(data => {
            if (revision !== runtime.revision)
                return;
            globalThis.Telegram?.WebApp?.onEvent?.('activated', refreshOnReturn);
            connected(data);
        }).catch(error => {
            if (revision !== runtime.revision)
                return;
            if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData)
                showBrowserLogin();
            else {
                state.screenState = 'error';
                render();
                toast(error.message);
            }
        });
    }
    function installLifecycleEvents() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible')
                refreshOnReturn();
        });
        setInterval(() => {
            if (document.visibilityState === 'visible')
                updateTimelineClock(state);
        }, 15000);
        setInterval(() => {
            if (document.visibilityState === 'visible')
                refreshOnReturn();
        }, 60000);
        window.addEventListener('focus', refreshOnReturn);
    }
    return { render, refreshOnReturn, startConnection, installLifecycleEvents };
}
