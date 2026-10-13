import { habitDate } from '../models/habits.js';
import { purityLabel, practiceTiers } from '../models/practice.js';
import { mainFloors } from '../models/game-library.js';
import { gameArtUrl } from '../ui/game-art.js';

export function renderGameCollection(ui, data, catalog, state = {}) {
    const { el, button } = ui, root = el('div', undefined, 'game-collection'), victories = new Set(data.victories ?? []);
    const floors = mainFloors(catalog), header = el('section', undefined, 'game-achievement-overview');
    header.append(el('p', 'THÀNH TỰU', 'eyebrow'), el('h2', victories.size ? 'Những đối thủ đã vượt qua' : 'Chiến tích đầu tiên đang chờ'), el('p', victories.size + ' đối thủ · ' + floors.filter(boss => victories.has(boss.id)).length + ' / ' + floors.length + ' tầng', 'hint')); root.append(header);
    if (!victories.size) {
        const empty = el('div', undefined, 'game-victory-empty');
        empty.append(el('span', '✧', 'game-victory-seal'), el('p', 'Mỗi chiến thắng sẽ ở lại đây: ngày vượt qua, bộ chiêu đã dùng và đường học đã mở.', 'hint'), button('Đến Vượt tầng', () => ui.showGamePanel('journey'), 'primary')); root.append(empty);
    } else {
        if (state.gameVictoriesLoading && !state.gameVictories) root.append(el('p', 'Đang mở chiến tích…', 'hint'));
        if (state.gameVictoriesError) root.append(el('p', state.gameVictoriesError, 'hint'), button('Thử lại', () => ui.loadGameVictories(), 'secondary'));
        const records = state.gameVictories?.victories ?? [], byBoss = new Map(records.map(record => [record.bossId, record]));
        const list = el('div', undefined, 'game-victory-list');
        for (const boss of catalog.bosses.filter(value => victories.has(value.id))) {
            const record = byBoss.get(boss.id), floor = floors.findIndex(value => value.id === boss.id) + 1, row = el('details', undefined, 'game-victory');
            row.open = state.gameVictoryFocus === boss.id;
            row.addEventListener('toggle', () => { if (row.open) state.gameVictoryFocus = boss.id; else if (state.gameVictoryFocus === boss.id) state.gameVictoryFocus = null; });
            row.dataset.victoryBoss = boss.id; const summary = el('summary'), copy = el('div'), seal = el('span', floor ? String(floor).padStart(2, '0') : '✧', 'game-victory-seal');
            copy.append(el('small', floor ? 'TẦNG ' + String(floor).padStart(2, '0') + ' · ĐÃ VƯỢT' : 'CƠ DUYÊN · ĐÃ VƯỢT', 'eyebrow'), el('h3', boss.name), el('p', record ? habitDate(record.wonDay) + ' · ' + record.turn + ' lượt' : 'Chiến thắng đã ghi nhận', 'hint'));
            summary.append(seal, copy); if (boss.artId) { const image = el('img'); image.src = gameArtUrl(boss.artId + '-thumb.webp'); image.alt = ''; image.width = 52; image.height = 68; image.loading = 'lazy'; summary.append(image); } row.append(summary);
            const content = el('div', undefined, 'game-victory-detail');
            if (record) {
                content.append(el('p', record.victory, 'battle-story'));
                if (record.loadout?.length) {
                    const skills = el('ul', undefined, 'game-victory-skills');
                    for (const skill of record.loadout) skills.append(el('li', (catalog.techniques.find(technique => technique.id === (skill.id ?? skill.techniqueId))?.name ?? skill.name ?? skill.id) + (skill.edition ? ' · bản ' + skill.edition : '') + (skill.tier ? ' · ' + practiceTiers[skill.tier - 1] : '') + (skill.purityBp != null ? ' · ' + purityLabel(skill.purityBp) : '')));
                    content.append(el('h4', 'Bộ công pháp khi kết thúc'), skills);
                } else content.append(el('p', 'Võ Kỹ', 'hint'));
                if (record.usedTechniqueIds?.length) {
                    const casts = record.usedTechniqueIds.map(id => id === 'vo-ky' ? 'Võ Kỹ' : catalog.techniques.find(technique => technique.id === id)?.name ?? id);
                    content.append(el('h4', 'Chiêu đã dùng'), el('p', casts.join(' · '), 'hint'));
                }
                const opened = (record.unlocks ?? []).map(id => catalog.techniques.find(technique => technique.id === id)?.name).filter(Boolean);
                if (opened.length) content.append(el('p', 'Đường học đã mở · ' + opened.join(' · '), 'battle-unlocks'));
                if (record.rescueUsed) content.append(el('p', 'Đã dùng quyền cứu mạng trong trận này.', 'hint'));
                content.append(button('Nhật ký chiến thắng', () => ui.openBattleHistory({ id: record.battleId, content: { name: boss.name } }), 'text-button'));
            } else content.append(el('p', 'Mở lịch sử để xem nhật ký các trận với đối thủ này.', 'hint'), button('Lịch sử giao chiến', () => ui.openBattleArchive(), 'text-button'));
            const replay = el('details', undefined, 'game-victory-replay'); replay.append(el('summary', 'Thử thách lại'), el('p', 'Chiến tích đầu tiên vẫn được giữ. Trận mới bắt đầu từ ngày sinh hoạt kế tiếp.', 'hint'), button('Xem & chuẩn bị', () => ui.prepareBoss(boss), 'secondary')); content.append(replay);
            row.append(content); list.append(row);
        }
        root.append(list);
    }
    const rewards = data.rewards ?? [], achievements = el('details', undefined, 'collection-titles'), earned = (catalog.achievements ?? []).filter(value => rewards.some(reward => reward.kind === 'achievement' && reward.id === value.id));
    achievements.append(el('summary', 'Danh hiệu · ' + earned.length + ' / ' + (catalog.achievements ?? []).length));
    for (const achievement of catalog.achievements ?? []) {
        const owned = earned.includes(achievement), row = el('div', undefined, 'game-achievement'), copy = el('div');
        copy.append(el('h3', achievement.name), el('p', achievement.description, 'hint')); row.append(el('span', owned ? '✓' : '·', 'game-achievement-mark'), copy); row.setAttribute('aria-label', achievement.name + (owned ? ' · đã đạt' : ' · chưa đạt')); achievements.append(row);
    }
    root.append(achievements);
    const tools = el('details', undefined, 'game-export-controls'); tools.append(el('summary', 'Lịch sử & lưu hồ sơ'), el('p', 'Giữ lại bản luyện, chiến tích và nhật ký của mình.', 'hint'), button('Lịch sử tất cả trận', () => ui.openBattleArchive(), 'text-button'), button('Xuất hành trình', () => ui.openGameExport(), 'secondary')); root.append(tools); return root;
}
