import { query } from '../../adapters/d1/database.ts';
import { DayPlanStore } from '../../adapters/d1/day-plan-store.ts';
import { RecurrenceStore } from '../../adapters/d1/recurrence-store.ts';
import { ScheduleStore } from '../../adapters/d1/schedule-store.ts';
import { TimelineStore } from '../../adapters/d1/timeline-store.ts';
import { currentTaskFocus, taskFocusTarget } from '../../adapters/d1/work-nudges.ts';
import { D1WorkStore } from '../../adapters/d1/work-store.ts';
import { BREAKTHROUGH_PENALTIES, CHARMS, dailyCheckinProgress, LOOT, REALMS } from '../../domain/healthy.ts';
import { json, type MiniAppContext } from './context.ts';
export async function bootstrap({ env, owner, now, healthy }: MiniAppContext): Promise<Response> {
    const work = new D1WorkStore(env.DB), rules = new RecurrenceStore(env.DB);
    const [account, tasks, reminders, settings, progress, sessions, events, day] = await Promise.all([
        healthy.read(owner), work.hierarchy(owner), rules.rules(owner),
        query(env.DB, 'SELECT start_minutes,sleep_minutes,auto_plan_delay_minutes,version FROM schedule_settings WHERE owner=?', owner).first(), work.progress(owner), work.sessions(owner, Math.floor((now + 25200000) / 86400000) * 86400000 - 25200000, Math.floor((now + 25200000) / 86400000) * 86400000 - 25200000 + 86400000), work.events(owner, Math.floor((now + 25200000) / 86400000) * 86400000 - 25200000, Math.floor((now + 25200000) / 86400000) * 86400000 - 25200000 + 86400000), new ScheduleStore(env.DB).ensureDay(owner, now)
    ]);
    const [logged, planning, activeTotal] = await Promise.all([
        day ? query(env.DB, 'SELECT task_id,minutes FROM task_work_logs WHERE owner=? AND day=?', owner, day.day).all<{
            task_id: string;
            minutes: number;
        }>() : Promise.resolve({ results: [] as {
                task_id: string;
                minutes: number;
            }[] }),
        query(env.DB, 'SELECT task_id,remaining_minutes FROM task_planning WHERE owner=?', owner).all<{
            task_id: string;
            remaining_minutes: number | null;
        }>(),
        work.activeTaskTotal(owner)
    ]);
    const byTask = new Map(logged.results.map(row => [row.task_id, row.minutes])), remaining = new Map(planning.results.map(row => [row.task_id, row.remaining_minutes]));
    for (const task of tasks as Array<Record<string, unknown>>) {
        task.actual_minutes = byTask.get(String(task.id)) ?? 0;
        task.remaining_minutes = remaining.get(String(task.id)) ?? null;
    }
    const visibleStart = day?.start_at ?? Math.floor((now + 25200000) / 86400000) * 86400000 - 25200000;
    const latest = (await query(env.DB, "SELECT o.rule_id,o.due,o.status FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id AND r.owner=o.owner AND r.version=o.rule_version WHERE o.owner=? AND NOT EXISTS(SELECT 1 FROM recurrence_occurrences newer WHERE newer.owner=o.owner AND newer.rule_id=o.rule_id AND newer.rule_version=o.rule_version AND newer.due>o.due)", owner).all<{
        rule_id: string;
        due: number;
        status: string;
    }>()).results;
    const occurrence = new Map(latest.map(row => [row.rule_id, row]));
    const visibleRules = reminders.filter(rule => rule.kind !== 'once' || Math.max(occurrence.get(rule.id)?.due ?? 0, ...rule.times.map(time => Date.parse(rule.startDate + 'T' + time + ':00+07:00'))) >= visibleStart).map(rule => ({ ...rule, ...(rule.kind === 'once' && occurrence.get(rule.id) ? { delivered: occurrence.get(rule.id)!.status === 'sent', past: ['sent', 'missed', 'skipped_rest', 'cancelled'].includes(occurrence.get(rule.id)!.status) } : {}) }));
    const appointments = (await query(env.DB, "SELECT a.id,a.version,a.due,a.status,COALESCE(a.subject,t.title) AS title,EXISTS(SELECT 1 FROM outbox o WHERE o.reminder_id IN ('appointment:'||a.id||':1','appointment:'||a.id||':2') AND o.state='sent') AS delivered FROM task_appointments a LEFT JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner WHERE a.owner=? AND a.status IN ('active','expired') AND a.due>=? AND (a.task_id IS NULL OR t.deleted_at IS NULL) ORDER BY a.due LIMIT 200", owner, visibleStart).all<{
        id: string;
        version: number;
        due: number;
        status: string;
        title: string;
        delivered: number;
    }>()).results;
    const combined = [...visibleRules, ...appointments.map(a => {
            const local = new Date(a.due + 25200000).toISOString();
            return { id: a.id, origin: 'appointment', title: a.title, version: a.version, kind: 'once', times: [local.slice(11, 16)], weekdays: [], startDate: local.slice(0, 10), endDate: null, enabled: a.status === 'active', delivered: !!a.delivered, past: a.status === 'expired' };
        })];
    const rest = await new ScheduleStore(env.DB).restStatus(owner, now);
    const dailyPlan = await new DayPlanStore(env.DB).ensure(owner, now);
    const activeOffset = tasks.filter(task => task.status === 'active').length;
    const known = new Set(tasks.map(task => task.id));
    const missing = [...new Set((dailyPlan?.plan.items ?? []).map(item => item.taskId))].filter(id => !known.has(id));
    tasks.push(...await work.planTaskDetails(owner, missing, day?.day ?? null));
    return json({ now, account, sleepStatus: await new ScheduleStore(env.DB).sleepStatus(owner, now), checkin: dailyCheckinProgress(account.state, now), breakthroughPenalties: BREAKTHROUGH_PENALTIES, tasks, activeTasksPage: { offset: activeOffset, total: activeTotal, hasMore: activeOffset < activeTotal }, reminders: combined, settings, progress, sessions, events, day, timeline: await new TimelineStore(env.DB).read(owner, now), dailyPlan, taskFocus: await currentTaskFocus(env.DB, owner, now), taskFocusTarget: await taskFocusTarget(env.DB, owner, now), rest, resting: rest.reason !== 'active', realms: REALMS, loot: LOOT, charms: CHARMS, needsSetup: !settings });
}
export async function history({ env, owner }: MiniAppContext, url: URL): Promise<Response> {
    const rawOffset = url.searchParams.get('offset') ?? '0';
    const offset = Number(rawOffset);
    if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 100000)
        return json({ error: 'INVALID_REQUEST' }, 400);
    const result = await new D1WorkStore(env.DB).historyPage(owner, offset, 20);
    return json({ result });
}
export async function activeTasks({ env, owner, now }: MiniAppContext, url: URL): Promise<Response> {
    const raw = url.searchParams.get('offset') ?? '0', offset = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(offset) || offset > 100000)
        return json({ error: 'INVALID_REQUEST' }, 400);
    const day = await new ScheduleStore(env.DB).ensureDay(owner, now);
    return json({ result: await new D1WorkStore(env.DB).activeTaskPage(owner, offset, day?.day ?? null) });
}
