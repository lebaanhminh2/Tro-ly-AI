import assert from 'node:assert/strict';
import test from 'node:test';

const actionsPath = '../../web/features/game.js';
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function context() {
    const state: any = { live: true, gamePanel: 'practice', gameData: null, gameCatalog: null };
    const runtime = { revision: 1 };
    return { state, runtime, render() {}, toast() {}, openSheet() {}, sheet: {}, sheetContent: {}, confirm() {}, performLive() {} };
}
test('game reads coalesce, cache only the same earned access and refresh discovery after a victory', async t => {
    const { createGameActions } = await import(actionsPath);
    const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
    let snapshot = { owned: ['kiem-y'], learned: [], victories: [] as string[] };
    const calls: string[] = [];
    globalThis.fetch = async url => { const path = String(url); calls.push(path); return json(path === '/api/game' ? snapshot : { techniques: [], bosses: [], access: snapshot }); };
    const ctx = context(), actions = createGameActions(ctx);
    const first = actions.loadGame(); assert.equal(actions.loadGame(), first); await first;
    assert.deepEqual(calls, ['/api/game', '/api/game-catalog']);
    await actions.loadGame(); assert.equal(calls.filter(path => path === '/api/game-catalog').length, 1);
    snapshot = { ...snapshot, victories: ['truy-lenh'] };
    // Mutation reconciliation can install a new overview before opening the tab.
    ctx.state.gameData = snapshot;
    await actions.loadGame(); assert.equal(calls.filter(path => path === '/api/game-catalog').length, 2);
    assert.deepEqual(ctx.state.gameCatalog.access.victories, ['truy-lenh']);
});
test('the current overview renders while the independent catalog is still pending', async t => {
    const { createGameActions } = await import(actionsPath);
    const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
    const overview = { owned: ['kiem-y'], learned: [], victories: [], current: { mode: 'practice' } };
    let releaseCatalog!: (response: Response) => void, rendered!: () => void;
    const usefulRender = new Promise<void>(resolve => { rendered = resolve; });
    globalThis.fetch = async url => String(url) === '/api/game' ? json(overview) :
        new Promise<Response>(resolve => { releaseCatalog = resolve; });
    const ctx = context(); ctx.render = () => { if (ctx.state.gameData && !ctx.state.gameCatalog) rendered(); };
    const request = createGameActions(ctx).loadGame();
    await usefulRender;
    assert.deepEqual(ctx.state.gameData, overview);
    assert.equal(ctx.state.gameLoading, false);
    assert.equal(ctx.state.gameCatalogLoading, true);
    assert.equal(ctx.state.gameCatalog, null);
    releaseCatalog(json({ techniques: [], bosses: [], access: overview })); await request;
    assert.equal(ctx.state.gameCatalogLoading, false);
});

test('a late game or victory read cannot restore the previous account after logout', async t => {
    const { createGameActions } = await import(actionsPath);
    const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
    const releases: Array<() => void> = [];
    globalThis.fetch = async () => { await new Promise<void>(resolve => releases.push(resolve)); return json({ owned: ['old-user'], victories: ['old-boss'] }); };
    const ctx = context(), actions = createGameActions(ctx);
    const game = actions.loadGame(), victories = actions.loadGameVictories();
    ctx.runtime.revision++; ctx.state.live = false; ctx.state.gameData = null; ctx.state.gameCatalog = null; ctx.state.gameVictories = null;
    releases.forEach(release => release()); await Promise.all([game, victories]);
    assert.equal(ctx.state.gameData, null); assert.equal(ctx.state.gameCatalog, null); assert.equal(ctx.state.gameVictories, null);
});
test('initial parallel settlement refreshes a catalog read before the new victory was committed', async t => {
    const { createGameActions } = await import(actionsPath);
    const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
    const before = { owned: ['kiem-y'], learned: [], victories: [] as string[] }, after = { ...before, victories: ['truy-lenh'] };
    let catalogs = 0;
    globalThis.fetch = async url => String(url) === '/api/game' ? json(after) : json({ access: ++catalogs === 1 ? before : after, techniques: [], bosses: [] });
    const ctx = context(); await createGameActions(ctx).loadGame();
    assert.equal(catalogs, 2); assert.deepEqual(ctx.state.gameCatalog.access.victories, ['truy-lenh']);
});
test('an in-flight victory read cannot replace the newer earned-access snapshot after settlement', async t => {
    const { createGameActions } = await import(actionsPath);
    const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
    const before = { owned: ['kiem-y'], learned: [], victories: [] as string[] }, after = { ...before, victories: ['truy-lenh'] };
    const waiting: Array<{ path: string; resolve: (response: Response) => void }> = [];
    globalThis.fetch = async url => {
        const path = String(url);
        if (path.startsWith('/api/game-victories')) return new Promise<Response>(resolve => waiting.push({ path, resolve }));
        return json(path === '/api/game' ? after : { access: after });
    };
    const ctx = context(); ctx.state.gameData = before; ctx.state.gameCatalog = { access: before };
    ctx.state.gameCatalogAccess = JSON.stringify([before.owned, before.learned, before.victories]); ctx.state.gamePanel = 'collection';
    const actions = createGameActions(ctx), old = actions.loadGameVictories();
    await actions.loadGame();
    const fresh = actions.loadGameVictories();
    assert.equal(waiting.length, 2);
    const [oldRead, freshRead] = waiting;
    assert.ok(oldRead, 'The original victory read must remain in flight');
    assert.ok(freshRead, 'Settlement must start a separate victory read');
    assert.notEqual(oldRead.path, freshRead.path);
    freshRead.resolve(json({ victories: [{ bossId: 'truy-lenh' }] })); await fresh;
    oldRead.resolve(json({ victories: [] })); await old;
    assert.deepEqual(ctx.state.gameVictories, { victories: [{ bossId: 'truy-lenh' }] });
    assert.equal(ctx.state.gameVictoriesLoading, false);
});
