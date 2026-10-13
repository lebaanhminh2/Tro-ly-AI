import { liveRequest } from '../core/http.js';
import { habitDate } from '../models/habits.js';
import { practiceNumber, practiceStatus, purityLabel } from '../models/practice.js';
import { button, el } from '../ui/dom.js';
import { techniqueSymbol } from '../ui/game-art.js';
import { techniqueDiscovered, bossDiscovered } from '../models/game-library.js';

export function createGameActions(context) {
    const { state, runtime, render, toast, openSheet, sheet, sheetContent, confirm: defaultConfirm, performLive } = context;
    function confirm(title, description, action) {
        defaultConfirm(title, description, action);
        sheetContent.querySelector('.actions')?.classList.add('game-confirm-actions');
        sheetContent.querySelector(':scope>.hint')?.setAttribute('tabindex', '0');
    }
    let generation = 0;
    let loading, loadingRevision, victoryLoading, victoryRevision, victoryAccess, victoryGeneration = 0;
    const accessSignature = data => JSON.stringify([data.owned ?? [], data.learned ?? [], data.victories ?? []].map(values => [...values].sort()));
    const accessKey = signature => {
        let hash = 2166136261;
        for (let index = 0; index < signature.length; index++) hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(36);
    };
    function loadGame({ catalogOnly = false } = {}) {
        if (loading && loadingRevision === runtime.revision) return loading;
        loadingRevision = runtime.revision;
        const request = fetchGame(catalogOnly).finally(() => { if (loading === request) loading = null; });
        loading = request;
        return request;
    }
    async function fetchGame(catalogOnly) {
        const request = ++generation, revision = runtime.revision;
        state.gameLoading = true; state.gameError = null; render();
        try {
            if (!state.live) return;
            const cached = state.gameCatalog;
            const [data, initialCatalog] = await Promise.all([catalogOnly && state.gameData ? Promise.resolve(state.gameData) : liveRequest('game'), cached ? Promise.resolve(cached) : liveRequest('game-catalog')]);
            if (request !== generation || revision !== runtime.revision) return;
            const signature = accessSignature(data);
            const changed = cached ? signature !== state.gameCatalogAccess
                : initialCatalog.access ? accessSignature(initialCatalog.access) !== signature : false;
            const catalog = changed ? await liveRequest('game-catalog') : initialCatalog;
            if (request !== generation || revision !== runtime.revision) return;
            state.gameData = data; state.gameCatalog = catalog; state.gameCatalogAccess = catalog.access ? accessSignature(catalog.access) : signature;
            if (changed) state.gameVictories = null;
            if (state.gamePanel === 'collection' && !state.gameVictories) loadGameVictories();
        } catch (error) {
            if (request === generation && revision === runtime.revision) state.gameError = error.message;
        } finally { if (request === generation) { state.gameLoading = false; render(); } }
    }
    function showGamePanel(panel) {
        if (panel !== 'collection') state.gameVictoryFocus = null;
        state.gamePanel = panel; render();
        if (panel === 'collection') focusVictory();
        if (panel === 'collection' && !state.gameVictories) loadGameVictories();
    }
    function focusVictory() {
        if (!state.gameVictoryFocus || state.gamePanel !== 'collection') return;
        requestAnimationFrame(() => {
            const node = document.querySelector('[data-victory-boss="' + CSS.escape(state.gameVictoryFocus) + '"]');
            node?.scrollIntoView({ block: 'center' }); node?.querySelector('summary')?.focus({ preventScroll: true });
        });
    }
    function loadGameVictories() {
        const signature = accessSignature(state.gameData ?? {});
        if (victoryLoading && victoryRevision === runtime.revision && victoryAccess === signature) return victoryLoading;
        const revision = runtime.revision;
        victoryRevision = revision; victoryAccess = signature;
        const generation = ++victoryGeneration;
        const current = () => revision === runtime.revision && generation === victoryGeneration && signature === accessSignature(state.gameData ?? {});
        state.gameVictoriesLoading = true; state.gameVictoriesError = null; render();
        const request = (async () => {
            try {
                // The query separates transport read coalescing across a read-only
                // settlement too. It has no effect on server ownership or rewards.
                const data = await liveRequest('game-victories?access=' + accessKey(signature));
                if (current()) state.gameVictories = data;
            } catch (error) { if (current()) state.gameVictoriesError = error.message; }
            finally { if (current()) { state.gameVictoriesLoading = false; render(); focusVictory(); } }
        })().finally(() => { if (victoryLoading === request) victoryLoading = null; });
        victoryLoading = request; return request;
    }
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
        if (state.gameData.pending?.mode === 'battle' || state.gameData.current.mode === 'battle') { toast('Hủy chuẩn bị hoặc kết thúc trận hiện tại trước khi đổi lịch luyện.'); return; }
        const result = await performLive('game', input);
        if (result) { state.gamePanel = 'practice'; render(); }
    }
    function stopPractice() {
        const input = payload('stop_practice');
        confirm('Dừng luyện từ ngày mai?', 'Tiến độ và các bản luyện được giữ lại. Cam kết tuần đã dùng để luyện vẫn được chốt khi đến hạn.', () => save(input));
    }
    async function openTechnique(technique) {
        if (!state.gameData) return;
        if (!techniqueDiscovered(technique, state.gameData, state.gameCatalog)) { toast('Bí tịch này chưa lộ diện. Tiếp tục vượt tầng để tìm dấu vết.'); return; }
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
            if (!bossDiscovered(boss, state.gameData)) { sources.append(el('p', 'Vượt thêm tầng để đến thử thách mở đường học.', 'hint')); continue; }
            sources.append(el('p', ((state.gameData.victories ?? []).includes(id) ? '✓ Đã thắng ' : 'Thắng ') + boss.name + (boss.floor ? ' · tầng ' + String(boss.floor).padStart(2, '0') : ' · cơ duyên'), 'hint'), button('Xem thử thách', () => {
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
            const editions = el('details', undefined, 'technique-edition-details'); editions.append(el('summary', 'Các bản luyện đã có'));
            const list = el('div', undefined, 'practice-version-history'); editions.append(list); body.append(editions);
            function appendVersion(stored) {
                const version = stored.practice, row = el('section', undefined, 'practice-version-row');
                row.append(el('strong', 'Bản ' + version.edition), el('p', practiceStatus(version), 'hint'));
                if (version.tiers.length) row.append(el('p', version.tiers.length + ' / 4 tầng · tinh thuần ' + purityLabel(version.tiers.at(-1).purityBp), 'hint'));
                else row.append(el('p', 'Tiến độ ' + practiceNumber(version.progressMilli) + ' / ' + practiceNumber(version.costsMilli[0]), 'hint'));
                if (version.tiers.length < 4) row.append(button('Luyện bản ' + version.edition, () => save({ operation: 'continue_practice', ...expected, practiceId: version.id }), 'secondary'));
                if (version.tiers.length) {
                    const purity = el('details', undefined, 'technique-tier-purity'); purity.append(el('summary', 'Tinh thuần từng tầng'));
                    for (const [index, tier] of version.tiers.entries()) purity.append(el('p', ['Nhập môn', 'Tiểu thành', 'Đại thành', 'Viên mãn'][index] + ' · ' + purityLabel(tier.purityBp), 'hint'));
                    purity.append(el('p', 'Tinh thuần đã khóa. Muốn cải thiện cần luyện một bản mới từ tầng đầu.', 'hint')); row.append(purity);
                }
                list.append(row);
            }
            history.versions.forEach(appendVersion);
            const create = button(history.versions.length ? 'Luyện một bản mới' : 'Bắt đầu luyện', () => {
                const input = { operation: 'start_practice', ...expected, techniqueId: technique.id, confirmRestart: !!history.versions.length };
                if (history.versions.length) confirm('Luyện lại từ Nhập môn?', 'Bản mới bắt đầu từ tầng 1 để cải thiện tinh thuần. Các bản cũ và chất lượng đã chốt được giữ nguyên.', () => save(input));
                else save(input);
            }, 'primary');
            body.insertBefore(create, sources);
            const effective = el('p', 'Áp dụng từ ' + habitDate(expected.day + 1) + '.', 'technique-effective'); body.insertBefore(effective, sources);
            if (history.versions.length) {
                const latest = history.versions.find(entry => entry.practice.tiers.length < 4);
                if (latest) body.insertBefore(button('Tiếp tục bản ' + latest.practice.edition, () => save({ operation: 'continue_practice', ...expected, practiceId: latest.practice.id }), 'secondary'), create);
            }
            const explanation = el('details', undefined, 'technique-formula'); explanation.append(el('summary', 'Tiến độ & cách tính'),
                el('p', 'Bốn tầng: ' + [3, 6, 10, 15].map(value => practiceNumber(value * technique.trainingFactor)).join(' / ') + ' tiến độ.', 'hint'));
            body.append(explanation);
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
    return { loadGame, loadGameVictories, showGamePanel, openTechnique, selectGameSchool, stopPractice, followGameGoal };
}
