// Disposable demo behavior; never used to commit real rewards.
import { breakthroughPenalties, checkinProgress, dailyRewardLabel, loot, realms, talismans } from '../models/cultivation.js';
export function demoCheckin(c, now = Date.now()) {
    const progress = checkinProgress(c, now);
    if (!progress.canClaim)
        return null;
    const reward = progress.rewards[progress.count];
    c.checkin = { cycleStartDay: progress.cycleStartDay ?? progress.calendarDay, count: reward.day, lastDay: progress.calendarDay };
    c.qi += reward.qi;
    c.totalEarned += reward.qi;
    c.tickets += reward.tickets;
    for (const [item, amount] of Object.entries(reward.items))
        c.inventory[item] += amount;
    c.log.unshift('Điểm danh ngày ' + reward.day + ': ' + dailyRewardLabel(reward));
    return reward;
}
export function demoDraw(c, random = Math.random) {
    if (c.tickets < 1)
        return null;
    const roll = random() * 100;
    let threshold = 0;
    const reward = loot.find(item => {
        threshold += item.weight;
        return roll < threshold;
    });
    if (!reward)
        return null;
    c.tickets--;
    if (reward.key.startsWith('qi')) {
        const amount = reward.key === 'qi1' ? 1 : 2;
        c.qi += amount;
        c.totalEarned += amount;
    }
    else
        c.inventory[reward.key]++;
    c.log.unshift('Quay thưởng: ' + reward.label);
    return reward;
}
export function demoCompleteTask(c, code) {
    if (c.rewardedTasks.includes(code))
        return false;
    c.rewardedTasks.push(code);
    c.tickets++;
    c.log.unshift('Hoàn thành #' + code + ': +1 vé');
    return true;
}
export function demoFuse(c, key, random = Math.random) {
    const rule = talismans.find(t => t.key === key);
    if (!rule?.next || c.inventory[key] < 3)
        return null;
    const success = random() * 100 < rule.chance;
    c.inventory[key] -= success ? 3 : 1;
    if (success)
        c.inventory[rule.next]++;
    c.log.unshift('Ghép ' + rule.name + ': ' + (success ? 'thành công' : 'chưa thành, trả lại 2 lá'));
    return success;
}
export function demoBreakthrough(c, day, key = null, now = Date.now(), random = Math.random) {
    const target = realms[c.rank + 1], charm = talismans.find(t => t.key === key);
    if (!target || c.attemptDay === day || c.qi < target.qi || c.streak < target.days)
        return null;
    if (key && (!charm || c.inventory[key] < 1))
        return null;
    const chance = Math.min(100, [70, 85, 100][Math.min(c.failures, 2)] + (charm?.boost ?? 0));
    c.attemptDay = day;
    if (charm)
        c.inventory[charm.key]--;
    const success = random() * 100 < chance;
    if (success) {
        c.rank++;
        c.highestRank = Math.max(c.highestRank, c.rank);
        c.failures = 0;
        c.protectedUntil = now + 72 * 3600000;
    }
    const penalty = success ? 0 : Math.min(c.qi, breakthroughPenalties[c.rank]);
    if (!success) {
        c.failures++;
        c.qi -= penalty;
    }
    c.log.unshift(success ? 'Đột phá ' + target.name + ' · bảo vệ 72 giờ' : 'Đột phá chưa thành · −' + penalty + ' tu vi');
    return { success, chance, penalty };
}
