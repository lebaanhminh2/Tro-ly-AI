import { activateBeastUltimate, beastCalendarWeek } from '../domain/linh-thu-ultimates.ts';
import type { BeastStore } from '../ports/linh-thu-store.ts';
import type { Item } from '../domain/healthy.ts';

export type BeastUltimateCommand = {
  operation: 'ultimate';
  day: number;
  version: number;
  beastId: string;
  targets?: string[];
  pact?: 'reward' | 'guard';
};
export class BeastUltimateService {
  private store: BeastStore;
  constructor(store: BeastStore) {
    this.store = store;
  }
  async chooseReward(
    owner: string,
    id: string,
    command: {
      operation: 'choose_reward';
      version: number;
      day: number;
      choiceId: string;
      option: number;
    },
    day: number,
    now: number,
    dayEnd: number,
  ) {
    if (
      Object.keys(command).some(
        (key) => !['operation', 'version', 'day', 'choiceId', 'option'].includes(key),
      ) ||
      typeof command.choiceId !== 'string' ||
      command.choiceId.length > 150 ||
      !Number.isInteger(command.option)
    )
      throw Error('INVALID_BEAST_CHOICE');
    const choice = await this.store.rewardChoice(owner, command.choiceId);
    return this.store.transact<Record<string, unknown>>(
      owner,
      id,
      'choose_reward',
      command,
      day,
      now,
      command.version,
      (snapshot, healthy) => {
        if (command.day !== day) throw Error('BEAST_DAY_CLOSED');
        if (healthy.suspended) throw Error('ACCOUNT_SUSPENDED');
        if (!choice || choice.result !== null) throw Error('BEAST_CHOICE_CLOSED');
        const reward = choice.options[command.option];
        if (!reward || command.option < 0) throw Error('INVALID_BEAST_CHOICE');
        const next = {
          ...healthy,
          inventory: { ...healthy.inventory },
          qi: healthy.qi + (reward.qi ?? 0),
          earned: healthy.earned + (reward.qi ?? 0),
          tickets: healthy.tickets + (reward.tickets ?? 0),
        };
        for (const [item, amount] of Object.entries(reward.items ?? {}))
          next.inventory[item as Item] += amount;
        const result = { choiceId: command.choiceId, reward, option: command.option };
        return {
          state: {
            ...snapshot.state,
            summonTickets: snapshot.state.summonTickets + (reward.summonTickets ?? 0),
          },
          healthy: next,
          result,
          resolveChoice: { id: command.choiceId, result },
        };
      },
      dayEnd,
    );
  }
  async execute(
    owner: string,
    id: string,
    command: BeastUltimateCommand,
    day: number,
    now: number,
    dayEnd: number,
  ) {
    if (
      command.operation !== 'ultimate' ||
      Object.keys(command).some(
        (key) => !['operation', 'day', 'version', 'beastId', 'targets', 'pact'].includes(key),
      ) ||
      typeof command.beastId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,120}$/.test(command.beastId)
    )
      throw Error('INVALID_BEAST_ULTIMATE_COMMAND');
    const [beast, roles, used, sleepTarget] = await Promise.all([
      this.store.individual(owner, command.beastId),
      this.store.roles(owner, day),
      this.store.ultimate(owner, beastCalendarWeek(now)),
      this.store.sleepTarget(owner, day),
    ]);
    return this.store.transact<Record<string, unknown>>(
      owner,
      id,
      'ultimate',
      command,
      day,
      now,
      command.version,
      (snapshot, healthy) => {
        if (command.day !== day) throw Error('BEAST_DAY_CLOSED');
        if (healthy.suspended) throw Error('ACCOUNT_SUSPENDED');
        // The store replays committed v1 receipts before this callback. New
        // activation is forbidden after cutover, including direct service calls
        // from old clients, while chooseReward remains a compatibility path.
        if (snapshot.skillCutoverDay != null && day >= snapshot.skillCutoverDay)
          throw Error('BEAST_SKILLS_AUTOMATIC');
        if (used) throw Error('BEAST_ULTIMATE_WEEK_USED');
        if (!beast) throw Error('BEAST_NOT_FOUND');
        const companion = roles.current.find((role) => role.role === 'companion');
        if (companion?.beastId !== beast.id || companion.attemptId !== beast.attemptId)
          throw Error('BEAST_COMPANION_REQUIRED');
        const ultimate = activateBeastUltimate({
          attempt: beast.attempt,
          beastId: beast.id,
          attemptId: beast.attemptId,
          day,
          now,
          dayEnd,
          targets: command.targets,
          pact: command.pact,
        });
        if (
          ['meteor_guard', 'frost_guard', 'knight_guard', 'owl_guard'].includes(ultimate.kind) &&
          (sleepTarget === null || now >= sleepTarget)
        )
          throw Error('BEAST_SLEEP_TARGET_PASSED');
        return {
          state: snapshot.state,
          healthy,
          result: { ultimate },
          ultimate,
          requiredOpenTasks: ultimate.targets,
        };
      },
      dayEnd,
    );
  }
}
