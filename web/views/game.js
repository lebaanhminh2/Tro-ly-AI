import { habitDate } from '../models/habits.js';
import { practiceNumber, practiceStatus, practiceTiers, purityLabel } from '../models/practice.js';
import { renderJourney } from './journey.js';
import { renderGameCollection } from './game-collection.js';
import { matchingTechniques, techniqueDiscovered, currentBattle } from '../models/game-library.js';
import { experiencePreferences } from '../core/experience.js';
import { techniqueSymbol, gameArtUrl } from '../ui/game-art.js';
import { nearestGameGoal, returnGameSummary } from '../models/game-goal.js';

export function renderGame(ui, state) {
    const { el, button, card, heading } = ui, root = el('section', undefined, 'game-page cultivation-page');
    const top = heading('Tu luyện', 'Tích từng ngày. Vượt từng tầng.');
    top.append(button('Cách chơi', () => ui.openGameGuide(), 'text-button')); root.append(top);
    const selected = state.gamePanel ?? 'practice', navigation = el('nav', undefined, 'game-navigation');
    navigation.setAttribute('aria-label', 'Tu luyện');
    for (const [panel, label] of [['practice', 'Hiện tại'], ['library', 'Công pháp'], ['journey', 'Vượt tầng'], ['collection', 'Thành tựu']]) {
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
    if (!data || !catalog) {
        const loading = card('game-loading'); loading.append(el('p', state.gameLoading ? 'Đang mở thư các…' : 'Đăng nhập để giữ tiến trình tu luyện.', 'hint'));
        if (state.gameLoading) { root.setAttribute('aria-busy', 'true'); loading.append(el('div', undefined, 'game-skeleton')); }
        root.append(loading); return root;
    }
    if (selected === 'journey') { root.append(renderJourney(ui, data, catalog, state.gameChapter)); return root; }
    if (selected === 'collection') { root.append(renderGameCollection(ui, data, catalog, state)); return root; }
    if (selected === 'library') { root.append(renderLibrary(ui, state, data, catalog)); return root; }
    if (data.pending) {
        const pending = card('game-pending'), name = catalog.techniques.find(technique => technique.id === data.pendingPractice?.practice.techniqueId)?.name;
        pending.append(el('span', 'ĐÃ HẸN', 'eyebrow'), el('p', data.pending.mode === 'practice'
            ? (name ?? 'Luyện công pháp') + ' · bản ' + (data.pendingPractice?.practice.edition ?? '') + ' từ ' + habitDate(data.pending.fromDay)
            : data.pending.mode === 'battle' ? 'Xuất chiến từ ' + habitDate(data.pending.fromDay) : 'Nghỉ luyện từ ' + habitDate(data.pending.fromDay)));
        root.append(pending);
    }
    if (data.settledThrough !== null && data.settledThrough < data.day.day - 1) {
        const processing = card('game-processing'); processing.append(el('p', 'Đang chốt những ngày trước. Tiến độ dưới đây là phần đã xác nhận.', 'hint'), button('Cập nhật kết quả', () => ui.loadGame(), 'secondary')); root.append(processing);
    }
    if (currentBattle(data) || data.current.mode === 'battle') { root.append(renderJourney(ui, data, catalog, state.gameChapter, true)); return root; }
    if ((data.battles ?? []).some(value => ['won', 'dead', 'expired', 'withdrawn'].includes(value.status))) root.append(renderJourney(ui, data, catalog, state.gameChapter, true));
    const version = data.current.mode === 'practice' ? data.currentPractice?.practice : null, practice = card('practice-card');
    if (!version) {
        const intro = el('div', undefined, 'practice-intro'), portrait = el('img');
        portrait.src = gameArtUrl('tich-van-thumb.webp'); portrait.width = 80; portrait.height = 100; portrait.alt = ''; portrait.decoding = 'async';
        const copy = el('div'); copy.append(el('p', 'THƯ CÁC · TỊCH VÂN', 'eyebrow'), el('h2', data.pending ? 'Sẵn sàng cho nhịp mới' : 'Mỗi ngày, một bước tiến'));
        intro.append(portrait, copy); practice.append(intro, el('p', data.pending ? 'Lựa chọn đã lưu. Hôm nay vẫn theo chế độ hiện tại.' : 'Chọn một công pháp để luyện từ thói quen hằng ngày. Khi sẵn sàng, mang những bản đã luyện đi vượt tầng.', 'technique-description'));
        const actions = el('div', undefined, 'actions'); actions.append(button(data.pending ? 'Xem công pháp' : 'Chọn công pháp', () => ui.showGamePanel('library'), 'primary'), button('Xem tầng đầu', () => ui.showGamePanel('journey'), 'secondary')); practice.append(actions);
        if (!experiencePreferences().gameGuideDismissed && !data.pending && !(data.victories ?? []).length && !(data.battles ?? []).length) {
            const guide = el('aside', undefined, 'game-start-guide'); guide.append(el('p', 'Võ Kỹ có sẵn. Cậu có thể thử tầng đầu khi chưa luyện môn nào.', 'hint'), button('Xem cách chơi', () => ui.openGameGuide(), 'text-button'), button('Để sau', () => ui.dismissGameGuide(), 'text-button')); practice.append(guide);
        }
    } else {
        const technique = catalog.techniques.find(value => value.id === version.techniqueId), title = el('div', undefined, 'technique-heading'), copy = el('div');
        copy.append(el('p', 'ĐANG LUYỆN · BẢN ' + version.edition, 'eyebrow'), el('h2', technique?.name ?? version.techniqueId), el('p', practiceStatus(version), 'practice-state')); title.append(copy, techniqueSymbol(version.techniqueId, 64)); practice.append(title);
        if (version.tiers.length < 4) {
            const max = version.costsMilli[version.tiers.length], progress = el('progress'); progress.max = max; progress.value = version.progressMilli; progress.setAttribute('aria-label', 'Tiến độ ' + practiceTiers[version.tiers.length]);
            const meter = el('div', undefined, 'practice-progress-meta'); meter.append(el('span', 'Tầng ' + (version.tiers.length + 1) + ' / 4'), el('span', practiceNumber(version.progressMilli) + ' / ' + practiceNumber(max))); practice.append(progress, meter);
        }
        const stages = el('ol', undefined, 'cultivation-tiers');
        for (let index = 0; index < 4; index++) { const tier = version.tiers[index], item = el('li', undefined, tier ? 'is-complete' : index === version.tiers.length ? 'is-current' : ''); item.append(el('span', String(index + 1), 'cultivation-tier-mark'), el('strong', practiceTiers[index]), el('small', tier ? purityLabel(tier.purityBp) : index === version.tiers.length ? 'Đang luyện' : 'Chưa tới')); stages.append(item); }
        practice.append(stages);
        if (version.pendingWeeks.length) practice.append(el('p', version.progressMilli >= version.costsMilli[version.tiers.length] ? 'Đủ tiến độ. Chờ cam kết tuần chốt để khóa tinh thuần.' : 'Cam kết tuần đang diễn ra sẽ cùng chốt tinh thuần tầng này.', 'practice-wait-note'));
        const actions = el('div', undefined, 'actions'); if (technique) actions.append(button('Chi tiết & bản luyện', () => ui.openTechnique(technique), 'secondary')); actions.append(button('Đổi môn', () => ui.showGamePanel('library'), 'text-button'), button('Dừng luyện', () => ui.stopPractice(), 'text-button')); practice.append(actions);
    }
    root.append(practice);
    const returning = returnGameSummary(data); if (returning) root.append(el('p', returning, 'hint game-return-summary'));
    const goal = nearestGameGoal(data, catalog);
    if (goal && (version || (data.victories ?? []).length || (data.battles ?? []).length)) { const next = el('aside', undefined, 'game-next-step'); next.append(el('p', 'BƯỚC TIẾP THEO', 'eyebrow'), el('h3', goal.title), el('p', goal.description, 'hint'), button(goal.action, () => ui.followGameGoal(goal), 'text-button')); root.append(next); }
    if (data.recent.length) {
        const history = el('details', undefined, 'practice-recent'); history.append(el('summary', 'Đóng góp đã chốt'));
        for (const day of data.recent) { const section = el('section', undefined, 'practice-history-day'); section.append(el('strong', habitDate(day.day)), el('p', day.result.progressMilli ? '+' + practiceNumber(day.result.progressMilli) + ' tiến độ' : 'Không có tiến độ luyện', 'hint')); for (const habit of day.result.habits ?? []) section.append(el('p', habit.name + ' · ' + (habit.successes ? 'Đạt cam kết' : 'Thiếu cam kết'), 'practice-source')); history.append(section); } root.append(history);
    }
    return root;
}

function renderLibrary(ui, state, data, catalog) {
    const { el, button } = ui, root = el('div', undefined, 'game-library'), mode = el('div', undefined, 'game-library-mode'); let discovery = state.gameLibraryDiscovery ?? false;
    const ownedTab = button('Đã mở · ' + data.owned.length, () => { discovery = false; state.gameLibraryDiscovery = false; updateList(); }, 'text-button'), discoverTab = button('Khám phá', () => { discovery = true; state.gameLibraryDiscovery = true; updateList(); }, 'text-button'); mode.append(ownedTab, discoverTab);
    const filters = el('div', undefined, 'game-library-filters'), searchWrap = el('label', 'Tìm công pháp', 'form-field'), search = el('input'); search.type = 'search'; search.placeholder = 'Tên hoặc cách dùng'; search.maxLength = 100; search.value = state.gameSearch ?? ''; searchWrap.append(search);
    const filterWrap = el('label', 'Nhóm', 'form-field'), filter = el('select');
    for (const [id, name] of [['', 'Mọi phái'], ...catalog.schools.map(school => [school.id, school.name]), ['forbidden', 'Cấm thuật'], ['outside', 'Ngoại đạo']]) { const option = el('option', name); option.value = id; filter.append(option); }
    filter.value = state.gameSchool === 'owned' ? '' : state.gameSchool ?? ''; filterWrap.append(filter); filters.append(searchWrap, filterWrap);
    const intro = el('aside', undefined, 'game-school-intro'), count = el('p', undefined, 'hint game-library-count'), list = el('div', undefined, 'technique-list'); count.setAttribute('role', 'status');
    function updateList() {
        state.gameSearch = search.value; state.gameSchool = filter.value; ownedTab.setAttribute('aria-pressed', String(!discovery)); discoverTab.setAttribute('aria-pressed', String(discovery)); list.replaceChildren(); intro.replaceChildren(); intro.hidden = true;
        const school = catalog.schools.find(value => value.id === filter.value);
        if (school) { const image = el('img'); image.src = gameArtUrl('school-' + school.id + '-thumb.webp'); image.width = 56; image.height = 56; image.alt = ''; image.loading = 'lazy'; const copy = el('div'); copy.append(el('h3', school.name), el('p', school.description, 'hint')); intro.append(image, copy); intro.hidden = false; }
        const candidates = matchingTechniques(catalog, data.owned, filter.value, search.value).filter(technique => discovery || data.owned.includes(technique.id)), visible = candidates.filter(technique => techniqueDiscovered(technique, data, catalog)); count.textContent = visible.length + ' công pháp' + (discovery ? ' đã biết' : ' có thể luyện');
        for (const technique of visible) {
            const owned = data.owned.includes(technique.id), current = data.currentPractice?.practice.techniqueId === technique.id && data.current.mode === 'practice', row = button('', () => ui.openTechnique(technique), 'technique-card technique-book'); row.dataset.techniqueId = technique.id;
            const school = catalog.schools.find(value => value.id === technique.school), art = el('div', undefined, 'technique-book-art'); art.append(techniqueSymbol(technique.id, 56)); const copy = el('div', undefined, 'technique-book-copy'); copy.append(el('small', school?.name ?? (technique.kind === 'outside' ? 'Ngoại đạo' : 'Cấm thuật'), 'technique-school'), el('h3', technique.name), el('p', technique.description, 'technique-description'), el('span', current ? 'Đang luyện' : owned ? 'Đã mở' : 'Xem đường học', 'technique-book-status')); row.append(art, copy); list.append(row);
        }
        if (!visible.length) list.append(el('p', search.value ? 'Không tìm thấy công pháp. Thử đổi từ khóa hoặc nhóm.' : 'Chưa có môn nào trong nhóm này. Khám phá thử thách để mở đường học.', 'hint'));
        if (discovery && !search.value) { const sealed = candidates.filter(technique => !techniqueDiscovered(technique, data, catalog)); if (sealed.length) { const clue = el('aside', undefined, 'game-sealed-clue'), floor = Math.min(...sealed.map(technique => technique.clue?.floor).filter(Number.isFinite)); clue.append(el('span', 'BÍ TỊCH CHƯA LỘ DIỆN', 'eyebrow'), el('h3', sealed.length + ' bí tịch còn trong bóng tối'), el('p', Number.isFinite(floor) ? 'Dấu vết gần nhất xuất hiện sau tầng ' + String(floor).padStart(2, '0') + '.' : 'Vượt thêm tầng để tìm dấu vết. Tên và đường học sẽ hiện khi cậu đến gần.', 'hint'), button('Đến Vượt tầng', () => ui.showGamePanel('journey'), 'text-button')); list.append(clue); } }
    }
    search.addEventListener('input', updateList); filter.addEventListener('change', updateList); root.append(mode, filters, intro, count, list); updateList(); return root;
}
