import { button, el, empty, heading } from '../ui/dom.js';
import { focusEffect } from '../ui/effects.js';
import { renderAchievements } from '../views/achievements.js';
import { renderReminders } from '../views/reminders.js';
import { updateTimelineClock } from '../views/timeline.js';
import { renderToday } from '../views/today.js';
import { renderHabits } from '../views/habits.js';
import { renderBeasts, reconcileBeasts } from '../views/linh-thu.js';
import { settleRequest } from './http.js';
import { refreshLive } from './live-data.js';
import { takeStartupConnection } from './startup.js';
import { applySnapshot } from './state.js';
export function createLifecycle({
  state,
  runtime,
  ui,
  content,
  sheet,
  renderBrowserLogin,
  showBrowserLogin,
  connected,
  toast,
}) {
  let focusExpiryTimer,
    refreshing = false,
    lastRefresh = 0;
  const featureScroll = new Map();
  let renderedScreen = null;
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
    const target = /** @type {HTMLButtonElement|null} */ (
      document.querySelector('.focus-flip-card.is-focused')
    );
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
    if (runtime.focusAnimating) return;
    if (renderedScreen) featureScroll.set(renderedScreen, window.scrollY);
    clearTimeout(focusExpiryTimer);
    if (!['today', 'habits', 'reminders', 'achievements', 'beasts'].includes(state.tab))
      state.tab = 'today';
    const screen =
      state.tab === 'habits'
        ? 'habits:' + (state.habitPanel ?? 'today') + ':' + (state.habitFilter ?? 'active')
        : state.tab === 'beasts'
          ? ['training', 'companion'].includes(state.beastPanel ?? 'training')
            ? 'beasts:roles'
            : 'beasts:' + state.beastPanel + ':' + (state.beastCollectionSpecies ?? '')
          : state.tab;
    const previousScroll = document.querySelector('.time-scroll');
    if (previousScroll) state.timelineScroll = previousScroll.scrollTop;
    content.removeAttribute('aria-busy');
    for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (
      document.querySelectorAll('[data-tab]')
    )) {
      if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    const previousBeasts =
      state.tab === 'beasts' && state.screenState === 'ready'
        ? content.querySelector(':scope > .beast-page')
        : null;
    if (!previousBeasts) content.replaceChildren();
    else for (const child of [...content.children]) if (child !== previousBeasts) child.remove();
    const login = state.live && state.screenState === 'login';
    document.body.classList.toggle('login-screen', login);
    document.body.classList.toggle('live-app', state.live);
    document.body.classList.toggle(
      'app-ready',
      state.screenState === 'ready' && (!state.live || state.loaded),
    );
    document.body.classList.toggle(
      'browser-session',
      state.live && state.loaded && !globalThis.Telegram?.WebApp?.initData,
    );
    /** @type {HTMLButtonElement} */ (document.querySelector('button#settings')).disabled =
      state.live && !state.loaded;
    /** @type {HTMLButtonElement} */ (document.querySelector('button#logout')).hidden =
      !state.live || !state.loaded || !!globalThis.Telegram?.WebApp?.initData;
    if (login) {
      content.append(renderBrowserLogin());
      return;
    }
    if (state.live && !state.loaded && state.screenState === 'error') {
      content.append(
        heading('Chưa kết nối được', 'Cậu kiểm tra kết nối rồi thử lại nhé.'),
        button('Thử lại', startConnection, 'primary'),
      );
      return;
    }
    if (state.screenState === 'empty')
      content.append(
        heading('Bắt đầu nhẹ thôi.', 'Mọi thứ sẽ hiện ở đây khi cậu thêm dữ liệu.'),
        empty(
          'Một khoảng mới cho cậu',
          'Không có biểu đồ rỗng hay thành tích được bịa ra.',
          () => {
            state.screenState = 'ready';
            render();
          },
          'Xem dữ liệu mẫu',
        ),
      );
    else if (state.screenState === 'error')
      content.append(
        heading('Chưa tải được dữ liệu', 'Đây là trạng thái lỗi giả lập.'),
        empty(
          'Không có thay đổi nào được lưu',
          'Trong bản thật, thử lại sẽ giữ nguyên thao tác đang làm.',
          () => {
            state.screenState = 'ready';
            render();
          },
          'Thử lại',
        ),
      );
    else if (state.screenState === 'loading') {
      content.append(
        heading('Minh Anh đang chuẩn bị…', 'Trạng thái tải giả lập'),
        el('div', undefined, 'loading'),
      );
      content.setAttribute('aria-busy', 'true');
    } else {
      content.removeAttribute('aria-busy');
      const view =
        state.tab === 'today'
          ? renderToday(ui, state)
          : state.tab === 'habits'
            ? renderHabits(ui, state)
            : state.tab === 'beasts'
              ? reconcileBeasts(previousBeasts, renderBeasts(ui, state))
              : state.tab === 'reminders'
                ? renderReminders(ui, state)
                : renderAchievements(ui, state);
      if (view.parentNode !== content) content.append(view);
    }
    const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
    const boundaries = (state.dailyPlan?.plan?.items ?? []).flatMap((item) =>
      (item.windows ?? []).flatMap((slot) => [slot.start, slot.end]),
    );
    if (state.taskFocus) boundaries.push(state.taskFocus.endsAt);
    const nextBoundary = Math.min(...boundaries.filter((at) => at > now));
    if (Number.isFinite(nextBoundary))
      focusExpiryTimer = setTimeout(
        expireTaskFocus,
        Math.max(0, Math.min(2147483647, nextBoundary - now + 20)),
      );
    const controls = el('div', undefined, 'demo-controls');
    for (const [mode, label] of [
      ['ready', 'Có dữ liệu'],
      ['empty', 'Trống'],
      ['loading', 'Đang tải'],
      ['error', 'Lỗi'],
    ])
      controls.append(
        button(
          label,
          () => {
            state.screenState = mode;
            render();
          },
          'text-button',
        ),
      );
    controls.append(
      button(
        'Sáng / tối',
        () => {
          const dark = document.documentElement.dataset.theme === 'dark';
          document.documentElement.dataset.theme = dark ? 'light' : 'dark';
        },
        'text-button',
      ),
      button(
        'Xem chế độ nghỉ',
        () => {
          state.resting = !state.resting;
          state.tab = 'today';
          state.screenState = 'ready';
          render();
        },
        'text-button',
      ),
    );
    if (!state.live) content.append(controls);
    renderedScreen = screen;
    if (screen) window.scrollTo({ top: featureScroll.get(screen) ?? 0, behavior: 'instant' });
  }
  async function refreshOnReturn({ force = false, background = false } = {}) {
    if (
      !state.live ||
      !state.loaded ||
      runtime.saving ||
      runtime.focusAnimating ||
      (sheet.open && !background) ||
      state.timelineDragging ||
      state.historyLoading ||
      state.activeTasksLoading
    )
      return;
    if (!runtime.refreshPending && state.tab === 'habits' && !background) {
      ui.loadTower?.(force);
      return ui.loadHabits(force);
    }
    if (!runtime.refreshPending && state.tab === 'beasts' && !background)
      return ui.loadBeasts(false, 'inventory', force);
    if (
      refreshing ||
      (!force && !state.baseDirty && Date.now() - (state.baseRefreshedAt ?? lastRefresh) < 15000)
    )
      return;
    refreshing = true;
    const revision = runtime.revision;
    try {
      const latest = await refreshLive({
        activeOffset: state.activeTasksOffset ?? 0,
        includeHabits: state.tab === 'habits' || runtime.pendingReceipt?.path === 'habits',
        includeHistory: state.mode === 'tasks' && !!state.historyRefreshed,
        scope: runtime.pendingReceipt?.path === 'habits' ? 'habits' : 'all',
      });
      // A newer write, logout or open editor makes this response obsolete.
      if (
        revision !== runtime.revision ||
        runtime.saving ||
        !state.loaded ||
        (sheet.open && !background) ||
        state.timelineDragging ||
        state.historyLoading ||
        state.activeTasksLoading
      )
        return;
      applySnapshot(state, latest);
      if (runtime.pendingReceipt)
        settleRequest(runtime.pendingReceipt.path, runtime.pendingReceipt.input);
      runtime.pendingReceipt = null;
      runtime.refreshPending = false;
      runtime.refreshNotice = false;
      lastRefresh = Date.now();
      render();
    } catch (error) {
      if (revision !== runtime.revision) return;
      if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData)
        showBrowserLogin();
      else if (!background) toast(error.message);
      else if (runtime.refreshPending && !runtime.refreshNotice) {
        runtime.refreshNotice = true;
        toast('Đã lưu trên server. Chưa tải lại được dữ liệu.', {
          label: 'Tải lại',
          run: () => refreshOnReturn({ force: true, background: true }),
        });
      }
    } finally {
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
    takeStartupConnection()
      .then((data) => {
        if (revision !== runtime.revision) return;
        globalThis.Telegram?.WebApp?.onEvent?.('activated', () => refreshOnReturn({ force: true }));
        connected(data);
        globalThis.Telegram?.WebApp?.ready();
      })
      .catch((error) => {
        if (revision !== runtime.revision) return;
        if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData)
          showBrowserLogin();
        else {
          state.screenState = 'error';
          render();
          toast(error.message);
        }
        globalThis.Telegram?.WebApp?.ready();
      });
  }
  function installLifecycleEvents() {
    const navigation = document.querySelector('.bottom-nav');
    const measureNavigation = () => {
      document.documentElement.style.setProperty(
        '--app-nav-height',
        navigation.getBoundingClientRect().height + 'px',
      );
    };
    new ResizeObserver(measureNavigation).observe(navigation);
    measureNavigation();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshOnReturn({ force: true });
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') updateTimelineClock(state);
    }, 15000);
    setInterval(() => {
      if (document.visibilityState === 'visible') refreshOnReturn();
    }, 60000);
    window.addEventListener('focus', () => refreshOnReturn({ force: true }));
  }
  return { render, refreshOnReturn, startConnection, installLifecycleEvents };
}
