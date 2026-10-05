// Small, shared DOM primitives. No application state or network access.
export function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined)
        node.textContent = text;
    if (className)
        node.className = className;
    return node;
}
export function button(text, action, className = 'secondary') {
    const b = el('button', text, className);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
}
export function card(extra = '') {
    return el('div', undefined, 'card ' + extra);
}
export function heading(title, description) {
    const box = el('div', undefined, 'heading'), group = el('div');
    group.append(el('h1', title), el('p', description, 'subtitle'));
    box.append(group);
    return box;
}
export function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', name === 'close' ? 'M6 6l12 12M18 6L6 18' : 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0');
    svg.append(path);
    return svg;
}
export function field(label, type, value = '', required = true) {
    const wrap = el('label', label, 'form-field'), input = el('input');
    input.type = type;
    input.value = value;
    input.required = required;
    wrap.append(input);
    if (type === 'time') {
        input.step = '60';
        const hint = el('span', '', 'clock-hint');
        const update = () => {
            if (!input.value) {
                hint.textContent = 'Chọn giờ · định dạng 24 giờ';
                return;
            }
            const [h, m] = input.value.split(':').map(Number);
            hint.textContent = input.value + ' — ' + (h % 12 || 12) + ' giờ' + (m ? ' ' + m + ' phút' : '') + ' ' + (h < 12 ? 'sáng' : h < 18 ? 'chiều' : 'tối');
        };
        input.addEventListener('input', update);
        update();
        wrap.append(hint);
    }
    return { wrap, input };
}
export function noteField(value = '') {
    const wrap = el('label', 'Ghi chú', 'form-field'), input = el('textarea');
    input.value = value;
    input.maxLength = 2000;
    input.rows = 3;
    input.placeholder = 'Thông tin quan trọng, đường dẫn, ý tưởng…';
    wrap.append(input, el('span', 'Ghi chú riêng của task, không tự gửi cho AI.', 'clock-hint'));
    return { wrap, input };
}
export function empty(title, text, action, label) {
    const c = card('empty');
    c.append(el('span', '✧', 'empty-symbol'), el('h2', title), el('p', text), button(label, action, 'primary'));
    return c;
}
