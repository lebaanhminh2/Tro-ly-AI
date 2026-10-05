import { query } from '../../adapters/d1/database.ts';
import { RecurrenceStore } from '../../adapters/d1/recurrence-store.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';
export async function handleReminders({ env, owner, now, healthy }: MiniAppContext, input: MiniAppInput, path: string): Promise<Response | undefined> {
    if (path === '/api/reminder-instance') {
        if (Object.keys(input).some(k => !['id', 'ruleId', 'operation', 'due'].includes(k)) || typeof input.ruleId !== 'string' || !['skip', 'move'].includes(String(input.operation)))
            return json({ error: 'INVALID_REQUEST' }, 400);
        if (input.operation === 'move' && (!Number.isFinite(input.due) || Number(input.due) <= now || Number(input.due) > now + 32 * 86400000))
            return json({ error: 'INVALID_REQUEST' }, 400);
        const next = await new RecurrenceStore(env.DB).next(owner, input.ruleId, now);
        const result = await healthy.mutate(owner, input.id, 'reminder-instance', input, now, state => {
            if (!next)
                throw Error('NO_NEXT_REMINDER');
            const statements = [
                query(env.DB, "INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id WHERE o.id=? AND o.owner=? AND o.rule_version=? AND o.status IN ('scheduled','queued') AND r.version=o.rule_version AND r.enabled=1 AND NOT EXISTS(SELECT 1 FROM outbox b WHERE b.id='recurring:'||o.id AND b.state IN('sending','sent','uncertain'))) THEN 1 ELSE 0 END", next.id, owner, next.rule_version),
                query(env.DB, "UPDATE outbox SET state='failed' WHERE id=? AND state='pending'", 'recurring:' + next.id),
                query(env.DB, input.operation === 'skip' ? "UPDATE recurrence_occurrences SET status='cancelled' WHERE id=? AND owner=?" : "UPDATE recurrence_occurrences SET status='scheduled',due=? WHERE id=? AND owner=?", ...(input.operation === 'skip' ? [next.id, owner] : [Number(input.due), next.id, owner]))
            ];
            // A moved occurrence keeps its logical ID and rule slot; remove its unsent
            // cancelled delivery so the dispatcher may queue the new due time.
            if (input.operation === 'move')
                statements.push(query(env.DB, "DELETE FROM outbox WHERE id=? AND state='failed' ", 'recurring:' + next.id));
            return { state, result: { changed: true, slot: next.slot }, statements };
        });
        return json({ result });
    }
    if (path === '/api/reminders') {
        if (Object.keys(input).some(k => !['id', 'rule'].includes(k)) || !input.rule || typeof input.rule !== 'object' || Array.isArray(input.rule))
            return json({ error: 'INVALID_REQUEST' }, 400);
        const rule = input.rule as Record<string, unknown>;
        if (Object.keys(rule).some(k => !['id', 'origin', 'title', 'kind', 'times', 'weekdays', 'startDate', 'endDate', 'enabled', 'version'].includes(k))
            || typeof rule.title !== 'string' || typeof rule.kind !== 'string' || typeof rule.startDate !== 'string'
            || !Array.isArray(rule.times) || rule.times.some(t => typeof t !== 'string') || !Array.isArray(rule.weekdays) || rule.weekdays.some(n => !Number.isInteger(n))
            || typeof rule.enabled !== 'boolean' || !Number.isInteger(rule.version) || Number(rule.version) < 0
            || rule.endDate !== null && typeof rule.endDate !== 'string' || rule.id !== undefined && typeof rule.id !== 'string')
            return json({ error: 'INVALID_REQUEST' }, 400);
        if (rule.origin === 'appointment') {
            if (typeof rule.id !== 'string' || rule.kind !== 'once' || rule.times.length !== 1 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(rule.times[0])) || !/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate))
                return json({ error: 'INVALID_REQUEST' }, 400);
            const due = Date.parse(rule.startDate + 'T' + rule.times[0] + ':00+07:00');
            if (!Number.isFinite(due) || rule.enabled && due <= now || new Date(Date.parse(rule.startDate + 'T00:00:00Z')).toISOString().slice(0, 10) !== rule.startDate)
                return json({ error: 'INVALID_REQUEST' }, 400);
            const result = await healthy.mutate(owner, input.id, 'edit-chat-reminder', input, now, state => ({ state, result: { updated: true }, statements: [
                    query(env.DB, "INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_appointments WHERE owner=? AND id=? AND version=? AND status='active') THEN 1 ELSE 0 END", owner, rule.id as string, Number(rule.version)),
                    ...(rule.enabled ? [query(env.DB, "INSERT INTO task_appointments(id,owner,task_id,due,subject,message,event_id) SELECT ?,owner,task_id,?,?,?,event_id FROM task_appointments WHERE owner=? AND id=?", 'edited_' + input.id, due, String(rule.title), String(rule.title) + ' · đến giờ cậu hẹn rồi nhé.', owner, rule.id as string)] : []),
                    query(env.DB, "UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND id=?", owner, rule.id as string)
                ] }));
            return json({ result });
        }
        if (rule.origin !== undefined)
            return json({ error: 'INVALID_REQUEST' }, 400);
        const id = typeof rule.id === 'string' ? rule.id : crypto.randomUUID();
        const normalized = { id, owner, title: rule.title, kind: rule.kind as 'once' | 'daily' | 'weekdays', times: rule.times as string[], weekdays: rule.weekdays as number[], startDate: rule.startDate, endDate: rule.endDate as string | null, enabled: rule.enabled, version: Number(rule.version) + 1 };
        const result = await healthy.mutate(owner, input.id, 'save-rule', input, now, state => ({ state, result: { id }, statements: new RecurrenceStore(env.DB).saveStatements(normalized, Number(rule.version), now) }));
        return json({ result });
    }
}
