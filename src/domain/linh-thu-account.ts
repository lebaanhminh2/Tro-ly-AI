import { BEAST_CATALOG, rollBeast } from './linh-thu-catalog.ts';
import { initialBeastAlchemy, type BeastAlchemy, type BeastAttempt } from './linh-thu-training.ts';
import { advanceSummonPity, type BeastPity } from './linh-thu.ts';

export type BeastAccount = {
  ruleVersion: 1;
  summonTickets: number;
  pity: BeastPity;
  alchemy: BeastAlchemy;
};

export type OwnedBeast = {
  id: string;
  speciesId: string;
  attemptId: string;
  acquiredAt: number;
  attempt: BeastAttempt;
  counters: Record<string, number>;
};

export function initialBeastAccount(): BeastAccount {
  return {
    ruleVersion: 1,
    summonTickets: 0,
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
