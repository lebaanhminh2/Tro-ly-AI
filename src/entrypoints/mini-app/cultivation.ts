import { query } from '../../adapters/d1/database.ts';
import { ScheduleStore } from '../../adapters/d1/schedule-store.ts';
import { prepareBeastEffect } from '../../adapters/d1/linh-thu-effects.ts';
import { prepareCultivationDraw } from '../../adapters/d1/linh-thu-draw.ts';
import { readBeastV2Context } from '../../adapters/d1/linh-thu-v2-context.ts';
import { prepareBeastV2Effect } from '../../adapters/d1/linh-thu-v2-effects.ts';
import { beastV2BreakthroughModifier } from '../../domain/linh-thu-v2.ts';
import type { MiniAppTiming } from '../../adapters/observability.ts';
import {
  breakthrough,
  CHARMS,
  drawRewards,
  fuseCharm,
  operatingDay,
  useProtection,
  type Charm,
} from '../../domain/healthy.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';
export async function handleCultivation(
  { env, owner, now, healthy }: MiniAppContext,
  input: MiniAppInput,
  timing?: MiniAppTiming,
): Promise<Response> {
  if (Object.keys(input).some((k) => !['id', 'operation', 'item', 'count'].includes(k)))
    return json({ error: 'INVALID_REQUEST' }, 400);
  const operation = input.operation;
  if (!['draw', 'fuse', 'protect', 'breakthrough', 'checkin'].includes(String(operation)))
    return json({ error: 'INVALID_OPERATION' }, 400);
  if (
    (operation !== 'draw' && input.count !== undefined) ||
    (operation === 'draw' && input.item !== undefined)
  )
    return json({ error: 'INVALID_REQUEST' }, 400);
  const count = input.count === undefined ? 1 : input.count;
  if (operation === 'draw' && count !== 1 && count !== 10)
    return json({ error: 'INVALID_DRAW_COUNT' }, 400);
  if (operation === 'draw') {
    const measure = <T>(phase: 'draw_context' | 'draw_prepare', run: () => Promise<T>) =>
      timing ? timing.measure(phase, run) : run();
    const response = await healthy.mutateWithAccount<Record<string, unknown>>(
      owner,
      input.id,
      'draw',
      input,
      now,
      async (state) => {
        const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
        let beastDraw = await measure('draw_prepare', () =>
          prepareCultivationDraw(env.DB, owner, input.id, undefined, now, count as 1 | 10, random),
        );
        if (beastDraw.day === null) {
          const day = await measure('draw_context', async () => {
            const activeDay = await new ScheduleStore(env.DB).ensureDay(owner, now);
            return activeDay?.day ?? operatingDay(now, beastDraw.startMinutes);
          });
          beastDraw = await measure('draw_prepare', () =>
            prepareCultivationDraw(env.DB, owner, input.id, day, now, count as 1 | 10, random),
          );
        }
        if (state.suspended) throw Error('ACCOUNT_SUSPENDED');
        if (state.tickets < Number(count)) throw Error('NO_TICKETS');
        if (beastDraw.apply) return beastDraw.apply(state);
        const result = drawRewards(state, count as 1 | 10, random);
        return {
          state: result.state,
          result: {
            count,
            rewards: result.rewards,
            ...(count === 1 ? { reward: result.rewards[0] } : {}),
          },
        };
      },
      timing,
    );
    return json(response);
  }
  // Recover committed fusion/breakthrough results before checking settings/day.
  if (['fuse', 'breakthrough'].includes(String(operation))) {
    const saved = await healthy.receipt<Record<string, unknown>>(
      owner,
      input.id,
      String(operation),
      input,
    );
    if (saved) return json({ result: saved.result, account: await healthy.read(owner) });
  }
  if (operation === 'checkin') {
    if (input.item !== undefined) return json({ error: 'INVALID_REQUEST' }, 400);
    // Opening/claiming in the app never resumes a suspended chat or reminders.
    const result = await healthy.checkIn(owner, input.id, input, now);
    return json({ result, account: await healthy.read(owner) });
  }
  const settings = await query(
    env.DB,
    'SELECT start_minutes,sleep_minutes FROM schedule_settings WHERE owner=?',
    owner,
  ).first<{
    start_minutes: number;
    sleep_minutes: number | null;
  }>();
  if (!settings || settings.sleep_minutes === null) return json({ error: 'SETUP_REQUIRED' }, 409);
  const activeDay = await new ScheduleStore(env.DB).ensureDay(owner, now);
  const day = activeDay?.day ?? operatingDay(now, settings.start_minutes),
    random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
  const item = input.item;
  if (operation === 'protect' && !['heart', 'peace'].includes(String(item)))
    return json({ error: 'INVALID_ITEM' }, 400);
  if (operation === 'fuse' && (!Object.hasOwn(CHARMS, String(item)) || item === 'supreme'))
    return json({ error: 'INVALID_ITEM' }, 400);
  if (
    operation === 'breakthrough' &&
    item !== undefined &&
    item !== null &&
    !Object.hasOwn(CHARMS, String(item))
  )
    return json({ error: 'INVALID_ITEM' }, 400);
  const before =
    operation === 'fuse' || operation === 'breakthrough' ? await healthy.read(owner) : null;
  // Use one immutable skill snapshot both before the roll and for the outcome
  // writes. A competing change must reject this transaction via its guard.
  const v2 = before ? await readBeastV2Context(env.DB, owner, day, now) : null;
  const modifier = v2?.active
    ? {
        ...(v2.beast
          ? beastV2BreakthroughModifier(v2.beast.skills, v2.beast.state)
          : { chancePoints: 0, preventLoss: false }),
        penaltyMultiplier: v2.snapshot.multiplier,
      }
    : undefined;
  const prepared = before
    ? operation === 'fuse'
      ? fuseCharm(before.state, item as Charm, random())
      : breakthrough(before.state, day, now, (item as Charm | null) ?? null, random(), modifier)
    : null;
  const effect = prepared
    ? v2?.active
      ? await prepareBeastV2Effect(
          env.DB,
          owner,
          operation === 'fuse'
            ? {
                kind: 'fusion',
                day,
                from: item as 'basic' | 'middle' | 'high',
                success: prepared.success,
              }
            : {
                kind: 'breakthrough',
                day,
                success: prepared.success,
                lostQi: before!.state.qi - prepared.state.qi,
              },
          input.id,
          now,
          random,
          { context: v2 },
        )
      : await prepareBeastEffect(
          env.DB,
          owner,
          {
            kind: operation === 'fuse' ? 'fusion' : 'breakthrough',
            sourceId: input.id,
            day,
            at: now,
            qualified: operation === 'breakthrough' && !prepared.success,
            success: prepared.success,
            actualQiLoss: operation === 'breakthrough' ? before!.state.qi - prepared.state.qi : 0,
            ...(operation === 'fuse' ? { fusionTier: String(item) } : {}),
          },
          now,
          random,
        )
    : null;
  const result = await healthy.mutate<Record<string, unknown>>(
    owner,
    input.id,
    String(operation),
    input,
    now,
    (state) => {
      if (state.suspended) throw Error('ACCOUNT_SUSPENDED');
      if (operation === 'fuse') {
        const r = prepared!;
        return {
          state: effect ? effect.apply(r.state) : r.state,
          result: { success: r.success, ...(effect ? { beastEffect: effect.result } : {}) },
          statements: [
            query(
              env.DB,
              'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM cultivation_accounts WHERE owner=?)=? THEN 1 ELSE 0 END',
              owner,
              before!.version + 1,
            ),
            ...(effect?.statements ?? []),
          ],
        };
      }
      if (operation === 'protect')
        return {
          state: useProtection(state, item as 'heart' | 'peace', day),
          result: { protected: true },
        };
      const r = prepared as ReturnType<typeof breakthrough>;
      return {
        state: effect ? effect.apply(r.state) : r.state,
        result: {
          success: r.success,
          chance: r.chance,
          penalty: r.penalty,
          ...(effect ? { beastEffect: effect.result } : {}),
        },
        statements: [
          query(
            env.DB,
            'INSERT INTO transaction_guard SELECT CASE WHEN (SELECT version FROM cultivation_accounts WHERE owner=?)=? THEN 1 ELSE 0 END',
            owner,
            before!.version + 1,
          ),
          ...(effect?.statements ?? []),
        ],
      };
    },
  );
  return json({ result, account: await healthy.read(owner) });
}
