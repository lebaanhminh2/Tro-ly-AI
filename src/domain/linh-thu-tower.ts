import { randomUnit, TOWER_CARD_COUNTS, towerReward } from './linh-thu.ts';

/** Internal server state. Never serialize this object directly to the client. */
export type BeastTower = {
  day: number;
  floor: number;
  cleared: number;
  trap: number;
  status: 'choosing' | 'decision' | 'claimed' | 'failed' | 'expired';
  rescueAvailable: boolean;
  rescued: boolean;
  lastPick: number | null;
  lastResult: 'safe' | 'trap' | 'rescued' | null;
};

function trapFor(floor: number, random: () => number): number {
  const count = TOWER_CARD_COUNTS[floor - 1];
  if (!count) throw Error('INVALID_TOWER_FLOOR');
  return Math.floor(randomUnit(random) * count);
}

export function beginBeastTower(
  day: number,
  rescueAvailable: boolean,
  random: () => number,
): BeastTower {
  if (!Number.isSafeInteger(day)) throw Error('INVALID_TOWER_DAY');
  return {
    day,
    floor: 1,
    cleared: 0,
    trap: trapFor(1, random),
    status: 'choosing',
    rescueAvailable,
    rescued: false,
    lastPick: null,
    lastResult: null,
  };
}

export function pickBeastTower(state: BeastTower, card: number, random: () => number): BeastTower {
  if (state.status !== 'choosing') throw Error('TOWER_NOT_CHOOSING');
  const count = TOWER_CARD_COUNTS[state.floor - 1];
  if (!count || !Number.isInteger(card) || card < 0 || card >= count)
    throw Error('INVALID_TOWER_CARD');
  if (card === state.trap) {
    if (state.rescueAvailable && !state.rescued && state.floor <= 3)
      return {
        ...state,
        trap: trapFor(state.floor, random),
        rescued: true,
        lastPick: card,
        lastResult: 'rescued',
      };
    return { ...state, status: 'failed', lastPick: card, lastResult: 'trap' };
  }
  return { ...state, status: 'decision', cleared: state.floor, lastPick: card, lastResult: 'safe' };
}

export function continueBeastTower(state: BeastTower, random: () => number): BeastTower {
  if (state.status !== 'decision' || state.floor >= 4) throw Error('TOWER_CANNOT_CONTINUE');
  const floor = state.floor + 1;
  return {
    ...state,
    floor,
    trap: trapFor(floor, random),
    status: 'choosing',
    lastPick: null,
    lastResult: null,
  };
}

export function claimBeastTower(state: BeastTower) {
  if (state.status !== 'decision') throw Error('TOWER_CANNOT_CLAIM');
  return { state: { ...state, status: 'claimed' as const }, reward: towerReward(state.cleared) };
}

export function expireBeastTower(state: BeastTower) {
  const active = state.status === 'choosing' || state.status === 'decision';
  return {
    state: active ? { ...state, status: 'expired' as const } : state,
    reward: towerReward(active ? state.cleared : 0),
  };
}

export function beastTowerPublic(state: BeastTower) {
  // The unrevealed trap, including the reshuffled rescue trap, stays server-side.
  return {
    day: state.day,
    floor: state.floor,
    cleared: state.cleared,
    cards: TOWER_CARD_COUNTS[state.floor - 1]!,
    status: state.status,
    rescued: state.rescued,
    rescueAvailable: state.rescueAvailable && !state.rescued && state.floor <= 3,
    lastPick: state.lastPick,
    lastResult: state.lastResult,
    atRisk: towerReward(state.status === 'failed' ? 0 : state.cleared),
    nextReward: state.floor < 4 ? towerReward(state.floor + 1) : null,
  };
}
