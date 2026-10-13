import { habitDate } from '../models/habits.js';
import { bossDiscovered, mainFloors, currentBattle } from '../models/game-library.js';
import { gameArtUrl } from '../ui/game-art.js';
const statusNames = { won: 'Đã thắng', awaiting_rescue: 'Chờ cứu mạng', dead: 'Tử trận', expired: 'Hết lượt giao chiến', withdrawn: 'Đã rút lui', cancelled: 'Đã hủy chuẩn bị' };

export function renderJourney(ui, data, catalog, selectedChapter, principalOnly = false) {
    const { el, button, card } = ui, root = el('div', undefined, 'journey-page');
    const current = currentBattle(data) ?? (principalOnly ? (data.battles ?? []).find(battle => ['won', 'dead', 'expired', 'withdrawn'].includes(battle.status)) : null);
    const catchingUp = data.settledThrough !== null && data.settledThrough < data.day.day - 1;
    if (catchingUp) root.append(el('p', 'Đang chốt những ngày trước. Cập nhật kết quả để chọn cho hôm nay.', 'hint'), button('Cập nhật kết quả', () => ui.loadGame(), 'secondary'));
    if (current) {
        const battle = current.state, panel = card('battle-card'), header = el('div', undefined, 'battle-heading'), copy = el('div');
        copy.append(el('p', (mainFloors(catalog).findIndex(boss => boss.id === current.bossId) >= 0 ? 'TẦNG ' + String(mainFloors(catalog).findIndex(boss => boss.id === current.bossId) + 1).padStart(2, '0') : 'CƠ DUYÊN') + ' · ' + (current.startsDay > data.day.day ? 'ĐÃ CHUẨN BỊ' : battle.status === 'active' ? 'XUẤT CHIẾN' : statusNames[battle.status] ?? 'KẾT QUẢ'), 'eyebrow'), el('h2', current.content.name));
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
            if (battle.status === 'active') {
                for (const announced of battle.announced) {
                    const intent = announced.intent, box = el('section', undefined, 'battle-intent');
                    box.append(el('p', (announced.turn === battle.turn + 1 ? 'Đối thủ chuẩn bị' : 'Đã soi · lượt ' + announced.turn) + ' · ' + intent.name, 'battle-intent-name'),
                        el('p', intent.description, 'hint'), el('p', intent.hits.join(' + ') + ' sát thương trước phòng ngự', 'battle-intent-damage'));
                    panel.append(box);
                }
                const chosen = (data.choices ?? []).find(choice => choice.battleId === current.id), choices = el('div', undefined, 'battle-choices');
                panel.append(el('h3', 'Chiêu hôm nay', 'battle-choice-title'));
                if (chosen) panel.append(el('p', 'Đã chọn ' + (battle.choices.find(choice => choice.id === chosen.techniqueId)?.name ?? chosen.techniqueId) + ' · có thể đổi trước khi ngày kết thúc.', 'hint'));
                for (const choice of battle.choices) {
                    const control = button(choice.name, () => ui.chooseBattle(current, choice), 'secondary');
                    control.dataset.choiceId = choice.id;
                    control.dataset.write = 'battle-choice';
                    control.disabled = !choice.available || catchingUp || !!ui.state().featureSaving; control.setAttribute('aria-pressed', String(chosen?.techniqueId === choice.id));
                    if (choice.repeatDamagePenalty) control.append(el('small', 'Bị đọc chiêu · −' + choice.repeatDamagePenalty / 10 + '% sát thương'));
                    if (choice.warning) control.append(el('small', 'Có đánh đổi')); choices.append(control);
                }
                panel.append(choices, el('p', 'Chốt cuối ngày sinh hoạt. Habit đủ mục tiêu tăng sức mạnh; công việc góp thêm tối đa 10%.', 'hint'));
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
                panel.append(button(battle.status === 'won' ? 'Xem thành tựu' : 'Chọn tầng tiếp theo', () => {
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
    overview.append(el('p', 'VƯỢT TẦNG', 'eyebrow'), el('h2', floors.filter(boss => won.has(boss.id)).length + ' / ' + floors.length + ' tầng đã vượt'));
    const track = el('progress'); track.max = floors.length; track.value = floors.filter(boss => won.has(boss.id)).length; track.setAttribute('aria-label', 'Số tầng đã vượt'); overview.append(track); root.append(overview);
    if (nextBoss && bossDiscovered(nextBoss, data)) {
        const hero = card('floor-next'), copy = el('div', undefined, 'floor-next-copy');
        copy.append(el('p', 'TẦNG ' + String(floors.indexOf(nextBoss) + 1).padStart(2, '0') + ' · TIẾP THEO', 'eyebrow'), el('h2', nextBoss.name), el('p', nextBoss.mechanics, 'hint'));
        const action = button(ready(nextBoss) ? 'Xem & chuẩn bị' : 'Xem điều kiện', () => ui.prepareBoss(nextBoss), 'primary'); action.disabled = busy && ready(nextBoss); copy.append(action); hero.append(copy);
        if (nextBoss.artId) { const image = el('img', undefined, 'floor-next-art'); image.src = gameArtUrl(nextBoss.artId + '-thumb.webp'); image.alt = ''; image.width = 100; image.height = 140; image.decoding = 'async'; hero.append(image); }
        hero.dataset.bossId = nextBoss.id; root.append(hero);
    }
    const list = el('section', undefined, 'floor-map'); list.setAttribute('aria-label', 'Các tầng');
    for (let offset = 0; offset < floors.length; offset += 4) {
        const group = el('details', undefined, 'floor-group'), chunk = floors.slice(offset, offset + 4);
        group.open = chunk.some(boss => boss.id === nextBoss?.id);
        group.append(el('summary', 'Tầng ' + String(offset + 1).padStart(2, '0') + '–' + String(Math.min(offset + 4, floors.length)).padStart(2, '0') + ' · ' + chunk.filter(boss => won.has(boss.id)).length + '/' + chunk.length));
        for (const boss of chunk) {
            const found = bossDiscovered(boss, data), beaten = won.has(boss.id), row = el('div', undefined, 'floor-row' + (beaten ? ' is-complete' : boss.id === nextBoss?.id ? ' is-next' : !found ? ' is-locked' : ''));
            row.dataset.bossId = boss.id; const copy = el('div'); copy.append(el('strong', found ? boss.name : 'Chưa mở'), el('small', beaten ? 'Đã vượt' : found ? ready(boss) ? boss.maxTurns + ' lượt tối đa' : 'Cần luyện các môn yêu cầu' : 'Vượt tầng trước để mở'));
            row.append(el('span', String(offset + chunk.indexOf(boss) + 1).padStart(2, '0'), 'floor-number'), copy);
            if (found) { const action = button(beaten ? 'Chiến tích' : 'Xem', () => beaten ? showVictory(boss) : ui.prepareBoss(boss), 'text-button'); row.append(action); }
            else row.append(el('span', '—', 'floor-lock')); group.append(row);
        }
        list.append(group);
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
    if (hidden) opportunities.append(el('p', hidden + ' cơ duyên chưa lộ diện. Tiếp tục vượt tầng để tìm dấu vết.', 'game-sealed-note hint'));
    if (!branches.length) opportunities.append(el('p', 'Thư các sẽ cập nhật khi có cơ duyên mới.', 'hint'));
    root.append(opportunities);
    const chapters = el('details', undefined, 'practice-recent game-chapter-archive'); chapters.append(el('summary', 'Truyện đã mở'));
    for (const chapter of catalog.chapters ?? []) {
        const first = catalog.bosses.find(boss => boss.id === chapter.encounters[0]);
        if (first && bossDiscovered(first, data)) chapters.append(button('Chương ' + chapter.number + ' · ' + chapter.name, () => ui.openGameChapter(chapter), 'text-button'));
    }
    root.append(chapters, button('Lịch sử tất cả trận', () => ui.openBattleArchive(), 'text-button')); return root;
}
