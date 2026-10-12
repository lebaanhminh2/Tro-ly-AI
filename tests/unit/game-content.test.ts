import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { GAME_BOSSES, GAME_CHAPTERS, publicGameCatalog, supportsContentVersion, validateGameContent } from '../../src/domain/game-content.ts';
import { TECHNIQUES, INITIAL_TECHNIQUES, SCHOOLS } from '../../src/domain/techniques.ts';
import { simulateEarnedJourney } from '../../scripts/simulate-game.ts';

test('every encounter portrait resolves to a reviewed final asset and its declared crop derivatives', () => {
    const assets = JSON.parse(readFileSync('docs/art/assets.json', 'utf8')) as { id: string; qa: { concept: string }; files: { path: string }[] }[];
    for (const boss of GAME_BOSSES) {
        assert.ok(boss.artId, 'Missing portrait: ' + boss.id);
        const record = assets.find(asset => asset.id === boss.artId);
        assert.equal(record?.qa.concept, 'approved', 'Unreviewed portrait: ' + boss.id);
        for (const suffix of ['', '-thumb']) {
            const path = 'web/assets/than-lo/' + boss.artId + suffix + '.webp';
            assert.ok(existsSync(path), path); assert.ok(record!.files.some(file => file.path === path), path);
        }
    }
});

test('all thirty-nine technique identities have distinct bounded original symbols and reproducible mappings', () => {
    const symbols = JSON.parse(readFileSync('docs/art/technique-symbols.json', 'utf8')) as { id: string; identity: string; path: string; workflow: string }[];
    assert.equal(symbols.length, TECHNIQUES.length);
    const drawings = new Set<string>();
    for (const technique of TECHNIQUES) {
        const symbol = symbols.find(value => value.id === technique.id)!;
        assert.equal(symbol.identity, technique.identity); assert.ok(existsSync(symbol.workflow));
        const svg = readFileSync(symbol.path, 'utf8');
        assert.ok(Buffer.byteLength(svg) < 1200, 'Symbol exceeds UI budget: ' + technique.id);
        assert.doesNotMatch(svg, /<script|onload=|<text\b|https?:\/\/(?!www\.w3\.org)/i);
        drawings.add(svg);
    }
    assert.equal(drawings.size, TECHNIQUES.length);
});

test('all fifteen chapters and thirty-nine rights have reachable finite encounters, including five earned inheritances and the final victory', () => {
    validateGameContent();
    assert.equal(GAME_CHAPTERS.length, 15); assert.equal(GAME_BOSSES.length, 40);
    const unlocked = new Set([...INITIAL_TECHNIQUES, ...GAME_BOSSES.flatMap(boss => boss.unlocks)]);
    assert.equal(unlocked.size, 39); assert.ok(TECHNIQUES.every(technique => unlocked.has(technique.id)));
    assert.equal(GAME_BOSSES.filter(boss => boss.kind === 'heritage').length, 5);
    for (const school of SCHOOLS) {
        const heritage = TECHNIQUES.find(technique => technique.school === school.id && technique.kind === 'heritage')!;
        const encounter = GAME_BOSSES.find(boss => boss.unlocks.includes(heritage.id))!;
        assert.deepEqual(new Set(encounter.practicePrerequisites), new Set(TECHNIQUES.filter(technique => technique.school === school.id && technique.kind === 'ordinary').map(technique => technique.id)));
    }
    assert.deepEqual(GAME_CHAPTERS.at(-1)!.encounters, ['than-so', 'than-the', 'than-chu']);
    assert.deepEqual(GAME_BOSSES.find(boss => boss.id === 'than-chu')!.rewards?.achievements, ['diet-than']);
    assert.equal(supportsContentVersion('than-lo-1'), true); assert.equal(supportsContentVersion('than-lo-2'), true);
    assert.equal(supportsContentVersion('invented'), false);
});

test('content validation rejects impossible dependency loops, invalid combat numbers, missing rights and chapters with orphan main encounters', () => {
    const invalidStats = structuredClone(GAME_BOSSES); invalidStats[0]!.fighter.attack = NaN;
    assert.throws(() => validateGameContent(invalidStats), /INVALID_GAME_CONTENT/);
    const cycle = structuredClone(GAME_BOSSES); cycle[0]!.requires = ['than-chu'];
    assert.throws(() => validateGameContent(cycle), /CIRCULAR_GAME_CONTENT/);
    const missingReference = structuredClone(GAME_BOSSES); missingReference[0]!.requires = ['than-chu']; missingReference.find(boss => boss.id === 'than-chu')!.requires = ['missing-boss'];
    assert.throws(() => validateGameContent(missingReference), /INVALID_GAME_CONTENT/);
    const unreachable = structuredClone(GAME_BOSSES); unreachable.find(boss => boss.id === 'ky-hanh-1')!.practicePrerequisites = ['nghich-thien'];
    assert.throws(() => validateGameContent(unreachable), /UNREACHABLE_GAME_CONTENT/);
    const missingRight = structuredClone(GAME_BOSSES); missingRight.find(boss => boss.id === 'cam-tang-nhat')!.unlocks = [];
    assert.throws(() => validateGameContent(missingRight), /UNREACHABLE_GAME_CONTENT/);
    const chapters = structuredClone(GAME_CHAPTERS); chapters[0]!.encounters.pop();
    assert.throws(() => validateGameContent(GAME_BOSSES, chapters), /INVALID_GAME_CHAPTERS/);
});

test('the full public catalog stays bounded and omits future story endings and boss patterns', () => {
    const catalog = publicGameCatalog(), raw = JSON.stringify(catalog);
    assert.ok(Buffer.byteLength(raw) < 40000, 'Catalog bytes: ' + Buffer.byteLength(raw));
    for (const boss of catalog.bosses) for (const privateField of ['pattern', 'introduction', 'victory', 'defeat', 'rewards']) assert.equal(privateField in boss, false);
    for (const chapter of catalog.chapters) for (const privateField of ['introduction', 'conclusion']) assert.equal(privateField in chapter, false);
    for (const technique of catalog.techniques) {
        assert.ok(technique.availableInitially || technique.sources.length > 0);
        for (const id of technique.sources) assert.ok(GAME_BOSSES.find(boss => boss.id === id)!.unlocks.includes(technique.id));
    }
});

test('each school reaches DIET THAN with earned ordinary versions and the existing sleep economy from fresh domain state', () => {
    for (const school of SCHOOLS) {
        const journey = simulateEarnedJourney(school.id);
        assert.equal(journey.mainWins, 22); assert.equal(journey.events.at(-1)!.boss, 'than-chu');
        assert.ok(journey.achievements.includes('diet-than')); assert.ok(journey.transitions.some(value => value.kind.startsWith('breakthrough:')));
        const rights = new Set(INITIAL_TECHNIQUES), won = new Set<string>();
        for (const event of journey.events) {
            const boss = GAME_BOSSES.find(boss => boss.id === event.boss)!;
            assert.ok(boss.requires.every(id => won.has(id)));
            assert.ok(event.versions.every(id => rights.has(id.slice('earned_'.length))));
            assert.ok(event.hp > 0); won.add(event.boss); event.unlocks.forEach(id => rights.add(id));
        }
        assert.ok(journey.days < 2000);
    }
});

test('each school can earn all side rights and train all39 editions from fresh state without administrative grants', () => {
    for (const school of SCHOOLS) {
        const journey = simulateEarnedJourney(school.id, true), rights = new Set(INITIAL_TECHNIQUES), victories = new Set<string>();
        assert.equal(journey.mainWins, 22); assert.equal(journey.branchWins, 18); assert.equal(journey.editions.length, 39);
        assert.deepEqual(new Set(journey.owned), new Set(TECHNIQUES.map(technique => technique.id)));
        assert.deepEqual(new Set(journey.weapons), new Set(['thach-tam', 'thuan-phong', 'dinh-tam']));
        for (const event of journey.events) {
            const boss = GAME_BOSSES.find(value => value.id === event.boss)!;
            assert.ok(boss.requires.every(id => victories.has(id)));
            assert.ok((boss.practicePrerequisites ?? []).every(id => rights.has(id) && event.learned.includes(id)));
            assert.ok(event.versions.every(id => rights.has(id.slice('earned_'.length))));
            assert.ok(event.hp > 0); victories.add(boss.id); boss.unlocks.forEach(id => rights.add(id));
        }
        assert.equal(victories.size, 40);
        for (const edition of journey.editions) assert.ok(rights.has(edition.techniqueId) && edition.tiers.length > 0);
    }
});
