import { BEAST_CATALOG, rollBeast } from './linh-thu-catalog.ts';
import { initialBeastAlchemy, type BeastAlchemy, type BeastAttempt } from './linh-thu-training.ts';
import { advanceSummonPity, type BeastPity } from './linh-thu.ts';

export type BeastAccount = {
  ruleVersion: 1;
  summonTickets: number;
  /** Unspent sacrifice points; absent on accounts written before this feature. */
  sacrificePoints?: number;
  pity: BeastPity;
  alchemy: BeastAlchemy;
};

export type OwnedBeast = {
  id: string;
  speciesId: string;
  attemptId: string;
  acquiredAt: number;
  /** Stable public number within this owner's species, populated by inventory reads. */
  individualNumber?: number;
  isProtected?: boolean;
  sacrificeBlockedReason?: string | null;
  attempt: BeastAttempt;
  counters: Record<string, number>;
};

export function initialBeastAccount(): BeastAccount {
  return {
    ruleVersion: 1,
    summonTickets: 0,
    sacrificePoints: 0,
    pity: { ssr: 0, ur: 0 },
    alchemy: initialBeastAlchemy(),
  };
}

export function validBeastAccount(state: BeastAccount): void {
  if (
    state.ruleVersion !== 1 ||
    !Number.isSafeInteger(state.summonTickets) ||
    state.summonTickets < 0
  )
    throw Error('INVALID_BEAST_ACCOUNT');
  const sacrificePoints = state.sacrificePoints ?? 0;
  if (!Number.isSafeInteger(sacrificePoints) || sacrificePoints < 0 || sacrificePoints >= 10)
    throw Error('INVALID_BEAST_ACCOUNT');
  // Validate pity without drawing. Guaranteed outcomes preserve valid counters.
  advanceSummonPity(state.pity, 'UR');
  const { days, failures, inventory } = state.alchemy;
  if (
    ![days, failures, inventory].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    days > 30 ||
    failures > 2
  )
    throw Error('INVALID_BEAST_ALCHEMY');
}

export const BEAST_SACRIFICE_COST = 10;
export const BEAST_SACRIFICE_LIMIT = 24;
export const BEAST_SACRIFICE_POINTS = Object.freeze({ R: 1, SR: 1, SSR: 2, UR: 3 });

export function sacrificeBeastTickets(state: BeastAccount, beasts: readonly OwnedBeast[]) {
  validBeastAccount(state);
  if (
    !beasts.length ||
    beasts.length > BEAST_SACRIFICE_LIMIT ||
    new Set(beasts.map((b) => b.id)).size !== beasts.length
  )
    throw Error('INVALID_BEAST_SACRIFICE');
  let points = 0;
  for (const beast of beasts) {
    if (beast.isProtected) throw Error('BEAST_PROTECTED');
    if (beast.sacrificeBlockedReason) throw Error('BEAST_IN_USE');
    const species = BEAST_CATALOG.find((entry) => entry.id === beast.speciesId);
    if (!species) throw Error('INVALID_BEAST_SPECIES');
    points += BEAST_SACRIFICE_POINTS[species.rank];
  }
  const total = (state.sacrificePoints ?? 0) + points;
  const tickets = Math.floor(total / BEAST_SACRIFICE_COST);
  if (!tickets) throw Error('BEAST_NOT_ENOUGH_SACRIFICE_POINTS');
  const next = {
    ...state,
    summonTickets: state.summonTickets + tickets,
    sacrificePoints: total % BEAST_SACRIFICE_COST,
  };
  validBeastAccount(next);
  return { state: next, points, tickets, remainder: next.sacrificePoints };
}

export function exchangeBeastTickets(state: BeastAccount, regularTickets: number, count: number) {
  validBeastAccount(state);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 1000 ||
    !Number.isSafeInteger(regularTickets) ||
    regularTickets < 0
  )
    throw Error('INVALID_BEAST_EXCHANGE');
  const cost = count * 20;
  if (regularTickets < cost) throw Error('NO_TICKETS');
  const next = { ...state, summonTickets: state.summonTickets + count };
  validBeastAccount(next);
  return { state: next, regularTickets: regularTickets - cost, cost, count };
}

export function summonBeasts(state: BeastAccount, count: 1 | 10, random: () => number) {
  validBeastAccount(state);
  if (count !== 1 && count !== 10) throw Error('INVALID_BEAST_SUMMON_COUNT');
  if (state.summonTickets < count) throw Error('BEAST_NO_SUMMON_TICKETS');
  let pity = { ...state.pity };
  const speciesIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const entry = rollBeast(pity, random);
    speciesIds.push(entry.id);
    pity = advanceSummonPity(pity, entry.rank);
  }
  return {
    state: { ...state, summonTickets: state.summonTickets - count, pity },
    speciesIds,
    ranks: speciesIds.map((id) => BEAST_CATALOG.find((entry) => entry.id === id)!.rank),
  };
}
