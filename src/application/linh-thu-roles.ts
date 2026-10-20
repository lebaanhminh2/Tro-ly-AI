import { evolveBeast, resetBeastWithElixir, trainingView } from '../domain/linh-thu-training.ts';
import type { BeastRole, BeastStore, BeastRoleSelection } from '../ports/linh-thu-store.ts';

export type BeastRoleCommand = {
  operation: 'select' | 'cancel' | 'reset' | 'evolve';
  version: number;
  day: number;
  role?: BeastRole;
  beastId?: string;
};

export class BeastRoleService {
  private store: BeastStore;
  constructor(store: BeastStore) {
    this.store = store;
  }

  async execute(
    owner: string,
    id: string,
    command: BeastRoleCommand,
    day: number,
    now: number,
    deadline?: number,
  ) {
    if (
      !['select', 'cancel', 'reset', 'evolve'].includes(command.operation) ||
      Object.keys(command).some(
        (key) => !['operation', 'version', 'day', 'role', 'beastId'].includes(key),
      ) ||
      (!['reset', 'evolve'].includes(command.operation) &&
        !['training', 'companion'].includes(String(command.role))) ||
      (['reset', 'evolve'].includes(command.operation) && command.role !== undefined) ||
      (command.operation === 'cancel' && command.beastId !== undefined) ||
      (command.operation !== 'cancel' &&
        (typeof command.beastId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(command.beastId)))
    )
      throw Error('INVALID_BEAST_ROLE_COMMAND');
    const selected =
      command.operation !== 'cancel' && typeof command.beastId === 'string'
        ? await this.store.individual(owner, command.beastId)
        : null;
    const selections = await this.store.roles(owner, day);
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
        if (command.operation === 'cancel')
          return {
            state: snapshot.state,
            healthy,
            result: { cancelled: true },
            roleChanges: [
              { role: command.role!, day: day + 1, beastId: null, attemptId: null, remove: true },
            ],
          };
        if (!selected) throw Error('BEAST_NOT_FOUND');
        if (command.operation === 'evolve') {
          const attempt = evolveBeast(selected.attempt);
          return {
            state: snapshot.state,
            healthy,
            updateAttempts: [{ id: selected.attemptId, attempt }],
            result: {
              evolved: true,
              beastId: selected.id,
              attemptId: selected.attemptId,
              from: trainingView(selected.attempt).form,
              form: attempt.form,
              attempt,
            },
          };
        }
        if (command.operation === 'reset') {
          const reset = resetBeastWithElixir(selected.attempt, snapshot.state.alchemy);
          const companion = selections.current.find((selection) => selection.role === 'companion');
          const attemptId = 'a_' + id;
          const companionChanges: BeastRoleSelection[] =
            companion?.beastId === selected.id
              ? [{ role: 'companion', day, beastId: selected.id, attemptId }]
              : [];
          for (const pending of selections.pending)
            if (pending.role === 'companion' && pending.beastId === selected.id)
              companionChanges.push({ ...pending, attemptId });
          return {
            state: { ...snapshot.state, alchemy: reset.alchemy },
            healthy,
            newAttempts: [{ id: attemptId, beastId: selected.id, speciesId: selected.speciesId }],
            roleChanges: companionChanges,
            result: { reset: true, beastId: selected.id, attemptId },
          };
        }
        const active = selections.current.find((selection) => selection.role === command.role);
        if (
          command.role === 'training' &&
          selected.attempt.status !== 'ready' &&
          !(
            active?.beastId === selected.id &&
            active.attemptId === selected.attemptId &&
            selected.attempt.status === 'training'
          )
        )
          throw Error('BEAST_TRAINING_LOCKED');
        const same = active?.beastId === selected.id && active.attemptId === selected.attemptId;
        return {
          state: snapshot.state,
          healthy,
          result: {
            scheduled: !same,
            role: command.role,
            beastId: selected.id,
            effectiveDay: day + 1,
          },
          roleChanges: [
            {
              role: command.role!,
              day: day + 1,
              beastId: selected.id,
              attemptId: selected.attemptId,
              remove: same,
            },
          ],
        };
      },
      deadline,
    );
  }
}
