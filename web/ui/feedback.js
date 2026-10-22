export function createFeedback({ sheet }) {
  let timer, current, lastReward, listeners;
  function dismiss() {
    clearTimeout(timer);
    listeners?.abort();
    if (!current) return;
    current.node.classList.remove('visible');
    current.node.replaceChildren();
    if (current.node.id === 'sheet-feedback') current.node.hidden = true;
    current = null;
  }
  function arm() {
    clearTimeout(timer);
    if (!current) return;
    if (current.node.matches(':hover') || current.node.contains(document.activeElement)) return;
    current.paused = false;
    current.started = Date.now();
    timer = setTimeout(dismiss, current.remaining);
  }
  function pause() {
    if (!current) return;
    if (current.paused) return;
    current.paused = true;
    clearTimeout(timer);
    current.remaining = Math.max(500, current.remaining - (Date.now() - current.started));
  }
  function toast(message, action, options = {}) {
    const inline = /** @type {HTMLElement|null} */ (document.querySelector('#sheet-feedback'));
    const node =
      sheet.open && inline
        ? inline
        : /** @type {HTMLElement|null} */ (document.querySelector('#toast'));
    if (!node) return;
    const now = Date.now();
    if (options.key === 'habit-log' && options.amount > 0) {
      const amount =
        options.amount + (lastReward && now - lastReward.at < 1500 ? lastReward.amount : 0);
      lastReward = { at: now, amount };
      message = '+' + amount + ' vé quay';
      if (action && amount > options.amount) action = { ...action, label: 'Hoàn tác lần cuối' };
    } else if (options.key !== 'habit-log') lastReward = null;
    dismiss();
    const globalNotice = document.querySelector('#toast');
    if (globalNotice !== node) {
      globalNotice?.classList.remove('visible');
      globalNotice?.replaceChildren();
    }
    node.hidden = false;
    node.classList.add('app-notice');
    node.dataset.kind = options.kind ?? 'info';
    node.dataset.long = String(message.length > 60);
    node.setAttribute('aria-live', options.kind === 'error' ? 'assertive' : 'polite');
    node.setAttribute('aria-atomic', 'true');
    const mark = document.createElement('span');
    mark.className = 'notice-icon';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = options.kind === 'error' ? '!' : options.kind === 'success' ? '✓' : 'i';
    const copy = document.createElement('span');
    copy.className = 'notice-message';
    copy.textContent = message;
    node.append(mark, copy);
    if (action) {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'notice-action';
      control.textContent = action.label;
      control.addEventListener(
        'click',
        () => {
          dismiss();
          void Promise.resolve()
            .then(action.run)
            .catch(() =>
              toast('Chưa thực hiện được. Bạn thử lại nhé.', undefined, { kind: 'error' }),
            );
        },
        { once: true },
      );
      node.append(control);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notice-close';
    close.setAttribute('aria-label', 'Đóng thông báo');
    close.textContent = '×';
    close.addEventListener('click', dismiss, { once: true });
    node.append(close);
    current = {
      node,
      remaining: action ? 8000 : options.kind === 'error' ? 10000 : 3500,
      started: now,
      paused: false,
    };
    node.onmouseenter = pause;
    node.onmouseleave = arm;
    listeners = new AbortController();
    node.addEventListener('focusin', pause, { signal: listeners.signal });
    node.addEventListener(
      'focusout',
      () => {
        if (!node.contains(document.activeElement)) arm();
      },
      { signal: listeners.signal },
    );
    node.classList.add('visible');
    arm();
  }
  return { toast };
}
