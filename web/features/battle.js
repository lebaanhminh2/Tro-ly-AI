import { liveRequest } from '../core/http.js';
import { habitDate } from '../models/habits.js';
import { purityLabel } from '../models/practice.js';
import { button, el } from '../ui/dom.js';

export function createBattleActions(context) {
    const { state, render, toast, openSheet, closeSheet, sheet, sheetContent, confirm, performLive } = context;
    const command = (operation, battle, extra = {}) => ({ operation, day: state.gameData.day.day, version: state.gameData.version,
        ...(battle ? { battleId: battle.id, battleVersion: battle.version } : {}), ...extra });
    async function save(input) {
        const result = await performLive('game', input);
        if (result) { closeSheet(); state.gamePanel = 'journey'; render(); }
    }
    function chooseBattle(battle, choice) {
        const input = command('choose_battle', battle, { techniqueId: choice.id, acceptCost: !!choice.warning });
        if (choice.warning) confirm('Chọn ' + choice.name + '?', choice.warning + ' Chiêu chỉ thi triển khi chốt ngày; cậu vẫn có thể đổi trước mốc đó.', () => save(input));
        else save(input);
    }
    function cancelBattle(battle) {
        const input = command('cancel_battle', battle);
        confirm('Hủy chuẩn bị trận?', 'Lịch luyện trước khi chuẩn bị được khôi phục từ ngày mai. Chưa có lượt giao chiến hoặc tổn thất.', () => save(input));
    }
    function withdrawBattle(battle) {
        const input = command('withdraw_battle', battle, { confirm: true });
        confirm('Rút khỏi trận?', 'Lượt hôm nay sẽ không thi triển. Các lượt và cái giá đã chốt được giữ lại; chuyển lại lịch luyện từ ngày mai.', () => save(input));
    }
    function rescueBattle(battle, kind) {
        const input = command('rescue_battle', battle, { kind, healthyVersion: state.gameData.combatEconomy.healthyVersion, acceptCost: true });
        confirm(kind === 'qi' ? 'Dùng Hộ Mệnh?' : 'Dùng Nghịch Mệnh?', kind === 'qi'
            ? 'Trả ' + battle.rescue.qiCost + ' Tu Vi, trở lại với 35% HP. Đây là quyền cứu duy nhất của trận.'
            : 'Hy sinh một đại cảnh giới; không trừ Tu Vi. Sức mạnh nền trong trận giảm tương ứng và không thể đột phá lại trong 3 ngày sinh hoạt. Đây là quyền cứu duy nhất của trận.', () => save(input));
    }
    function acceptBattleDeath(battle) {
        const input = command('accept_battle_death', battle, { healthyVersion: state.gameData.combatEconomy.healthyVersion, confirm: true });
        const qi = state.gameData.combatEconomy.qi, loss = Math.min(qi, Math.min(60, Math.max(5, Math.ceil(qi * .08))));
        confirm('Chấp nhận tử trận?', 'Mất ' + loss + ' Tu Vi. Cảnh giới, bí tịch và vật phẩm được giữ; cậu có thể chuẩn bị trận khác từ ngày mai.', () => save(input));
    }
    async function prepareBoss(boss) {
        const input = command('prepare_battle', null, { bossId: boss.id }), catalog = state.gameCatalog;
        openSheet(boss.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-preparation'); sheetContent.append(body);
        if (boss.artId) {
            const image = el('img', undefined, 'battle-preparation-art'); image.src = './assets/than-lo/' + boss.artId + '.webp';
            image.alt = boss.name; image.loading = 'lazy'; body.append(image);
        }
        body.append(el('p', boss.introduction, 'battle-story'), el('p', boss.mechanics, 'hint'));
        const waiting = el('p', 'Đang lấy các bản công pháp đã luyện…', 'hint'); body.append(waiting);
        try {
            const data = await liveRequest('battle-loadout');
            if (!body.isConnected || !sheet.open) return;
            waiting.remove();
            const selectors = [];
            if (data.versions.length) {
                const group = el('fieldset', undefined, 'battle-loadout-form'); group.append(el('legend', 'Bộ chiêu · tối đa 5 môn'));
                for (let index = 0; index < 5; index++) {
                    const wrap = el('label', 'Ô ' + (index + 1), 'form-field'), select = el('select');
                    const empty = el('option', 'Để trống'); empty.value = ''; select.append(empty);
                    for (const version of data.versions) {
                        const technique = catalog.techniques.find(value => value.id === version.techniqueId);
                        const option = el('option', (technique?.name ?? version.techniqueId) + ' · bản ' + version.edition + ' · tầng ' + version.tier + ' · ' + purityLabel(version.purityBp));
                        option.value = version.versionId; select.append(option);
                    }
                    wrap.append(select); group.append(wrap); selectors.push(select);
                }
                body.append(group);
            } else body.append(el('p', 'Chưa có công pháp đạt Nhập môn. Cậu vẫn có thể dùng Võ Kỹ để mở đầu.', 'hint'));
            body.append(el('p', 'Xuất chiến từ ' + habitDate(input.day + 1) + '. Luyện tạm dừng trong trận; cam kết habit vẫn theo dõi như thường. Chỉ thưởng quyền học lần đầu.', 'hint'),
                button('Chuẩn bị xuất chiến', () => {
                    const versions = selectors.map(select => select.value).filter(Boolean), skills = versions.map(id => data.versions.find(version => version.versionId === id)?.techniqueId);
                    if (new Set(skills).size !== skills.length) { toast('Mỗi công pháp dùng một ô; chọn một bản luyện cho môn đó nhé.'); return; }
                    save({ ...input, versions });
                }, 'primary'));
        } catch (error) { if (body.isConnected) waiting.textContent = error.message; }
    }
    async function openBattleHistory(battle) {
        openSheet('Nhật ký · ' + battle.content.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-history'); sheetContent.append(body);
        let cursor = Number.MAX_SAFE_INTEGER;
        const more = button('Xem lượt trước', load, 'secondary'), loading = el('p', 'Đang tải nhật ký…', 'hint'); body.append(loading);
        async function load() {
            more.disabled = true;
            try {
                const data = await liveRequest('battle-history?battleId=' + encodeURIComponent(battle.id) + '&before=' + cursor);
                if (!body.isConnected) return;
                loading.remove(); more.remove();
                for (const event of data.events) {
                    const row = el('section', undefined, 'battle-log-day');
                    row.append(el('h3', habitDate(event.day) + (event.kind === 'settlement' ? ' · lượt đã chốt' : ' · lựa chọn')));
                    for (const entry of event.entries) row.append(el('p', entry.text));
                    if (event.result.contribution) {
                        const bonus = event.result.contribution;
                        row.append(el('p', 'Sức mạnh thêm: habit ' + bonus.habits / 10 + '% · công việc ' + bonus.tasks / 10 + '%', 'hint'));
                    }
                    body.append(row);
                }
                cursor = data.next;
                if (cursor) body.append(more);
                if (!data.events.length) body.append(el('p', 'Chưa có lượt giao chiến được chốt.', 'hint'));
            } catch (error) { if (body.isConnected) { loading.textContent = error.message; body.append(more); } }
            finally { more.disabled = false; }
        }
        await load();
    }
    async function openBattleExchange(battle) {
        const input = command('exchange_battle', battle);
        openSheet('Đổi một ô công pháp'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-preparation'); sheetContent.append(body);
        const waiting = el('p', 'Đang lấy các bản đã luyện…', 'hint'); body.append(waiting);
        try {
            const data = await liveRequest('battle-loadout');
            if (!body.isConnected || !sheet.open) return;
            waiting.remove();
            const removeWrap = el('label', 'Môn rời bộ chiêu', 'form-field'), remove = el('select');
            for (const skill of battle.state.loadout) {
                const option = el('option', state.gameCatalog.techniques.find(technique => technique.id === skill.id)?.name ?? skill.id);
                option.value = skill.id; remove.append(option);
            }
            removeWrap.append(remove); body.append(removeWrap);
            const addWrap = el('label', 'Bản luyện thay vào', 'form-field'), add = el('select');
            for (const version of data.versions.filter(version => !battle.state.loadout.some(skill => skill.id === version.techniqueId))) {
                const option = el('option', (state.gameCatalog.techniques.find(technique => technique.id === version.techniqueId)?.name ?? version.techniqueId)
                    + ' · bản ' + version.edition + ' · ' + purityLabel(version.purityBp)); option.value = version.versionId; add.append(option);
            }
            addWrap.append(add); body.append(addWrap, el('p', 'Một ô cho lượt kế tiếp. HP, các ấn, thời hạn và quyền cứu của trận được giữ nguyên. Đổi bộ chiêu trước khi chọn chiêu hôm nay.', 'hint'));
            const saveButton = button('Đổi ô công pháp', () => save({ ...input, removeId: remove.value, practiceId: add.value }), 'primary');
            saveButton.disabled = !add.options.length; body.append(saveButton);
        } catch (error) { if (body.isConnected) waiting.textContent = error.message; }
    }
    return { chooseBattle, cancelBattle, withdrawBattle, rescueBattle, acceptBattleDeath, prepareBoss, openBattleHistory, openBattleExchange };
}
