// Disposable demo behavior; never used to commit real rewards.
import {
  breakthroughPenalties,
  breakthroughPity,
  checkinProgress,
  dailyRewardLabel,
  loot,
  realms,
  talismans,
} from '../models/cultivation.js';
export function demoCheckin(c, now = Date.now()) {
  const progress = checkinProgress(c, now);
  if (!progress.canClaim) return null;
  const reward = progress.rewards[progress.count];
  c.checkin = {
    cycleStartDay: progress.cycleStartDay ?? progress.calendarDay,
    count: reward.day,
    lastDay: progress.calendarDay,
  };
  c.qi += reward.qi;
  c.totalEarned += reward.qi;
  c.tickets += reward.tickets;
  for (const [item, amount] of Object.entries(reward.items)) c.inventory[item] += amount;
  c.log.unshift('Điểm danh ngày ' + reward.day + ': ' + dailyRewardLabel(reward));
  return reward;
}
export function demoDraw(c, random = Math.random) {
  if (c.tickets < 1) return null;
  const roll = random() * 100;
  let threshold = 0;
  const reward = loot.find((item) => {
    threshold += item.weight;
    return roll < threshold;
  });
  if (!reward) return null;
  c.tickets--;
  if (reward.key.startsWith('qi')) {
    const amount = reward.key === 'qi1' ? 1 : 2;
    c.qi += amount;
    c.totalEarned += amount;
  } else if (reward.key === 'summonTicket') c.summonTickets = (c.summonTickets ?? 0) + 1;
  else c.inventory[reward.key]++;
  c.log.unshift('Quay thưởng: ' + reward.label);
  return reward;
}
export function demoDrawBatch(c, count = 1, random = Math.random) {
  if (![1, 10].includes(count) || c.suspended || c.tickets < count) return null;
  const rewards = [];
  for (let i = 0; i < count; i++) rewards.push(demoDraw(c, random).key);
  return { count, rewards };
}
export function demoCompleteTask(c, code) {
  if (c.rewardedTasks.includes(code)) return false;
  c.rewardedTasks.push(code);
  c.tickets++;
  c.log.unshift('Hoàn thành #' + code + ': +1 vé');
  return true;
}
export function demoFuse(c, key, random = Math.random) {
  const rule = talismans.find((t) => t.key === key);
  if (
    c.suspended ||
    !rule?.next ||
    c.inventory[key] < 3 ||
    (key === 'supreme' && c.inventory.keepsake < 3)
  )
    return null;
  const success = random() * 100 < rule.chance;
  c.inventory[key] -= 3;
  if (key === 'supreme') c.inventory.keepsake -= 3;
  if (success) c.inventory[rule.next] = (c.inventory[rule.next] ?? 0) + 1;
  c.log.unshift(
    'Ghép ' +
      rule.name +
      ': ' +
      (success
        ? 'thành công'
        : key === 'supreme'
          ? 'chưa thành, mất 3 phù và 3 tín vật'
          : 'chưa thành, mất 3 phù'),
  );
  return success;
}
export function demoFuseBatch(c, key, count, random = Math.random) {
  const rule = talismans.find((item) => item.key === key);
  if (
    ![1, 10, 100].includes(count) ||
    c.suspended ||
    !rule?.next ||
    c.inventory[key] < 3 * count ||
    (key === 'supreme' && c.inventory.keepsake < 3 * count)
  )
    return null;
  const before = { ...c.inventory };
  let attempted = 0,
    successes = 0;
  while (attempted < count) {
    const success = demoFuse(c, key, random);
    attempted++;
    if (success) successes++;
  }
  if (!attempted) return null;
  const output = talismans.find((item) => item.key === key).next;
  const consumed = { [key]: before[key] - c.inventory[key] };
  if (key === 'supreme') consumed.keepsake = before.keepsake - c.inventory.keepsake;
  return {
    requested: count,
    count: attempted,
    successes,
    failures: attempted - successes,
    success: successes > 0,
    output,
    received: (c.inventory[output] ?? 0) - (before[output] ?? 0),
    consumed,
    stoppedEarly: attempted < count,
  };
}
export function demoBreakthrough(c, day, key = null, now = Date.now(), random = Math.random) {
  const target = realms[c.rank + 1],
    charm = talismans.find((t) => t.key === key);
  if (!target || c.attemptDay === day || c.qi < target.qi || c.streak < target.days) return null;
  if (key && (!charm || c.inventory[key] < 1)) return null;
  const chance = Math.min(100, target.chance + breakthroughPity(c) + (charm?.boost ?? 0));
  c.attemptDay = day;
  if (charm) c.inventory[charm.key]--;
  if (key === 'immortal') {
    c.inventory.heart++;
    c.inventory.peace++;
  }
  const success = random() * 100 < chance;
  if (success) {
    c.rank++;
    c.highestRank = Math.max(c.highestRank, c.rank);
    c.failures = 0;
    c.immortalPity = false;
    c.protectedUntil = now + 72 * 3600000;
  }
  const penalty = success
    ? 0
    : Math.min(c.qi, key === 'immortal' ? 1 : breakthroughPenalties[c.rank]);
  if (!success) {
    c.failures++;
    if (key === 'immortal') c.immortalPity = true;
    c.qi -= penalty;
  }
  c.log.unshift(
    success
      ? 'Đột phá ' + target.name + ' · bảo vệ 72 giờ'
      : 'Đột phá chưa thành · −' + penalty + ' tu vi',
  );
  return { success, chance, penalty };
}
