import {
  beastTowerPublic,
  beginBeastTower,
  claimBeastTower,
  continueBeastTower,
  expireBeastTower,
  pickBeastTower,
} from '../domain/linh-thu-tower.ts';
import type { BeastStore } from '../ports/linh-thu-store.ts';

export type BeastTowerCommand = {
  operation: 'tower_start' | 'tower_pick' | 'tower_continue' | 'tower_claim';
  day: number;
  version: number;
  runVersion?: number;
  card?: number;
};

export class BeastTowerService {
  private store: BeastStore;
  private random: () => number;
  constructor(store: BeastStore, random: () => number) {
    this.store = store;
    this.random = random;
  }

  async expire(owner: string, now: number) {
    const snapshot = await this.store.read(owner);
    const expired = await this.store.expiredTower(owner, now);
    if (!expired) return null;
    return this.store.transact(
      owner,
      'beast_tower_expire_' + expired.state.day,
      'tower-expire',
      { day: expired.state.day },
      expired.state.day,
      now,
      snapshot.version,
      (current, healthy) => {
        const result = expireBeastTower(expired.state);
        return {
          state: {
            ...current.state,
            summonTickets: current.state.summonTickets + result.reward.summonTickets,
          },
          healthy: { ...healthy, tickets: healthy.tickets + result.reward.tickets },
          tower: { ...expired, state: result.state },
          result: { tower: beastTowerPublic(result.state), reward: result.reward },
        };
      },
    );
  }

  async execute(
    owner: string,
    id: string,
    command: BeastTowerCommand,
    day: number,
    now: number,
    deadline?: number,
  ) {
    if (
      !['tower_start', 'tower_pick', 'tower_continue', 'tower_claim'].includes(command.operation) ||
      Object.keys(command).some(
        (key) => !['operation', 'day', 'version', 'runVersion', 'card'].includes(key),
      ) ||
      (command.operation !== 'tower_pick' && command.card !== undefined) ||
      (command.operation === 'tower_start' && command.runVersion !== undefined) ||
      (command.operation === 'tower_pick' && !Number.isInteger(command.card)) ||
      (command.operation !== 'tower_start' &&
        (!Number.isSafeInteger(command.runVersion) || Number(command.runVersion) < 1))
    )
      throw Error('INVALID_TOWER_COMMAND');
    const existing = await this.store.tower(owner, day);
    const eligibility =
      command.operation === 'tower_start' ? await this.store.towerEligibility(owner, now) : null;
    return this.store.transact<Record<string, unknown>>(
      owner,
      id,
      command.operation,
      command,
      day,
      now,
      command.version,
      (snapshot, healthy) => {
        if (command.day !== day) throw Error('BEAST_DAY_CLOSED');
        if (healthy.suspended) throw Error('ACCOUNT_SUSPENDED');
        if (command.operation === 'tower_start') {
          if (existing) throw Error('TOWER_ALREADY_PLAYED');
          if (!eligibility?.eligible || eligibility.day !== day) throw Error('TOWER_NOT_ELIGIBLE');
          const state = beginBeastTower(
            day,
            eligibility.rescueAvailable,
            this.random,
            eligibility.skillVersion === 2
              ? { rescueMaxFloor: 4, rewardMultiplier: eligibility.rewardMultiplier ?? 1 }
              : undefined,
          );
          return {
            state: snapshot.state,
            healthy,
            habitVersion: eligibility.habitVersion,
            tower: {
              state,
              version: 0,
              expiresAt: eligibility.endAt,
              eligibility,
              requiredTaskId: eligibility.taskId!,
              startAt: eligibility.startAt,
            },
            result: { tower: beastTowerPublic(state), runVersion: 1 },
          };
        }
        if (!existing) throw Error('TOWER_NOT_STARTED');
        if (existing.expiresAt <= now) throw Error('BEAST_DAY_CLOSED');
        if (existing.version !== command.runVersion) throw Error('TOWER_CHANGED');
        if (command.operation === 'tower_claim') {
          const result = claimBeastTower(existing.state);
          return {
            state: {
              ...snapshot.state,
              summonTickets: snapshot.state.summonTickets + result.reward.summonTickets,
            },
            healthy: { ...healthy, tickets: healthy.tickets + result.reward.tickets },
            tower: { ...existing, state: result.state },
            result: {
              tower: beastTowerPublic(result.state),
              runVersion: existing.version + 1,
              reward: result.reward,
            },
          };
        }
        const state =
          command.operation === 'tower_pick'
            ? pickBeastTower(existing.state, command.card!, this.random)
            : continueBeastTower(existing.state, this.random);
        return {
          state: snapshot.state,
          healthy,
          tower: { ...existing, state },
          result: { tower: beastTowerPublic(state), runVersion: existing.version + 1 },
        };
      },
      deadline,
    );
  }
}
