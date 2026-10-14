import { liveRequest } from '../core/http.js';
import { button, el } from '../ui/dom.js';

export function battlePresetControls({ data, getVersions, setVersions, addVersion, performLive, toast, presetSnapshot }) {
    const root = el('details', undefined, 'battle-editions battle-presets');
    root.append(el('summary', 'Bộ chiêu đã lưu'));
    const pickerWrap = el('label', 'Dùng lại một bộ', 'form-field'), picker = el('select'); pickerWrap.append(picker);
    const nameWrap = el('label', 'Tên bộ chiêu', 'form-field'), name = el('input'); name.maxLength = 50;
    name.placeholder = 'Ví dụ: Công thủ cân bằng'; nameWrap.append(name);
    const notice = el('p', 'Lưu các bản công pháp đang chọn để dùng lại khi chuẩn bị trận.', 'hint');
    const actions = el('div', undefined, 'battle-preset-actions');
    let snapshot = null, busy = false, loaded = false, deleteConfirmed = false, pending = null;
    const apply = button('Áp dụng', applyPreset, 'secondary'), save = button('Lưu bộ', () => mutate('save'), 'secondary');
    const remove = button('Xóa bộ', () => {
        if (!deleteConfirmed) { deleteConfirmed = true; remove.textContent = 'Xác nhận xóa'; return; }
        mutate('delete');
    }, 'text-button');
    const reload = button('Tải lại danh sách', () => load(), 'text-button');
    actions.append(apply, save, remove); root.append(pickerWrap, nameWrap, notice, actions, reload);
    function sync() {
        picker.disabled = name.disabled = busy || !snapshot || !!pending;
        apply.disabled = busy || !snapshot || !picker.value || !!pending;
        remove.hidden = !picker.value;
        remove.disabled = busy || !snapshot || !!pending;
        save.disabled = busy || !snapshot || (!pending && !picker.value && snapshot.presets.length >= 6);
        save.textContent = pending ? 'Thử lại' : picker.value ? 'Cập nhật' : 'Lưu bộ';
        reload.disabled = busy || !!pending;
    }
    function rebuild(selected) {
        picker.replaceChildren(); const empty = el('option', 'Tạo bộ mới'); empty.value = ''; picker.append(empty);
        for (const preset of snapshot.presets) { const option = el('option', preset.name); option.value = preset.id; picker.append(option); }
        picker.value = snapshot.presets.some(preset => preset.id === selected) ? selected : '';
    }
    async function load(selected = picker.value, confirmed = null) {
        if (busy) return;
        busy = true; sync();
        try {
            const next = confirmed ?? await liveRequest('game-presets'); if (!root.isConnected) return;
            snapshot = next; loaded = true; rebuild(selected);
            notice.textContent = next.presets.length >= 6 ? 'Đã lưu 6 bộ. Cậu có thể cập nhật hoặc xóa một bộ.'
                : 'Lưu các bản công pháp đang chọn để dùng lại khi chuẩn bị trận.';
        } catch (error) { if (root.isConnected) notice.textContent = error.message; }
        finally { busy = false; if (root.isConnected) sync(); }
    }
    picker.addEventListener('change', () => {
        deleteConfirmed = false; remove.textContent = 'Xóa bộ';
        name.value = snapshot?.presets.find(preset => preset.id === picker.value)?.name ?? ''; sync();
    });
    root.addEventListener('toggle', () => { if (root.open && !loaded && !busy) load(); });
    async function applyPreset() {
        const preset = snapshot?.presets.find(value => value.id === picker.value); if (!preset || busy) return;
        busy = true; sync();
        try {
            const resolved = preset.versions.length ? await liveRequest('battle-loadout?' + new URLSearchParams(preset.versions.map(id => ['versionId', id]))) : { versions: [] };
            if (!root.isConnected) return;
            if (resolved.versions.length !== preset.versions.length || preset.versions.length > 5) {
                notice.textContent = 'Một bản luyện trong bộ này chưa dùng được. Bộ đang chọn được giữ; cậu có thể chỉnh và lưu lại.'; return;
            }
            for (const version of resolved.versions) addVersion(version);
            if (!setVersions(preset.versions)) { notice.textContent = 'Bộ đã lưu không còn hợp lệ. Bộ đang chọn được giữ.'; return; }
            notice.textContent = 'Đã áp dụng “' + preset.name + '”. Có thể chỉnh trước khi xuất chiến.';
        } catch (error) { if (root.isConnected) notice.textContent = error.message; }
        finally { busy = false; if (root.isConnected) sync(); }
    }
    async function mutate(operation) {
        if (!snapshot || busy) return;
        const versions = getVersions();
        if (!pending && operation === 'save') {
            if (!name.value.trim()) { name.focus(); toast('Đặt tên cho bộ chiêu nhé.'); return; }
            const skills = versions.map(id => data.versions.find(version => version.versionId === id)?.techniqueId);
            if (new Set(skills).size !== skills.length) { toast('Mỗi công pháp dùng một ô; chọn một bản luyện cho môn đó nhé.'); return; }
        }
        const input = pending ?? { operation, version: snapshot.version, ...(picker.value ? { presetId: picker.value } : {}),
            ...(operation === 'save' ? { name: name.value.trim(), versions, weaponId: null } : {}) };
        let failure;
        busy = true; sync();
        const result = await performLive('game-presets', input, { keepSheet: true, silent: true, onError: error => { failure = error; } });
        busy = false;
        if (!root.isConnected) return;
        if (!result && (!failure?.code || failure.code === 'OPERATION_NOT_CONFIRMED')) {
            pending = input; notice.textContent = 'Chưa xác nhận được kết quả. Thử lại để kiểm tra cùng lần lưu trước khi chỉnh tiếp.'; sync(); return;
        }
        pending = null; deleteConfirmed = false; remove.textContent = 'Xóa bộ';
        await load(result?.deleted ? '' : result?.presetId ?? picker.value, result ? presetSnapshot?.() : null);
        if (result) {
            if (result.deleted) name.value = '';
            notice.textContent = result.deleted ? 'Đã xóa bộ đã lưu. Bộ đang chọn được giữ.' : 'Đã lưu bộ chiêu để dùng lại trên các thiết bị.';
        }
        sync();
    }
    sync(); return root;
}
