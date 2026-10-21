import {
  initialBeastAccount,
  validBeastAccount,
  type BeastAccount,
  type OwnedBeast,
} from '../../domain/linh-thu-account.ts';
import { beastSpecies } from '../../domain/linh-thu-catalog.ts';
import type { BeastAttempt } from '../../domain/linh-thu-training.ts';
import type { BeastUltimate } from '../../domain/linh-thu-ultimates.ts';
import type {
  BeastSnapshot,
  BeastRoleSelection,
  BeastTowerRow,
  BeastRewardChoice,
  BeastSummonChoice,
  BeastCollectionOverview,
} from '../../ports/linh-thu-store.ts';
import { query, type Database } from './database.ts';

type CollectionRow = {
  id: string;
  species_id: string;
  current_attempt_id: string;
  acquired_at: number;
  individual_number: number;
  is_protected: number;
  sacrifice_blocked_reason?: string | null;
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
    individualNumber: row.individual_number,
    isProtected: !!row.is_protected,
    ...(row.sacrifice_blocked_reason !== undefined
      ? { sacrificeBlockedReason: row.sacrifice_blocked_reason }
      : {}),
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

/** Shared by previews and the commit guard; b is a beast, ctx contains its operating day. */
export const BEAST_SACRIFICE_BLOCK_SQL = `CASE
  WHEN b.is_protected=1 THEN 'Đã đánh dấu bảo vệ'
  WHEN EXISTS(SELECT 1 FROM beast_roles r WHERE r.owner=b.owner AND r.beast_id=b.id AND
    (r.effective_day>ctx.day OR r.effective_day=(SELECT MAX(effective_day) FROM beast_roles
      WHERE owner=r.owner AND role=r.role AND effective_day<=ctx.day))) THEN 'Đang giữ vai trò hoặc chờ đổi vai trò'
  WHEN EXISTS(SELECT 1 FROM beast_ultimates u WHERE u.owner=b.owner AND u.beast_id=b.id
    AND COALESCE(json_extract(u.state_json,'$.cancelled'),0)=0
    AND COALESCE(json_extract(u.state_json,'$.settled'),0)=0) THEN 'Hiệu ứng chưa kết thúc hoặc chưa quyết toán'
  WHEN EXISTS(SELECT 1 FROM beast_tower_runs t WHERE t.owner=b.owner
    AND json_extract(t.eligibility_json,'$.rescueBeastId')=b.id
    AND json_extract(t.state_json,'$.status') IN('choosing','decision')) THEN 'Đang liên quan đến lượt tháp'
  WHEN EXISTS(SELECT 1 FROM beast_choices c JOIN beast_ultimates u ON u.owner=c.owner
    AND u.beast_id=b.id AND c.created>=u.activated_at AND c.created<=u.expires_at
    WHERE c.owner=b.owner AND c.resolved_at IS NULL) THEN 'Còn lựa chọn thưởng chưa hoàn tất'
  WHEN EXISTS(SELECT 1 FROM schedule_days d JOIN beast_accounts ba ON ba.owner=d.owner
    WHERE d.owner=b.owner AND d.day>=ba.activated_day AND d.day<ctx.day
    AND (NOT EXISTS(SELECT 1 FROM beast_day_settlements s WHERE s.owner=d.owner AND s.day=d.day)
      OR NOT EXISTS(SELECT 1 FROM sleep_assessments s WHERE s.owner=d.owner AND s.day=d.day)
      OR NOT EXISTS(SELECT 1 FROM beast_skill_events e WHERE e.owner=d.owner AND e.kind='combined' AND e.source_id=CAST(d.day AS TEXT)))
    AND EXISTS(SELECT 1 FROM beast_roles r WHERE r.owner=b.owner AND r.beast_id=b.id
      AND r.effective_day=(SELECT MAX(effective_day) FROM beast_roles WHERE owner=r.owner AND role=r.role AND effective_day<=d.day)))
    THEN 'Còn ngày chưa quyết toán'
  ELSE NULL END`;

/** SQL reads shared by effect preparation and the transactional store. */
export class D1BeastReader {
  protected readonly db: Database;

  constructor(db: Database) {
    this.db = db;
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

  async collection(
    owner: string,
    cursor: string | null = null,
    limit = 24,
    speciesId: string | null = null,
    sacrifice?: { day: number; now: number },
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Error('INVALID_BEAST_PAGE');
    if (speciesId !== null) beastSpecies(speciesId);
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
        `SELECT b.id,b.species_id,b.current_attempt_id,b.acquired_at,b.individual_number,b.is_protected,a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json
       ${sacrifice ? `,${BEAST_SACRIFICE_BLOCK_SQL} AS sacrifice_blocked_reason` : ''}
       FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.id=b.current_attempt_id
       ${sacrifice ? 'CROSS JOIN (SELECT ? AS day) ctx' : ''}
       WHERE b.owner=? AND b.sacrificed_at IS NULL ${speciesId === null ? '' : 'AND b.species_id=?'}
       AND (b.acquired_at,b.id)<(?,?)
       ORDER BY b.acquired_at DESC,b.id DESC LIMIT ?`,
        ...(sacrifice ? [sacrifice.day] : []),
        owner,
        ...(speciesId === null ? [] : [speciesId]),
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

  async collectionOverview(owner: string): Promise<BeastCollectionOverview> {
    // Rank current attempts only: discoveries deliberately include past attempts.
    // Windowing keeps transport bounded by species rather than inventory size.
    const rows = (
      await query(
        this.db,
        `
      SELECT * FROM (
        SELECT b.id,b.species_id,b.current_attempt_id,b.acquired_at,b.individual_number,b.is_protected,
          a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json,
          COUNT(*) OVER (PARTITION BY b.species_id) AS total,
          ROW_NUMBER() OVER (PARTITION BY b.species_id ORDER BY a.form DESC,
            CASE WHEN a.form=4 AND a.earned=a.capacity AND a.gray=0 THEN 1 ELSE 0 END DESC,
            COALESCE(1.0*a.earned/NULLIF(a.earned+a.gray,0),0) DESC,
            b.acquired_at DESC,b.id DESC) AS position
        FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.id=b.current_attempt_id
        WHERE b.owner=? AND b.sacrificed_at IS NULL
      ) WHERE position=1`,
        owner,
      ).all<CollectionRow & { total: number }>()
    ).results;
    return Object.fromEntries(
      rows.map((row) => [row.species_id, { count: row.total, best: owned(row) }]),
    );
  }

  async individual(owner: string, id: string, attemptId?: string): Promise<OwnedBeast | null> {
    const row = await query(
      this.db,
      `SELECT b.id,b.species_id,a.id AS current_attempt_id,b.acquired_at,b.individual_number,b.is_protected,a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json
       FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.beast_id=b.id AND a.id=COALESCE(?,b.current_attempt_id)
       WHERE b.owner=? AND b.id=? AND (b.sacrificed_at IS NULL OR ? IS NOT NULL)`,
      attemptId ?? null,
      owner,
      id,
      attemptId ?? null,
    ).first<CollectionRow>();
    return row ? owned(row) : null;
  }

  async sacrificeSelection(
    owner: string,
    ids: readonly string[],
    day: number,
    _now: number,
  ): Promise<OwnedBeast[]> {
    const rows = (
      await query(
        this.db,
        `SELECT b.id,b.species_id,b.current_attempt_id,b.acquired_at,b.individual_number,b.is_protected,
      a.rule_version,a.status,a.earned,a.gray,a.form,a.counters_json,${BEAST_SACRIFICE_BLOCK_SQL} AS sacrifice_blocked_reason
      FROM beasts b JOIN beast_attempts a ON a.owner=b.owner AND a.id=b.current_attempt_id
      CROSS JOIN (SELECT ? AS day) ctx
      WHERE b.owner=? AND b.sacrificed_at IS NULL AND b.id IN(SELECT value FROM json_each(?))`,
        day,
        owner,
        JSON.stringify(ids),
      ).all<CollectionRow>()
    ).results;
    return rows.map(owned);
  }

  async sacrificeOverview(owner: string, day: number) {
    const rows = (
      await query(
        this.db,
        `SELECT b.species_id,SUM(CASE WHEN (${BEAST_SACRIFICE_BLOCK_SQL}) IS NULL THEN 1 ELSE 0 END) AS available
      FROM beasts b CROSS JOIN (SELECT ? AS day) ctx WHERE b.owner=? AND b.sacrificed_at IS NULL GROUP BY b.species_id`,
        day,
        owner,
      ).all<{ species_id: string; available: number }>()
    ).results;
    return Object.fromEntries(rows.map((row) => [row.species_id, row.available]));
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
}
