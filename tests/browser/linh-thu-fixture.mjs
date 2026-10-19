import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import { BEAST_SKILLS } from '../../src/domain/linh-thu-skills.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { initialBeastAccount } from '../../src/domain/linh-thu-account.ts';
import { fixture, serve, chrome, browserBin, now, clone } from './app-harness.mjs';

export function beastFixture() {
  const control = fixture(),
    day = control.habits.day.day;
  const beast = {
    id: 'beast_frost_fixture',
    speciesId: 'frostnip',
    attemptId: 'attempt_fixture',
    acquiredAt: now,
    attempt: { speciesId: 'frostnip', ruleVersion: 1, status: 'training', earned: 500, gray: 100 },
    counters: {},
  };
  const data = {
    now,
    day: { day, endAt: control.habits.day.endAt },
    account: { version: 1, state: { ...initialBeastAccount(), summonTickets: 11 } },
    wallet: control.state.account,
    roles: {
      current: [
        { role: 'training', day, beastId: beast.id, attemptId: beast.attemptId },
        { role: 'companion', day, beastId: beast.id, attemptId: beast.attemptId },
      ],
      pending: [],
    },
    selected: [beast],
    speciesCounts: { frostnip: 1 },
    choices: [],
    ultimate: null,
    summonChoice: null,
    recentSummons: [],
    config: { catalog: BEAST_CATALOG, skills: BEAST_SKILLS, training: BEAST_TRAINING },
  };
  control.beastData = data;
  control.beastApi = async (request, endpoint) => {
    if (request.method === 'GET') {
      if (endpoint === 'linh-thu/collection')
        return { body: { beasts: [beast], nextCursor: null } };
      if (endpoint === 'linh-thu/tower')
        return {
          body: {
            eligibility: { day, eligible: true },
            run: control.towerRun ?? null,
            account: data.account,
            wallet: data.wallet,
          },
        };
      if (endpoint === 'linh-thu/receipt') {
        const id = new URL(request.url, 'http://localhost').searchParams.get('id');
        return control.receipts.has(id)
          ? { body: { result: control.receipts.get(id).result } }
          : { status: 404, body: { error: 'NOT_FOUND' } };
      }
      return { body: data };
    }
    let raw = '';
    for await (const part of request) raw += part;
    const input = JSON.parse(raw);
    control.posts.push({ path: endpoint, input: clone(input) });
    if (control.receipts.has(input.id)) return { body: control.receipts.get(input.id) };
    if (input.version !== data.account.version)
      return {
        status: 409,
        body: {
          error: 'BEAST_CHANGED',
          message: 'Linh thú vừa thay đổi. Đã tải lại dữ liệu; cậu kiểm tra rồi thử lại nhé.',
        },
      };
    let result;
    if (input.operation === 'summon') {
      data.account.state.summonTickets -= input.count;
      result = {
        count: input.count,
        beasts: Array.from({ length: input.count }, (_, i) => ({
          id: 'new_' + i,
          speciesId: i === 0 ? 'pyropup' : 'frostnip',
        })),
      };
      data.recentSummons = [{ id: input.id, result }];
    } else if (input.operation === 'craft') {
      data.account.state.alchemy.days = 0;
      data.account.state.alchemy.failures = 0;
      data.account.state.alchemy.inventory++;
      result = { success: true };
    } else if (input.operation === 'tower_start') {
      control.towerRun = {
        status: 'choosing',
        floor: 1,
        cards: 4,
        cleared: 0,
        version: 1,
        atRisk: { tickets: 0, summonTickets: 0 },
      };
      result = { tower: control.towerRun };
    } else if (input.operation === 'tower_pick') {
      control.towerRun = {
        ...control.towerRun,
        status: 'decision',
        cleared: 1,
        version: 2,
        atRisk: { tickets: 2, summonTickets: 0 },
        nextReward: { tickets: 3, summonTickets: 0 },
      };
      result = { tower: control.towerRun };
    } else if (input.operation === 'tower_claim') {
      control.towerRun = { ...control.towerRun, status: 'claimed', version: 3 };
      result = { tower: control.towerRun };
    } else result = {};
    data.account.version++;
    const response = { result, account: data.account, wallet: data.wallet };
    control.receipts.set(input.id, clone(response));
    return { body: response };
  };
  return control;
}
