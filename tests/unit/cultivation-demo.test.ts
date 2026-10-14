import assert from 'node:assert/strict';
import test from 'node:test';
import { CultivationDemoSession, DEMO_SCENARIOS } from '../../scripts/lib/cultivation-demo.ts';
import { GAME_BOSSES } from '../../src/domain/game-content.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';

const input = (session: CultivationDemoSession, values: Record<string, unknown>) => ({ day: session.day, version: session.version, ...values });

test('demo scenarios use valid production profiles, include the entire catalog and isolate their data', () => {
    for (const [id] of DEMO_SCENARIOS) {
        const session = new CultivationDemoSession(id);
        for (const stored of session.editions) {
            const detail = session.read('game-technique?techniqueId=' + stored.practice.techniqueId + '&versionId=' + stored.practice.id) as { selected: { profile: { damage: number } } };
            if (stored.practice.tiers.length) assert.ok(Number.isFinite(detail.selected.profile.damage), id);
        }
    }
    const all = new CultivationDemoSession('all'), other = new CultivationDemoSession('new');
    assert.equal(all.catalog().techniques.length, TECHNIQUES.length);
    assert.equal(all.catalog().bosses.length, GAME_BOSSES.length);
    assert.equal(all.editions.length, 39);
    all.command('game', input(all, { operation: 'stop_practice' }));
    assert.equal(other.editions.length, 0); assert.equal(other.pending, null);
});

test('demo next-day preparation does not steal a training day or mutate the combat snapshot', () => {
    const session = new CultivationDemoSession('prepared'), run = session.runs[0]!;
    const snapshot = structuredClone(run.state.loadout);
    assert.equal(session.current.mode, 'practice');
    assert.equal(session.overview().battles[0]!.status, 'prepared');
    assert.throws(() => session.command('game', input(session, { operation: 'choose_battle', battleId: run.id,
        battleVersion: run.version, techniqueId: 'kiem-y', acceptCost: true })));
    const clock = session.editions[0]!.practice.time!.lastTrainingDay;
    session.advanceDay();
    assert.equal(session.current.mode, 'battle');
    assert.ok(session.editions[0]!.practice.time!.lastTrainingDay! > clock!);
    assert.deepEqual(run.state.loadout, snapshot);
    const after = session.editions[0]!.practice.time!.lastTrainingDay;
    session.advanceDay();
    assert.equal(session.editions[0]!.practice.time!.lastTrainingDay, after);
    assert.equal(run.state.turn, 0, 'waiting does not consume combat effects');
});

test('demo rejects an obsolete day and keeps two maintained editions with immutable history', () => {
    const session = new CultivationDemoSession('retrain'), preserved = structuredClone(session.editions[0]!.practice);
    const stale = input(session, { operation: 'start_practice', techniqueId: 'kiem-y', confirmRestart: true });
    session.advanceDay(); assert.throws(() => session.command('game', stale), /Ngày hoặc phiên bản/);
    for (let index = 0; index < 3; index++) session.command('game', input(session, { operation: 'start_practice', techniqueId: 'kiem-y', confirmRestart: true }));
    assert.equal(session.editions.filter(value => value.maintained).length, 2);
    assert.equal(session.editions.length, 5);
    const original = session.editions.find(value => value.practice.id === preserved.id)!;
    assert.equal(original.maintained, true);
    assert.deepEqual(original.practice.tiers, preserved.tiers);
    const history = session.editions.find(value => !value.maintained)!;
    assert.throws(() => session.command('game', input(session, { operation: 'continue_practice', practiceId: history.practice.id })));
});

test('demo weekly pending is resolved by real settlement without a free perfect edition', () => {
    const session = new CultivationDemoSession('pending');
    assert.equal(session.overview().currentPractice!.training!.awaitingAudit, true);
    assert.equal(session.overview().currentPractice!.training!.grade, null);
    for (let day = 0; day < 4; day++) session.advanceDay();
    assert.equal(session.weeks[0]!.closedDay === null, false);
    assert.equal(session.editions[0]!.practice.time!.periods[0]!.ratioBp, 0);
    assert.equal(session.overview().currentPractice!.training!.grade, null);
});

test('demo rescue charges the production quote once and leaves next-day training paused', () => {
    const session = new CultivationDemoSession('rescue'), run = session.runs[0]!, before = session.healthy.qi;
    assert.equal(run.state.status, 'awaiting_rescue');
    const quote = session.overview().battles[0]!.rescue;
    session.command('game', input(session, { operation: 'rescue_battle', battleId: run.id, battleVersion: run.version,
        healthyVersion: session.healthyVersion, kind: 'qi', acceptCost: true }));
    assert.equal(session.healthy.qi, before - quote.qiCost);
    assert.equal(run.state.status, 'active'); assert.equal(run.state.rescueUsed, true);
    assert.equal(session.current.mode, 'battle');
    assert.throws(() => session.command('game', input(session, { operation: 'rescue_battle', battleId: run.id, battleVersion: run.version,
        healthyVersion: session.healthyVersion, kind: 'qi', acceptCost: true })));
    assert.equal(session.healthy.qi, before - quote.qiCost);
    const rank = new CultivationDemoSession('rescue-rank'), rankRun = rank.runs[0]!;
    assert.equal(rank.overview().battles[0]!.state.rankRescueAvailable, true);
    rank.command('game', input(rank, { operation: 'rescue_battle', battleId: rankRun.id, battleVersion: rankRun.version,
        healthyVersion: rank.healthyVersion, kind: 'rank', acceptCost: true }));
    assert.equal(rank.healthy.rank, 2); assert.equal(rank.healthy.qi, 500);
    assert.ok(rank.restrictions.rankLockUntilDay! > rank.day);
});

test('demo wins expose genuine cast history and earned unlocks once', () => {
    const session = new CultivationDemoSession('victory'), run = session.runs[0]!;
    assert.equal(run.state.status, 'won'); assert.equal(session.records.length, 1);
    assert.deepEqual(session.records[0]!.usedTechniqueIds, ['kiem-y']);
    assert.ok(session.rewards.some(value => value.id === 'mo-loi'));
    session.advanceDay();
    assert.equal(session.records.length, 1); assert.equal(session.victories.length, 1);
});
