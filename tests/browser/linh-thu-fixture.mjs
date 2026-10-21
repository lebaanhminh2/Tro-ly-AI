import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import { BEAST_SKILLS } from '../../src/domain/linh-thu-skills.ts';
import { BEAST_TRAINING } from '../../src/domain/linh-thu-training.ts';
import { initialBeastAccount } from '../../src/domain/linh-thu-account.ts';
import {
  beginBeastTower,
  beastTowerPublic,
  claimBeastTower,
  continueBeastTower,
  pickBeastTower,
} from '../../src/domain/linh-thu-tower.ts';
import { evolveBeast, trainingView } from '../../src/domain/linh-thu-training.ts';
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
  control.ownedBeasts = [beast];
  control.collectionRequests = [];
  control.collectionOverview = () =>
    Object.fromEntries(
      BEAST_CATALOG.flatMap((species) => {
        const owned = control.ownedBeasts.filter((entry) => entry.speciesId === species.id);
        owned.sort((a, b) => {
          const av = trainingView(a.attempt),
            bv = trainingView(b.attempt);
          return (
            bv.form - av.form ||
            Number(bv.perfect) - Number(av.perfect) ||
            (bv.ratio ?? 0) - (av.ratio ?? 0)
          );
        });
        return owned.length ? [[species.id, { count: owned.length, best: owned[0] }]] : [];
      }),
    );
  // Test-only oracle: runtime receives public state, never the hidden trap.
  control.setTowerState = (state, version = 1) => {
    control.towerState = state;
    control.towerRun = { ...beastTowerPublic(state), version, expiresAt: data.day.endAt };
  };
  control.beastApi = async (request, endpoint) => {
    if (request.method === 'GET') {
      if (endpoint === 'linh-thu/collection') {
        const params = new URL(request.url, 'http://localhost').searchParams;
        const species = params.get('species'),
          start = Number(params.get('cursor') ?? 0),
          limit = Number(params.get('limit') ?? 24);
        const owned = control.ownedBeasts.filter(
          (beast) => !species || beast.speciesId === species,
        );
        const body = {
          beasts: owned.slice(start, start + limit),
          nextCursor: start + limit < owned.length ? String(start + limit) : null,
        };
        control.collectionRequests.push({
          species,
          start,
          bytes: Buffer.byteLength(JSON.stringify(body)),
        });
        return { body };
      }
      if (endpoint === 'linh-thu/tower')
        return {
          body: {
            eligibility: {
              day,
              eligible: true,
              achieved: 1,
              missed: 0,
              taskId: 'task-0',
              rescueAvailable: !!control.towerRescueAvailable,
            },
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
      return { body: { ...data, collectionOverview: control.collectionOverview() } };
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
    if (input.operation === 'select') {
      const selected = [...control.ownedBeasts, ...data.selected].find(
        (entry) => entry.id === input.beastId,
      );
      if (!selected) return { status: 404, body: { error: 'NOT_FOUND' } };
      const same = data.roles.current.some(
        (role) =>
          role.role === input.role &&
          role.beastId === selected.id &&
          role.attemptId === selected.attemptId,
      );
      data.roles.pending = data.roles.pending.filter((role) => role.role !== input.role);
      if (!same) {
        data.roles.pending.push({
          role: input.role,
          day: data.day.day + 1,
          beastId: selected.id,
          attemptId: selected.attemptId,
        });
        if (
          !data.selected.some(
            (entry) => entry.id === selected.id && entry.attemptId === selected.attemptId,
          )
        )
          data.selected.push(selected);
      }
      result = {
        scheduled: !same,
        role: input.role,
        beastId: selected.id,
        effectiveDay: data.day.day + 1,
      };
    } else if (input.operation === 'cancel') {
      data.roles.pending = data.roles.pending.filter((role) => role.role !== input.role);
      result = { cancelled: true };
    } else if (input.operation === 'evolve') {
      const beast = control.ownedBeasts.find((entry) => entry.id === input.beastId);
      if (!beast) return { status: 404, body: { error: 'BEAST_NOT_FOUND' } };
      const from = beast.attempt.form;
      try {
        beast.attempt = evolveBeast(beast.attempt);
      } catch (error) {
        return { status: 409, body: { error: error.message } };
      }
      data.discoveries ??= {};
      data.discoveries[beast.speciesId] = { form: beast.attempt.form };
      result = {
        evolved: true,
        beastId: beast.id,
        attemptId: beast.attemptId,
        from,
        form: beast.attempt.form,
        attempt: beast.attempt,
      };
    } else if (input.operation === 'summon') {
      data.account.state.summonTickets -= input.count;
      result = {
        count: input.count,
        beasts: Array.from({ length: input.count }, (_, i) => ({
          id: 'new_' + i,
          speciesId:
            control.summonSpecies?.[i % control.summonSpecies.length] ??
            (i === 0 ? 'pyropup' : 'frostnip'),
        })),
      };
      data.recentSummons = [{ id: input.id, result }];
    } else if (input.operation === 'craft') {
      data.account.state.alchemy.days = 0;
      data.account.state.alchemy.failures = 0;
      data.account.state.alchemy.inventory++;
      result = { success: true };
    } else if (input.operation.startsWith('tower_')) {
      const random = control.towerRandom ?? (() => 0);
      try {
        if (input.operation === 'tower_start') {
          if (control.towerRun) throw Error('TOWER_ALREADY_PLAYED');
          control.setTowerState(beginBeastTower(day, !!control.towerRescueAvailable, random));
        } else {
          if (!control.towerState) throw Error('TOWER_NOT_STARTED');
          if (input.runVersion !== control.towerRun.version) throw Error('TOWER_CHANGED');
          let state;
          if (input.operation === 'tower_pick')
            state = pickBeastTower(control.towerState, input.card, random);
          else if (input.operation === 'tower_continue')
            state = continueBeastTower(control.towerState, random);
          else if (input.operation === 'tower_claim') {
            const claimed = claimBeastTower(control.towerState);
            state = claimed.state;
            result = { reward: claimed.reward };
            data.wallet.state.tickets += claimed.reward.tickets;
            data.wallet.version++;
            data.account.state.summonTickets += claimed.reward.summonTickets;
          } else throw Error('INVALID_TOWER_COMMAND');
          control.setTowerState(state, control.towerRun.version + 1);
        }
        result = {
          ...result,
          tower: beastTowerPublic(control.towerState),
          runVersion: control.towerRun.version,
        };
      } catch (error) {
        return { status: 409, body: { error: error.message } };
      }
    } else result = {};
    data.account.version++;
    const response = { result, account: data.account, wallet: data.wallet };
    control.receipts.set(input.id, clone(response));
    return { body: response };
  };
  return control;
}
