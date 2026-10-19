import { beastSpecies } from './linh-thu-catalog.ts';
import {
  beastPurity,
  habitTrainingPoints,
  randomUnit,
  type BeastForm,
  type BeastRank,
  type HabitTrainingStatus,
  type TrainingPoints,
} from './linh-thu.ts';

/** Approved 19/10/2026. Thresholds and capacity are stored in tenths. */
export const BEAST_TRAINING: Readonly<
  Record<
    BeastRank,
    Readonly<{
      thresholds: readonly [number, number, number];
      capacity: number;
    }>
  >
> = Object.freeze({
  R: Object.freeze({ thresholds: Object.freeze([100, 250, 400] as const), capacity: 600 }),
  SR: Object.freeze({ thresholds: Object.freeze([150, 350, 550] as const), capacity: 800 }),
  SSR: Object.freeze({ thresholds: Object.freeze([200, 500, 800] as const), capacity: 1200 }),
  UR: Object.freeze({ thresholds: Object.freeze([300, 700, 1100] as const), capacity: 1600 }),
});

export type BeastAttempt = TrainingPoints & {
  speciesId: string;
  ruleVersion: 1;
  status: 'ready' | 'training' | 'sealed' | 'completed';
};

export function newBeastAttempt(speciesId: string): BeastAttempt {
  beastSpecies(speciesId);
  return { speciesId, ruleVersion: 1, status: 'ready', earned: 0, gray: 0 };
}

export function trainingView(attempt: BeastAttempt) {
  const species = beastSpecies(attempt.speciesId);
  const rule = BEAST_TRAINING[species.rank];
  const purity = beastPurity(attempt, rule.capacity);
  const occupied = attempt.earned + attempt.gray;
  const form = (1 +
    rule.thresholds.filter((threshold) => occupied >= threshold).length) as BeastForm;
  return {
    ...purity,
    form,
    capacity: rule.capacity,
    occupied,
    remaining: rule.capacity - occupied,
  };
}

export function trainBeast(attempt: BeastAttempt, outcomes: readonly HabitTrainingStatus[]) {
  if (attempt.status !== 'training') throw Error('BEAST_ATTEMPT_NOT_TRAINING');
  const before = trainingView(attempt);
  if (!before.remaining) throw Error('BEAST_ATTEMPT_COMPLETED');
  let delta = habitTrainingPoints(outcomes);
  const dailyBudget = delta.earned + delta.gray;
  if (dailyBudget > before.remaining) {
    const relevant = outcomes.filter((status) => status !== 'neutral');
    const completed = relevant.filter((status) => status === 'achieved').length;
    const rounded = Math.round((before.remaining * completed) / relevant.length);
    // A missed final-day obligation must not round away the last impurity.
    const earned = completed < relevant.length ? Math.min(rounded, before.remaining - 1) : rounded;
    delta = { earned, gray: before.remaining - earned };
  }
  const next: BeastAttempt = {
    ...attempt,
    earned: attempt.earned + delta.earned,
    gray: attempt.gray + delta.gray,
  };
  if (trainingView(next).completed) next.status = 'completed';
  return { attempt: next, delta };
}

export function sealBeast(attempt: BeastAttempt): BeastAttempt {
  if (attempt.status === 'completed' || attempt.status === 'sealed') return { ...attempt };
  if (attempt.status !== 'training') throw Error('BEAST_ATTEMPT_NOT_TRAINING');
  return { ...attempt, status: 'sealed' };
}

export type BeastAlchemy = { days: number; failures: number; inventory: number };
export const BEAST_ALCHEMY_DAYS = 30;
export const BEAST_ALCHEMY_CHANCE = 0.4;
export const BEAST_ALCHEMY_FAILURE_LIMIT = 2;

export function initialBeastAlchemy(): BeastAlchemy {
  return { days: 0, failures: 0, inventory: 0 };
}

function validAlchemy(value: BeastAlchemy) {
  if (
    ![value.days, value.failures, value.inventory].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    value.days > BEAST_ALCHEMY_DAYS ||
    value.failures > BEAST_ALCHEMY_FAILURE_LIMIT
  )
    throw Error('INVALID_BEAST_ALCHEMY');
}

export function accumulateAlchemy(
  state: BeastAlchemy,
  outcomes: readonly HabitTrainingStatus[],
): BeastAlchemy {
  validAlchemy(state);
  // Validate even while holding a charged furnace.
  const points = habitTrainingPoints(outcomes);
  if (state.days === BEAST_ALCHEMY_DAYS) return { ...state };
  return { ...state, days: points.gray > 0 ? 0 : points.earned > 0 ? state.days + 1 : state.days };
}

export function craftBeastElixir(state: BeastAlchemy, random: () => number) {
  validAlchemy(state);
  if (state.days < BEAST_ALCHEMY_DAYS) throw Error('BEAST_ALCHEMY_NOT_READY');
  const guaranteed = state.failures >= BEAST_ALCHEMY_FAILURE_LIMIT;
  const success = guaranteed || randomUnit(random) < BEAST_ALCHEMY_CHANCE;
  if (success && state.inventory === Number.MAX_SAFE_INTEGER) throw Error('INVALID_BEAST_ALCHEMY');
  return {
    state: {
      days: 0,
      failures: success ? 0 : state.failures + 1,
      inventory: state.inventory + Number(success),
    },
    success,
    guaranteed,
  };
}

export function resetBeastWithElixir(attempt: BeastAttempt, alchemy: BeastAlchemy) {
  validAlchemy(alchemy);
  if (!alchemy.inventory) throw Error('BEAST_NO_ELIXIR');
  if (attempt.status !== 'sealed' && attempt.status !== 'completed')
    throw Error('BEAST_RESET_NOT_AVAILABLE');
  return {
    attempt: newBeastAttempt(attempt.speciesId),
    alchemy: { ...alchemy, inventory: alchemy.inventory - 1 },
  };
}
