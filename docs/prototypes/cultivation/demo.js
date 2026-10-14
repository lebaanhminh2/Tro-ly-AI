// Bundled into kiem-y-demo.html; never imported by the live app.
import { CultivationDemoSession, DEMO_SCENARIOS } from '../../../scripts/lib/cultivation-demo.ts';
import { renderGame } from '../../../web/views/game.js';
import { createGameActions } from '../../../web/features/game.js';
import { createBattleActions } from '../../../web/features/battle.js';
import { el, button, card, heading, icon } from '../../../web/ui/dom.js';
import { habitDate } from '../../../web/models/habits.js';

const session = new CultivationDemoSession(), main = document.querySelector('main'), sheet = document.querySelector('#sheet');
const sheetContent = document.querySelector('#sheet-content'), notice = document.querySelector('#toast');
const runtime = { revision: 1, refreshPending: false };
const state = { live: true, gamePanel: 'practice', gameSchool: null, gameSearch: '', featureSaving: false,
    gameData: session.overview(), gameCatalog: session.catalog(), gameVictories: { victories: session.records }, gamePresetData: session.read('game-presets') };
let toastTimer, restoreFocus;
function toast(message) {
    notice.textContent = message; notice.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}
function sync() {
    state.gameData = session.overview(); state.gameCatalog = session.catalog();
    state.gameVictories = { victories: session.records }; state.gamePresetData = session.read('game-presets');
    state.gameVictoryFocus = null; runtime.revision++; render();
}
function closeSheet() { sheet.className = ''; sheet.close(); }
function openSheet(title) {
    restoreFocus = sheet.open ? restoreFocus : document.activeElement;
    sheetContent.replaceChildren(); sheet.className = 'settings-sheet-open';
    const header = el('div', undefined, 'sheet-title-row'), close = button('', closeSheet, 'icon-button');
    close.append(icon('close')); close.setAttribute('aria-label', 'Đóng'); close.dataset.sheetClose = '';
    const label = el('h2', title); label.id = 'sheet-title'; header.append(label, close); sheetContent.append(header);
    if (!sheet.open) sheet.showModal();
}
sheet.addEventListener('close', () => { sheet.className = ''; restoreFocus?.isConnected && restoreFocus.focus({ preventScroll: true }); });
function confirm(title, description, action) {
    openSheet(title); sheetContent.append(el('p', description, 'hint'));
    const actions = el('div', undefined, 'actions');
    actions.append(button('Xác nhận', () => { closeSheet(); action(); }, 'primary'), button('Để sau', closeSheet)); sheetContent.append(actions);
}
async function performLive(path, input, options = {}) {
    try {
        state.featureSaving = true;
        const result = session.command(path, input); sync();
        if (!options.keepSheet) closeSheet();
        if (!options.silent) toast('Đã lưu vào dữ liệu mẫu.');
        return result;
    } catch (error) { options.onError?.(error); toast(error.message); return null; }
    finally { state.featureSaving = false; render(); }
}
// Intercept every fetch in this isolated document. No fallback can reach a live
// API, including if a new app feature starts requesting a different route.
globalThis.fetch = async (path, init = {}) => {
    const value = String(path);
    if (!value.startsWith('/api/')) throw Error('Demo không kết nối dịch vụ ngoài.');
    try {
        const result = init.method === 'POST' ? session.command(value.slice(5), JSON.parse(init.body)) : session.read(value);
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'DEMO_CONFLICT', message: error.message }), { status: 409 });
    }
};
const context = { state, runtime, render, toast, openSheet, closeSheet, sheet, sheetContent, confirm, performLive };
const game = createGameActions(context), battle = createBattleActions({ ...context, openTechnique: game.openTechnique, loadGame: game.loadGame });
const ui = { el, button, card, heading, ...game, ...battle, state: () => state,
    openGameGuide: () => {
        openSheet('Luyện và giao chiến');
        const body = el('div', undefined, 'settings-sheet-body');
        for (const [title, copy] of [
            ['Lên tầng', 'Hết số ngày luyện thì mở tầng. Habit quyết định phần sát thương nhận thêm của từng kỳ; hiệu ứng tăng đủ theo tầng.'],
            ['Độ thuần khiết', 'Phần đậm là đã đạt; phần nhạt là còn có thể đạt; trần tạm tính có thể đổi theo lịch. Khuyết điểm đã chốt chỉ cải thiện bằng luyện lại.'],
            ['Nâng cấp', 'Mở Công pháp → một phái → một môn → Nâng cấp để xem tầng kế thêm gì. Một số Sát thương nổi bật; đặc tính và nội tại xem trong chi tiết.'],
            ['Chiến đấu', 'Chuẩn bị bắt đầu ngày sau. Mỗi ngày chọn một chiêu rồi chốt bằng Sang ngày. Chưa chọn thì trận chờ; ba ngày không chọn rút an toàn.'],
            ['Dữ liệu mẫu', 'Thử nhanh tạo các trạng thái riêng, không ảnh hưởng app thật. Engine/UI là source hiện tại; demo chưa chứng minh toàn campaign đã cân bằng.'],
        ]) body.append(el('h3', title), el('p', copy, 'hint'));
        sheetContent.append(body);
    },
    openGameExport: () => {
        const data = JSON.stringify({ demo: true, day: session.day, editions: session.editions, victories: session.records, events: session.events }, null, 2);
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })), link = el('a');
        link.href = url; link.download = 'tu-luyen-demo.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
};
function render() {
    main.replaceChildren(renderGame(ui, state));
    document.querySelector('#demo-day').textContent = 'Ngày mẫu ' + habitDate(session.day);
}
function controls() {
    openSheet('Thử nhanh');
    const body = el('div', undefined, 'settings-sheet-body');
    body.append(el('p', 'Đổi tình huống đặt lại toàn bộ dữ liệu mẫu. Bạn có thể thử ngay, không cần chờ thời gian thật.', 'hint'));
    const label = el('label', 'Tình huống', 'form-field'), select = el('select'); select.id = 'demo-scenario';
    for (const [id, title] of DEMO_SCENARIOS) { const option = el('option', title); option.value = id; select.append(option); }
    select.value = session.scenario; label.append(select); body.append(label);
    body.append(button('Mở tình huống', () => { session.setup(select.value); state.gameResultDismissed = null; state.gamePanel = ['rescue', 'rescue-rank', 'victory'].includes(select.value) ? 'journey' : 'practice'; state.gameSchool = null; closeSheet(); sync(); }, 'primary'));
    const ratioLabel = el('label', 'Habit đạt trong ngày mẫu', 'form-field'), ratio = el('select'); ratio.id = 'demo-ratio';
    for (const value of [0, 50, 80, 100]) { const option = el('option', value + '%'); option.value = String(value); ratio.append(option); }
    ratio.value = String(session.ratio); ratio.addEventListener('change', () => { session.ratio = Number(ratio.value); toast('Tỷ lệ áp dụng khi sang ngày mẫu.'); });
    ratioLabel.append(ratio); body.append(ratioLabel,
        button('Đến mốc tầng tiếp theo', () => { try { session.advanceToNextTier(); closeSheet(); sync(); } catch (error) { toast(error.message); } }, 'secondary'),
        button('Sáng / tối', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; }, 'text-button'),
        button('Đặt lại demo', () => { session.setup(); state.gamePanel = 'practice'; state.gameSchool = null; closeSheet(); sync(); }, 'text-button'));
    body.append(el('p', 'Thử toàn bộ mở sẵn quyền và tạo bản luyện mẫu để kiểm từng môn/boss. Tình huống cứu mạng tăng HP/đòn boss để thử, không phải độ khó thật.', 'hint'));
    sheetContent.append(body);
}
document.querySelector('#demo-controls').addEventListener('click', controls);
document.querySelector('#demo-advance').addEventListener('click', () => {
    try {
        const last = session.runs[0]?.state.status; session.advanceDay();
        if (last === 'active' && session.runs[0]?.state.status !== 'active') state.gamePanel = 'journey';
        closeSheet(); sync(); toast('Đã chốt ngày mẫu.');
    } catch (error) { toast(error.message); }
});
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
render();
