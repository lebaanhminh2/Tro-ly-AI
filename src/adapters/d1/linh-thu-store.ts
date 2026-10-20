import {
  initialBeastAccount,
  validBeastAccount,
  type BeastAccount,
  type OwnedBeast,
} from '../../domain/linh-thu-account.ts';
import { beastSpecies } from '../../domain/linh-thu-catalog.ts';
import { BEAST_TRAINING, type BeastAttempt } from '../../domain/linh-thu-training.ts';
import type { HealthyState } from '../../domain/healthy.ts';
import type {
  BeastMutation,
  BeastSnapshot,
  BeastStore,
  BeastRoleSelection,
  BeastTowerRow,
  BeastRewardChoice,
  BeastSummonChoice,
} from '../../ports/linh-thu-store.ts';
import { query, type Database } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import { D1HabitStore } from './habit-store.ts';
import type { BeastUltimate } from '../../domain/linh-thu-ultimates.ts';

type CollectionRow = {
  id: string;
  species_id: string;
  current_attempt_id: string;
  acquired_at: number;
  rule_version: 1;
  status: BeastAttempt['status'];
  earned: number;
  gray: number;
  form: NonNullable<BeastAttempt['form']>;
  counters_json: string;
};

function owned(row: CollectionRow): OwnedBeast {
  return {
    id: row.id,
    speciesId: row.species_id,
    attemptId: row.current_attempt_id,
    acquiredAt: row.acquired_at,
    counters: JSON.parse(row.counters_json),
    attempt: {
      speciesId: row.species_id,
      ruleVersion: row.rule_version,
      status: row.status,
      earned: row.earned,
      gray: row.gray,
      form: row.form,
    },
  };
}

export class D1BeastStore implements BeastStore {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  async initialize(owner: string, day: number, now: number): Promise<void> {
    await query(
      this.db,
      'INSERT OR IGNORE INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES(?,?,?,?,?)',
      owner,
      JSON.stringify(initialBeastAccount()),
      day,
      now,
      now,
    ).run();
  }

  async read(owner: string): Promise<BeastSnapshot> {
    const row = await query(
      this.db,
      'SELECT state_json,version,activated_day FROM beast_accounts WHERE owner=?',
      owner,
    ).first<{ state_json: string; version: number; activated_day: number }>();
    if (!row) return { state: initialBeastAccount(), version: 0, activatedDay: null };
    const state = JSON.parse(row.state_json) as BeastAccount;
    validBeastAccount(state);
    return { state, version: row.version, activatedDay: row.activated_day };
  }

  async collection(owner: string, cursor: string | null = null, limit = 24) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Error('INVALID_BEAST_PAGE');
    let at = Number.MAX_SAFE_INTEGER;
    let id = '\uffff';
    if (cursor !== null) {
      if (cursor.length > 200 || !/^\d+:[a-zA-Z0-9_-]{8,120}$/.test(cursor))
        throw Error('INVALID_BEAST_CURSOR');
      const split = cursor.indexOf(':');
      at = Number(cursor.slice(0, split));
      id = cursor.slice(split + 1);
      if (!Number.isSafeInteger(at)) throw Error('INVALID_BEAST_CURSOR');
    }
    const rows = (
      await query(
        this.db,
        `SELECT b.id,b.species_id,b.current_attempt_id,b.acquired_at,a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json
       FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.id=b.current_attempt_id
       WHERE b.owner=? AND (b.acquired_at<? OR (b.acquired_at=? AND b.id<?))
       ORDER BY b.acquired_at DESC,b.id DESC LIMIT ?`,
        owner,
        at,
        at,
        id,
        limit + 1,
      ).all<CollectionRow>()
    ).results;
    const selected = rows.slice(0, limit);
    const beasts = selected.map(owned);
    const last = selected.at(-1);
    return {
      beasts,
      nextCursor: rows.length > limit && last ? `${last.acquired_at}:${last.id}` : null,
    };
  }

  async individual(owner: string, id: string, attemptId?: string): Promise<OwnedBeast | null> {
    const row = await query(
      this.db,
      `SELECT b.id,b.species_id,a.id AS current_attempt_id,b.acquired_at,a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json
       FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.beast_id=b.id AND a.id=COALESCE(?,b.current_attempt_id)
       WHERE b.owner=? AND b.id=?`,
      attemptId ?? null,
      owner,
      id,
    ).first<CollectionRow>();
    return row ? owned(row) : null;
  }

  async speciesCounts(owner: string): Promise<Record<string, number>> {
    const rows = (
      await query(
        this.db,
        'SELECT species_id,COUNT(*) AS total FROM beasts WHERE owner=? GROUP BY species_id',
        owner,
      ).all<{ species_id: string; total: number }>()
    ).results;
    return Object.fromEntries(rows.map((row) => [row.species_id, row.total]));
  }

  async discoveries(owner: string) {
    const rows = (
      await query(
        this.db,
        `SELECT b.species_id,MAX(a.form) AS form,
       MAX(CASE WHEN a.form=4 AND a.earned+a.gray=a.capacity AND a.gray<=a.capacity/20 THEN 1 ELSE 0 END) AS awakened,
       MAX(CASE WHEN a.form=4 AND a.earned=a.capacity AND a.gray=0 THEN 1 ELSE 0 END) AS perfect
       FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.beast_id=b.id
       WHERE b.owner=? GROUP BY b.species_id`,
        owner,
      ).all<{ species_id: string; form: number; awakened: number; perfect: number }>()
    ).results;
    return Object.fromEntries(
      rows.map((row) => [
        row.species_id,
        {
          form: row.form,
          awakened: !!row.awakened,
          perfect: !!row.perfect,
        },
      ]),
    );
  }

  async ultimate(owner: string, week: number): Promise<BeastUltimate | null> {
    const row = await query(
      this.db,
      'SELECT state_json FROM beast_ultimates WHERE owner=? AND week_start=?',
      owner,
      week,
    ).first<{ state_json: string }>();
    return row ? JSON.parse(row.state_json) : null;
  }
  async sleepTarget(owner: string, day: number): Promise<number | null> {
    return (
      (
        await query(
          this.db,
          'SELECT target_sleep FROM schedule_days WHERE owner=? AND day=? AND asleep_at IS NULL',
          owner,
          day,
        ).first<{ target_sleep: number }>()
      )?.target_sleep ?? null
    );
  }
  async dayEnd(owner: string, day: number): Promise<number | null> {
    return (
      (
        await query(
          this.db,
          'SELECT end_at FROM schedule_days WHERE owner=? AND day=?',
          owner,
          day,
        ).first<{ end_at: number }>()
      )?.end_at ?? null
    );
  }

  async rewardChoice(owner: string, id: string): Promise<BeastRewardChoice | null> {
    const row = await query(
      this.db,
      "SELECT state_json,result_json FROM beast_choices WHERE owner=? AND id=? AND kind='reward'",
      owner,
      id,
    ).first<{ state_json: string; result_json: string | null }>();
    return row
      ? {
          id,
          options: JSON.parse(row.state_json).options,
          result: row.result_json ? JSON.parse(row.result_json) : null,
        }
      : null;
  }
  async summonChoice(owner: string): Promise<BeastSummonChoice | null> {
    const row = await query(
      this.db,
      "SELECT id,state_json FROM beast_choices WHERE owner=? AND kind='summon' AND resolved_at IS NULL ORDER BY created LIMIT 1",
      owner,
    ).first<{ id: string; state_json: string }>();
    return row ? { ...JSON.parse(row.state_json), id: row.id, result: null } : null;
  }

  async pendingRewards(owner: string): Promise<BeastRewardChoice[]> {
    const rows = (
      await query(
        this.db,
        "SELECT id,state_json FROM beast_choices WHERE owner=? AND kind='reward' AND resolved_at IS NULL ORDER BY created,id LIMIT 20",
        owner,
      ).all<{ id: string; state_json: string }>()
    ).results;
    return rows.map((row) => ({
      id: row.id,
      options: JSON.parse(row.state_json).options,
      result: null,
    }));
  }
  async pendingDraws(
    owner: string,
  ): Promise<{ id: string; candidates: string[]; picks: number }[]> {
    const rows = (
      await query(
        this.db,
        "SELECT id,state_json FROM beast_choices WHERE owner=? AND kind='draw' AND resolved_at IS NULL ORDER BY created,id LIMIT 20",
        owner,
      ).all<{ id: string; state_json: string }>()
    ).results;
    return rows.map((row) => {
      const state = JSON.parse(row.state_json);
      return { id: row.id, candidates: state.candidates, picks: state.picks };
    });
  }

  async roles(owner: string, day: number) {
    const rows = (
      await query(
        this.db,
        `SELECT role,effective_day,beast_id,attempt_id FROM beast_roles r WHERE owner=? AND
       (effective_day=(SELECT MAX(effective_day) FROM beast_roles WHERE owner=r.owner AND role=r.role AND effective_day<=?) OR effective_day>?)
       ORDER BY effective_day,role LIMIT 4`,
        owner,
        day,
        day,
      ).all<{
        role: BeastRoleSelection['role'];
        effective_day: number;
        beast_id: string | null;
        attempt_id: string | null;
      }>()
    ).results;
    const selections = rows.map((row) => ({
      role: row.role,
      day: row.effective_day,
      beastId: row.beast_id,
      attemptId: row.attempt_id,
    }));
    return {
      current: selections.filter((selection) => selection.day <= day),
      pending: selections.filter((selection) => selection.day > day),
    };
  }

  async nextSettlement(owner: string): Promise<number | null> {
    const row = await query(
      this.db,
      'SELECT COALESCE((SELECT MAX(day)+1 FROM beast_day_settlements WHERE owner=a.owner),activated_day) AS day FROM beast_accounts a WHERE owner=?',
      owner,
    ).first<{ day: number }>();
    return row?.day ?? null;
  }

  async assessedHabitDay(owner: string, day: number, now: number) {
    const assessed = await new D1HabitStore(this.db).assessedDay(owner, day, now);
    return assessed.ready
      ? {
          ready: true,
          version: assessed.version,
          outcomes: assessed.outcomes.map((entry) => entry.status),
        }
      : { ready: false };
  }

  async tower(owner: string, day: number): Promise<BeastTowerRow | null> {
    const row = await query(
      this.db,
      'SELECT state_json,version,expires_at,eligibility_json FROM beast_tower_runs WHERE owner=? AND day=?',
      owner,
      day,
    ).first<{
      state_json: string;
      version: number;
      expires_at: number;
      eligibility_json: string;
    }>();
    return row
      ? {
          state: JSON.parse(row.state_json),
          version: row.version,
          expiresAt: row.expires_at,
          eligibility: JSON.parse(row.eligibility_json),
        }
      : null;
  }

  async expiredTower(owner: string, now: number): Promise<BeastTowerRow | null> {
    const row = await query(
      this.db,
      "SELECT day FROM beast_tower_runs WHERE owner=? AND expires_at<=? AND json_extract(state_json,'$.status') IN('choosing','decision') ORDER BY day LIMIT 1",
      owner,
      now,
    ).first<{ day: number }>();
    return row ? this.tower(owner, row.day) : null;
  }

  async towerEligibility(owner: string, now: number) {
    const habitVersion =
      (
        await query(this.db, 'SELECT version FROM habit_accounts WHERE owner=?', owner).first<{
          version: number;
        }>()
      )?.version ?? 0;
    const today = await new D1HabitStore(this.db).today(owner, now);
    const achieved = today.habits.filter((habit) => habit.preview?.status === 'achieved').length;
    const missed = today.habits.filter((habit) => habit.preview?.status === 'missed').length;
    const task = await query(
      this.db,
      `SELECT t.id FROM tasks t JOIN task_ticket_awards a ON a.owner=t.owner AND a.task_id=t.id
       JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
       WHERE t.owner=? AND t.status='completed' AND t.deleted_at IS NULL AND a.created>=? AND a.created<?
       AND c.completed_at>=? AND c.completed_at<? ORDER BY a.created,t.id LIMIT 1`,
      owner,
      today.day.startAt,
      today.day.endAt,
      today.day.startAt,
      today.day.endAt,
    ).first<{ id: string }>();
    const rescue = await query(
      this.db,
      "SELECT beast_id FROM beast_ultimates WHERE owner=? AND activated_at<=? AND expires_at>? AND json_extract(state_json,'$.kind')='tower_rescue' AND COALESCE(json_extract(state_json,'$.cancelled'),0)=0 LIMIT 1",
      owner,
      now,
      now,
    ).first<{ beast_id: string }>();
    return {
      day: today.day.day,
      startAt: today.day.startAt,
      endAt: today.day.endAt,
      habitVersion,
      achieved,
      missed,
      taskId: task?.id ?? null,
      eligible: achieved > 0 && missed === 0 && task !== null,
      rescueAvailable: rescue !== null,
      rescueBeastId: rescue?.beast_id ?? null,
    };
  }

  async transact<T>(
    owner: string,
    requestId: string,
    operation: string,
    input: unknown,
    day: number,
    now: number,
    expectedVersion: number,
    apply: (snapshot: BeastSnapshot, healthy: HealthyState) => BeastMutation<T>,
    deadline?: number,
  ): Promise<T> {
    const started = Date.now();
    if (
      !Number.isSafeInteger(day) ||
      !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0
    )
      throw Error('INVALID_BEAST_TRANSACTION');
    const healthy = new HealthyStore(this.db);
    const receiptOperation = 'beast-' + operation;
    const saved = await healthy.receipt<T>(owner, requestId, receiptOperation, input);
    if (saved) return saved.result;
    const snapshot = await this.read(owner);
    if (snapshot.version !== expectedVersion) throw Error('BEAST_CHANGED');
    try {
      return await healthy.mutate(
        owner,
        requestId,
        receiptOperation,
        input,
        now,
        (currentHealthy) => {
          const outcome = apply(snapshot, currentHealthy);
          validBeastAccount(outcome.state);
          const statements = [
            query(
              this.db,
              'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM beast_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END',
              owner,
              snapshot.version,
            ),
            query(
              this.db,
              `INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES(?,?,?,?,?)
           ON CONFLICT(owner) DO UPDATE SET state_json=excluded.state_json,version=beast_accounts.version+1,updated=excluded.updated`,
              owner,
              JSON.stringify(outcome.state),
              day,
              now,
              now,
            ),
          ];
          if (deadline !== undefined) {
            const commitNow = now + Math.max(0, Date.now() - started);
            if (!Number.isSafeInteger(deadline) || commitNow >= deadline)
              throw Error('BEAST_DAY_CLOSED');
            statements.unshift(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND end_at=? AND end_at>?) THEN 1 ELSE 0 END',
                owner,
                day,
                deadline,
                commitNow,
              ),
            );
          }
          if ((outcome.newBeasts?.length ?? 0) > 10) throw Error('INVALID_BEAST_BATCH');
          for (const beast of outcome.newBeasts ?? []) {
            const entry = beastSpecies(beast.speciesId);
            const rule = BEAST_TRAINING[entry.rank];
            if (![beast.id, beast.attemptId].every((id) => /^[a-zA-Z0-9_-]{8,120}$/.test(id)))
              throw Error('INVALID_BEAST_ID');
            statements.push(
              query(
                this.db,
                'INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES(?,?,?,?,?,?)',
                owner,
                beast.id,
                entry.id,
                beast.attemptId,
                now,
                requestId,
              ),
              query(
                this.db,
                `INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,created)
             VALUES(?,?,?,1,1,'ready',?,?,?)`,
                owner,
                beast.attemptId,
                beast.id,
                rule.capacity,
                JSON.stringify(rule.thresholds),
                now,
              ),
            );
          }
          for (const attempt of outcome.newAttempts ?? []) {
            const entry = beastSpecies(attempt.speciesId);
            const rule = BEAST_TRAINING[entry.rank];
            statements.push(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM beasts WHERE owner=? AND id=? AND species_id=?) THEN 1 ELSE 0 END',
                owner,
                attempt.beastId,
                entry.id,
              ),
              query(
                this.db,
                `INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,capacity,thresholds_json,created)
             VALUES(?,?,?,1,1,'ready',?,?,?)`,
                owner,
                attempt.id,
                attempt.beastId,
                rule.capacity,
                JSON.stringify(rule.thresholds),
                now,
              ),
              query(
                this.db,
                'UPDATE beasts SET current_attempt_id=? WHERE owner=? AND id=?',
                attempt.id,
                owner,
                attempt.beastId,
              ),
              // A reset cancels this individual's running effects, never its account-wide weekly slot.
              query(
                this.db,
                "UPDATE beast_tower_runs SET state_json=json_set(state_json,'$.rescueAvailable',json('false')),version=version+1,updated=? WHERE owner=? AND json_extract(eligibility_json,'$.rescueBeastId')=? AND json_extract(state_json,'$.status') IN('choosing','decision') AND json_extract(state_json,'$.rescueAvailable')=1",
                now,
                owner,
                attempt.beastId,
              ),
              query(
                this.db,
                "UPDATE beast_ultimates SET state_json=json_set(state_json,'$.cancelled',json('true')) WHERE owner=? AND beast_id=?",
                owner,
                attempt.beastId,
              ),
            );
          }
          for (const update of outcome.updateAttempts ?? []) {
            statements.push(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM beast_attempts a JOIN beasts b ON b.owner=a.owner AND b.id=a.beast_id WHERE a.owner=? AND a.id=? AND b.species_id=?) THEN 1 ELSE 0 END',
                owner,
                update.id,
                update.attempt.speciesId,
              ),
              query(
                this.db,
                `UPDATE beast_attempts SET status=?,earned=?,gray=?,form=COALESCE(?,form),counters_json=COALESCE(?,counters_json),
             started_day=COALESCE(?,started_day),ended_day=COALESCE(?,ended_day),last_settled_day=COALESCE(?,last_settled_day) WHERE owner=? AND id=?`,
                update.attempt.status,
                update.attempt.earned,
                update.attempt.gray,
                update.attempt.form ?? null,
                update.counters ? JSON.stringify(update.counters) : null,
                update.startedDay ?? null,
                update.endedDay ?? null,
                update.lastSettledDay ?? null,
                owner,
                update.id,
              ),
            );
          }
          for (const selection of outcome.roleChanges ?? []) {
            if (selection.remove)
              statements.push(
                query(
                  this.db,
                  'DELETE FROM beast_roles WHERE owner=? AND role=? AND effective_day=?',
                  owner,
                  selection.role,
                  selection.day,
                ),
              );
            else
              statements.push(
                query(
                  this.db,
                  `INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)
           ON CONFLICT(owner,role,effective_day) DO UPDATE SET beast_id=excluded.beast_id,attempt_id=excluded.attempt_id,created=excluded.created`,
                  owner,
                  selection.role,
                  selection.day,
                  selection.beastId,
                  selection.attemptId,
                  now,
                ),
              );
          }
          if (outcome.habitVersion !== undefined)
            statements.push(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM habit_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END',
                owner,
                outcome.habitVersion,
              ),
            );
          if (outcome.requiredOpenTasks?.length)
            statements.push(
              query(
                this.db,
                `INSERT INTO transaction_guard SELECT CASE WHEN
         (SELECT COUNT(*) FROM tasks t WHERE owner=? AND id IN(SELECT value FROM json_each(?)) AND status='active'
          AND deleted_at IS NULL AND archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM task_ticket_awards a WHERE a.owner=t.owner AND a.task_id=t.id))=?
         THEN 1 ELSE 0 END`,
                owner,
                JSON.stringify(outcome.requiredOpenTasks),
                outcome.requiredOpenTasks.length,
              ),
            );
          if (outcome.ultimate) {
            const u = outcome.ultimate;
            statements.push(
              query(
                this.db,
                `INSERT INTO beast_ultimates(owner,week_start,beast_id,attempt_id,skill_version,activated_at,expires_at,state_json)
           VALUES(?,?,?,?,1,?,?,?) ON CONFLICT(owner,week_start) DO UPDATE SET state_json=excluded.state_json`,
                owner,
                u.week,
                u.beastId,
                u.attemptId,
                u.activatedAt,
                u.expiresAt,
                JSON.stringify(u),
              ),
            );
          }
          if (outcome.resolveChoice)
            statements.push(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM beast_choices WHERE owner=? AND id=? AND resolved_at IS NULL) THEN 1 ELSE 0 END',
                owner,
                outcome.resolveChoice.id,
              ),
              query(
                this.db,
                'UPDATE beast_choices SET result_json=?,resolved_at=? WHERE owner=? AND id=?',
                JSON.stringify(outcome.resolveChoice.result),
                now,
                owner,
                outcome.resolveChoice.id,
              ),
            );
          if (outcome.summonChoice)
            statements.push(
              query(
                this.db,
                "INSERT INTO beast_choices(owner,id,kind,state_json,created) VALUES(?,?,'summon',?,?)",
                owner,
                outcome.summonChoice.id,
                JSON.stringify(outcome.summonChoice),
                now,
              ),
            );
          for (const entry of outcome.rewardChoices ?? [])
            statements.push(
              query(
                this.db,
                "INSERT INTO beast_choices(owner,id,kind,state_json,created) VALUES(?,?,'reward',?,?)",
                owner,
                entry.id,
                JSON.stringify(entry.choice),
                now,
              ),
            );
          if (outcome.settlement) {
            const settlement = outcome.settlement;
            statements.push(
              query(
                this.db,
                `INSERT INTO beast_day_settlements(owner,day,training_beast_id,companion_beast_id,outcomes_json,result_json,created)
           VALUES(?,?,?,?,?,?,?)`,
                owner,
                settlement.day,
                settlement.trainingId,
                settlement.companionId,
                JSON.stringify(settlement.outcomes),
                JSON.stringify(settlement.result),
                now,
              ),
            );
          }
          if (outcome.tower) {
            const tower = outcome.tower;
            statements.push(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM beast_tower_runs WHERE owner=? AND day=?),0)=? THEN 1 ELSE 0 END',
                owner,
                tower.state.day,
                tower.version,
              ),
            );
            if (tower.requiredTaskId)
              statements.push(
                query(
                  this.db,
                  `INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks t
           JOIN task_ticket_awards a ON a.owner=t.owner AND a.task_id=t.id JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
           WHERE t.owner=? AND t.id=? AND t.status='completed' AND t.deleted_at IS NULL AND a.created>=? AND a.created<?
           AND c.completed_at>=? AND c.completed_at<?) THEN 1 ELSE 0 END`,
                  owner,
                  tower.requiredTaskId,
                  tower.startAt!,
                  tower.expiresAt,
                  tower.startAt!,
                  tower.expiresAt,
                ),
              );
            statements.push(
              query(
                this.db,
                `INSERT INTO beast_tower_runs(owner,day,state_json,eligibility_json,expires_at,created,updated) VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(owner,day) DO UPDATE SET state_json=excluded.state_json,version=beast_tower_runs.version+1,updated=excluded.updated`,
                owner,
                tower.state.day,
                JSON.stringify(tower.state),
                JSON.stringify(tower.eligibility),
                tower.expiresAt,
                now,
                now,
              ),
            );
          }
          return { state: outcome.healthy, result: outcome.result, statements };
        },
      );
    } catch (error) {
      if (
        (await this.read(owner)).version !== snapshot.version ||
        /transaction_guard|CHECK constraint/i.test(String(error))
      )
        throw Error('BEAST_CHANGED');
      throw error;
    }
  }
}
