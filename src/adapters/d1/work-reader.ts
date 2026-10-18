import type { ConversationTurn, Memory } from '../../domain/memory.ts';
import type { Preferences, Session } from '../../domain/session.ts';
import type { Proposal, Selection } from '../../domain/work.ts';
import type { WorkReader } from '../../ports/work-store.ts';
import { query } from './database.ts';
import { localEvents } from './event-store.ts';
import { boardSelection, progressData, workPage } from './progress-store.ts';
import { ScheduleStore } from './schedule-store.ts';
import { TaskHierarchyStore } from './task-hierarchy-store.ts';
import { currentTaskFocus } from './work-nudges.ts';
import { D1HabitCompanion } from './habit-companion.ts';
// Read-side context composed from task, schedule, progress and conversation data.
export class D1WorkReader extends TaskHierarchyStore implements WorkReader {
    get habitCompanion() { return new D1HabitCompanion(this.db); }
    notificationState(owner: string, now: number) {
        return new ScheduleStore(this.db).restStatus(owner, now);
    }
    isMorningReply(owner: string, messageId: number | undefined, now: number) {
        return new ScheduleStore(this.db).isMorningReply(owner, messageId, now);
    }
    async scheduleContext(owner: string, now: number) {
        const store = new ScheduleStore(this.db);
        const day = await store.ensureDay(owner, now);
        return day ? { ...day, settings: await store.settings(owner) } : null;
    }
    progress(owner: string) {
        return progressData(this.db, owner);
    }
    workPage(owner: string, filter: import('../../domain/progress.ts').WorkFilter, offset: number, now: number) {
        return workPage(this.db, owner, filter, offset, now);
    }
    boardSelection(owner: string) {
        return boardSelection(this.db, owner);
    }
    async agenda(owner: string, from: number, to: number, cursor: number) {
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 31 * 86400000 || !Number.isSafeInteger(cursor) || cursor < 0 || cursor > 10000)
            throw Error('INVALID_AGENDA_RANGE');
        const rows = (await query(this.db, `SELECT * FROM (
      SELECT 'session' AS kind,s.id,t.title,s.start_at AS at,s.status FROM sessions s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner=? AND s.start_at>=? AND s.start_at<? AND s.status!='draft'
      UNION ALL SELECT 'reminder',a.id,COALESCE(a.subject,t.title),a.due,a.status FROM task_appointments a LEFT JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner WHERE a.owner=? AND a.due>=? AND a.due<? AND a.status='active'
      UNION ALL SELECT 'event',id,title,start_at,status FROM local_events WHERE owner=? AND status='scheduled'
      UNION ALL SELECT 'deadline',id,title,CAST((julianday(CASE WHEN deadline_precision='date' THEN deadline||'T23:59:00+07:00' ELSE deadline END)-2440587.5)*86400000 AS INTEGER),status FROM tasks WHERE owner=? AND deleted_at IS NULL AND status='active' AND deadline IS NOT NULL
    ) WHERE at>=? AND at<? ORDER BY at,kind,id LIMIT 11 OFFSET ?`, owner, from, to, owner, from, to, owner, owner, from, to, cursor).all<Record<string, unknown>>()).results;
        return { items: rows.slice(0, 10), nextCursor: rows.length > 10 ? cursor + 10 : null, source: 'local', timezone: 'Asia/Ho_Chi_Minh' };
    }
    conversationPending(owner: string, now: number) {
        return query(this.db, 'SELECT id,kind,draft,expires FROM conversation_pending WHERE owner=? AND expires>?', owner, now).first<import('../../domain/conversation.ts').PendingConversation>();
    }
    event(owner: string, id: string) {
        return query(this.db, 'SELECT * FROM local_events WHERE owner=? AND id=?', owner, id).first<import('../../domain/event.ts').LocalEvent>();
    }
    events(owner: string, from: number, to: number) {
        return localEvents(this.db, owner, from, to);
    }
    async appointmentContext(owner: string, now: number) {
        return (await query(this.db, "SELECT a.id,a.task_id,a.event_id,COALESCE(a.subject,t.title) AS subject,a.due,a.responded,a.version,o.message_id,o.state AS delivery_state FROM task_appointments a LEFT JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner LEFT JOIN outbox o ON o.reminder_id='appointment:'||a.id||':1' WHERE a.owner=? AND a.status='active' AND a.due>? AND a.due<? ORDER BY a.due LIMIT 40", owner, now - 3600000, now + 7 * 86400000).all<Record<string, unknown>>()).results;
    }
    async clarifications(owner: string, now: number) {
        return (await query(this.db, "SELECT * FROM conversation_clarifications WHERE owner=? AND status='waiting' AND expires>? ORDER BY created,id LIMIT 12", owner, now).all<import('../../domain/conversation.ts').Clarification>()).results;
    }
    summary(owner: string) {
        return query(this.db, 'SELECT content,covered_through,version,updated FROM conversation_summaries WHERE owner=?', owner).first<import('../../domain/conversation.ts').Summary>();
    }
    runningSession(owner: string) {
        return query(this.db, "SELECT * FROM sessions WHERE owner=? AND status='running' ORDER BY start_at LIMIT 1", owner).first<Session>();
    }
    taskFocus(owner: string, now: number) {
        return currentTaskFocus(this.db, owner, now);
    }
    memory(owner: string, id: string) {
        return query(this.db, 'SELECT * FROM memories WHERE owner=? AND id=?', owner, id).first<Memory>();
    }
    async memories(owner: string, now: number, offset = 0, limit = 30) {
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 30)
            throw Error('INVALID_PAGE');
        return (await query(this.db, 'SELECT * FROM memories WHERE owner=? AND (expires IS NULL OR expires>?) ORDER BY created DESC,id DESC LIMIT ? OFFSET ?', owner, now, limit, offset).all<Memory>()).results;
    }
    memoryConfirmation(owner: string, id: string) {
        return query(this.db, 'SELECT * FROM memory_confirmations WHERE owner=? AND id=?', owner, id).first<import('../../domain/memory.ts').MemoryConfirmation>();
    }
    async unsummarized(owner: string, now: number, after: number) {
        return (await query(this.db, 'SELECT * FROM conversation_turns WHERE owner=? AND expires>? AND command_id>? ORDER BY command_id LIMIT 40', owner, now, after).all<ConversationTurn>()).results;
    }
    async history(owner: string, now: number) {
        return (await query(this.db, 'SELECT * FROM conversation_turns WHERE owner=? AND expires>? ORDER BY command_id DESC LIMIT 12', owner, now).all<ConversationTurn>()).results.reverse();
    }
    async focus(owner: string, now: number) {
        return (await query(this.db, 'SELECT task_id FROM chat_focus WHERE owner=? AND expires>?', owner, now).first<{
            task_id: string;
        }>())?.task_id ?? null;
    }
    async aiEnabled(owner: string) {
        return (await query(this.db, 'SELECT enabled FROM memory_settings WHERE owner=?', owner).first<{
            enabled: number;
        }>())?.enabled !== 0;
    }
    async sessions(owner: string, start: number, end: number) {
        return (await query(this.db, "SELECT * FROM sessions WHERE owner=? AND start_at>=? AND start_at<? AND status!='draft' ORDER BY start_at LIMIT 30", owner, start, end).all<Session>()).results;
    }
    session(owner: string, id: string) {
        return query(this.db, 'SELECT * FROM sessions WHERE owner=? AND id=?', owner, id).first<Session>();
    }
    sessionInput(owner: string) {
        return query(this.db, 'SELECT task_id,expires FROM session_input WHERE owner=?', owner).first<{
            task_id: string;
            expires: number;
        }>();
    }
    preferences(owner: string) {
        return query(this.db, 'SELECT * FROM reminder_preferences WHERE owner=?', owner).first<Preferences>();
    }
    proposal(owner: string, id: string) {
        return query(this.db, 'SELECT * FROM proposals WHERE owner=? AND id=?', owner, id).first<Proposal>();
    }
    selection(owner: string) {
        return query(this.db, 'SELECT * FROM selections WHERE owner=?', owner).first<Selection>();
    }
}
