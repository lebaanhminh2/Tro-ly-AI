import { settleBeastUltimate, type BeastUltimate } from '../../domain/linh-thu-ultimates.ts';
import { query, type Database } from './database.ts';
import { D1BeastStore } from './linh-thu-store.ts';
import { HealthyStore } from './healthy-store.ts';
import { prepareBeastEffect, creditBeastReward } from './linh-thu-effects.ts';

/** Rendezvous after both habit and sleep settle; always joins their original assigned day. */
export async function settleOneCombinedBeastDay(
  db: Database,
  owner: string,
  now: number,
  random: () => number,
) {
  const row = await query(
    db,
    `SELECT b.day,json_extract(b.result_json,'$.full') AS full,json_extract(b.result_json,'$.companionAttempt') AS companion_attempt,s.result,d.end_at,s.reported_at
     FROM beast_day_settlements b JOIN sleep_assessments s ON s.owner=b.owner AND s.day=b.day
     JOIN schedule_days d ON d.owner=b.owner AND d.day=b.day
     WHERE b.owner=? AND NOT EXISTS(SELECT 1 FROM beast_skill_events e WHERE e.owner=b.owner AND e.kind='combined' AND e.source_id=CAST(b.day AS TEXT))
     ORDER BY b.day LIMIT 1`,
    owner,
  ).first<{
    day: number;
    full: number;
    companion_attempt: string | null;
    result: string;
    end_at: number;
    reported_at: number | null;
  }>();
  if (!row) return false;
  const healthy = new HealthyStore(db),
    before = await healthy.read(owner);
  const effect = await prepareBeastEffect(
    db,
    owner,
    {
      kind: 'combined',
      sourceId: String(row.day),
      day: row.day,
      at: row.end_at - 1,
      qualified: !before.state.suspended && !!row.full && row.result === 'on_time',
    },
    now,
    random,
    row.companion_attempt ? JSON.parse(row.companion_attempt) : undefined,
  );
  if (!effect) return false;
  await healthy.mutate(
    owner,
    'beast_combined_' + row.day,
    'beast-combined',
    { day: row.day },
    now,
    (state) => ({
      state: effect.apply(state),
      result: effect.result,
      statements: effect.statements,
    }),
  );
  return true;
}

/** Wait for the original week's daily work before exchanging unused protection. */
export async function settleOneExpiredBeastUltimate(db: Database, owner: string, now: number) {
  const row = await query(
    db,
    `SELECT state_json FROM beast_ultimates u WHERE owner=? AND expires_at<=?
    AND COALESCE(json_extract(state_json,'$.settled'),0)=0 AND COALESCE(json_extract(state_json,'$.cancelled'),0)=0
    AND NOT EXISTS(SELECT 1 FROM schedule_days d JOIN cultivation_accounts c ON c.owner=d.owner
      WHERE d.owner=u.owner AND d.day>=MAX(u.week_start,(SELECT activated_day FROM beast_accounts WHERE owner=u.owner)) AND d.day<u.week_start+7 AND
       (d.end_at>? OR (NOT EXISTS(SELECT 1 FROM sleep_assessments s WHERE s.owner=d.owner AND s.day=d.day)
        AND COALESCE(json_extract(c.state_json,'$.suspended'),0)=0)))
    AND NOT EXISTS(SELECT 1 FROM schedule_days d WHERE d.owner=u.owner AND d.day>=MAX(u.week_start,(SELECT activated_day FROM beast_accounts WHERE owner=u.owner)) AND d.day<u.week_start+7
      AND NOT EXISTS(SELECT 1 FROM beast_day_settlements b WHERE b.owner=d.owner AND b.day=d.day))
    AND NOT EXISTS(SELECT 1 FROM beast_day_settlements b JOIN sleep_assessments s ON s.owner=b.owner AND s.day=b.day
      WHERE b.owner=u.owner AND b.day>=u.week_start AND b.day<u.week_start+7
      AND NOT EXISTS(SELECT 1 FROM beast_skill_events e WHERE e.owner=b.owner AND e.kind='combined' AND e.source_id=CAST(b.day AS TEXT)))
    ORDER BY week_start LIMIT 1`,
    owner,
    now,
    now,
  ).first<{ state_json: string }>();
  if (!row) return false;
  const saved = JSON.parse(row.state_json) as BeastUltimate,
    store = new D1BeastStore(db),
    account = await store.read(owner);
  await store.transact(
    owner,
    'beast_expiry_' + saved.week,
    'ultimate_expiry',
    { week: saved.week },
    saved.day,
    now,
    account.version,
    (snapshot, healthy) => {
      const outcome = settleBeastUltimate(saved, now);
      return {
        state: snapshot.state,
        healthy: creditBeastReward(healthy, outcome.reward),
        ultimate: outcome.state,
        result: { reward: outcome.reward },
      };
    },
  );
  return true;
}
