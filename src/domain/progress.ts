export type Completion = {
  task_id: string;
  completed_at: number;
  deadline: string | null;
  precision: string | null;
  title: string;
};
export type Milestone = { id: string; task_id: string; content: string; created: number };
export type Achievement = { code: string; unlocked_at: number; notified: number };
export type ProgressStatistics = {
  today: number;
  week: number;
  total: number;
  streak: number;
  best: number;
  onTime: number;
  dated: number;
  bars: { day: number; count: number }[];
  calendar: { day: number; active: boolean }[];
};
export type ProgressData = {
  completions: Completion[];
  milestones: Milestone[];
  achievements: Achievement[];
  summary?: { asOf: number; stats: ProgressStatistics };
};
export type SelectedTask = { id: string; version: number; title: string };
export type BoardSelection = { items: SelectedTask[]; expires: number; revision: number };
export type WorkFilter =
  'active' | 'all' | 'overdue' | 'today' | 'upcoming' | 'undated' | 'completed';
export type WorkPage = { items: import('./work.ts').Task[]; total: number };
export type ProgressChange =
  | {
      type: 'progress-record';
      owner: string;
      id: string;
      taskId: string;
      content: string;
      created: number;
      updateId: number;
    }
  | {
      type: 'board-select';
      owner: string;
      items: SelectedTask[];
      expectedRevision: number;
      expires: number;
    }
  | {
      type: 'tasks-delete';
      owner: string;
      items: SelectedTask[];
      now: number;
      selectionRevision: number;
    };
const DAY = 86400000;
export function localDay(time: number) {
  return Math.floor((time + 7 * 3600000) / DAY);
}
export function statistics(data: ProgressData, now: number) {
  if (data.summary) {
    if (data.summary.asOf !== now) throw Error('PROGRESS_SNAPSHOT_TIME_MISMATCH');
    return data.summary.stats;
  }
  const today = localDay(now),
    days = new Set([
      ...data.completions.map((c) => localDay(c.completed_at)),
      ...data.milestones.map((m) => localDay(m.created)),
    ]);
  const sorted = [...days].filter((d) => d <= today).sort((a, b) => a - b);
  let best = 0,
    run = 0,
    previous = -Infinity;
  for (const day of sorted) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  let streak = 0,
    cursor = days.has(today) ? today : today - 1;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  const weekStart = today - ((new Date(today * DAY).getUTCDay() + 6) % 7);
  const week = data.completions.filter(
    (c) => localDay(c.completed_at) >= weekStart && c.completed_at <= now,
  );
  const dated = week.filter((c) => c.deadline !== null);
  const onTime = dated.filter(
    (c) =>
      c.completed_at <=
      (c.precision === 'date'
        ? Date.parse(c.deadline + 'T00:00:00+07:00') + DAY - 1
        : Date.parse(c.deadline!)),
  ).length;
  const bars = Array.from({ length: 7 }, (_, i) => {
    const day = today - 6 + i;
    return { day, count: data.completions.filter((c) => localDay(c.completed_at) === day).length };
  });
  const calendar = Array.from({ length: 28 }, (_, i) => {
    const day = today - 27 + i;
    return { day, active: days.has(day) };
  });
  return {
    today: data.completions.filter((c) => localDay(c.completed_at) === today).length,
    week: week.length,
    total: data.completions.length,
    streak,
    best,
    onTime,
    dated: dated.length,
    bars,
    calendar,
  };
}
export const achievementRules = [
  ...([1, 10, 30] as const).map((n) => ({
    code: 'tasks_' + n,
    label: n + ' việc hoàn thành',
    kind: 'total' as const,
    target: n,
  })),
  ...([3, 7, 14, 30] as const).map((n) => ({
    code: 'streak_' + n,
    label: n + ' ngày tiến bộ',
    kind: 'best' as const,
    target: n,
  })),
];
