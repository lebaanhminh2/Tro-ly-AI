import type { WorkReader } from '../ports/work-store.ts';
type Turn = { role: 'user' | 'model'; text: string };
export async function buildContext(
  store: WorkReader,
  owner: string,
  text: string,
  now: number,
  options: { includeSummaryRequest?: boolean } = {},
) {
  const [
    notificationState,
    focus,
    taskFocus,
    memories,
    history,
    summary,
    pending,
    progress,
    priority,
    active,
    events,
    appointments,
    blocks,
    habitCompanion,
    mentioned,
  ] = await Promise.all([
    store.notificationState?.(owner, now) ?? null,
    store.focus(owner, now),
    store.taskFocus?.(owner, now) ?? null,
    store.memories(owner, now),
    store.history(owner, now),
    store.summary?.(owner) ?? null,
    store.clarifications?.(owner, now) ?? [],
    store.conversationProgress
      ? store.conversationProgress(owner, now)
      : store.progress?.(owner, now),
    store.priorityTasks?.(owner) ?? [],
    store.findTasks?.(owner, '', 'active', 0) ?? null,
    store.events?.(owner, now - 86400000, now + 7 * 86400000) ?? [],
    store.appointmentContext?.(owner, now) ?? [],
    store.sessions(owner, now - 86400000, now + 86400000),
    store.habitCompanion?.context(owner, now) ?? null,
    store.conversationTasks?.(owner, text) ?? [],
  ]);
  const progressContext = progress
    ? {
        recent_steps: progress.milestones.slice(0, 3),
        recent_completed: progress.completions.slice(0, 3),
        achievements: progress.achievements,
      }
    : null;
  // Chat cannot call update_summary. Keep existing summaries and history, but
  // only fetch the source transcript when the caller can actually summarize it.
  const [source, focused, extra, fallbackTasks] = await Promise.all([
    options.includeSummaryRequest === false
      ? []
      : (store.unsummarized?.(owner, now, summary?.covered_through ?? -1) ?? history),
    focus ? store.task(owner, focus) : null,
    active?.nextCursor !== null && active?.nextCursor !== undefined
      ? store.findTasks!(owner, '', 'active', active.nextCursor)
      : null,
    active ? [] : store.tasks(owner, 0),
  ]);
  const summarySource: typeof source = [];
  let sourceSize = 0;
  for (const turn of source) {
    const size = turn.user_text.length + turn.assistant_text.length;
    if (summarySource.length && sourceSize + size > 8000) break;
    summarySource.push(turn);
    sourceSize += size;
  }
  const candidates = [...mentioned, ...priority, ...(focused ? [focused] : [])];
  const tasks = [
    ...new Map(
      [...candidates, ...(active?.tasks ?? fallbackTasks), ...(extra?.tasks ?? [])].map((t) => [
        t.id,
        t,
      ]),
    ).values(),
  ];
  const nextTaskCursor = extra ? extra.nextCursor : (active?.nextCursor ?? null);
  const turns: Turn[] = history.flatMap((h) => [
    { role: 'user' as const, text: h.user_text },
    { role: 'model' as const, text: h.assistant_text },
  ]);
  turns.push({ role: 'user', text });
  const localNow = new Date(now + 7 * 3600000).toISOString().slice(0, 19) + '+07:00';
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now + 25200000 + i * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      weekday: ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][
        d.getUTCDay()
      ],
    };
  });
  const context = JSON.stringify({
    notificationState,
    habitCompanion,
    dates,
    userId: owner,
    now: localNow,
    today: localNow.slice(0, 10),
    tomorrow: new Date(now + 7 * 3600000 + 86400000).toISOString().slice(0, 10),
    timezone: 'Asia/Ho_Chi_Minh',
    focus,
    taskFocus,
    summary,
    progress: progressContext,
    clarifications: pending,
    events,
    appointments,
    blocks,
    nextTaskCursor,
    ...(options.includeSummaryRequest === false
      ? {}
      : {
          summary_request:
            source.length >= 8
              ? {
                  through: summarySource.at(-1)!.command_id,
                  expected_version: summary?.version ?? 0,
                  source_turns: summarySource.map((h) => ({
                    id: h.command_id,
                    user: h.user_text,
                    assistant: h.assistant_text,
                  })),
                }
              : null,
        }),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline,
      version: t.version,
      status: t.status ?? 'active',
    })),
    memories: memories.map((m) => ({
      content: m.content,
      kind: m.kind,
      source: m.source,
      expires: m.expires,
    })),
  });
  while (turns.length > 1 && context.length + turns.reduce((n, t) => n + t.text.length, 0) > 10000)
    turns.splice(0, 2);
  if (context.length + text.length > 28000) throw Error('CONTEXT_TOO_LARGE');
  return { turns, context, tasks };
}
