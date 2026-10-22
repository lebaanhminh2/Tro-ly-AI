import { recordTaskNudgeActivity } from '../../adapters/d1/work-nudges.ts';
import { D1WorkStore } from '../../adapters/d1/work-store.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';
import { query } from '../../adapters/d1/database.ts';
export async function handleTasks(
  { env, owner, now, healthy }: MiniAppContext,
  input: MiniAppInput,
  path: string,
): Promise<Response | undefined> {
  if (path === '/api/tasks-delete') {
    if (
      Object.keys(input).some((k) => !['id', 'items', 'confirm'].includes(k)) ||
      input.confirm !== true ||
      !Array.isArray(input.items) ||
      input.items.some(
        (t) =>
          !t ||
          typeof t !== 'object' ||
          Object.keys(t).some((k) => !['id', 'version'].includes(k)) ||
          typeof t.id !== 'string' ||
          !Number.isInteger(t.version),
      )
    )
      return json({ error: 'INVALID_REQUEST' }, 400);
    return json({
      result: await new D1WorkStore(env.DB).deleteHierarchyGroup(owner, input.id, input.items, now),
    });
  }
  if (path === '/api/tasks') {
    if (
      Object.keys(input).some(
        (k) =>
          ![
            'id',
            'operation',
            'taskId',
            'stepId',
            'version',
            'title',
            'note',
            'deadline',
            'complete',
            'confirm',
            'remainingMinutes',
          ].includes(k),
      )
    )
      return json({ error: 'INVALID_REQUEST' }, 400);
    for (const key of ['operation', 'taskId', 'stepId', 'title', 'note'])
      if (key in input && typeof input[key] !== 'string')
        return json({ error: 'INVALID_REQUEST' }, 400);
    if (
      ('deadline' in input && input.deadline !== null && typeof input.deadline !== 'string') ||
      ('version' in input && !Number.isInteger(input.version)) ||
      ('confirm' in input && typeof input.confirm !== 'boolean')
    )
      return json({ error: 'INVALID_REQUEST' }, 400);
    const { id, ...args } = input;
    const result = await new D1WorkStore(env.DB).mutateHierarchy(
      owner,
      String(id),
      args as Parameters<D1WorkStore['mutateHierarchy']>[2],
      now,
    );
    await recordTaskNudgeActivity(env.DB, owner, `mini:${input.id}`, now);
    // Return the changed task and wallet so the editor can close on confirmation
    // without a second, full-app bootstrap just to learn its new version.
    const taskId = (result as { id?: string }).id;
    const day = await query(
      env.DB,
      'SELECT day FROM schedule_days WHERE owner=? AND start_at<=? AND end_at>? ORDER BY start_at DESC LIMIT 1',
      owner,
      now,
      now,
    ).first<{ day: number }>();
    const [tasks, account, completion] = await Promise.all([
      new D1WorkStore(env.DB).planTaskDetails(owner, taskId ? [taskId] : [], day?.day ?? null),
      healthy.read(owner),
      taskId
        ? query(
            env.DB,
            'SELECT completed_at FROM task_completions WHERE owner=? AND task_id=?',
            owner,
            taskId,
          ).first<{ completed_at: number }>()
        : Promise.resolve(null),
    ]);
    const task = tasks[0];
    return json({
      result,
      task: task
        ? {
            ...task,
            completed_at: task.status === 'completed' ? (completion?.completed_at ?? now) : null,
          }
        : null,
      account,
    });
  }
}
