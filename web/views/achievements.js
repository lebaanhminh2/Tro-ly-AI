import { breakthroughPenalties, checkinProgress, dailyRewardLabel, flameLevel, realms } from '../models/cultivation.js';
export function renderCheckin(ui, state, now) {
    const { el, button, card } = ui, p = checkinProgress(ui.cultivation(), now, state.checkin?.rewards);
    const root = card('checkin-card checkin-compact');
    root.setAttribute('aria-label', 'Điểm danh nhận quà');
    const header = el('div', undefined, 'checkin-heading'), copy = el('div');
    const nextMilestone = p.rewards.find(reward => reward.milestone && reward.day > p.count);
    const goal = el('p', undefined, 'subtitle checkin-goal');
    if (nextMilestone) {
        goal.append(el('strong', 'Mốc ' + nextMilestone.day), el('span', ' · Còn ' + (nextMilestone.day - p.count) + ' lần điểm danh'));
        goal.setAttribute('aria-label', 'Còn ' + (nextMilestone.day - p.count) + ' lần điểm danh để nhận quà mốc ' + nextMilestone.day + ': ' + dailyRewardLabel(nextMilestone));
    }
    else
        goal.textContent = p.endsAt ? 'Đã nhận đủ quà · Chu kỳ mới từ ' + new Date(p.endsAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }) : 'Đã nhận đủ 30 phần quà';
    copy.append(el('h2', 'Điểm danh nhận quà'), goal);
    const count = el('div', undefined, 'checkin-count');
    count.append(el('strong', String(p.count)), el('span', '/ 30 ngày'));
    header.append(copy, count);
    root.append(header);
    const progress = el('div', undefined, 'track checkin-track');
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Số ngày đã nhận quà');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '30');
    progress.setAttribute('aria-valuenow', String(p.count));
    const fill = el('span');
    fill.style.width = p.count / 30 * 100 + '%';
    progress.append(fill);
    root.append(progress);
    const today = p.rewards[p.claimedToday ? p.count - 1 : p.count] ?? p.rewards[29], row = el('div', undefined, 'checkin-compact-row'), gift = el('div', undefined, 'checkin-gift');
    gift.append(el('p', p.count === 30 ? 'ĐÃ NHẬN ĐỦ QUÀ' : p.claimedToday ? 'ĐÃ NHẬN HÔM NAY' : 'QUÀ HÔM NAY · NGÀY ' + today.day, 'eyebrow'), el('p', dailyRewardLabel(today), 'checkin-gift-label'));
    const actions = el('div', undefined, 'checkin-compact-actions'), claim = button(p.count === 30 ? 'Đã nhận đủ quà' : p.claimedToday ? '✓ Đã nhận' : 'Nhận quà', () => ui.claimCheckin(), 'primary checkin-claim');
    claim.disabled = !p.canClaim;
    actions.append(claim, button('Xem lịch quà', () => ui.openRewardCalendar(), 'text-button checkin-calendar-link'));
    row.append(gift, actions);
    root.append(row);
    if (p.expired)
        root.append(el('p', 'Chu kỳ mới đã sẵn sàng. Quà đã nhận vẫn được giữ.', 'checkin-notice'));
    else if (!p.canComplete)
        root.append(el('p', 'Không còn đủ ngày để đến mốc 30. Cậu vẫn nhận được các quà còn lại trong chu kỳ này.', 'checkin-notice'));
    return root;
}
export function renderRewardCalendar(ui, state, now) {
    const { el, button } = ui, c = ui.cultivation(), p = checkinProgress(c, now, state.checkin?.rewards);
    const root = el('div', undefined, 'checkin-calendar-content');
    root.setAttribute('aria-label', 'Lịch quà điểm danh 30 ngày');
    const header = el('div', undefined, 'checkin-heading'), copy = el('div');
    copy.append(el('p', 'MỘT MÓN QUÀ MỖI NGÀY', 'eyebrow'), el('h2', 'Hẹn cậu mỗi ngày'), el('p', '30 lần điểm danh trong 32 ngày · Có thể bỏ lỡ 2 ngày.', 'subtitle'));
    const count = el('div', undefined, 'checkin-count');
    count.append(el('strong', String(p.count)), el('span', '/ 30 ngày'));
    header.append(copy, count);
    root.append(header);
    const progress = el('div', undefined, 'track checkin-track');
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Số ngày đã nhận quà');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '30');
    progress.setAttribute('aria-valuenow', String(p.count));
    const fill = el('span');
    fill.style.width = p.count / 30 * 100 + '%';
    progress.append(fill);
    root.append(progress);
    const meta = el('div', undefined, 'checkin-meta');
    meta.append(el('span', p.cycleStartDay === null ? 'Chu kỳ bắt đầu khi nhận món quà đầu tiên' : 'Còn ' + p.daysLeft + ' ngày · đã bỏ lỡ ' + p.missedDays + ' ngày'));
    if (p.endsAt)
        meta.append(el('span', 'Làm mới ' + new Date(p.endsAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' })));
    root.append(meta);
    if (p.expired)
        root.append(el('p', 'Chu kỳ mới đã sẵn sàng. Quà đã nhận từ trước vẫn nằm trong túi của cậu.', 'checkin-notice'));
    else if (!p.canComplete)
        root.append(el('p', 'Chu kỳ này không còn đủ ngày để đến mốc 30. Cậu vẫn nhận được các quà trước đó; chu kỳ sau mình thử lại nhé.', 'checkin-notice'));
    const preview = el('div', undefined, 'checkin-preview'), today = p.rewards[p.claimedToday ? p.count - 1 : p.count] ?? p.rewards[29];
    const current = el('div', undefined, 'checkin-current');
    current.append(el('p', p.count === 30 ? 'ĐÃ HOÀN THÀNH' : p.claimedToday ? 'ĐÃ NHẬN HÔM NAY' : 'QUÀ HÔM NAY · NGÀY ' + today.day, 'eyebrow'), el('h3', dailyRewardLabel(today)));
    const claim = button(p.count === 30 ? 'Đã nhận đủ 30 phần quà' : p.claimedToday ? '✓ Hẹn cậu ngày mai' : 'Nhận quà hôm nay', () => ui.claimCheckin(), 'primary checkin-claim');
    claim.disabled = !p.canClaim;
    current.append(claim);
    const upcoming = el('div', undefined, 'checkin-upcoming'), nextIndex = p.claimedToday ? p.count : p.count + 1, tomorrowReset = p.cycleStartDay !== null && p.daysLeft === 1;
    const next = p.rewards[tomorrowReset ? 0 : nextIndex];
    if (next)
        upcoming.append(el('p', tomorrowReset ? 'NGÀY MAI · CHU KỲ MỚI' : 'NGÀY MAI · NGÀY THƯỞNG ' + next.day, 'eyebrow'), el('h3', dailyRewardLabel(next)));
    else
        upcoming.append(el('p', 'CHU KỲ TIẾP THEO', 'eyebrow'), el('h3', 'Một hành trình mới đang chờ'), el('p', p.endsAt ? 'Bắt đầu lại khi chu kỳ 32 ngày kết thúc.' : 'Nhận quà đầu tiên để bắt đầu nhé.', 'hint'));
    preview.append(current, upcoming);
    root.append(preview);
    const calendarHeading = el('div', undefined, 'reward-calendar-heading');
    calendarHeading.append(el('h3', 'Lịch quà 30 ngày'), el('span', 'Chạm vào quà để xem chi tiết', 'hint'));
    root.append(calendarHeading);
    const grid = el('div', undefined, 'reward-calendar');
    for (const reward of p.rewards) {
        const received = reward.day <= p.count, available = reward.day === p.rewardDay && p.canClaim, status = received ? 'Đã nhận' : available ? 'Hôm nay' : 'Sắp tới';
        const cell = button('', () => ui.openDailyReward(reward), 'reward-cell' + (received ? ' is-received' : '') + (available ? ' is-today' : '') + (reward.milestone ? ' is-milestone' : '') + (reward.day === 30 ? ' is-grand' : ''));
        cell.setAttribute('aria-label', 'Ngày thưởng ' + reward.day + ': ' + dailyRewardLabel(reward) + '. ' + status);
        if (available)
            cell.setAttribute('aria-current', 'step');
        const top = el('span', undefined, 'reward-cell-top');
        top.append(el('span', 'Ngày ' + reward.day), el('span', received ? '✓' : reward.milestone ? '✧' : ''));
        cell.append(top);
        cell.append(el('span', Object.keys(reward.items).length ? '◇' : reward.tickets ? '▱' : '✦', 'reward-cell-icon'));
        const label = el('span', undefined, 'reward-cell-label');
        const charm = Object.entries(reward.items).find(([key]) => ['basic', 'middle', 'high', 'supreme'].includes(key));
        if (charm) {
            const names = { basic: 'Sơ cấp', middle: 'Trung cấp', high: 'Cao cấp', supreme: 'Cực phẩm' };
            label.append(el('span', charm[1] + ' Phá Cảnh Phù'), el('small', names[charm[0]]));
            if (reward.tickets || reward.qi)
                label.append(el('small', [reward.qi ? reward.qi + ' tu vi' : '', reward.tickets ? reward.tickets + ' vé' : ''].filter(Boolean).join(' · ')));
        }
        else
            label.textContent = reward.tickets ? reward.tickets + ' vé quay' : reward.qi + ' tu vi';
        cell.append(label, el('span', status, 'reward-cell-status'));
        grid.append(cell);
    }
    root.append(grid);
    const grand = el('div', undefined, 'checkin-grand');
    grand.append(el('span', '✧', 'checkin-grand-mark'), el('p', 'Mốc 30 · ' + dailyRewardLabel(p.rewards[29])));
    root.append(grand);
    root.append(el('p', 'Mỗi ô là một lần điểm danh, không phải ngày lịch. Bỏ lỡ không mất tiến độ. Quà mới mở lúc 00:00 giờ Việt Nam.', 'checkin-footnote'));
    return root;
}
export function renderAchievements(ui, state) {
    const { el, button, heading, card } = ui, root = el('section', undefined, 'achievements-page');
    root.append(heading('Tích lũy từng ngày.', 'Không cần hoàn hảo. Chỉ cần tiếp tục.'));
    const now = (state?.serverNow ?? Date.now()) + Date.now() - (state?.loadedAt ?? Date.now());
    const today = Math.floor((now + 7 * 3600000) / 86400000), completed = state?.progress?.completions ?? [];
    const weekly = completed.filter(c => {
        const d = Math.floor((c.completed_at + 7 * 3600000) / 86400000);
        return d >= today - 6 && d <= today;
    });
    const amounts = state?.live ? Array.from({ length: 7 }, (_, i) => completed.filter(c => Math.floor((c.completed_at + 7 * 3600000) / 86400000) === today - 6 + i).length) : [1, 2, 0, 1, 1, 2, 1];
    const c = ui.cultivation(), streak = Math.max(0, Number(c.streak ?? 0)), bestStreak = Math.max(streak, Number(c.bestStreak ?? 0)), flame = flameLevel(streak);
    const overview = el('div', undefined, 'achievement-overview'), flameCard = card();
    flameCard.style.setProperty('--flame', flame.color);
    flameCard.classList.add('flame-card', 'companion-flame', 'flame-' + flame.key);
    flameCard.append(el('p', 'HỎA MẠCH', 'eyebrow'), el('div', '🔥', 'flame-mark'), el('p', streak + ' ngày liên tiếp', 'flame-count'), el('h2', flame.name, 'flame-name'), el('p', bestStreak ? 'Kỷ lục của cậu: ' + bestStreak + ' ngày' : 'Bắt đầu một chuỗi mới nhé.', 'flame-best'), el('p', 'Chuỗi ngủ đúng giờ · không phải chuỗi điểm danh', 'flame-streak-hint'));
    overview.append(flameCard);
    const insights = el('div', undefined, 'achievement-insights'), stats = el('div', undefined, 'stats achievement-metrics');
    for (const [value, label] of (state?.live ? [[String(weekly.length), 'Việc xong tuần này'], [String(completed.length), 'Tổng đã ghi nhận']] : [['8', 'Việc xong tuần này'], ['24', 'Tổng đã ghi nhận']])) {
        const box = card(), n = el('p', value, 'stat-value');
        n.append(el('small', ' việc'));
        box.append(el('p', label, 'stat-label'), n);
        stats.append(box);
    }
    insights.append(stats);
    const chart = card('achievement-chart');
    chart.append(el('h2', 'Nhịp làm việc'));
    const bars = el('div', undefined, 'chart');
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', 'Số việc hoàn thành từ cũ đến mới: ' + amounts.join(', '));
    amounts.forEach((n, i) => {
        const col = el('div', undefined, 'chart-col'), bar = el('div', undefined, 'chart-bar');
        bar.style.height = (n / Math.max(1, ...amounts) * 68 + 3) + 'px';
        col.append(el('span', String(n)), bar, el('span', new Date((today - 6 + i) * 86400000).toLocaleDateString('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })));
        bars.append(col);
    });
    if (!state?.live || amounts.some(n => n > 0))
        chart.append(bars);
    else
        chart.append(el('p', 'Chưa có việc hoàn thành tuần này. Từng việc nhỏ sẽ tạo nên nhịp tiến bộ của cậu.', 'hint'), button('Xem công việc', () => {
            state.tab = 'today';
            state.mode = 'tasks';
            ui.render();
        }, 'text-button'));
    insights.append(chart);
    overview.append(insights);
    root.append(overview, renderCheckin(ui, state, now));
    const current = realms[c.rank], next = realms[c.rank + 1];
    const title = el('div', undefined, 'section-heading');
    title.append(el('h2', 'Tu luyện cùng Minh Anh'), el('span', state?.live ? 'TU LUYỆN' : 'DEMO', 'pill'));
    root.append(title);
    const cultivation = el('div', undefined, 'cultivation-section'), summary = el('div', undefined, 'cultivation-summary'), rank = el('article', undefined, 'rank-card companion-rank');
    rank.append(el('div', '✧', 'rank-seal'), el('p', 'CẢNH GIỚI HIỆN TẠI', 'eyebrow'), el('h2', current.name), el('p', 'Đỉnh cao từng đạt: ' + realms[c.highestRank].name));
    if (c.protectedUntil > now)
        rank.append(el('p', '🛡 Miễn hạ bậc đến ' + new Date(c.protectedUntil).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), 'protection'));
    rank.append(button('Xem thẻ thành tích', () => ui.openShare(), 'text-button'));
    summary.append(rank);
    const balances = el('div', undefined, 'stats cultivation-balances');
    for (const [value, label] of [[c.qi, 'Tu vi hiện tại'], [c.totalEarned, 'Tổng từng kiếm']]) {
        const box = card();
        box.append(el('p', label, 'stat-label'), el('p', String(value), 'stat-value'));
        balances.append(box);
    }
    summary.append(balances);
    summary.append(el('p', 'Tổng tích lũy không giảm khi bị phạt. Tu vi hiện tại dùng để xét đột phá.', 'footer-note'));
    const tools = el('div', undefined, 'reward-tools');
    tools.append(button('Quay thưởng · ' + c.tickets + ' vé', () => ui.openDraw(), 'primary'), button('Túi vật phẩm', () => ui.openInventory(), 'secondary'));
    summary.append(tools);
    cultivation.append(summary);
    if (next) {
        const qi = Math.max(0, Number(c.qi ?? 0)), percent = next.qi > 0 ? Math.round(100 * qi / next.qi) : 100, surplus = Math.max(0, qi - next.qi), penalty = (state.breakthroughPenalties ?? breakthroughPenalties)[c.rank];
        const target = card('breakthrough-card');
        target.append(el('p', 'ĐỘT PHÁ TIẾP THEO', 'eyebrow'), el('h2', next.name));
        const metric = el('div', undefined, 'breakthrough-metric');
        metric.append(el('span', 'Tu vi'), el('strong', qi + ' / ' + next.qi));
        target.append(metric);
        const track = el('div', undefined, 'track breakthrough-track'), fill = el('span');
        fill.style.width = Math.min(100, percent) + '%';
        track.append(fill);
        if (surplus)
            track.classList.add('has-surplus');
        target.append(track);
        target.append(el('p', percent + '%' + (surplus ? ' · dư ' + surplus + ' tu vi' : ''), 'breakthrough-percent'));
        const condition = el('div', undefined, 'breakthrough-condition' + (c.streak >= next.days ? ' is-met' : ''));
        condition.append(el('span', 'Điều kiện đột phá'), el('strong', c.streak + ' / ' + next.days + ' ngày đúng giờ'));
        target.append(condition);
        const attempt = button('Đột phá', () => ui.openBreakthrough(), 'primary');
        attempt.disabled = c.suspended || c.qi < next.qi || c.streak < next.days || c.attemptDay === ui.demoDay();
        target.append(attempt);
        target.append(el('p', c.suspended ? 'Nhắn cho Minh Anh để tiếp tục tu luyện.' : c.attemptDay === ui.demoDay() ? 'Đã thử hôm nay · hẹn ngày sinh hoạt tiếp theo.' : 'Mỗi ngày 1 lần · thất bại −' + penalty + ' tu vi, giữ cảnh giới và chuỗi.', 'hint'));
        cultivation.append(target);
    }
    root.append(cultivation);
    const details = el('div', undefined, 'achievement-details'), rules = el('details', undefined, 'card realm-path sleep-rules');
    rules.append(el('summary', 'Nhịp ngủ & tu vi'), el('p', 'Đúng giờ +5 · Muộn −20', 'subtitle'), el('p', 'Phạt ngủ muộn có thể hạ 1 bậc nếu tu vi dưới ngưỡng cảnh giới. Bảo vệ 72 giờ sau đột phá ngăn hạ bậc, không ngăn trừ tu vi. Đột phá thất bại không hạ bậc.', 'hint'), el('p', 'Không báo nghỉ: −20 khi hết ngày. Sau 3 ngày không chat thì ngừng nhắc; quay lại không truy thu. Điểm danh không tự bật lại lời nhắc.', 'hint'));
    details.append(rules);
    const path = el('details', undefined, 'card realm-path');
    path.append(el('summary', 'Lộ trình cảnh giới'));
    realms.slice(1).forEach((r, index) => {
        const row = el('div', undefined, 'rank-row');
        row.append(el('span', index + 1 <= c.highestRank ? '✦' : '◇'), el('h3', r.name), el('small', r.qi + ' tu vi · ' + r.days + ' ngày'));
        path.append(row);
    });
    details.append(path);
    if (!state?.live) {
        const history = el('details', undefined, 'card realm-path');
        history.append(el('summary', 'Nhật ký bản mẫu'));
        for (const line of c.log.slice(0, 6))
            history.append(el('p', line, 'hint'));
        if (!c.log.length)
            history.append(el('p', 'Chưa có giao dịch trong bản mẫu.', 'hint'));
        details.append(history);
    }
    root.append(details);
    root.append(el('p', state?.live ? 'Phần thưởng và số dư được lưu chung trên Chrome và Telegram.' : 'Đây là bản mẫu. Tải lại trang sẽ khôi phục; không phát thưởng thật.', 'footer-note'));
    return root;
}
