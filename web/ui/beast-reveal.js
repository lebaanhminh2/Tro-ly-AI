// Presentation only. Results, identities and order come from the confirmed receipt.
import { el } from './dom.js';
import { beastSpecies } from '../models/linh-thu.js';
import { prefersReducedMotion } from '../core/experience.js';
import { createRevealMotion, REVEAL_RANKS } from './beast-reveal-motion.js';
export const SUMMON_CARD_SRC = new URL('../assets/linh-thu/summon-card.webp', import.meta.url).href;

export function createBeastReveal({ data, result, portrait, isCurrent, onClose = () => {} }) {
  if (!result?.beasts?.length) return () => {};
  const queue = result.beasts.map((beast) => {
    const species = beastSpecies(data, beast.speciesId);
    return {
      ...beast,
      rank: species?.rank ?? '',
      name: species?.forms[0] ?? 'Linh thú chưa xác định',
      title: species?.title ?? 'Linh thú',
      species,
    };
  });
  const multiple = queue.length > 1;
  const dialog = el('dialog', undefined, 'beast-reveal');
  dialog.setAttribute('aria-label', 'Kết quả triệu hồi');
  dialog.autofocus = true;
  dialog.innerHTML = `
  <canvas data-reveal="scene" aria-hidden="true"></canvas>
  <div class="cinematic" data-reveal="cinematic">
    <canvas data-reveal="particles" aria-hidden="true"></canvas>
    <div class="omen" data-reveal="omen" aria-hidden="true"><img data-reveal="omen-art" alt=""></div>
    <div class="impact-veil" data-reveal="impact-veil"></div>
    <div class="seal-stage" data-reveal="card-stage" aria-hidden="true"><div class="seal" data-reveal="seal">
      <div class="seal-back"><img data-reveal="seal-art" alt=""></div>
      <div class="seal-front"><div class="front-mat" data-reveal="front-mat"></div><img data-reveal="front-art" alt=""><span data-reveal="front-rank"></span></div>
    </div></div>
    <div class="portrait outgoing" data-reveal="outgoing" aria-hidden="true"><img data-reveal="outgoing-art" alt=""></div>
    <div class="portrait beast-reveal-fallback" data-reveal="portrait">
      <div class="rarity-frame" aria-hidden="true"></div>
      <img data-reveal="beast-art" alt="">
      <span class="beast-reveal-placeholder" data-reveal="placeholder" aria-hidden="true" hidden>✦</span>
      <div class="identity beast-reveal-identity" data-reveal="identity" aria-live="polite" aria-atomic="true">
        <div class="identity-heading"><h2 data-reveal="beast-name"></h2><span class="card-rarity" data-reveal="rarity"></span></div>
        <p data-reveal="beast-title"></p>
      </div>
    </div>
  </div>
  <header class="reveal-top beast-reveal-top" data-reveal="top"><div><p class="beast-reveal-counter" data-reveal="counter" aria-live="polite"></p></div><div class="top-actions"><button type="button" class="beast-reveal-close" data-reveal="close" aria-label="Đóng kết quả triệu hồi">×</button></div></header>
  <span class="rarity-signal" data-reveal="rarity-signal" aria-hidden="true"></span>
  <p class="anticipation" data-reveal="anticipation"></p>
  <div class="result-dock" data-reveal="dock"><div class="result-actions beast-reveal-actions" data-reveal="result-actions">
    <button type="button" class="result-primary beast-reveal-primary" data-reveal="next">Tiếp tục</button>
    <button type="button" class="replay beast-reveal-replay" data-reveal="replay">↻ Xem lại hiệu ứng</button>
    <button type="button" class="batch-skip beast-reveal-skip" data-reveal="skip-batch" aria-label="Bỏ qua các thẻ còn lại, xem tất cả linh thú">Bỏ qua</button>
  </div></div>
  <section class="summary beast-reveal-summary" data-reveal="summary" aria-label="Tất cả linh thú nhận được" hidden>
    <span class="eyebrow">GIAO ƯỚC ĐÃ THÀNH HÌNH</span><h2>Cuộc gặp gỡ mới.</h2><p data-reveal="summary-description"></p>
    <div class="summary-grid beast-result-grid" data-reveal="summary-grid"></div>
    <button type="button" class="result-primary beast-reveal-primary" data-reveal="summary-close">Tiếp tục hành trình</button>
    <button type="button" class="replay beast-reveal-replay" data-reveal="summary-replay">↻ Xem lại từ thẻ đầu</button>
  </section>`;
  /** @type {Record<string, any>} */
  const nodes = Object.fromEntries(
    [...dialog.querySelectorAll('[data-reveal]')].map((n) => [n.getAttribute('data-reveal'), n]),
  );
  const previousFocus = document.activeElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let index = 0,
    completed = false,
    disposed = false,
    summary = false,
    motion,
    failed = queue.some((item) => !item.species),
    introRuns = 0,
    transitions = 0;
  const listen = (target, type, handler) =>
    target.addEventListener(type, handler, { signal: listeners.signal });
  for (const item of queue) {
    if (item.species) item.src = portrait(item.species, 1).src;
    const card = el('div', undefined, 'summary-card beast-result-card');
    card.dataset.beastId = item.id;
    card.dataset.rank = item.rank;
    card.style.setProperty('--card-rank', REVEAL_RANKS[item.rank]?.color ?? '#9ba1b2');
    if (item.species) {
      const thumbnail = portrait(item.species, 1, true);
      listen(thumbnail, 'error', () => {
        if (thumbnail.hidden) return;
        thumbnail.hidden = true;
        const placeholder = el('span', '✦');
        placeholder.setAttribute('aria-hidden', 'true');
        card.prepend(placeholder);
      });
      card.append(thumbnail);
    }
    card.append(el('strong', item.name), el('span', item.rank + ' · DẠNG I'));
    nodes['summary-grid'].append(card);
  }
  nodes['summary-description'].textContent = queue.length + ' linh thú · Đã vào bộ sưu tập';
  nodes['seal-art'].src = SUMMON_CARD_SRC;
  nodes.seal.style.setProperty('--seal-image', 'url("' + SUMMON_CARD_SRC + '")');
  listen(nodes['seal-art'], 'error', () => {
    failed = true;
    motion?.dispose();
    motion = null;
    finish();
  });
  function setItem() {
    const item = queue[index];
    dialog.dataset.rank = item.rank;
    dialog.dataset.beastId = item.id;
    dialog.dataset.revealIndex = String(index + 1);
    dialog.dataset.introRuns = String(introRuns);
    dialog.dataset.resultTransitions = String(transitions);
    nodes['beast-name'].textContent = item.name;
    nodes.rarity.textContent = item.rank;
    nodes['beast-title'].textContent = item.title + ' · Dạng I';
    nodes.counter.textContent =
      (multiple ? 'Linh thú ' : 'Thẻ ') + (index + 1) + ' / ' + queue.length;
    nodes['front-rank'].textContent = item.rank;
    // Only the main portrait has meaningful alt text. Decorative duplicates stay silent.
    const img = item.species ? portrait(item.species, 1) : el('img');
    img.dataset.reveal = 'beast-art';
    img.hidden = !item.src;
    nodes.placeholder.hidden = !!item.src;
    listen(img, 'error', () => {
      if (disposed || img !== nodes['beast-art']) return;
      img.hidden = true;
      nodes.placeholder.hidden = false;
    });
    nodes['beast-art'].replaceWith(img);
    nodes['beast-art'] = img;
    for (const id of ['front-art', 'omen-art']) {
      if (item.src) nodes[id].src = item.src;
      else nodes[id].removeAttribute('src');
    }
    nodes.next.textContent = !multiple
      ? 'Hoàn tất'
      : index + 1 < queue.length
        ? 'Tiếp tục · ' + (index + 2) + ' / ' + queue.length
        : 'Xem tất cả linh thú';
    nodes['skip-batch'].hidden = !multiple;
    nodes.replay.hidden = multiple;
  }
  function finish() {
    if (disposed || summary) return;
    completed = true;
    dialog.classList.toggle('is-static', !motion || prefersReducedMotion());
    dialog.classList.toggle('has-canvas', !!motion && !prefersReducedMotion());
    dialog.classList.add('is-complete', 'has-result', 'is-revealed');
    dialog.dataset.phase = 'complete';
    dialog.dataset.progress = '1';
    for (const id of ['next', 'replay', 'skip-batch']) nodes[id].disabled = false;
    nodes['result-actions'].inert = false;
    if (!motion || prefersReducedMotion()) {
      for (const c of dialog.querySelectorAll('canvas')) c.hidden = true;
      nodes['card-stage'].style.opacity = '0';
      nodes.outgoing.style.opacity = '0';
      nodes.omen.style.opacity = '0';
      nodes.portrait.style.opacity = '1';
      nodes.portrait.style.transform = 'translate(-50%,-50%)';
      nodes.identity.style.opacity = '1';
      nodes.identity.style.transform = 'none';
      nodes.anticipation.style.opacity = '0';
      nodes['beast-art'].style.opacity = '1';
      nodes['beast-art'].style.transform = 'none';
      nodes['beast-art'].style.filter = 'none';
      nodes.portrait.querySelector('.rarity-frame').style.opacity = '1';
      nodes.cinematic.style.transform = 'none';
      nodes['rarity-signal'].style.opacity = '0';
      dialog.style.setProperty('--opening-labels', '1');
      dialog.style.setProperty('--rank', REVEAL_RANKS[queue[index].rank]?.color ?? '#9ba1b2');
    }
    nodes.next.focus({ preventScroll: true });
  }
  function fit() {
    if (disposed) return;
    const mobile = innerWidth <= 600;
    const width = mobile ? innerWidth : Math.min(390, innerWidth);
    const height = mobile ? innerHeight : Math.min(844, Math.max(200, innerHeight - 48));
    Object.assign(dialog.style, {
      left: (innerWidth - width) / 2 + 'px',
      top: (innerHeight - height) / 2 + 'px',
      width: width + 'px',
      height: height + 'px',
      borderRadius: mobile ? '0' : '28px',
    });
    if (motion) motion.fit();
    else {
      const box = dialog.getBoundingClientRect();
      const top = nodes.top.getBoundingClientRect().bottom - box.top + 26;
      const bottom = nodes.dock.getBoundingClientRect().top - box.top - 24;
      const available = Math.max(140, bottom - top),
        cw = Math.min(326, width - 48, (available * 5) / 7),
        ch = (cw * 7) / 5;
      const picture = Math.max(0, ch - nodes.identity.offsetHeight - 58),
        size = Math.max(0, Math.min(cw - 12, picture));
      for (const [key, value] of Object.entries({
        '--card-width': cw,
        '--card-height': ch,
        '--hero-y': top + available / 2,
        '--hero-size': size,
        '--art-top': 18 + (picture - size) / 2,
      }))
        dialog.style.setProperty(key, value + 'px');
    }
  }
  function play(nextIndex = 0, kind = 'intro') {
    if (disposed) return;
    summary = false;
    completed = false;
    if (kind === 'intro') introRuns++;
    else transitions++;
    index = nextIndex;
    dialog.classList.remove('is-complete', 'is-summary', 'has-result', 'is-revealed');
    nodes.summary.hidden = true;
    nodes['result-actions'].inert = true;
    for (const id of ['next', 'replay', 'skip-batch']) nodes[id].disabled = true;
    setItem();
    fit();
    dialog.focus({ preventScroll: true });
    for (const c of dialog.querySelectorAll('canvas')) c.hidden = failed || prefersReducedMotion();
    if (!motion && !failed) {
      try {
        motion = createRevealMotion({
          dialog,
          nodes,
          queue,
          isReduced: prefersReducedMotion,
          onComplete: finish,
        });
      } catch {
        motion = null;
      }
      if (!motion) failed = true;
    }
    dialog.classList.toggle('has-canvas', !!motion && !prefersReducedMotion());
    if (motion) motion.play(index, kind);
    else finish();
  }
  function showSummary() {
    if (disposed || !multiple || !completed) return;
    motion?.stop();
    summary = true;
    dialog.classList.add('is-summary');
    nodes.summary.hidden = false;
    dialog.style.setProperty('--scene-label', '#80728d');
    dialog.style.setProperty('--title-color', '#30273f');
    dialog.style.setProperty('--detail-color', '#82718d');
    nodes.counter.textContent = queue.length + ' linh thú';
    nodes.summary.scrollTop = 0;
    for (const c of dialog.querySelectorAll('canvas')) c.hidden = true;
    dialog.focus({ preventScroll: true });
  }
  function close() {
    if (dialog.open) dialog.close();
    cleanup();
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    motion?.dispose();
    motion = null;
    listeners.abort();
    observer.disconnect();
    resizeObserver?.disconnect();
    dialog.remove();
    const returnFocus =
      previousFocus instanceof HTMLElement &&
      previousFocus !== document.body &&
      previousFocus.isConnected
        ? previousFocus
        : document.querySelector(
            '.beast-summon-actions .' + (result.count === 10 ? 'primary' : 'secondary'),
          );
    if (returnFocus instanceof HTMLElement) returnFocus.focus({ preventScroll: true });
    onClose();
  }
  function motionChanged() {
    if (!disposed && !summary && prefersReducedMotion()) {
      if (motion) motion.finish();
      else finish();
    }
  }
  function tap(event) {
    if (event.target.closest('button,select,a,input') || completed || summary) return;
    if (motion) motion.finish();
    else finish();
  }
  listen(dialog, 'click', tap);
  listen(nodes.next, 'click', () => {
    if (!completed || summary) return;
    if (index + 1 < queue.length) {
      nodes['outgoing-art'].src = queue[index].src ?? '';
      play(index + 1, 'next');
    } else if (multiple) showSummary();
    else close();
  });
  listen(nodes['skip-batch'], 'click', () => {
    if (completed) showSummary();
  });
  listen(nodes.replay, 'click', () => {
    if (completed && !multiple) play();
  });
  listen(nodes['summary-replay'], 'click', () => play());
  listen(nodes['summary-close'], 'click', close);
  listen(nodes.close, 'click', close);
  listen(dialog, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  listen(dialog, 'close', cleanup);
  listen(window, 'resize', fit);
  if (window.visualViewport) listen(window.visualViewport, 'resize', fit);
  listen(window, 'pagehide', close);
  listen(window, 'popstate', close);
  listen(media, 'change', motionChanged);
  listen(document, 'visibilitychange', () => {
    if (summary || disposed) return;
    if (document.hidden) motion?.pause();
    else motion?.resume();
  });
  const observer = new MutationObserver(() => {
    if (!isCurrent()) close();
    else motionChanged();
  });
  observer.observe(document.querySelector('#content') ?? document.body, {
    childList: true,
    subtree: true,
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  resizeObserver?.observe(nodes.dock);
  resizeObserver?.observe(nodes.identity);
  resizeObserver?.observe(nodes.top);
  document.body.append(dialog);
  dialog.showModal();
  play();
  return close;
}
