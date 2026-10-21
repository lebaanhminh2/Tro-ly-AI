import { initialBeastAccount, validBeastAccount } from '../../domain/linh-thu-account.ts';
import { beastSpecies } from '../../domain/linh-thu-catalog.ts';
import { BEAST_TRAINING } from '../../domain/linh-thu-training.ts';
import type { HealthyState } from '../../domain/healthy.ts';
import type { BeastMutation, BeastSnapshot, BeastStore } from '../../ports/linh-thu-store.ts';
import { query } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import { D1HabitStore } from './habit-store.ts';
import { D1BeastReader, BEAST_SACRIFICE_BLOCK_SQL } from './linh-thu-reader.ts';

/** Coordinates assessed habit state and guarded, receipt-backed mutations. */
export class D1BeastStore extends D1BeastReader implements BeastStore {
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
          if (outcome.protection) {
            const protection = outcome.protection;
            statements.push(
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM beasts WHERE owner=? AND id=? AND sacrificed_at IS NULL) THEN 1 ELSE 0 END',
                owner,
                protection.beastId,
              ),
              query(
                this.db,
                'UPDATE beasts SET is_protected=? WHERE owner=? AND id=? AND sacrificed_at IS NULL',
                protection.isProtected ? 1 : 0,
                owner,
                protection.beastId,
              ),
            );
          }
          if (outcome.sacrifice) {
            const ids = JSON.stringify(outcome.sacrifice);
            statements.push(
              query(
                this.db,
                `INSERT INTO transaction_guard SELECT CASE WHEN
                (SELECT COUNT(*) FROM beasts b CROSS JOIN (SELECT ? AS day) ctx
                  WHERE b.owner=? AND b.sacrificed_at IS NULL AND b.id IN(SELECT value FROM json_each(?))
                  AND (${BEAST_SACRIFICE_BLOCK_SQL}) IS NULL)=? THEN 1 ELSE 0 END`,
                day,
                owner,
                ids,
                outcome.sacrifice.length,
              ),
              query(
                this.db,
                'UPDATE beasts SET sacrificed_at=? WHERE owner=? AND id IN(SELECT value FROM json_each(?)) AND sacrificed_at IS NULL',
                now,
                owner,
                ids,
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
                `INSERT INTO beast_number_counters(owner,species_id,next_number) VALUES(?,?,2)
             ON CONFLICT(owner,species_id) DO UPDATE SET next_number=beast_number_counters.next_number+1`,
                owner,
                entry.id,
              ),
              query(
                this.db,
                `INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt,individual_number)
             VALUES(?,?,?,?,?,?,(SELECT next_number-1 FROM beast_number_counters WHERE owner=? AND species_id=?))`,
                owner,
                beast.id,
                entry.id,
                beast.attemptId,
                now,
                requestId,
                owner,
                entry.id,
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
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM beasts WHERE owner=? AND id=? AND species_id=? AND sacrificed_at IS NULL) THEN 1 ELSE 0 END',
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
