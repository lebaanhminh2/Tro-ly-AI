import { query, type Database, type Statement } from './database.ts';
import {
  initialHealthy,
  assessSleep,
  claimDailyReward,
  operatingDay,
  type SleepAssessment,
  type HealthyState,
} from '../../domain/healthy.ts';
import { prepareBeastSleepEffect, prepareBeastTaskEffect } from './linh-thu-effects.ts';
import { prepareBeastV2Effect } from './linh-thu-v2-effects.ts';
import { multiplyBeastV2Reward } from './linh-thu-v2-context.ts';
import type { MiniAppTiming } from '../observability.ts';

type Account = { state_json: string; version: number };
type Mutation<T> = { state: HealthyState; result: T; statements?: Statement[] };
function restoreHealthy(json?: string | null): HealthyState {
  const defaults = initialHealthy();
  const saved = json ? JSON.parse(json) : {};
  return { ...defaults, ...saved, inventory: { ...defaults.inventory, ...saved.inventory } };
}
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
          state: restoreHealthy(row.state_json),
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
    apply: (state: HealthyState) => Mutation<T> | Promise<Mutation<T>>,
  ): Promise<T> {
    return (await this.mutateWithAccount(owner, id, operation, input, now, apply)).result;
  }
  // Read receipt and wallet in one snapshot. The version guard below still
  // rejects any competing write while asynchronous effects are prepared.
  async mutateWithAccount<T>(
    owner: string,
    id: string,
    operation: string,
    input: unknown,
    now: number,
    apply: (state: HealthyState) => Mutation<T> | Promise<Mutation<T>>,
    timing?: MiniAppTiming,
  ) {
    if (!/^\d+$/.test(owner) || !id || id.length > 120 || !operation || operation.length > 40)
      throw Error('INVALID_LEDGER_REQUEST');
    const request = JSON.stringify(input);
    if (!request || request.length > 12000) throw Error('INVALID_LEDGER_REQUEST');
    const read = async () => {
      const row = await query(
        this.db,
        `SELECT a.state_json,a.version,r.operation,r.request_json,r.result_json
         FROM (SELECT ? AS owner) o
         LEFT JOIN cultivation_accounts a ON a.owner=o.owner
         LEFT JOIN cultivation_receipts r ON r.owner=o.owner AND r.request_id=?`,
        owner,
        id,
      ).first<{
        state_json: string | null;
        version: number | null;
        operation: string | null;
        request_json: string | null;
        result_json: string | null;
      }>();
      const account = {
        state: restoreHealthy(row?.state_json),
        version: row?.version ?? 0,
      };
      if (row?.operation != null) {
        if (row.operation !== operation || row.request_json !== request)
          throw Error('REQUEST_ID_REUSED');
        return { account, receipt: { result: JSON.parse(row.result_json!) as T } };
      }
      return { account, receipt: null };
    };
    const snapshot = await (timing ? timing.measure('ledger_read', read) : read());
    if (snapshot.receipt) return { result: snapshot.receipt.result, account: snapshot.account };
    const current = snapshot.account,
      outcome = await apply(current.state);
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
        await (timing
          ? timing.measure('commit', () => this.db.batch(statements))
          : this.db.batch(statements));
      } catch (error) {
        const saved = await read();
        if (saved.receipt) return { result: saved.receipt.result, account: saved.account };
        throw error;
      }
    }
    return {
      result: outcome.result,
      account: { state: outcome.state, version: current.version + 1 },
    };
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
    const outcome = assessSleep(guarded, {
      ...input,
      rewardMultiplier: effect && 'multiplier' in effect ? effect.multiplier : 1,
    });
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
    return (
      await this.mutateWithAccount(owner, id, 'daily-checkin', input, now, async (state) => {
        const r = claimDailyReward(state, now);
        const sourceDay = await this.skillDayAt(owner, now);
        const effect = await prepareBeastV2Effect(
          this.db,
          owner,
          { kind: 'reward', day: sourceDay },
          'checkin:' + r.calendarDay,
          now,
          () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296,
          { extraEarned: r.reward },
        );
        // claimDailyReward updates calendar progress and credits base amounts.
        // Keep the progress, replace the credit with the single classified credit.
        const next = effect
          ? effect.apply({
              ...r.state,
              qi: state.qi,
              earned: state.earned,
              tickets: state.tickets,
              inventory: { ...state.inventory },
            })
          : r.state;
        const reward = effect ? multiplyBeastV2Reward(r.reward, effect.multiplier) : r.reward;
        return {
          state: next,
          result: { dailyReward: reward, calendarDay: r.calendarDay },
          statements: [
            query(
              this.db,
              'INSERT INTO daily_checkins(owner,day,cycle_start_day,reward_day,reward_json,created) VALUES(?,?,?,?,?,?)',
              owner,
              r.calendarDay,
              r.cycleStartDay,
              r.reward.day,
              JSON.stringify(reward),
              now,
            ),
            ...(effect?.statements ?? []),
          ],
        };
      })
    ).result;
  }
  private async skillDayAt(owner: string, at: number): Promise<number> {
    const row = await query(
      this.db,
      `SELECT start_minutes,(SELECT day FROM schedule_days WHERE owner=s.owner
       AND start_at<=? AND end_at>? ORDER BY day DESC LIMIT 1) AS day
       FROM schedule_settings s WHERE owner=?`,
      at,
      at,
      owner,
    ).first<{ start_minutes: number; day: number | null }>();
    return row?.day ?? operatingDay(at, row?.start_minutes ?? 0);
  }
  // Join the habit log's guarded batch. SQL updates the current balance, so a
  // concurrent task reward/check-in cannot be overwritten by a stale snapshot.
  async prepareHabitTicket(
    owner: string,
    habitId: string,
    day: number,
    weekStart: number,
    now: number,
  ) {
    const effect = await prepareBeastV2Effect(
      this.db,
      owner,
      { kind: 'reward', day },
      'habit:' + habitId + ':' + day,
      now,
      () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296,
      { extraEarned: { tickets: 1 } },
    );
    const ticketAwarded = effect?.reward.tickets ?? 1;
    return {
      ticketAwarded,
      statements: [
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
         state_json=json_set(cultivation_accounts.state_json,'$.tickets',COALESCE(json_extract(cultivation_accounts.state_json,'$.tickets'),0)+?),
         version=cultivation_accounts.version+1,updated=excluded.updated`,
          owner,
          JSON.stringify({ ...initialHealthy(), tickets: ticketAwarded }),
          now,
          ticketAwarded,
        ),
        ...(effect?.statements ?? []),
      ],
    };
  }
  async awardTask(owner: string, taskId: string, now: number) {
    return this.awardTaskFromSource(owner, taskId, now);
  }
  private async awardTaskFromSource(
    owner: string,
    taskId: string,
    now: number,
    selected?: {
      version: number;
      completed_at: number;
      source_day: number | null;
      beast_source_json: string | null;
    },
  ) {
    return (
      await this.mutateWithAccount(
        owner,
        'ticket:' + taskId,
        'task-ticket',
        { taskId },
        now,
        async (state) => {
          if (state.suspended) throw Error('CULTIVATION_SUSPENDED');
          const task =
            selected ??
            (await query(
              this.db,
              `SELECT t.version,COALESCE(c.completed_at,t.created) AS completed_at FROM tasks t
         LEFT JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
         WHERE t.owner=? AND t.id=? AND t.status='completed' AND t.deleted_at IS NULL`,
              owner,
              taskId,
            ).first<{ version: number; completed_at: number }>());
          if (!task) throw Error('TASK_NOT_COMPLETED');
          const sourceDay =
            selected?.source_day ?? (await this.skillDayAt(owner, task.completed_at));
          const source = {
            day: sourceDay,
            at: task.completed_at,
            ...(selected ? { beastSourceJson: selected.beast_source_json } : {}),
          };
          const effect = await prepareBeastTaskEffect(
            this.db,
            owner,
            taskId,
            now,
            () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296,
            source,
          );
          const ticket = effect && 'multiplier' in effect ? effect.multiplier : 1;
          const base = { ...state, tickets: state.tickets + ticket };
          const next = effect ? effect.apply(base) : base;
          return {
            state: next,
            result: { ticket, ...(effect ? { beastEffect: effect.result } : {}) },
            statements: [
              query(
                this.db,
                "INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND status='completed' AND deleted_at IS NULL) AND EXISTS(SELECT 1 FROM schedule_settings WHERE owner=? AND sleep_minutes IS NOT NULL) THEN 1 ELSE 0 END",
                owner,
                taskId,
                task.version,
                owner,
              ),
              query(
                this.db,
                'INSERT INTO task_ticket_awards(owner,task_id,created) VALUES(?,?,?)',
                owner,
                taskId,
                task.completed_at,
              ),
              ...(effect?.statements ?? []),
            ],
          };
        },
      )
    ).result;
  }
  async syncTaskTickets(owner: string, now: number) {
    if (!/^\d+$/.test(owner)) throw Error('INVALID_LEDGER_REQUEST');
    const current = await this.read(owner);
    if (current.state.suspended) return;
    let setup: { owner: string; cutover_day: number | null } | null;
    try {
      setup = await query(
        this.db,
        `SELECT s.owner,v.cutover_day FROM schedule_settings s LEFT JOIN beast_v2_runtime v ON v.owner=s.owner
         WHERE s.owner=? AND s.sleep_minutes IS NOT NULL`,
        owner,
      ).first<{ owner: string; cutover_day: number | null }>();
    } catch (error) {
      // Historical migration checks still run the healthy-only schema. Only a
      // genuinely absent v2 table selects that compatibility path.
      if (!String(error).includes('no such table: beast_v2_runtime')) throw error;
      const legacy = await query(
        this.db,
        'SELECT owner FROM schedule_settings WHERE owner=? AND sleep_minutes IS NOT NULL',
        owner,
      ).first<{ owner: string }>();
      setup = legacy ? { ...legacy, cutover_day: null } : null;
    }
    if (!setup) return;
    const tasks = (
      await query(
        this.db,
        `SELECT t.id,t.version,r.operation,r.request_json,
         COALESCE(c.completed_at,t.created) AS completed_at,
         (SELECT day FROM schedule_days WHERE owner=t.owner AND start_at<=COALESCE(c.completed_at,t.created)
          AND end_at>COALESCE(c.completed_at,t.created) ORDER BY day DESC LIMIT 1) AS source_day,
         ${setup.cutover_day === null ? 'NULL' : 'c.beast_source_json'} AS beast_source_json FROM tasks t
         LEFT JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
         LEFT JOIN cultivation_receipts r ON r.owner=t.owner AND r.request_id='ticket:'||t.id
         WHERE t.owner=? AND t.status='completed' AND t.deleted_at IS NULL
         AND NOT EXISTS(SELECT 1 FROM task_ticket_awards a WHERE a.owner=t.owner AND a.task_id=t.id)
         ORDER BY COALESCE(c.completed_at,t.created),t.id LIMIT 25`,
        owner,
      ).all<{
        id: string;
        version: number;
        completed_at: number;
        source_day: number | null;
        beast_source_json: string | null;
        operation: string | null;
        request_json: string | null;
      }>()
    ).results;
    const pending = tasks.filter((task) => {
      if (!task.id || ('ticket:' + task.id).length > 120) throw Error('INVALID_LEDGER_REQUEST');
      if (task.operation === null) return true;
      if (
        task.operation !== 'task-ticket' ||
        task.request_json !== JSON.stringify({ taskId: task.id })
      )
        throw Error('REQUEST_ID_REUSED');
      return false;
    });
    if (!pending.length) return;
    if (setup.cutover_day !== null) {
      // One source per invocation reserves query budget for the remaining cron
      // jobs. Later invocations drain the ordered backlog without replaying it.
      await this.awardTaskFromSource(owner, pending[0]!.id, now, pending[0]!);
      return;
    }
    const rows = JSON.stringify(
      pending.map((task) => ({
        id: task.id,
        version: task.version,
        request: JSON.stringify({ taskId: task.id }),
      })),
    );
    const state = JSON.stringify({
      ...current.state,
      tickets: current.state.tickets + pending.length,
    });
    if (state.length > 12000) throw Error('INVALID_LEDGER_RESULT');
    // A bounded batch keeps the same individual receipts and version increments
    // as awardTask. All selected tasks, balance and receipts commit together.
    const statements = [
      query(
        this.db,
        `INSERT INTO transaction_guard SELECT CASE WHEN
         COALESCE((SELECT version FROM cultivation_accounts WHERE owner=?),0)=?
         AND EXISTS(SELECT 1 FROM schedule_settings WHERE owner=? AND sleep_minutes IS NOT NULL)
         AND (SELECT COUNT(*) FROM tasks t JOIN json_each(?) j ON t.id=json_extract(j.value,'$.id')
              WHERE t.owner=? AND t.version=json_extract(j.value,'$.version')
              AND t.status='completed' AND t.deleted_at IS NULL)=?
         THEN 1 ELSE 0 END`,
        owner,
        current.version,
        owner,
        rows,
        owner,
        pending.length,
      ),
      query(
        this.db,
        `INSERT INTO cultivation_accounts(owner,state_json,version,updated) VALUES(?,?,?,?)
         ON CONFLICT(owner) DO UPDATE SET state_json=excluded.state_json,version=excluded.version,updated=excluded.updated`,
        owner,
        state,
        current.version + pending.length,
        now,
      ),
      query(
        this.db,
        `INSERT INTO cultivation_receipts(owner,request_id,operation,request_json,result_json,created)
         SELECT ?,'ticket:'||json_extract(value,'$.id'),'task-ticket',json_extract(value,'$.request'),?,?
         FROM json_each(?)`,
        owner,
        JSON.stringify({ ticket: 1 }),
        now,
        rows,
      ),
      query(
        this.db,
        "INSERT INTO task_ticket_awards(owner,task_id,created) SELECT ?,json_extract(value,'$.id'),? FROM json_each(?)",
        owner,
        now,
        rows,
      ),
      query(this.db, 'DELETE FROM transaction_guard'),
    ];
    if (this.defer) this.defer(statements);
    else {
      try {
        await this.db.batch(statements);
      } catch (error) {
        // A concurrent recovery may have committed this same selection. Other
        // conflicts stay pending for the next invocation; never overwrite them.
        const saved = (
          await query(
            this.db,
            `SELECT request_id,operation,request_json FROM cultivation_receipts
             WHERE owner=? AND request_id IN (SELECT 'ticket:'||json_extract(value,'$.id') FROM json_each(?))`,
            owner,
            rows,
          ).all<{ request_id: string; operation: string; request_json: string }>()
        ).results;
        if (
          pending.every((task) =>
            saved.some(
              (receipt) =>
                receipt.request_id === 'ticket:' + task.id &&
                receipt.operation === 'task-ticket' &&
                receipt.request_json === JSON.stringify({ taskId: task.id }),
            ),
          )
        )
          return;
        throw error;
      }
    }
  }
}
