import { liveRequest } from '../core/http.js';
import { habitDate } from '../models/habits.js';
import { purityLabel } from '../models/practice.js';
import { button, el } from '../ui/dom.js';
import { battlePresetControls } from './battle-presets.js';

export function createBattleActions(context) {
    const { state, runtime, render, toast, openSheet, closeSheet, sheet, sheetContent, confirm, performLive } = context;
    const command = (operation, battle, extra = {}) => ({ operation, day: state.gameData.day.day, version: state.gameData.version,
        ...(battle ? { battleId: battle.id, battleVersion: battle.version } : {}), ...extra });
    async function save(input) {
        const panel = state.gamePanel;
        const result = await performLive('game', input);
        if (result) {
            if (input.operation === 'prepare_battle' && state.gamePanel === panel) state.gamePanel = 'journey';
            render();
        }
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
            if (boss.artPosition) image.style.objectPosition = boss.artPosition.map(value => value * 100 + '%').join(' ');
            image.alt = boss.name; image.loading = 'lazy'; body.append(image);
        }
        const waiting = el('p', 'Đang lấy các bản công pháp đã luyện…', 'hint'); body.append(waiting);
        try {
            const [data, detail] = await Promise.all([liveRequest('battle-loadout'), liveRequest('game-boss?bossId=' + encodeURIComponent(boss.id))]);
            if (!body.isConnected || !sheet.open) return;
            waiting.remove();
            body.append(el('p', detail.boss.mechanics, 'hint'));
            const story = el('details', undefined, 'battle-preparation-story battle-editions');
            story.append(el('summary', 'Bối cảnh trận'), el('p', detail.boss.introduction, 'battle-story')); body.append(story);
            if (detail.boss.advice?.length) {
                const advice = el('details', undefined, 'battle-editions'); advice.append(el('summary', 'Gợi ý giao chiến'));
                for (const text of detail.boss.advice) advice.append(el('p', text, 'hint')); body.append(advice);
            }
            const weaponWrap = el('label', 'Thần binh · một món', 'form-field'), weaponSelect = el('select'), noWeapon = el('option', 'Không mang');
            noWeapon.value = ''; weaponSelect.append(noWeapon);
            const ownedWeapons = (state.gameData.rewards ?? []).filter(reward => reward.kind === 'weapon').map(reward => reward.id);
            for (const weapon of (catalog.weapons ?? []).filter(weapon => ownedWeapons.includes(weapon.id))) {
                const option = el('option', weapon.name); option.value = weapon.id; weaponSelect.append(option);
            }
            if (weaponSelect.options.length > 1) {
                const hint = el('p', 'Chọn cho trận này; không thay giữa trận.', 'hint');
                weaponSelect.addEventListener('change', () => { hint.textContent = catalog.weapons.find(weapon => weapon.id === weaponSelect.value)?.description ?? 'Chọn cho trận này; không thay giữa trận.'; });
                weaponWrap.append(weaponSelect); body.append(weaponWrap, hint);
            }
            const selectors = [];
            const loadoutSummary = el('p', 'Võ Kỹ luôn có sẵn trong trận.', 'battle-loadout-summary'); body.append(loadoutSummary);
            function updateSummary() {
                const selected = selectors.map(select => data.versions.find(version => version.versionId === select.value)).filter(Boolean);
                loadoutSummary.textContent = selected.length ? 'Võ Kỹ + ' + selected.map(version => catalog.techniques.find(value => value.id === version.techniqueId)?.name ?? version.techniqueId).join(' · ')
                    : 'Võ Kỹ luôn có sẵn trong trận.';
                if (weaponSelect.value) loadoutSummary.textContent += ' · ' + (catalog.weapons.find(value => value.id === weaponSelect.value)?.name ?? weaponSelect.value);
            }
            weaponSelect.addEventListener('change', updateSummary);
            const labelFor = version => (catalog.techniques.find(value => value.id === version.techniqueId)?.name ?? version.techniqueId)
                + ' · bản ' + version.edition + ' · tầng ' + version.tier + ' · ' + purityLabel(version.purityBp);
            const addVersion = version => {
                if (data.versions.some(value => value.versionId === version.versionId)) return;
                data.versions.push(version);
                for (const select of selectors) { const option = el('option', labelFor(version)); option.value = version.versionId; select.append(option); }
            };
            if (data.versions.length) {
                const group = el('fieldset', undefined, 'battle-loadout-form'); group.append(el('legend', 'Bộ chiêu · tối đa 5 môn'));
                for (let index = 0; index < 5; index++) {
                    const wrap = el('label', 'Ô ' + (index + 1), 'form-field'), select = el('select');
                    const empty = el('option', 'Để trống'); empty.value = ''; select.append(empty);
                    for (const version of data.versions) {
                        const option = el('option', labelFor(version));
                        option.value = version.versionId; select.append(option);
                    }
                    wrap.append(select); group.append(wrap); selectors.push(select);
                }
                body.append(group);
                const customize = el('details', undefined, 'battle-loadout-customize battle-editions');
                customize.append(el('summary', 'Chỉnh bộ chiêu · tối đa 5 môn'), group); body.append(customize);
                for (const select of selectors) select.addEventListener('change', updateSummary);
                const recommended = data.versions.find(version => catalog.techniques.find(value => value.id === version.techniqueId)?.kind === 'ordinary');
                if (recommended) { selectors[0].value = recommended.versionId; updateSummary(); }
                const editions = el('details', undefined, 'battle-editions battle-version-picker'); editions.append(el('summary', 'Chọn bản luyện khác'));
                editions.append(el('p', 'Danh sách trên gợi ý tầng cao nhất của mỗi môn, rồi đến tinh thuần. Cậu vẫn có thể chọn một bản cũ.', 'hint'));
                const wrap = el('label', 'Công pháp', 'form-field'), techniqueSelect = el('select');
                for (const version of data.versions) {
                    const option = el('option', catalog.techniques.find(value => value.id === version.techniqueId)?.name ?? version.techniqueId);
                    option.value = version.techniqueId; techniqueSelect.append(option);
                }
                wrap.append(techniqueSelect); editions.append(wrap);
                const versionsBody = el('div', undefined, 'battle-edition-list'), more = button('Xem bản trước', () => loadEditions(), 'secondary');
                editions.append(versionsBody); body.append(editions);
                let cursor = null, generation = 0, loaded = false, busy = false;
                async function loadEditions(reset = false) {
                    if (busy && !reset) return;
                    const token = reset ? ++generation : generation, techniqueId = techniqueSelect.value;
                    if (reset) { cursor = null; versionsBody.replaceChildren(); }
                    busy = true; more.disabled = true;
                    const loading = el('p', 'Đang lấy bản luyện…', 'hint'); versionsBody.append(loading);
                    try {
                        const page = await liveRequest('practice-versions?techniqueId=' + encodeURIComponent(techniqueId) + (cursor ? '&before=' + encodeURIComponent(cursor) : ''));
                        if (!body.isConnected || token !== generation) return;
                        loading.remove(); more.remove(); loaded = true;
                        for (const entry of page.versions) {
                            const practice = entry.practice, tier = practice.tiers.at(-1), row = el('div', undefined, 'battle-edition-row');
                            const version = tier ? { techniqueId, versionId: practice.id, edition: practice.edition, tier: practice.tiers.length, purityBp: tier.purityBp } : null;
                            row.append(el('p', 'Bản ' + practice.edition + (tier ? ' · tầng ' + practice.tiers.length + ' · ' + purityLabel(tier.purityBp) : ' · chưa Nhập môn'), 'hint'));
                            const choose = button(version && data.versions.some(value => value.versionId === version.versionId) ? 'Đã có trong bộ chọn' : 'Thêm vào bộ chọn', () => {
                                addVersion(version); choose.disabled = true; choose.textContent = 'Đã có trong bộ chọn';
                            }, 'text-button');
                            choose.disabled = !version || data.versions.some(value => value.versionId === version.versionId); row.append(choose); versionsBody.append(row);
                        }
                        cursor = page.next; if (cursor) versionsBody.append(more);
                    } catch (error) { if (body.isConnected && token === generation) { loading.textContent = error.message; versionsBody.append(more); } }
                    finally { if (token === generation) { busy = false; more.disabled = false; } }
                }
                editions.addEventListener('toggle', () => { if (editions.open && !loaded) loadEditions(true); });
                techniqueSelect.addEventListener('change', () => loadEditions(true));
            } else body.append(el('p', boss.chapter === 1 ? 'Chưa có công pháp đạt Nhập môn. Cậu vẫn có thể dùng Võ Kỹ để mở đầu.'
                : 'Chưa có công pháp đạt Nhập môn. Luyện trước khi vào trận này sẽ giúp cậu chuẩn bị tốt hơn.', 'hint'));
            body.append(battlePresetControls({ data, selectors, weaponSelect, addVersion, performLive, toast, presetSnapshot: () => runtime.refreshPending ? null : state.gamePresetData }));
            const effective = el('p', 'Xuất chiến từ ' + habitDate(input.day + 1) + '. Luyện tạm dừng trong trận; habit vẫn theo lịch cam kết.', 'battle-effective hint');
            const prepare = button('Chuẩn bị xuất chiến', () => {
                    const versions = selectors.map(select => select.value).filter(Boolean), skills = versions.map(id => data.versions.find(version => version.versionId === id)?.techniqueId);
                    if (new Set(skills).size !== skills.length) { toast('Mỗi công pháp dùng một ô; chọn một bản luyện cho môn đó nhé.'); return; }
                    save({ ...input, versions, weaponId: weaponSelect.value || null });
                }, 'primary');
            body.insertBefore(effective, story); body.insertBefore(prepare, story);
            body.insertBefore(loadoutSummary, effective);
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
    async function openBattleArchive() {
        openSheet('Lịch sử giao chiến'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-history'); sheetContent.append(body);
        const names = { prepared: 'Đã chuẩn bị', active: 'Đang giao chiến', won: 'Đã thắng', awaiting_rescue: 'Chờ cứu mạng',
            dead: 'Tử trận', expired: 'Hết lượt', withdrawn: 'Đã rút lui', cancelled: 'Đã hủy' };
        let cursor = null;
        const more = button('Xem trận trước', load, 'secondary');
        async function load() {
            more.disabled = true;
            const loading = el('p', 'Đang mở lịch sử…', 'hint'); body.append(loading);
            try {
                const data = await liveRequest('battles' + (cursor ? '?before=' + encodeURIComponent(cursor) : ''));
                if (!body.isConnected) return;
                loading.remove(); more.remove();
                for (const battle of data.battles) {
                    const row = el('section', undefined, 'battle-log-day');
                    row.append(el('h3', battle.content.name), el('p', habitDate(battle.startsDay) + ' · ' + (names[battle.status] ?? battle.status) + ' · ' + battle.turn + ' lượt', 'hint'),
                        button('Xem nhật ký', () => openBattleHistory(battle), 'text-button')); body.append(row);
                }
                if (!data.battles.length) body.append(el('p', 'Chưa có trận nào trong lịch sử.', 'hint'));
                cursor = data.next; if (cursor) body.append(more);
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
    async function openGameChapter(chapter) {
        openSheet(chapter.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-history'), waiting = el('p', 'Đang mở trang truyện…', 'hint');
        body.append(waiting); sheetContent.append(body);
        try {
            const data = await liveRequest('game-chapter?chapter=' + chapter.number);
            if (!body.isConnected || !sheet.open) return;
            waiting.remove();
            const people = el('div', undefined, 'game-story-people');
            for (const character of data.characters ?? []) {
                const person = el('div');
                if (character.artId) { const image = el('img'); image.src = './assets/than-lo/' + character.artId + '-thumb.webp'; image.alt = ''; image.width = 44; image.height = 56; image.loading = 'lazy'; person.append(image); }
                person.append(el('span', character.name)); people.append(person);
            }
            if (people.childElementCount) body.append(people);
            body.append(el('p', data.chapter.introduction, 'battle-story'));
            if (data.chapter.conclusion) body.append(el('h3', 'Sau hành trình'), el('p', data.chapter.conclusion, 'battle-story'));
            else body.append(el('p', 'Phần kết mở sau khi vượt qua các trận trong chương.', 'hint'));
        } catch (error) { if (body.isConnected) waiting.textContent = error.message; }
    }
    function selectGameChapter(number) { state.gameChapter = number; render(); }
    return { chooseBattle, cancelBattle, withdrawBattle, rescueBattle, acceptBattleDeath, prepareBoss, openBattleHistory, openBattleExchange, openGameChapter, selectGameChapter, openBattleArchive };
}
