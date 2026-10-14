import { button, el } from './dom.js';
import { purityLabel } from '../models/practice.js';
import { gameSearchText } from '../models/game-library.js';
import { renderTechniqueDamage, renderTechniqueEffects } from './technique-profile.js';

const stats = version => 'Tầng ' + version.tier + ' · ' + (version.profile?.totalPurityBp != null
    ? 'Thuần khiết ' + purityLabel(version.profile.totalPurityBp) : 'Chất lượng tầng ' + purityLabel(version.purityBp));

// Draft selection only. Persisting, discovery and the day's combat snapshot
// stay with the feature/API; an inspection never prepares a battle.
export function battleLoadoutEditor({ data, catalog, inspect, onChange, toast, maximum = 5, title = 'Bộ chiêu' }) {
    const root = el('section', undefined, 'battle-loadout-editor');
    const heading = el('div', undefined, 'battle-loadout-heading'), count = el('span');
    heading.append(el('h3', title), count);
    const selected = el('div', undefined, 'battle-loadout-selected');
    const note = el('p', maximum === 1 ? 'Chọn một môn và bản luyện để thay vào.' : 'Võ Kỹ luôn có sẵn. Chọn thêm tối đa 5 công pháp.', 'hint');
    const notice = el('p', undefined, 'battle-loadout-notice'); notice.setAttribute('role', 'status');
    const picker = el('details', undefined, 'battle-loadout-picker'); picker.append(el('summary', 'Chọn công pháp'));
    const searchWrap = el('label', 'Tìm công pháp', 'form-field'), search = el('input');
    search.type = 'search'; search.placeholder = 'Tên công pháp'; searchWrap.append(search);
    const list = el('div', undefined, 'battle-loadout-list'), empty = el('p', 'Không có công pháp phù hợp.', 'hint');
    picker.append(searchWrap, list, empty); root.append(heading, selected, note, notice, picker);
    const rows = new Map(), preferences = new Map();
    let ids = [], disabled = false;
    const technique = id => catalog.techniques.find(value => value.id === id);
    const name = id => technique(id)?.name ?? id;
    const versionFor = id => data.versions.find(value => value.versionId === id);
    const chosen = id => ids.map(versionFor).find(value => value?.techniqueId === id);
    const preferred = id => chosen(id) ?? versionFor(preferences.get(id)) ?? data.versions.find(value => value.techniqueId === id);

    function setVersions(next) {
        const values = next.map(versionFor);
        if (next.length > maximum || values.some(value => !value) || new Set(values.map(value => value.techniqueId)).size !== next.length) return false;
        ids = [...next]; values.forEach(value => preferences.set(value.techniqueId, value.versionId));
        notice.textContent = ''; sync(); onChange?.(values); return true;
    }
    function toggle(id, checked) {
        const value = preferred(id);
        if (!value || disabled) { sync(); return; }
        if (checked && ids.length >= maximum) { toast(maximum === 1 ? 'Bỏ môn đang chọn trước khi chọn môn thay vào.' : 'Bộ chiêu đã đủ 5 môn. Bỏ một môn trước khi thêm.'); sync(); return; }
        setVersions(checked ? [...ids, value.versionId] : ids.filter(versionId => versionFor(versionId)?.techniqueId !== id));
    }
    function sync() {
        count.textContent = ids.length + ' / ' + maximum; selected.replaceChildren();
        if (!ids.length) selected.append(el('p', maximum === 1 ? 'Chưa chọn môn thay vào' : 'Chỉ dùng Võ Kỹ', 'hint'));
        for (const id of ids) {
            const value = versionFor(id), chip = button(name(value.techniqueId) + ' ×', () => toggle(value.techniqueId, false), 'battle-loadout-chip');
            chip.dataset.versionId = id; chip.setAttribute('aria-label', 'Bỏ ' + name(value.techniqueId)); chip.disabled = disabled; selected.append(chip);
        }
        for (const [id, row] of rows) {
            const value = preferred(id), included = !!chosen(id);
            row.check.checked = included; row.check.disabled = disabled || !included && ids.length >= maximum;
            row.copy.textContent = value ? stats(value) : '';
            row.damage.textContent = value?.profile ? Number(value.profile.damage).toLocaleString('vi-VN') + ' sát thương' : '';
            row.root.classList.toggle('is-selected', included);
            for (const radio of row.content.querySelectorAll('input[type=radio]')) {
                radio.checked = radio.value === value?.versionId; radio.disabled = disabled;
            }
            row.draw?.(value);
        }
        search.disabled = disabled;
        if (maximum > 1 && ids.length === maximum && !notice.textContent) notice.textContent = 'Đã đủ 5 môn. Bỏ một môn để chọn môn khác.';
    }
    function filter() {
        const query = gameSearchText(search.value); let visible = 0;
        for (const [id, row] of rows) { row.root.hidden = !gameSearchText(name(id)).includes(query); if (!row.root.hidden) visible++; }
        empty.hidden = !!visible;
    }
    function addVersion(value) {
        if (!value || !value.tier || data.versions.some(version => version.versionId === value.versionId)) return;
        data.versions.push(value); buildRows(); sync(); filter();
    }
    function buildRows() {
        for (const value of data.versions) {
            const id = value.techniqueId; if (rows.has(id)) continue;
            const row = el('article', undefined, 'battle-loadout-row'); row.dataset.loadoutTechnique = id;
            const main = el('div', undefined, 'battle-loadout-main'), label = el('label'), check = el('input');
            check.type = 'checkbox'; check.setAttribute('aria-label', 'Chọn ' + name(id));
            const text = el('span'), copy = el('small'), damage = el('span', undefined, 'battle-loadout-damage');
            text.append(el('strong', name(id)), copy); label.append(check, text); main.append(label, damage);
            const details = el('details', undefined, 'battle-loadout-inspect'); details.append(el('summary', 'Tác dụng · bản luyện'));
            const content = el('div'); details.append(content); row.append(main, details); list.append(row);
            const record = { root: row, check, copy, damage, content }; rows.set(id, record);
            check.addEventListener('change', () => toggle(id, check.checked));
            let busy = false, loaded = false;
            async function load() {
                if (busy) return; busy = true; content.replaceChildren(el('p', 'Đang xem công pháp…', 'hint'));
                try {
                    const result = await inspect(id);
                    if (!root.isConnected) return;
                    const versions = result.versions.filter(entry => entry.maintained !== false && entry.practice.tiers.length).map(entry => ({
                        ...entry.practice.tiers.at(-1), techniqueId: id, versionId: entry.practice.id,
                        edition: entry.practice.edition, tier: entry.practice.tiers.length, profile: entry.profile,
                    }));
                    versions.forEach(addVersion); loaded = true; content.replaceChildren();
                    if (!versions.length) { content.append(el('p', 'Bản này chưa dùng được. Cập nhật tiến trình trước khi chuẩn bị.', 'hint')); return; }
                    const effects = el('div');
                    const draw = value => effects.replaceChildren(renderTechniqueDamage(value?.profile), renderTechniqueEffects(value?.profile));
                    record.draw = draw;
                    if (versions.length > 1) {
                        const editions = el('fieldset', undefined, 'battle-loadout-editions'); editions.append(el('legend', 'Bản luyện'));
                        for (const value of versions) {
                            const label = el('label'), radio = el('input'), text = el('span'); radio.type = 'radio';
                            radio.name = 'loadout-edition-' + id; radio.value = value.versionId;
                            text.append(el('strong', 'Bản ' + value.edition), el('small', stats(value))); label.append(radio, text); editions.append(label);
                            radio.addEventListener('change', () => {
                                if (disabled) { sync(); return; }
                                preferences.set(id, value.versionId);
                                if (chosen(id)) setVersions(ids.map(versionId => versionFor(versionId)?.techniqueId === id ? value.versionId : versionId));
                                else sync();
                                draw(value);
                            });
                        }
                        content.append(editions);
                    }
                    content.append(effects); draw(preferred(id)); sync();
                } catch (error) {
                    if (root.isConnected) content.replaceChildren(el('p', error.message, 'hint'), button('Thử lại', load, 'text-button'));
                } finally { busy = false; }
            }
            details.addEventListener('toggle', () => {
                if (!details.open) return;
                for (const other of rows.values()) { const detail = other.root.querySelector('details'); if (detail !== details) detail.open = false; }
                if (!loaded) load();
            });
        }
    }
    search.addEventListener('input', filter); buildRows(); sync(); filter();
    if (!data.versions.length) picker.hidden = true;
    return { root, addVersion, setVersions, getVersions: () => [...ids],
        setDisabled(value) { disabled = !!value; sync(); } };
}
