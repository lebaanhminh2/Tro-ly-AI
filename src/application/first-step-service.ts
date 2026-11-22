import { firstStepCommand, firstStepId, FIRST_STEP_WORK_MS } from '../domain/first-step.ts';
import type { FirstStepStore } from '../ports/first-step-store.ts';

export class FirstStepService {
  private store: FirstStepStore;
  constructor(store: FirstStepStore) {
    this.store = store;
  }

  async execute(owner: string, requestId: string, input: Record<string, unknown>, now: number) {
    firstStepId(requestId);
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + FIRST_STEP_WORK_MS))
      throw Error('INVALID_FIRST_STEP_TIME');
    return this.store.write(owner, requestId, firstStepCommand(input), now);
  }
}
