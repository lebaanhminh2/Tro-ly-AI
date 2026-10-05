import { query } from '../../adapters/d1/database.ts';
import { ScheduleStore } from '../../adapters/d1/schedule-store.ts';
import { breakthrough, CHARMS, drawReward, fuseCharm, operatingDay, useProtection, type Charm } from '../../domain/healthy.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';
export async function handleCultivation({ env, owner, now, healthy }: MiniAppContext, input: MiniAppInput): Promise<Response> {
    if (Object.keys(input).some(k => !['id', 'operation', 'item'].includes(k)))
        return json({ error: 'INVALID_REQUEST' }, 400);
    const operation = input.operation;
    if (!['draw', 'fuse', 'protect', 'breakthrough', 'checkin'].includes(String(operation)))
        return json({ error: 'INVALID_OPERATION' }, 400);
    if (operation === 'checkin') {
        if (input.item !== undefined)
            return json({ error: 'INVALID_REQUEST' }, 400);
        // Opening/claiming in the app never resumes a suspended chat or reminders.
        const result = await healthy.checkIn(owner, input.id, input, now);
        return json({ result, account: await healthy.read(owner) });
    }
    const settings = await query(env.DB, 'SELECT start_minutes,sleep_minutes FROM schedule_settings WHERE owner=?', owner).first<{
        start_minutes: number;
        sleep_minutes: number | null;
    }>();
    if (!settings || settings.sleep_minutes === null)
        return json({ error: 'SETUP_REQUIRED' }, 409);
    const activeDay = await new ScheduleStore(env.DB).ensureDay(owner, now);
    const day = activeDay?.day ?? operatingDay(now, settings.start_minutes), random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
    const item = input.item;
    if (operation === 'protect' && !['heart', 'peace'].includes(String(item)))
        return json({ error: 'INVALID_ITEM' }, 400);
    if (operation === 'fuse' && (!Object.hasOwn(CHARMS, String(item)) || item === 'supreme'))
        return json({ error: 'INVALID_ITEM' }, 400);
    if (operation === 'breakthrough' && item !== undefined && item !== null && !Object.hasOwn(CHARMS, String(item)))
        return json({ error: 'INVALID_ITEM' }, 400);
    const result = await healthy.mutate<Record<string, unknown>>(owner, input.id, String(operation), input, now, state => {
        if (state.suspended)
            throw Error('ACCOUNT_SUSPENDED');
        if (operation === 'draw' && state.tickets < 1)
            throw Error('NO_TICKETS');
        if (operation === 'draw') {
            const r = drawReward(state, random());
            return { state: r.state, result: { reward: r.reward } };
        }
        if (operation === 'fuse') {
            const r = fuseCharm(state, item as Charm, random());
            return { state: r.state, result: { success: r.success } };
        }
        if (operation === 'protect')
            return { state: useProtection(state, item as 'heart' | 'peace', day), result: { protected: true } };
        const r = breakthrough(state, day, now, item as Charm | null ?? null, random());
        return { state: r.state, result: { success: r.success, chance: r.chance, penalty: r.penalty } };
    });
    return json({ result, account: await healthy.read(owner) });
}
