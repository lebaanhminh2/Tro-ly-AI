import test from 'node:test';
import assert from 'node:assert/strict';
import { firstStepCommand, firstStepReward } from '../../src/domain/first-step.ts';
import { initialHealthy } from '../../src/domain/healthy.ts';

test('first-step accepts only server-owned timing/rewards and known occurrence commands', () => {
  for (const operation of ['start', 'claim', 'cancel', 'outside']) {
    assert.deepEqual(firstStepCommand({ operation, occurrenceId: 'occurrence_01' }), {
      operation,
      occurrenceId: 'occurrence_01',
    });
  }
  for (const extra of [
    'owner',
    'startedAt',
    'endsAt',
    'reward',
    'qi',
    'tickets',
    'source',
    'status',
  ])
    assert.throws(
      () => firstStepCommand({ operation: 'claim', occurrenceId: 'occurrence_01', [extra]: 1 }),
      /INVALID_FIRST_STEP_OPERATION/,
    );
  for (const value of ['', 'short', '../unsafe/path', 'x'.repeat(101), 123, null])
    assert.throws(
      () => firstStepCommand({ operation: 'start', occurrenceId: value }),
      /INVALID_FIRST_STEP_ID/,
    );
  for (const operation of [
    'fast',
    'reset',
    'preview',
    'reward',
    null,
    ['start'],
    ['outside'],
    {},
    1,
  ])
    assert.throws(
      () => firstStepCommand({ operation, occurrenceId: 'occurrence_01' }),
      /INVALID_FIRST_STEP_OPERATION/,
    );
});

test('first-step fixed reward changes only qi, lifetime earned and regular tickets', () => {
  const state = { ...initialHealthy(), qi: 12, earned: 41, tickets: 7, streak: 8, rank: 3 };
  assert.deepEqual(firstStepReward(state), { ...state, qi: 13, earned: 42, tickets: 8 });
  assert.equal(state.qi, 12);
  assert.throws(() => firstStepReward({ ...state, suspended: true }), /ACCOUNT_SUSPENDED/);
  assert.throws(
    () => firstStepReward({ ...state, tickets: Number.MAX_SAFE_INTEGER }),
    /INVALID_FIRST_STEP_BALANCE/,
  );
});

test('first-step client time stays anchored to server/monotonic time and pending intents are owner-bound', async () => {
  const clientPath = '../../web/models/first-step.js';
  const { firstStepClock, readFirstStepIntent } = await import(clientPath);
  let ticks = 100;
  const clock = firstStepClock(() => ticks);
  assert.equal(clock.now(), null);
  clock.sync(1000000);
  ticks += 30000;
  assert.equal(clock.now(), 1030000);
  clock.sync(900000);
  ticks += 5000;
  assert.equal(clock.now(), 905000);
  assert.throws(() => clock.sync(NaN), /INVALID_SERVER_TIME/);
  const intent = {
    owner: '123',
    operation: 'claim',
    occurrenceId: 'occurrence_123',
    requestId: 'request_123',
  };
  assert.deepEqual(readFirstStepIntent(intent, '123'), intent);
  assert.equal(readFirstStepIntent(intent, '456'), null);
  assert.equal(readFirstStepIntent({ ...intent, operation: 'preview' }, '123'), null);
  assert.equal(readFirstStepIntent({ ...intent, requestId: '../invalid' }, '123'), null);
  assert.equal(readFirstStepIntent({ ...intent, requestId: ['request_123'] }, '123'), null);
  assert.equal(readFirstStepIntent({ ...intent, occurrenceId: ['occurrence_123'] }, '123'), null);
});
