import test from 'node:test';
import assert from 'node:assert/strict';
import { playerGameCatalog, discoveredBoss } from '../../src/domain/game-discovery.ts';
import { bossById, bossForNewBattle, GAME_BOSSES, supportsContentVersion } from '../../src/domain/game-content.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';

test('sealed special techniques and opponents reveal no names, descriptions, identities or reward sources', () => {
    const catalog = playerGameCatalog({ victories: [], learned: [], owned: [] });
    assert.equal(catalog.bosses.filter(boss => boss.floor !== null).length, 22);
    assert.deepEqual(catalog.bosses.filter(boss => boss.floor !== null).map(boss => boss.floor), Array.from({ length: 22 }, (_, i) => i + 1));
    const technique = catalog.techniques.find(value => value.id === 'thau-thien')!;
    assert.equal(technique.discovery, 'sealed'); assert.deepEqual(technique.sources, []);
    assert.equal(technique.description, ''); assert.equal(technique.identity, ''); assert.equal(technique.combatWarning, null);
    assert.equal(technique.clue.floor, 8);
    const boss = catalog.bosses.find(value => value.id === 'cam-thau-thien')!;
    assert.equal(boss.discovery, 'sealed'); assert.equal(boss.artId, null); assert.equal(boss.mechanics, '');
    const raw = JSON.stringify(catalog);
    assert.doesNotMatch(raw, /Thâu Thiên Hoán Mệnh|Người Đoạt Huyết|bounded_hp_steal/);
    for (const hidden of catalog.bosses.filter(value => value.discovery === 'sealed'))
        assert.equal(raw.includes(GAME_BOSSES.find(value => value.id === hidden.id)!.name), false,
            'Unopened chapters and achievements must not leak sealed boss names: ' + hidden.id);
    for (const hidden of catalog.techniques.filter(value => value.discovery === 'sealed'))
        assert.equal(raw.includes(TECHNIQUES.find(value => value.id === hidden.id)!.name), false,
            'Sealed technique names must not leak through any catalog field: ' + hidden.id);
    assert.equal(catalog.techniques.find(value => value.id === 'kiem-y')!.discovery, 'unlocked');
    assert.equal(catalog.bosses.find(value => value.id === 'truy-lenh')!.discovery, 'discovered');
    assert.deepEqual(catalog.access.victories, []);
    assert.ok(catalog.access.owned.includes('kiem-y'));
});

test('winning source predecessors discovers a technique without awarding learning rights or waiving practice prerequisites', () => {
    const access = { victories: ['khoi-loi-dai-hoi'], owned: [], learned: [] };
    const catalog = playerGameCatalog(access), technique = catalog.techniques.find(value => value.id === 'thau-thien')!;
    assert.equal(technique.discovery, 'discovered'); assert.equal(technique.name, 'Thâu Thiên Hoán Mệnh');
    assert.deepEqual(technique.sources, ['cam-thau-thien']);
    assert.equal(discoveredBoss('cam-thau-thien', access), true);
    const heritageAccess = { victories: ['thiet-lenh-su'], owned: [], learned: [] };
    assert.equal(discoveredBoss('kiem-truyen', heritageAccess), true);
    assert.equal(heritageAccess.learned.length, 0);
    assert.ok(bossById('kiem-truyen').practicePrerequisites!.length > 0);
});

test('older earned rights and trained editions stay known without requiring a new discovery event', () => {
    for (const access of [{ victories: [], owned: ['nghich-menh'], learned: [] }, { victories: [], owned: [], learned: ['nghich-menh'] }]) {
        const catalog = playerGameCatalog(access);
        assert.equal(catalog.techniques.find(value => value.id === 'nghich-menh')!.discovery, 'unlocked');
        assert.equal(discoveredBoss('truong-sinh', access), true);
    }
});

test('catalog access metadata belongs to the exact projection and is canonical across database ordering', () => {
    const first = playerGameCatalog({ victories: ['song-nha', 'truy-lenh'], owned: ['lien-van', 'kiem-y'], learned: ['lien-van', 'kiem-y'] });
    const second = playerGameCatalog({ victories: ['truy-lenh', 'song-nha', 'song-nha'], owned: ['kiem-y', 'lien-van'], learned: ['kiem-y', 'lien-van'] });
    assert.deepEqual(first.access, second.access);
    assert.notDeepEqual(first.access, playerGameCatalog({ victories: [], owned: [], learned: [] }).access);
});

test('new snapshots retire equipment rewards without mutating authored legacy content or version support', () => {
    const legacy = bossById('thu-mo'), snapshot = bossForNewBattle('thu-mo');
    assert.deepEqual(legacy.rewards!.weapons, ['thach-tam']);
    assert.deepEqual(snapshot.rewards!.weapons, []);
    assert.notEqual(snapshot, legacy);
    assert.equal(playerGameCatalog({ victories: [], learned: [], owned: [] }).weapons.length, 0);
    for (const version of ['than-lo-1', 'than-lo-2', 'than-lo-3', 'than-lo-4']) assert.equal(supportsContentVersion(version), true);
});
