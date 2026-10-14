import { liveRequest } from '../core/http.js';
import { habitDate } from '../models/habits.js';
import { practiceStatus } from '../models/practice.js';
import { button, el } from '../ui/dom.js';
import { techniqueSymbol } from '../ui/game-art.js';
import { renderTechniqueDamage, renderPracticePurity, renderTechniqueEffects, renderTechniqueUpgrade } from '../ui/technique-profile.js';
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
        const current = () => request === generation && revision === runtime.revision;
        state.gameLoading = true; state.gameError = null; state.gameCatalogLoading = !state.gameCatalog; render();
        try {
            if (!state.live) return;
            const cached = state.gameCatalog;
            const dataRead = catalogOnly && state.gameData ? Promise.resolve(state.gameData) : liveRequest('game');
            const catalogRead = cached ? Promise.resolve({ value: cached }) : liveRequest('game-catalog').then(value => ({ value }), error => ({ error }));
            const data = await dataRead;
            if (!current()) return;
            const signature = accessSignature(data);
            state.gameData = data; state.gameLoading = false; render();
            const initial = await catalogRead;
            if (!current()) return;
            if (initial.error) throw initial.error;
            const changed = cached ? signature !== state.gameCatalogAccess : initial.value.access ? accessSignature(initial.value.access) !== signature : false;
            const catalog = changed ? await liveRequest('game-catalog') : initial.value;
            if (!current()) return;
            state.gameCatalog = catalog; state.gameCatalogAccess = catalog.access ? accessSignature(catalog.access) : signature;
            if (changed) state.gameVictories = null;
            if (state.gamePanel === 'collection' && !state.gameVictories) loadGameVictories();
        } catch (error) { if (current()) state.gameError = error.message; }
        finally { if (current()) { state.gameLoading = false; state.gameCatalogLoading = false; render(); } }
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
    function selectGameSchool(id) { state.gameSchool = id; state.gameSearch = ''; render(); }
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
        if (!techniqueDiscovered(technique, state.gameData, state.gameCatalog)) { toast('Bí tịch chưa được phát hiện. Xem Thử thách để tìm đường học.'); return; }
        const expected = { day: state.gameData.day.day, version: state.gameData.version }, revision = runtime.revision;
        openSheet(technique.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body technique-sheet'), footer = el('footer', undefined, 'technique-sheet-footer'); sheetContent.append(body, footer);
        let detailGeneration = 0, mode = 'effects';
        const selected = [state.gameData.currentPractice, state.gameData.pendingPractice].find(value => value?.practice.techniqueId === technique.id)?.practice.id;
        const connected = () => sheet.open && body.isConnected && revision === runtime.revision;
        async function readDetails(versionId) {
            const generation = ++detailGeneration;
            body.replaceChildren(el('p', 'Đang tải công pháp…', 'hint')); footer.replaceChildren();
            try {
                const data = await liveRequest('game-technique?techniqueId=' + encodeURIComponent(technique.id) + (versionId ? '&versionId=' + encodeURIComponent(versionId) : ''));
                if (!connected() || generation !== detailGeneration) return;
                draw(data);
            } catch (error) {
                if (!connected() || generation !== detailGeneration) return;
                body.replaceChildren(el('p', error.message, 'hint'), button('Thử lại', () => readDetails(versionId), 'secondary'));
            }
        }
        function draw(data) {
            body.replaceChildren(); footer.replaceChildren();
            const owned = state.gameData.owned.includes(technique.id), stored = data.selected, version = stored?.practice;
            const profile = stored?.profile ?? data.upgrade.referenceRoadmap[0].profile;
            const intro = el('div', undefined, 'technique-introduction'); intro.append(techniqueSymbol(technique.id, 80, profile?.tier ?? 0),
                el('p', version ? 'Bản ' + version.edition + ' · Tầng ' + version.tiers.length + ' / 4' : 'Chưa học · Tham chiếu tầng 1', 'hint'));
            body.append(intro, renderTechniqueDamage(profile, !stored?.profile));
            if (stored?.training) body.append(renderPracticePurity(stored.training));
            if (stored?.maintained === false) body.append(el('p', 'Bản lịch sử · chỉ xem. Các trận đã chốt vẫn giữ nguyên bản này.', 'hint'));
            if (data.versions.length > 1 || stored?.maintained === false) {
                const chooser = el('label', 'Bản đang xem', 'form-field'), select = el('select');
                if (stored?.maintained === false) {
                    const historical = el('option', 'Bản ' + version.edition + ' · Lịch sử, chỉ xem');
                    historical.value = version.id; select.append(historical);
                }
                for (const value of data.versions) {
                    const option = el('option', 'Bản ' + value.practice.edition + ' · Tầng ' + value.practice.tiers.length +
                        (value.profile ? ' · ' + value.profile.damage + ' sát thương' : ' · Chưa đủ tầng 1'));
                    option.value = value.practice.id; select.append(option);
                }
                select.value = version?.id ?? ''; select.addEventListener('change', () => readDetails(select.value)); chooser.append(select); body.append(chooser);
            }
            const tabs = el('nav', undefined, 'technique-detail-tabs'), content = el('div', undefined, 'technique-detail-content');
            tabs.setAttribute('aria-label', 'Thông tin công pháp');
            const effectsTab = button('Tác dụng', () => { mode = 'effects'; showContent(true); }, 'text-button');
            const upgradeTab = button('Nâng cấp', () => { mode = 'upgrade'; showContent(true); }, 'text-button'); tabs.append(effectsTab, upgradeTab);
            function showContent(reveal = false) {
                effectsTab.setAttribute('aria-pressed', String(mode === 'effects')); upgradeTab.setAttribute('aria-pressed', String(mode === 'upgrade'));
                content.replaceChildren(mode === 'effects' ? renderTechniqueEffects(profile) : renderTechniqueUpgrade(data.upgrade));
                if (reveal) content.scrollIntoView({ block: 'start', behavior: 'instant' });
            }
            body.append(tabs, content); showContent();
            const actions = el('div', undefined, 'technique-learning-actions');
            if (owned) {
                const active = version && state.gameData.current.mode === 'practice' && state.gameData.current.practiceId === version.id;
                if (stored?.maintained && version.tiers.length < 4 && !active) actions.append(button('Luyện bản ' + version.edition,
                    () => save({ operation: 'continue_practice', ...expected, practiceId: version.id }), 'primary'));
                const create = button(data.versions.length ? 'Luyện lại từ tầng 1' : 'Bắt đầu luyện', () => {
                    const input = { operation: 'start_practice', ...expected, techniqueId: technique.id, confirmRestart: !!data.versions.length };
                    if (data.versions.length) confirm('Luyện lại công pháp?', 'Giữ bản mạnh nhất và bắt đầu một bản từ tầng 1. Nếu đã có bản luyện lại, bản đó sẽ chuyển vào lịch sử. Không ghép các tầng giữa hai bản.', () => save(input));
                    else save(input);
                }, data.versions.length ? 'secondary' : 'primary');
                actions.append(create, el('p', active ? 'Đang luyện bản này. Thay đổi có hiệu lực từ ' + habitDate(expected.day + 1) + '.' : 'Áp dụng từ ' + habitDate(expected.day + 1) + '.', 'hint'));
            } else actions.append(el('p', 'Chưa có quyền học. Thắng thử thách tương ứng để mở bí tịch, rồi luyện từ tầng 1.', 'hint'));
            footer.append(actions);
            const sources = el('details', undefined, 'technique-sources'); sources.append(el('summary', 'Điều kiện học'));
            if (data.technique.availableInitially) sources.append(el('p', 'Quyền học có sẵn từ khi bắt đầu.', 'hint'));
            for (const id of data.technique.sources ?? []) {
                const boss = state.gameCatalog?.bosses.find(value => value.id === id);
                if (!boss || !bossDiscovered(boss, state.gameData)) continue;
                sources.append(button(((state.gameData.victories ?? []).includes(id) ? 'Đã thắng ' : 'Thắng ') + boss.name, () => {
                    sheet.close(); state.gamePanel = 'journey'; state.gameChapter = boss.chapter; render();
                    requestAnimationFrame(() => document.querySelector('[data-boss-id="' + CSS.escape(id) + '"]')?.scrollIntoView({ block: 'center' }));
                }, 'text-button'));
            }
            body.append(sources);
            if (owned && data.versions.length) {
                const history = el('details', undefined, 'technique-edition-details'); history.append(el('summary', 'Lịch sử bản luyện'));
                const list = el('div', undefined, 'practice-version-history'); history.append(list); let loaded = false, cursor = null;
                async function readHistory() {
                    if (!connected() || !history.isConnected) return;
                    const more = list.querySelector('button[data-more]'); if (more) more.disabled = true;
                    try {
                        const page = await liveRequest('practice-versions?techniqueId=' + encodeURIComponent(technique.id) + (cursor ? '&before=' + encodeURIComponent(cursor) : ''));
                        if (!connected() || !history.isConnected) return;
                        more?.remove(); loaded = true;
                        for (const value of page.versions) {
                            const row = button('Bản ' + value.practice.edition + ' · ' + practiceStatus(value.practice) + (value.maintained ? '' : ' · Lịch sử'), () => readDetails(value.practice.id), 'text-button'); list.append(row);
                        }
                        cursor = page.next;
                        if (cursor) { const next = button('Xem thêm', readHistory, 'text-button'); next.dataset.more = 'true'; list.append(next); }
                    } catch (error) { if (connected() && history.isConnected) toast(error.message); }
                    finally { if (more?.isConnected) more.disabled = false; }
                }
                history.addEventListener('toggle', () => { if (history.open && !loaded) readHistory(); }); body.append(history);
            }
        }
        await readDetails(selected);
    }
    return { loadGame, loadGameVictories, showGamePanel, openTechnique, selectGameSchool, stopPractice, followGameGoal };
}
