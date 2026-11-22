import { query, type Database, type Statement } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import {
  FIRST_STEP_WORK_MS,
  firstStepId,
  firstStepReward,
  type FirstStepCommand,
  type FirstStepOccurrence,
  type FirstStepResult,
} from '../../domain/first-step.ts';
import type { FirstStepStore } from '../../ports/first-step-store.ts';

const columns =
  'id,source,status,version,started_at AS startedAt,ends_at AS endsAt,completed_at AS completedAt,canceled_at AS canceledAt';
const ledgerOperation = 'first-step';

export class D1FirstStepStore implements FirstStepStore {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  private entry(owner: string, id: string) {
    return query(
      this.db,
      `SELECT ${columns} FROM first_step_occurrences WHERE owner=? AND id=?`,
      owner,
      id,
    ).first<FirstStepOccurrence>();
  }

  private active(owner: string) {
    return query(
      this.db,
      `SELECT ${columns} FROM first_step_occurrences WHERE owner=? AND status='active' LIMIT 1`,
      owner,
    ).first<FirstStepOccurrence>();
  }

  async read(owner: string, now: number, occurrenceId?: string) {
    const active = await this.active(owner);
    return {
      owner,
      serverNow: now,
      active,
      ...(occurrenceId ? { occurrence: await this.entry(owner, firstStepId(occurrenceId)) } : {}),
    };
  }

  private versionGuard(owner: string, id: string, version: number) {
    return query(
      this.db,
      'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM first_step_occurrences WHERE owner=? AND id=?),0)=? THEN 1 ELSE 0 END',
      owner,
      id,
      version,
    );
  }

  private insert(owner: string, row: FirstStepOccurrence) {
    return query(
      this.db,
      'INSERT INTO first_step_occurrences(owner,id,source,status,version,started_at,ends_at,completed_at,canceled_at) VALUES(?,?,?,?,?,?,?,?,?)',
      owner,
      row.id,
      row.source,
      row.status,
      row.version,
      row.startedAt,
      row.endsAt,
      row.completedAt,
      row.canceledAt,
    );
  }

  async write(owner: string, requestId: string, command: FirstStepCommand, now: number) {
    const healthy = new HealthyStore(this.db);
    // All four operations share the existing wallet ledger. Start/cancel keep
    // wallet values intact; its version guard serializes them with wallet writes.
    // There is no second source of truth for rewards or request receipts.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const outcome = await healthy.mutateWithAccount<FirstStepResult>(
          owner,
          requestId,
          ledgerOperation,
          command,
          now,
          async (state) => {
            const previous = await this.entry(owner, command.occurrenceId);
            let occurrence: FirstStepOccurrence,
              rewarded = false;
            const statements: Statement[] = [
              this.versionGuard(owner, command.occurrenceId, previous?.version ?? 0),
            ];
            if (command.operation === 'start') {
              if (previous) occurrence = previous;
              else {
                if (await this.active(owner)) throw Error('FIRST_STEP_ACTIVE');
                occurrence = {
                  id: command.occurrenceId,
                  source: 'timer',
                  status: 'active',
                  version: 1,
                  startedAt: now,
                  endsAt: now + FIRST_STEP_WORK_MS,
                  completedAt: null,
                  canceledAt: null,
                };
                statements.push(this.insert(owner, occurrence));
              }
            } else if (command.operation === 'cancel') {
              if (previous?.status === 'completed') throw Error('FIRST_STEP_COMPLETED');
              if (previous?.status === 'canceled') occurrence = previous;
              else if (previous) {
                occurrence = {
                  ...previous,
                  status: 'canceled',
                  version: previous.version + 1,
                  canceledAt: now,
                };
                statements.push(
                  query(
                    this.db,
                    "UPDATE first_step_occurrences SET status='canceled',version=version+1,canceled_at=? WHERE owner=? AND id=?",
                    now,
                    owner,
                    previous.id,
                  ),
                );
              } else {
                // A cancel arriving before start is a terminal tombstone. A delayed
                // start with this same id can never resurrect a canceled occurrence.
                occurrence = {
                  id: command.occurrenceId,
                  source: 'timer',
                  status: 'canceled',
                  version: 1,
                  startedAt: now,
                  endsAt: now + FIRST_STEP_WORK_MS,
                  completedAt: null,
                  canceledAt: now,
                };
                statements.push(this.insert(owner, occurrence));
              }
            } else if (command.operation === 'claim') {
              if (!previous) throw Error('FIRST_STEP_NOT_FOUND');
              if (previous.status === 'canceled') throw Error('FIRST_STEP_CANCELED');
              if (previous.status === 'completed') occurrence = previous;
              else {
                if (previous.source !== 'timer' || now < previous.endsAt)
                  throw Error('FIRST_STEP_TOO_EARLY');
                occurrence = {
                  ...previous,
                  status: 'completed',
                  version: previous.version + 1,
                  completedAt: now,
                };
                rewarded = true;
                statements.push(
                  query(
                    this.db,
                    "UPDATE first_step_occurrences SET status='completed',version=version+1,completed_at=? WHERE owner=? AND id=? AND ends_at<=?",
                    now,
                    owner,
                    previous.id,
                    now,
                  ),
                );
              }
            } else {
              if (previous) {
                if (previous.source !== 'outside' || previous.status !== 'completed')
                  throw Error('FIRST_STEP_CHANGED');
                occurrence = previous;
              } else {
                if (await this.active(owner)) throw Error('FIRST_STEP_ACTIVE');
                statements.push(
                  query(
                    this.db,
                    "INSERT INTO transaction_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM first_step_occurrences WHERE owner=? AND status='active') THEN 1 ELSE 0 END",
                    owner,
                  ),
                );
                occurrence = {
                  id: command.occurrenceId,
                  source: 'outside',
                  status: 'completed',
                  version: 1,
                  startedAt: now,
                  endsAt: now,
                  completedAt: now,
                  canceledAt: null,
                };
                statements.push(this.insert(owner, occurrence));
                rewarded = true;
              }
            }
            return {
              state: rewarded ? firstStepReward(state) : state,
              result: { saved: true, occurrence, rewarded },
              statements,
            };
          },
        );
        // Receipts retain their original reward result, while an old start
        // response must not present a canceled occurrence as active again.
        const current = await this.entry(owner, command.occurrenceId);
        return {
          ...outcome,
          result: { ...outcome.result, occurrence: current ?? outcome.result.occurrence },
          serverNow: now,
        };
      } catch (error) {
        // Only retry a rolled-back optimistic conflict. Domain/transport/storage
        // failures retain their result; an unknown error is never relabeled success.
        const message = error instanceof Error ? error.message : '';
        if (
          !/CHECK constraint failed:\s*(?:valid\s*=\s*1|transaction_guard)|UNIQUE constraint failed:\s*first_step_occurrences\./i.test(
            message,
          )
        )
          throw error;
        if (attempt === 3) throw Error('FIRST_STEP_CHANGED');
      }
    }
    throw Error('FIRST_STEP_CHANGED');
  }
}
