import { liveRequest } from '../core/http.js';
import { habitDate } from '../models/habits.js';
import { practiceNumber, practiceStatus, purityLabel } from '../models/practice.js';
import { button, el } from '../ui/dom.js';
import { techniqueSymbol } from '../ui/game-art.js';

export function createGameActions(context) {
    const { state, runtime, render, toast, openSheet, sheet, sheetContent, confirm, performLive } = context;
    let generation = 0;
    async function loadGame() {
        const request = ++generation, revision = runtime.revision;
        state.gameLoading = true; state.gameError = null; render();
        try {
            if (!state.live) return;
            const [data, catalog] = await Promise.all([liveRequest('game'), state.gameCatalog ? Promise.resolve(state.gameCatalog) : liveRequest('game-catalog')]);
            if (request !== generation || revision !== runtime.revision) return;
            state.gameData = data; state.gameCatalog = catalog;
        } catch (error) {
            if (request === generation && revision === runtime.revision) state.gameError = error.message;
        } finally { if (request === generation) { state.gameLoading = false; render(); } }
    }
    function showGamePanel(panel) { state.gamePanel = panel; render(); }
    function selectGameSchool(id) { state.gameSchool = id; render(); }
    function followGameGoal(goal) {
        if (goal.kind === 'refresh') return loadGame();
        if (goal.kind === 'habits') {
            state.tab = 'habits'; state.habitPanel = 'today'; render();
            context.loadHabits(); window.scrollTo(0, 0); return;
        }
        if (goal.kind === 'technique') {
            const technique = state.gameCatalog?.techniques.find(value => value.id === goal.id);
            if (technique) return openTechnique(technique);
        }
        if (goal.kind === 'collection') { showGamePanel('collection'); window.scrollTo(0, 0); return; }
        if (goal.kind === 'boss') {
            state.gamePanel = 'journey'; state.gameChapter = goal.chapter; render();
            requestAnimationFrame(() => document.querySelector('[data-boss-id="' + CSS.escape(goal.id) + '"]')?.scrollIntoView({ block: 'center' }));
        }
    }
    function payload(operation, values = {}) {
        return { operation, day: state.gameData.day.day, version: state.gameData.version, ...values };
    }
    async function save(input) {
        if (!state.live) { toast('Mở app đã đăng nhập để lưu hành trình nhé.'); return; }
        const result = await performLive('game', input);
        if (result) { state.gamePanel = 'practice'; render(); }
    }
    function stopPractice() {
        const input = payload('stop_practice');
        confirm('Dừng luyện từ ngày mai?', 'Tiến độ và các bản luyện được giữ lại. Cam kết tuần đã dùng để luyện vẫn được chốt khi đến hạn.', () => save(input));
    }
    async function openTechnique(technique) {
        if (!state.gameData) return;
        const expected = { day: state.gameData.day.day, version: state.gameData.version };
        openSheet(technique.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body technique-sheet');
        const introduction = el('div', undefined, 'technique-introduction');
        introduction.append(techniqueSymbol(technique.id, 48), el('p', technique.description, 'technique-description')); body.append(introduction);
        if (technique.combatWarning) body.append(el('p', technique.combatWarning, 'battle-warning'));
        const sources = el('section', undefined, 'technique-sources'); sources.append(el('h3', 'Đường học'));
        if (technique.availableInitially) sources.append(el('p', 'Quyền học có sẵn từ khi bắt đầu hành trình.', 'hint'));
        for (const id of technique.sources ?? []) {
            const boss = state.gameCatalog.bosses.find(value => value.id === id); if (!boss) continue;
            sources.append(el('p', 'Thắng ' + boss.name + ' · chương ' + boss.chapter, 'hint'), button('Xem thử thách', () => {
                sheet.close(); state.gamePanel = 'journey'; state.gameChapter = boss.chapter; render();
                requestAnimationFrame(() => document.querySelector('[data-boss-id="' + boss.id + '"]')?.scrollIntoView({ block: 'center' }));
            }, 'text-button'));
        }
        body.append(sources);
        if (!state.gameData.owned.includes(technique.id)) {
            body.append(el('p', 'Chưa có quyền học. Thắng thử thách mở bí tịch; cậu tự luyện từ Nhập môn.', 'hint')); sheetContent.append(body); return;
        }
        const hint = el('p', 'Đang tải các bản luyện…', 'hint'); body.append(hint); sheetContent.append(body);
        try {
            const history = await liveRequest('practice-versions?techniqueId=' + encodeURIComponent(technique.id));
            if (!sheet.open || !body.isConnected) return;
            hint.remove();
            body.append(el('p', 'Chọn luyện có hiệu lực từ ' + habitDate(expected.day + 1) + '. Habit đạt mục tiêu mới góp tiến độ; tinh thuần chốt khi hoàn tất tầng và cam kết tuần.', 'hint'));
            const list = el('div', undefined, 'practice-version-history'); body.append(list);
            function appendVersion(stored) {
                const version = stored.practice, row = el('section', undefined, 'practice-version-row');
                row.append(el('strong', 'Bản ' + version.edition), el('p', practiceStatus(version), 'hint'));
                if (version.tiers.length) row.append(el('p', version.tiers.length + ' / 4 tầng · tinh thuần ' + purityLabel(version.tiers.at(-1).purityBp), 'hint'));
                else row.append(el('p', 'Tiến độ ' + practiceNumber(version.progressMilli) + ' / ' + practiceNumber(version.costsMilli[0]), 'hint'));
                if (version.tiers.length < 4) row.append(button('Luyện bản ' + version.edition, () => save({ operation: 'continue_practice', ...expected, practiceId: version.id }), 'secondary'));
                list.append(row);
            }
            history.versions.forEach(appendVersion);
            const create = button(history.versions.length ? 'Luyện một bản mới' : 'Bắt đầu luyện', () => {
                const input = { operation: 'start_practice', ...expected, techniqueId: technique.id, confirmRestart: !!history.versions.length };
                if (history.versions.length) confirm('Luyện lại từ Nhập môn?', 'Bản mới bắt đầu từ tầng 1 để cải thiện tinh thuần. Các bản cũ và chất lượng đã chốt được giữ nguyên.', () => save(input));
                else save(input);
            }, 'primary');
            body.append(el('p', 'Bốn tầng: ' + [3, 6, 10, 15].map(value => practiceNumber(value * technique.trainingFactor)).join(' / ') + ' tiến độ.', 'hint'), create);
            if (history.next) {
                let cursor = history.next;
                const more = button('Xem thêm bản cũ', async () => {
                    more.disabled = true;
                    try {
                        const next = await liveRequest('practice-versions?techniqueId=' + encodeURIComponent(technique.id) + '&before=' + encodeURIComponent(cursor));
                        if (!body.isConnected) return;
                        next.versions.forEach(appendVersion); cursor = next.next;
                        if (!cursor) more.remove();
                    } catch (error) { toast(error.message); }
                    finally { if (more.isConnected) more.disabled = false; }
                }, 'secondary');
                body.append(more);
            }
        } catch (error) { if (body.isConnected) { hint.textContent = error.message; body.append(button('Thử lại', () => openTechnique(technique), 'secondary')); } }
    }
    return { loadGame, showGamePanel, openTechnique, selectGameSchool, stopPractice, followGameGoal };
}
