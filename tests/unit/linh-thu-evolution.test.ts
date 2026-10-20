import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import {
  BEAST_TRAINING,
  evolveBeast,
  newBeastAttempt,
  trainBeast,
  trainingView,
} from '../../src/domain/linh-thu-training.ts';
// @ts-expect-error Browser JavaScript is checked separately by tsconfig.web.json.
import { beastDiscovery, beastProgress } from '../../web/models/linh-thu.js';

test('all species evolve deliberately one form at a time and preserve overflow even after settlement completes', () => {
  for (const species of BEAST_CATALOG) {
    const rule = BEAST_TRAINING[species.rank];
    let attempt = {
      ...newBeastAttempt(species.id),
      status: 'completed' as const,
      earned: rule.capacity,
    };
    assert.equal(trainingView(attempt).perfect, false);
    for (let form = 2; form <= 4; form++) {
      const next = evolveBeast(attempt);
      assert.equal(next.form, form);
      assert.equal(next.earned, rule.capacity);
      attempt = { ...next, status: 'completed' };
    }
    assert.equal(trainingView(attempt).perfect, true);
    assert.throws(() => evolveBeast(attempt), /NOT_READY/);
  }
});

test('impurity consumes the final capacity and blocks T4 only above its exact boundary', () => {
  const make = (earned: number, gray: number) => ({
    ...newBeastAttempt('gibber'),
    form: 3 as const,
    status: 'training' as const,
    earned,
    gray,
  });
  const blocked = trainingView(make(320, 240));
  assert.deepEqual(
    [blocked.stageEarned, blocked.stageGray, blocked.stageCapacity, blocked.remaining],
    [70, 40, 150, 40],
  );
  assert.equal(blocked.blocked, true);
  assert.equal(trainingView(make(320, 200)).blocked, false);
  assert.equal(evolveBeast(make(400, 200)).form, 4);
  assert.throws(() => evolveBeast(make(360, 240)), /NOT_READY/);
  assert.throws(() => evolveBeast({ ...make(400, 0), status: 'sealed' }), /NOT_READY/);
  const trained = trainBeast(make(390, 0), ['achieved']);
  assert.equal(trained.attempt.form, 3);
  assert.equal(trainingView(trained.attempt).canEvolve, true);
});

test('frontend and domain agree on stages, impurity, manual evolution and quality for every rank', () => {
  const data = { config: { catalog: BEAST_CATALOG, training: BEAST_TRAINING } };
  for (const species of BEAST_CATALOG) {
    const rule = BEAST_TRAINING[species.rank];
    for (const form of [1, 2, 3, 4] as const) {
      for (const gray of [0, 1, rule.capacity / 20, rule.capacity / 2]) {
        for (const earned of [
          0,
          rule.thresholds[0],
          rule.thresholds[1],
          rule.thresholds[2],
          rule.capacity - gray,
        ]) {
          if (earned + gray > rule.capacity) continue;
          const attempt = {
            ...newBeastAttempt(species.id),
            form,
            earned,
            gray,
            status: 'training' as const,
          };
          const domain = trainingView(attempt),
            frontend = beastProgress(data, { speciesId: species.id, attempt });
          for (const key of [
            'form',
            'stageEarned',
            'stageGray',
            'stageCapacity',
            'canEvolve',
            'blocked',
            'completed',
            'awakened',
            'perfect',
          ] as const)
            assert.equal(frontend[key], domain[key], `${species.id} T${form}: ${key}`);
        }
      }
    }
  }
});

test('discovery is specific to each species and survives an individual reset without granting its powers', () => {
  const beast = { speciesId: 'gibber', attempt: newBeastAttempt('gibber') };
  const data = {
    config: { catalog: BEAST_CATALOG, training: BEAST_TRAINING },
    selected: [],
    discoveries: { gibber: { form: 3, awakened: false, perfect: false } },
  };
  assert.equal(beastDiscovery(data, beast).form, 3);
  assert.equal(beastProgress(data, beast).form, 1);
  assert.equal(
    beastDiscovery(data, { speciesId: 'pyropup', attempt: newBeastAttempt('pyropup') }).form,
    1,
  );
});

test('migration preserves actual old forms including gray-earned forms and archived attempts', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const files = readdirSync('migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const file of files.filter((file) => file < '0042'))
      db.exec(readFileSync('migrations/' + file, 'utf8'));
    db.exec(`INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated) VALUES('123','{}',1,1,1);
      INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES('123','beast_legacy','gibber','attempt_legacy',1,'receipt');
      INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,earned,gray,capacity,thresholds_json,created)
      VALUES('123','attempt_legacy','beast_legacy',1,1,'sealed',320,100,600,'[100,250,400]',1)`);
    db.exec(readFileSync('migrations/0042_linh_thu_evolution.sql', 'utf8'));
    assert.equal(db.prepare('SELECT form FROM beast_attempts').get()!.form, 4);
  } finally {
    db.close();
  }
});
