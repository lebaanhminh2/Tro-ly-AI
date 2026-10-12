import test from 'node:test';
import assert from 'node:assert/strict';
import { publicGameCatalog } from '../../src/domain/game-content.ts';
import { INITIAL_TECHNIQUES } from '../../src/domain/techniques.ts';
const libraryPath = '../../web/models/game-library.js';
const { gameSearchText, matchingTechniques } = await import(libraryPath);

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
