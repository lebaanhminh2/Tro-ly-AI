import { button, el, icon } from './dom.js';
export function createSheets({ sheet, sheetContent, render }) {
  let opener;
  function syncVisibleViewport() {
    const viewport = window.visualViewport;
    if (!sheet.open || !viewport || Math.abs(viewport.scale - 1) > 0.01) return;
    const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    sheet.style.setProperty('--sheet-visible-height', viewport.height + 'px');
    sheet.style.setProperty('--sheet-covered-bottom', covered > 80 ? covered + 'px' : '0px');
    const input = document.activeElement;
    if (sheet.contains(input) && input.matches('input, textarea, select'))
      requestAnimationFrame(() => {
        if (!sheet.open || document.activeElement !== input) return;
        const rect = input.getBoundingClientRect();
        if (
          rect.bottom > viewport.offsetTop + viewport.height - 12 ||
          rect.top < viewport.offsetTop
        )
          input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
  }
  function lockPageScroll() {
    document.documentElement.classList.add('sheet-open');
    document.body.classList.add('sheet-open');
  }
  function unlockPageScroll() {
    document.documentElement.classList.remove('sheet-open');
    document.body.classList.remove('sheet-open');
  }
  function resetSheetLayout() {
    sheet.classList.remove('task-sheet-open', 'schedule-sheet-open', 'reward-sheet-open');
    sheet.classList.remove('settings-sheet-open', 'draw-sheet-open');
    sheet.classList.remove('beast-sheet-open');
    sheet.scrollTop = 0;
  }
  function closeSheet() {
    resetSheetLayout();
    if (sheet.open) sheet.close();
    else {
      unlockPageScroll();
      render();
    }
  }
  function openSheet(title) {
    resetSheetLayout();
    if (!sheet.open) opener = document.activeElement;
    sheetContent.replaceChildren();
    const row = el('div', undefined, 'sheet-title-row'),
      h = el('h2', title);
    h.id = 'sheet-title';
    h.tabIndex = -1;
    const close = button('', closeSheet, 'icon-button');
    close.setAttribute('aria-label', 'Đóng');
    close.setAttribute('data-sheet-close', 'true');
    close.append(icon('close'));
    row.append(h, close);
    sheetContent.append(row);
    const feedback = el('p', '', 'form-feedback');
    feedback.id = 'sheet-feedback';
    feedback.hidden = true;
    feedback.setAttribute('role', 'status');
    sheetContent.append(feedback);
    if (!sheet.open) {
      lockPageScroll();
      sheet.showModal();
    }
    h.focus({ preventScroll: true });
    syncVisibleViewport();
  }
  function confirm(title, description, action) {
    openSheet(title);
    sheetContent.append(el('p', description, 'hint'));
    const actions = el('div', undefined, 'actions');
    actions.append(
      button(
        'Xác nhận',
        () => {
          sheet.close();
          action();
        },
        'primary',
      ),
      button('Quay lại', () => sheet.close(), 'secondary'),
    );
    sheetContent.append(actions);
  }
  function installSheetEvents() {
    globalThis.visualViewport?.addEventListener('resize', syncVisibleViewport);
    globalThis.visualViewport?.addEventListener('scroll', syncVisibleViewport);
    sheet.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-sheet-close]');
      if (target) {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.target === sheet) {
        const r = sheet.getBoundingClientRect();
        if (event.clientY < r.top) closeSheet();
      }
    });
    sheet.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeSheet();
    });
    sheet.addEventListener('close', () => {
      // Native close is queued: a different sheet may already have been
      // opened on the same dialog. Do not clear its layout or scroll lock.
      if (sheet.open) return;
      resetSheetLayout();
      unlockPageScroll();
      sheet.style?.removeProperty('--sheet-visible-height');
      sheet.style?.removeProperty('--sheet-covered-bottom');
      render();
      // Rendering may have replaced the card that originally opened this sheet.
      const target = opener?.isConnected
        ? opener
        : opener
          ? [
              .../** @type {NodeListOf<HTMLButtonElement>} */ (
                document.querySelectorAll('#content button')
              ),
            ].find((node) =>
              opener?.dataset?.beastId
                ? node.dataset.beastId === opener.dataset.beastId
                : node.className === opener?.className && node.textContent === opener?.textContent,
            )
          : null;
      if (target && !target.disabled) target.focus({ preventScroll: true });
      opener = null;
    });
    // Keep the live reward hint short; rest/sleep rules are shown elsewhere in the app.
    const rewardHintCleaner = new MutationObserver(() => {
      for (const node of sheetContent.querySelectorAll('.hint')) {
        if (node.textContent?.includes('/ngu không khóa quay thưởng'))
          node.textContent = node.textContent.replace(/\s*\/ngu không khóa quay thưởng\.?/, '');
      }
    });
    rewardHintCleaner.observe(sheetContent, { childList: true, subtree: true });
  }
  return { openSheet, closeSheet, confirm, installSheetEvents };
}
