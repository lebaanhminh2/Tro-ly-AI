import {
  canFuseCharm,
  CHARMS,
  fuseCharm,
  type Charm,
  type HealthyState,
  type Item,
} from '../../domain/healthy.ts';

export type FusionBatchInput = { state: HealthyState; item: Charm; count: number };

// Require the full recipe for every attempt before rolling. Refunds stay in the wallet.
export function runFusionBatch(
  { state, item, count }: FusionBatchInput,
  random: () => number,
  applyEffect: (state: HealthyState, success: boolean) => HealthyState = (state) => state,
) {
  if (![1, 10, 100].includes(count)) throw Error('INVALID_FUSION_COUNT');
  if (!canFuseCharm(state, item, count)) throw Error('FUSION_UNAVAILABLE');
  let next = state,
    attempted = 0,
    successes = 0;
  while (attempted < count) {
    const outcome = fuseCharm(next, item, random());
    next = applyEffect(outcome.state, outcome.success);
    attempted++;
    if (outcome.success) successes++;
  }
  const consumed: Partial<Record<Item, number>> = {};
  for (const key of [item, ...(item === 'supreme' ? ['keepsake' as const] : [])])
    consumed[key] = state.inventory[key] - next.inventory[key];
  const output = CHARMS[item].next!;
  return {
    state: next,
    result: {
      requested: count,
      count: attempted,
      successes,
      failures: attempted - successes,
      success: successes > 0,
      output,
      received: (next.inventory[output] ?? 0) - (state.inventory[output] ?? 0),
      consumed,
      stoppedEarly: attempted < count,
    },
  };
}
