// Pure display models. Production rewards are always decided by the server.
const DAY_MS = 86400000;
// Shared visual identity for the achievement flame and Today focus card.
export const flameLevels = [{ min: 0, key: 'ember', name: 'Tàn Hỏa', color: '#726a82' }, { min: 1, key: 'seed', name: 'Hỏa Chủng', color: '#ae7137' }, { min: 3, key: 'spirit', name: 'Linh Hỏa', color: '#bd5d39' }, { min: 7, key: 'scarlet', name: 'Xích Viêm', color: '#b04451' }, { min: 14, key: 'heaven', name: 'Thiên Hỏa', color: '#8050a9' }, { min: 30, key: 'true', name: 'Chân Hỏa', color: '#9a6b17' }];
export const flameLevel = streak => flameLevels.slice().reverse().find(level => Number(streak ?? 0) >= level.min) ?? flameLevels[0];
export const breakthroughPenalties = [3, 5, 8, 12, 18, 25, 35, 50, 70, 95, 125, 160, 200, 250, 300];
export const breakthroughPity = c => Math.max(c.immortalPity ? 5 : 0, 5 * Math.min(Math.max(c.failures - 1, 0), 3));
// Demo fallback only; authenticated views use the published server calendar.
export const dailyRewards = [
    { qi: 1 }, { tickets: 1 }, { qi: 2 }, { tickets: 1 }, { qi: 2 }, { tickets: 1 }, { tickets: 2, items: { basic: 3 } },
    { qi: 2 }, { tickets: 1 }, { qi: 3 }, { tickets: 1 }, { qi: 2 }, { tickets: 1 }, { items: { middle: 3 } },
    { qi: 2 }, { tickets: 1 }, { qi: 3 }, { tickets: 1 }, { qi: 2 }, { tickets: 1 }, { items: { high: 3 } },
    { qi: 3 }, { tickets: 1 }, { qi: 2 }, { tickets: 1 }, { qi: 3 }, { tickets: 1 }, { qi: 3 }, { tickets: 2 },
    { qi: 30, tickets: 5, items: { supreme: 1 } }
].map((reward, index) => ({ day: index + 1, qi: 0, tickets: 0, items: {}, ...reward, milestone: [7, 14, 21, 30].includes(index + 1) }));
export function checkinProgress(c, now = Date.now(), rewards = dailyRewards) {
    const calendarDay = Math.floor((now + 7 * 3600000) / DAY_MS), saved = c.checkin;
    const expired = !!saved && calendarDay >= saved.cycleStartDay + 32, current = expired ? null : saved, count = current?.count ?? 0;
    const claimedToday = current?.lastDay === calendarDay, daysLeft = current ? Math.max(0, current.cycleStartDay + 32 - calendarDay) : 32;
    return { calendarDay, cycleStartDay: current?.cycleStartDay ?? null, count, claimedToday, expired,
        canClaim: count < 30 && !claimedToday && (!current || calendarDay >= current.lastDay), daysLeft,
        missedDays: Math.max(0, (current ? Math.max(0, calendarDay - current.cycleStartDay) : 0) - (count - (claimedToday ? 1 : 0))),
        canComplete: count + daysLeft - (claimedToday ? 1 : 0) >= 30,
        endsAt: current ? (current.cycleStartDay + 32) * DAY_MS - 7 * 3600000 : null, rewardDay: count < 30 ? count + 1 : null, rewards };
}
export function dailyRewardLabel(reward) {
    if (!reward)
        return '';
    const labels = [];
    if (reward.qi)
        labels.push(reward.qi + ' tu vi');
    if (reward.tickets)
        labels.push(reward.tickets + ' vé quay');
    const names = { basic: 'Phá Cảnh Phù · Sơ cấp', middle: 'Phá Cảnh Phù · Trung cấp', high: 'Phá Cảnh Phù · Cao cấp', supreme: 'Phá Cảnh Phù · Cực phẩm' };
    for (const [key, amount] of Object.entries(reward.items ?? {}))
        labels.push(amount + ' ' + (names[key] ?? key));
    return labels.join(' + ');
}
export const realms = [
    { name: 'Phàm Nhân', qi: 0, days: 0, chance: 0 }, { name: 'Luyện Khí', qi: 15, days: 2, chance: 65 },
    { name: 'Trúc Cơ', qi: 50, days: 3, chance: 60 }, { name: 'Kết Đan', qi: 120, days: 5, chance: 55 },
    { name: 'Nguyên Anh', qi: 250, days: 7, chance: 50 }, { name: 'Hóa Thần', qi: 500, days: 10, chance: 45 },
    { name: 'Luyện Hư', qi: 800, days: 14, chance: 40 }, { name: 'Hợp Thể', qi: 1300, days: 18, chance: 35 },
    { name: 'Đại Thừa', qi: 2000, days: 23, chance: 30 }, { name: 'Độ Kiếp', qi: 3000, days: 28, chance: 25 },
    { name: 'Chân Tiên', qi: 4000, days: 36, chance: 20 }, { name: 'Kim Tiên', qi: 5000, days: 45, chance: 15 },
    { name: 'Thái Ất', qi: 6200, days: 49, chance: 12 }, { name: 'Đại La', qi: 7400, days: 53, chance: 9 },
    { name: 'Hỗn Nguyên', qi: 8600, days: 57, chance: 7 }, { name: 'Vô Cực', qi: 10000, days: 60, chance: 5 }
];
export const loot = [
    { key: 'qi1', label: '+1 tu vi', weight: 40 }, { key: 'qi2', label: '+2 tu vi', weight: 15 },
    { key: 'basic', label: 'Phá Cảnh Phù · Sơ cấp', weight: 35 },
    { key: 'keepsake', label: 'Tín vật Minh Anh', weight: 6 },
    { key: 'heart', label: 'Hộ Tâm Phù', weight: 2 }, { key: 'peace', label: 'An Tâm Phù', weight: 2 }
];
export const talismans = [
    { key: 'basic', name: 'Sơ cấp', boost: 5, next: 'middle', chance: 80 },
    { key: 'middle', name: 'Trung cấp', boost: 10, next: 'high', chance: 60 },
    { key: 'high', name: 'Cao cấp', boost: 20, next: 'supreme', chance: 40 },
    { key: 'supreme', name: 'Cực phẩm', boost: 25, next: 'immortal', chance: 20 },
    { key: 'immortal', name: 'Hộ Đạo Tiên Phù', boost: 25, next: null, chance: 0 }
];
export const talismanName = (key) => {
    const item = talismans.find((entry) => entry.key === key);
    return item ? (key === 'immortal' ? item.name : 'Phá Cảnh Phù · ' + item.name) : rewardLabels[key] ?? key;
};
export const rewardLabels = { qi1: '+1 tu vi', qi2: '+2 tu vi', basic: 'Phá Cảnh Phù sơ cấp', keepsake: 'Tín vật Minh Anh', heart: 'Hộ Tâm Phù', peace: 'An Tâm Phù' };
