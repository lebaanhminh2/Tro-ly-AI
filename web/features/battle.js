import { liveRequest } from '../core/http.js';
import { habitDate } from '../models/habits.js';
import { button, el } from '../ui/dom.js';
import { battlePresetControls } from './battle-presets.js';
import { realms } from '../models/cultivation.js';
import { gameArtUrl } from '../ui/game-art.js';
import { renderTechniqueDamage, renderTechniqueEffects } from '../ui/technique-profile.js';
import { battleLoadoutEditor } from '../ui/battle-loadout.js';

const battleLogText = entry => entry.text + (entry.amount !== undefined && ['heal', 'revive'].includes(entry.kind) ? ' · ' + entry.amount + ' HP' : '');
function renderBattleLogEntry(entry) {
    if (!entry.hit) return el('p', battleLogText(entry));
    const hit = entry.hit, root = el('div', undefined, 'battle-log-entry');
    root.append(el('p', (entry.kind === 'boss' ? 'Cậu mất ' : 'Đối thủ mất ') + hit.hpLost + ' HP.'));
    const details = el('details', undefined, 'battle-hit-details'), rows = el('dl');
    details.append(el('summary', 'Chi tiết sát thương'));
    const values = [['Sát thương thô', hit.raw],
        [hit.reductionAdjustment < 0 ? 'Tăng sát thương nhận' : 'Giảm thương chặn', Math.abs(hit.reductionAdjustment)],
        ['Phòng thủ chặn', hit.armorBlocked], ['Giáp Ảo giảm', hit.virtualReduced],
        ['Giáp Ảo hấp thụ', hit.virtualAbsorbed], ['Khiên hấp thụ', hit.shieldAbsorbed], ['Sát thương dư', hit.overflow]];
    for (const [label, value] of values) {
        if (!value && label !== 'Sát thương thô') continue;
        const row = el('div'); row.append(el('dt', label), el('dd', String(value))); rows.append(row);
    }
    details.append(rows); root.append(details); return root;
}

export function createBattleActions(context) {
    const { state, runtime, render, toast, openSheet, closeSheet, sheet, sheetContent, confirm: defaultConfirm, performLive } = context;
    function confirm(title, description, action) {
        defaultConfirm(title, description, action);
        sheetContent.querySelector('.actions')?.classList.add('game-confirm-actions');
        sheetContent.querySelector(':scope>.hint')?.setAttribute('tabindex', '0');
    }
    const command = (operation, battle, extra = {}) => ({ operation, day: state.gameData.day.day, version: state.gameData.version,
        ...(battle ? { battleId: battle.id, battleVersion: battle.version } : {}), ...extra });
    function submitCurrent(input, revision) {
        const battle = input.battleId && state.gameData.battles?.find(value => value.id === input.battleId);
        if (revision !== runtime.revision || input.day !== state.gameData.day.day || input.version !== state.gameData.version ||
            input.battleId && battle?.version !== input.battleVersion ||
            input.healthyVersion != null && input.healthyVersion !== state.gameData.combatEconomy.healthyVersion || state.featureSaving) {
            toast('Trận hoặc ngày sinh hoạt đã thay đổi. Cập nhật rồi thực hiện lại.'); closeSheet(); context.loadGame(); return;
        }
        return save(input);
    }
    function confirmCommand(input, title, description) {
        const revision = runtime.revision;
        confirm(title, description, () => submitCurrent(input, revision));
    }
    async function save(input) {
        const panel = state.gamePanel;
        const result = await performLive('game', input);
        if (result) {
            if (['prepare_battle', 'update_prepared_battle'].includes(input.operation) && state.gamePanel === panel) state.gamePanel = 'practice';
            if (input.operation === 'choose_battle') closeSheet();
            render();
        }
        return result;
    }
    function openBattleChoices(battle) {
        const day = state.gameData.day.day, version = state.gameData.version, revision = runtime.revision;
        const previous = state.gameData.choices?.find(choice => choice.battleId === battle.id);
        openSheet(previous ? 'Đổi chiêu hôm nay' : 'Chọn chiêu hôm nay'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-choice-sheet'), choices = el('div', undefined, 'battle-choice-list');
        body.append(el('p', 'Chọn một chiêu cho lượt kế. Có thể đổi trước khi chốt ngày sinh hoạt.', 'hint'), choices);
        const detail = el('section', undefined, 'battle-choice-detail'); body.append(detail); sheetContent.append(body);
        const footer = el('div', undefined, 'battle-choice-footer'), choose = button('Chọn chiêu', () => {
            if (!selected) return;
            if (!current() || state.featureSaving) { choose.disabled = true; toast('Trận hoặc ngày sinh hoạt đã thay đổi. Cập nhật rồi chọn lại.'); return; }
            chooseBattle(battle, selected);
        }, 'primary'); choose.disabled = true; footer.append(choose); sheetContent.append(footer);
        let selected = null, generation = 0;
        const current = () => body.isConnected && sheet.open && revision === runtime.revision &&
            state.gameData.day.day === day && state.gameData.version === version &&
            state.gameData.battles?.find(value => value.id === battle.id)?.version === battle.version;
        const controls = new Map();
        async function inspect(choice) {
            const request = ++generation; selected = null; choose.disabled = true;
            for (const [id, node] of controls) node.setAttribute('aria-pressed', String(id === choice.id));
            const waiting = el('p', 'Đang xem tác dụng…', 'hint'); detail.replaceChildren(waiting);
            choose.textContent = choice.id === previous?.techniqueId ? 'Đã chọn chiêu này' : 'Chọn ' + choice.name;
            try {
                const result = await liveRequest('battle-choice?' + new URLSearchParams({ battleId: battle.id, techniqueId: choice.id }));
                if (!body.isConnected || request !== generation) return;
                if (!current() || result.day !== day || result.gameVersion !== version || result.battleVersion !== battle.version) {
                    detail.replaceChildren(el('p', 'Trận hoặc ngày sinh hoạt đã thay đổi. Cập nhật rồi chọn lại.', 'hint'),
                        button('Cập nhật trận', () => { closeSheet(); context.loadGame(); }, 'secondary')); return;
                }
                selected = choice;
                detail.replaceChildren(el('h3', choice.name), renderTechniqueDamage(result.profile));
                if (choice.repeatDamagePenalty) detail.append(el('p', 'Bị đọc chiêu: sát thương gây ra lượt này giảm ' + choice.repeatDamagePenalty / 10 + '%. Đổi môn sẽ tránh mức giảm này.', 'battle-warning'));
                const preview = result.preview, box = el('section', undefined, 'battle-preview'); box.append(el('h4', 'Dự kiến lượt này'));
                if (preview.kind === 'resolved') {
                    box.append(el('p', 'Đối thủ mất ' + preview.bossHpLost + ' HP · Cậu mất ' + preview.playerHpLost + ' HP do đòn đánh.', 'battle-preview-loss'),
                        el('p', 'Sau lượt: cậu ' + preview.playerHp + ' / ' + preview.playerMaxHp + ' HP · đối thủ ' + preview.bossHp + ' / ' + preview.bossMaxHp + ' HP.', 'hint'));
                    if (preview.status === 'won') box.append(el('p', 'Dự kiến hạ được đối thủ.', 'hint'));
                    if (['awaiting_rescue', 'dead'].includes(preview.status)) box.append(el('p', 'Dự kiến cạn sinh lực' + (preview.status === 'awaiting_rescue' ? ' và cần cứu mạng.' : '; quyền cứu đã dùng.'), 'battle-warning'));
                    if (preview.status === 'expired') box.append(el('p', 'Lượt cuối: nếu đối thủ còn sống, trận sẽ hết hạn.', 'battle-warning'));
                    if (preview.revivalRemaining !== battle.state.revival.remaining) box.append(el('p', 'Đối thủ dùng một lần hồi sinh trong lượt này.', 'hint'));
                    const breakdown = el('details'); breakdown.append(el('summary', 'Xem diễn biến dự kiến'));
                    for (const entry of preview.entries) breakdown.append(renderBattleLogEntry(entry));
                    box.append(breakdown);
                } else box.append(el('p', preview.reason, 'hint'));
                box.append(el('p', 'Theo bản công pháp và tình thế hiện tại, chưa tính buff habit/công việc của ngày. Kết quả được chốt cuối ngày.', 'hint')); detail.append(box);
                detail.append(renderTechniqueEffects(result.profile, 'Công ' + result.profile.attack + ' từ snapshot trận; chưa tính buff ngày. Sát thương là đòn chính thô trước phòng ngự; dự kiến đã tính các lớp bảo vệ và điều kiện đang có.'));
                choose.disabled = preview.kind === 'unavailable' || !choice.available || choice.id === previous?.techniqueId || !!state.featureSaving;
            } catch (error) {
                if (body.isConnected && request === generation) detail.replaceChildren(el('p', error.message, 'hint'), button('Thử lại', () => inspect(choice), 'secondary'));
            }
        }
        for (const choice of battle.state.choices) {
            const row = button('', () => inspect(choice), 'battle-choice-option'), copy = el('span');
            row.dataset.choiceId = choice.id; row.setAttribute('aria-pressed', 'false');
            copy.append(el('strong', choice.name), el('small', !choice.available ? 'Hồi chiêu · lượt ' + choice.readyTurn : choice.id === previous?.techniqueId ? 'Đang chọn' : choice.warning ? 'Có đánh đổi' : choice.repeatDamagePenalty ? 'Bị đọc chiêu' : 'Sẵn sàng'));
            row.append(copy, el('span', Number(choice.damage ?? 0).toLocaleString('vi-VN') + ' sát thương', 'battle-choice-value'));
            choices.append(row); controls.set(choice.id, row);
        }
        const initial = battle.state.choices.find(choice => choice.id === previous?.techniqueId) ?? battle.state.choices.find(choice => choice.available);
        if (initial) inspect(initial);
    }
    function chooseBattle(battle, choice) {
        const input = command('choose_battle', battle, { techniqueId: choice.id, acceptCost: !!choice.warning });
        const revision = runtime.revision;
        const submit = () => {
            const currentBattle = state.gameData.battles?.find(value => value.id === battle.id);
            if (revision !== runtime.revision || input.day !== state.gameData.day.day || input.version !== state.gameData.version ||
                currentBattle?.version !== input.battleVersion || currentBattle?.status !== 'active' || state.featureSaving) {
                toast('Trận hoặc ngày sinh hoạt đã thay đổi. Cập nhật rồi chọn lại.'); closeSheet(); context.loadGame(); return;
            }
            return save(input);
        };
        if (choice.warning) confirm('Chọn ' + choice.name + '?', choice.warning + ' Chiêu chỉ thi triển khi chốt ngày; cậu vẫn có thể đổi trước mốc đó.', submit);
        else submit();
    }
    function cancelBattle(battle) {
        const input = command('cancel_battle', battle);
        confirmCommand(input, 'Hủy chuẩn bị trận?', 'Lịch luyện trước khi chuẩn bị được khôi phục từ ngày mai. Chưa có lượt giao chiến hoặc tổn thất.');
    }
    function withdrawBattle(battle) {
        const input = command('withdraw_battle', battle, { confirm: true });
        confirmCommand(input, 'Rút khỏi trận?', 'Lượt hôm nay sẽ không thi triển. Các lượt và cái giá đã chốt được giữ lại; chuyển lại lịch luyện từ ngày mai.');
    }
    function rescueBattle(battle, kind) {
        const input = command('rescue_battle', battle, { kind, healthyVersion: state.gameData.combatEconomy.healthyVersion, acceptCost: true });
        const rank = state.gameData.combatEconomy.rank;
        const untilDay = Math.max(state.gameData.combatEconomy.rankLockUntilDay ?? input.day, input.day + (battle.rescue.rankLockDays ?? 3));
        confirmCommand(input, kind === 'qi' ? 'Dùng Hộ Mệnh?' : 'Dùng Nghịch Mệnh?', kind === 'qi'
            ? 'Trả ' + battle.rescue.qiCost + ' Tu Vi, trở lại với ' + (battle.rescue.restoresPercent ?? 35) + '% HP. Đây là quyền cứu duy nhất của trận.'
            : (realms[rank]?.name ?? 'Cảnh giới hiện tại') + ' → ' + (realms[Math.max(0, rank - 1)]?.name ?? 'cảnh giới trước') + '. Không trừ Tu Vi; trở lại với ' + (battle.rescue.restoresPercent ?? 35) + '% HP. Sức mạnh nền trong trận giảm tương ứng; khóa đột phá đến ngày sinh hoạt ' + habitDate(untilDay) + '. Đây là quyền cứu duy nhất của trận.');
    }
    function acceptBattleDeath(battle) {
        const input = command('accept_battle_death', battle, { healthyVersion: state.gameData.combatEconomy.healthyVersion, confirm: true });
        const qi = state.gameData.combatEconomy.qi, loss = Math.min(qi, Math.min(60, Math.max(5, Math.ceil(qi * .08))));
        confirmCommand(input, 'Chấp nhận tử trận?', 'Mất ' + loss + ' Tu Vi. Cảnh giới, bí tịch và vật phẩm được giữ; cậu có thể chuẩn bị trận khác từ ngày mai.');
    }
    async function prepareBoss(boss, preparedBattle = null) {
        const input = preparedBattle ? command('update_prepared_battle', preparedBattle) : command('prepare_battle', null, { bossId: boss.id }), catalog = state.gameCatalog;
        const revision = runtime.revision;
        openSheet(boss.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-preparation'); sheetContent.append(body);
        const overview = el('section', undefined, 'battle-preparation-overview'), bossInfo = el('div'); overview.append(bossInfo); body.append(overview);
        if (boss.artId) {
            const image = el('img', undefined, 'battle-preparation-art'); image.src = gameArtUrl(boss.artId + '.webp');
            if (boss.artPosition) image.style.objectPosition = boss.artPosition.map(value => value * 100 + '%').join(' ');
            image.alt = boss.name; image.loading = 'lazy'; overview.append(image);
        }
        const waiting = el('p', 'Đang lấy các bản công pháp đã luyện…', 'hint'); body.append(waiting);
        try {
            const [data, detail] = await Promise.all([liveRequest('battle-loadout'), liveRequest('game-boss?bossId=' + encodeURIComponent(boss.id))]);
            if (!body.isConnected || !sheet.open || revision !== runtime.revision) return;
            waiting.remove();
            const fighter = detail.boss.fighter;
            if (fighter) bossInfo.append(el('p', fighter.maxHp + ' HP · Công ' + fighter.attack + ' · Phòng thủ ' + fighter.armor, 'battle-boss-stats'));
            bossInfo.append(el('p', detail.boss.mechanics, 'hint'));
            if (detail.boss.revival?.remaining) bossInfo.append(el('p', 'Hồi sinh ' + detail.boss.revival.remaining + ' lần · ' + detail.boss.revival.hpPercent / 10 + '% HP mỗi lần.', 'battle-warning'));
            if (detail.boss.repeatWard) bossInfo.append(el('p', 'Đọc chiêu lặp: giảm ' + detail.boss.repeatWard / 10 + '% sát thương ở lượt dùng lại cùng môn.', 'battle-warning'));
            const story = el('details', undefined, 'battle-preparation-story battle-editions');
            story.append(el('summary', 'Bối cảnh trận'), el('p', detail.boss.introduction, 'battle-story')); body.append(story);
            if (detail.boss.advice?.length) {
                const advice = el('details', undefined, 'battle-editions'); advice.append(el('summary', 'Gợi ý giao chiến'));
                for (const text of detail.boss.advice) advice.append(el('p', text, 'hint')); body.append(advice);
            }
            const won = state.gameData.victories ?? [], learned = state.gameData.learned ?? [];
            const enterable = detail.boss.enterable ?? ((boss.requires ?? []).every(id => won.includes(id)) && (boss.practicePrerequisites ?? []).every(id => learned.includes(id)));
            if (!enterable && !preparedBattle) {
                body.append(el('h3', 'Điều kiện thử thách'));
                for (const id of boss.practicePrerequisites ?? []) {
                    const technique = catalog.techniques.find(value => value.id === id);
                    body.append(el('p', (learned.includes(id) ? '✓ ' : '○ ') + (technique?.name ?? id) + ' · Tầng 1', 'hint'));
                    if (technique && !learned.includes(id)) body.append(button('Xem ' + technique.name, () => context.openTechnique(technique), 'text-button'));
                }
                body.append(el('p', 'Quyền học mở sau khi thắng. Bí tịch mới cần luyện từ đầu; không tự tạo một bản hoàn chỉnh.', 'hint')); return;
            }
            const loadoutWarning = el('p', undefined, 'battle-warning'); loadoutWarning.hidden = true; body.append(loadoutWarning);
            let prepare, invalidDraft = false;
            const unavailable = () => (!preparedBattle && (state.gameData.battles ?? []).some(battle => ['prepared', 'active', 'awaiting_rescue'].includes(battle.status))) ||
                !!state.featureSaving || state.gameData.settledThrough !== null && state.gameData.settledThrough < state.gameData.day.day - 1;
            function updateWarnings(selected) {
                invalidDraft = false; if (prepare) prepare.disabled = unavailable();
                const warnings = selected.map(version => catalog.techniques.find(value => value.id === version.techniqueId)?.combatWarning).filter(Boolean);
                loadoutWarning.textContent = warnings.length ? 'Bộ chiêu có đánh đổi khi thi triển: ' + warnings.join(' ') : '';
                loadoutWarning.hidden = !warnings.length;
            }
            const editor = battleLoadoutEditor({ data, catalog, toast, onChange: updateWarnings,
                inspect: id => liveRequest('game-technique?techniqueId=' + encodeURIComponent(id)) });
            body.insertBefore(editor.root, loadoutWarning);
            if (!data.versions.length) {
                const note = el('p', boss.chapter === 1 ? 'Chưa có công pháp đạt tầng 1. Cậu vẫn có thể dùng Võ Kỹ để mở đầu.'
                    : 'Chưa có công pháp đạt tầng 1. Luyện trước khi vào trận này sẽ giúp cậu chuẩn bị tốt hơn.', 'battle-preparation-note hint'); body.insertBefore(note, story);
            }
            if (preparedBattle) {
                const ids = preparedBattle.state.loadout.map(skill => skill.versionId ?? skill.practiceId);
                const missing = ids.filter(id => !data.versions.some(version => version.versionId === id));
                if (missing.length) {
                    const found = await liveRequest('battle-loadout?' + new URLSearchParams(missing.map(id => ['versionId', id])));
                    if (!body.isConnected || revision !== runtime.revision) return;
                    found.versions.forEach(editor.addVersion);
                }
                if (!editor.setVersions(ids)) {
                    editor.setVersions(ids.filter(id => data.versions.some(version => version.versionId === id)));
                    invalidDraft = true;
                    body.append(el('p', 'Một bản trong bộ cũ không còn dùng được. Chọn lại bộ chiêu trước khi lưu; trận đã chuẩn bị vẫn được giữ.', 'battle-warning'));
                }
            } else {
                const recommended = data.versions.find(version => catalog.techniques.find(value => value.id === version.techniqueId)?.kind === 'ordinary');
                if (recommended) editor.setVersions([recommended.versionId]);
            }
            body.append(battlePresetControls({ data, getVersions: editor.getVersions, setVersions: editor.setVersions,
                addVersion: editor.addVersion, performLive, toast, presetSnapshot: () => runtime.refreshPending ? null : state.gamePresetData }));
            const effective = el('p', 'Xuất chiến từ ' + habitDate(preparedBattle?.startsDay ?? input.day + 1) + '. Luyện tạm dừng trong trận; habit vẫn theo lịch cam kết.', 'battle-effective hint');
            prepare = button(preparedBattle ? 'Lưu bộ chiêu' : 'Chuẩn bị xuất chiến', () => {
                    if (invalidDraft || unavailable()) return;
                    if (revision !== runtime.revision || input.day !== state.gameData.day.day || input.version !== state.gameData.version || state.featureSaving) {
                        prepare.disabled = true; toast('Tiến trình hoặc ngày sinh hoạt đã thay đổi. Cập nhật rồi chuẩn bị lại.'); return;
                    }
                    save({ ...input, versions: editor.getVersions() });
                }, 'primary');
            const battleBusy = (state.gameData.battles ?? []).some(battle => ['prepared', 'active', 'awaiting_rescue'].includes(battle.status));
            const catchingUp = state.gameData.settledThrough !== null && state.gameData.settledThrough < state.gameData.day.day - 1;
            prepare.disabled = invalidDraft || unavailable();
            if (catchingUp) body.append(el('p', 'Cập nhật kết quả những ngày trước rồi mở lại để chuẩn bị.', 'hint'));
            if (!preparedBattle && battleBusy) body.append(el('p', 'Kết thúc hoặc hủy trận hiện tại trước khi chuẩn bị trận khác.', 'hint'));
            body.insertBefore(editor.root, story); body.insertBefore(loadoutWarning, story);
            body.insertBefore(effective, editor.root);
            const footer = el('footer', undefined, 'battle-preparation-footer'); footer.append(prepare); sheetContent.append(footer);
        } catch (error) {
            if (body.isConnected) { if (!waiting.isConnected) body.append(waiting); waiting.textContent = error.message; body.append(button('Thử lại', () => prepareBoss(boss, preparedBattle), 'secondary')); }
        }
    }
    async function openBattleHistory(battle) {
        openSheet('Nhật ký · ' + battle.content.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-history'); sheetContent.append(body);
        const revision = runtime.revision, version = state.gameData.version, day = state.gameData.day.day, seen = new Set();
        const current = () => revision === runtime.revision && version === state.gameData.version && day === state.gameData.day.day;
        let cursor = Number.MAX_SAFE_INTEGER, busy = false;
        const more = button('Xem lượt trước', () => !current() ? openBattleHistory(battle) : load(), 'secondary'), loading = el('p', '', 'hint');
        loading.setAttribute('role', 'status');
        const labels = { settlement: 'lượt đã chốt', choose: 'chọn chiêu', prepare: 'chuẩn bị', update_prepared: 'đổi bộ chiêu',
            cancel: 'hủy chuẩn bị', rescue: 'cứu mạng', death: 'tử trận', withdraw: 'rút lui', exchange: 'đổi công pháp' };
        function stale() {
            if (body.isConnected && sheet.open) {
                loading.textContent = 'Dữ liệu đã thay đổi. Mở lại nhật ký để xem bản mới.';
                more.textContent = 'Cập nhật nhật ký'; body.append(loading, more);
            }
        }
        async function load() {
            if (busy || !body.isConnected || !sheet.open) return;
            if (!current()) { stale(); return; }
            busy = true; more.disabled = true; loading.textContent = 'Đang tải nhật ký…'; body.append(loading);
            try {
                const data = await liveRequest('battle-history?battleId=' + encodeURIComponent(battle.id) + '&before=' + cursor);
                if (!body.isConnected || !sheet.open) return;
                if (!current()) { stale(); return; }
                loading.remove(); more.remove();
                for (const event of data.events) {
                    if (seen.has(event.sequence)) continue;
                    seen.add(event.sequence);
                    const row = el('section', undefined, 'battle-log-day');
                    row.dataset.sequence = event.sequence;
                    row.append(el('h3', habitDate(event.day) + ' · ' + (labels[event.kind] ?? 'ghi nhận')));
                    for (const entry of event.entries) row.append(renderBattleLogEntry(entry));
                    if (event.result.contribution) {
                        const bonus = event.result.contribution;
                        row.append(el('p', 'Sức mạnh thêm: habit ' + bonus.habits / 10 + '% · công việc ' + bonus.tasks / 10 + '%', 'hint'));
                    }
                    body.append(row);
                }
                cursor = data.next;
                more.textContent = 'Xem lượt trước';
                if (cursor != null) body.append(more);
                if (!seen.size) body.append(el('p', 'Chưa có lượt giao chiến được chốt.', 'hint'));
            } catch (error) {
                if (!current()) { stale(); return; }
                if (body.isConnected && sheet.open) {
                    loading.textContent = error.message; more.textContent = 'Thử lại'; body.append(loading, more);
                }
            } finally { busy = false; more.disabled = false; }
        }
        await load();
    }
    async function openBattleArchive() {
        openSheet('Lịch sử giao chiến'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-history'); sheetContent.append(body);
        const names = { prepared: 'Đã chuẩn bị', active: 'Đang giao chiến', won: 'Đã thắng', awaiting_rescue: 'Chờ cứu mạng',
            dead: 'Tử trận', expired: 'Hết lượt', withdrawn: 'Đã rút lui', cancelled: 'Đã hủy' };
        const revision = runtime.revision, version = state.gameData.version, day = state.gameData.day.day, seen = new Set();
        const current = () => revision === runtime.revision && version === state.gameData.version && day === state.gameData.day.day;
        let cursor = null, busy = false;
        const more = button('Xem trận trước', () => !current() ? openBattleArchive() : load(), 'secondary'), loading = el('p', '', 'hint'); loading.setAttribute('role', 'status');
        function stale() {
            if (body.isConnected && sheet.open) {
                loading.textContent = 'Dữ liệu đã thay đổi. Mở lại lịch sử để xem bản mới.';
                more.textContent = 'Cập nhật lịch sử'; body.append(loading, more);
            }
        }
        async function load() {
            if (busy || !body.isConnected || !sheet.open) return;
            if (!current()) { stale(); return; }
            busy = true; more.disabled = true; loading.textContent = 'Đang mở lịch sử…'; body.append(loading);
            try {
                const data = await liveRequest('battles' + (cursor ? '?before=' + encodeURIComponent(cursor) : ''));
                if (!body.isConnected || !sheet.open) return;
                if (!current()) { stale(); return; }
                loading.remove(); more.remove();
                for (const battle of data.battles) {
                    if (seen.has(battle.id)) continue;
                    seen.add(battle.id);
                    const row = el('section', undefined, 'battle-log-day');
                    row.dataset.battleId = battle.id;
                    row.append(el('h3', battle.content.name), el('p', habitDate(battle.startsDay) + ' · ' + (names[battle.status] ?? battle.status) + ' · ' + battle.turn + ' lượt', 'hint'),
                        button('Xem nhật ký', () => openBattleHistory(battle), 'text-button')); body.append(row);
                }
                if (!seen.size) body.append(el('p', 'Chưa có trận nào trong lịch sử.', 'hint'));
                more.textContent = 'Xem trận trước';
                cursor = data.next; if (cursor) body.append(more);
            } catch (error) {
                if (!current()) { stale(); return; }
                if (body.isConnected && sheet.open) {
                    loading.textContent = error.message; more.textContent = 'Thử lại'; body.append(loading, more);
                }
            } finally { busy = false; more.disabled = false; }
        }
        await load();
    }
    async function openBattleExchange(battle) {
        const input = command('exchange_battle', battle), revision = runtime.revision;
        openSheet('Đổi một ô công pháp'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-preparation'); sheetContent.append(body);
        const waiting = el('p', 'Đang lấy các bản đã luyện…', 'hint'); body.append(waiting);
        try {
            const data = await liveRequest('battle-loadout');
            if (!body.isConnected || !sheet.open || revision !== runtime.revision) return;
            waiting.remove();
            const removeWrap = el('label', 'Môn rời bộ chiêu', 'form-field'), remove = el('select');
            for (const skill of battle.state.loadout) {
                const option = el('option', state.gameCatalog.techniques.find(technique => technique.id === skill.id)?.name ?? skill.id);
                option.value = skill.id; remove.append(option);
            }
            removeWrap.append(remove); body.append(removeWrap);
            data.versions = data.versions.filter(version => !battle.state.loadout.some(skill => skill.id === version.techniqueId));
            const saveButton = button('Đổi công pháp', () => {
                const [practiceId] = editor.getVersions();
                if (!practiceId || !remove.value) return;
                submitCurrent({ ...input, removeId: remove.value, practiceId }, revision);
            }, 'primary'); saveButton.disabled = true;
            const editor = battleLoadoutEditor({ data, catalog: state.gameCatalog, toast, maximum: 1, title: 'Công pháp thay vào',
                onChange: values => { saveButton.disabled = values.length !== 1 || !!state.featureSaving; },
                inspect: id => liveRequest('game-technique?techniqueId=' + encodeURIComponent(id)) });
            body.append(editor.root);
            if (!data.versions.length) body.append(el('p', 'Chưa có công pháp khác đạt tầng 1 để thay vào.', 'hint'));
            body.insertBefore(el('p', 'Thay một môn trước khi chọn chiêu hôm nay. HP, các ấn, thời hạn và quyền cứu được giữ nguyên.', 'battle-effective hint'), removeWrap);
            const footer = el('footer', undefined, 'battle-preparation-footer');
            footer.append(saveButton);
            sheetContent.append(footer);
        } catch (error) { if (body.isConnected) { waiting.textContent = error.message; body.append(button('Thử lại', () => openBattleExchange(battle), 'secondary')); } }
    }
    async function openGameChapter(chapter) {
        openSheet(chapter.name); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body battle-history'), waiting = el('p', 'Đang mở trang truyện…', 'hint');
        body.append(waiting); sheetContent.append(body);
        try {
            const data = await liveRequest('game-chapter?chapter=' + chapter.number);
            if (!body.isConnected || !sheet.open) return;
            waiting.remove();
            if (chapter.scene) {
                const scene = el('img', undefined, 'game-story-scene'); scene.src = gameArtUrl(chapter.scene + '.webp');
                scene.width = 640; scene.height = 448; scene.alt = 'Cảnh ' + chapter.name; scene.loading = 'lazy'; scene.decoding = 'async'; body.append(scene);
            }
            const people = el('div', undefined, 'game-story-people');
            for (const character of data.characters ?? []) {
                const person = el('div');
                if (character.artId) { const image = el('img'); image.src = gameArtUrl(character.artId + '-thumb.webp'); image.alt = ''; image.width = 44; image.height = 56; image.loading = 'lazy'; person.append(image); }
                person.append(el('span', character.name)); people.append(person);
            }
            if (people.childElementCount) body.append(people);
            body.append(el('p', data.chapter.introduction, 'battle-story'));
            if (data.chapter.conclusion) body.append(el('h3', 'Sau hành trình'), el('p', data.chapter.conclusion, 'battle-story'));
            else body.append(el('p', 'Phần kết mở sau khi vượt qua các trận trong chương.', 'hint'));
        } catch (error) { if (body.isConnected) waiting.textContent = error.message; }
    }
    function selectGameChapter(number) { state.gameChapter = number; render(); }
    return { chooseBattle, openBattleChoices, cancelBattle, withdrawBattle, rescueBattle, acceptBattleDeath, prepareBoss, openBattleHistory, openBattleExchange, openGameChapter, selectGameChapter, openBattleArchive };
}
