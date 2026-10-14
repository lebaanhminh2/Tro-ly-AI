import { habitDate } from '../models/habits.js';
import { bossDiscovered, mainFloors, currentBattle, latestBattleResult } from '../models/game-library.js';
import { gameArtUrl } from '../ui/game-art.js';
const statusNames = { won: 'Đã thắng', awaiting_rescue: 'Chờ cứu mạng', dead: 'Tử trận', expired: 'Hết lượt giao chiến', withdrawn: 'Đã rút lui', cancelled: 'Đã hủy chuẩn bị' };

export function renderJourney(ui, data, catalog, selectedChapter, principalOnly = false) {
    const { el, button, card } = ui, root = el('div', undefined, 'journey-page');
    const current = currentBattle(data) ?? latestBattleResult(data) ?? (principalOnly ? (data.battles ?? []).find(battle => ['won', 'dead', 'expired', 'withdrawn'].includes(battle.status)) : null);
    const catchingUp = data.settledThrough !== null && data.settledThrough < data.day.day - 1;
    if (catchingUp) root.append(el('p', 'Đang chốt những ngày trước. Cập nhật kết quả để chọn cho hôm nay.', 'hint'), button('Cập nhật kết quả', () => ui.loadGame(), 'secondary'));
    if (current) {
        const battle = current.state, panel = card('battle-card'), header = el('div', undefined, 'battle-heading'), copy = el('div');
        copy.append(el('p', (mainFloors(catalog).findIndex(boss => boss.id === current.bossId) >= 0 ? 'TUYẾN CHÍNH · ' + String(mainFloors(catalog).findIndex(boss => boss.id === current.bossId) + 1).padStart(2, '0') : 'CƠ DUYÊN') + ' · ' + (current.startsDay > data.day.day ? 'ĐÃ CHUẨN BỊ' : battle.status === 'active' ? 'XUẤT CHIẾN' : statusNames[battle.status] ?? 'KẾT QUẢ'), 'eyebrow'), el('h2', current.content.name));
        header.append(copy);
        if (current.content.artId) {
            const image = el('img'); image.src = gameArtUrl(current.content.artId + '-thumb.webp'); image.width = 76; image.height = 96;
            image.alt = current.content.name; image.loading = 'lazy'; header.append(image);
            if (current.content.artPosition) image.style.objectPosition = current.content.artPosition.map(value => value * 100 + '%').join(' ');
        }
        panel.append(header);
        if (current.startsDay > data.day.day) {
            panel.append(el('p', 'Bắt đầu từ ' + habitDate(current.startsDay) + '. Hôm nay vẫn theo lịch luyện đã chọn.', 'technique-description'),
                button('Đổi bộ chiêu', () => ui.prepareBoss(current.content, current), 'secondary'), button('Hủy chuẩn bị', () => ui.cancelBattle(current), 'text-button'));
        } else {
            panel.append(el('p', statusNames[battle.status] ?? ('Lượt ' + Math.min(battle.turn + 1, battle.maxTurns) + ' / ' + battle.maxTurns + (current.waitDays ? ' · đang chờ chọn chiêu' : '')), 'practice-state'));
            const meters = el('div', undefined, 'battle-vitals');
            for (const [label, fighter] of [['Cậu', battle.player], ['Đối thủ', battle.boss]]) {
                const meter = el('div'), labelRow = el('div'), progress = el('progress');
                labelRow.append(el('span', label), el('strong', fighter.hp + ' / ' + fighter.maxHp)); progress.max = fighter.maxHp; progress.value = fighter.hp;
                progress.setAttribute('aria-label', label + ' · sinh lực'); meter.append(labelRow, progress); meters.append(meter);
            }
            panel.append(meters);
            const liveEffects = el('details', undefined, 'battle-active-effects');
            liveEffects.append(el('summary', 'Phòng ngự và hiệu ứng đang có'), el('p', 'Phòng thủ: cậu ' + battle.player.armor + ' · đối thủ ' + battle.boss.armor + '.', 'hint'));
            const effectNames = { shield: 'Khiên', virtual_armor: 'Giáp Ảo', reduction: 'Giảm thương', reflect: 'Phản thương', bleed: 'Chảy máu', attack_buff: 'Tăng sát thương', mark: 'Đòn trễ', echo: 'Tái hiện sát thương', seal: 'Niêm phong' };
            for (const effect of battle.statuses ?? []) {
                if (effect.expiresTurn <= battle.turn) continue;
                const rate = ['reduction', 'reflect', 'attack_buff'].includes(effect.kind);
                const name = effect.kind === 'reduction' && effect.value < 0 ? 'Tăng sát thương nhận' : effectNames[effect.kind] ?? 'Hiệu ứng';
                liveEffects.append(el('p', (effect.target === 'player' ? 'Cậu · ' : 'Đối thủ · ') + name + ' ' +
                    (rate ? Math.abs(effect.value) / 10 + '%' : effect.value + ' điểm') + ' · ' + (effect.expiresTurn - battle.turn) + ' lượt còn lại' +
                    (effect.dueTurn != null ? ' · tới hạn lượt ' + effect.dueTurn : ''), 'hint'));
            }
            if (battle.guard) liveEffects.append(el('p', 'Cương Kình ' + battle.guard + ' / 3', 'hint'));
            if (battle.illusion) liveEffects.append(el('p', 'Hư Ảnh · đang có', 'hint'));
            if (battle.seals?.length) liveEffects.append(el('p', 'Bốn ấn · ' + battle.seals.length + ' / 4', 'hint'));
            if (battle.revival.remaining) liveEffects.append(el('p', 'Đối thủ còn ' + battle.revival.remaining + ' lần hồi sinh · ' + battle.revival.hpPercent / 10 + '% HP tối đa mỗi lần.', 'hint'));
            if (battle.loadout.some(skill => skill.id === 'huyen-quy' && skill.strength && skill.tier >= 2)) liveEffects.append(el('p', 'Nội tại Huyền Quy · ' + (battle.passiveUses?.includes('huyen-quy') ? 'đã dùng' : 'sẵn sàng khi còn sống và HP ≤35%'), 'hint'));
            panel.append(liveEffects);
            if (battle.status === 'active') {
                for (const announced of battle.announced) {
                    const intent = announced.intent, box = el('section', undefined, 'battle-intent');
                    box.append(el('p', (announced.turn === battle.turn + 1 ? 'Đối thủ chuẩn bị' : 'Đã soi · lượt ' + announced.turn) + ' · ' + intent.name, 'battle-intent-name'),
                        el('p', intent.description, 'hint'), el('p', intent.hits.join(' + ') + ' sát thương trước phòng ngự', 'battle-intent-damage'));
                    panel.append(box);
                }
                const chosen = (data.choices ?? []).find(choice => choice.battleId === current.id);
                panel.append(el('h3', 'Chiêu hôm nay', 'battle-choice-title'));
                const selected = chosen && battle.choices.find(choice => choice.id === chosen.techniqueId);
                panel.append(el('p', selected ? 'Đã chọn ' + selected.name + '. Có thể đổi trước khi chốt ngày.' : 'Chưa chọn thì trận chờ; đối thủ không tự đánh.', 'hint'));
                if (selected?.repeatDamagePenalty) panel.append(el('p', 'Chiêu đang chọn bị đọc: −' + selected.repeatDamagePenalty / 10 + '% sát thương lượt này.', 'battle-warning'));
                const choose = button(selected ? 'Đổi chiêu' : 'Chọn chiêu', () => ui.openBattleChoices(current), 'primary');
                choose.dataset.write = 'battle-choice'; choose.disabled = catchingUp || !!ui.state().featureSaving;
                panel.append(choose, el('p', 'Chốt cuối ngày sinh hoạt. Habit đủ mục tiêu tăng sức mạnh; công việc góp thêm tối đa 10%.', 'hint'));
                const actions = el('div', undefined, 'actions'), withdraw = button('Rút lui', () => ui.withdrawBattle(current), 'text-button');
                if (battle.exchangeAvailable && !chosen) {
                    const exchange = button('Đổi một ô công pháp', () => ui.openBattleExchange(current), 'secondary'); exchange.disabled = catchingUp; actions.append(exchange);
                }
                withdraw.disabled = catchingUp; actions.append(withdraw); panel.append(actions);
            } else if (battle.status === 'awaiting_rescue') {
                panel.append(el('h3', 'Sinh lực đã cạn'), el('p', 'Chọn cứu mạng hoặc chấp nhận tử trận. Quyền cứu chung chỉ dùng một lần trong trận.', 'hint'),
                    el('p', 'Còn ' + Math.max(0, current.rescueUntilDay - data.day.day) + ' ngày sinh hoạt để quyết định.', 'hint'));
                panel.append(el('p', 'Hiện có ' + data.combatEconomy.qi + ' Tu Vi' + (!current.rescue.qiAvailable ? ' · chưa đủ điều kiện Hộ Mệnh' : ''), 'hint'));
                const actions = el('div', undefined, 'battle-rescue-actions'), qi = button('Hộ Mệnh · ' + current.rescue.qiCost + ' Tu Vi', () => ui.rescueBattle(current, 'qi'), 'primary');
                qi.disabled = !current.rescue.qiAvailable || catchingUp; actions.append(qi);
                if (battle.rankRescueAvailable) {
                    const rank = button('Nghịch Mệnh · 1 cảnh giới', () => ui.rescueBattle(current, 'rank'), 'secondary');
                    rank.disabled = !current.rescue.rankAvailable || catchingUp; actions.append(rank);
                }
                const death = button('Chấp nhận tử trận', () => ui.acceptBattleDeath(current), 'text-button'); death.disabled = catchingUp;
                actions.append(death); panel.append(actions);
             } else {
                panel.append(el('p', battle.status === 'won' ? current.content.victory : current.content.defeat, 'battle-story'));
                if (current.finishedDay != null) panel.append(el('p', 'Kết thúc ' + habitDate(current.finishedDay) + ' · ' + battle.turn + ' lượt', 'hint'));
                const names = (current.content.unlocks ?? []).map(id => catalog.techniques.find(technique => technique.id === id)?.name).filter(Boolean);
                if (battle.status === 'won' && names.length) panel.append(el('p', 'Đường học đã mở: ' + names.join(' · '), 'battle-unlocks'));
                if (data.current.mode === 'practice') panel.append(el('p', 'Lịch luyện đã trở lại từ ' + habitDate(data.current.fromDay) + '.', 'hint'));
                else if (data.pending?.mode === 'practice') panel.append(el('p', 'Trở lại lịch luyện từ ' + habitDate(data.pending.fromDay) + '.', 'hint'));
                else panel.append(el('p', 'Các bản luyện được giữ lại. Cậu có thể chọn nhịp tiếp theo khi sẵn sàng.', 'hint'));
                panel.append(button(battle.status === 'won' ? 'Xem thành tựu' : 'Chọn thử thách tiếp', () => {
                    if (battle.status === 'won') ui.state().gameVictoryFocus = current.bossId;
                    ui.showGamePanel(battle.status === 'won' ? 'collection' : 'journey');
                }, 'secondary'));
            }
        }
        panel.append(button('Nhật ký trận', () => ui.openBattleHistory(current), 'text-button'));
        if (['won', 'dead', 'expired', 'withdrawn'].includes(battle.status) && (current.finishedDay ?? current.lastDay) < data.day.day - 1) {
            const previous = el('details', undefined, 'practice-recent game-last-result'); previous.append(el('summary', 'Trận gần nhất · ' + current.content.name + ' · ' + statusNames[battle.status]), panel); root.append(previous);
        } else root.append(panel);
    }
    if (principalOnly) return root;
    const floors = mainFloors(catalog), won = new Set(data.victories ?? []);
    const showVictory = boss => { ui.state().gameVictoryFocus = boss.id; ui.showGamePanel('collection'); };
    const nextBoss = floors.find(boss => !won.has(boss.id)), ready = boss => bossDiscovered(boss, data) && (boss.practicePrerequisites ?? []).every(id => (data.learned ?? []).includes(id));
    const busy = !!currentBattle(data) || catchingUp || !!ui.state().featureSaving;
    const overview = el('section', undefined, 'floor-overview');
    overview.append(el('p', 'THỬ THÁCH', 'eyebrow'), el('h2', 'Tuyến chính'),
        el('p', 'Đã thắng ' + floors.filter(boss => won.has(boss.id)).length + ' / ' + floors.length + ' đối thủ', 'hint'));
    const track = el('progress'); track.max = floors.length; track.value = floors.filter(boss => won.has(boss.id)).length; track.setAttribute('aria-label', 'Số đối thủ đã thắng'); overview.append(track); root.append(overview);
    const list = el('section', undefined, 'cultivation-boss-list'); list.setAttribute('aria-label', 'Đối thủ tuyến chính');
    for (const [index, boss] of floors.entries()) {
        const found = bossDiscovered(boss, data), beaten = won.has(boss.id), isNext = boss.id === nextBoss?.id;
        const row = el('div', undefined, 'floor-row cultivation-boss-row' + (beaten ? ' is-complete' : isNext ? ' is-next' : !found ? ' is-locked' : ''));
        row.dataset.bossId = boss.id;
        const copy = el('div'); copy.append(el('strong', found ? boss.name : 'Đối thủ chưa gặp'),
            el('small', beaten ? 'Đã thắng' : found ? ready(boss) ? (isNext ? 'Tiếp theo · ' : '') + boss.maxTurns + ' lượt tối đa' : 'Cần luyện công pháp yêu cầu' : 'Thắng đối thủ trước để mở'));
        row.append(el('span', String(index + 1).padStart(2, '0'), 'floor-number'), copy);
        if (found) {
            const action = button(beaten ? 'Chiến tích' : 'Xem', () => beaten ? showVictory(boss) : ui.prepareBoss(boss), 'text-button');
            action.disabled = !beaten && busy && ready(boss); row.append(action);
        } else row.append(el('span', '—', 'floor-lock'));
        list.append(row);
    }
    root.append(list);
    const branches = catalog.bosses.filter(boss => boss.kind && boss.kind !== 'main'), foundBranches = branches.filter(boss => bossDiscovered(boss, data)), opportunities = el('section', undefined, 'game-opportunities');
    opportunities.append(el('h2', 'Cơ duyên'), el('p', 'Những lối rẽ mở bí tịch, truyền thừa và cấm thuật.', 'hint'));
    const completedBranches = el('details', undefined, 'game-completed-opportunities');
    completedBranches.append(el('summary', 'Cơ duyên đã vượt · ' + foundBranches.filter(boss => won.has(boss.id)).length));
    for (const boss of foundBranches) {
        const row = el('div', undefined, 'opportunity-row'), copy = el('div');
        copy.append(el('strong', boss.name), el('p', won.has(boss.id) ? 'Đã vượt · quyền học được giữ' : ready(boss) ? 'Đã tìm thấy · có thể thử thách' : 'Đã tìm thấy · còn điều kiện luyện', 'hint'));
        row.append(copy, button(won.has(boss.id) ? 'Chiến tích' : 'Xem', () => won.has(boss.id) ? showVictory(boss) : ui.prepareBoss(boss), 'text-button')); row.dataset.bossId = boss.id;
        if (won.has(boss.id)) completedBranches.append(row); else opportunities.append(row);
    }
    if (completedBranches.childElementCount > 1) opportunities.append(completedBranches);
    const hidden = branches.length - foundBranches.length;
    if (hidden) opportunities.append(el('p', hidden + ' cơ duyên chưa lộ diện. Tiếp tục tuyến chính để tìm dấu vết.', 'game-sealed-note hint'));
    if (!branches.length) opportunities.append(el('p', 'Thư các sẽ cập nhật khi có cơ duyên mới.', 'hint'));
    root.append(opportunities);
    const chapters = el('details', undefined, 'practice-recent game-chapter-archive'); chapters.append(el('summary', 'Truyện đã mở'));
    for (const chapter of catalog.chapters ?? []) {
        const first = catalog.bosses.find(boss => boss.id === chapter.encounters[0]);
        if (first && bossDiscovered(first, data)) chapters.append(button('Chương ' + chapter.number + ' · ' + chapter.name, () => ui.openGameChapter(chapter), 'text-button'));
    }
    root.append(chapters, button('Lịch sử tất cả trận', () => ui.openBattleArchive(), 'text-button')); return root;
}
