import { habitDate } from '../models/habits.js';
const statusNames = { won: 'Đã thắng', awaiting_rescue: 'Chờ cứu mạng', dead: 'Tử trận', expired: 'Hết lượt giao chiến', withdrawn: 'Đã rút lui', cancelled: 'Đã hủy chuẩn bị' };

export function renderJourney(ui, data, catalog, selectedChapter) {
    const { el, button, card } = ui, root = el('div', undefined, 'journey-page');
    const current = (data.battles ?? []).find(battle => battle.id === data.current.battleId || battle.id === data.pending?.battleId)
        ?? (data.battles ?? []).find(battle => ['won', 'dead', 'expired', 'withdrawn'].includes(battle.status));
    const catchingUp = data.settledThrough !== null && data.settledThrough < data.day.day - 1;
    if (catchingUp) root.append(el('p', 'Đang chốt những ngày trước. Cập nhật kết quả để chọn cho hôm nay.', 'hint'), button('Cập nhật kết quả', () => ui.loadGame(), 'secondary'));
    if (current) {
        const battle = current.state, panel = card('battle-card'), header = el('div', undefined, 'battle-heading'), copy = el('div');
        copy.append(el('p', 'CHƯƠNG ' + current.content.chapter + ' · ' + (current.startsDay > data.day.day ? 'ĐÃ CHUẨN BỊ' : 'XUẤT CHIẾN'), 'eyebrow'), el('h2', current.content.name));
        header.append(copy);
        if (current.content.artId) {
            const image = el('img'); image.src = './assets/than-lo/' + current.content.artId + '-thumb.webp'; image.width = 76; image.height = 96;
            image.alt = current.content.name; image.loading = 'lazy'; header.append(image);
            if (current.content.artPosition) image.style.objectPosition = current.content.artPosition.map(value => value * 100 + '%').join(' ');
        }
        panel.append(header);
        if (current.weaponId) panel.append(el('p', 'Thần binh · ' + (catalog.weapons?.find(weapon => weapon.id === current.weaponId)?.name ?? current.weaponId), 'hint'));
        if (current.startsDay > data.day.day) {
            panel.append(el('p', 'Bắt đầu từ ' + habitDate(current.startsDay) + '. Hôm nay vẫn theo lịch luyện đã chọn.', 'technique-description'),
                button('Hủy chuẩn bị', () => ui.cancelBattle(current), 'text-button'));
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
                    control.disabled = !choice.available || catchingUp; control.setAttribute('aria-pressed', String(chosen?.techniqueId === choice.id));
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
                const actions = el('div', undefined, 'battle-rescue-actions'), qi = button('Hộ Mệnh · ' + current.rescue.qiCost + ' Tu Vi', () => ui.rescueBattle(current, 'qi'), 'primary');
                qi.disabled = !current.rescue.qiAvailable || catchingUp; actions.append(qi);
                if (battle.rankRescueAvailable) {
                    const rank = button('Nghịch Mệnh · 1 cảnh giới', () => ui.rescueBattle(current, 'rank'), 'secondary');
                    rank.disabled = !current.rescue.rankAvailable || catchingUp; actions.append(rank);
                }
                const death = button('Chấp nhận tử trận', () => ui.acceptBattleDeath(current), 'text-button'); death.disabled = catchingUp;
                actions.append(death); panel.append(actions);
            } else panel.append(el('p', battle.status === 'won' ? current.content.victory : current.content.defeat, 'battle-story'));
        }
        panel.append(button('Nhật ký trận', () => ui.openBattleHistory(current), 'text-button')); root.append(panel);
    }
    const section = el('section', undefined, 'journey-boss-list');
    const chapters = catalog.chapters ?? [{ number: 1, name: 'Hắc Lệnh Qua Thôn', scene: 'chapter01', encounters: ['truy-lenh', 'song-nha', 'thu-lenh', 'thiet-lenh-su'] }];
    const next = chapters.find(chapter => chapter.encounters.some(id => !(data.victories ?? []).includes(id))) ?? chapters.at(-1);
    const chapter = chapters.find(chapter => chapter.number === selectedChapter) ?? chapters.find(chapter => chapter.number === current?.content.chapter) ?? next;
    const pickerWrap = el('label', 'Chương truyện', 'form-field journey-chapter-picker'), picker = el('select');
    for (const value of chapters) {
        const option = el('option', String(value.number).padStart(2, '0') + ' · ' + value.name); option.value = value.number; picker.append(option);
    }
    picker.value = chapter.number; picker.addEventListener('change', () => ui.selectGameChapter(Number(picker.value))); pickerWrap.append(picker); section.append(pickerWrap);
    if (chapter.scene) {
        const scene = el('img', undefined, 'journey-chapter-scene'); scene.src = './assets/than-lo/' + chapter.scene + '.webp';
        scene.width = 640; scene.height = 448; scene.loading = 'lazy'; scene.alt = 'Cảnh ' + chapter.name; section.append(scene);
    }
    section.append(el('p', 'CHƯƠNG ' + String(chapter.number).padStart(2, '0'), 'eyebrow'), el('h2', chapter.name));
    const firstBoss = (catalog.bosses ?? []).find(boss => boss.id === chapter.encounters[0]);
    if (firstBoss && firstBoss.requires.every(id => (data.victories ?? []).includes(id))) section.append(button('Đọc truyện', () => ui.openGameChapter(chapter), 'text-button'));
    for (const boss of (catalog.bosses ?? []).filter(boss => boss.chapter === chapter.number)) {
        const won = (data.victories ?? []).includes(boss.id), unlocked = boss.requires.every(id => (data.victories ?? []).includes(id))
            && (boss.practicePrerequisites ?? []).every(id => (data.learned ?? []).includes(id));
        const row = card('journey-boss' + (!unlocked ? ' is-locked' : ''));
        row.dataset.bossId = boss.id;
        const heading = el('div', undefined, 'journey-boss-heading'), copy = el('div');
        const needsPractice = boss.requires.every(id => (data.victories ?? []).includes(id)) && !unlocked;
        copy.append(el('p', won ? 'Đã vượt qua' : unlocked ? boss.maxTurns + ' lượt tối đa' : needsPractice ? 'Cần luyện các môn yêu cầu' : 'Mở sau trận trước', 'eyebrow'), el('h3', boss.name));
        heading.append(copy);
        if (boss.artId) {
            const image = el('img'); image.src = './assets/than-lo/' + boss.artId + '-thumb.webp'; image.width = 56; image.height = 72;
            image.alt = ''; image.loading = 'lazy'; heading.append(image);
            if (boss.artPosition) image.style.objectPosition = boss.artPosition.map(value => value * 100 + '%').join(' ');
        }
        row.append(heading, el('p', boss.mechanics, 'hint'));
        if (needsPractice) {
            const missing = (boss.practicePrerequisites ?? []).filter(id => !(data.learned ?? []).includes(id));
            row.append(el('p', 'Cần đạt Nhập môn: ' + missing.map(id => catalog.techniques.find(technique => technique.id === id)?.name ?? id).join(', ') + '.', 'hint'));
        }
        const prepare = button(won ? 'Đánh lại' : 'Xem và chuẩn bị', () => ui.prepareBoss(boss), 'secondary');
        prepare.disabled = !unlocked || data.current.mode === 'battle' || !!current && ['active', 'awaiting_rescue'].includes(current.state.status) || current?.startsDay > data.day.day;
        row.append(prepare); section.append(row);
    }
    root.append(section);
    const previous = (data.battles ?? []).filter(battle => battle.id !== current?.id && statusNames[battle.status]);
    if (previous.length) {
        const history = el('details', undefined, 'practice-recent'); history.append(el('summary', 'Những trận gần đây'));
        for (const battle of previous) history.append(button(battle.content.name + ' · ' + statusNames[battle.status], () => ui.openBattleHistory(battle), 'text-button'));
        root.append(history);
    }
    root.append(button('Lịch sử tất cả trận', () => ui.openBattleArchive(), 'text-button'));
    return root;
}
