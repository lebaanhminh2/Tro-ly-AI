import type { HabitGameCompanion } from '../../ports/habit-game-companion.ts';
import { HabitService } from '../../application/habit-service.ts';
import { PracticeService } from '../../application/practice-service.ts';
import { techniqueById, TECHNIQUES, SCHOOLS } from '../../domain/techniques.ts';
import { D1HabitStore } from './habit-store.ts';
import { D1GameStore } from './game-store.ts';
import { D1BattleStore } from './battle-store.ts';
import { query, type Database, type Statement } from './database.ts';

const fold = (value: string) => value.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
export class D1HabitGameCompanion implements HabitGameCompanion {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    private async activeDay(owner: string, now: number) {
        return query(this.db, 'SELECT day,end_at FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1', owner, now, now)
            .first<{ day: number; end_at: number }>();
    }
    async context(owner: string, now: number) {
        const exists = await query(this.db, `SELECT EXISTS(SELECT 1 FROM habits WHERE owner=?) OR EXISTS(SELECT 1 FROM game_accounts WHERE owner=?) AS found`, owner, owner).first<{ found: number }>();
        if (!exists?.found) return { habits: [], game: null, hint: 'Habit và Thần Lộ chưa được thiết lập; không tạo hoặc ghi nhận thay user.' };
        const [habits, game] = await Promise.all([this.findHabits(owner, '', 0, now), this.game(owner, 'status', now)]);
        const visible = (habits.habits as unknown[]).slice(0, 6);
        return { ...habits, habits: visible, nextCursor: Number(habits.total) > visible.length ? visible.length : null, game,
            hint: 'Ghi nhận hiện tại là preview; kết quả luyện/trận chỉ đúng khi backend chốt ngày. Không thúc làm habit hoặc xuất chiến khi asleep/focused.' };
    }
    async findHabits(owner: string, search: string, cursor: number, now: number, status: 'active' | 'all' = 'active') {
        if (!/^\d+$/.test(owner) || typeof search !== 'string' || search.length > 100 || !Number.isInteger(cursor) || cursor < 0 || cursor > 10000)
            throw Error('INVALID_COMPANION_QUERY');
        const day = await this.activeDay(owner, now);
        if (!day) return { day: null, habits: [], nextCursor: null, reason: 'no_active_day' };
        if (!['active', 'all'].includes(status)) throw Error('INVALID_COMPANION_QUERY');
        const data = await new D1HabitStore(this.db).today(owner, now, status === 'all', true), filtered = data.habits.filter(view => fold(view.definition.name).includes(fold(search)));
        return { day: data.day.day, unitScale: 1, total: filtered.length, nextCursor: filtered.length > cursor + 10 ? cursor + 10 : null,
            habits: filtered.slice(cursor, cursor + 10).map(view => {
                const { habit, definition, log, preview } = view;
                return { id: habit.id, version: habit.version, logVersion: log.version, value: log.value / 100, note: log.note,
                    met: log.value >= definition.target, definition: { name: definition.name, metric: definition.metric,
                        target: definition.target / 100, unit: definition.unit, cadence: definition.cadence, note: definition.note },
                    commitmentFrom: definition.commitmentFrom, reminderTime: view.reminderTime, archivedFrom: habit.archivedFrom,
                    pendingFrom: view.pending?.fromDay ?? null, slot: view.slot,
                    pendingDefinition: view.pending ? { ...view.pending.definition, target: view.pending.definition.target / 100 } : null,
                    preview: preview ? { status: preview.status, reason: preview.reason, completedDays: preview.period.completedDays.length,
                        quota: preview.period.quota, remainingDays: preview.remainingDays, successes: preview.successes, misses: preview.misses } : null };
            }) };
    }
    async game(owner: string, section: 'status' | 'library' | 'versions', now: number, techniqueId?: string, before?: string | null) {
        const day = await this.activeDay(owner, now);
        if (!day) return { day: null, reason: 'no_active_day', mutationsAllowed: false };
        const store = new D1GameStore(this.db);
        if (section === 'versions') {
            if (typeof techniqueId !== 'string') throw Error('INVALID_TECHNIQUE');
            const versions = await store.versions(owner, techniqueId, before ?? null, 10);
            return { day: day.day, techniqueId, next: versions.next, versions: versions.versions.map(stored => ({
                id: stored.practice.id, techniqueId: stored.practice.techniqueId, edition: stored.practice.edition,
                tiers: stored.practice.tiers, progressMilli: stored.practice.progressMilli, pendingWeeks: stored.practice.pendingWeeks.length
            })) };
        }
        const data = await store.read(owner, now, true);
        if (section === 'library') return { day: day.day, techniques: TECHNIQUES.map(value => ({ id: value.id, name: value.name,
            school: value.school, kind: value.kind, description: value.description, owned: data.owned.includes(value.id) })), schools: SCHOOLS };
        const battles = await new D1BattleStore(this.db).overview(owner, data.day);
        const describe = (stored: typeof data.currentPractice) => stored ? { id: stored.practice.id, techniqueId: stored.practice.techniqueId,
            name: techniqueById(stored.practice.techniqueId).name, edition: stored.practice.edition, tiers: stored.practice.tiers,
            progressMilli: stored.practice.progressMilli, pendingWeeks: stored.practice.pendingWeeks.length } : null;
        const live = battles.battles.find(value => ['prepared', 'active', 'awaiting_rescue'].includes(value.status));
        return { day: day.day, version: data.version, current: data.current, pending: data.pending,
            practice: describe(data.currentPractice), pendingPractice: describe(data.pendingPractice), settledThrough: data.settledThrough,
            battle: live ? { id: live.id, name: live.content.name, status: live.status, startsDay: live.startsDay,
                turn: live.state.turn, player: live.state.player, boss: live.state.boss, announced: live.state.announced } : null,
            victories: battles.victories, owned: data.owned,
            safety: 'Chuẩn bị/chiêu có giá/cứu mạng/rút trận thực hiện trên web để đọc giá và xác nhận. Không gọi hoàn thành habit là thắng trận.' };
    }
    async prepare(owner: string, id: string, kind: 'habit' | 'practice', input: Record<string, unknown>, now: number) {
        const day = await this.activeDay(owner, now); if (!day) throw Error('NO_ACTIVE_DAY');
        const statements: Statement[] = [], collect = (writes: Statement[]) => statements.push(...writes);
        let result;
        if (kind === 'habit') result = await new HabitService(new D1HabitStore(this.db, collect)).execute(owner, id, input, now);
        else {
            // Fresh editions after a prior version require the web's explicit restart confirmation.
            if ('confirmRestart' in input) throw Error('COMPANION_RESTART_REQUIRES_WEB');
            result = await new PracticeService(new D1GameStore(this.db, collect)).execute(owner, id, input, now);
        }
        return { result: { ...result }, statements, validUntil: day.end_at };
    }
}
