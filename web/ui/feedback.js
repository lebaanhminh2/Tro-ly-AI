export function createFeedback({ sheet }) {
  let toastTimer;
  function toast(message, action) {
    const inline = /** @type {HTMLElement|null} */ (document.querySelector('#sheet-feedback'));
    if (sheet.open && inline) {
      inline.textContent = message;
      inline.hidden = false;
    }
    const node = document.querySelector('#toast');
    clearTimeout(toastTimer);
    node.textContent = message;
    if (action) {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = action.label;
      control.addEventListener(
        'click',
        () => {
          clearTimeout(toastTimer);
          node.classList.remove('visible');
          node.replaceChildren();
          action.run();
        },
        { once: true },
      );
      node.append(control);
    }
    node.classList.add('visible');
    toastTimer = setTimeout(
      () => {
        node.classList.remove('visible');
        node.replaceChildren();
      },
      action ? 6000 : 3500,
    );
  }
  return { toast };
}
