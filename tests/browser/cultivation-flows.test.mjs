import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { browserBin, fixture, serve, chrome, snapshot, clone, now } from './app-harness.mjs';
import { newPracticeVersion, settlePracticeDay } from '../../src/domain/practice.ts';
import { GAME_BOSSES, GAME_CHAPTERS, bossById } from '../../src/domain/game-content.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';
import { newTimePracticeVersion } from '../../src/domain/practice-progression.ts';
import { publicBattleState, resolveBattleTurn } from '../../src/domain/battle.ts';
import { rescueQuote } from '../../src/domain/battle-economy.ts';

const options = { skip: !browserBin, timeout: 90000 };
const floors = GAME_BOSSES.filter(boss => !boss.kind || boss.kind === 'main');
function edition(control, id, count = 1, number = 1, techniqueId = 'kiem-y') {
    let practice = newPracticeVersion(id, techniqueId, control.game.day.day - 40, 1000, number), weeks = [], day = practice.createdDay;
    while (practice.tiers.length < count) {
        const result = settlePracticeDay(day++, id, [practice], weeks, [{ habitId: 'fixture_reading', successes: 1, misses: 0, mature: true, weekly: null }]);
        practice = result.versions[0]; weeks = result.weeks;
    }
    const stored = { practice, version: 1, created: now };
    control.practiceVersions.push(stored); control.game.learned = [...new Set([...(control.game.learned ?? []), techniqueId])]; return stored;
}
function wins(control, count) {
    control.game.victories = floors.slice(0, count).map(boss => boss.id);
    control.game.owned = [...new Set([...control.game.owned, ...GAME_BOSSES.filter(boss => control.game.victories.includes(boss.id)).flatMap(boss => boss.unlocks)])];
}
async function start(control, width = 390) {
    const server = await serve(control); let browser;
    try {
        browser = await chrome(); await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.tap('[data-tab=game]'); await browser.wait("!!document.querySelector('.practice-card')");
        return { browser, server };
    } catch (error) { if (browser) await browser.close(); await server.close(); throw error; }
}
async function close(browser, server) { await browser.close(); await server.close(); }
async function refresh(browser) { await browser.tap('[data-tab=today]'); await browser.tap('[data-tab=game]'); await delay(100); }
async function prepare(browser) {
    await browser.click('Thử thách', '.game-navigation button');
    await browser.evaluate("document.querySelector('.floor-row[data-boss-id=truy-lenh] button').click()");
    await browser.wait("!!document.querySelector('.battle-preparation-footer>.primary')");
}
async function inspectLoadout(browser, id, versionId = null) {
    await browser.evaluate(`document.querySelector('.battle-loadout-picker').open=true;document.querySelector('[data-loadout-technique="${id}"] details').open=true`);
    await browser.wait(`!!document.querySelector('[data-loadout-technique="${id}"] .technique-effects')`);
    if (versionId) await browser.evaluate(`document.querySelector('[data-loadout-technique="${id}"] input[type=radio][value="${versionId}"]').click()`);
}
async function selectLoadout(browser, ids) {
    await browser.evaluate(`(() => {document.querySelector('.battle-loadout-picker').open=true;
        document.querySelectorAll('.battle-loadout-main input:checked').forEach(input=>input.click());
        for(const id of ${JSON.stringify(ids)}) document.querySelector('[data-loadout-technique="'+id+'"] input[type=checkbox]').click();})()`);
}
async function inspectChoice(browser, id) {
    await browser.evaluate(`document.querySelector('[data-choice-id="${id}"]').click()`);
    await browser.wait("!!document.querySelector('.battle-preview')");
}
async function capture(browser, name) {
    if (process.env.UI_SCREENSHOT_DIR) await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, name + '.png'));
}

test('cultivation keeps four fixed sections, sealed clues and mobile hierarchy without automatic writes', options, async () => {
    const control = fixture(), { browser, server } = await start(control);
    try {
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.game-navigation button')].map(n=>n.textContent)"), ['Hiện tại', 'Công pháp', 'Thử thách', 'Thành tựu']);
        assert.doesNotMatch((await snapshot(browser)).text, /Thần binh|Sưu tập/);
        for (const width of [320, 360, 390, 1440]) for (const theme of ['light', 'dark']) {
            await browser.resize(width, 844); await browser.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
            for (const label of ['Hiện tại', 'Công pháp', 'Thử thách', 'Thành tựu']) {
                await browser.click(label, '.game-navigation button');
                assert.equal((await snapshot(browser)).overflow, false, label + '/' + width + '/' + theme);
                await capture(browser, 'cultivation-' + label + '-' + width + '-' + theme);
            }
        }
        await browser.resize(320, 600);
        for (const label of ['Hiện tại', 'Công pháp', 'Thử thách', 'Thành tựu']) {
            await browser.scaleText(); await browser.click(label, '.game-navigation button'); await browser.scaleText(2);
            assert.equal((await snapshot(browser)).overflow, false, label + ' large text');
            await capture(browser, 'cultivation-' + label + '-320-large');
        }
        await browser.scaleText();
        await browser.click('Công pháp', '.game-navigation button');
        await browser.evaluate("document.querySelector('[data-school-id=forbidden]').click()");
        assert.match(await browser.evaluate("document.querySelector('.game-library').innerText"), /bí tịch chưa phát hiện/);
        assert.equal(await browser.evaluate("!!document.querySelector('[data-technique-id=thau-thien]')"), false);
        await browser.click('‹ Các phái'); await browser.tap('[data-school-id=thien-kiem]');
        await browser.evaluate("document.querySelector('.game-library input').value='kiem y';document.querySelector('.game-library input').dispatchEvent(new Event('input'))");
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.cultivation-technique')].map(n=>n.dataset.techniqueId)"), ['kiem-y']);
        await browser.click('Thử thách', '.game-navigation button');
        assert.equal(await browser.evaluate("document.querySelector('.floor-row.is-next').dataset.bossId"), 'truy-lenh');
        assert.equal(await browser.evaluate("document.querySelector('[data-boss-id=song-nha]').innerText.includes('Song Nha')"), false);
        assert.equal(control.posts.length, 0); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('practice applies next day and a confirmed restart preserves every locked tier and existing work', options, async () => {
    const control = fixture(), account = clone(control.state.account), tasks = clone(control.state.tasks), { browser, server } = await start(control);
    try {
        await browser.click('Công pháp', '.game-navigation button'); await browser.tap('[data-school-id=thien-kiem]'); await browser.tap('[data-technique-id=kiem-y]');
        await browser.wait("!!document.querySelector('.technique-sheet-footer button.primary')"); await browser.click('Bắt đầu luyện');
        await browser.wait("!!document.querySelector('.cultivation-pending')");
        assert.equal(control.game.current.mode, 'idle'); assert.equal(control.game.pending.fromDay, control.game.day.day + 1);
        const stored = control.practiceVersions[0];
        const locked = edition(control, 'practice_earned_tier'); control.practiceVersions.pop();
        stored.practice = { ...locked.practice, id: stored.practice.id, edition: stored.practice.edition };
        stored.practice.progressMilli = 6000; stored.practice.effortMilli = 6000; stored.practice.pendingWeeks = ['fixture_week'];
        control.game.current = control.game.pending; control.game.currentPractice = stored; control.game.pending = null; control.game.pendingPractice = null;
        control.game.day.day++; control.game.settledThrough = control.game.day.day - 1;
        await refresh(browser); await browser.wait("/chờ cam kết tuần/i.test(document.querySelector('.practice-card')?.innerText ?? '')");
        const old = clone(stored.practice);
        await browser.click('Xem công pháp'); await browser.wait("!!document.querySelector('.technique-edition-details')");
        await browser.resize(320, 460); await browser.evaluate("document.querySelector('.technique-sheet').scrollTop=9999");
        assert.equal(await browser.evaluate("(() => {const r=document.querySelector('[data-sheet-close]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), true);
        await browser.click('Luyện lại từ tầng 1'); assert.equal(control.practiceVersions.length, 1);
        await browser.click('Xác nhận'); await browser.wait("!!document.querySelector('.cultivation-pending')");
        assert.equal(control.practiceVersions.length, 2); assert.equal(control.game.pendingPractice.practice.edition, 2);
        assert.equal(control.game.pendingPractice.practice.progressMilli, 0); assert.deepEqual(control.practiceVersions[1].practice, old);
        assert.deepEqual(control.state.account, account); assert.deepEqual(control.state.tasks, tasks); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('preparing and editing a battle keeps its identity and tomorrow activation, and rejects a stale draft', options, async () => {
    const control = fixture(); const first = edition(control, 'browser_edition_old'), second = edition(control, 'browser_edition_new', 2, 2);
    const { browser, server } = await start(control);
    try {
        await prepare(browser);
        assert.equal(await browser.evaluate("!!document.querySelector('.battle-preparation>label select')"), false, 'No weapon picker');
        await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!!document.querySelector('.battle-card') && !document.querySelector('#sheet').open");
        const battle = control.game.battles[0], id = battle.id, starts = battle.startsDay;
        assert.equal(starts, control.game.day.day + 1); assert.equal(control.game.current.mode, 'idle'); assert.equal(battle.weaponId, null);
        await browser.click('Đổi bộ chiêu'); await browser.wait("!!document.querySelector('.battle-loadout-editor')");
        await inspectLoadout(browser, 'kiem-y', 'browser_edition_old');
        await browser.click('Lưu bộ chiêu'); await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.game.battles.length, 1); assert.equal(battle.id, id); assert.equal(battle.startsDay, starts);
        assert.equal(battle.state.loadout[0].versionId, first.practice.id); assert.equal(battle.version, 2);
        assert.deepEqual(control.posts.filter(post => post.path === 'game').map(post => post.input.operation), ['prepare_battle', 'update_prepared_battle']);
        await browser.click('Đổi bộ chiêu'); await browser.wait("!!document.querySelector('.battle-loadout-editor')");
        control.game.version++;
        await inspectLoadout(browser, 'kiem-y', 'browser_edition_new');
        await browser.click('Lưu bộ chiêu'); await browser.wait("document.querySelector('#sheet-feedback')?.textContent.includes('Tiến trình đã thay đổi')");
        assert.equal(battle.state.loadout[0].versionId, first.practice.id); assert.equal(battle.version, 2);
        assert.equal(await browser.evaluate("document.querySelector('.battle-loadout-chip').dataset.versionId"), second.practice.id); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('daily battle choice remains pending, read stance explains penalties, and rescue shows the actual cost', options, async () => {
    const control = fixture(); edition(control, 'battle_choice_edition'); const { browser, server } = await start(control);
    try {
        await prepare(browser); await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!!document.querySelector('.battle-card') && !document.querySelector('#sheet').open");
        const battle = control.game.battles[0], run = control.battleRuns.get(battle.id);
        control.game.current = control.game.pending; control.game.pending = null; control.game.day.day++; control.game.settledThrough = control.game.day.day - 1;
        battle.status = 'active';
        await refresh(browser); await browser.wait("!!document.querySelector('[data-write=battle-choice]')");
        await browser.evaluate("document.documentElement.dataset.theme='dark'");
        assert.equal(await browser.evaluate("document.querySelectorAll('[data-write=battle-choice]').length"), 1);
        const beforeInspect = control.posts.length;
        await browser.click('Chọn chiêu'); await inspectChoice(browser, 'vo-ky');
        assert.equal(control.posts.length, beforeInspect, 'Reading a choice cannot commit it');
        assert.match(await browser.evaluate("document.querySelector('.battle-preview').innerText"), /chưa tính buff/);
        await capture(browser, 'v2-choice-390-dark');
        await browser.click('Chọn Võ Kỹ', '.battle-choice-footer button');
        await browser.wait("!document.querySelector('#sheet').open && document.querySelector('.battle-card')?.innerText.includes('Đã chọn Võ Kỹ')");
        assert.equal(run.state.turn, 0); assert.equal(control.game.choices[0].techniqueId, 'vo-ky');
        const hp = run.state.player.hp;
        await browser.click('Đổi chiêu'); await inspectChoice(browser, 'kiem-y');
        await browser.click('Chọn Kiếm Ý', '.battle-choice-footer button');
        await browser.wait("!document.querySelector('#sheet').open && document.querySelector('.battle-card')?.innerText.includes('Đã chọn Kiếm Ý')");
        assert.equal(run.state.turn, 0); assert.equal(run.state.player.hp, hp);
        run.state.player.hp = 0; run.state.status = 'awaiting_rescue'; battle.state = publicBattleState(run.state); battle.status = 'awaiting_rescue';
        run.rescueUntilDay = battle.rescueUntilDay = control.game.day.day + 3;
        battle.rescue = rescueQuote(control.state.account.state, run.combatRank);
        await refresh(browser); await browser.wait("!!document.querySelector('.battle-rescue-actions')");
        for (const width of [320, 390, 1440]) { await browser.resize(width, 600); assert.equal((await snapshot(browser)).overflow, false); }
        const cost = battle.rescue.qiCost, before = control.state.account.state.qi;
        await browser.click('Hộ Mệnh · ' + cost + ' Tu Vi'); await browser.wait("document.querySelector('#sheet').open");
        assert.match(await browser.evaluate("document.querySelector('#sheet').innerText"), new RegExp('Trả ' + cost + ' Tu Vi'));
        await browser.resize(320, 460);
        await browser.evaluate("[...document.querySelectorAll('#sheet *')].map(node=>[node,getComputedStyle(node).fontSize]).forEach(([node,size])=>node.style.fontSize=(parseFloat(size)*2)+'px');document.querySelector('#sheet-content>.hint').scrollTop=99999");
        assert.deepEqual(await browser.evaluate("(() => {const close=document.querySelector('[data-sheet-close]').getBoundingClientRect(),action=document.querySelector('.game-confirm-actions .primary').getBoundingClientRect();return {close:close.top>=0&&close.bottom<=innerHeight,action:action.top>=0&&action.bottom<=innerHeight}})()"), { close:true, action:true });
        const postsBeforeCancel = control.posts.length;
        await browser.press('Escape'); await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#sheet')).display"), 'none', 'Closing game confirmation must actually hide its retained contents');
        assert.equal(control.posts.length, postsBeforeCancel, 'Closing a confirmation cannot pay a rescue');
        await browser.resize(390, 600);
        await browser.click('Hộ Mệnh · ' + cost + ' Tu Vi'); await browser.wait("document.querySelector('#sheet').open");
        control.game.combatEconomy.healthyVersion++; control.state.account.version++;
        await refresh(browser);
        await browser.click('Xác nhận'); await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.posts.length, postsBeforeCancel, 'A rescue quote from an old healthy version cannot be paid');
        assert.equal(control.state.account.state.qi, before);
        await browser.click('Hộ Mệnh · ' + cost + ' Tu Vi'); await browser.wait("document.querySelector('#sheet').open");
        await browser.click('Xác nhận'); await browser.wait("!!document.querySelector('[data-write=battle-choice]')");
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#sheet')).display"), 'none');
        assert.equal(control.state.account.state.qi, before - cost); assert.equal(run.state.rescueUsed, true); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('battle inspection handles offline retry, hidden intents, HP costs and stale confirmations without unintended writes', options, async () => {
    const control = fixture();
    edition(control, 'choice_kiem_y'); edition(control, 'choice_swap', 1, 1, 'nghich-thien'); edition(control, 'choice_cost', 1, 1, 'dong-menh');
    control.game.owned = [...control.game.owned, 'nghich-thien', 'dong-menh'];
    const { browser, server } = await start(control);
    try {
        await prepare(browser);
        await selectLoadout(browser, ['kiem-y', 'nghich-thien', 'dong-menh']);
        await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!document.querySelector('#sheet').open && !!document.querySelector('.battle-card')");
        const battle = control.game.battles[0], run = control.battleRuns.get(battle.id);
        control.game.current = control.game.pending; control.game.pending = null;
        control.game.day.day++; control.game.settledThrough = control.game.day.day - 1; battle.status = 'active';
        await refresh(browser); await browser.wait("!!document.querySelector('[data-write=battle-choice]')");
        const readsOnly = control.posts.length;
        await browser.click('Chọn chiêu'); await inspectChoice(browser, 'nghich-thien');
        const hidden = await browser.evaluate("document.querySelector('.battle-preview').innerText");
        assert.match(hidden, /Chưa xem được hành động kế tiếp/);
        assert.doesNotMatch(hidden, /Đối thủ mất|Sau lượt|Xem diễn biến/);
        await browser.networkConditions(true);
        await browser.evaluate("document.querySelector('[data-choice-id=kiem-y]').click()");
        await browser.wait("document.querySelector('.battle-choice-detail')?.innerText.includes('Thử lại')");
        assert.equal(await browser.evaluate("document.querySelector('.battle-choice-footer button').disabled"), true);
        assert.equal(control.posts.length, readsOnly);
        await browser.networkConditions(false, 0, 10000000);
        await browser.click('Thử lại', '.battle-choice-detail button'); await browser.wait("!!document.querySelector('.battle-preview')");
        await browser.resize(320, 460);
        await browser.scaleText(2); await browser.evaluate("document.querySelector('.battle-choice-sheet').scrollTop=99999");
        assert.deepEqual(await browser.evaluate("(() => {const close=document.querySelector('[data-sheet-close]').getBoundingClientRect(),action=document.querySelector('.battle-choice-footer button').getBoundingClientRect();return {close:close.top>=0&&close.bottom<=innerHeight,action:action.top>=0&&action.bottom<=innerHeight}})()"), {close:true,action:true});
        assert.equal((await snapshot(browser)).overflow, false);
        await capture(browser, 'v2-choice-320-large');
        await browser.scaleText(); await browser.resize(390, 844); await browser.press('Escape');
        run.state.player.hp = 10; battle.state = publicBattleState(run.state); battle.version++; control.game.version++;
        await refresh(browser); await browser.click('Chọn chiêu'); await inspectChoice(browser, 'dong-menh');
        assert.match(await browser.evaluate("document.querySelector('.battle-preview').innerText"), /Không đủ HP/);
        assert.equal(await browser.evaluate("document.querySelector('.battle-choice-footer button').disabled"), true);
        await browser.press('Escape'); run.state.player.hp = run.state.player.maxHp;
        battle.state = publicBattleState(run.state); battle.version++; control.game.version++;
        await refresh(browser); await browser.click('Chọn chiêu'); await inspectChoice(browser, 'dong-menh');
        assert.match(await browser.evaluate("document.querySelector('.technique-effects').innerText"), /Hiến HP|10 %/);
        await browser.click('Chọn ' + TECHNIQUES.find(technique=>technique.id==='dong-menh').name, '.battle-choice-footer button');
        await browser.wait("!!document.querySelector('.game-confirm-actions')");
        control.game.day.day++; control.game.settledThrough = control.game.day.day - 1; control.game.version++; battle.version++;
        battle.content = { ...battle.content, name: 'Trận đã cập nhật' };
        await refresh(browser); await browser.wait("document.querySelector('.battle-heading h2')?.textContent==='Trận đã cập nhật'");
        await browser.click('Xác nhận'); await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.posts.length, readsOnly, 'A stale cost confirmation cannot create a choice');
        control.readDelays = { 'battle-choice': 350 };
        await browser.click('Chọn chiêu'); control.game.version++;
        await browser.wait("document.querySelector('.battle-choice-detail')?.innerText.includes('Cập nhật trận')");
        assert.equal(await browser.evaluate("document.querySelector('.battle-choice-footer button').disabled"), true);
        await browser.click('Cập nhật trận'); await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.posts.length, readsOnly); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('victories older than the recent archive load lazily and discovery refreshes after earned progress changes', options, async () => {
    const control = fixture(); wins(control, 4);
    const oldBoss = bossById('truy-lenh');
    control.victoryRecords = [{ bossId: oldBoss.id, battleId: 'first_win_before_recent_archive', wonDay: control.game.day.day - 200,
        turn: 4, loadout: [], rescueUsed: false, unlocks: oldBoss.unlocks, victory: oldBoss.victory }];
    const { browser, server } = await start(control);
    try {
        assert.equal(control.calls.includes('GET game-victories'), false);
        await browser.click('Thành tựu', '.game-navigation button'); await browser.wait("document.querySelector('[data-victory-boss=truy-lenh] summary')?.innerText.includes('4 lượt')");
        await browser.evaluate("document.querySelector('[data-victory-boss=truy-lenh]').open=true");
        assert.equal(await browser.evaluate("document.querySelector('[data-victory-boss=truy-lenh]').innerText.includes('4 lượt')"), true);
        await browser.click('Nhật ký chiến thắng'); await browser.wait("!!document.querySelector('.battle-history')");
        assert.equal(control.calls.at(-1), 'GET battle-history');
        await browser.tap('[data-sheet-close]'); await browser.click('Công pháp', '.game-navigation button');
        await browser.evaluate("document.querySelector('[data-school-id=forbidden]').click()");
        assert.equal(await browser.evaluate("!!document.querySelector('[data-technique-id=thau-thien]')"), false);
        wins(control, 8); await refresh(browser); await browser.wait("!!document.querySelector('[data-technique-id=thau-thien]')");
        assert.ok(control.calls.filter(call => call === 'GET game-catalog').length >= 2, 'Refresh player-specific catalog after unlock/discovery');
        await browser.evaluate("document.querySelector('[data-technique-id=thau-thien]').scrollIntoView({block:'center'})");
        await browser.tap('[data-technique-id=thau-thien]'); await browser.wait("!!document.querySelector('.technique-sources')");
        await browser.click('Điều kiện học', '.technique-sources summary');
        assert.match(await browser.evaluate("document.querySelector('#sheet').innerText"), /Người Đoạt Huyết/);
        assert.equal(control.practiceVersions.length, 0, 'Discovering or winning does not grant a ready edition');
        assert.equal(control.posts.length, 0); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('battle logs and archive retain pages through offline retry, reject stale reads and explain event amounts', options, async () => {
    const control = fixture(); wins(control, 1);
    const boss = bossById('truy-lenh'), id = 'history_first_win';
    control.victoryRecords = [{ bossId: boss.id, battleId: id, wonDay: control.game.day.day - 1,
        turn: 3, loadout: [], rescueUsed: false, unlocks: boss.unlocks, victory: boss.victory }];
    const event = (sequence, kind = 'settlement') => ({ sequence, day: control.game.day.day - (10 - sequence), kind,
        entries: [{ kind: 'strike', text: 'Đối thủ mất 17 HP. Sát thương thô 100 · Giảm thương chặn 20 · Phòng thủ chặn 10 · Giáp Ảo giảm 28 · Giáp Ảo hấp thụ 10 · Khiên hấp thụ 15.', amount: 17,
            hit: { raw: 100, reductionAdjustment: 20, armorBlocked: 10, virtualReduced: 28, virtualAbsorbed: 10,
                shieldAbsorbed: 15, hpLost: 17, overflow: 0 } },
            { kind: 'heal', text: 'Hồi phục sinh lực.', amount: 12 }], result: {} });
    control.historyPages = new Map([[Number.MAX_SAFE_INTEGER, { events: [event(9)], next: 9 }],
        [9, { events: [event(9), event(8, 'rescue')], next: null }]]);
    const archived = number => ({ id: 'archived_battle_' + number, content: { name: 'Trận ' + number }, status: 'won',
        startsDay: control.game.day.day - number, turn: 3 });
    control.archivePages = new Map([['', { battles: [archived(1)], next: 'older_cursor' }],
        ['older_cursor', { battles: [archived(1), archived(2)], next: null }]]);
    const { browser, server } = await start(control);
    const gameRead = Promise.withResolvers(), releaseGame = Promise.withResolvers();
    const historyRead = Promise.withResolvers(), releaseHistory = Promise.withResolvers();
    try {
        await browser.click('Thành tựu', '.game-navigation button');
        await browser.wait("!!document.querySelector('[data-victory-boss=truy-lenh]')");
        await browser.evaluate("document.querySelector('[data-victory-boss=truy-lenh]').open=true");
        await browser.click('Nhật ký chiến thắng'); await browser.wait("!!document.querySelector('[data-sequence=\"9\"]')");
        assert.match(await browser.evaluate("document.querySelector('.battle-history').innerText"), /Hồi phục sinh lực\. · 12 HP/);
        control.failedReads = new Set(['battle-history']); await browser.click('Xem lượt trước');
        await browser.wait("document.querySelector('.battle-history [role=status]')?.textContent.includes('Chưa thể') || [...document.querySelectorAll('.battle-history button')].some(n=>n.textContent==='Thử lại')");
        assert.equal(await browser.evaluate("document.querySelectorAll('.battle-history .battle-log-day').length"), 1);
        assert.ok(await browser.evaluate("document.querySelector('.battle-history [role=status]')?.textContent.length > 0"));
        control.failedReads.clear(); await browser.click('Thử lại', '.battle-history button');
        await browser.wait("!!document.querySelector('[data-sequence=\"8\"]')");
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.battle-history .battle-log-day')].map(n=>n.dataset.sequence)"), ['9', '8']);
        assert.match(await browser.evaluate("document.querySelector('[data-sequence=\"8\"] h3').innerText"), /cứu mạng/);
        assert.deepEqual(control.historyReads, [Number.MAX_SAFE_INTEGER, 9]);
        assert.equal(await browser.evaluate("document.querySelector('.battle-hit-details').open"), false);
        assert.equal(await browser.evaluate("document.querySelector('.battle-log-entry>p').innerText"), 'Đối thủ mất 17 HP.');
        await capture(browser, 'v2-log-history-390');
        await browser.evaluate("document.querySelector('.battle-hit-details').open=true");
        assert.deepEqual(await browser.evaluate("[...document.querySelector('.battle-hit-details dl').children].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])"),
            [['Sát thương thô', '100'], ['Giảm thương chặn', '20'], ['Phòng thủ chặn', '10'], ['Giáp Ảo giảm', '28'], ['Giáp Ảo hấp thụ', '10'], ['Khiên hấp thụ', '15']]);
        await capture(browser, 'v2-log-detail-390');
        await browser.tap('[data-sheet-close]');
        await browser.evaluate("document.querySelector('.game-export-controls').open=true");
        await browser.click('Lịch sử tất cả trận'); await browser.wait("!!document.querySelector('[data-battle-id=archived_battle_1]')");
        control.failedReads.add('battles'); await browser.click('Xem trận trước');
        await browser.wait("[...document.querySelectorAll('.battle-history button')].some(n=>n.textContent==='Thử lại')");
        control.failedReads.clear(); await browser.click('Thử lại', '.battle-history button');
        await browser.wait("!!document.querySelector('[data-battle-id=archived_battle_2]')");
        assert.equal(await browser.evaluate("document.querySelectorAll('.battle-history .battle-log-day').length"), 2);
        assert.deepEqual(control.archiveReads, ['', 'older_cursor']);
        await browser.tap('[data-sheet-close]');
        // A reload already in flight can update the context while a sheet is
        // open. The visible victory count proves that update reached the UI.
        control.readGates = new Map([
            ['game', async () => { gameRead.resolve(); await releaseGame.promise; }],
            ['battle-history', async () => { historyRead.resolve(); await releaseHistory.promise; }],
        ]);
        control.game.version++; wins(control, 2);
        await browser.tap('[data-tab=game]'); await gameRead.promise;
        await browser.click('Nhật ký chiến thắng'); await historyRead.promise;
        releaseGame.resolve();
        await browser.wait("document.querySelector('.game-achievement-overview .hint')?.textContent.startsWith('2 ')");
        releaseHistory.resolve();
        await browser.wait("[...document.querySelectorAll('.battle-history button')].some(n=>n.textContent==='Cập nhật nhật ký')");
        assert.equal(await browser.evaluate("document.querySelectorAll('.battle-history .battle-log-day').length"), 0, 'a stale page is not appended');
        control.readGates.clear(); await browser.click('Cập nhật nhật ký', '.battle-history button');
        await browser.wait("!!document.querySelector('[data-sequence=\"9\"]')");
        assert.equal(control.posts.length, 0, 'history inspection never mutates game');
        assert.deepEqual(browser.errors, []);
    } finally { releaseGame.resolve(); releaseHistory.resolve(); await close(browser, server); }
});

test('saved sets retain exact older editions and retry an ambiguous save once without reintroducing weapons', options, async () => {
    const control = fixture(); edition(control, 'preset_browser_old'); edition(control, 'preset_browser_new', 2, 2);
    control.game.rewards = [{ kind: 'weapon', id: 'thach-tam' }];
    const { browser, server } = await start(control);
    try {
        await prepare(browser); await inspectLoadout(browser, 'kiem-y', 'preset_browser_old');
        await browser.evaluate("document.querySelector('.battle-presets').open=true");
        await browser.wait("!document.querySelector('.battle-presets input').disabled");
        await browser.evaluate("document.querySelector('.battle-presets input').value='Giữ thế thủ'");
        control.presetAckOutage = true; await browser.click('Lưu bộ');
        await browser.wait("document.querySelector('.battle-presets').innerText.includes('Thử lại')");
        assert.equal(control.presets.presets.length, 1); await browser.click('Thử lại');
        await browser.wait("document.querySelector('.battle-presets').innerText.includes('Đã lưu bộ chiêu')");
        assert.equal(control.presetRequests[0].id, control.presetRequests[1].id);
        assert.equal(control.posts.filter(post => post.path === 'game-presets').length, 1);
        assert.deepEqual(control.presets.presets[0].versions, ['preset_browser_old']); assert.equal(control.presets.presets[0].weaponId, null);
        await browser.tap('[data-sheet-close]'); await prepare(browser);
        await browser.evaluate("document.querySelector('.battle-presets').open=true"); await browser.wait("!document.querySelector('.battle-presets select').disabled");
        await browser.evaluate("(() => {const p=document.querySelector('.battle-presets select');p.value=p.options[1].value;p.dispatchEvent(new Event('change'));})()");
        await browser.click('Áp dụng'); await browser.wait("document.querySelector('.battle-loadout-chip')?.dataset.versionId==='preset_browser_old'");
        control.presets.version++;
        await browser.evaluate("document.querySelector('.battle-presets input').value='Nháp giữ lại'");
        await browser.click('Cập nhật'); await browser.wait("document.querySelector('#sheet-feedback')?.textContent.includes('Bộ chiêu đã thay đổi')");
        assert.equal(await browser.evaluate("document.querySelector('.battle-presets input').value"), 'Nháp giữ lại');
        assert.equal(await browser.evaluate("document.querySelector('.battle-loadout-chip').dataset.versionId"), 'preset_browser_old');
        assert.deepEqual(control.game.rewards, [{ kind: 'weapon', id: 'thach-tam' }]); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('preparation has a bounded checkbox draft, lazy effects, exact editions and accessible fixed actions', options, async () => {
    const control = fixture(), skills = ['kiem-y', 'huyen-quy', 'kim-than', 'thon-thien', 'quan-thien', 'lien-van'];
    skills.forEach((id, index) => edition(control, 'draft_edition_' + index, 1, 1, id));
    control.game.owned = [...new Set([...control.game.owned, ...skills])];
    const { browser, server } = await start(control, 320);
    try {
        await prepare(browser);
        assert.equal(control.calls.filter(call => call === 'GET game-technique').length, 0, 'Effects are not loaded for every draft row');
        await selectLoadout(browser, skills.slice(0, 5));
        assert.equal(await browser.evaluate("document.querySelectorAll('.battle-loadout-chip').length"), 5);
        assert.equal(await browser.evaluate("document.querySelector('[data-loadout-technique=lien-van] input').disabled"), true);
        await browser.evaluate("document.querySelector('[data-loadout-technique=lien-van] input').click()");
        assert.equal(await browser.evaluate("document.querySelectorAll('.battle-loadout-chip').length"), 5);
        await browser.evaluate("document.querySelector('[data-loadout-technique=thon-thien] input').click();document.querySelector('[data-loadout-technique=lien-van] input').click()");
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.battle-loadout-chip')].map(n=>n.dataset.versionId)"),
            ['draft_edition_0', 'draft_edition_1', 'draft_edition_2', 'draft_edition_4', 'draft_edition_5']);
        await inspectLoadout(browser, 'kiem-y'); await inspectLoadout(browser, 'huyen-quy');
        assert.equal(await browser.evaluate("document.querySelectorAll('.battle-loadout-inspect[open]').length"), 1, 'One technique detail at a time');
        await browser.evaluate("const q=document.querySelector('.battle-loadout-picker input[type=search]');q.value='huyen quy';q.dispatchEvent(new Event('input'))");
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.battle-loadout-row')].filter(n=>!n.hidden).map(n=>n.dataset.loadoutTechnique)"), ['huyen-quy']);
        assert.equal(control.posts.length, 0, 'Reading, changing the draft and searching cannot prepare a battle');
        await browser.resize(320, 460);
        await browser.scaleText(2); await browser.evaluate("document.querySelector('.battle-preparation').scrollTop=99999");
        assert.equal((await snapshot(browser)).overflow, false);
        await capture(browser, 'v2-loadout-320-large');
        assert.deepEqual(await browser.evaluate("(() => {const close=document.querySelector('[data-sheet-close]').getBoundingClientRect(),action=document.querySelector('.battle-preparation-footer .primary').getBoundingClientRect();return {close:close.top>=0&&close.bottom<=innerHeight,action:action.top>=0&&action.bottom<=innerHeight}})()"), {close:true,action:true});
        await browser.scaleText(); await browser.evaluate("document.documentElement.dataset.theme='dark'"); await browser.resize(390, 844);
        await capture(browser, 'v2-loadout-390-dark');
        await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!document.querySelector('#sheet').open");
        assert.deepEqual(control.game.battles[0].state.loadout.map(value => value.versionId),
            ['draft_edition_0', 'draft_edition_1', 'draft_edition_2', 'draft_edition_4', 'draft_edition_5']);
        assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('one-slot exchange inspects exact editions, keeps combat state and cannot submit a stale draft', options, async () => {
    const control = fixture();
    for (const id of ['vo-mon', 'kiem-y', 'huyen-quy', 'kim-than']) edition(control, 'exchange_' + id, 1, 1, id);
    edition(control, 'exchange_huyen_new', 2, 2, 'huyen-quy');
    control.game.owned = [...new Set([...control.game.owned, 'vo-mon', 'huyen-quy', 'kim-than'])];
    const { browser, server } = await start(control, 320);
    try {
        await prepare(browser); await selectLoadout(browser, ['vo-mon', 'kiem-y']);
        await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!document.querySelector('#sheet').open");
        const battle = control.game.battles[0], run = control.battleRuns.get(battle.id);
        run.state = resolveBattleTurn(run.state, { techniqueId: 'vo-mon', acceptCost: false,
            contribution: { habits: 0, tasks: 0 } }).state;
        battle.state = publicBattleState(run.state); battle.status = 'active'; battle.version++;
        control.game.current = control.game.pending; control.game.pending = null; control.game.day.day++;
        control.game.version++; control.game.settledThrough = control.game.day.day - 1;
        const before = structuredClone(run.state), writes = control.posts.length;
        await refresh(browser); await browser.click('Đổi một ô công pháp');
        await browser.wait("!!document.querySelector('.battle-loadout-picker')");
        assert.equal(await browser.evaluate("document.querySelector('.battle-preparation-footer button').disabled"), true);
        await selectLoadout(browser, ['huyen-quy']);
        assert.equal(await browser.evaluate("document.querySelector('[data-loadout-technique=kim-than] input').disabled"), true);
        await inspectLoadout(browser, 'huyen-quy', 'exchange_huyen-quy');
        await browser.evaluate("document.querySelector('.battle-preparation select').value='kiem-y'");
        assert.equal(control.posts.length, writes);
        control.game.version++; await refresh(browser);
        await browser.click('Đổi công pháp', '.battle-preparation-footer button');
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.posts.length, writes, 'A refreshed game invalidates the old exchange draft');
        assert.deepEqual(run.state, before);
        await browser.click('Đổi một ô công pháp'); await browser.wait("!!document.querySelector('.battle-loadout-picker')");
        await selectLoadout(browser, ['huyen-quy']); await inspectLoadout(browser, 'huyen-quy', 'exchange_huyen-quy');
        await browser.evaluate("document.querySelector('.battle-preparation select').value='kiem-y';document.documentElement.dataset.theme='dark'");
        await browser.resize(320, 460);
        await browser.scaleText(2); await browser.evaluate("document.querySelector('.battle-preparation').scrollTop=99999");
        assert.equal((await snapshot(browser)).overflow, false);
        await capture(browser, 'v2-exchange-320-dark');
        assert.deepEqual(await browser.evaluate("(() => {const c=document.querySelector('[data-sheet-close]').getBoundingClientRect(),a=document.querySelector('.battle-preparation-footer button').getBoundingClientRect();return {close:c.top>=0&&c.bottom<=innerHeight,action:a.top>=0&&a.bottom<=innerHeight}})()"), { close:true, action:true });
        await browser.click('Đổi công pháp', '.battle-preparation-footer button');
        await browser.wait("!document.querySelector('#sheet').open");
        assert.deepEqual(run.state.loadout.map(value => value.versionId), ['exchange_vo-mon', 'exchange_huyen-quy']);
        assert.equal(run.state.exchangeAfterTurn, null);
        for (const key of ['turn', 'player', 'statuses', 'guard', 'illusion', 'seals', 'rescueUsed']) assert.deepEqual(run.state[key], before[key], key);
        assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('every encounter, chapter scene and technique identity loads through real redesigned screens', { ...options, timeout: 180000 }, async () => {
    const control = fixture();
    control.game.victories = GAME_BOSSES.map(boss => boss.id); control.game.owned = TECHNIQUES.map(technique => technique.id);
    control.game.learned = [...control.game.owned]; const { browser, server } = await start(control, 360);
    try {
        await browser.click('Công pháp', '.game-navigation button');
        const schools = await browser.evaluate("[...document.querySelectorAll('[data-school-id]')].map(node=>node.dataset.schoolId)"), identities = [];
        assert.equal(schools.length, 7);
        for (const id of schools) {
            await browser.evaluate(`document.querySelector('[data-school-id="${id}"]').click()`);
            const count = await browser.evaluate("document.querySelectorAll('.technique-symbol').length");
            for (let index = 0; index < count; index++) {
                await browser.evaluate(`document.querySelectorAll('.technique-symbol')[${index}].scrollIntoView({block:'center'})`);
                await browser.wait(`document.querySelectorAll('.technique-symbol')[${index}].complete&&document.querySelectorAll('.technique-symbol')[${index}].naturalWidth>0`);
            }
            identities.push(...await browser.evaluate("[...document.querySelectorAll('[data-technique-id]')].map(node=>node.dataset.techniqueId)"));
            await browser.click('‹ Các phái');
        }
        assert.deepEqual(identities.sort(), TECHNIQUES.map(technique=>technique.id).sort());
        await browser.click('Thử thách', '.game-navigation button');
        const evidence = [];
        for (const [index, boss] of GAME_BOSSES.entries()) {
            control.game.victories = GAME_BOSSES.filter(value => value.id !== boss.id).map(value => value.id);
            await refresh(browser);
            const selector = '.floor-row[data-boss-id="' + boss.id + '"] button,.opportunity-row[data-boss-id="' + boss.id + '"] button';
            await browser.evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});n.closest('details')?.setAttribute('open','');n.click();})()`);
            await browser.wait("!!document.querySelector('.battle-preparation-footer>.primary') && document.querySelector('.battle-preparation-art')?.naturalWidth>0");
            assert.equal(await browser.evaluate("new URL(document.querySelector('.battle-preparation-art').src).pathname"), '/app/assets/than-lo/' + boss.artId + '.webp');
            assert.equal((await snapshot(browser)).overflow, false, boss.id);
            assert.equal(await browser.evaluate("(() => {const r=document.querySelector('[data-sheet-close]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), true);
            evidence.push({ bossId: boss.id, artId: boss.artId });
            if (process.env.UI_SCREENSHOT_DIR) await capture(browser, 'cultivation-boss-' + boss.id);
            await browser.tap('[data-sheet-close]');
        }
        control.game.victories = GAME_BOSSES.map(boss => boss.id); await refresh(browser);
        await browser.evaluate("document.querySelector('.game-chapter-archive').open=true");
        for (const chapter of GAME_CHAPTERS) {
            await browser.click('Chương ' + chapter.number + ' · ' + chapter.name);
            await browser.wait("document.querySelector('.game-story-scene')?.naturalWidth>0");
            assert.equal(await browser.evaluate("new URL(document.querySelector('.game-story-scene').src).pathname"), '/app/assets/than-lo/' + chapter.scene + '.webp');
            await browser.evaluate("document.querySelectorAll('.game-story-people img').forEach(image=>image.loading='eager')");
            await browser.wait("[...document.querySelectorAll('.game-story-people img')].every(image=>image.naturalWidth>0)");
            assert.match(await browser.evaluate("document.querySelector('.battle-history').innerText"), /Sau hành trình/);
            assert.equal((await snapshot(browser)).overflow, false); await capture(browser, 'cultivation-story-' + chapter.number);
            await browser.tap('[data-sheet-close]');
        }
        assert.equal(control.posts.length, 0, 'Previewing every image and story must not grant rewards or write logs');
        assert.deepEqual(browser.errors, []); assert.equal(evidence.length, 40);
    } finally { await close(browser, server); }
});


test('v2 current and upgrades keep one headline, real benefits and reachable sheet actions on mobile', options, async () => {
    const control = fixture();
    let practice = newTimePracticeVersion('visual_v2_edition', 'kiem-y', control.game.day.day - 9);
    for (let offset = 0; offset < 9; offset++) practice = settlePracticeDay(practice.createdDay + offset, practice.id, [practice], [],
        [{ habitId: 'reading', successes: 1, misses: 0, mature: true, weekly: null, cadence: { kind: 'daily' } }]).versions[0];
    const stored = { practice, maintained: true, version: 1, created: now };
    control.practiceVersions.push(stored); control.game.current = { ...control.game.current, mode: 'practice', practiceId: practice.id };
    control.game.currentPractice = stored;
    const { browser, server } = await start(control, 360);
    try {
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.game-navigation button')].map(n=>n.textContent)"), ['Hiện tại', 'Công pháp', 'Thử thách', 'Thành tựu']);
        assert.equal(await browser.evaluate("document.querySelectorAll('.cultivation-current .cultivation-damage strong').length"), 1);
        assert.equal(await browser.evaluate("document.querySelector('.cultivation-current .cultivation-damage strong').textContent"), '129');
        assert.match((await snapshot(browser)).text, /Độ thuần khiết[\s\S]*50%/);
        await capture(browser, 'v2-current-360-light');
        await browser.click('Xem công pháp'); await browser.wait("!!document.querySelector('.technique-detail-tabs')");
        await browser.click('Nâng cấp', '.technique-detail-tabs button');
        await browser.wait("!!document.querySelector('.technique-upgrade-table')");
        assert.match(await browser.evaluate("document.querySelector('.technique-upgrade-table').innerText"), /Xuyên Phòng thủ/);
        assert.match(await browser.evaluate("document.querySelector('.technique-upgrade-table').innerText"), /40 %[\s\S]*45 %/);
        for (const width of [320, 360, 390, 1440]) for (const theme of ['light', 'dark']) {
            await browser.resize(width, 620);
            await browser.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
            assert.equal((await snapshot(browser)).overflow, false, 'upgrade/' + width);
            await capture(browser, 'v2-upgrade-' + width + '-' + theme);
        }
        await browser.resize(320, 460);
        await browser.scaleText(2); await browser.evaluate("document.querySelector('.technique-sheet').scrollTop=99999");
        assert.deepEqual(await browser.evaluate("(() => {const close=document.querySelector('[data-sheet-close]').getBoundingClientRect(), action=document.querySelector('.technique-sheet-footer button').getBoundingClientRect(); return {close:close.top>=0&&close.bottom<=innerHeight,action:action.top>=0&&action.bottom<=innerHeight}})()"), {close:true,action:true});
        await capture(browser, 'v2-upgrade-320-large');
        await browser.scaleText(); await browser.evaluate("document.documentElement.dataset.theme='dark'");
        await capture(browser, 'v2-upgrade-320-dark');
        await browser.press('Escape'); await prepare(browser);
        assert.match(await browser.evaluate("document.querySelector('[data-loadout-technique=kiem-y] small').textContent"), /Tầng 2 · Thuần khiết 50%/);
        await capture(browser, 'v2-preparation-320-dark');
        assert.deepEqual(browser.errors, []); assert.equal(control.posts.length, 0);
    } finally { await close(browser, server); }
});

test('v2 library is school-first, searches without accents and keeps historical editions read-only', options, async () => {
    const control = fixture(), first = edition(control, 'retained_edition'), archived = edition(control, 'archived_edition', 2, 2);
    first.maintained = true; archived.maintained = false;
    const { browser, server } = await start(control);
    try {
        await browser.click('Công pháp', '.game-navigation button');
        await browser.tap('[data-school-id=thien-kiem]');
        await browser.evaluate("const s=document.querySelector('.game-library input');s.value='kiem y';s.dispatchEvent(new Event('input'))");
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('[data-technique-id]')].map(n=>n.dataset.techniqueId)"), ['kiem-y']);
        await browser.tap('[data-technique-id=kiem-y]'); await browser.wait("!!document.querySelector('.technique-edition-details')");
        await browser.evaluate("document.querySelector('.technique-edition-details').open=true");
        await browser.wait("document.querySelector('.practice-version-history')?.textContent.includes('Lịch sử')");
        await browser.evaluate("[...document.querySelectorAll('.practice-version-history button')].find(n=>n.textContent.includes('Lịch sử')).click()");
        await browser.wait("document.querySelector('.technique-sheet select')?.value==='archived_edition'");
        assert.match(await browser.evaluate("document.querySelector('.technique-sheet').innerText"), /Bản lịch sử · chỉ xem/);
        assert.equal(await browser.evaluate("[...document.querySelectorAll('.technique-sheet-footer button')].some(n=>n.textContent==='Luyện bản 2')"), false);
        await capture(browser, 'v2-historical-390');
        await browser.press('Escape'); await prepare(browser);
        await inspectLoadout(browser, 'kiem-y');
        assert.equal(await browser.evaluate("!!document.querySelector('.battle-loadout-editor input[value=archived_edition]')"), false);
        assert.equal(await browser.evaluate("document.querySelector('.battle-loadout-chip').dataset.versionId"), 'retained_edition');
        assert.equal(control.posts.length, 0); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});
