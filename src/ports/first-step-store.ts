import type {
  FirstStepCommand,
  FirstStepOccurrence,
  FirstStepResult,
} from '../domain/first-step.ts';
import type { HealthyState } from '../domain/healthy.ts';

export type FirstStepSnapshot = {
  owner: string;
  serverNow: number;
  active: FirstStepOccurrence | null;
  occurrence?: FirstStepOccurrence | null;
};
export interface FirstStepStore {
  read(owner: string, now: number, occurrenceId?: string): Promise<FirstStepSnapshot>;
  write(
    owner: string,
    requestId: string,
    command: FirstStepCommand,
    now: number,
  ): Promise<{
    result: FirstStepResult;
    account: { state: HealthyState; version: number };
    serverNow: number;
  }>;
}
