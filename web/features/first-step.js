import { liveRequest, requestIdentity } from '../core/http.js';
import { prefersReducedMotion } from '../core/experience.js';
import { firstStepClock, readFirstStepIntent } from '../models/first-step.js';
import { firstStepEntry, firstStepInner } from '../views/first-step.js';
import { createFirstStepMotion } from '../ui/first-step-motion.js';

/** @typedef {{id:string,source:string,status:string,version:number,startedAt:number,endsAt:number}} Occurrence */
/** @typedef {{owner:string,operation:string,occurrenceId:string,requestId:string}} Intent */

export function createFirstStepActions({ state, runtime, performLive, toast, showBrowserLogin }) {
  let entry = null,
    events = null,
    ticker = 0,
    transition = 0,
    rewardTimer = 0;
  let owner = null,
    loaded = false,
    refreshing = false,
    refreshRequested = false,
    lastRead = 0,
    generation = 0;
  /** @type {Occurrence|null} */
  let active = null;
  /** @type {Intent|null} */
  let pending = null;
  let outsideId = null,
    view = null,
    message = '',
    heldKey = null,
    hold = null,
    frame = 0;
  const clock = firstStepClock(),
    inFlight = new Set(),
    sentAt = new Map();
  const tabId = (() => {
    try {
      const key = 'minh-anh-first-step-tab';
      const id = sessionStorage.getItem(key) ?? crypto.randomUUID();
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  })();
  const motion = createFirstStepMotion(
    () => entry,
    () => ({
      coin: state.cultivation.qi,
      ticket: state.cultivation.tickets,
    }),
  );
  const ownerKey = () => 'minh-anh-first-step-v1:' + owner;
  const storageKey = () => ownerKey() + ':' + tabId;
  const currentState = () =>
    view ?? (active ? (active.endsAt <= clock.now() ? 'ready' : 'running') : 'idle');

  function announce(text) {
    const node = entry?.querySelector('.pb-announcer');
    if (node) node.textContent = text;
  }
  function storeIntent(intent) {
    pending = intent;
    runtime.pendingFirstStep = intent ? { input: inputOf(intent), session: runtime.session } : null;
    if (!owner) return;
    let saved = false;
    for (const name of ['sessionStorage', 'localStorage']) {
      try {
        const storage = globalThis[name];
        if (intent) storage.setItem(storageKey(), JSON.stringify(intent));
        else storage.removeItem(storageKey());
        saved = true;
      } catch {
        // The server remains authoritative if a browser disallows persistence.
      }
    }
    if (!saved && intent)
      message = 'Trình duyệt chưa lưu được thao tác. Giữ app mở để kiểm tra kết quả.';
  }
  function restoredIntent() {
    for (const name of ['sessionStorage', 'localStorage']) {
      try {
        const storage = globalThis[name];
        const value = readFirstStepIntent(JSON.parse(storage.getItem(storageKey())), owner);
        if (value) return value;
      } catch {
        // Ignore malformed local data. Never use the prototype's local wallet.
      }
    }
    return null;
  }
  const inputOf = (intent) => ({ operation: intent.operation, occurrenceId: intent.occurrenceId });
  function intentFor(operation, occurrenceId) {
    const input = { operation, occurrenceId };
    return { owner, ...input, requestId: requestIdentity('first-step', input) };
  }
  function notifyTabs() {
    try {
      localStorage.setItem(ownerKey() + ':changed', crypto.randomUUID());
    } catch {
      /* A focus/return read also reconciles tabs without storage access. */
    }
  }
  function updateTime() {
    const node = entry?.querySelector('.pb-clock');
    if (!node || !active) return;
    const seconds = Math.max(0, Math.ceil((active.endsAt - clock.now()) / 1000));
    node.textContent =
      String(Math.floor(seconds / 60)).padStart(2, '0') +
      ':' +
      String(seconds % 60).padStart(2, '0');
    node
      .closest('.pb-switch')
      .style.setProperty(
        '--elapsed',
        String(Math.max(0, Math.min(1, 1 - (active.endsAt - clock.now()) / 300000))),
      );
  }
  function updateStatus() {
    if (!entry) return;
    entry.querySelector('.pb-network')?.remove();
    const saving = pending && inFlight.has(pending);
    if (message || (saving && performance.now() - sentAt.get(pending) > 650) || !loaded) {
      const status = document.createElement('p');
      status.className = 'pb-network';
      status.setAttribute('role', 'status');
      const text = document.createElement('span');
      text.textContent = message || (loaded ? 'Đang lưu…' : 'Đang kiểm tra lượt đang làm…');
      status.append(text);
      if (!saving) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.dataset.pb = 'retry';
        retry.textContent = 'Kiểm tra lại';
        status.append(retry);
      }
      entry.append(status);
    }
    for (const button of entry.querySelectorAll(
      'button:not([data-pb="back"]):not([data-pb="stop"]):not([data-pb="retry"]):not([data-pb="stop-confirm"])',
    )) {
      button.disabled = !loaded || !!pending;
    }
    const cancel = entry.querySelector('[data-pb="stop-confirm"]');
    if (cancel) cancel.disabled = pending?.operation === 'cancel' && saving;
  }
  function cancelHold() {
    if (!hold) return;
    cancelAnimationFrame(frame);
    const previous = hold;
    hold = null;
    motion.cancel();
    if (entry) {
      delete entry.dataset.holding;
      entry.style.removeProperty('--hold');
    }
    if (previous.source === 'pointer' && previous.node.hasPointerCapture?.(previous.id))
      previous.node.releasePointerCapture(previous.id);
  }
  function paint(focus = null) {
    if (!entry) return;
    cancelHold();
    motion.cancel();
    entry.dataset.state = currentState();
    entry.innerHTML = firstStepInner(currentState(), active, clock.now());
    const announcer = document.createElement('span');
    announcer.className = 'sr-only pb-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    entry.append(announcer);
    updateTime();
    updateStatus();
    if (focus) entry.querySelector(focus)?.focus({ preventScroll: true });
  }
  function stopEffects() {
    clearTimeout(transition);
    clearTimeout(rewardTimer);
    cancelHold();
    motion.clear();
  }
  function showReward() {
    stopEffects();
    view = 'reward';
    paint();
    if (!entry || document.hidden) {
      view = null;
      return;
    }
    motion.reward();
    announce('Đã ghi nhận một lần vượt trì hoãn. Nhận 1 tu vi và 1 vé quay thường.');
    rewardTimer = setTimeout(
      () => {
        motion.clear();
        view = null;
        paint('#pb-hold');
      },
      prefersReducedMotion() ? 1100 : 2350,
    );
  }
  async function send(intent) {
    if (inFlight.has(intent) || !owner || intent.owner !== owner) return;
    const session = runtime.session;
    inFlight.add(intent);
    sentAt.set(intent, performance.now());
    updateStatus();
    let acknowledged = false;
    await performLive('first-step', inputOf(intent), {
      queue: true,
      reconciled: true,
      keepSheet: true,
      silent: true,
      handleError: true,
      onCommitted(result, _input, envelope) {
        if (session !== runtime.session || pending !== intent) return;
        acknowledged = true;
        generation++;
        clock.sync(envelope.serverNow);
        active = result.occurrence.status === 'active' ? result.occurrence : null;
        storeIntent(null);
        message = '';
        outsideId = null;
        notifyTabs();
        if (result.rewarded && ['claim', 'outside'].includes(intent.operation)) showReward();
        else if (intent.operation === 'cancel') {
          stopEffects();
          view = null;
          paint('#pb-hold');
          announce('Đã hủy lượt. Không cộng tu vi hay vé quay.');
          toast('Đã hủy lượt, không cộng thưởng.');
        } else if (view === 'launch' && active) {
          updateTime();
          updateStatus();
        } else {
          if (view === 'launch') stopEffects();
          view = null;
          paint();
        }
      },
      onError(error) {
        if (session !== runtime.session || pending !== intent) return;
        message = error.message;
        if (error.code !== 'NETWORK_UNCONFIRMED') {
          storeIntent(null);
          if (intent.operation === 'start') {
            active = null;
            stopEffects();
            view = null;
          }
          // A competing tab may have won. Read its authoritative terminal state.
          void refreshFirstStep(true);
        }
        if (view !== 'launch') paint();
        else updateStatus();
      },
    });
    inFlight.delete(intent);
    sentAt.delete(intent);
    if (session !== runtime.session || pending !== intent) return;
    if (!acknowledged && !message)
      message = 'Chưa xác nhận được thao tác. Kiểm tra kết quả trước khi bắt đầu lượt khác.';
    updateStatus();
  }
  async function refreshFirstStep(force = false) {
    if (refreshing) {
      // A tab notification can arrive while an older read is in flight. Read
      // once more afterwards so the older snapshot cannot swallow that change.
      if (force) refreshRequested = true;
      return;
    }
    if (!state.live || !state.loaded || !entry || (!force && performance.now() - lastRead < 15000))
      return;
    const session = runtime.session,
      readGeneration = generation;
    refreshing = true;
    try {
      const query = pending ? '?occurrenceId=' + encodeURIComponent(pending.occurrenceId) : '';
      const data = await liveRequest('first-step' + query);
      if (session !== runtime.session || generation !== readGeneration || !state.loaded) return;
      if (!/^\d+$/.test(data.owner)) throw Error('INVALID_FIRST_STEP_OWNER');
      const firstLoad = !loaded;
      if (owner && owner !== data.owner) resetFirstStep();
      owner = data.owner;
      loaded = true;
      lastRead = performance.now();
      clock.sync(data.serverNow);
      const changed = active?.id !== data.active?.id || active?.version !== data.active?.version;
      active = data.active;
      if (firstLoad) {
        const restored = restoredIntent();
        if (restored) {
          requestIdentity('first-step', inputOf(restored), restored.requestId);
          storeIntent(restored);
        }
      }
      if (pending?.operation === 'start' && !active && !data.occurrence) {
        active = {
          id: pending.occurrenceId,
          source: 'timer',
          status: 'active',
          version: 0,
          startedAt: clock.now(),
          endsAt: clock.now() + 300000,
        };
      }
      if (!pending) message = '';
      if ((changed || firstLoad) && !['launch', 'reward'].includes(view)) {
        view = null;
        paint();
      } else {
        updateTime();
        updateStatus();
      }
      if (pending && !inFlight.has(pending)) void send(pending);
    } catch (error) {
      if (session !== runtime.session || generation !== readGeneration) return;
      message = error.message;
      if (error.code === 'AUTH_REQUIRED' && !globalThis.Telegram?.WebApp?.initData)
        showBrowserLogin();
      else updateStatus();
    } finally {
      refreshing = false;
      if (refreshRequested) {
        refreshRequested = false;
        void refreshFirstStep(true);
      }
    }
  }
  function start() {
    if (!loaded || pending || active || currentState() !== 'idle') return;
    cancelHold();
    generation++;
    const id = crypto.randomUUID(),
      now = clock.now();
    active = {
      id,
      source: 'timer',
      status: 'active',
      version: 0,
      startedAt: now,
      endsAt: now + 300000,
    };
    storeIntent(intentFor('start', id));
    view = 'launch';
    paint();
    entry?.focus({ preventScroll: true });
    motion.release();
    if (!prefersReducedMotion()) navigator.vibrate?.([12, 30, 18]);
    announce('Làm ngay. Chỉ 5 phút thôi.');
    transition = setTimeout(() => {
      if (view === 'launch') {
        view = null;
        paint();
      }
    }, 1000);
    void send(pending);
  }
  function beginHold(node, source, id, point = null) {
    if (hold || !loaded || pending || currentState() !== 'idle' || document.hidden) return;
    entry.querySelector('.pb-menu')?.removeAttribute('open');
    hold = { node, source, id, point, at: performance.now(), beat: 0 };
    entry.dataset.holding = 'true';
    const scene = motion.begin();
    motion.draw(scene, 0, performance.now());
    function step(now) {
      if (!hold || !node.isConnected || document.hidden) {
        cancelHold();
        return;
      }
      const progress = Math.min(1, (now - hold.at) / 3000),
        beat = Math.min(3, Math.floor(progress * 3) + 1);
      entry.style.setProperty('--hold', String(progress));
      motion.draw(scene, progress, now);
      if (hold.beat !== beat) {
        hold.beat = beat;
        announce(String(beat));
        if (beat > 1 && !prefersReducedMotion()) navigator.vibrate?.(8);
      }
      if (progress >= 1) {
        cancelHold();
        start();
        return;
      }
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }
  function command(action) {
    const mode = currentState();
    if (action === 'retry') {
      if (pending) void send(pending);
      else void refreshFirstStep(true);
    }
    if (action === 'outside' && mode === 'idle' && !pending && loaded) {
      outsideId = crypto.randomUUID();
      view = 'confirm';
      paint('[data-pb="claim"]');
    }
    if (action === 'back' && ['confirm', 'stop'].includes(mode)) {
      view = null;
      outsideId = null;
      paint(active ? '.pb-menu summary' : '#pb-hold');
    }
    if (action === 'start-accessible') start();
    if (action === 'stop' && active) {
      stopEffects();
      view = 'stop';
      paint('[data-pb="stop-confirm"]');
    }
    if (action === 'stop-confirm' && mode === 'stop' && active) {
      if (pending?.operation === 'cancel') {
        void send(pending);
        return;
      }
      generation++;
      storeIntent(intentFor('cancel', active.id));
      void send(pending);
    }
    if (action === 'claim' && !pending && loaded && ['confirm', 'ready'].includes(mode)) {
      const id = mode === 'confirm' ? outsideId : active?.id;
      if (!id) return;
      generation++;
      storeIntent(intentFor(mode === 'confirm' ? 'outside' : 'claim', id));
      void send(pending);
    }
  }
  function tick() {
    if (!entry || document.hidden) return;
    const mode = currentState();
    if (entry.dataset.state !== mode) {
      paint();
      if (mode === 'ready')
        announce('Đã qua 5 phút. Cậu đã làm được 5 phút chưa? Ghi nhận nếu đã thực sự làm.');
    } else if (['running', 'launch'].includes(mode)) updateTime();
    if (pending) updateStatus();
  }
  function unmount() {
    stopEffects();
    events?.abort();
    events = null;
    clearInterval(ticker);
    ticker = 0;
    heldKey = null;
    entry = null;
    view = null;
  }
  function syncFirstStep() {
    const node = document.querySelector('#pb-entry');
    if (node === entry) {
      tick();
      return;
    }
    unmount();
    if (!node || !state.live || !state.loaded) return;
    entry = node;
    paint();
    events = new AbortController();
    const listen = (target, event, handler) =>
      target.addEventListener(event, handler, { signal: events.signal });
    listen(entry, 'pointerdown', (event) => {
      const button = event.target.closest('#pb-hold');
      if (!button || button.disabled || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      button.dataset.input = 'pointer';
      button.focus({ preventScroll: true });
      button.setPointerCapture?.(event.pointerId);
      beginHold(button, 'pointer', event.pointerId, { x: event.clientX, y: event.clientY });
    });
    listen(document, 'pointermove', (event) => {
      if (
        hold?.source === 'pointer' &&
        hold.id === event.pointerId &&
        Math.hypot(event.clientX - hold.point.x, event.clientY - hold.point.y) > 45
      )
        cancelHold();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      listen(document, name, (event) => {
        if (hold?.source === 'pointer' && hold.id === event.pointerId) cancelHold();
      });
    listen(entry, 'contextmenu', (event) => {
      if (event.target.closest('#pb-hold')) event.preventDefault();
    });
    listen(document, 'keydown', (event) => {
      if (event.key === heldKey) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        cancelHold();
        entry.querySelector('.pb-menu[open]')?.removeAttribute('open');
        if (['confirm', 'stop'].includes(view)) command('back');
      }
      if (event.target.id === 'pb-hold' && [' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
        if (!event.repeat) {
          delete event.target.dataset.input;
          heldKey = event.key;
          beginHold(event.target, 'keyboard', event.key);
        }
      }
    });
    listen(document, 'keyup', (event) => {
      if (heldKey === event.key) {
        event.preventDefault();
        heldKey = null;
      }
      if (hold?.source === 'keyboard' && hold.id === event.key) cancelHold();
    });
    listen(document, 'focusout', (event) => {
      if (hold?.node === event.target) cancelHold();
    });
    listen(window, 'blur', () => {
      heldKey = null;
      cancelHold();
    });
    listen(document, 'click', (event) => {
      const control = event.target.closest('[data-pb]');
      if (entry.contains(control) && !control.disabled) command(control.dataset.pb);
      for (const menu of entry.querySelectorAll('.pb-menu[open]'))
        if (!menu.contains(event.target)) menu.removeAttribute('open');
    });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        stopEffects();
        heldKey = null;
        if (view === 'reward' || view === 'launch') view = null;
      } else {
        tick();
        void refreshFirstStep(true);
      }
    });
    listen(window, 'focus', () => void refreshFirstStep(true));
    let width = innerWidth,
      height = innerHeight;
    listen(window, 'resize', () => {
      if (width !== innerWidth || height !== innerHeight) {
        width = innerWidth;
        height = innerHeight;
        stopEffects();
        heldKey = null;
        if (view === 'launch' || view === 'reward') {
          view = null;
          paint();
        }
      }
    });
    listen(window, 'storage', (event) => {
      if (owner && [storageKey(), ownerKey() + ':changed'].includes(event.key))
        void refreshFirstStep(true);
    });
    listen(matchMedia('(prefers-reduced-motion: reduce)'), 'change', () => {
      cancelHold();
      motion.cancel();
    });
    ticker = setInterval(tick, 250);
    void refreshFirstStep(!loaded);
  }
  function resetFirstStep() {
    generation++;
    unmount();
    owner = null;
    loaded = false;
    active = null;
    pending = null;
    runtime.pendingFirstStep = null;
    outsideId = null;
    message = '';
    lastRead = 0;
    refreshRequested = false;
  }
  return { firstStepCard: firstStepEntry, syncFirstStep, refreshFirstStep, resetFirstStep };
}
