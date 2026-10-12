import { demoBreakthrough, demoCheckin, demoDraw, demoFuse } from '../demo/cultivation.js';
import { breakthroughPenalties, checkinProgress, dailyRewardLabel, loot, realms, rewardLabels, talismans } from '../models/cultivation.js';
import { button, el } from '../ui/dom.js';
import { playEffect } from '../ui/effects.js';
import { renderRewardCalendar } from '../views/achievements.js';
import { habitDate } from '../models/habits.js';
export function createCultivationActions(context) {
    const { state, runtime, ui, sheet, sheetContent, openSheet, confirm, performLive, render, toast } = context;
    function openShare() {
        openSheet(state.live ? 'Thẻ thành tích' : 'Thẻ thành tích mẫu');
        const c = el('div', undefined, 'rank-card');
        c.append(el('div', '✧', 'rank-seal'), el('p', 'TU LUYỆN KỶ LUẬT', 'eyebrow'), el('h2', realms[state.cultivation.rank].name), el('p', 'Tổng tích lũy: ' + state.cultivation.totalEarned + ' tu vi'), el('p', state.live ? 'MINH ANH · TRỢ LÝ CỦA CẬU' : 'MINH ANH · DEMO', 'eyebrow'));
        sheetContent.append(c, el('p', 'Không chứa tên task hoặc lịch cá nhân. Chỉ chia sẻ khi cậu chủ động chọn.', 'hint'), button('Lưu thẻ PNG', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 1000;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#242034';
            ctx.fillRect(0, 0, 800, 1000);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#e6c382';
            ctx.font = '28px sans-serif';
            ctx.fillText('TU LUYỆN KỶ LUẬT', 400, 220);
            ctx.font = '64px serif';
            ctx.fillText(realms[state.cultivation.rank].name, 400, 440);
            ctx.fillStyle = '#f4f0ff';
            ctx.font = '30px sans-serif';
            ctx.fillText('Tổng tích lũy: ' + state.cultivation.totalEarned + ' tu vi', 400, 550);
            ctx.font = '22px sans-serif';
            ctx.fillText(state.live ? 'MINH ANH · TRỢ LÝ CỦA CẬU' : 'MINH ANH · DEMO', 400, 830);
            canvas.toBlob(blob => {
                if (!blob)
                    return;
                const url = URL.createObjectURL(blob), link = document.createElement('a');
                link.href = url;
                link.download = 'minh-anh-thanh-tich.png';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            }, 'image/png');
        }, 'primary'));
    }
    function demoDay() {
        if (state.live && state.day)
            return state.day.day;
        return Math.floor((Date.now() + 7 * 3600000 - 4.5 * 3600000) / 86400000);
    }
    async function claimCheckin() {
        if (runtime.saving)
            return;
        if (state.live) {
            const saved = await performLive('cultivation', { operation: 'checkin' }, { silent: true });
            if (saved?.dailyReward && !runtime.refreshPending)
                toast('Quà ngày ' + saved.dailyReward.day + ' · ' + dailyRewardLabel(saved.dailyReward));
            return;
        }
        const reward = demoCheckin(state.cultivation);
        if (reward) {
            sheet.close();
            render();
            toast('Bản mẫu · ' + dailyRewardLabel(reward));
        }
    }
    function openRewardCalendar() {
        openSheet('Lịch quà 30 ngày');
        sheet.classList.add('reward-sheet-open');
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now());
        const calendar = renderRewardCalendar(ui, state, now);
        calendar.tabIndex = 0;
        calendar.setAttribute('role', 'region');
        sheetContent.append(calendar);
        calendar.scrollTop = 0;
    }
    function openDailyReward(reward) {
        openSheet('Quà ngày ' + reward.day);
        const now = (state.serverNow ?? Date.now()) + Date.now() - (state.loadedAt ?? Date.now()), p = checkinProgress(state.cultivation, now, state.checkin?.rewards);
        const reveal = el('div', dailyRewardLabel(reward), 'daily-reward-detail' + (reward.milestone ? ' is-milestone' : ''));
        sheetContent.append(reveal);
        for (const item of talismans) {
            if (reward.items[item.key]) {
                sheetContent.append(el('p', 'Phá Cảnh Phù · ' + item.name + ' tăng ' + item.boost + ' điểm % cơ hội thành công khi dùng trong một lần đột phá.', 'hint'));
                if (item.next)
                    sheetContent.append(el('p', 'Có thể ghép 3 phù cùng cấp trong Túi vật phẩm để thử tạo một phù cấp cao hơn.', 'hint'));
            }
        }
        const received = reward.day <= p.count, available = reward.day === p.rewardDay && p.canClaim;
        sheetContent.append(el('p', received ? 'Cậu đã nhận phần quà này.' : available ? 'Phần quà này đã sẵn sàng cho hôm nay.' : 'Nhận khi điểm danh đủ ' + reward.day + ' lần trong chu kỳ này. Bỏ lỡ một ngày không mất các quà phía sau.', 'hint'));
        if (available)
            sheetContent.append(button('Nhận quà hôm nay', claimCheckin, 'primary'));
        sheetContent.append(button('← Lịch quà 30 ngày', openRewardCalendar, 'text-button'));
    }
    function openDraw() {
        if (state.live) {
            openSheet('Quay thưởng');
            const c = state.cultivation, blocked = c.suspended || c.tickets < 1;
            const hint = c.suspended ? 'Tạm ngưng vì lâu không chat. Nhắn Minh Anh để hoạt động lại.' : c.tickets < 1 ? 'Chưa có vé. Hoàn thành task hoặc điểm danh để nhận vé nhé.' : 'Cậu có ' + c.tickets + ' vé. /ngu không khóa quay thưởng.';
            const reveal = el('div', '?', 'loot-result mystery-card');
            reveal.setAttribute('aria-label', 'Phần thưởng bí ẩn');
            const draw = button('Dùng 1 vé', async () => {
                if (state.cultivation.tickets < 1 || state.cultivation.suspended || draw.disabled)
                    return;
                draw.disabled = true;
                draw.textContent = 'Đang mở…';
                await playEffect(reveal, 'draw', 620);
                const saved = await performLive('cultivation', { operation: 'draw' }, { keepSheet: true, silent: true });
                if (saved === null && draw.isConnected) {
                    draw.disabled = false;
                    draw.textContent = 'Dùng 1 vé';
                    return;
                }
                if (!draw.isConnected)
                    return;
                reveal.classList.add('mystery-revealed');
                reveal.textContent = rewardLabels[saved.reward] ?? saved.reward;
                const tickets = state.cultivation.tickets;
                draw.disabled = tickets < 1;
                draw.textContent = tickets < 1 ? 'Hết vé' : 'Quay tiếp · ' + tickets + ' vé';
            }, 'primary reward-action');
            draw.disabled = blocked;
            sheetContent.append(el('p', hint, 'hint'), reveal, draw);
            return;
        }
        openSheet('Linh bảo · Quay thưởng');
        sheetContent.append(el('p', '1 vé / lần · Không mua bằng tiền · Kết quả demo', 'hint'));
        const result = el('div', '?', 'loot-result mystery-card');
        result.setAttribute('role', 'status');
        result.setAttribute('aria-label', 'Phần thưởng bí ẩn');
        const draw = button('Dùng 1 vé quay', async () => {
            if (draw.disabled)
                return;
            draw.disabled = true;
            draw.textContent = 'Đang mở…';
            await playEffect(result, 'draw', 620);
            const reward = demoDraw(state.cultivation);
            if (!reward) {
                draw.disabled = false;
                draw.textContent = 'Dùng 1 vé quay';
                return;
            }
            result.classList.add('mystery-revealed');
            result.textContent = reward.label + ' · Còn ' + state.cultivation.tickets + ' vé';
            draw.disabled = state.cultivation.tickets === 0;
            render();
            draw.textContent = state.cultivation.tickets === 0 ? 'Hết vé' : 'Quay tiếp';
        }, 'primary');
        draw.disabled = state.cultivation.tickets === 0;
        sheetContent.append(result, draw);
        const odds = el('details', undefined, 'realm-path');
        odds.append(el('summary', 'Xác suất công khai'));
        for (const item of loot)
            odds.append(el('p', item.label + ' — ' + item.weight + '%', 'hint'));
        sheetContent.append(odds);
    }
    function openInventory() {
        openSheet('Túi vật phẩm');
        const c = state.cultivation;
        const itemHeading = (name, count) => {
            const row = el('div', undefined, 'inventory-heading');
            row.append(el('h3', name), el('span', '×' + count, 'quantity-badge'));
            return row;
        };
        sheetContent.append(el('p', 'BẢO VỆ', 'inventory-group'));
        for (const [key, name, description] of [
            ['heart', 'Hộ Tâm Phù', 'Nếu cậu ngủ muộn, chuỗi ngủ đúng giờ không bị mất. Tu vi vẫn bị trừ 20 như bình thường.'],
            ['peace', 'An Tâm Phù', 'Nếu cậu ngủ muộn, phù chặn lần trừ 20 tu vi của ngày đó. Chuỗi ngủ đúng giờ vẫn bị mất.']
        ]) {
            const item = el('section', undefined, 'item-row');
            item.append(itemHeading(name, c.inventory[key]), el('p', description, 'hint'));
            const use = button(c.active[key] ? (state.live ? 'Đã kích hoạt hôm nay' : 'Đã kích hoạt trong demo') : 'Dùng hôm nay', () => confirm('Dùng ' + name + '?', description + (state.live ? ' Chỉ áp dụng ngày sinh hoạt hiện tại.' : ' Chỉ áp dụng ngày sinh hoạt này trong demo.'), () => {
                if (c.active[key] || c.inventory[key] < 1)
                    return;
                if (state.live) {
                    performLive('cultivation', { operation: 'protect', item: key });
                    return;
                }
                c.inventory[key]--;
                c.active[key] = true;
                c.log.unshift('Dùng ' + name + ' (demo)');
                openInventory();
                render();
            }), 'secondary');
            use.disabled = c.active[key] || c.inventory[key] < 1;
            item.append(use);
            sheetContent.append(item);
        }
        sheetContent.append(el('p', 'PHÁ CẢNH', 'inventory-group'));
        for (const t of talismans) {
            const item = el('section', undefined, 'item-row');
            item.append(itemHeading('Phá Cảnh Phù · ' + t.name, c.inventory[t.key]), el('p', 'Khi dùng trong lần đột phá này, cơ hội thành công tăng thêm ' + t.boost + ' điểm %. Dùng xong sẽ tiêu hao.', 'hint'));
            if (t.next) {
                const fuse = button('Ghép 3 lá · ' + t.chance + '%', () => confirm('Ghép lên ' + talismans.find(n => n.key === t.next).name + '?', 'Ghép 3 phù cùng cấp. Thành công nhận 1 phù cấp cao hơn; thất bại mất 1 và trả lại 2. Tỷ lệ thành công ' + t.chance + '%.', () => {
                    if (state.live) {
                        performLive('cultivation', { operation: 'fuse', item: t.key });
                        return;
                    }
                    const success = demoFuse(c, t.key);
                    if (success === null)
                        return;
                    toast(success ? 'Ghép thành công ✦' : 'Chưa thành, đã trả lại 2 lá.');
                    openInventory();
                    render();
                }), 'secondary');
                fuse.disabled = c.inventory[t.key] < 3;
                item.append(fuse);
            }
            sheetContent.append(item);
        }
        sheetContent.append(el('p', 'TÍN VẬT', 'inventory-group'), (() => {
            const box = el('section', undefined, 'item-row');
            box.append(itemHeading('Tín vật Minh Anh', c.inventory.keepsake), el('p', 'Vật phẩm sưu tầm, không phải tu vi.', 'hint'));
            return box;
        })());
    }
    function openBreakthrough() {
        const c = state.cultivation, target = realms[c.rank + 1];
        if (!target)
            return;
        openSheet('Đột phá · ' + target.name);
        if (c.rankLockUntilDay !== null && c.rankLockUntilDay !== undefined && demoDay() < c.rankLockUntilDay) {
            sheetContent.append(el('p', 'Nghịch Mệnh đang hồi. Có thể đột phá lại từ ' + habitDate(c.rankLockUntilDay) + '.', 'hint'));
            return;
        }
        const penalty = (state.breakthroughPenalties ?? breakthroughPenalties)[c.rank];
        sheetContent.append(el('p', 'Cần ' + target.qi + ' tu vi và ' + target.days + ' ngày ngủ đúng giờ. Thành công không tiêu hao tu vi; thất bại trừ ' + penalty + ' tu vi.', 'hint'));
        const select = el('select'), label = el('label', 'Dùng Phá Cảnh Phù', 'form-field'), none = el('option', 'Không dùng phù');
        none.value = '';
        select.append(none);
        for (const t of talismans) {
            if (c.inventory[t.key] > 0) {
                const option = el('option', t.name + ' · +' + t.boost + ' điểm %');
                option.value = t.key;
                select.append(option);
            }
        }
        label.append(select);
        sheetContent.append(label);
        const info = el('p', undefined, 'hint'), result = el('div', undefined, 'loot-result');
        result.hidden = true;
        result.setAttribute('role', 'status');
        const chance = () => Math.min(100, target.chance + 5 * Math.min(Math.max(c.failures - 1, 0), 3) + (talismans.find(t => t.key === select.value)?.boost ?? 0));
        const explain = () => {
            info.textContent = 'Lần này có ' + chance() + '% cơ hội thành công. Tỷ lệ cơ bản lên ' + target.name + ': ' + target.chance + '%. Thất bại −' + penalty + ' tu vi, giữ cảnh giới và chuỗi ngủ. Phù đã chọn vẫn tiêu hao. Thất bại 1 lần chưa cộng; 2/3/4 lần liên tiếp cộng 5/10/15 điểm % cho lần sau, tối đa +15 điểm %. Thành công đặt lại chuỗi thất bại. Phù cộng thêm tỷ lệ, tổng tối đa 100%. Mỗi ngày sinh hoạt chỉ thử 1 lần.';
        };
        select.addEventListener('change', explain);
        explain();
        const attempt = button('Đột phá', async () => {
            if (attempt.disabled)
                return;
            attempt.disabled = true;
            attempt.textContent = 'Đang đột phá…';
            await playEffect(attempt, 'breakthrough', 860);
            if (state.live) {
                const saved = await performLive('cultivation', { operation: 'breakthrough', item: select.value || null }, { keepSheet: true, silent: true });
                if (saved === null && attempt.isConnected) {
                    attempt.disabled = false;
                    attempt.textContent = 'Đột phá';
                    return;
                }
                if (!attempt.isConnected)
                    return;
                select.disabled = true;
                result.hidden = false;
                result.classList.add(saved.success ? 'effect-success' : 'effect-failure');
                result.textContent = saved.success ? 'Đột phá thành công ✦ ' + target.name + ' · Được bảo vệ hạ bậc 72 giờ.' : 'Chưa thành công · −' + saved.penalty + ' tu vi. Cảnh giới và chuỗi vẫn giữ; mình thử lại khi đủ điều kiện nhé.';
                attempt.textContent = 'Đã thử hôm nay';
                return;
            }
            const r = demoBreakthrough(c, demoDay(), select.value || null);
            if (!r) {
                attempt.disabled = false;
                attempt.textContent = 'Đột phá';
                return;
            }
            select.disabled = true;
            result.hidden = false;
            result.classList.add(r.success ? 'effect-success' : 'effect-failure');
            result.textContent = r.success ? 'Đột phá thành công ✦ ' + realms[c.rank].name + ' · Được bảo vệ hạ bậc 72 giờ.' : 'Chưa thành công · −' + r.penalty + ' tu vi. Cảnh giới và chuỗi vẫn giữ.';
            attempt.textContent = 'Đã thử hôm nay';
            render();
        }, 'primary');
        attempt.disabled = c.suspended || c.attemptDay === demoDay() || c.qi < target.qi || c.streak < target.days;
        sheetContent.append(info, attempt, result);
    }
    return { openShare, demoDay, claimCheckin, openRewardCalendar, openDailyReward, openDraw, openInventory, openBreakthrough };
}
