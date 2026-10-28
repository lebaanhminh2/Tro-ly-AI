import { query, type Database } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import { ScheduleStore } from './schedule-store.ts';

const fields = ['achieved', 'lessons', 'tomorrow'] as const;
type Entry = {
  day: number;
  achieved: string;
  lessons: string;
  tomorrow: string;
  version: number;
  updated: number;
  deleted: number;
  rewarded: number;
};
type Result = { saved: true; day: number; version: number; deleted: boolean; reward: boolean };

export class JournalStore {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  private async currentDay(owner: string, now: number) {
    const day = await new ScheduleStore(this.db).ensureDay(owner, now);
    if (!day || now < day.start_at || now >= day.end_at) throw Error('NO_ACTIVE_DAY');
    return day;
  }

  private async entry(owner: string, day: number) {
    return query(
      this.db,
      `SELECT j.*,EXISTS(SELECT 1 FROM journal_reward_claims c WHERE c.owner=j.owner AND c.day=j.day) AS rewarded FROM daily_journals j WHERE j.owner=? AND j.day=?`,
      owner,
      day,
    ).first<Entry>();
  }

  async read(owner: string, now: number, selected?: number, before?: number) {
    const current = await this.currentDay(owner, now);
    if (selected !== undefined) {
      this.validateDay(selected, current.day);
      const row = await this.entry(owner, selected);
      return {
        owner,
        today: current.day,
        entry: row && !row.deleted ? row : null,
        version: row?.version ?? 0,
      };
    }
    if (before !== undefined) this.validateDay(before, current.day + 1);
    const rows = (
      await query(
        this.db,
        `SELECT j.*,EXISTS(SELECT 1 FROM journal_reward_claims c WHERE c.owner=j.owner AND c.day=j.day) AS rewarded FROM daily_journals j WHERE j.owner=? AND j.deleted=0 AND j.day<? ORDER BY j.day DESC LIMIT 31`,
        owner,
        before ?? current.day + 1,
      ).all<Entry>()
    ).results;
    const entries = rows.slice(0, 30);
    return {
      owner,
      today: current.day,
      entries,
      next: rows.length > 30 ? entries.at(-1)!.day : null,
    };
  }

  private validateDay(day: unknown, today: number): asserts day is number {
    if (!Number.isSafeInteger(day) || Number(day) < 0 || Number(day) > today)
      throw Error('INVALID_JOURNAL_DAY');
  }

  async write(owner: string, id: string, input: Record<string, unknown>, now: number) {
    const allowed =
      input.operation === 'save'
        ? ['operation', 'day', 'version', ...fields]
        : ['operation', 'day', 'version'];
    if (
      !['save', 'delete'].includes(String(input.operation)) ||
      Object.keys(input).some((key) => !allowed.includes(key))
    )
      throw Error('INVALID_JOURNAL_OPERATION');
    if (!Number.isSafeInteger(input.version) || Number(input.version) < 0)
      throw Error('INVALID_JOURNAL_VERSION');
    const text = Object.fromEntries(
      fields.map((key) => {
        const value = input.operation === 'delete' ? '' : input[key];
        if (
          typeof value !== 'string' ||
          value.length > 4000 ||
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
        )
          throw Error('INVALID_JOURNAL_TEXT');
        return [key, value.trim()];
      }),
    ) as Record<(typeof fields)[number], string>;
    if (input.operation === 'save' && !fields.some((key) => text[key]))
      throw Error('INVALID_JOURNAL_EMPTY');
    // A digest binds the receipt to the full content without copying private
    // journal text into a second, long-lived ledger or exceeding its size cap.
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify({ ...input, ...text })),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const healthy = new HealthyStore(this.db);
    const receipt = await healthy.receipt<Result>(owner, id, 'journal', fingerprint);
    if (receipt) return { result: receipt.result, account: await healthy.read(owner) };
    const current = await this.currentDay(owner, now);
    this.validateDay(input.day, current.day);
    const day = input.day;
    // Retry only wallet contention. A competing journal edit is a visible
    // conflict, never an implicit last-write-wins overwrite.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await healthy.mutateWithAccount(
          owner,
          id,
          'journal',
          fingerprint,
          now,
          async (state) => {
            const previous = await this.entry(owner, day);
            if ((previous?.version ?? 0) !== input.version) throw Error('JOURNAL_CHANGED');
            if (input.operation === 'delete' && (!previous || previous.deleted))
              throw Error('JOURNAL_NOT_FOUND');
            const claimed = await query(
              this.db,
              'SELECT 1 AS found FROM journal_reward_claims WHERE owner=? AND day=?',
              owner,
              day,
            ).first();
            const reward = input.operation === 'save' && day === current.day && !claimed;
            const result: Result = {
              saved: true,
              day,
              version: Number(input.version) + 1,
              deleted: input.operation === 'delete',
              reward,
            };
            const statements = [
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM daily_journals WHERE owner=? AND day=?),0)=? THEN 1 ELSE 0 END',
                owner,
                day,
                input.version,
              ),
              query(
                this.db,
                'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND start_at<=? AND end_at>?) THEN 1 ELSE 0 END',
                owner,
                current.day,
                now,
                now,
              ),
              query(
                this.db,
                `INSERT INTO daily_journals(owner,day,achieved,lessons,tomorrow,version,deleted,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner,day) DO UPDATE SET achieved=excluded.achieved,lessons=excluded.lessons,tomorrow=excluded.tomorrow,version=excluded.version,deleted=excluded.deleted,updated=excluded.updated`,
                owner,
                day,
                text.achieved,
                text.lessons,
                text.tomorrow,
                result.version,
                Number(result.deleted),
                now,
              ),
            ];
            if (reward)
              statements.push(
                query(
                  this.db,
                  'INSERT INTO journal_reward_claims(owner,day,created) VALUES(?,?,?)',
                  owner,
                  day,
                  now,
                ),
              );
            return {
              state: reward
                ? {
                    ...state,
                    qi: state.qi + 1,
                    earned: state.earned + 1,
                    tickets: state.tickets + 1,
                  }
                : state,
              result,
              statements,
            };
          },
        );
      } catch (error) {
        const receipt = await healthy.receipt<Result>(owner, id, 'journal', fingerprint);
        if (receipt) return { result: receipt.result, account: await healthy.read(owner) };
        const latest = await this.entry(owner, day);
        if ((latest?.version ?? 0) !== input.version) throw Error('JOURNAL_CHANGED');
        if (
          attempt === 2 ||
          (error instanceof Error &&
            ['JOURNAL_CHANGED', 'JOURNAL_NOT_FOUND'].includes(error.message))
        )
          throw error;
      }
    }
    throw Error('JOURNAL_CHANGED');
  }
}
