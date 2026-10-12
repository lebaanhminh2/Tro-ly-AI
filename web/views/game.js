import { habitDate } from '../models/habits.js';
import { practiceNumber, practiceStatus, practiceTiers, purityLabel } from '../models/practice.js';

export function renderGame(ui, state) {
    const { el, button, card, heading } = ui, root = el('section', undefined, 'game-page');
    root.append(heading('Thần Lộ', 'Tu luyện từ những cam kết ngoài đời.'));
    if (state.gameError) root.append(el('p', state.gameError, 'hint'), button('Tải lại', () => ui.loadGame(), 'secondary'));
    const data = state.gameData, catalog = state.gameCatalog;
    if (!data || !catalog) {
        root.append(el('p', state.gameLoading ? 'Đang mở thư các…' : 'Mở app đã đăng nhập để bắt đầu hành trình.', 'hint'));
        if (state.gameLoading) root.setAttribute('aria-busy', 'true');
        return root;
    }
    const navigation = el('div', undefined, 'habit-navigation');
    for (const [panel, label] of [['practice', 'Tu luyện'], ['library', 'Công pháp']]) {
        const control = button(label, () => ui.showGamePanel(panel), 'text-button');
        control.setAttribute('aria-pressed', String((state.gamePanel ?? 'practice') === panel)); navigation.append(control);
    }
    root.append(navigation);
    if (state.gamePanel === 'library') {
        const filters = el('div', undefined, 'game-school-filters');
        for (const [id, name] of [['owned', 'Đã mở'], ...catalog.schools.map(school => [school.id, school.name]), ['', 'Tất cả']]) {
            const control = button(name, () => ui.selectGameSchool(id), 'text-button');
            control.setAttribute('aria-pressed', String((state.gameSchool ?? 'owned') === id)); filters.append(control);
        }
        root.append(filters);
        const selected = state.gameSchool ?? 'owned', list = el('div', undefined, 'technique-list');
        for (const technique of catalog.techniques.filter(technique => selected === 'owned' ? data.owned.includes(technique.id) : !selected || technique.school === selected)) {
            const row = card('technique-card'), school = catalog.schools.find(school => school.id === technique.school);
            row.append(el('small', school?.name ?? (technique.kind === 'outside' ? 'Ngoại Đạo' : 'Cấm thuật'), 'technique-school'), el('h2', technique.name), el('p', technique.description, 'technique-description'),
                button(data.owned.includes(technique.id) ? 'Xem và chọn luyện' : 'Chưa mở', () => ui.openTechnique(technique), 'secondary'));
            list.append(row);
        }
        root.append(list); return root;
    }
    if (data.pending) {
        const pending = card('game-pending');
        const name = catalog.techniques.find(technique => technique.id === data.pendingPractice?.practice.techniqueId)?.name;
        pending.append(el('p', data.pending.mode === 'practice' ? 'Từ ' + habitDate(data.pending.fromDay) + ' · ' + name + ' · bản ' + data.pendingPractice?.practice.edition : 'Dừng luyện từ ' + habitDate(data.pending.fromDay)));
        root.append(pending);
    }
    if (data.settledThrough !== null && data.settledThrough < data.day.day - 1) {
        const processing = card('game-processing');
        processing.append(el('p', 'Đang chốt những ngày trước. Tiến độ dưới đây là phần đã xác nhận.', 'hint'), button('Cập nhật kết quả', () => ui.loadGame(), 'secondary')); root.append(processing);
    }
    const version = data.currentPractice?.practice;
    const practice = card('practice-card');
    if (!version) {
        const intro = el('div', undefined, 'practice-intro'), portrait = el('img');
        portrait.src = './assets/than-lo/tich-van-thumb.webp'; portrait.width = 64; portrait.height = 64; portrait.alt = 'Tịch Vân, người giữ thư các'; portrait.loading = 'lazy';
        const copy = el('div'); copy.append(el('p', 'TỊCH VÂN · THƯ CÁC', 'eyebrow'), el('h2', data.pending ? 'Ngày mai bắt đầu nhé' : 'Chọn một môn để bắt đầu'));
        intro.append(portrait, copy); practice.append(intro, el('p', 'Một habit vừa sức là đủ. Mỗi ngày đạt cam kết, cậu tiến thêm một chút; công pháp có thể dùng từ Nhập môn.', 'technique-description'), button(data.pending ? 'Đổi lựa chọn' : 'Chọn công pháp', () => ui.showGamePanel('library'), 'primary'));
    } else {
        const technique = catalog.techniques.find(technique => technique.id === version.techniqueId);
        practice.append(el('p', 'BẢN ' + version.edition, 'eyebrow'), el('h2', technique?.name ?? version.techniqueId), el('p', practiceStatus(version), 'practice-state'));
        if (version.tiers.length < 4) {
            const max = version.costsMilli[version.tiers.length], progress = el('progress');
            progress.max = max; progress.value = version.progressMilli; progress.setAttribute('aria-label', 'Tiến độ tầng đang luyện');
            practice.append(progress, el('p', practiceNumber(version.progressMilli) + ' / ' + practiceNumber(max) + ' tiến độ', 'practice-count'));
        }
        const tiers = el('div', undefined, 'practice-tier-list');
        for (let index = 0; index < 4; index++) {
            const locked = version.tiers[index], item = el('div');
            item.append(el('span', practiceTiers[index]), el('strong', locked ? purityLabel(locked.purityBp) : 'Chưa chốt')); tiers.append(item);
        }
        practice.append(tiers);
        if (version.pendingWeeks.length) practice.append(el('p', 'Tinh thuần còn chờ cam kết tuần. Đổi môn hoặc dừng luyện vẫn giữ nghĩa vụ của tuần này.', 'hint'));
        const actions = el('div', undefined, 'actions'); actions.append(button('Đổi môn / bản', () => ui.showGamePanel('library'), 'secondary'), button('Dừng luyện', () => ui.stopPractice(), 'text-button')); practice.append(actions);
    }
    root.append(practice);
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
    return root;
}
