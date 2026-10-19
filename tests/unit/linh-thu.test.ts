import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  BEAST_CATALOG,
  beastReferencePath,
  beastSpecies,
  rollPyroCandidates,
} from '../../src/domain/linh-thu-catalog.ts';
import {
  advanceSummonPity,
  beastPurity,
  habitTrainingPoints,
  rollSummonRank,
  summonRankTable,
  talentChance,
  TOWER_CARD_COUNTS,
  towerReward,
} from '../../src/domain/linh-thu.ts';

test('catalog matches all 18 approved species, exact ranks, evolution order and 72 reference images', () => {
  const catalog = JSON.parse(
    readFileSync('docs/assets/linh-thu/reference/REFERENCE_CATALOG.json', 'utf8'),
  );
  assert.equal(BEAST_CATALOG.length, 18);
  assert.equal(new Set(BEAST_CATALOG.map((entry) => entry.id)).size, 18);
  assert.deepEqual(
    ['R', 'SR', 'SSR', 'UR'].map(
      (rank) => BEAST_CATALOG.filter((entry) => entry.rank === rank).length,
    ),
    [6, 6, 4, 2],
  );
  for (const entry of BEAST_CATALOG) {
    const reference = catalog.selection.find(
      (row: { forms: { name: string }[] }) => row.forms[0]!.name.toLowerCase() === entry.id,
    );
    assert.ok(reference, entry.id);
    assert.equal(entry.rank, reference.project_rank);
    assert.deepEqual(
      entry.forms,
      reference.forms.map((form: { name: string }) => form.name),
    );
    for (const form of [1, 2, 3, 4] as const)
      assert.ok(existsSync(beastReferencePath(entry.id, form)), entry.id + ':' + form);
  }
  assert.deepEqual(beastSpecies('punchimp').forms.slice(2), ['Rockwu', 'Rockong']);
  assert.equal(beastSpecies('flameow').forms[3], 'Cinderclaw');
  assert.throws(() => beastSpecies('unknown'));
});

test('daily training excludes neutral and preserves the full attainable budget in earned + gray', () => {
  assert.deepEqual(habitTrainingPoints([]), { earned: 0, gray: 0 });
  assert.deepEqual(habitTrainingPoints(['neutral']), { earned: 0, gray: 0 });
  assert.deepEqual(habitTrainingPoints(['missed']), { earned: 0, gray: 10 });
  assert.deepEqual(habitTrainingPoints(['achieved', 'achieved']), { earned: 12, gray: 0 });
  assert.deepEqual(habitTrainingPoints(['achieved', 'achieved', 'achieved', 'missed']), {
    earned: 12,
    gray: 4,
  });
  assert.deepEqual(habitTrainingPoints(['achieved', 'missed', 'missed']), { earned: 5, gray: 9 });
  for (let count = 1; count <= 30; count++) {
    for (let completed = 0; completed <= count; completed++) {
      const points = habitTrainingPoints([
        ...Array(completed).fill('achieved'),
        ...Array(count - completed).fill('missed'),
        'neutral',
      ]);
      assert.equal(points.earned + points.gray, 10 + Math.min(count - 1, 3) * 2);
      assert.ok(Number.isInteger(points.earned) && points.earned >= 0 && points.gray >= 0);
    }
  }
});

test('purity unlocks require completed capacity and exact 95/100 thresholds', () => {
  assert.deepEqual(beastPurity({ earned: 0, gray: 0 }, 1200), {
    completed: false,
    ratio: null,
    awakened: false,
    perfect: false,
  });
  assert.equal(beastPurity({ earned: 100, gray: 0 }, 1200).perfect, false);
  assert.equal(beastPurity({ earned: 1139, gray: 61 }, 1200).awakened, false);
  assert.equal(beastPurity({ earned: 1140, gray: 60 }, 1200).awakened, true);
  assert.equal(beastPurity({ earned: 2499, gray: 1 }, 2500).perfect, false);
  assert.equal(beastPurity({ earned: 1200, gray: 0 }, 1200).perfect, true);
  assert.throws(() => beastPurity({ earned: 1201, gray: 0 }, 1200));
});

test('talent progression changes chances while leaving reward amounts whole', () => {
  assert.deepEqual(
    ([1, 2, 3, 4] as const).map((form) => talentChance(0.4, form, 1)),
    [0.1, 0.2, 0.30000000000000004, 0.4],
  );
  assert.deepEqual(
    ([1, 2, 3, 4] as const).map((form) => talentChance(1, form, 2)),
    [0, 0, 0.5, 1],
  );
});

test('rank probabilities have exact boundaries, SSR pity resets separately, UR takes priority', () => {
  const pity = { ssr: 0, ur: 0 };
  for (const [value, rank] of [
    [0, 'R'],
    [0.699999, 'R'],
    [0.7, 'SR'],
    [0.95, 'SSR'],
    [0.995, 'UR'],
    [0.99999, 'UR'],
  ] as const)
    assert.equal(
      rollSummonRank(pity, () => value),
      rank,
    );
  assert.deepEqual(advanceSummonPity({ ssr: 12, ur: 60 }, 'SSR'), { ssr: 0, ur: 61 });
  assert.deepEqual(advanceSummonPity({ ssr: 12, ur: 60 }, 'UR'), pity);
  assert.deepEqual(summonRankTable({ ssr: 19, ur: 79 }), { R: 0, SR: 0, SSR: 0, UR: 1 });
  assert.equal(
    rollSummonRank({ ssr: 19, ur: 40 }, () => 0.89999),
    'SSR',
  );
  assert.equal(
    rollSummonRank({ ssr: 19, ur: 40 }, () => 0.9),
    'UR',
  );
  assert.throws(() => advanceSummonPity({ ssr: 19, ur: 79 }, 'SSR'));
  for (const value of [NaN, Infinity, -0.1, 1])
    assert.throws(() => rollSummonRank(pity, () => value));
});

test('ten draws update pity sequentially; Pyro candidates share the prior table and avoid species repeats when possible', () => {
  let pity = { ssr: 17, ur: 77 };
  const ranks: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rank = rollSummonRank(pity, () => 0);
    ranks.push(rank);
    pity = advanceSummonPity(pity, rank);
  }
  assert.deepEqual(ranks.slice(0, 3), ['R', 'R', 'UR']);
  assert.deepEqual(pity, { ssr: 7, ur: 7 });
  const before = { ssr: 19, ur: 79 };
  const candidates = rollPyroCandidates(before, () => 0);
  assert.deepEqual(
    candidates.map((entry) => entry.id),
    ['pyropup', 'rubblet', 'pyropup'],
  );
  assert.ok(candidates.every((entry) => entry.rank === 'UR'));
  assert.deepEqual(before, { ssr: 19, ur: 79 });
});

test('tower has one trap per 4/4/3/2 cards and terminal rewards replace previous floors', () => {
  assert.deepEqual(TOWER_CARD_COUNTS, [4, 4, 3, 2]);
  assert.deepEqual([0, 1, 2, 3, 4].map(towerReward), [
    { tickets: 0, summonTickets: 0 },
    { tickets: 2, summonTickets: 0 },
    { tickets: 3, summonTickets: 0 },
    { tickets: 0, summonTickets: 1 },
    { tickets: 0, summonTickets: 2 },
  ]);
  const chance = TOWER_CARD_COUNTS.reduce((p, cards) => (p * (cards - 1)) / cards, 1);
  assert.equal(chance, 0.1875);
  assert.throws(() => towerReward(5));
});
