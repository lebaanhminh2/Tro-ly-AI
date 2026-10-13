import test from 'node:test';
import assert from 'node:assert/strict';
import { publicGameCatalog } from '../../src/domain/game-content.ts';
import { newPracticeVersion } from '../../src/domain/practice.ts';
const { nearestGameGoal, returnGameSummary } = await import('../../web/models/game-goal.js' as string);
const catalog = publicGameCatalog();
const data = () => ({ day: { day: 21000 }, settledThrough: 20999, pending: null, currentPractice: null as any,
    current: { mode: 'idle' }, battles: [] as any[], learned: [] as string[], victories: [] as string[], recent: [] as any[] });

test('nearest goal follows real main victories, prioritizes settlement and leaves battle/pending choices alone', () => {
    const state = data(); assert.equal(nearestGameGoal(state, catalog).id, 'truy-lenh');
    state.victories.push('truy-lenh'); assert.equal(nearestGameGoal(state, catalog).id, 'song-nha');
    state.settledThrough = 20997; assert.equal(nearestGameGoal(state, catalog).kind, 'refresh');
    state.settledThrough = 20999; state.battles.push({ status: 'awaiting_rescue' }); assert.equal(nearestGameGoal(state, catalog), null);
    state.battles = []; (state as any).pending = { mode: 'practice' }; assert.equal(nearestGameGoal(state, catalog), null);
});

test('unfinished edition, weekly audit, side prerequisite and collection point to their actual next screen', () => {
    const state = data(), practice = newPracticeVersion('goal_edition', 'kiem-y', 20990);
    state.currentPractice = { practice }; assert.equal(nearestGameGoal(state, catalog).kind, 'habits');
    practice.progressMilli = 3000; practice.pendingWeeks.push('week'); assert.match(nearestGameGoal(state, catalog).description, /cam kết tuần/);
    state.currentPractice = null;
    state.victories = catalog.chapters.flatMap(chapter => chapter.encounters);
    const goal = nearestGameGoal(state, catalog); assert.equal(goal.kind, 'technique');
    const boss = catalog.bosses.find(value => !state.victories.includes(value.id) && value.requires.every(id => state.victories.includes(id)))!;
    assert.ok(boss.practicePrerequisites?.includes(goal.id));
    state.victories = catalog.bosses.map(boss => boss.id); assert.equal(nearestGameGoal(state, catalog).kind, 'collection');
    assert.equal(nearestGameGoal(state, catalog).action, 'Mở thành tựu');
});

test('suggestions present floor progress without naming undiscovered encounters', () => {
    const state = data();
    assert.match(nearestGameGoal(state, catalog).description, /Tầng 01/);
    assert.match(nearestGameGoal(state, catalog).description, /ngày sinh hoạt kế tiếp/);
    const sealed = { ...catalog, bosses: catalog.bosses.map(boss => ({ ...boss, discovery: 'sealed' })) };
    const goal = nearestGameGoal(state, sealed);
    assert.equal(goal.kind, 'collection');
    assert.doesNotMatch(goal.title + goal.description, /Truy Lệnh|Song Nha|đã trọn/);
});

test('return guidance uses real nested settlement status and does not interpret a habit miss as a lost battle', () => {
    const state = data(); state.recent = [{ day: 20999, mode: 'battle', result: { battle: { status: 'withdrawn', waitDays: 3 }, directMisses: 1 } }];
    assert.match(returnGameSummary(state), /rút an toàn/);
    state.recent[0].result = { directMisses: 1 }; assert.equal(returnGameSummary(state), null);
    state.recent[0].result = { battle: { status: 'won' } }; assert.equal(returnGameSummary(state), null);
    state.recent[0].day = 20990; state.recent[0].result = { battle: { status: 'dead' } }; assert.equal(returnGameSummary(state), null);
    state.battles = [{ status: 'withdrawn', waitDays: 3, startsDay: 20000 }]; assert.match(returnGameSummary(state), /rút an toàn/);
    state.battles[0].waitDays = 0; assert.equal(returnGameSummary(state), null, 'Manual withdrawal must not claim three absent days');
    state.battles = [{ status: 'active' }]; assert.equal(returnGameSummary(state), null);
});
