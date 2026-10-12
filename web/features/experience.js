import { experiencePreferences, setExperiencePreferences } from '../core/experience.js';
import { button, el } from '../ui/dom.js';

export function renderExperienceControls({ state, render, openGameGuide }) {
    const section = el('section', undefined, 'settings-experience'), preferences = experiencePreferences();
    section.append(el('h3', 'Trải nghiệm'), el('p', 'Áp dụng trên trình duyệt này.', 'hint'));
    function choice(label, values, selected, onChange) {
        const wrap = el('label', label, 'form-field'), select = el('select');
        for (const [value, name] of values) { const option = el('option', name); option.value = value; select.append(option); }
        select.value = selected; select.addEventListener('change', () => onChange(select.value)); wrap.append(select); return wrap;
    }
    section.append(choice('Thần Lộ', [['show', 'Hiển thị'], ['hide', 'Ẩn khỏi thanh điều hướng']], preferences.gameVisible ? 'show' : 'hide', value => {
        setExperiencePreferences({ gameVisible: value === 'show' });
        if (value === 'hide' && state.tab === 'game') state.tab = 'today';
        render();
    }), el('p', 'Ẩn giao diện vẫn giữ tiến độ và kết quả của trận, cam kết đang có.', 'hint'),
    choice('Chuyển động', [['system', 'Theo hệ thống'], ['reduce', 'Giảm chuyển động']], preferences.motion, value => setExperiencePreferences({ motion: value })),
    button('Cách chơi Thần Lộ', openGameGuide, 'text-button'));
    return section;
}
