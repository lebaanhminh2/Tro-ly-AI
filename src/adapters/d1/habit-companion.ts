import type { HabitCompanion } from '../../ports/habit-companion.ts';
import { HabitService } from '../../application/habit-service.ts';
import { D1HabitStore } from './habit-store.ts';
import { query, type Database, type Statement } from './database.ts';

export class D1HabitCompanion implements HabitCompanion {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }
  private async activeDay(owner: string, now: number) {
    return query(
      this.db,
      'SELECT day,end_at FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1',
      owner,
      now,
      now,
    ).first<{ day: number; end_at: number }>();
  }
  async context(owner: string, now: number) {
    const habits = await this.findHabits(owner, '', 0, now);
    const visible = (habits.habits as unknown[]).slice(0, 6);
    return {
      ...habits,
      habits: visible,
      nextCursor: Number(habits.total) > visible.length ? visible.length : null,
      hint: 'Ghi nhận là tổng tự khai báo của ngày sinh hoạt hiện tại; không tạo hoặc ghi nhận thay user. Không thúc làm habit khi asleep/focused.',
    };
  }
  async findHabits(
    owner: string,
    search: string,
    cursor: number,
    now: number,
    status: 'active' | 'all' = 'active',
  ) {
    if (
      !/^\d+$/.test(owner) ||
      typeof search !== 'string' ||
      search.length > 100 ||
      !Number.isInteger(cursor) ||
      cursor < 0 ||
      cursor > 10000
    )
      throw Error('INVALID_COMPANION_QUERY');
    const day = await this.activeDay(owner, now);
    if (!day) return { day: null, habits: [], nextCursor: null, reason: 'no_active_day' };
    if (!['active', 'all'].includes(status)) throw Error('INVALID_COMPANION_QUERY');
    const data = await new D1HabitStore(this.db).today(owner, now, status === 'all', true, {
      search: { text: search, cursor, status },
    });
    return {
      day: data.day.day,
      unitScale: 1,
      total: data.searchPage!.total,
      nextCursor: data.searchPage!.nextCursor,
      habits: data.habits.map((view) => {
        const { habit, definition, log, preview } = view;
        return {
          id: habit.id,
          version: habit.version,
          logVersion: log.version,
          value: log.value / 100,
          note: log.note,
          met: log.value >= definition.target,
          definition: {
            name: definition.name,
            metric: definition.metric,
            target: definition.target / 100,
            unit: definition.unit,
            cadence: definition.cadence,
            note: definition.note,
          },
          commitmentFrom: definition.commitmentFrom,
          reminderTime: view.reminderTime,
          archivedFrom: habit.archivedFrom,
          pendingFrom: view.pending?.fromDay ?? null,
          slot: view.slot,
          pendingDefinition: view.pending
            ? { ...view.pending.definition, target: view.pending.definition.target / 100 }
            : null,
          preview: preview
            ? {
                status: preview.status,
                reason: preview.reason,
                completedDays: preview.period.completedDays.length,
                quota: preview.period.quota,
                remainingDays: preview.remainingDays,
                successes: preview.successes,
                misses: preview.misses,
              }
            : null,
        };
      }),
    };
  }
  async prepare(owner: string, id: string, input: Record<string, unknown>, now: number) {
    const day = await this.activeDay(owner, now);
    if (!day) throw Error('NO_ACTIVE_DAY');
    const statements: Statement[] = [],
      collect = (writes: Statement[]) => statements.push(...writes);
    const result = await new HabitService(new D1HabitStore(this.db, collect)).execute(
      owner,
      id,
      input,
      now,
    );
    return { result: { ...result }, statements, validUntil: day.end_at };
  }
}
