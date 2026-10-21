import test from 'node:test';
import assert from 'node:assert/strict';
const modelPath = '../../web/models/linh-thu.js';
const { beastProgress, beastTrainingProjection } = await import(modelPath);
import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import {
  BEAST_TRAINING,
  trainBeast,
  type BeastAttempt,
} from '../../src/domain/linh-thu-training.ts';
import type { HabitTrainingStatus } from '../../src/domain/linh-thu.ts';

const clientNow = 100000,
  serverNow = 200000;
function fixture(
  overrides: Partial<BeastAttempt> = {},
  outcomes: HabitTrainingStatus[] = ['achieved', 'missed'],
) {
  const beast = {
    id: 'beast_projection',
    attemptId: 'attempt_projection',
    speciesId: 'frostnip',
    attempt: {
      speciesId: 'frostnip',
      ruleVersion: 1,
      form: 3,
      status: 'training',
      earned: 716,
      gray: 0,
      ...overrides,
    } as BeastAttempt,
  };
  const response = {
    now: serverNow,
    receivedAt: clientNow,
    day: { day: 200, endAt: serverNow + 1000 },
    preview: {
      beastId: beast.id,
      attemptId: beast.attemptId,
      base: {
        earned: beast.attempt.earned,
        gray: beast.attempt.gray,
        form: beast.attempt.form ?? null,
        status: beast.attempt.status,
      },
      delta: trainBeast(beast.attempt, outcomes).delta,
    },
  };
  const data = {
    day: response.day,
    config: { catalog: BEAST_CATALOG, training: BEAST_TRAINING },
    selected: [beast],
    roles: {
      current: [{ role: 'training', beastId: beast.id, attemptId: beast.attemptId }],
      pending: [],
    },
    trainingPreview: response,
  };
  return { data, beast };
}

test('projections preserve committed points and eligibility while splitting the available stage', () => {
  const { data, beast } = fixture();
  const before = structuredClone(beast),
    progress = beastProgress(data, beast);
  assert.deepEqual(beastTrainingProjection(data, beast, clientNow), {
    delta: { earned: 6, gray: 6 },
    earned: 6,
    gray: 6,
    total: 12,
  });
  assert.deepEqual(beast, before);
  assert.deepEqual(beastProgress(data, beast), progress);
  const near = fixture({ earned: 792 }, ['achieved', 'achieved', 'achieved', 'achieved']);
  assert.deepEqual(beastTrainingProjection(near.data, near.beast, clientNow), {
    delta: { earned: 16, gray: 0 },
    earned: 8,
    gray: 0,
    total: 8,
  });
  assert.equal(beastProgress(near.data, near.beast).canEvolve, false);
  const ready = fixture({ earned: 800 });
  assert.equal(beastTrainingProjection(ready.data, ready.beast, clientNow)?.total, 0);
  assert.equal(beastProgress(ready.data, ready.beast).canEvolve, true);
});

test('final-day rounding matches trainBeast including the final impurity tenth', () => {
  for (let remaining = 1; remaining <= 16; remaining++) {
    for (let achieved = 0; achieved <= 4; achieved++) {
      const outcomes: HabitTrainingStatus[] = Array.from({ length: 4 }, (_, i) =>
        i < achieved ? 'achieved' : 'missed',
      );
      const { data, beast } = fixture({ form: 4, earned: 1200 - remaining }, outcomes);
      const projected = beastTrainingProjection(data, beast, clientNow)!;
      assert.equal(projected.delta.earned + projected.delta.gray, remaining);
      assert.equal(projected.total, remaining);
      if (achieved < 4) assert.ok(projected.gray >= 1);
    }
  }
});

test('neutral days are zero contributions; past gray stays fixed and bounds stage space', () => {
  const empty = fixture({}, ['neutral']);
  assert.deepEqual(beastTrainingProjection(empty.data, empty.beast, clientNow), {
    delta: { earned: 0, gray: 0 },
    earned: 0,
    gray: 0,
    total: 0,
  });
  const impure = fixture({ form: 4, earned: 1000, gray: 190 }, ['achieved', 'missed']);
  const before = beastProgress(impure.data, impure.beast);
  const projection = beastTrainingProjection(impure.data, impure.beast, clientNow)!;
  assert.equal(projection.total, 10);
  assert.equal(beastProgress(impure.data, impure.beast).stageGray, before.stageGray);
  assert.equal(impure.beast.attempt.gray, 190);
});

test('stale dates, changed attempts, invalid deltas and pending replacements are rejected', () => {
  for (const modify of [
    (x: ReturnType<typeof fixture>) => {
      x.data.trainingPreview.day = { day: 199, endAt: serverNow + 1000 };
    },
    (x: ReturnType<typeof fixture>) => {
      x.data.trainingPreview.preview.attemptId = 'other_attempt';
    },
    (x: ReturnType<typeof fixture>) => {
      x.data.trainingPreview.preview.beastId = 'other_beast';
    },
    (x: ReturnType<typeof fixture>) => {
      x.beast.attempt.earned++;
    },
    (x: ReturnType<typeof fixture>) => {
      x.beast.attempt.gray++;
    },
    (x: ReturnType<typeof fixture>) => {
      x.beast.attempt.form = 4;
    },
    (x: ReturnType<typeof fixture>) => {
      x.beast.attempt.status = 'sealed';
    },
    (x: ReturnType<typeof fixture>) => {
      x.data.roles.current[0]!.attemptId = 'other_attempt';
    },
    (x: ReturnType<typeof fixture>) => {
      x.data.trainingPreview.preview.delta.earned = -1;
    },
    (x: ReturnType<typeof fixture>) => {
      x.data.trainingPreview.preview.delta.gray = 0.5;
    },
    (x: ReturnType<typeof fixture>) => {
      x.data.trainingPreview.preview.delta.earned = 1201;
    },
  ]) {
    const x = fixture();
    modify(x);
    assert.equal(beastTrainingProjection(x.data, x.beast, clientNow), null);
  }
  const { data, beast } = fixture();
  assert.equal(beastTrainingProjection(data, beast, clientNow + 1000), null);
  assert.ok(beastTrainingProjection(data, beast, clientNow + 999));
});
