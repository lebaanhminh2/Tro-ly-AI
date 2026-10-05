import { DayPlanStore } from '../../adapters/d1/day-plan-store.ts';
import { ScheduleStore } from '../../adapters/d1/schedule-store.ts';
import { sessionStatements } from '../../adapters/d1/session-store.ts';
import { TimelineStore } from '../../adapters/d1/timeline-store.ts';
import { changeTaskFocus, queuePlanConfirmation, recordTaskNudgeActivity } from '../../adapters/d1/work-nudges.ts';
import { D1WorkStore } from '../../adapters/d1/work-store.ts';
import { canAct } from '../../domain/session.ts';
import { deadlineAt } from '../../domain/time.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';
export async function handleSchedule({ env, owner, now, healthy }: MiniAppContext, input: MiniAppInput, path: string): Promise<Response | undefined> {
    if (path === '/api/day-plan') {
        if (Object.keys(input).some(k => !['id', 'version', 'items'].includes(k)) || !Number.isInteger(input.version) || !Array.isArray(input.items) || input.items.length > 50 || input.items.some(item => !item || typeof item !== 'object' || Object.keys(item).some(k => !['taskId', 'minutes'].includes(k)) || typeof item.taskId !== 'string' || !Number.isInteger(item.minutes)))
            return json({ error: 'INVALID_REQUEST' }, 400);
        const result = await new DayPlanStore(env.DB).replace(owner, input.id, Number(input.version), input.items as {
            taskId: string;
            minutes: number;
        }[], now);
        await recordTaskNudgeActivity(env.DB, owner, `mini:${input.id}`, now);
        const plan = await new DayPlanStore(env.DB).ensure(owner, now);
        if (plan)
            await queuePlanConfirmation(env.DB, owner, input.id, plan.plan, now);
        return json({ result });
    }
    if (path === '/api/task-work') {
        if (Object.keys(input).some(k => !['id', 'taskId', 'minutes', 'note'].includes(k)) || typeof input.taskId !== 'string' || !Number.isInteger(input.minutes) || Number(input.minutes) < 0 || Number(input.minutes) > 1440 || input.note !== undefined && input.note !== null && typeof input.note !== 'string')
            return json({ error: 'INVALID_REQUEST' }, 400);
        const result = await new DayPlanStore(env.DB).logWork(owner, input.id, String(input.taskId), Number(input.minutes), input.note === undefined || input.note === null ? null : String(input.note), now);
        await recordTaskNudgeActivity(env.DB, owner, `mini:${input.id}`, now);
        return json({ result });
    }
    if (path === '/api/task-focus') {
        if (Object.keys(input).some(k => !['id', 'operation'].includes(k)) || !['start', 'stop'].includes(String(input.operation)))
            return json({ error: 'INVALID_REQUEST' }, 400);
        return json({ result: await changeTaskFocus(env.DB, owner, input.id, String(input.operation) as 'start' | 'stop', now) });
    }
    if (path === '/api/timeline') {
        if (Object.keys(input).some(k => !['id', 'stamp', 'sessionId', 'at', 'undo'].includes(k)) || typeof input.stamp !== 'string' || input.stamp.length > 3500 ||
            (input.undo !== undefined ? typeof input.undo !== 'string' || !input.undo || input.undo.length > 120 || input.sessionId !== undefined || input.at !== undefined : typeof input.sessionId !== 'string' || !Number.isFinite(input.at)))
            return json({ error: 'INVALID_REQUEST' }, 400);
        const { id, ...move } = input;
        return json({ result: await new TimelineStore(env.DB).change(owner, String(id), move as {
                stamp: string;
                sessionId?: string;
                at?: number;
                undo?: string;
            }, now) });
    }
    if (path === '/api/schedule') {
        if (Object.keys(input).some(k => !['id', 'version', 'free', 'busy', 'estimates'].includes(k)) || !Number.isInteger(input.version) || !Array.isArray(input.free) || !Array.isArray(input.busy) || !Array.isArray(input.estimates) || input.estimates.length > 100)
            return json({ error: 'INVALID_REQUEST' }, 400);
        for (const r of [...input.free, ...input.busy])
            if (!r || typeof r !== 'object' || Object.keys(r).some(k => !['start', 'end'].includes(k)) || !Number.isFinite(r.start) || !Number.isFinite(r.end))
                return json({ error: 'INVALID_REQUEST' }, 400);
        const work = new D1WorkStore(env.DB);
        const tasks = [];
        for (const estimate of input.estimates) {
            if (!estimate || typeof estimate !== 'object' || Object.keys(estimate).some(k => !['id', 'minutes'].includes(k)) || typeof estimate.id !== 'string' || !Number.isInteger(estimate.minutes))
                return json({ error: 'INVALID_REQUEST' }, 400);
            const task = await work.task(owner, estimate.id);
            if (!task || task.status === 'completed')
                return json({ error: 'STALE_TASK' }, 409);
            tasks.push({ id: task.id, status: 'active' as const, deleted: false, deadline: deadlineAt(task.deadline), remainingMinutes: estimate.minutes as number });
        }
        const prepared = await work.prepareSchedule(owner, now, Number(input.version), input.free, input.busy, tasks.map(t => ({ id: t.id, minutes: t.remainingMinutes })), input.id);
        await healthy.mutate(owner, input.id, 'schedule', input, now, state => ({ state, result: prepared.plan, statements: prepared.statements }));
        await recordTaskNudgeActivity(env.DB, owner, `mini:${input.id}`, now);
        const saved = await new DayPlanStore(env.DB).ensure(owner, now);
        if (saved)
            await queuePlanConfirmation(env.DB, owner, input.id, saved.plan, now);
        return json({ result: saved?.plan ?? prepared.plan });
    }
    if (path === '/api/session') {
        if (Object.keys(input).some(k => !['id', 'sessionId', 'version', 'action'].includes(k)) || typeof input.sessionId !== 'string' || !Number.isInteger(input.version) || !['start', 'pause', 'finish', 'skip', 'snooze'].includes(String(input.action)))
            return json({ error: 'INVALID_REQUEST' }, 400);
        const session = await new D1WorkStore(env.DB).session(owner, input.sessionId);
        const result = await healthy.mutate(owner, input.id, 'session-action', input, now, state => {
            if (!session || session.version !== input.version || !canAct(session, String(input.action), now))
                throw Error('SESSION_CHANGED');
            return { state, result: { updated: true }, statements: sessionStatements(env.DB, owner, { type: 'session-action', session, action: input.action as 'start' | 'pause' | 'finish' | 'skip' | 'snooze', now }) };
        });
        return json({ result });
    }
    if (path === '/api/settings') {
        if (Object.keys(input).some(k => !['id', 'start', 'sleep', 'autoPlanDelayMinutes', 'version'].includes(k)) || typeof input.start !== 'string' || typeof input.sleep !== 'string' || !Number.isInteger(input.version) || input.autoPlanDelayMinutes !== undefined && (!Number.isInteger(input.autoPlanDelayMinutes) || Number(input.autoPlanDelayMinutes) < 30 || Number(input.autoPlanDelayMinutes) > 720))
            return json({ error: 'INVALID_REQUEST' }, 400);
        await new ScheduleStore(env.DB).configure(owner, input.start, input.sleep, Number(input.version), now, input.id, input.autoPlanDelayMinutes === undefined ? undefined : Number(input.autoPlanDelayMinutes));
        return json({ saved: true });
    }
}
