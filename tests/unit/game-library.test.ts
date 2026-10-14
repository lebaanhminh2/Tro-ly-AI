import test from 'node:test';
import assert from 'node:assert/strict';
import { publicGameCatalog } from '../../src/domain/game-content.ts';
import { INITIAL_TECHNIQUES } from '../../src/domain/techniques.ts';
const libraryPath = '../../web/models/game-library.js';
const { gameSearchText, matchingTechniques, latestBattleResult } = await import(libraryPath);

test('Vietnamese search preserves word order and respects ownership, school and special-path filters', () => {
    const catalog = publicGameCatalog();
    assert.equal(gameSearchText('  ĐỒNG MỆNH  '), 'dong menh');
    assert.equal(matchingTechniques(catalog, INITIAL_TECHNIQUES, 'forbidden', 'dong menh')[0]!.id, 'dong-menh');
    assert.equal(matchingTechniques(catalog, INITIAL_TECHNIQUES, 'outside', 'sơn hà')[0]!.id, 'son-ha');
    assert.equal(matchingTechniques(catalog, INITIAL_TECHNIQUES, 'owned', 'tang nhat').length, 0);
    assert.equal(matchingTechniques(catalog, INITIAL_TECHNIQUES, 'thien-kiem', '').length, 5);
    assert.equal(matchingTechniques(catalog, INITIAL_TECHNIQUES, '', '').length, 39);
    assert.equal(matchingTechniques(catalog, INITIAL_TECHNIQUES, '', 'không có tên này').length, 0);
});

test('recent battle results remain visible after resuming practice and do not substitute old archive entries', () => {
    const day = 20740, recent = { id: 'recent-win', status: 'won', finishedDay: day - 1 };
    const old = { id: 'old-win', status: 'won', finishedDay: day - 30 };
    const active = { id: 'current-battle', status: 'active', finishedDay: null };
    const data = { day: { day }, current: { mode: 'practice' }, battles: [active, old, recent] };
    assert.equal(latestBattleResult(data).id, recent.id);
    assert.equal(latestBattleResult({ ...data, battles: [old, active] }), null);
    assert.equal(latestBattleResult({ ...data, day: { day: day + 1 } }), null);
});
