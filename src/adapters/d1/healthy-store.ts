import { query, type Database, type Statement } from './database.ts';
import {
  initialHealthy,
  assessSleep,
  claimDailyReward,
  type SleepAssessment,
  type HealthyState,
} from '../../domain/healthy.ts';
import { prepareBeastSleepEffect } from './linh-thu-effects.ts';

type Account = { state_json: string; version: number };
// Every write has an immutable request receipt. Random samples must be supplied
// by the server; retries return the existing result instead of rolling again.
export class HealthyStore {
  private db: Database;
  private defer?: (statements: Statement[]) => void;
  constructor(db: Database, defer?: (statements: Statement[]) => void) {
    this.db = db;
    this.defer = defer;
  }
  async receipt<T>(
    owner: string,
    id: string,
    operation: string,
    input: unknown,
    legacyKeys: readonly string[] = [],
  ): Promise<{ result: T } | null> {
    if (!/^\d+$/.test(owner) || !id || id.length > 120 || !operation || operation.length > 40)
      throw Error('INVALID_LEDGER_REQUEST');
    const request = JSON.stringify(input);
    if (!request || request.length > 12000) throw Error('INVALID_LEDGER_REQUEST');
    const receipt = await query(
      this.db,
      'SELECT operation,request_json,result_json FROM cultivation_receipts WHERE owner=? AND request_id=?',
      owner,
      id,
    ).first<{ operation: string; request_json: string; result_json: string }>();
    if (!receipt) return null;
    let previous = receipt.request_json;
    if (legacyKeys.length) {
      const value = JSON.parse(previous) as Record<string, unknown>;
      for (const key of legacyKeys) delete value[key];
      previous = JSON.stringify(value);
    }
    if (receipt.operation !== operation || previous !== request) throw Error('REQUEST_ID_REUSED');
    return { result: JSON.parse(receipt.result_json) as T };
  }
  async read(owner: string) {
    const row = await query(
      this.db,
      'SELECT state_json,version FROM cultivation_accounts WHERE owner=?',
      owner,
    ).first<Account>();
    return row
      ? {
          state: { ...initialHealthy(), ...JSON.parse(row.state_json) } as HealthyState,
          version: row.version,
        }
      : { state: initialHealthy(), version: 0 };
  }
  async mutate<T>(
    owner: string,
    id: string,
    operation: string,
    input: unknown,
    now: number,
    apply: (state: HealthyState) => { state: HealthyState; result: T; statements?: Statement[] },
  ): Promise<T> {
    if (!/^\d+$/.test(owner) || !id || id.length > 120 || !operation || operation.length > 40)
      throw Error('INVALID_LEDGER_REQUEST');
    const request = JSON.stringify(input);
    if (!request || request.length > 12000) throw Error('INVALID_LEDGER_REQUEST');
    const receipt = await this.receipt<T>(owner, id, operation, input);
    if (receipt) return receipt.result;
    const current = await this.read(owner),
      outcome = apply(current.state);
    const json = JSON.stringify(outcome.state),
      result = JSON.stringify(outcome.result);
    if (json.length > 12000 || !result || result.length > 12000)
      throw Error('INVALID_LEDGER_RESULT');
    const statements = [
      query(
        this.db,
        'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM cultivation_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END',
        owner,
        current.version,
      ),
      query(
        this.db,
        'INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET state_json=excluded.state_json,version=version+1,updated=excluded.updated',
        owner,
        json,
        now,
      ),
      query(
        this.db,
        'INSERT INTO cultivation_receipts(owner,request_id,operation,request_json,result_json,created) VALUES(?,?,?,?,?,?)',
        owner,
        id,
        operation,
        request,
        result,
        now,
      ),
      ...(outcome.statements ?? []),
      query(this.db, 'DELETE FROM transaction_guard'),
    ];
    if (this.defer) this.defer(statements);
    else {
      try {
        await this.db.batch(statements);
      } catch (error) {
        const saved = await this.receipt<T>(owner, id, operation, input);
        if (saved) return saved.result;
        throw error;
      }
    }
    return outcome.result;
  }
  prepareSleep(
    owner: string,
    state: HealthyState,
    input: SleepAssessment,
    effect?: Awaited<ReturnType<typeof prepareBeastSleepEffect>>,
  ) {
    const guarded = effect
      ? {
          ...state,
          ...(effect.protectStreak ? { heartDay: input.day } : {}),
          ...(effect.protectQi ? { peaceDay: input.day } : {}),
        }
      : state;
    const outcome = assessSleep(guarded, input);
    const baseState = outcome.state;
    const next = outcome.applied && effect ? effect.apply(baseState) : baseState;
    const result = { applied: outcome.applied, delta: outcome.delta, demoted: outcome.demoted };
    return {
      state: next,
      baseState,
      result,
      statements: outcome.applied
        ? [
            query(
              this.db,
              'INSERT INTO sleep_assessments(owner,day,target,reported_at,result,qi_delta,demoted,assessed_at) VALUES(?,?,?,?,?,?,?,?)',
              owner,
              input.day,
              input.target,
              input.reportedAt,
              outcome.onTime ? 'on_time' : input.reportedAt === null ? 'unreported' : 'late',
              outcome.delta,
              Number(outcome.demoted),
              input.assessedAt,
            ),
            ...(effect?.statements ?? []),
          ]
        : [],
    };
  }
  async score(owner: string, input: SleepAssessment) {
    const before = await this.read(owner);
    const effect = await prepareBeastSleepEffect(
      this.db,
      owner,
      before.state,
      input,
      () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296,
    );
    return this.mutate(
      owner,
      'sleep:' + input.day,
      'sleep',
      { day: input.day },
      input.assessedAt,
      (state) => {
        const scored = this.prepareSleep(owner, state, input, effect);
        if (effect)
          scored.statements.push(
            query(
              this.db,
              'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM cultivation_accounts WHERE owner=?)=? THEN 1 ELSE 0 END',
              owner,
              before.version + 1,
            ),
          );
        return scored;
      },
    );
  }
  async checkIn(owner: string, id: string, input: unknown, now: number) {
    return this.mutate(owner, id, 'daily-checkin', input, now, (state) => {
      const r = claimDailyReward(state, now);
      return {
        state: r.state,
        result: { dailyReward: r.reward, calendarDay: r.calendarDay },
        statements: [
          query(
            this.db,
            'INSERT INTO daily_checkins(owner,day,cycle_start_day,reward_day,reward_json,created) VALUES(?,?,?,?,?,?)',
            owner,
            r.calendarDay,
            r.cycleStartDay,
            r.reward.day,
            JSON.stringify(r.reward),
            now,
          ),
        ],
      };
    });
  }
  // Join the habit log's guarded batch. SQL updates the current balance, so a
  // concurrent task reward/check-in cannot be overwritten by a stale snapshot.
  prepareHabitTicket(owner: string, habitId: string, day: number, weekStart: number, now: number) {
    return [
      query(
        this.db,
        'INSERT INTO habit_ticket_awards(owner,habit_id,day,week_start,created) VALUES(?,?,?,?,?)',
        owner,
        habitId,
        day,
        weekStart,
        now,
      ),
      query(
        this.db,
        `INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)
         ON CONFLICT(owner) DO UPDATE SET
         state_json=json_set(cultivation_accounts.state_json,'$.tickets',COALESCE(json_extract(cultivation_accounts.state_json,'$.tickets'),0)+1),
         version=cultivation_accounts.version+1,updated=excluded.updated`,
        owner,
        JSON.stringify({ ...initialHealthy(), tickets: 1 }),
        now,
      ),
    ];
  }
  async awardTask(owner: string, taskId: string, now: number) {
    return this.mutate(owner, 'ticket:' + taskId, 'task-ticket', { taskId }, now, (state) => {
      const next = { ...state, tickets: state.tickets + 1 };
      return {
        state: next,
        result: { ticket: 1 },
        statements: [
          query(
            this.db,
            "INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND status='completed' AND deleted_at IS NULL) THEN 1 ELSE 0 END",
            owner,
            taskId,
          ),
          query(
            this.db,
            'INSERT INTO task_ticket_awards(owner,task_id,created) VALUES(?,?,?)',
            owner,
            taskId,
            now,
          ),
        ],
      };
    });
  }
  async syncTaskTickets(owner: string, now: number) {
    if ((await this.read(owner)).state.suspended) return;
    const setup = await query(
      this.db,
      'SELECT owner FROM schedule_settings WHERE owner=? AND sleep_minutes IS NOT NULL',
      owner,
    ).first();
    if (!setup) return;
    const tasks = (
      await query(
        this.db,
        "SELECT t.id FROM tasks t WHERE t.owner=? AND t.status='completed' AND t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM task_ticket_awards a WHERE a.owner=t.owner AND a.task_id=t.id) ORDER BY t.created LIMIT 25",
        owner,
      ).all<{ id: string }>()
    ).results;
    for (const task of tasks) await this.awardTask(owner, task.id, now);
  }
}
