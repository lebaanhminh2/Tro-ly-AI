import type { HealthyState } from './healthy.ts';

export const FIRST_STEP_HOLD_MS = 3000;
export const FIRST_STEP_WORK_MS = 300000;
export type FirstStepOperation = 'start' | 'claim' | 'cancel' | 'outside';
export type FirstStepCommand = { operation: FirstStepOperation; occurrenceId: string };
export type FirstStepOccurrence = {
  id: string;
  source: 'timer' | 'outside';
  status: 'active' | 'completed' | 'canceled';
  version: number;
  startedAt: number;
  endsAt: number;
  completedAt: number | null;
  canceledAt: number | null;
};
export type FirstStepResult = {
  saved: true;
  occurrence: FirstStepOccurrence;
  rewarded: boolean;
};

export function firstStepId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(value))
    throw Error('INVALID_FIRST_STEP_ID');
  return value;
}

export function firstStepCommand(input: Record<string, unknown>): FirstStepCommand {
  const operation = input.operation;
  if (
    typeof operation !== 'string' ||
    !['start', 'claim', 'cancel', 'outside'].includes(operation) ||
    Object.keys(input).some((key) => !['operation', 'occurrenceId'].includes(key))
  )
    throw Error('INVALID_FIRST_STEP_OPERATION');
  return {
    operation: operation as FirstStepOperation,
    occurrenceId: firstStepId(input.occurrenceId),
  };
}

export function firstStepReward(state: HealthyState): HealthyState {
  if (state.suspended) throw Error('ACCOUNT_SUSPENDED');
  if (
    ![state.qi, state.earned, state.tickets].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n < Number.MAX_SAFE_INTEGER,
    )
  )
    throw Error('INVALID_FIRST_STEP_BALANCE');
  return { ...state, qi: state.qi + 1, earned: state.earned + 1, tickets: state.tickets + 1 };
}
