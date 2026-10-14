import { liveRequest } from '../core/http.js';
import { button, el } from '../ui/dom.js';

export function createGameExportActions({ state, runtime, sheet, sheetContent, openSheet, toast }) {
    function openGameExport() {
        if (!state.live || !state.gameData) return;
        openSheet('Xuất hồ sơ Tu luyện'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body'), wrap = el('label', 'Nhật ký', 'form-field'), select = el('select');
        for (const span of [30, 90, 365]) { const option = el('option', span + ' ngày gần nhất'); option.value = String(span); select.append(option); }
        wrap.append(select); const range = el('p', undefined, 'hint'), to = state.gameData.day.day;
        const date = day => new Date(day * 86400000).toLocaleDateString('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
        const update = () => { range.textContent = date(to - Number(select.value) + 1) + ' — ' + date(to); }; select.addEventListener('change', update); update();
        const download = button('Tải JSON', async () => {
            const span = Number(select.value), revision = runtime.revision; download.disabled = true; select.disabled = true; body.setAttribute('aria-busy', 'true');
            try {
                const result = await liveRequest('game-export?' + new URLSearchParams({ from: String(to - span + 1), to: String(to) }));
                if (revision !== runtime.revision || !state.live) return;
                const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json;charset=utf-8' })), link = el('a');
                link.href = url; link.download = 'than-lo-' + span + '-ngay.json'; document.body.append(link); link.click(); link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Đã xuất hồ sơ và nhật ký ' + span + ' ngày.');
            } catch (error) { toast(error.message); }
            finally { download.disabled = false; select.disabled = false; body.removeAttribute('aria-busy'); }
        }, 'primary');
        body.append(wrap, range, el('p', 'Gồm hồ sơ đã lưu, các bản luyện, bí tịch, bộ chiêu và chiến tích hiện có; nhật ký luyện, trận và cam kết tuần theo khoảng chọn.', 'hint'),
            el('p', 'Xuất không ghi nhận hay chốt ngày mới. File dành để xem và lưu giữ; chưa có thao tác nhập đè dữ liệu.', 'hint'), download);
        sheetContent.append(body);
    }
    return { openGameExport };
}
