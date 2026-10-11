import type { WorkPlan } from '../../application/work-planner.ts';
import { availableRanges, type TimeRange } from '../../domain/availability.ts';
import { dayWindow, operatingDay } from '../../domain/healthy.ts';
import { deadlineAt } from '../../domain/time.ts';
import { query, type Database } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import { ScheduleStore } from './schedule-store.ts';
type Block = {
    id: string;
    task_id: string;
    start_at: number;
    minutes: number;
    version: number;
    generation: number;
    status: string;
    task_version: number;
    deadline: string | null;
};
type Position = {
    id: string;
    start: number;
};
export class TimelineStore {
    private db: Database;
    constructor(db: Database) {
        this.db = db;
    }
    async read(owner: string, now: number, ignoreHabitId: string | null = null) {
        const schedule = new ScheduleStore(this.db), settings = await schedule.settings(owner);
        if (!settings || settings.sleep_minutes === null)
            return null;
        const day = await schedule.ensureDay(owner, now);
        const window = day ? { start: day.start_at, target: day.target_sleep, end: day.end_at }
            : dayWindow(operatingDay(now, settings.start_minutes), settings.start_minutes, settings.sleep_minutes);
        const saved = day ? await query(this.db, 'SELECT intervals_json FROM schedule_days WHERE owner=? AND day=?', owner, day.day).first<{
            intervals_json: string;
        }>() : null;
        const intervals = JSON.parse(saved?.intervals_json ?? '{}');
        const events = (await query(this.db, "SELECT id,title,start_at,end_at,version FROM local_events WHERE owner=? AND status='scheduled' AND start_at<? AND COALESCE(end_at,start_at+3600000)>?", owner, window.target, window.start).all<{
            id: string;
            title: string;
            start_at: number;
            end_at: number | null;
            version: number;
        }>()).results;
        const habitSlots = (await query(this.db, `SELECT s.habit_id AS habitId,s.day,s.start_at AS startAt,s.minutes,s.version,
            json_extract(r.definition_json,'$.name') AS name FROM habit_slots s JOIN habit_revisions r
            ON r.owner=s.owner AND r.habit_id=s.habit_id AND r.from_day=(SELECT MAX(from_day) FROM habit_revisions
              WHERE owner=s.owner AND habit_id=s.habit_id AND from_day<=s.day)
            WHERE s.owner=? AND s.start_at<? AND s.start_at+s.minutes*60000>? AND (? IS NULL OR s.habit_id<>?) ORDER BY s.start_at,s.habit_id`,
            owner, window.target, window.start, ignoreHabitId, ignoreHabitId)
            .all<{ habitId: string; day: number; startAt: number; minutes: number; version: number; name: string }>()).results;
        const busy: TimeRange[] = [...(intervals.busy ?? []), ...events.map(e => ({ start: e.start_at, end: e.end_at ?? e.start_at + 3600000 })),
            ...habitSlots.map(slot => ({ start: slot.startAt, end: slot.startAt + slot.minutes * 60000 }))];
        const free = availableRanges((intervals.free?.length ? intervals.free : [{ start: window.start, end: window.target }]).map((r: TimeRange) => ({ start: Math.max(window.start, r.start), end: Math.min(window.target, r.end) })).filter((r: TimeRange) => r.end > r.start), busy, window.start);
        const savedPlan = day?.task_plan_status === 'active' ? await query(this.db, 'SELECT version,plan_json FROM daily_plans WHERE owner=? AND day=?', owner, day.day).first<{
            version: number;
            plan_json: string;
        }>() : null;
        const plan = savedPlan ? JSON.parse(savedPlan.plan_json) as WorkPlan : null;
        // Resolve only tasks used in this plan. An empty plan needs no task scan.
        const taskRows = plan?.items.length ? (await query(this.db, "SELECT id,version,deadline FROM tasks WHERE owner=? AND status='active' AND deleted_at IS NULL AND id IN (SELECT value FROM json_each(?))", owner, JSON.stringify(plan.items.map(item => item.taskId))).all<{
            id: string;
            version: number;
            deadline: string | null;
        }>()).results : [];
        const taskMap = new Map(taskRows.map(task => [task.id, task]));
        const blocks: Block[] = [];
        for (const item of plan?.items ?? []) {
            const task = taskMap.get(item.taskId);
            if (!task)
                continue;
            item.windows.forEach((slot, index) => blocks.push({ id: `taskplan_${day!.day}_${day!.task_plan_generation}_${item.taskId}_${index}`, task_id: item.taskId, start_at: slot.start, minutes: Math.round((slot.end - slot.start) / 60000), version: savedPlan!.version, generation: day!.task_plan_generation, status: 'planned', task_version: task.version, deadline: task.deadline }));
        }
        blocks.sort((a, b) => a.start_at - b.start_at || a.id.localeCompare(b.id));
        const stamp = JSON.stringify([settings.version, day?.day, day?.version, savedPlan?.version, blocks.map(b => [b.id, b.task_version]), events.map(e => [e.id, e.version]),
            habitSlots.map(slot => [slot.habitId, slot.day, slot.version])]);
        return { window, day: day?.day, dayVersion: day?.version, settingsVersion: settings.version, busy, free, blocks, events, habitSlots, stamp };
    }
    async change(owner: string, id: string, input: {
        stamp: string;
        sessionId?: string;
        at?: number;
        undo?: string;
    }, now: number) {
        if (input.sessionId?.startsWith('taskplan_'))
            throw Error('TIMELINE_READ_ONLY');
        const ledger = new HealthyStore(this.db);
        const replay = await query(this.db, 'SELECT request_json,result_json FROM cultivation_receipts WHERE owner=? AND request_id=? AND operation=?', owner, id, 'timeline').first<{
            request_json: string;
            result_json: string;
        }>();
        if (replay) {
            if (replay.request_json !== JSON.stringify(input))
                throw Error('REQUEST_ID_REUSED');
            return JSON.parse(replay.result_json);
        }
        const timeline = await this.read(owner, now);
        if (!timeline || timeline.stamp !== input.stamp)
            throw Error('TIMELINE_CHANGED');
        const blocks = timeline.blocks;
        let positions: Position[];
        if (input.undo) {
            const receipt = await query(this.db, "SELECT result_json,created FROM cultivation_receipts WHERE owner=? AND request_id=? AND operation='timeline'", owner, input.undo).first<{
                result_json: string;
                created: number;
            }>();
            if (!receipt || now - receipt.created > 600000)
                throw Error('TIMELINE_UNDO_EXPIRED');
            const previous = JSON.parse(receipt.result_json);
            if (previous.after !== timeline.stamp)
                throw Error('TIMELINE_CHANGED');
            positions = previous.before;
        }
        else {
            const selected = blocks.find(b => b.id === input.sessionId), at = input.at!;
            if (!selected || !Number.isFinite(at) || at < now || at % 300000 !== 0 || ['running', 'paused'].includes(selected.status))
                throw Error('INVALID_TIMELINE_MOVE');
            const fixed = blocks.filter(b => b.id !== selected.id && (b.start_at < now || ['running', 'paused'].includes(b.status)));
            const ranges = availableRanges(timeline.free, fixed.map(b => ({ start: b.start_at, end: b.start_at + b.minutes * 60000 })), now);
            if (!ranges.some(r => at >= r.start && at + selected.minutes * 60000 <= r.end))
                throw Error('TIMELINE_BLOCKED');
            positions = [{ id: selected.id, start: at }];
            // Keep earlier blocks and insert before any block overlapped by the drop.
            const earlier = blocks.filter(b => b.id !== selected.id && !fixed.includes(b) && b.start_at + b.minutes * 60000 <= at);
            for (const b of earlier)
                positions.push({ id: b.id, start: b.start_at });
            let cursor = at + selected.minutes * 60000 + 10 * 60000;
            for (const b of blocks.filter(b => b.id !== selected.id && !fixed.includes(b) && !earlier.includes(b))) {
                const earliest = Math.max(cursor, b.start_at);
                const range = ranges.find(r => Math.max(r.start, earliest) + b.minutes * 60000 <= r.end);
                if (!range)
                    throw Error('TIMELINE_NO_ROOM');
                const start = Math.max(range.start, earliest);
                positions.push({ id: b.id, start });
                cursor = start + b.minutes * 60000 + 10 * 60000;
            }
        }
        const changes = positions.map(p => ({ block: blocks.find(b => b.id === p.id)!, start: p.start })).filter(p => p.block && p.start !== p.block.start_at);
        const projected = blocks.map(b => ({ ...b, start_at: positions.find(p => p.id === b.id)?.start ?? b.start_at }));
        for (const { block: b, start } of changes) {
            if (start < now || ['running', 'paused'].includes(b.status) || !timeline.free.some(r => start >= r.start && start + b.minutes * 60000 <= r.end))
                throw Error('TIMELINE_BLOCKED');
            const end = start + b.minutes * 60000;
            const deadline = deadlineAt(b.deadline);
            if (deadline !== null && deadline > now && end > deadline)
                throw Error('TIMELINE_DEADLINE');
            if (projected.some(other => other.id !== b.id && other.start_at < end && other.start_at + other.minutes * 60000 > start))
                throw Error('TIMELINE_BLOCKED');
        }
        const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
        const statements = [q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_settings WHERE owner=? AND version=?) THEN 1 ELSE 0 END', owner, timeline.settingsVersion)];
        if (timeline.day !== undefined)
            statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND version=?) THEN 1 ELSE 0 END', owner, timeline.day, timeline.dayVersion!));
        // Also fence chat-created blocks/events which do not increment the day version.
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner=? AND s.start_at>=? AND s.start_at<? AND s.status IN ('planned','unknown','running','paused') AND t.status='active' AND t.deleted_at IS NULL)=? THEN 1 ELSE 0 END", owner, timeline.window.start, timeline.window.target, blocks.length));
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN (SELECT COUNT(*) FROM local_events WHERE owner=? AND status='scheduled' AND start_at<? AND COALESCE(end_at,start_at+3600000)>?)=? THEN 1 ELSE 0 END", owner, timeline.window.target, timeline.window.start, timeline.events.length));
        for (const e of timeline.events)
            statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM local_events WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END', owner, e.id, e.version));
        for (const b of blocks)
            statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM sessions s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner=? AND s.id=? AND s.version=? AND s.status=? AND t.version=? AND t.status='active') THEN 1 ELSE 0 END", owner, b.id, b.version, b.status, b.task_version));
        for (const { block: b, start } of changes) {
            statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM outbox o JOIN reminders r ON r.id=o.reminder_id WHERE r.session_id=? AND r.owner=? AND o.state IN ('sending','uncertain')) THEN 1 ELSE 0 END", b.id, owner));
            statements.push(q("UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id=? AND status IN ('pending','queued')", owner, b.id));
            statements.push(q("UPDATE outbox SET state='failed' WHERE state='pending' AND reminder_id IN (SELECT id FROM reminders WHERE owner=? AND session_id=?)", owner, b.id));
            statements.push(q("UPDATE sessions SET start_at=?,status='planned',generation=generation+1,version=version+1 WHERE owner=? AND id=?", start, owner, b.id));
            for (const ordinal of [1, 2])
                statements.push(q('INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,?,?,?,?,?)', `${b.id}:${b.generation + 1}:${ordinal}`, owner, b.id, b.generation + 1, ordinal, start + (ordinal - 1) * 900000));
        }
        const afterBlocks = projected.map(b => changes.some(c => c.block.id === b.id) ? { ...b, version: b.version + 1, status: 'planned' } : b).sort((a, b) => a.start_at - b.start_at || a.id.localeCompare(b.id));
        const after = JSON.stringify([timeline.settingsVersion, timeline.day, timeline.dayVersion, afterBlocks.map(b => [b.id, b.version, b.task_version, b.status]), timeline.events.map(e => [e.id, e.version])]);
        return ledger.mutate(owner, id, 'timeline', input, now, state => ({ state, result: { saved: true, undoId: id, before: changes.map(c => ({ id: c.block.id, start: c.block.start_at })), after }, statements }));
    }
}
