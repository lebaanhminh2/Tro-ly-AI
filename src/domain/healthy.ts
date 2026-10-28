// Pure rules. Persistence must commit the resulting state with an idempotency
// receipt; neither the model nor the browser chooses rewards or timestamps.
export const DAY_MS = 86400000;
export const REALMS = [
  { name: 'Phàm Nhân', qi: 0, days: 0, chance: 0 },
  { name: 'Luyện Khí', qi: 15, days: 2, chance: 65 },
  { name: 'Trúc Cơ', qi: 50, days: 3, chance: 60 },
  { name: 'Kết Đan', qi: 120, days: 5, chance: 55 },
  { name: 'Nguyên Anh', qi: 250, days: 7, chance: 50 },
  { name: 'Hóa Thần', qi: 500, days: 10, chance: 45 },
  { name: 'Luyện Hư', qi: 800, days: 14, chance: 40 },
  { name: 'Hợp Thể', qi: 1300, days: 18, chance: 35 },
  { name: 'Đại Thừa', qi: 2000, days: 23, chance: 30 },
  { name: 'Độ Kiếp', qi: 3000, days: 28, chance: 25 },
  { name: 'Chân Tiên', qi: 4000, days: 36, chance: 20 },
  { name: 'Kim Tiên', qi: 5000, days: 45, chance: 15 },
  { name: 'Thái Ất', qi: 6200, days: 49, chance: 12 },
  { name: 'Đại La', qi: 7400, days: 53, chance: 9 },
  { name: 'Hỗn Nguyên', qi: 8600, days: 57, chance: 7 },
  { name: 'Vô Cực', qi: 10000, days: 60, chance: 5 },
] as const;
export const LOOT = [
  { key: 'qi1', weight: 40 },
  { key: 'qi2', weight: 15 },
  { key: 'basic', weight: 35 },
  { key: 'keepsake', weight: 8 },
  { key: 'heart', weight: 0.5 },
  { key: 'peace', weight: 1 },
  { key: 'summonTicket', weight: 0.5 },
] as const;
export const CHARMS = {
  basic: { boost: 5, next: 'middle', chance: 80 },
  middle: { boost: 10, next: 'high', chance: 60 },
  high: { boost: 20, next: 'supreme', chance: 40 },
  supreme: { boost: 25, next: 'immortal', chance: 20 },
  immortal: { boost: 25, next: null, chance: 0 },
} as const;
export type Charm = keyof typeof CHARMS;
export type Item = Charm | 'heart' | 'peace' | 'keepsake';
export const BREAKTHROUGH_PENALTIES = [
  3, 5, 8, 12, 18, 25, 35, 50, 70, 95, 125, 160, 200, 250, 300,
] as const;
export const CHECKIN_CYCLE_DAYS = 32;
export type DailyCheckinState = { cycleStartDay: number; count: number; lastDay: number };
export type DailyReward = {
  day: number;
  qi: number;
  tickets: number;
  items: Partial<Record<Item, number>>;
  milestone: boolean;
};
// A published, deterministic calendar. Clients display it but never choose rewards.
export const DAILY_REWARDS: DailyReward[] = [
  { qi: 1 },
  { tickets: 1 },
  { qi: 2 },
  { tickets: 1 },
  { qi: 2 },
  { tickets: 1 },
  { tickets: 2, items: { basic: 3 } },
  { qi: 2 },
  { tickets: 1 },
  { qi: 3 },
  { tickets: 1 },
  { qi: 2 },
  { tickets: 1 },
  { items: { middle: 3 } },
  { qi: 2 },
  { tickets: 1 },
  { qi: 3 },
  { tickets: 1 },
  { qi: 2 },
  { tickets: 1 },
  { items: { high: 3 } },
  { qi: 3 },
  { tickets: 1 },
  { qi: 2 },
  { tickets: 1 },
  { qi: 3 },
  { tickets: 1 },
  { qi: 3 },
  { tickets: 2 },
  { qi: 30, tickets: 5, items: { supreme: 1 } },
].map((reward: Partial<DailyReward>, index) => ({
  day: index + 1,
  qi: 0,
  tickets: 0,
  items: {},
  ...reward,
  milestone: [7, 14, 21, 30].includes(index + 1),
}));
export type HealthyState = {
  qi: number;
  earned: number;
  rank: number;
  highestRank: number;
  streak: number;
  bestStreak: number;
  protectedUntil: number;
  attemptDay: number | null;
  failures: number;
  immortalPity?: boolean;
  tickets: number;
  inventory: Record<Item, number>;
  heartDay: number | null;
  peaceDay: number | null;
  lastScoredDay: number | null;
  inactiveDays: number;
  suspended: boolean;
  checkin?: DailyCheckinState | null;
};
export function initialHealthy(): HealthyState {
  return {
    qi: 0,
    earned: 0,
    rank: 0,
    highestRank: 0,
    streak: 0,
    bestStreak: 0,
    protectedUntil: 0,
    attemptDay: null,
    failures: 0,
    immortalPity: false,
    tickets: 0,
    inventory: {
      basic: 0,
      middle: 0,
      high: 0,
      supreme: 0,
      immortal: 0,
      heart: 0,
      peace: 0,
      keepsake: 0,
    },
    heartDay: null,
    peaceDay: null,
    lastScoredDay: null,
    inactiveDays: 0,
    suspended: false,
    checkin: null,
  };
}
function copy(s: HealthyState) {
  return { ...s, inventory: { ...s.inventory }, checkin: s.checkin ? { ...s.checkin } : null };
}
function roll(value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('INVALID_RANDOM_SAMPLE');
  return value * 100;
}
export function minutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw Error('INVALID_CLOCK');
  const [h, m] = value.split(':').map(Number);
  return h! * 60 + m!;
}
export function operatingDay(now: number, startMinutes: number) {
  if (
    !Number.isFinite(now) ||
    !Number.isInteger(startMinutes) ||
    startMinutes < 0 ||
    startMinutes >= 1440
  )
    throw Error('INVALID_DAY');
  return Math.floor((now + 7 * 3600000 - startMinutes * 60000) / DAY_MS);
}
export function dailyCheckinProgress(state: HealthyState, now: number) {
  const calendarDay = operatingDay(now, 0),
    saved = state.checkin;
  const expired = !!saved && calendarDay >= saved.cycleStartDay + CHECKIN_CYCLE_DAYS;
  const current = expired ? null : saved,
    count = current?.count ?? 0;
  const daysLeft = current
    ? Math.max(0, current.cycleStartDay + CHECKIN_CYCLE_DAYS - calendarDay)
    : CHECKIN_CYCLE_DAYS;
  const claimedToday = current?.lastDay === calendarDay;
  const elapsed = current ? Math.max(0, calendarDay - current.cycleStartDay) : 0;
  return {
    calendarDay,
    cycleStartDay: current?.cycleStartDay ?? null,
    count,
    claimedToday,
    expired,
    canClaim:
      count < DAILY_REWARDS.length && !claimedToday && (!current || calendarDay >= current.lastDay),
    daysLeft,
    missedDays: Math.max(0, elapsed - (count - (claimedToday ? 1 : 0))),
    canComplete: count + daysLeft - (claimedToday ? 1 : 0) >= DAILY_REWARDS.length,
    endsAt: current ? (current.cycleStartDay + CHECKIN_CYCLE_DAYS) * DAY_MS - 7 * 3600000 : null,
    rewardDay: count < DAILY_REWARDS.length ? count + 1 : null,
    rewards: DAILY_REWARDS,
  };
}
export function claimDailyReward(state: HealthyState, now: number) {
  const progress = dailyCheckinProgress(state, now);
  if (progress.claimedToday) throw Error('ALREADY_CHECKED_IN');
  if (progress.count >= DAILY_REWARDS.length) throw Error('CHECKIN_COMPLETE');
  if (!progress.canClaim) throw Error('INVALID_CHECKIN_DAY');
  const reward = DAILY_REWARDS[progress.count]!,
    next = copy(state);
  next.checkin = {
    cycleStartDay: progress.cycleStartDay ?? progress.calendarDay,
    count: reward.day,
    lastDay: progress.calendarDay,
  };
  next.qi += reward.qi;
  next.earned += reward.qi;
  next.tickets += reward.tickets;
  for (const [item, amount] of Object.entries(reward.items)) next.inventory[item as Item] += amount;
  return {
    state: next,
    reward,
    calendarDay: progress.calendarDay,
    cycleStartDay: next.checkin.cycleStartDay,
  };
}
export function dayWindow(day: number, startMinutes: number, sleepMinutes: number) {
  if (!Number.isInteger(day)) throw Error('INVALID_DAY');
  operatingDay(0, startMinutes);
  operatingDay(0, sleepMinutes);
  if (startMinutes === sleepMinutes) throw Error('EMPTY_ACTIVE_WINDOW');
  const start = day * DAY_MS - 7 * 3600000 + startMinutes * 60000;
  const target = start + ((sleepMinutes - startMinutes + 1440) % 1440) * 60000;
  return { start, target, end: start + DAY_MS };
}
export type SleepAssessment = {
  day: number;
  target: number;
  end: number;
  reportedAt: number | null;
  chatActive: boolean;
  assessedAt: number;
  /** Immutable original-day skill policy, supplied only by the server. */
  rewardMultiplier?: 1 | 3;
};
export function assessSleep(state: HealthyState, input: SleepAssessment) {
  if (
    !Number.isInteger(input.day) ||
    input.target >= input.end ||
    !Number.isFinite(input.target) ||
    !Number.isFinite(input.end) ||
    !Number.isFinite(input.assessedAt)
  )
    throw Error('INVALID_ASSESSMENT');
  if (input.reportedAt === null && input.assessedAt < input.end) throw Error('DAY_NOT_ENDED');
  if (
    input.reportedAt !== null &&
    (!Number.isFinite(input.reportedAt) ||
      input.reportedAt >= input.end ||
      input.reportedAt > input.assessedAt ||
      input.reportedAt < input.end - DAY_MS)
  )
    throw Error('INVALID_SLEEP_REPORT');
  const next = copy(state);
  if (state.suspended || (state.lastScoredDay !== null && input.day <= state.lastScoredDay))
    return { state: next, applied: false, delta: 0, demoted: false };
  const onTime = input.reportedAt !== null && input.reportedAt <= input.target;
  const multiplier = input.rewardMultiplier === 3 ? 3 : 1;
  const guarded = next.heartDay === input.day;
  if (onTime) {
    next.qi += 5 * multiplier;
    next.earned += 5 * multiplier;
    next.streak++;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
  } else {
    if (!guarded) next.streak = 0;
    if (next.peaceDay !== input.day) next.qi = Math.max(0, next.qi - 20 * multiplier);
  }
  let demoted = false;
  // Only a real penalty checks rank. Protection expiring is never a penalty.
  if (
    !onTime &&
    next.peaceDay !== input.day &&
    next.rank > 0 &&
    (input.reportedAt ?? input.end) >= next.protectedUntil &&
    next.qi < REALMS[next.rank]!.qi
  ) {
    next.rank--;
    next.failures = 0;
    next.immortalPity = false;
    demoted = true;
  }
  next.lastScoredDay = input.day;
  next.heartDay = null;
  next.peaceDay = null;
  next.inactiveDays = input.chatActive || input.reportedAt !== null ? 0 : next.inactiveDays + 1;
  if (next.inactiveDays >= 3) next.suspended = true;
  return { state: next, applied: true, delta: next.qi - state.qi, demoted, onTime };
}
// Reverse only sleep's effects; tickets, inventory and unrelated rewards survive.
export function undoSleepAssessment(
  state: HealthyState,
  before: HealthyState,
  after: HealthyState,
) {
  if (state.attemptDay !== after.attemptDay) throw Error('SLEEP_UNDO_LOCKED');
  const fields = [
    'rank',
    'failures',
    'immortalPity',
    'streak',
    'bestStreak',
    'heartDay',
    'peaceDay',
    'lastScoredDay',
    'inactiveDays',
    'suspended',
  ] as const;
  for (const key of fields) if (state[key] !== after[key]) throw Error('SLEEP_UNDO_LOCKED');
  const qi = state.qi - (after.qi - before.qi),
    earned = state.earned - (after.earned - before.earned);
  if (qi < 0 || earned < 0) throw Error('SLEEP_UNDO_LOCKED');
  return {
    ...copy(state),
    qi,
    earned,
    rank: before.rank,
    failures: before.failures,
    immortalPity: before.immortalPity ?? false,
    streak: before.streak,
    bestStreak: before.bestStreak,
    heartDay: before.heartDay,
    peaceDay: before.peaceDay,
    lastScoredDay: before.lastScoredDay,
    inactiveDays: before.inactiveDays,
    suspended: before.suspended,
  };
}
// On resumption skip absent closed days, never back-charge them.
export function resumeHealthy(state: HealthyState, currentDay: number) {
  const next = copy(state);
  if (next.suspended) {
    next.lastScoredDay = currentDay - 1;
    next.streak = 0;
    next.heartDay = null;
    next.peaceDay = null;
  }
  next.suspended = false;
  next.inactiveDays = 0;
  return next;
}
export function drawReward(state: HealthyState, random: number) {
  if (state.suspended || state.tickets < 1) throw Error('DRAW_UNAVAILABLE');
  let threshold = 0;
  const value = roll(random);
  const reward = LOOT.find((item) => {
    threshold += item.weight;
    return value < threshold;
  })!;
  const next = copy(state);
  next.tickets--;
  if (reward.key === 'qi1' || reward.key === 'qi2') {
    const amount = reward.key === 'qi1' ? 1 : 2;
    next.qi += amount;
    next.earned += amount;
  } else if (reward.key !== 'summonTicket') next.inventory[reward.key]++;
  return { state: next, reward: reward.key, summonTickets: reward.key === 'summonTicket' ? 1 : 0 };
}
export function drawRewards(state: HealthyState, count: 1 | 10, random: () => number) {
  if (count !== 1 && count !== 10) throw Error('INVALID_DRAW_COUNT');
  if (state.suspended) throw Error('ACCOUNT_SUSPENDED');
  if (state.tickets < count) throw Error('NO_TICKETS');
  let next = state;
  const rewards: Array<(typeof LOOT)[number]['key']> = [];
  let summonTickets = 0;
  for (let i = 0; i < count; i++) {
    const outcome = drawReward(next, random());
    next = outcome.state;
    rewards.push(outcome.reward);
    summonTickets += outcome.summonTickets;
  }
  return { state: next, rewards, summonTickets };
}
export function useProtection(state: HealthyState, item: 'heart' | 'peace', day: number) {
  if (
    state.suspended ||
    state.inventory[item] < 1 ||
    (state.lastScoredDay !== null && day <= state.lastScoredDay)
  )
    throw Error('ITEM_UNAVAILABLE');
  const next = copy(state),
    key = item === 'heart' ? 'heartDay' : 'peaceDay';
  if (next[key] === day) throw Error('ALREADY_PROTECTED');
  next.inventory[item]--;
  next[key] = day;
  return next;
}
export function canFuseCharm(state: HealthyState, item: Charm, count = 1) {
  return (
    Number.isInteger(count) &&
    count > 0 &&
    !state.suspended &&
    !!CHARMS[item]?.next &&
    state.inventory[item] >= 3 * count &&
    (item !== 'supreme' || state.inventory.keepsake >= 3 * count)
  );
}
export function fuseCharm(state: HealthyState, item: Charm, random: number) {
  const rule = CHARMS[item];
  if (!canFuseCharm(state, item) || !rule.next) throw Error('FUSION_UNAVAILABLE');
  const success = roll(random) < rule.chance,
    next = copy(state);
  next.inventory[item] -= 3;
  if (item === 'supreme') next.inventory.keepsake -= 3;
  if (success) next.inventory[rule.next] = (next.inventory[rule.next] ?? 0) + 1;
  return { state: next, success };
}
export function breakthrough(
  state: HealthyState,
  day: number,
  now: number,
  item: Charm | null,
  random: number,
  modifier?: { chancePoints: number; preventLoss: boolean; penaltyMultiplier?: 1 | 3 },
) {
  const target = REALMS[state.rank + 1],
    charm = item ? CHARMS[item] : null;
  if (
    state.suspended ||
    !target ||
    state.attemptDay === day ||
    state.qi < target.qi ||
    state.streak < target.days ||
    (item && state.inventory[item] < 1)
  )
    throw Error('BREAKTHROUGH_UNAVAILABLE');
  const chance = Math.min(
    100,
    target.chance +
      Math.max(state.immortalPity ? 5 : 0, 5 * Math.min(Math.max(state.failures - 1, 0), 3)) +
      (charm?.boost ?? 0) +
      (modifier?.chancePoints ?? 0),
  );
  const success = roll(random) < chance,
    next = copy(state);
  next.attemptDay = day;
  if (item) next.inventory[item]--;
  if (item === 'immortal') {
    next.inventory.heart++;
    next.inventory.peace++;
  }
  if (success) {
    next.rank++;
    next.highestRank = Math.max(next.highestRank, next.rank);
    next.failures = 0;
    next.immortalPity = false;
    next.protectedUntil = now + 3 * DAY_MS;
  } else {
    next.failures++;
    if (item === 'immortal') next.immortalPity = true;
    if (!modifier?.preventLoss)
      next.qi = Math.max(
        0,
        next.qi -
          (item === 'immortal' ? 1 : BREAKTHROUGH_PENALTIES[state.rank]!) *
            (modifier?.penaltyMultiplier === 3 ? 3 : 1),
      );
  }
  return { state: next, success, chance, penalty: state.qi - next.qi };
}
