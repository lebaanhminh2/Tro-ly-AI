import type { Task } from '../../domain/work.ts';
import type { Database, Statement } from './database.ts';
import { query } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import {
  archiveCompleted as archiveCompletedHistory,
  historyPage as readHistoryPage,
} from './work-history.ts';
// Task hierarchy and its atomic mutations. Does not own inbox or chat context.
export class TaskHierarchyStore {
  protected db: Database;
  constructor(db: Database) {
    this.db = db;
  }
  async hasOpenSteps(owner: string, taskId: string) {
    return !!(await query(
      this.db,
      "SELECT id FROM task_steps WHERE owner=? AND task_id=? AND status='active' AND deleted_at IS NULL LIMIT 1",
      owner,
      taskId,
    ).first());
  }
  async hierarchy(owner: string) {
    const tasks = (
      await query(
        this.db,
        'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND archived_at IS NULL ORDER BY status,deadline IS NULL,deadline,public_code LIMIT 200',
        owner,
      ).all<
        Task & {
          public_code: number;
        }
      >()
    ).results;
    return this.withSteps(owner, tasks);
  }
  private async withSteps<T extends Task>(owner: string, tasks: T[]) {
    if (!tasks.length)
      return [] as Array<
        T & {
          steps: {
            id: string;
            task_id: string;
            step_code: number;
            title: string;
            status: string;
            version: number;
          }[];
        }
      >;
    const steps = (
      await query(
        this.db,
        'SELECT s.* FROM task_steps s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner=? AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL AND s.task_id IN (SELECT value FROM json_each(?)) ORDER BY s.step_code',
        owner,
        JSON.stringify(tasks.map((task) => task.id)),
      ).all<{
        id: string;
        task_id: string;
        step_code: number;
        title: string;
        status: string;
        version: number;
      }>()
    ).results;
    const byTask = new Map<string, typeof steps>();
    for (const step of steps) {
      const group = byTask.get(step.task_id) ?? [];
      group.push(step);
      byTask.set(step.task_id, group);
    }
    return tasks.map((task) => ({ ...task, steps: byTask.get(task.id) ?? [] }));
  }
  async activeTaskTotal(owner: string) {
    const result = await query(
      this.db,
      "SELECT COUNT(*) AS total FROM tasks WHERE owner=? AND status='active' AND deleted_at IS NULL AND archived_at IS NULL",
      owner,
    ).first<{
      total: number;
    }>();
    return result?.total ?? 0;
  }
  async activeTaskPage(owner: string, offset: number, day: number | null, limit = 200) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > 100000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    )
      throw Error('INVALID_PAGE');
    const rows = (
      await query(
        this.db,
        `SELECT t.*,p.remaining_minutes,p.remaining_balance,COALESCE(l.minutes,0) AS actual_minutes
            FROM tasks t LEFT JOIN task_planning p ON p.owner=t.owner AND p.task_id=t.id
            LEFT JOIN task_work_logs l ON l.owner=t.owner AND l.task_id=t.id AND l.day=?
            WHERE t.owner=? AND t.status='active' AND t.deleted_at IS NULL AND t.archived_at IS NULL
            ORDER BY t.deadline IS NULL,t.deadline,t.public_code LIMIT ? OFFSET ?`,
        day,
        owner,
        limit + 1,
        offset,
      ).all<
        Task & {
          public_code: number;
          remaining_minutes: number | null;
          remaining_balance: number | null;
          actual_minutes: number;
        }
      >()
    ).results;
    const total = await this.activeTaskTotal(owner);
    return {
      items: await this.withSteps(owner, rows.slice(0, limit)),
      offset,
      limit,
      total,
      hasMore: rows.length > limit,
    };
  }
  async planTaskDetails(owner: string, ids: string[], day: number | null) {
    if (ids.length > 200) throw Error('INVALID_PAGE');
    if (!ids.length) return [];
    const rows = (
      await query(
        this.db,
        `SELECT t.*,p.remaining_minutes,p.remaining_balance,COALESCE(l.minutes,0) AS actual_minutes
            FROM tasks t LEFT JOIN task_planning p ON p.owner=t.owner AND p.task_id=t.id
            LEFT JOIN task_work_logs l ON l.owner=t.owner AND l.task_id=t.id AND l.day=?
            WHERE t.owner=? AND t.deleted_at IS NULL AND t.archived_at IS NULL AND t.id IN (SELECT value FROM json_each(?))
            ORDER BY t.status,t.deadline IS NULL,t.deadline,t.public_code`,
        day,
        owner,
        JSON.stringify(ids),
      ).all<
        Task & {
          public_code: number;
          remaining_minutes: number | null;
          remaining_balance: number | null;
          actual_minutes: number;
        }
      >()
    ).results;
    return this.withSteps(owner, rows);
  }
  async historyPage(owner: string, offset = 0, limit = 20) {
    return readHistoryPage(this.db, owner, offset, limit);
  }
  async archiveCompleted(owner: string, now: number, retentionDays = 90, limit = 100) {
    return archiveCompletedHistory(this.db, owner, now, retentionDays, limit);
  }
  async deleteHierarchyGroup(
    owner: string,
    requestId: string,
    items: {
      id: string;
      version: number;
    }[],
    now: number,
  ) {
    if (
      !items.length ||
      items.length > 50 ||
      new Set(items.map((t) => t.id)).size !== items.length ||
      items.some((t) => !t.id || !Number.isInteger(t.version) || t.version < 1)
    )
      throw Error('INVALID_DELETE_GROUP');
    return new HealthyStore(this.db).mutate(
      owner,
      requestId,
      'delete-task-group',
      { items },
      now,
      (state) => {
        const statements: Statement[] = [];
        for (const item of items) {
          statements.push(
            query(
              this.db,
              'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END',
              owner,
              item.id,
              item.version,
            ),
            query(
              this.db,
              'UPDATE tasks SET deleted_at=?,version=version+1 WHERE owner=? AND id=?',
              now,
              owner,
              item.id,
            ),
            query(
              this.db,
              "UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND task_id=? AND status='active'",
              owner,
              item.id,
            ),
            query(
              this.db,
              "UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN(SELECT id FROM sessions WHERE owner=? AND task_id=?) AND status IN('pending','queued')",
              owner,
              owner,
              item.id,
            ),
            query(
              this.db,
              "UPDATE sessions SET status='skipped',active_since=NULL,version=version+1 WHERE owner=? AND task_id=? AND status NOT IN('completed','skipped')",
              owner,
              item.id,
            ),
            query(
              this.db,
              "UPDATE conversation_clarifications SET status='cancelled' WHERE owner=? AND task_id=? AND status='waiting'",
              owner,
              item.id,
            ),
            query(
              this.db,
              'DELETE FROM task_focus_state WHERE owner=? AND task_id=?',
              owner,
              item.id,
            ),
          );
        }
        return { state, result: { deleted: items.length }, statements };
      },
    );
  }
  async prepareStep(
    owner: string,
    requestId: string,
    args: {
      operation: string;
      taskId: string;
      stepId?: string;
      version: number;
      title?: string;
      complete?: boolean;
    },
    now: number,
  ) {
    const statements: Statement[] = [];
    const result = await this.mutateHierarchy(owner, requestId, args, now, (s) =>
      statements.push(...s),
    );
    return { result, statements };
  }
  async mutateHierarchy(
    owner: string,
    requestId: string,
    input: {
      operation: string;
      taskId?: string;
      stepId?: string;
      version?: number;
      title?: string;
      note?: string;
      deadline?: string | null;
      complete?: boolean;
      confirm?: boolean;
      remainingMinutes?: number | null;
    },
    now: number,
    defer?: (statements: Statement[]) => void,
  ) {
    const operation = input.operation;
    if (
      input.remainingMinutes !== undefined &&
      (!['create', 'edit'].includes(operation) ||
        (input.remainingMinutes !== null &&
          (!Number.isInteger(input.remainingMinutes) ||
            input.remainingMinutes < 0 ||
            input.remainingMinutes > 100000)))
    )
      throw Error('INVALID_REQUEST');
    if (
      ![
        'create',
        'edit',
        'complete',
        'delete',
        'add_step',
        'step_status',
        'edit_step',
        'delete_step',
      ].includes(operation)
    )
      throw Error('INVALID_OPERATION');
    if (
      ['create', 'edit', 'add_step', 'edit_step'].includes(operation) &&
      (!input.title?.trim() || input.title.length > 160)
    )
      throw Error('INVALID_TITLE');
    if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 2000))
      throw Error('INVALID_NOTE');
    if (
      input.deadline !== undefined &&
      input.deadline !== null &&
      !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline) &&
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\+07:00$/.test(input.deadline)
    )
      throw Error('INVALID_DEADLINE');
    if (input.deadline) {
      const parsed = Date.parse(
        input.deadline.length === 10 ? input.deadline + 'T00:00:00Z' : input.deadline,
      );
      if (
        !Number.isFinite(parsed) ||
        new Date(parsed + (input.deadline.length === 10 ? 0 : 25200000))
          .toISOString()
          .slice(0, 10) !== input.deadline.slice(0, 10)
      )
        throw Error('INVALID_DEADLINE');
    }
    if (operation === 'complete' || operation === 'step_status') {
      if (typeof input.complete !== 'boolean') throw Error('INVALID_STATUS');
    }
    const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
    const task = operation === 'create' ? null : await this.task(owner, input.taskId ?? '');
    // Receipt replay is checked by HealthyStore before invoking this closure.
    const existingAward = task
      ? await q(
          'SELECT task_id FROM task_ticket_awards WHERE owner=? AND task_id=?',
          owner,
          task.id,
        ).first()
      : null;
    const children = task
      ? (
          await q(
            'SELECT * FROM task_steps WHERE owner=? AND task_id=? AND deleted_at IS NULL',
            owner,
            task.id,
          ).all<{
            id: string;
            status: string;
            version: number;
          }>()
        ).results
      : [];
    const id = crypto.randomUUID();
    return new HealthyStore(this.db, defer).mutate<Record<string, unknown>>(
      owner,
      requestId,
      'task:' + operation,
      input,
      now,
      (state) => {
        const statements: Statement[] = [];
        const saveRemaining = (taskId: string) => {
          if (input.remainingMinutes !== undefined)
            statements.push(
              q(
                'INSERT INTO task_planning(owner,task_id,remaining_minutes,remaining_balance,updated) VALUES(?,?,?,?,?) ON CONFLICT(owner,task_id) DO UPDATE SET remaining_minutes=excluded.remaining_minutes,remaining_balance=excluded.remaining_balance,updated=excluded.updated,version=task_planning.version+1',
                owner,
                taskId,
                input.remainingMinutes,
                input.remainingMinutes,
                now,
              ),
            );
        };
        if (operation === 'create') {
          statements.push(
            q(
              'INSERT INTO tasks(id,owner,title,note,deadline,deadline_precision,created) VALUES(?,?,?,?,?,?,?)',
              id,
              owner,
              input.title!.trim(),
              input.note?.trim() ?? '',
              input.deadline ?? null,
              input.deadline ? (input.deadline.length === 10 ? 'date' : 'datetime') : null,
              now,
            ),
          );
          saveRemaining(id);
          return { state, result: { id }, statements };
        }
        if (!task || task.version !== input.version) throw Error('STALE_TASK');
        statements.push(
          q(
            'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END',
            owner,
            task.id,
            input.version!,
          ),
        );
        if (operation === 'edit') {
          saveRemaining(task.id);
          const deadline = input.deadline === undefined ? task.deadline : input.deadline;
          statements.push(
            q(
              'UPDATE tasks SET title=?,note=?,deadline=?,deadline_precision=?,version=version+1 WHERE owner=? AND id=?',
              input.title!.trim(),
              input.note === undefined ? (task.note ?? '') : input.note.trim(),
              deadline,
              deadline ? (deadline.length === 10 ? 'date' : 'datetime') : null,
              owner,
              task.id,
            ),
          );
        } else if (operation === 'complete') {
          if (input.complete && children.some((s) => s.status !== 'completed') && !input.confirm)
            throw Error('CONFIRM_CHILDREN');
          statements.push(
            q(
              'UPDATE tasks SET status=?,version=version+1 WHERE owner=? AND id=?',
              input.complete ? 'completed' : 'active',
              owner,
              task.id,
            ),
          );
          statements.push(
            q(
              "UPDATE outbox SET state='failed' WHERE id LIKE ? AND state='pending'",
              'nudge:' + owner + ':%',
            ),
          );
          statements.push(
            q(
              "UPDATE nudge_cycles SET cycle=cycle+1,version=version+1,tasks_json='[]',attempts=0,next_at=?,blocked_json='[]',lease_until=0 WHERE owner=?",
              now,
              owner,
            ),
          );
          if (input.complete) {
            statements.push(
              q('DELETE FROM task_focus_state WHERE owner=? AND task_id=?', owner, task.id),
            );
            statements.push(
              q(
                "UPDATE task_steps SET status='completed',completed_at=COALESCE(completed_at,?),version=version+1 WHERE owner=? AND task_id=? AND deleted_at IS NULL AND status='active'",
                now,
                owner,
                task.id,
              ),
            );
            statements.push(
              q(
                'UPDATE task_completions SET completed_at=? WHERE owner=? AND task_id=?',
                now,
                owner,
                task.id,
              ),
            );
            statements.push(
              q(
                "UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND task_id=? AND status='active'",
                owner,
                task.id,
              ),
            );
            statements.push(
              q(
                "UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN(SELECT id FROM sessions WHERE owner=? AND task_id=?) AND status IN('pending','queued')",
                owner,
                owner,
                task.id,
              ),
            );
            statements.push(
              q(
                "UPDATE sessions SET status=CASE WHEN status IN('running','paused') THEN 'completed' ELSE 'skipped' END,spent_ms=spent_ms+CASE WHEN active_since IS NULL THEN 0 ELSE MAX(0,?-active_since) END,active_since=NULL,version=version+1 WHERE owner=? AND task_id=? AND status NOT IN('completed','skipped')",
                now,
                owner,
                task.id,
              ),
            );
            if (!existingAward && !state.suspended) {
              statements.push(
                q(
                  'INSERT INTO task_ticket_awards(owner,task_id,created) VALUES(?,?,?)',
                  owner,
                  task.id,
                  now,
                ),
              );
              return {
                state: { ...state, tickets: state.tickets + 1 },
                result: { id: task.id, ticket: 1 },
                statements,
              };
            }
          }
        } else if (operation === 'delete') {
          if (!input.confirm) throw Error('CONFIRM_DELETE');
          statements.push(
            q(
              'UPDATE tasks SET deleted_at=?,version=version+1 WHERE owner=? AND id=?',
              now,
              owner,
              task.id,
            ),
          );
          statements.push(
            q(
              "UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND task_id=? AND status='active'",
              owner,
              task.id,
            ),
          );
          statements.push(
            q(
              "UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN(SELECT id FROM sessions WHERE owner=? AND task_id=?) AND status IN('pending','queued')",
              owner,
              owner,
              task.id,
            ),
          );
          statements.push(
            q(
              "UPDATE sessions SET status='skipped',version=version+1,active_since=NULL WHERE owner=? AND task_id=? AND status NOT IN('completed','skipped')",
              owner,
              task.id,
            ),
          );
          statements.push(
            q('DELETE FROM task_focus_state WHERE owner=? AND task_id=?', owner, task.id),
          );
        } else if (operation === 'add_step') {
          if (task.status === 'completed' && !input.confirm) throw Error('CONFIRM_REOPEN_PARENT');
          statements.push(
            q(
              'INSERT INTO task_steps(id,owner,task_id,step_code,title,created) SELECT ?,?,?,COALESCE(MAX(step_code),0)+1,?,? FROM task_steps WHERE task_id=?',
              id,
              owner,
              task.id,
              input.title!.trim(),
              now,
              task.id,
            ),
          );
          statements.push(
            q(
              "UPDATE tasks SET status='active',version=version+1 WHERE owner=? AND id=?",
              owner,
              task.id,
            ),
          );
        } else {
          const step = children.find((s) => s.id === input.stepId);
          if (!step) throw Error('STEP_NOT_FOUND');
          if (operation === 'step_status') {
            if (!input.complete && task.status === 'completed' && !input.confirm)
              throw Error('CONFIRM_REOPEN_PARENT');
            statements.push(
              q(
                'UPDATE task_steps SET status=?,completed_at=?,version=version+1 WHERE owner=? AND id=?',
                input.complete ? 'completed' : 'active',
                input.complete ? now : null,
                owner,
                step.id,
              ),
            );
            statements.push(
              q(
                'UPDATE tasks SET status=?,version=version+1 WHERE owner=? AND id=?',
                input.complete ? (task.status ?? 'active') : 'active',
                owner,
                task.id,
              ),
            );
          } else if (operation === 'edit_step') {
            statements.push(
              q(
                'UPDATE task_steps SET title=?,version=version+1 WHERE owner=? AND id=?',
                input.title!.trim(),
                owner,
                step.id,
              ),
            );
            statements.push(
              q('UPDATE tasks SET version=version+1 WHERE owner=? AND id=?', owner, task.id),
            );
          } else {
            if (!input.confirm) throw Error('CONFIRM_DELETE');
            statements.push(
              q(
                'UPDATE task_steps SET deleted_at=?,version=version+1 WHERE owner=? AND id=?',
                now,
                owner,
                step.id,
              ),
            );
            statements.push(
              q('UPDATE tasks SET version=version+1 WHERE owner=? AND id=?', owner, task.id),
            );
          }
        }
        return { state, result: { id: task.id }, statements };
      },
    );
  }
  async priorityTasks(owner: string) {
    return (
      await query(
        this.db,
        "SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND status='active' ORDER BY deadline IS NULL, CASE WHEN deadline_precision='date' THEN julianday(deadline||'T23:59:00+07:00') ELSE julianday(deadline) END,created,id LIMIT 3",
        owner,
      ).all<Task>()
    ).results;
  }
  async findTasks(
    owner: string,
    text: string,
    status: 'active' | 'completed' | 'all',
    cursor: number,
  ) {
    if (
      text.length > 160 ||
      !Number.isSafeInteger(cursor) ||
      cursor < 0 ||
      cursor > 10000 ||
      !['active', 'completed', 'all'].includes(status)
    )
      throw Error('INVALID_QUERY');
    const rows = (
      await query(
        this.db,
        `SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND (?='all' OR status=?)
      AND (?='' OR instr(lower(title),lower(?))>0) ORDER BY created,id LIMIT 11 OFFSET ?`,
        owner,
        status,
        status,
        text,
        text,
        cursor,
      ).all<Task>()
    ).results;
    return { tasks: rows.slice(0, 10), nextCursor: rows.length > 10 ? cursor + 10 : null };
  }
  async completionUndo(owner: string, taskId: string, version: number, now: number) {
    return !!(await query(
      this.db,
      'SELECT task_id FROM task_completion_undo WHERE owner=? AND task_id=? AND expected_version=? AND expires>?',
      owner,
      taskId,
      version,
      now,
    ).first());
  }
  async conversationTasks(owner: string, text: string) {
    return (
      await query(
        this.db,
        `SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND instr(lower(?),lower(title))>0 ORDER BY length(title) DESC,created DESC LIMIT 20`,
        owner,
        text,
      ).all<Task>()
    ).results;
  }
  async sameTitleTasks(owner: string, title: string) {
    return (
      await query(
        this.db,
        'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND title=? ORDER BY created LIMIT 2',
        owner,
        title,
      ).all<Task>()
    ).results;
  }
  task(owner: string, id: string) {
    return query(
      this.db,
      'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND id=?',
      owner,
      id,
    ).first<Task>();
  }
  async tasks(owner: string, offset: number) {
    return (
      await query(
        this.db,
        'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL ORDER BY created,id LIMIT 10 OFFSET ?',
        owner,
        offset,
      ).all<Task>()
    ).results;
  }
}
