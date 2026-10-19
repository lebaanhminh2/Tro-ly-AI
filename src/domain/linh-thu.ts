/** Shared, versioned rules. Reward balances are integers; training uses tenths. */
export const LINH_THU_RULE_VERSION = 1;
export type BeastRank = 'R' | 'SR' | 'SSR' | 'UR';
export type BeastForm = 1 | 2 | 3 | 4;
export type HabitTrainingStatus = 'achieved' | 'missed' | 'neutral';
export type TrainingPoints = { earned: number; gray: number };

function natural(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw Error(code);
}

/** Consume assessed outcomes, never task counts or raw habit log values. */
export function habitTrainingPoints(outcomes: readonly HabitTrainingStatus[]): TrainingPoints {
  let count = 0;
  let achieved = 0;
  for (const status of outcomes) {
    if (!['achieved', 'missed', 'neutral'].includes(status))
      throw Error('INVALID_BEAST_HABIT_OUTCOME');
    if (status === 'neutral') continue;
    count++;
    if (status === 'achieved') achieved++;
  }
  if (!count) return { earned: 0, gray: 0 };
  const budget = 10 + 2 * Math.min(count - 1, 3);
  const earned = Math.round((budget * achieved) / count);
  return { earned, gray: budget - earned };
}

export function beastPurity(points: TrainingPoints, capacity: number) {
  natural(points.earned, 'INVALID_BEAST_POINTS');
  natural(points.gray, 'INVALID_BEAST_POINTS');
  natural(capacity, 'INVALID_BEAST_CAPACITY');
  const occupied = points.earned + points.gray;
  if (!Number.isSafeInteger(occupied) || capacity === 0 || occupied > capacity)
    throw Error('INVALID_BEAST_CAPACITY');
  const completed = occupied === capacity;
  return {
    completed,
    // Ratio is for display only. Unlock checks use exact integers below.
    ratio: occupied ? points.earned / occupied : null,
    awakened: completed && points.gray <= Math.floor(capacity / 20),
    perfect: completed && points.gray === 0,
  };
}

/** Amounts stay whole; only the chance scales with the attained form. */
export function talentChance(baseChance: number, form: BeastForm, slot: 1 | 2): number {
  if (
    !Number.isFinite(baseChance) ||
    baseChance < 0 ||
    baseChance > 1 ||
    ![1, 2, 3, 4].includes(form) ||
    ![1, 2].includes(slot)
  )
    throw Error('INVALID_BEAST_TALENT');
  return baseChance * (slot === 1 ? form / 4 : form < 3 ? 0 : form === 3 ? 0.5 : 1);
}

export const BEAST_SUMMON_COST = 1;
export const BEAST_EXCHANGE_COST = 20;
export type BeastPity = { ssr: number; ur: number };
export type RankTable = Readonly<Record<BeastRank, number>>;
export const BEAST_BASE_RATES: RankTable = Object.freeze({
  R: 0.7,
  SR: 0.25,
  SSR: 0.045,
  UR: 0.005,
});
export const BEAST_SSR_GUARANTEE_RATES: RankTable = Object.freeze({
  R: 0,
  SR: 0,
  SSR: 0.9,
  UR: 0.1,
});
export const BEAST_UR_GUARANTEE_RATES: RankTable = Object.freeze({ R: 0, SR: 0, SSR: 0, UR: 1 });

function validPity(pity: BeastPity): void {
  natural(pity.ssr, 'INVALID_BEAST_PITY');
  natural(pity.ur, 'INVALID_BEAST_PITY');
  if (pity.ssr > 19 || pity.ur > 79 || pity.ssr > pity.ur) throw Error('INVALID_BEAST_PITY');
}

export function summonRankTable(pity: BeastPity): RankTable {
  validPity(pity);
  return pity.ur >= 79
    ? BEAST_UR_GUARANTEE_RATES
    : pity.ssr >= 19
      ? BEAST_SSR_GUARANTEE_RATES
      : BEAST_BASE_RATES;
}

export function advanceSummonPity(pity: BeastPity, rank: BeastRank): BeastPity {
  validPity(pity);
  if (!['R', 'SR', 'SSR', 'UR'].includes(rank)) throw Error('INVALID_BEAST_RANK');
  if (summonRankTable(pity)[rank] === 0) throw Error('INVALID_BEAST_GUARANTEE_RESULT');
  return {
    ssr: rank === 'SSR' || rank === 'UR' ? 0 : pity.ssr + 1,
    ur: rank === 'UR' ? 0 : pity.ur + 1,
  };
}

/** Randomness is supplied by the server adapter; client input never supplies it. */
export function randomUnit(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('INVALID_BEAST_RANDOM');
  return value;
}

export function rollSummonRank(pity: BeastPity, random: () => number): BeastRank {
  const table = summonRankTable(pity);
  const value = randomUnit(random);
  // Integer basis points avoid gaps at cumulative decimal boundaries.
  let boundary = 0;
  for (const rank of ['R', 'SR', 'SSR', 'UR'] as const) {
    boundary += Math.round(table[rank] * 10000);
    if (value < boundary / 10000) return rank;
  }
  return 'UR';
}

export const TOWER_CARD_COUNTS = Object.freeze([4, 4, 3, 2] as const);
export type TowerReward = Readonly<{ tickets: number; summonTickets: number }>;
export const TOWER_REWARDS: readonly TowerReward[] = Object.freeze([
  Object.freeze({ tickets: 0, summonTickets: 0 }),
  Object.freeze({ tickets: 2, summonTickets: 0 }),
  Object.freeze({ tickets: 3, summonTickets: 0 }),
  Object.freeze({ tickets: 0, summonTickets: 1 }),
  Object.freeze({ tickets: 0, summonTickets: 2 }),
]);

export function towerReward(clearedFloor: number): TowerReward {
  if (!Number.isInteger(clearedFloor) || clearedFloor < 0 || clearedFloor > 4)
    throw Error('INVALID_TOWER_FLOOR');
  return TOWER_REWARDS[clearedFloor]!;
}
