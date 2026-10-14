import { habitDate } from '../models/habits.js';
import { practiceNumber, practiceStatus } from '../models/practice.js';
import { renderJourney } from './journey.js';
import { renderGameCollection } from './game-collection.js';
import { techniqueDiscovered, currentBattle, latestBattleResult, gameSearchText } from '../models/game-library.js';
import { techniqueSymbol, gameArtUrl } from '../ui/game-art.js';
import { renderTechniqueDamage, renderPracticePurity } from '../ui/technique-profile.js';
import { returnGameSummary } from '../models/game-goal.js';

export function renderGame(ui, state) {
    const { el, button, card, heading } = ui, root = el('section', undefined, 'game-page cultivation-page');
    const top = heading('Tu luyện', 'Luyện công pháp. Chọn thời điểm xuất chiến.');
    top.append(button('Cách chơi', () => ui.openGameGuide(), 'text-button')); root.append(top);
    const selected = state.gamePanel ?? 'practice', navigation = el('nav', undefined, 'game-navigation');
    navigation.setAttribute('aria-label', 'Tu luyện');
    for (const [panel, label] of [['practice', 'Hiện tại'], ['library', 'Công pháp'], ['journey', 'Thử thách'], ['collection', 'Thành tựu']]) {
        const control = button(label, () => ui.showGamePanel(panel), 'text-button');
        control.setAttribute('aria-current', selected === panel ? 'page' : 'false'); control.dataset.gamePanel = panel; navigation.append(control);
    }
    root.append(navigation);
    if (state.featureSaving) root.append(el('p', 'Đang lưu…', 'feature-saving hint'));
    if (state.gameError) {
        const error = el('div', undefined, 'game-feedback'); error.setAttribute('role', 'alert');
        error.append(el('p', state.gameError, 'hint'), button('Thử lại', () => ui.loadGame(), 'secondary')); root.append(error);
    }
    const data = state.gameData, catalog = state.gameCatalog;
    if (!data || (!catalog && selected !== 'practice')) {
        const loading = card('game-loading'); loading.append(el('p', state.gameLoading || state.gameCatalogLoading ? 'Đang tải tu luyện…' : 'Đăng nhập để giữ tiến trình tu luyện.', 'hint'));
        if (state.gameLoading || state.gameCatalogLoading) { root.setAttribute('aria-busy', 'true'); loading.append(el('div', undefined, 'game-skeleton')); }
        root.append(loading); return root;
    }
    if (selected === 'journey') { root.append(renderJourney(ui, data, catalog, state.gameChapter)); return root; }
    if (selected === 'collection') { root.append(renderGameCollection(ui, data, catalog, state)); return root; }
    if (selected === 'library') { root.append(renderLibrary(ui, state, data, catalog)); return root; }
    if (data.pending) {
        const pending = el('div', undefined, 'cultivation-pending');
        const name = data.pendingPractice?.name ?? catalog?.techniques.find(value => value.id === data.pendingPractice?.practice.techniqueId)?.name ?? 'Công pháp';
        pending.append(el('p', data.pending.mode === 'practice' ? name + ' · luyện từ ' + habitDate(data.pending.fromDay)
            : data.pending.mode === 'battle' ? 'Xuất chiến từ ' + habitDate(data.pending.fromDay) : 'Dừng luyện từ ' + habitDate(data.pending.fromDay), 'hint'));
        root.append(pending);
    }
    if (data.settledThrough !== null && data.settledThrough < data.day.day - 1) {
        const processing = el('div', undefined, 'game-processing');
        processing.append(el('p', 'Đang chốt những ngày trước. Thông số hiện tại là phần đã xác nhận.', 'hint'), button('Cập nhật', () => ui.loadGame(), 'text-button')); root.append(processing);
    }
    const result = latestBattleResult(data);
    if (currentBattle(data) || data.current.mode === 'battle' || result && state.gameResultDismissed !== result.id) {
        if (catalog) root.append(renderJourney(ui, data, catalog, state.gameChapter, true));
        else root.append(el('p', 'Đang mở trận hiện tại…', 'hint'));
        if (result && !currentBattle(data)) {
            const next = button(data.current.mode === 'practice' ? 'Tiếp tục luyện' : 'Chọn công pháp', () => {
                state.gameResultDismissed = result.id; ui.showGamePanel(data.current.mode === 'practice' ? 'practice' : 'library');
            }, 'primary'); root.append(next);
        }
        return root;
    }
    const previousResult = returnGameSummary(data);
    if (previousResult) root.append(el('p', previousResult, 'game-return-summary hint'));
    const stored = data.current.mode === 'practice' ? data.currentPractice : null, version = stored?.practice, practice = card('practice-card cultivation-current');
    if (!version) {
        practice.append(el('p', 'HIỆN TẠI', 'eyebrow'), el('h2', data.pending ? 'Lựa chọn đã sẵn sàng' : 'Bắt đầu một công pháp'),
            el('p', data.pending ? 'Lịch mới có hiệu lực từ ngày đã hẹn. Hôm nay vẫn theo chế độ hiện tại.' : 'Chọn một môn để luyện từ thói quen hằng ngày; mang những bản đã luyện vào trận khi sẵn sàng.', 'hint'),
            button('Chọn công pháp', () => ui.showGamePanel('library'), 'primary'));
    } else {
        const technique = catalog?.techniques.find(value => value.id === version.techniqueId) ?? { id: version.techniqueId, name: stored.name ?? 'Công pháp đang luyện', discovery: 'unlocked' };
        const art = el('div', undefined, 'cultivation-current-art'); art.append(techniqueSymbol(version.techniqueId, 128, version.tiers.length));
        const title = el('div', undefined, 'cultivation-current-title');
        title.append(el('p', 'ĐANG LUYỆN', 'eyebrow'), el('h2', technique.name), el('p', version.tiers.length ? 'Tầng ' + version.tiers.length + ' / 4' : 'Đang luyện tới tầng 1', 'practice-state'));
        practice.append(art, title, renderTechniqueDamage(stored.profile), renderPracticePurity(stored.training));
        if (stored.training?.current) {
            const period = stored.training.current, progress = el('progress'); progress.max = period.requiredDays; progress.value = period.days;
            progress.setAttribute('aria-label', 'Thời gian luyện tầng ' + period.tier);
            const meta = el('div', undefined, 'practice-progress-meta');
            meta.append(el('span', 'Tầng ' + period.tier + ' · còn ' + period.remainingDays + ' ngày luyện'), el('span', period.days + ' / ' + period.requiredDays + ' ngày'));
            practice.append(progress, meta);
        } else if (version.rule === 'practice-v1') {
            practice.append(el('p', practiceStatus(version) + ' · bản theo cơ chế trước', 'hint'));
            if (version.tiers.length < 4) practice.append(el('p', 'Tiến độ ' + practiceNumber(version.progressMilli) + ' / ' + practiceNumber(version.costsMilli[version.tiers.length]), 'hint'));
        } else if (!stored.training?.awaitingAudit) practice.append(el('p', stored.training?.grade?.name === 'Thông Thần' ? 'Thông Thần · đã hoàn thiện bản luyện' : 'Hoàn tất 4 tầng · Luyện lại để cải thiện độ thuần khiết', 'hint'));
        const actions = el('div', undefined, 'actions');
        actions.append(button('Xem công pháp', () => ui.openTechnique(technique), 'primary'), button('Đổi môn', () => ui.showGamePanel('library'), 'text-button'));
        practice.append(actions);
        const more = el('details', undefined, 'cultivation-secondary'); more.append(el('summary', 'Điều chỉnh luyện'), button('Dừng luyện', () => ui.stopPractice(), 'text-button')); practice.append(more);
    }
    root.append(practice);
    if (data.recent?.length) {
        const history = el('details', undefined, 'practice-recent'); history.append(el('summary', 'Nhật ký luyện'));
        for (const day of data.recent) {
            const section = el('section', undefined, 'practice-history-day');
            section.append(el('strong', habitDate(day.day)), el('p', day.result.progressMilli ? '+' + practiceNumber(day.result.progressMilli) + (day.rule === 'practice-v2' ? ' ngày luyện' : ' tiến độ') : 'Không có tiến độ luyện', 'hint'));
            history.append(section);
        }
        root.append(history);
    }
    return root;
}

function renderLibrary(ui, state, data, catalog) {
    const { el, button } = ui, root = el('div', undefined, 'game-library');
    const selected = catalog.schools.some(value => value.id === state.gameSchool) || ['forbidden', 'outside'].includes(state.gameSchool) ? state.gameSchool : null;
    const groups = [...catalog.schools, { id: 'forbidden', name: 'Cấm thuật', description: 'Bí tịch có sức mạnh và cái giá riêng.' },
        { id: 'outside', name: 'Ngoài phái', description: 'Các môn phối hợp thế đánh giữa nhiều công pháp.' }];
    const matches = (technique, id) => technique.school === id || technique.kind === id;
    if (!selected) {
        root.append(el('h2', 'Chọn phái'), el('p', 'Mở một phái để xem công pháp và đường học.', 'hint'));
        const schools = el('div', undefined, 'cultivation-schools');
        for (const group of groups) {
            const row = button('', () => ui.selectGameSchool(group.id), 'cultivation-school'); row.dataset.schoolId = group.id;
            const copy = el('div'), values = catalog.techniques.filter(value => matches(value, group.id));
            copy.append(el('h3', group.name), el('p', group.description, 'hint'), el('small', values.filter(value => data.owned.includes(value.id)).length + ' / ' + values.length + ' có thể luyện'));
            if (group.school !== null && catalog.schools.some(value => value.id === group.id)) {
                const image = el('img'); image.src = gameArtUrl('school-' + group.id + '-thumb.webp'); image.width = 64; image.height = 64; image.alt = ''; image.loading = 'lazy'; row.append(image);
            }
            row.append(copy, el('span', '›', 'cultivation-school-arrow')); schools.append(row);
        }
        root.append(schools); return root;
    }
    const group = groups.find(value => value.id === selected);
    root.append(button('‹ Các phái', () => ui.selectGameSchool(''), 'text-button'), el('h2', group.name), el('p', group.description, 'hint'));
    const searchWrap = el('label', 'Tìm trong nhóm này', 'form-field'), search = el('input'); search.type = 'search'; search.placeholder = 'Tên công pháp'; search.maxLength = 100; search.value = state.gameSearch ?? ''; searchWrap.append(search);
    const list = el('div', undefined, 'technique-list');
    function draw() {
        state.gameSearch = search.value; list.replaceChildren();
        const all = catalog.techniques.filter(value => matches(value, selected));
        const visible = all.filter(value => techniqueDiscovered(value, data, catalog) && gameSearchText(value.name).includes(gameSearchText(search.value)));
        for (const technique of visible) {
            const row = button('', () => ui.openTechnique(technique), 'cultivation-technique'); row.dataset.techniqueId = technique.id;
            const stored = [data.currentPractice, data.pendingPractice].find(value => value?.practice.techniqueId === technique.id), copy = el('div');
            copy.append(el('h3', technique.name), el('p', stored ? 'Tầng ' + stored.practice.tiers.length + ' / 4' : data.owned.includes(technique.id) ? 'Đã mở · Chọn để luyện' : 'Xem điều kiện học', 'hint'));
            row.append(techniqueSymbol(technique.id, 44), copy, el('span', stored?.profile ? Number(stored.profile.damage).toLocaleString('vi-VN') : '—', 'cultivation-technique-value')); list.append(row);
        }
        if (!visible.length) list.append(el('p', search.value ? 'Không tìm thấy công pháp trong nhóm này.' : 'Chưa phát hiện công pháp trong nhóm này.', 'hint'));
        const sealed = all.filter(value => !techniqueDiscovered(value, data, catalog));
        if (sealed.length && !search.value) list.append(el('p', sealed.length + ' bí tịch chưa phát hiện. Thử thách sẽ mở thêm đường học.', 'hint'));
    }
    search.addEventListener('input', draw); root.append(searchWrap, list); draw(); return root;
}
