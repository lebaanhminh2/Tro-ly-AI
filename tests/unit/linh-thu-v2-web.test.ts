import test from 'node:test';
import assert from 'node:assert/strict';
import { beastV2SpeciesProjection, initialBeastV2State } from '../../src/domain/linh-thu-v2.ts';
// prettier-ignore
// @ts-expect-error Browser JavaScript is checked separately by tsconfig.web.json.
import { beastSkillsV2, beastStageSkillsV2, beastUpgradeV2, beastProgressV2, beastRoadmapSkillsV2, beastSkillTransitionV2, beastRulesV2, beastSkillProgressV2 } from '../../web/models/linh-thu-v2.js';

function fixture(speciesId = 'humbug') {
  const beast = { speciesId, skillStateV2: initialBeastV2State() };
  const data = {
    config: { skillVersion: 2, skillsV2: { [speciesId]: beastV2SpeciesProjection(speciesId) } },
    v2: { active: true, day: 42, pendingDay: null as number | null },
  };
  return { data, beast };
}

test('structured meters require the exact effective companion and replace duplicate summary counters', () => {
  const { data, beast } = fixture('humbug');
  const current = { ...beast, id: 'current', attemptId: 'attempt' };
  const screen = {
    ...data,
    roles: { current: [{ role: 'companion', beastId: 'current', attemptId: 'attempt' }] },
    v2: {
      ...data.v2,
      taskCount: 2,
      startSleepStreak: 8,
      skillProgress: {
        beastId: 'current',
        attemptId: 'attempt',
        items: {
          awakening: { kind: 'cycle', value: 2, max: 3, label: '2/3 ngày', status: 'working' },
        },
      },
    },
  };
  assert.equal(beastSkillProgressV2(screen, current).awakening.value, 2);
  assert.deepEqual(beastSkillProgressV2(screen, { ...current, attemptId: 'old' }), {});
  assert.deepEqual(beastSkillProgressV2({ ...screen, roles: { current: [] } }, current), {});
  assert.deepEqual(
    beastSkillProgressV2({ ...screen, v2: { ...screen.v2, active: false } }, current),
    {},
  );
  assert.doesNotMatch(
    beastProgressV2(screen, current, { awakened: true, perfect: true }).join('\n'),
    /Tam Nhật Kết Ấn|Công việc hợp lệ|Chuỗi ngủ/,
  );
  const latched = { ...screen, v2: { ...screen.v2, multiplier: 3, selfBurnFinal: 36 } };
  assert.match(
    beastProgressV2(latched, current, { awakened: false, perfect: false }).join('\n'),
    /phạt tu vi ×3; tự trừ 36/,
    'latched daily penalties remain visible if a reset closes the original perfect skill',
  );
});

test('v2 rendering follows cutover gating and exact server-projected nonlinear stage rates', () => {
  const { data, beast } = fixture('voltfawn');
  const skills = beastSkillsV2(data, beast);
  assert.match(beastStageSkillsV2(skills, 2)[0].description, /20%/);
  assert.match(beastStageSkillsV2(skills, 4)[0].description, /35%/);
  assert.deepEqual(beastUpgradeV2(skills, 3, 4)[0].change, { from: '30%', to: '35%' });
  data.v2.active = false;
  assert.equal(beastSkillsV2(data, beast), null);
  data.v2.active = true;
  data.config.skillVersion = 1;
  assert.equal(beastSkillsV2(data, beast), null);
});

test('upgrade copy compares exact rates once and retains newly unlocked and changed reward effects', () => {
  const turtle = beastUpgradeV2(beastV2SpeciesProjection('gibber'), 1, 2)[0];
  assert.equal(turtle.name, 'Thạch Giáp');
  assert.deepEqual(turtle.change, { from: '25%', to: '50%' });
  assert.equal(turtle.description, 'Đột phá thất bại: hoàn tối đa 5 tu vi thực mất.');
  assert.equal(turtle.isNew, false);
  const monkey = beastV2SpeciesProjection('punchimp');
  const newSkill = beastUpgradeV2(monkey, 2, 3)[1];
  assert.equal(newSkill.isNew, true);
  assert.equal(newSkill.change, null);
  assert.match(newSkill.description, /50% nhận 3 vé quay thường/);
  assert.match(newSkill.description, /Dù có nhận được 3 vé hay không/);
  const fourth = beastUpgradeV2(monkey, 3, 4);
  assert.match(fourth[0].description, /5 tu vi và 1 vé quay thường/);
  assert.match(fourth[1].description, /Ngày hôm sau, mỗi công việc/);
  assert.deepEqual(fourth[1].change, { from: '50%', to: '100%' });
  const ninja = beastUpgradeV2(beastV2SpeciesProjection('skinklet'), 3, 4)[1];
  assert.equal(
    ninja.change,
    null,
    'Thế Thân boosts another skill; it is not an independent probability roll',
  );
  assert.match(ninja.description, /Huyễn Tức tăng từ 35% lên 55%/);
  const { talentChances: _rates, ...compatibility } = beastV2SpeciesProjection('gibber')!;
  assert.match(beastUpgradeV2(compatibility, 1, 2)[0].description, /50% hoàn tối đa 5/);
});

test('approved roadmap can preview v2 before cutover while current skills remain v1', () => {
  const { data, beast } = fixture('gibber');
  const pending = {
    ...data,
    config: { ...data.config, skillVersion: 1 },
    day: { day: 20748, endAt: Date.parse('2026-10-23T05:30:00+07:00') },
    v2: { ...data.v2, active: false, cutoverDay: 20749 },
  };
  assert.equal(beastSkillsV2(pending, beast), null);
  assert.match(
    beastStageSkillsV2(beastRoadmapSkillsV2(pending, beast), 1)[0].description,
    /5 tu vi/,
  );
  assert.match(beastSkillTransitionV2(pending), /05:30 ngày 23\/10\/2026/);
  assert.match(beastSkillTransitionV2(pending), /Hiện tại vẫn tính thưởng theo bộ kỹ năng cũ/);
  const active = {
    ...pending,
    config: { ...pending.config, skillVersion: 2 },
    v2: { ...pending.v2, active: true },
  };
  assert.equal(beastSkillTransitionV2(active), null);
  assert.ok(beastSkillsV2(active, beast));
  assert.equal(beastRoadmapSkillsV2({ ...pending, config: { skillVersion: 1 } }, beast), null);
  assert.equal(
    beastSkillTransitionV2({ ...pending, v2: { ...pending.v2, cutoverDay: null } }),
    null,
  );
  assert.equal(
    beastSkillTransitionV2({ ...pending, v2: { ...pending.v2, cutoverDay: 20748 } }),
    null,
  );
  assert.doesNotMatch(
    beastSkillTransitionV2({ ...pending, day: { day: 20748 } }),
    /undefined|Invalid|NaN/,
  );
});

test('v2 progress respects unlocks, server counters and daily quota rollover', () => {
  const { data, beast } = fixture();
  beast.skillStateV2.counters.habit95 = 2;
  beast.skillStateV2.daily.day = 42;
  beast.skillStateV2.daily.fusionUses = 2;
  let text = beastProgressV2(data, beast, { awakened: true, perfect: true }).join('\n');
  assert.match(text, /Tam Nhật Kết Ấn: 2 \/ 3/);
  assert.match(text, /còn 1 \/ 3 lượt/);
  data.v2.day = 43;
  text = beastProgressV2(data, beast, { awakened: true, perfect: true }).join('\n');
  assert.match(text, /còn 3 \/ 3 lượt/);
  data.v2.pendingDay = 42;
  assert.match(
    beastProgressV2(data, beast, { awakened: true, perfect: false }).join('\n'),
    /Đang chờ chốt/,
  );
  text = beastProgressV2(data, beast, { awakened: false, perfect: false }).join('\n');
  assert.doesNotMatch(text, /Tam Nhật Kết Ấn|lượt hôm nay/);
});

test('collection details use the matching selected attempt skill snapshot without borrowing another individual progress', () => {
  const { data, beast } = fixture();
  const selected = { ...beast, id: 'selected_beast', attemptId: 'selected_attempt' };
  selected.skillStateV2.counters.habit95 = 2;
  const current = { ...data, selected: [selected] };
  const collection = { speciesId: beast.speciesId, id: selected.id, attemptId: selected.attemptId };
  assert.match(
    beastProgressV2(current, collection, { awakened: true }).join('\n'),
    /Tam Nhật Kết Ấn: 2 \/ 3/,
  );
  assert.match(
    beastProgressV2(
      current,
      { ...collection, attemptId: 'reset_attempt' },
      { awakened: true },
    ).join('\n'),
    /Tam Nhật Kết Ấn: 0 \/ 3/,
  );
  assert.match(
    beastProgressV2(current, { ...collection, id: 'another_beast' }, { awakened: true }).join('\n'),
    /Tam Nhật Kết Ấn: 0 \/ 3/,
  );
});

test('progress hides irrelevant context and current-day settlement notices, but retains actual pending rewards and active effects', () => {
  const { data, beast } = fixture('gibber');
  const current = {
    ...data,
    v2: {
      ...data.v2,
      taskCount: 0,
      startSleepStreak: 21,
      pendingDay: 42,
      taskBuff: { qi: 0, tickets: 0 },
    },
  };
  const levels = { awakened: false, perfect: false };
  assert.deepEqual(beastProgressV2(current, beast, levels), []);
  current.v2.pendingDay = 41;
  assert.match(beastProgressV2(current, beast, levels).join('\n'), /Đang chờ chốt/);
  const buffed = {
    ...current,
    v2: { ...current.v2, multiplier: 3, selfBurnFinal: 36, taskBuff: { qi: 1, tickets: 1 } },
  };
  const text = beastProgressV2(buffed, beast, levels).join('\n');
  assert.match(text, /Công việc hợp lệ hôm nay: 0/);
  assert.match(text, /Thưởng công việc hôm nay/);
  assert.match(text, /thưởng ×3, phạt tu vi ×3; tự trừ 36 tu vi/);
  assert.doesNotMatch(text, /Chuỗi ngủ/);
  const sleeper = fixture('maskfry');
  const sleepData = { ...current, config: sleeper.data.config };
  assert.doesNotMatch(beastProgressV2(sleepData, sleeper.beast, levels).join('\n'), /Chuỗi ngủ/);
  assert.match(
    beastProgressV2(sleepData, sleeper.beast, { perfect: true }).join('\n'),
    /Chuỗi ngủ đúng giờ đầu ngày: 21/,
  );
  assert.match(
    beastRulesV2(fixture('flameow').data.config.skillsV2.flameow).join('\n'),
    /5 công việc/,
  );
  assert.doesNotMatch(
    beastRulesV2(fixture('gibber').data.config.skillsV2.gibber).join('\n'),
    /5 công việc/,
  );
});
