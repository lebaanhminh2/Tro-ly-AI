import { experiencePreferences, setExperiencePreferences } from '../core/experience.js';
import { el } from '../ui/dom.js';

export function renderExperienceControls() {
    const section = el('section', undefined, 'settings-experience'), preferences = experiencePreferences();
    section.append(el('h3', 'Trải nghiệm'), el('p', 'Áp dụng trên trình duyệt này.', 'hint'));
    function choice(label, values, selected, onChange) {
        const wrap = el('label', label, 'form-field'), select = el('select');
        for (const [value, name] of values) { const option = el('option', name); option.value = value; select.append(option); }
        select.value = selected; select.addEventListener('change', () => onChange(select.value)); wrap.append(select); return wrap;
    }
    section.append(choice('Chuyển động', [['system', 'Theo hệ thống'], ['reduce', 'Giảm chuyển động']], preferences.motion, value => setExperiencePreferences({ motion: value })));
    return section;
}
