import { accumulateAlchemy, sealBeast, trainBeast } from '../domain/linh-thu-training.ts';
import { addSkillReward, applyBeastPassives } from '../domain/linh-thu-skills.ts';
import { applyBeastUltimate } from '../domain/linh-thu-ultimates.ts';
import { habitWeekStart } from '../domain/habits.ts';
import type { BeastMutation, BeastStore } from '../ports/linh-thu-store.ts';

export class BeastSettlementService {
  private store: BeastStore;
  private random: () => number;
  constructor(store: BeastStore, random: () => number) {
    this.store = store;
    this.random = random;
  }

  /** Bounded by days. Missing habit assessments defer work without minting rewards. */
  async settle(owner: string, now: number, limit = 1) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 14)
      throw Error('INVALID_BEAST_SETTLEMENT_LIMIT');
    let processed = 0;
    for (; processed < limit; processed++) {
      const day = await this.store.nextSettlement(owner);
      if (day === null) break;
      const snapshot = await this.store.read(owner);
      const assessed = await this.store.assessedHabitDay(owner, day, now);
      if (!assessed.ready) break;
      const outcomes = assessed.outcomes!;
      const endAt = await this.store.dayEnd(owner, day);
      const isV2 = snapshot.skillCutoverDay != null && day >= snapshot.skillCutoverDay;
      const ultimate =
        !isV2 && endAt ? await this.store.ultimate(owner, habitWeekStart(day)) : null;
      const selections = await this.store.roles(owner, day);
      const training = selections.current.find((role) => role.role === 'training');
      const companion = selections.current.find((role) => role.role === 'companion');
      const nextTraining = (await this.store.roles(owner, day + 1)).current.find(
        (role) => role.role === 'training',
      );
      const [oldBeast, companionBeast, nextBeast] = await Promise.all([
        training?.beastId
          ? this.store.individual(owner, training.beastId, training.attemptId!)
          : null,
        companion?.beastId
          ? this.store.individual(owner, companion.beastId, companion.attemptId!)
          : null,
        nextTraining?.beastId
          ? this.store.individual(owner, nextTraining.beastId, nextTraining.attemptId!)
          : null,
      ]);
      await this.store.transact(
        owner,
        'beast_day_' + day,
        'settle',
        { day },
        day,
        now,
        snapshot.version,
        (current, healthy) => {
          const updates: NonNullable<BeastMutation<unknown>['updateAttempts']>[number][] = [];
          let delta = { earned: 0, gray: 0 };
          const changing = training?.attemptId !== nextTraining?.attemptId;
          if (oldBeast && oldBeast.attempt.status !== 'completed') {
            const active =
              oldBeast.attempt.status === 'ready'
                ? { ...oldBeast.attempt, status: 'training' as const }
                : oldBeast.attempt;
            const trained = trainBeast(active, outcomes);
            delta = trained.delta;
            const attempt = changing ? sealBeast(trained.attempt) : trained.attempt;
            updates.push({
              id: oldBeast.attemptId,
              attempt,
              startedDay: training!.day,
              lastSettledDay: day,
              ...(changing || attempt.status === 'completed' ? { endedDay: day } : {}),
            });
          }
          if (changing && nextBeast) {
            if (nextBeast.attempt.status !== 'ready') throw Error('BEAST_TRAINING_LOCKED');
            updates.push({
              id: nextBeast.attemptId,
              attempt: { ...nextBeast.attempt, status: 'training' },
              startedDay: day + 1,
            });
          }
          // Habit buffs use the companion and skill state that existed in the original day.
          const full = outcomes.includes('achieved') && !outcomes.includes('missed');
          const passive =
            !isV2 && companionBeast && !healthy.suspended
              ? applyBeastPassives(
                  companionBeast.attempt,
                  companionBeast.counters,
                  { trigger: 'habit', day, qualified: full },
                  this.random,
                )
              : null;
          const boosted =
            ultimate && endAt && !healthy.suspended
              ? applyBeastUltimate(ultimate, {
                  kind: 'habit',
                  sourceId: String(day),
                  day,
                  at: endAt - 1,
                  qualified: full,
                })
              : null;
          const reward = { ...passive?.reward };
          if (boosted) addSkillReward(reward, boosted.reward);
          const nextHealthy = { ...healthy, inventory: { ...healthy.inventory } };
          const state = {
            ...current.state,
            alchemy: accumulateAlchemy(current.state.alchemy, outcomes),
          };
          if (passive || boosted) {
            nextHealthy.qi += reward.qi ?? 0;
            nextHealthy.earned += reward.qi ?? 0;
            nextHealthy.tickets += reward.tickets ?? 0;
            state.summonTickets += reward.summonTickets ?? 0;
            for (const [item, amount] of Object.entries(reward.items ?? {}))
              nextHealthy.inventory[item as keyof typeof nextHealthy.inventory] += amount;
            if (passive) {
              const existing = updates.find((update) => update.id === companionBeast!.attemptId);
              if (existing) existing.counters = passive.counters;
              else
                updates.push({
                  id: companionBeast!.attemptId,
                  attempt: companionBeast!.attempt,
                  counters: passive.counters,
                });
            }
          }
          const result = {
            day,
            delta,
            full,
            reward,
            alchemy: state.alchemy,
            companionAttempt: companionBeast?.attempt ?? null,
            companionAttemptId: companionBeast?.attemptId ?? null,
            ...(isV2
              ? {
                  v2Habit: {
                    satisfied: assessed.habitSatisfied ?? !outcomes.includes('missed'),
                    rewardEligible: assessed.habitRewardEligible ?? full,
                  },
                }
              : {}),
          };
          return {
            state,
            healthy: nextHealthy,
            result,
            updateAttempts: updates,
            habitVersion: assessed.version,
            ...(boosted
              ? {
                  ultimate: boosted.state,
                  rewardChoices: boosted.choices.map((choice) => ({ id: 'habit:' + day, choice })),
                }
              : {}),
            settlement: {
              day,
              trainingId: training?.beastId ?? null,
              companionId: companion?.beastId ?? null,
              outcomes,
              result,
            },
          };
        },
      );
    }
    return { processed };
  }
}
