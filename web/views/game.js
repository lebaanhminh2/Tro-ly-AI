import { habitDate } from '../models/habits.js';
import { practiceNumber, practiceStatus, practiceTiers, purityLabel } from '../models/practice.js';
import { renderJourney } from './journey.js';
import { renderGameCollection } from './game-collection.js';
import { matchingTechniques } from '../models/game-library.js';
import { experiencePreferences } from '../core/experience.js';
import { techniqueSymbol } from '../ui/game-art.js';
import { nearestGameGoal, returnGameSummary } from '../models/game-goal.js';

export function renderGame(ui, state) {
    const { el, button, card, heading } = ui, root = el('section', undefined, 'game-page');
    const top = heading('Thần Lộ', 'Một hành trình từ những việc nhỏ mỗi ngày.');
    top.append(button('Cách chơi', () => ui.openGameGuide(), 'text-button')); root.append(top);
    if (state.featureSaving) root.append(el('p', 'Đang lưu thao tác…', 'feature-saving hint'));
    if (state.gameError) root.append(el('p', state.gameError, 'hint'), button('Tải lại', () => ui.loadGame(), 'secondary'));
    const data = state.gameData, catalog = state.gameCatalog;
    if (!data || !catalog) {
        root.append(el('p', state.gameLoading ? 'Đang mở thư các…' : 'Mở app đã đăng nhập để bắt đầu hành trình.', 'hint'));
        if (state.gameLoading) root.setAttribute('aria-busy', 'true');
        return root;
    }
    const navigation = el('div', undefined, 'habit-navigation game-navigation');
    const selectedPanel = state.gamePanel ?? 'practice';
    for (const [panel, label] of [['journey', 'Hành trình'], ['library', 'Công pháp'], ['collection', 'Sưu tập']]) {
        const control = button(label, () => ui.showGamePanel(panel), 'text-button');
        control.setAttribute('aria-pressed', String(selectedPanel === panel)); navigation.append(control);
    }
    if (selectedPanel !== 'practice') root.append(button('‹ Thần Lộ', () => ui.showGamePanel('practice'), 'text-button feature-back'), navigation);
    if (selectedPanel === 'journey') { root.append(renderJourney(ui, data, catalog, state.gameChapter)); return root; }
    if (selectedPanel === 'collection') { root.append(renderGameCollection(ui, data, catalog)); return root; }
    if (state.gamePanel === 'library') {
        const filters = el('div', undefined, 'game-library-filters'), searchWrap = el('label', 'Tìm công pháp', 'form-field');
        const search = el('input'); search.type = 'search'; search.placeholder = 'Tên hoặc cách dùng'; search.maxLength = 100; search.value = state.gameSearch ?? ''; searchWrap.append(search);
        const filterWrap = el('label', 'Nhóm', 'form-field'), filter = el('select');
        for (const [id, name] of [['owned', 'Đã mở'], ...catalog.schools.map(school => [school.id, school.name]), ['forbidden', 'Cấm thuật'], ['outside', 'Ngoại Đạo'], ['', 'Tất cả']]) {
            const option = el('option', name); option.value = id; filter.append(option);
        }
        filter.value = state.gameSchool ?? 'owned'; filterWrap.append(filter); filters.append(searchWrap, filterWrap);
        const count = el('p', undefined, 'hint'), list = el('div', undefined, 'technique-list'); count.setAttribute('role', 'status');
        const schoolIntro = el('aside', undefined, 'game-school-intro');
        function updateList() {
            state.gameSearch = search.value; state.gameSchool = filter.value; list.replaceChildren();
            schoolIntro.replaceChildren(); schoolIntro.hidden = true;
            const selectedSchool = catalog.schools.find(school => school.id === filter.value);
            if (selectedSchool) {
                const image = el('img'); image.src = './assets/than-lo/school-' + selectedSchool.id + '-thumb.webp';
                image.width = 64; image.height = 64; image.alt = ''; image.loading = 'lazy';
                const copy = el('div'); copy.append(el('h3', selectedSchool.name), el('p', selectedSchool.description, 'hint'));
                schoolIntro.append(image, copy); schoolIntro.hidden = false;
            }
            const techniques = matchingTechniques(catalog, data.owned, filter.value, search.value);
            count.textContent = techniques.length + ' công pháp';
            if (!techniques.length) list.append(el('p', 'Chưa có công pháp phù hợp. Thử đổi nhóm hoặc từ tìm nhé.', 'hint'));
            for (const technique of techniques) {
                const row = card('technique-card'), school = catalog.schools.find(school => school.id === technique.school), owned = data.owned.includes(technique.id);
                const heading = el('div', undefined, 'technique-heading'), copy = el('div');
                copy.append(el('small', school?.name ?? (technique.kind === 'outside' ? 'Ngoại Đạo' : 'Cấm thuật'), 'technique-school'), el('h2', technique.name));
                heading.append(copy, techniqueSymbol(technique.id));
                row.append(heading, el('p', technique.description, 'technique-description'), button(owned ? 'Xem và chọn luyện' : 'Xem cách mở', () => ui.openTechnique(technique), 'secondary'));
                list.append(row);
            }
        }
        search.addEventListener('input', updateList); filter.addEventListener('change', updateList); updateList();
        root.append(filters, schoolIntro, count, list); return root;
    }
    if (data.pending) {
        const pending = card('game-pending');
        const name = catalog.techniques.find(technique => technique.id === data.pendingPractice?.practice.techniqueId)?.name;
        pending.append(el('p', data.pending.mode === 'practice' ? 'Từ ' + habitDate(data.pending.fromDay) + ' · ' + name + ' · bản ' + data.pendingPractice?.practice.edition : data.pending.mode === 'battle' ? 'Xuất chiến từ ' + habitDate(data.pending.fromDay) : 'Dừng luyện từ ' + habitDate(data.pending.fromDay)));
        root.append(pending);
    }
    if (data.settledThrough !== null && data.settledThrough < data.day.day - 1) {
        const processing = card('game-processing');
        processing.append(el('p', 'Đang chốt những ngày trước. Tiến độ dưới đây là phần đã xác nhận.', 'hint'), button('Cập nhật kết quả', () => ui.loadGame(), 'secondary')); root.append(processing);
    }
    const version = data.currentPractice?.practice;
    const practice = card('practice-card');
    if (data.current.mode === 'battle') {
        root.append(renderJourney(ui, data, catalog, state.gameChapter, true), navigation); return root;
    }
    if (!version) {
        const intro = el('div', undefined, 'practice-intro'), portrait = el('img');
        portrait.src = './assets/than-lo/tich-van-thumb.webp'; portrait.width = 80; portrait.height = 100; portrait.alt = 'Tịch Vân, người giữ thư các';
        const copy = el('div'); copy.append(el('p', 'TỊCH VÂN · THƯ CÁC', 'eyebrow'), el('h2', data.pending ? 'Đã sẵn sàng cho ngày mai' : 'Hành trình của cậu bắt đầu ở đây'));
        intro.append(portrait, copy); practice.append(intro, el('p', data.pending ? 'Lựa chọn đã lưu. Từ ngày sinh hoạt kế tiếp, cam kết đạt mục tiêu sẽ góp vào hành trình.' : 'Luyện công pháp từ những thói quen hằng ngày, rồi mang thành quả vào các trận chiến.', 'technique-description'));
        if (!data.pending) {
            const first = catalog.bosses.find(boss => !(data.victories ?? []).includes(boss.id) && boss.requires.every(id => (data.victories ?? []).includes(id)) && !(boss.practicePrerequisites ?? []).length);
            if (first) practice.append(button('Thử trận đầu', () => ui.prepareBoss(first), 'primary'));
        }
        practice.append(button(data.pending ? 'Đổi lựa chọn' : 'Chọn công pháp', () => ui.showGamePanel('library'), 'secondary'));
        if (!experiencePreferences().gameGuideDismissed && !data.pending && !data.recent.length && !(data.victories ?? []).length && !(data.battles ?? []).length) {
            const guide = el('aside', undefined, 'game-start-guide');
            guide.append(el('p', 'Trận đầu có thể dùng Võ Kỹ, chưa cần luyện công pháp.'), button('Xem hướng dẫn', () => ui.openGameGuide(), 'text-button'), button('Để sau', () => ui.dismissGameGuide(), 'text-button'));
            practice.append(guide);
        }
    } else {
        const technique = catalog.techniques.find(technique => technique.id === version.techniqueId);
        const title = el('div', undefined, 'technique-heading'), name = el('div');
        name.append(el('p', 'TU LUYỆN · BẢN ' + version.edition, 'eyebrow'), el('h2', technique?.name ?? version.techniqueId));
        title.append(name, techniqueSymbol(version.techniqueId, 48)); practice.append(title, el('p', practiceStatus(version), 'practice-state'));
        if (version.tiers.length < 4) {
            const max = version.costsMilli[version.tiers.length], progress = el('progress');
            progress.max = max; progress.value = version.progressMilli; progress.setAttribute('aria-label', 'Tiến độ tầng đang luyện');
            practice.append(progress, el('p', practiceNumber(version.progressMilli) + ' / ' + practiceNumber(max) + ' tiến độ', 'practice-count'));
        }
        if (version.pendingWeeks.length) practice.append(el('p', version.progressMilli >= version.costsMilli[version.tiers.length]
            ? 'Tầng này chờ chốt tinh thuần khi cam kết tuần kết thúc hoặc đạt đủ số ngày.'
            : 'Tinh thuần của tầng này còn phụ thuộc cam kết tuần đang diễn ra.', 'practice-wait-note'));
        const levels = el('details', undefined, 'practice-levels'); levels.append(el('summary', 'Các tầng & tinh thuần'));
        const tiers = el('div', undefined, 'practice-tier-list');
        for (let index = 0; index < 4; index++) {
            const locked = version.tiers[index], item = el('div');
            item.append(el('span', practiceTiers[index]), el('strong', locked ? purityLabel(locked.purityBp) : index === version.tiers.length ? 'Đang luyện' : 'Chưa tới')); tiers.append(item);
        }
        levels.append(tiers); practice.append(levels);
        if (version.tiers.length) practice.append(el('p', practiceTiers[version.tiers.length - 1] + ' · tinh thuần ' + purityLabel(version.tiers.at(-1).purityBp), 'practice-quality'));
        const actions = el('div', undefined, 'actions'); actions.append(button('Đổi môn / bản', () => ui.showGamePanel('library'), 'secondary'), button('Dừng luyện', () => ui.stopPractice(), 'text-button')); practice.append(actions);
    }
    root.append(practice);
    const goal = nearestGameGoal(data, catalog), returning = returnGameSummary(data);
    if (returning) root.append(el('p', returning, 'hint game-return-summary'));
    if (goal && (version || (data.victories ?? []).length || (data.battles ?? []).length)) {
        const next = el('aside', undefined, 'game-next-step');
        next.append(el('p', 'BƯỚC TIẾP THEO', 'eyebrow'), el('h3', goal.title));
        if (!(version?.pendingWeeks.length && version.progressMilli >= version.costsMilli[version.tiers.length])) next.append(el('p', goal.description, 'hint'));
        next.append(button(goal.action, () => ui.followGameGoal(goal), 'text-button'));
        root.append(next);
    }
    if (data.recent.length) {
        const history = el('details', undefined, 'practice-recent'); history.append(el('summary', 'Những ngày đã chốt'));
        for (const day of data.recent) {
            const line = el('p', undefined, 'hint');
            line.append(el('span', habitDate(day.day) + ' · '), el('span', day.result.progressMilli ? '+' + practiceNumber(day.result.progressMilli) + ' tiến độ' : 'Không có tiến độ luyện'));
            if (day.result.directMisses || day.result.weeklyMisses) line.append(el('span', ' · có cam kết thiếu'));
            history.append(line);
            for (const habit of day.result.habits ?? []) history.append(el('p', habit.name + ' · ' + (habit.successes ? 'Đạt cam kết' : 'Thiếu cam kết') +
                (habit.receiver === 'practice' && habit.successes ? ' · góp tiến độ luyện' : ''), 'practice-source'));
        }
        root.append(history);
    }
    root.append(navigation);
    return root;
}
