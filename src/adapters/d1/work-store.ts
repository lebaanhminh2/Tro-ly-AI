import { renderView } from '../../application/ui-renderer.ts';
import { deadlineAt } from '../../domain/time.ts';
import type { Input, Plan } from '../../domain/work.ts';
import type { Lease, ViewResult, WorkStore } from '../../ports/work-store.ts';
import { conversationStatements } from './conversation-store.ts';
import type { Database, Statement } from './database.ts';
import { query } from './database.ts';
import { eventStatements } from './event-store.ts';
import { memoryStatements } from './memory.ts';
import { progressStatements } from './progress-store.ts';
import { ScheduleStore } from './schedule-store.ts';
import { sessionStatements } from './session-store.ts';
import { D1UiStore } from './ui-store.ts';
import { D1WorkReader } from './work-reader.ts';
// Command coordinator: leases, prepared writes, UI intents and atomic commit.
export class D1WorkStore extends D1WorkReader implements WorkStore {
    private cardsEnabled: boolean;
    constructor(db: Database, privateCards = false) {
        super(db);
        this.cardsEnabled = privateCards;
    }
    async scheduleDialog(owner: string, now: number, open: boolean) {
        const s = new ScheduleStore(this.db);
        if (open)
            await s.openDialog(owner, now);
        else
            await s.closeDialog(owner);
    }
    async prepareSchedule(owner: string, now: number, version: number, free: import('../../domain/availability.ts').TimeRange[], busy: import('../../domain/availability.ts').TimeRange[], estimates: {
        id: string;
        minutes: number;
    }[], requestId: string) {
        if (new Set(estimates.map(item => item.id)).size !== estimates.length)
            throw Error('DUPLICATE_TASK');
        const supplied = new Map(estimates.map(item => [item.id, item.minutes]));
        const active = (await query(this.db, `SELECT t.id,t.deadline,p.remaining_minutes
      FROM tasks t LEFT JOIN task_planning p ON p.owner=t.owner AND p.task_id=t.id
      WHERE t.owner=? AND t.status='active' AND t.deleted_at IS NULL`, owner)
            .all<{
            id: string;
            deadline: string | null;
            remaining_minutes: number | null;
        }>()).results;
        const ids = new Set(active.map(task => task.id));
        if (estimates.some(item => !ids.has(item.id)))
            throw Error('STALE_TASK');
        const all: import('../../application/daily-planner.ts').PlanningTask[] = active.map(task => ({
            id: task.id, status: 'active', deleted: false,
            deadline: deadlineAt(task.deadline),
            remainingMinutes: supplied.get(task.id) ?? task.remaining_minutes
        }));
        const prepared = await new ScheduleStore(this.db).prepareReplan(owner, now, version, free, busy, all, requestId);
        for (const estimate of estimates)
            prepared.statements.push(query(this.db, `INSERT INTO task_planning(owner,task_id,remaining_minutes,updated)
      VALUES(?,?,?,?) ON CONFLICT(owner,task_id) DO UPDATE SET
      remaining_minutes=excluded.remaining_minutes,updated=excluded.updated,version=task_planning.version+1
      WHERE task_planning.remaining_minutes IS NOT excluded.remaining_minutes`, owner, estimate.id, estimate.minutes, now));
        return prepared;
    }
    reportSleep(owner: string, now: number) {
        return new ScheduleStore(this.db).reportSleep(owner, now);
    }
    async prepareUi(lease: Lease, now: number) {
        if (!this.cardsEnabled)
            return;
        const input = lease.input;
        const ui = new D1UiStore(this.db);
        if (!input.callback) {
            if (input.text && !input.text.startsWith('/')) {
                const pending = (await this.sessionInput(input.owner)) ?? await this.selection(input.owner);
                if (pending && pending.expires > now) {
                    const resolved = await ui.textInput(input.owner, input.chat, now);
                    if (resolved)
                        lease.ui = resolved;
                }
            }
            return;
        }
        const resolved = input.messageId ? (input.callback!.startsWith('ui:')
            ? await ui.resolve(input.owner, input.chat, input.messageId, input.callback!, now)
            : await ui.adoptReminder(input.owner, input.chat, input.messageId, input.callback!, now)) : null;
        if (!resolved) {
            if (input.messageId)
                lease.uiRecovered = await ui.recoverOnInteraction(input.owner, input.chat, input.messageId, input.callback!, now);
            lease.uiStale = true;
            return;
        }
        if (/^(w:|due:|cancel-input$)/.test(resolved.action.action)) {
            const flow = await query(this.db, 'SELECT card_id FROM ui_text_inputs WHERE owner=? AND expires>?', input.owner, now).first<{
                card_id: string;
            }>();
            if (!flow || flow.card_id !== resolved.card.id) {
                lease.uiStale = true;
                return;
            }
        }
        lease.ui = resolved;
        lease.input = { ...input, callback: resolved.action.action };
    }
    async result(owner: string, id: number): Promise<ViewResult | null> {
        const row = await query(this.db, 'SELECT result FROM command_inbox WHERE owner=? AND update_id=? AND state=?', owner, id, 'done').first<{
            result: string | null;
        }>();
        return row?.result ? JSON.parse(row.result) as ViewResult : null;
    }
    async accept(input: Input, now: number, delivery: boolean) {
        const response = await query(this.db, 'INSERT OR IGNORE INTO command_inbox(owner,update_id,payload,created,delivery) VALUES(?,?,?,?,?)', input.owner, input.updateId, JSON.stringify(input), now, delivery ? 1 : 0).run();
        if (response.meta.changes > 0 && input.replyToMessageId)
            await query(this.db, `UPDATE reminders SET status='cancelled' WHERE owner=? AND ordinal=2
      AND status IN ('pending','queued') AND EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending')
      AND EXISTS(SELECT 1 FROM outbox WHERE reminder_id IN (reminders.session_id||':'||reminders.generation||':1',reminders.session_id||':'||reminders.generation||':2') AND state='sent' AND message_id=?)`, input.owner, input.owner, input.updateId, input.replyToMessageId).run();
        return response.meta.changes > 0;
    }
    async pendingOwners() {
        return (await query(this.db, "SELECT DISTINCT owner FROM command_inbox WHERE state='pending' LIMIT 4").all<{
            owner: string;
        }>()).results.map(r => r.owner);
    }
    async claim(owner: string, now: number): Promise<Lease | null> {
        const token = crypto.randomUUID();
        const claim = await query(this.db, `INSERT INTO owner_leases(owner,token,expires) VALUES(?,?,?)
      ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE owner_leases.expires<=?`, owner, token, now + 30000, now).run();
        if (!claim.meta.changes)
            return null;
        const row = await query(this.db, "SELECT payload,attempts,update_id,created FROM command_inbox WHERE owner=? AND state='pending' ORDER BY update_id LIMIT 1", owner).first<{
            payload: string;
            attempts: number;
            update_id: number;
            created: number;
        }>();
        if (!row) {
            await query(this.db, 'DELETE FROM owner_leases WHERE owner=? AND token=?', owner, token).run();
            return null;
        }
        const counted = await query(this.db, `UPDATE command_inbox SET attempts=attempts+1 WHERE owner=? AND update_id=? AND state='pending'
      AND EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=?)`, owner, row.update_id, owner, token).run();
        if (!counted.meta.changes)
            return null;
        return { owner, token, input: { ...JSON.parse(row.payload), receivedAt: row.created } as Input, attempts: row.attempts + 1 };
    }
    async release(lease: Lease) {
        await query(this.db, 'DELETE FROM owner_leases WHERE owner=? AND token=?', lease.owner, lease.token).run();
    }
    mutationStatements(owner: string, changes: Plan['changes'], now: number, native = false): Statement[] {
        const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
        const statements: Statement[] = [];
        for (const change of changes) {
            if (change.type === 'task-rename') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END', owner, change.taskId, change.expectedVersion));
                statements.push(q('UPDATE tasks SET title=?,version=version+1 WHERE owner=? AND id=?', change.title, owner, change.taskId));
            }
            else if (change.type === 'progress-record' || change.type === 'board-select' || change.type === 'tasks-delete') {
                statements.push(...progressStatements(this.db, owner, change));
            }
            else if (change.type === 'event-update') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM local_events WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END", owner, change.id, change.expectedVersion));
                statements.push(q("UPDATE local_events SET start_at=?,end_at=?,status=?,version=version+1 WHERE owner=? AND id=?", change.start, change.end, change.cancelled ? 'cancelled' : 'scheduled', owner, change.id));
                statements.push(q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND event_id=? AND status='active'", owner, change.id));
            }
            else if (change.type === 'reminder-action') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_appointments WHERE id=? AND owner=? AND version=? AND status='active') THEN 1 ELSE 0 END", change.id, owner, change.expectedVersion));
                statements.push(change.action === 'cancel' ? q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE id=? AND owner=?", change.id, owner) : q("UPDATE task_appointments SET responded=1,version=version+1 WHERE id=? AND owner=?", change.id, owner));
            }
            else if (change.type === 'event-create') {
                statements.push(...eventStatements(this.db, owner, change, now));
            }
            else if (change.type === 'standalone-reminder') {
                if (change.owner !== owner || change.due <= now)
                    throw Error('INVALID_REMINDER');
                statements.push(q("INSERT INTO task_appointments(id,owner,task_id,due,subject,message,event_id) VALUES(?,?,NULL,?,?,?,?)", change.id, owner, change.due, change.subject, change.message, change.eventId ?? null));
            }
            else if (change.type === 'clarification-create') {
                const c = change.clarification;
                if (c.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                statements.push(q("INSERT INTO conversation_clarifications(id,owner,subject,question,task_id,created,expires) VALUES(?,?,?,?,?,?,?)", c.id, owner, c.subject, c.question, c.task_id, c.created, c.expires));
            }
            else if (change.type === 'clarification-close') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_clarifications WHERE id=? AND owner=? AND status='waiting' AND expires>?) THEN 1 ELSE 0 END", change.id, owner, change.now));
                statements.push(q("UPDATE conversation_clarifications SET status=? WHERE id=? AND owner=?", change.status, change.id, owner));
            }
            else if (change.type === 'summary-update') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM conversation_summaries WHERE owner=?),0)=? THEN 1 ELSE 0 END", owner, change.expectedVersion));
                statements.push(q("INSERT INTO conversation_summaries(owner,content,covered_through,updated) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET content=excluded.content,covered_through=excluded.covered_through,version=version+1,updated=excluded.updated", owner, change.content, change.through, change.now));
            }
            else if (change.type === 'conversation-completion') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                if (change.pendingId)
                    statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END', owner, change.pendingId, now));
                statements.push(q(`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ${native ? 'tool_steps' : 'conversation_receipts'} WHERE owner=? AND update_id=? AND ${native ? "kind='write' AND state='done'" : "state='ready'"}) AND EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND status=?) THEN 1 ELSE 0 END`, owner, change.updateId, owner, change.taskId, change.expectedVersion, change.operation === 'complete' ? 'active' : 'completed'));
                if (change.operation === 'reopen')
                    statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_completion_undo WHERE owner=? AND task_id=? AND expected_version=? AND expires>?) THEN 1 ELSE 0 END', owner, change.taskId, change.expectedVersion, now));
                statements.push(q('UPDATE tasks SET status=?,version=version+1 WHERE owner=? AND id=?', change.operation === 'complete' ? 'completed' : 'active', owner, change.taskId));
                statements.push(q("UPDATE outbox SET state='failed' WHERE id LIKE ? AND state='pending'", 'nudge:' + owner + ':%'));
                statements.push(q("UPDATE nudge_cycles SET cycle=cycle+1,version=version+1,tasks_json='[]',attempts=0,next_at=?,blocked_json='[]',lease_until=0 WHERE owner=?", now, owner));
                if (change.operation === 'complete') {
                    statements.push(q('DELETE FROM task_focus_state WHERE owner=? AND task_id=?', owner, change.taskId));
                    statements.push(q("UPDATE task_steps SET status='completed',completed_at=COALESCE(completed_at,?),version=version+1 WHERE owner=? AND task_id=? AND status='active' AND deleted_at IS NULL", now, owner, change.taskId));
                    statements.push(q('UPDATE task_completions SET completed_at=? WHERE owner=? AND task_id=?', now, owner, change.taskId));
                    statements.push(q('INSERT INTO task_completion_undo(owner,task_id,expected_version,expires) VALUES(?,?,?,?) ON CONFLICT(owner,task_id) DO UPDATE SET expected_version=excluded.expected_version,expires=excluded.expires', owner, change.taskId, change.expectedVersion + 1, now + 900000));
                    statements.push(q("UPDATE task_appointments SET status='cancelled' WHERE owner=? AND task_id=? AND status='active'", owner, change.taskId));
                    statements.push(q("UPDATE reminders SET status='cancelled' WHERE owner=? AND status IN ('pending','queued') AND session_id IN (SELECT id FROM sessions WHERE owner=? AND task_id=?)", owner, owner, change.taskId));
                    statements.push(q("UPDATE sessions SET status=CASE WHEN status IN ('running','paused') THEN 'completed' ELSE 'skipped' END,spent_ms=spent_ms+CASE WHEN active_since IS NULL THEN 0 ELSE MAX(0,?-active_since) END,active_since=NULL,version=version+1 WHERE owner=? AND task_id=? AND status NOT IN ('completed','skipped')", now, owner, change.taskId));
                }
                else
                    statements.push(q('DELETE FROM task_completion_undo WHERE owner=? AND task_id=?', owner, change.taskId));
                if (!native)
                    statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?", owner, change.updateId));
            }
            else if (change.type === 'conversation-appointment') {
                if (change.owner !== owner || change.due <= now)
                    throw Error('INVALID_APPOINTMENT');
                if (change.pendingId)
                    statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END', owner, change.pendingId, now));
                statements.push(q(`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ${native ? 'tool_steps' : 'conversation_receipts'} WHERE owner=? AND update_id=? AND ${native ? "kind='write' AND state='done'" : "state='ready'"}) AND EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END`, owner, change.updateId, owner, change.taskId, change.expectedVersion));
                statements.push(q("UPDATE task_appointments SET status='cancelled' WHERE owner=? AND task_id=? AND status='active'", owner, change.taskId));
                statements.push(q('INSERT INTO task_appointments(id,owner,task_id,due) VALUES(?,?,?,?)', change.id, owner, change.taskId, change.due));
                if (!native)
                    statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?", owner, change.updateId));
            }
            else if (change.type === 'conversation-pending') {
                if (change.owner !== owner)
                    throw Error('OWNER_MISMATCH');
                if (change.pending)
                    statements.push(q('INSERT INTO conversation_pending(owner,id,kind,draft,expires) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,kind=excluded.kind,draft=excluded.draft,expires=excluded.expires', owner, change.pending.id, change.pending.kind, change.pending.draft, change.pending.expires));
                else
                    statements.push(q('DELETE FROM conversation_pending WHERE owner=?', owner));
            }
            else if (change.type === 'conversation-task') {
                statements.push(...conversationStatements(this.db, owner, change, native));
            }
            else if (change.type === 'remember' || change.type === 'forget' || change.type === 'focus' || change.type === 'ai-enabled' || change.type === 'memory-confirm' || change.type === 'memory-resolve') {
                statements.push(...memoryStatements(this.db, owner, change));
            }
            else if (change.type === 'session-input' || change.type === 'session-create' || change.type === 'session-action' || change.type === 'preferences') {
                statements.push(...sessionStatements(this.db, owner, change));
            }
            else if (change.type === 'cancel') {
                if (change.owner !== owner)
                    throw new Error('OWNER_MISMATCH');
                statements.push(q('DELETE FROM selections WHERE owner=?', owner));
                statements.push(q('DELETE FROM session_input WHERE owner=?', owner));
            }
            else if (change.type === 'select') {
                statements.push(q('DELETE FROM session_input WHERE owner=?', owner));
                const s = change.selection;
                if (s.owner !== owner)
                    throw new Error('OWNER_MISMATCH');
                statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE id=? AND owner=? AND version=?) THEN 1 ELSE 0 END', s.task_id, owner, s.version));
                statements.push(q(`INSERT INTO selections(owner,task_id,version,expires) VALUES(?,?,?,?) ON CONFLICT(owner)
          DO UPDATE SET task_id=excluded.task_id,version=excluded.version,expires=excluded.expires`, owner, s.task_id, s.version, s.expires));
            }
            else if (change.type === 'propose') {
                const p = change.proposal;
                if (p.owner !== owner)
                    throw new Error('OWNER_MISMATCH');
                statements.push(q('INSERT INTO proposals(id,owner,task_id,operation,value,expected_version,expires) VALUES(?,?,?,?,?,?,?)', p.id, owner, p.task_id, p.operation, p.value, p.expected_version, p.expires));
            }
            else {
                const p = change.proposal;
                if (p.owner !== owner)
                    throw new Error('OWNER_MISMATCH');
                statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM proposals WHERE id=? AND owner=? AND status='pending' AND expires>?) THEN 1 ELSE 0 END", p.id, owner, now));
                // Existing trigger validates version and applies task mutation within this batch.
                statements.push(q("UPDATE proposals SET status=? WHERE id=? AND owner=? AND status='pending'", change.accept ? 'accepted' : 'rejected', p.id, owner));
            }
        }
        return statements;
    }
    async commit(lease: Lease, plan: Plan, now: number) {
        // Validate and normalize before constructing any database mutation.
        plan = { ...plan, view: renderView(plan.view) };
        const { owner, input, token } = lease;
        const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
        const statements: Statement[] = [q(`INSERT INTO transaction_guard(valid) SELECT CASE WHEN
      EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?) AND
      EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending') THEN 1 ELSE 0 END`, owner, token, now, owner, input.updateId)];
        statements.push(...(lease.pendingWrites ?? []));
        statements.push(...this.mutationStatements(owner, plan.changes, now));
        const payload = JSON.stringify({ method: 'sendMessage', chat_id: input.chat, text: plan.view.text,
            ...(plan.view.buttons.length ? { reply_markup: { inline_keyboard: plan.view.buttons } } : {}) });
        if (input.text && !input.text.startsWith('/') && !plan.changes.some(c => c.type === 'forget'))
            statements.push(q('INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES(?,?,?,?,?,?)', owner, input.updateId, input.text, plan.view.text, now, now + 30 * 86400000));
        if (this.cardsEnabled && input.callbackId) {
            statements.push(q('INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)', `ack:${owner}:${input.updateId}`, JSON.stringify({ method: 'answerCallbackQuery', callback_query_id: input.callbackId,
                ...(lease.uiStale || plan.view.silent ? { text: 'Lựa chọn đã cũ hoặc đã xử lý. Mở lại danh sách nhé.' } : {}) }), now));
        }
        const ui = new D1UiStore(this.db);
        let renderedCard: string | undefined;
        if (this.cardsEnabled && lease.ui && !lease.uiStale) {
            renderedCard = lease.ui.card.id;
            // Text validation errors must leave the input flow active even if the view has no buttons.
            const pendingInput = await this.sessionInput(owner) ?? await this.selection(owner);
            const inputContinues = !!pendingInput && !plan.changes.some(c => c.type === 'cancel' || c.type === 'session-create');
            const nextView = { ...plan.view, silent: false };
            if (inputContinues && !nextView.buttons.length)
                nextView.buttons = [[{ text: 'Hủy', callback_data: 'cancel-input' }]];
            statements.push(...ui.update(lease.ui.card, lease.ui.action, nextView, nextView.buttons.length ? 'active' : 'completed', now));
        }
        else if (this.cardsEnabled && !lease.uiStale && (plan.view.buttons.length || plan.view.photo)) {
            const created = ui.create(owner, input.chat, plan.view, now, now + 900000);
            renderedCard = created.id;
            statements.push(...created.statements);
        }
        else if (!plan.view.silent && !lease.uiStale)
            statements.push(q(`INSERT INTO outbox(id,payload,available) SELECT ?,?,? FROM command_inbox WHERE owner=? AND update_id=? AND delivery=1`, `reply:${owner}:${input.updateId}`, payload, now, owner, input.updateId));
        if (this.cardsEnabled && !lease.uiStale) {
            if (renderedCard) {
                statements.push(q('DELETE FROM ui_text_inputs WHERE owner=?', owner));
                statements.push(q(`INSERT INTO ui_text_inputs(owner,card_id,expires) SELECT ?,?,MAX(expires) FROM
          (SELECT expires FROM session_input WHERE owner=? UNION ALL SELECT expires FROM selections WHERE owner=?)
          HAVING MAX(expires)>?`, owner, renderedCard, owner, owner, now));
            }
            else if (plan.changes.some(c => c.type === 'cancel'))
                statements.push(q('DELETE FROM ui_text_inputs WHERE owner=?', owner));
        }
        if (!this.cardsEnabled && input.messageId && input.callback && (plan.changes.some(c => c.type === 'resolve' || c.type === 'session-action' || c.type === 'memory-resolve') || plan.view.silent)) {
            // Only remove buttons on a card previously sent by this application to this owner.
            statements.push(q(`INSERT OR IGNORE INTO outbox(id,payload,available) SELECT ?,?,? WHERE EXISTS
        (SELECT 1 FROM outbox WHERE message_id=? AND state='sent' AND json_extract(payload,'$.chat_id')=? AND json_extract(payload,'$.method')='sendMessage')`, `clear:${owner}:${input.messageId}`, JSON.stringify({ method: 'editMessageReplyMarkup', chat_id: input.chat, message_id: input.messageId, reply_markup: { inline_keyboard: [] } }), now, input.messageId, input.chat));
        }
        statements.push(q("UPDATE command_inbox SET state='done',result=? WHERE owner=? AND update_id=?", JSON.stringify(plan.view), owner, input.updateId));
        statements.push(q('INSERT INTO command_audit(owner,update_id,change_count,applied) VALUES(?,?,?,?)', owner, input.updateId, plan.changes.length, now));
        statements.push(q('DELETE FROM transaction_guard'));
        statements.push(q('DELETE FROM owner_leases WHERE owner=? AND token=?', owner, token));
        await this.db.batch(statements);
    }
}
