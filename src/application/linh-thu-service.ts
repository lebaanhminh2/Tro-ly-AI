import { exchangeBeastTickets, summonBeasts } from '../domain/linh-thu-account.ts';
import { craftBeastElixir } from '../domain/linh-thu-training.ts';
import type { BeastStore } from '../ports/linh-thu-store.ts';
import { beastCalendarWeek } from '../domain/linh-thu-ultimates.ts';
import { beastSpecies, rollPyroCandidates, rollBeast } from '../domain/linh-thu-catalog.ts';
import { advanceSummonPity } from '../domain/linh-thu.ts';

export type BeastCommand = {
  operation: 'exchange' | 'summon' | 'craft' | 'choose_summon';
  version: number;
  count?: number;
  day?: number;
  option?: number;
  choiceId?: string;
};

export class BeastService {
  private store: BeastStore;
  private random: () => number;
  constructor(store: BeastStore, random: () => number) {
    this.store = store;
    this.random = random;
  }

  async execute(
    owner: string,
    requestId: string,
    command: BeastCommand,
    day: number,
    now: number,
    deadline?: number,
  ) {
    const { operation } = command;
    if (
      !['exchange', 'summon', 'craft', 'choose_summon'].includes(operation) ||
      Object.keys(command).some(
        (key) =>
          ![
            'operation',
            'version',
            'count',
            'day',
            ...(operation === 'choose_summon' ? ['option', 'choiceId'] : []),
          ].includes(key),
      )
    )
      throw Error('INVALID_BEAST_COMMAND');
    if (operation === 'craft' && command.count !== undefined) throw Error('INVALID_BEAST_COMMAND');
    const [ultimate, pending] =
      operation === 'summon' || operation === 'choose_summon'
        ? await Promise.all([
            this.store.ultimate(owner, beastCalendarWeek(now)),
            this.store.summonChoice(owner),
          ])
        : [null, null];
    return this.store.transact<Record<string, unknown>>(
      owner,
      requestId,
      operation,
      command,
      day,
      now,
      command.version,
      (snapshot, healthy) => {
        if (command.day !== undefined && command.day !== day) throw Error('BEAST_DAY_CLOSED');
        if (healthy.suspended) throw Error('ACCOUNT_SUSPENDED');
        if (operation === 'choose_summon') {
          if (!pending || pending.id !== command.choiceId) throw Error('BEAST_CHOICE_CLOSED');
          if (
            !Number.isInteger(command.option) ||
            command.option! < 0 ||
            command.option! >= pending.candidates.length ||
            command.count !== undefined
          )
            throw Error('INVALID_BEAST_CHOICE');
          const chosen = beastSpecies(pending.candidates[command.option!]!);
          let pity = advanceSummonPity(pending.pity, chosen.rank);
          const ids = [chosen.id];
          for (let i = 0; i < pending.remaining; i++) {
            const next = rollBeast(pity, this.random);
            ids.push(next.id);
            pity = advanceSummonPity(pity, next.rank);
          }
          const newBeasts = ids.map((speciesId, i) => ({
            id: `b_${pending.requestId}_${i}`,
            attemptId: `a_${pending.requestId}_${i}`,
            speciesId,
          }));
          const result = { count: pending.count, beasts: newBeasts, pity };
          return {
            state: { ...snapshot.state, pity },
            healthy,
            newBeasts,
            result,
            resolveChoice: { id: pending.id, result },
          };
        }
        if (operation === 'exchange') {
          const outcome = exchangeBeastTickets(snapshot.state, healthy.tickets, command.count ?? 1);
          return {
            state: outcome.state,
            healthy: { ...healthy, tickets: outcome.regularTickets },
            result: { exchanged: outcome.count, cost: outcome.cost },
          };
        }
        if (operation === 'craft') {
          const outcome = craftBeastElixir(snapshot.state.alchemy, this.random);
          return {
            state: { ...snapshot.state, alchemy: outcome.state },
            healthy,
            result: {
              success: outcome.success,
              guaranteed: outcome.guaranteed,
              alchemy: outcome.state,
            },
          };
        }
        const count = command.count ?? 1;
        if (count !== 1 && count !== 10) throw Error('INVALID_BEAST_SUMMON_COUNT');
        if (pending) throw Error('BEAST_SUMMON_CHOICE_PENDING');
        if (
          ultimate?.kind === 'summon_choice' &&
          !ultimate.cancelled &&
          !ultimate.settled &&
          ultimate.remaining > 0 &&
          ultimate.activatedAt <= now &&
          ultimate.expiresAt > now
        ) {
          if (snapshot.state.summonTickets < count) throw Error('BEAST_NO_SUMMON_TICKETS');
          const choice = {
            id: 'summon:' + requestId,
            requestId,
            candidates: rollPyroCandidates(snapshot.state.pity, this.random).map(
              (entry) => entry.id,
            ),
            pity: snapshot.state.pity,
            remaining: count - 1,
            count,
            result: null,
          };
          return {
            state: { ...snapshot.state, summonTickets: snapshot.state.summonTickets - count },
            healthy,
            summonChoice: choice,
            ultimate: { ...ultimate, remaining: ultimate.remaining - 1 },
            result: { count, choice, beasts: [] },
          };
        }
        const outcome = summonBeasts(snapshot.state, count, this.random);
        const newBeasts = outcome.speciesIds.map((speciesId, i) => ({
          id: `b_${requestId}_${i}`,
          attemptId: `a_${requestId}_${i}`,
          speciesId,
        }));
        return {
          state: outcome.state,
          healthy,
          newBeasts,
          result: { count, beasts: newBeasts, pity: outcome.state.pity },
        };
      },
      deadline,
    );
  }
}
