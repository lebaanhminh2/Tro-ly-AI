import { D1HabitStore } from '../../adapters/d1/habit-store.ts';
import { HabitService } from '../../application/habit-service.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';
import { query } from '../../adapters/d1/database.ts';

export async function readHabits({ env, owner, now }: MiniAppContext, url: URL): Promise<Response> {
  const store = new D1HabitStore(env.DB);
  if (url.pathname === '/api/habits') {
    const started = performance.now();
    const offset = url.searchParams.get('offset') ?? '0';
    if (!/^\d+$/.test(offset)) throw Error('INVALID_PAGE');
    const data = await store.today(owner, now, url.searchParams.get('archived') === '1', false, {
      archiveOffset: Number(offset),
    });
    const preferences = (
      await query(
        env.DB,
        'SELECT habit_id,hidden,choice_day AS choiceDay,choice FROM habit_presentation WHERE owner=? AND habit_id IN(SELECT value FROM json_each(?))',
        owner,
        JSON.stringify(data.habits.map((view) => view.habit.id)),
      ).all<{
        habit_id: string;
        hidden: '' | 'archived' | 'deleted';
        choiceDay: number | null;
        choice: '' | 'deferred' | 'included';
      }>()
    ).results;
    const response = json({
      now,
      ...data,
      habits: data.habits
        .map((view) => ({
          ...view,
          presentation: preferences.find((item) => item.habit_id === view.habit.id) ?? {
            hidden: '',
            choiceDay: null,
            choice: '',
          },
        }))
        .filter((view) => view.presentation.hidden !== 'deleted'),
    });
    response.headers.set('Server-Timing', `habits;dur=${(performance.now() - started).toFixed(1)}`);
    return response;
  }
  const from = Number(url.searchParams.get('from')),
    to = Number(url.searchParams.get('to'));
  if (!url.searchParams.has('from') || !url.searchParams.has('to'))
    throw Error('INVALID_HABIT_HISTORY');
  if (url.pathname === '/api/habit-report')
    return json({ now, ...(await store.report(owner, from, to, url.searchParams.get('habitId'))) });
  return json({
    now,
    ...(await store.history(
      owner,
      from,
      to,
      url.searchParams.get('habitId'),
      url.searchParams.get('before'),
      Number(url.searchParams.get('limit') ?? 50),
      url.searchParams.get('status') ?? 'all',
    )),
  });
}
export async function handleHabits(
  { env, owner, now, healthy }: MiniAppContext,
  input: MiniAppInput,
): Promise<Response> {
  const { id, ...command } = input;
  const result = await new HabitService(new D1HabitStore(env.DB)).execute(owner, id, command, now);
  return json({
    ...result,
    ...(command.operation === 'log' ? { account: await healthy.read(owner) } : {}),
  });
}
