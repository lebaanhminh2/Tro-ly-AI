import { D1BeastStore } from '../../adapters/d1/linh-thu-store.ts';
import { query } from '../../adapters/d1/database.ts';
import { ScheduleStore } from '../../adapters/d1/schedule-store.ts';
import { BeastService, type BeastCommand } from '../../application/linh-thu-service.ts';
import { BeastRoleService, type BeastRoleCommand } from '../../application/linh-thu-roles.ts';
import { BeastSettlementService } from '../../application/linh-thu-settlement.ts';
import { BeastTowerService, type BeastTowerCommand } from '../../application/linh-thu-tower.ts';
import { beastTowerPublic } from '../../domain/linh-thu-tower.ts';
import { BEAST_CATALOG } from '../../domain/linh-thu-catalog.ts';
import { BEAST_SKILLS } from '../../domain/linh-thu-skills.ts';
import { BEAST_TRAINING } from '../../domain/linh-thu-training.ts';
import {
  BeastUltimateService,
  type BeastUltimateCommand,
} from '../../application/linh-thu-ultimates.ts';
import { beastCalendarWeek } from '../../domain/linh-thu-ultimates.ts';
import {
  settleOneCombinedBeastDay,
  settleOneExpiredBeastUltimate,
} from '../../adapters/d1/linh-thu-effects.ts';
import { chooseBeastDraw } from '../../adapters/d1/linh-thu-draw.ts';
import {
  BEAST_BASE_RATES,
  BEAST_EXCHANGE_COST,
  BEAST_SSR_GUARANTEE_RATES,
  BEAST_UR_GUARANTEE_RATES,
  LINH_THU_RULE_VERSION,
} from '../../domain/linh-thu.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

export async function readBeasts(
  { env, owner, now, healthy }: MiniAppContext,
  url: URL,
): Promise<Response> {
  const store = new D1BeastStore(env.DB);
  const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
  if (url.pathname === '/api/linh-thu/tower') {
    await new BeastTowerService(store, random).expire(owner, now);
    const eligibility = await store.towerEligibility(owner, now);
    const run = await store.tower(owner, eligibility.day);
    return json({
      eligibility,
      run: run
        ? { ...beastTowerPublic(run.state), version: run.version, expiresAt: run.expiresAt }
        : null,
      account: await store.read(owner),
      wallet: await healthy.read(owner),
    });
  }
  if (url.pathname === '/api/linh-thu/collection') {
    const limit = url.searchParams.get('limit');
    if (limit !== null && !/^\d+$/.test(limit)) throw Error('INVALID_BEAST_PAGE');
    return json(
      await store.collection(
        owner,
        url.searchParams.get('cursor'),
        limit === null ? 24 : Number(limit),
      ),
    );
  }
  if (url.pathname === '/api/linh-thu/receipt') {
    const id = url.searchParams.get('id');
    const operation = url.searchParams.get('operation');
    if (
      !id ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(id) ||
      ![
        'exchange',
        'summon',
        'choose_summon',
        'choose_draw',
        'craft',
        'select',
        'cancel',
        'reset',
        'ultimate',
        'choose_reward',
        'tower_start',
        'tower_pick',
        'tower_continue',
        'tower_claim',
      ].includes(operation ?? '')
    )
      throw Error('INVALID_BEAST_RECEIPT');
    // A receipt is owner-scoped and contains only committed result data.
    const receipt = await query(
      env.DB,
      'SELECT result_json FROM cultivation_receipts WHERE owner=? AND request_id=? AND operation=?',
      owner,
      id,
      'beast-' + operation,
    ).first<{ result_json: string }>();
    return receipt
      ? json({ id, operation, result: JSON.parse(receipt.result_json) })
      : json({ error: 'NOT_FOUND' }, 404);
  }
  const [initialAccount, initialWallet, day] = await Promise.all([
    store.read(owner),
    healthy.read(owner),
    new ScheduleStore(env.DB).ensureDay(owner, now),
  ]);
  let account = initialAccount;
  let wallet = initialWallet;
  if (day) {
    if (account.version === 0) await store.initialize(owner, day.day, now);
    // One mutating maintenance job per read. Stacking settlement + rendezvous
    // exceeded the Free-plan 50-query budget with an active companion.
    const settled = await new BeastSettlementService(store, random).settle(owner, now);
    if (!settled.processed && !(await settleOneCombinedBeastDay(env.DB, owner, now, random)))
      await settleOneExpiredBeastUltimate(env.DB, owner, now);
    [account, wallet] = await Promise.all([store.read(owner), healthy.read(owner)]);
  }
  const roles = day ? await store.roles(owner, day.day) : { current: [], pending: [] };
  const selected = await Promise.all(
    [...roles.current, ...roles.pending].map(async (selection) =>
      selection.beastId ? store.individual(owner, selection.beastId, selection.attemptId!) : null,
    ),
  );
  const recentSummons = (
    await query(
      env.DB,
      "SELECT request_id,result_json,created FROM cultivation_receipts WHERE owner=? AND operation IN('beast-summon','beast-choose_summon') AND json_array_length(json_extract(result_json,'$.beasts'))>0 ORDER BY created DESC LIMIT 5",
      owner,
    ).all<{ request_id: string; result_json: string; created: number }>()
  ).results.map((row) => ({
    id: row.request_id,
    createdAt: row.created,
    result: JSON.parse(row.result_json),
  }));
  const [speciesCounts, ultimate, choices, summonChoice, drawChoices] = await Promise.all([
    store.speciesCounts(owner),
    store.ultimate(owner, beastCalendarWeek(now)),
    store.pendingRewards(owner),
    store.summonChoice(owner),
    store.pendingDraws(owner),
  ]);
  return json({
    now,
    day: day ? { day: day.day, endAt: day.end_at } : null,
    account,
    wallet,
    speciesCounts,
    ultimate,
    choices,
    summonChoice,
    drawChoices,
    roles,
    selected: selected.filter((beast) => beast !== null),
    recentSummons,
    config: {
      version: LINH_THU_RULE_VERSION,
      catalog: BEAST_CATALOG,
      skills: BEAST_SKILLS,
      training: BEAST_TRAINING,
      exchangeCost: BEAST_EXCHANGE_COST,
      rates: BEAST_BASE_RATES,
      ssrGuarantee: BEAST_SSR_GUARANTEE_RATES,
      urGuarantee: BEAST_UR_GUARANTEE_RATES,
    },
  });
}

export async function handleBeasts(
  { env, owner, now, healthy }: MiniAppContext,
  input: MiniAppInput,
): Promise<Response> {
  const started = Date.now();
  if (
    Object.keys(input).some(
      (key) =>
        ![
          'id',
          'day',
          'operation',
          'version',
          'count',
          'role',
          'beastId',
          'runVersion',
          'card',
          'targets',
          'pact',
          'choiceId',
          'option',
          'picks',
        ].includes(key),
    ) ||
    !Number.isSafeInteger(input.day) ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 0 ||
    ![
      'exchange',
      'summon',
      'choose_summon',
      'choose_draw',
      'craft',
      'select',
      'cancel',
      'reset',
      'ultimate',
      'choose_reward',
      'tower_start',
      'tower_pick',
      'tower_continue',
      'tower_claim',
    ].includes(String(input.operation))
  )
    throw Error('INVALID_BEAST_COMMAND');
  const { id, ...fields } = input;
  const requestedDay = input.day;
  const command = fields as
    BeastCommand | BeastRoleCommand | BeastTowerCommand | BeastUltimateCommand;
  // Recover committed requests before requiring that the original day is open.
  const saved = await healthy.receipt<Record<string, unknown>>(
    owner,
    id,
    'beast-' + command.operation,
    command,
  );
  let result: Record<string, unknown>;
  if (saved) result = saved.result;
  else {
    const current = await new ScheduleStore(env.DB).ensureDay(owner, now);
    if (!current) throw Error('SETUP_REQUIRED');
    if (requestedDay !== current.day) throw Error('BEAST_DAY_CLOSED');
    const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
    const store = new D1BeastStore(env.DB);
    if (input.operation === 'choose_draw') {
      if (
        Object.keys(fields).some(
          (key) => !['operation', 'day', 'version', 'choiceId', 'picks'].includes(key),
        ) ||
        typeof input.choiceId !== 'string' ||
        input.choiceId.length > 150 ||
        !Array.isArray(input.picks)
      )
        throw Error('INVALID_BEAST_CHOICE');
      const effect = await chooseBeastDraw(
        env.DB,
        owner,
        input.choiceId,
        input.picks as number[],
        now,
        random,
        Number(input.version),
      );
      result = await healthy.mutate(owner, id, 'beast-choose_draw', fields, now, (state) => {
        if (state.suspended) throw Error('ACCOUNT_SUSPENDED');
        const commitAt = now + Math.max(0, Date.now() - started);
        if (commitAt >= current.end_at) throw Error('BEAST_DAY_CLOSED');
        return {
          state: effect.apply(state),
          result: effect.result,
          statements: [
            query(
              env.DB,
              'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND end_at>?) THEN 1 ELSE 0 END',
              owner,
              current.day,
              commitAt,
            ),
            ...effect.statements,
          ],
        };
      });
    } else
      result =
        input.operation === 'choose_reward'
          ? await new BeastUltimateService(store).chooseReward(
              owner,
              id,
              fields as unknown as Parameters<BeastUltimateService['chooseReward']>[2],
              current.day,
              now,
              current.end_at,
            )
          : command.operation === 'ultimate'
            ? await new BeastUltimateService(store).execute(
                owner,
                id,
                command as BeastUltimateCommand,
                current.day,
                now,
                current.end_at,
              )
            : command.operation.startsWith('tower_')
              ? await new BeastTowerService(store, random).execute(
                  owner,
                  id,
                  command as BeastTowerCommand,
                  current.day,
                  now,
                  current.end_at,
                )
              : ['select', 'cancel', 'reset'].includes(command.operation)
                ? await new BeastRoleService(store).execute(
                    owner,
                    id,
                    command as BeastRoleCommand,
                    current.day,
                    now,
                    current.end_at,
                  )
                : await new BeastService(store, random).execute(
                    owner,
                    id,
                    command as BeastCommand,
                    current.day,
                    now,
                    current.end_at,
                  );
  }
  const [account, wallet] = await Promise.all([
    new D1BeastStore(env.DB).read(owner),
    healthy.read(owner),
  ]);
  return json({ result, account, wallet });
}
