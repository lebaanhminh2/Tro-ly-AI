export function createFeedback({ sheet }) {
    let toastTimer;
    function toast(message) {
        const inline = document.querySelector('#sheet-feedback');
        if (sheet.open && inline) {
            inline.textContent = message;
            inline.hidden = false;
        }
        const node = document.querySelector('#toast');
        clearTimeout(toastTimer);
        node.textContent = message;
        node.classList.add('visible');
        toastTimer = setTimeout(() => node.classList.remove('visible'), 3500);
    }
    return { toast };
}
