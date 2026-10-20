import { button, el } from './dom.js';
import { beastTalentUpgrade } from '../models/linh-thu.js';
import { prefersReducedMotion } from '../core/experience.js';
import { createEvolutionMotion, EVOLUTION_STYLES } from './beast-evolution-motion.js';

// Display only a server-confirmed transition. Replay never invokes an account action.
export function createBeastEvolution({ data, result, progress, portrait, isCurrent, onClose }) {
  const species = progress.species;
  const style = EVOLUTION_STYLES[species.id] ?? EVOLUTION_STYLES.hootlet;
  const dialog = el('dialog', undefined, 'beast-evolution beast-evolved-result');
  dialog.setAttribute('aria-label', 'Tiến hóa linh thú');
  dialog.dataset.rank = species.rank;
  dialog.dataset.species = species.id;
  dialog.dataset.form = String(progress.form);
  dialog.style.setProperty('--evolution-color', style.color);
  dialog.style.setProperty('--evolution-light', style.light);
  const theatre = el('div', undefined, 'beast-evolution-theatre');
  theatre.setAttribute('aria-hidden', 'true');
  const canvas = el('canvas');
  const before = portrait(species, result.from);
  before.alt = '';
  const after = portrait(species, progress.form, false, progress.perfect, progress.awakened);
  after.alt = '';
  const fallback = el('div', undefined, 'evolution-fallback');
  fallback.hidden = true;
  fallback.append(after);
  theatre.append(canvas, fallback);

  const top = el('header', undefined, 'evolution-top');
  const label = el('div', undefined, 'evolution-top-label');
  label.append(el('span', 'TIẾN HÓA'), el('span', `T${result.from} → T${progress.form}`));
  const skip = button('Bỏ qua hiệu ứng', () => finish(), 'evolution-skip');
  top.append(label, skip);
  const intro = el('div', undefined, 'evolution-intro');
  intro.append(el('span', 'MỘT HÌNH HÀI MỚI'), el('p', 'Nỗ lực đang kết tinh'));
  const dock = el('section', undefined, 'evolution-dock');
  const identity = el('div', undefined, 'evolution-identity');
  identity.setAttribute('aria-hidden', 'true');
  identity.append(
    el('p', `TẦNG ${progress.form} · ${species.rank}`, 'evolution-tier'),
    el('h2', species.forms[progress.form - 1]),
    el('p', species.title, 'evolution-title'),
  );
  const final = el('div', undefined, 'beast-evolution-final');
  final.hidden = true;
  final.append(el('p', 'NĂNG LỰC ĐƯỢC NÂNG', 'evolution-gains-label'));
  data.config.skills[species.id].talents.forEach((skill, index) => {
    if (index > 0 && progress.form < 3) return;
    const row = el('div', undefined, 'evolution-gain');
    const heading = el('div', undefined, 'evolution-gain-heading');
    heading.append(el('strong', skill.name));
    if (index > 0 && result.from < 3) heading.append(el('span', 'MỞ MỚI'));
    row.append(heading, el('p', beastTalentUpgrade(skill, result.from, progress.form, index)));
    final.append(row);
  });
  const actions = el('div', undefined, 'evolution-actions');
  const next = button('Tiếp tục nuôi dưỡng', close, 'evolution-continue');
  const replay = button('Xem lại hiệu ứng', () => play(), 'evolution-replay');
  actions.append(next, replay);
  final.append(actions);
  dock.append(identity, final);
  const status = el('p', '', 'evolution-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  dialog.append(theatre, top, intro, dock, status);

  const previousFocus = document.activeElement;
  const listeners = new AbortController();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false,
    finished = false,
    ready = false,
    motion,
    decodeTimer;
  const listen = (target, type, handler) =>
    target.addEventListener(type, handler, { signal: listeners.signal });
  function finish() {
    if (disposed || finished) return;
    if (motion && !prefersReducedMotion()) {
      motion.finish();
      return;
    }
    motion?.dispose();
    motion = null;
    dialog.classList.add('is-static');
    fallback.hidden = false;
    complete();
  }
  function complete() {
    if (disposed || finished) return;
    finished = true;
    theatre.classList.remove('is-playing');
    theatre.classList.add('is-finished');
    dialog.classList.add('is-complete');
    dialog.dataset.phase = 'complete';
    identity.removeAttribute('aria-hidden');
    skip.hidden = true;
    intro.hidden = true;
    final.hidden = false;
    replay.hidden =
      !ready ||
      prefersReducedMotion() ||
      !before.naturalWidth ||
      !after.naturalWidth ||
      after.hidden;
    status.textContent = `Tiến hóa thành công. ${species.forms[progress.form - 1]}, T${progress.form}.`;
    resize();
    next.focus({ preventScroll: true });
  }
  function play() {
    if (disposed) return;
    if (!ready || prefersReducedMotion() || !before.naturalWidth || !after.naturalWidth) {
      finish();
      return;
    }
    finished = false;
    final.hidden = true;
    intro.hidden = false;
    skip.hidden = false;
    identity.setAttribute('aria-hidden', 'true');
    dialog.classList.remove('is-complete', 'is-static');
    theatre.classList.remove('is-finished');
    theatre.classList.add('is-playing');
    status.textContent = 'Linh thú đang tiến hóa.';
    if (!motion) {
      try {
        motion = createEvolutionMotion({
          dialog,
          canvas,
          before,
          after,
          speciesId: species.id,
          form: progress.form,
          onComplete: complete,
        });
      } catch {
        motion = null;
      }
    }
    if (motion) {
      dialog.classList.add('has-motion');
      motion.play();
      skip.focus({ preventScroll: true });
    } else finish();
  }
  function resize() {
    if (disposed) return;
    if (motion) motion.fit();
    else {
      const space = Math.max(
        90,
        dock.getBoundingClientRect().top - top.getBoundingClientRect().bottom - 35,
      );
      dialog.style.setProperty(
        '--evolution-hero-y',
        top.getBoundingClientRect().bottom + space / 2 + 12 + 'px',
      );
      dialog.style.setProperty(
        '--evolution-hero-size',
        Math.min(innerWidth * 0.86, space * 0.86, 560) + 'px',
      );
    }
  }
  function close() {
    if (disposed) return;
    disposed = true;
    clearTimeout(decodeTimer);
    listeners.abort();
    observer.disconnect();
    resizeObserver?.disconnect();
    motion?.dispose();
    if (dialog.open) dialog.close();
    dialog.remove();
    const target =
      previousFocus instanceof HTMLElement &&
      previousFocus.isConnected &&
      previousFocus !== document.body
        ? previousFocus
        : document.querySelector('.beast-hero-view');
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    onClose?.();
  }
  function changed() {
    if (!isCurrent()) close();
    else if (prefersReducedMotion() && !finished) finish();
  }
  listen(dialog, 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (!finished) finish();
    else close();
  });
  listen(dialog, 'cancel', (event) => {
    event.preventDefault();
    if (!finished) finish();
    else close();
  });
  listen(dialog, 'close', close);
  listen(after, 'error', () => {
    after.hidden = true;
    fallback.classList.add('is-missing');
    motion?.dispose();
    motion = null;
    finish();
  });
  listen(window, 'resize', resize);
  if (window.visualViewport) listen(window.visualViewport, 'resize', resize);
  listen(window, 'pagehide', close);
  listen(window, 'popstate', close);
  listen(media, 'change', changed);
  listen(document, 'visibilitychange', () =>
    document.hidden ? motion?.pause() : motion?.resume(),
  );
  const observer = new MutationObserver(changed);
  observer.observe(document.querySelector('#content') ?? document.body, {
    childList: true,
    subtree: true,
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(dock);
  document.body.append(dialog);
  dialog.showModal();
  skip.focus({ preventScroll: true });
  if (prefersReducedMotion()) finish();
  else
    Promise.race([
      Promise.allSettled([before.decode(), after.decode()]),
      new Promise((resolve) => {
        decodeTimer = setTimeout(resolve, 1800);
      }),
    ]).then(() => {
      clearTimeout(decodeTimer);
      ready = true;
      if (!disposed && !finished) play();
      else if (!disposed)
        replay.hidden =
          prefersReducedMotion() || !before.naturalWidth || !after.naturalWidth || after.hidden;
    });
  return close;
}
