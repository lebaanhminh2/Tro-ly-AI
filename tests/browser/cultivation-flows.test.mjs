import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { browserBin, fixture, serve, chrome, snapshot, clone, now } from './app-harness.mjs';
import { newPracticeVersion, settlePracticeDay } from '../../src/domain/practice.ts';
import { GAME_BOSSES, GAME_CHAPTERS, bossById } from '../../src/domain/game-content.ts';
import { TECHNIQUES } from '../../src/domain/techniques.ts';
import { publicBattleState } from '../../src/domain/battle.ts';
import { rescueQuote } from '../../src/domain/battle-economy.ts';

const options = { skip: !browserBin, timeout: 90000 };
const floors = GAME_BOSSES.filter(boss => !boss.kind || boss.kind === 'main');
function edition(control, id, count = 1, number = 1) {
    let practice = newPracticeVersion(id, 'kiem-y', control.game.day.day - 40, 1000, number), weeks = [], day = practice.createdDay;
    while (practice.tiers.length < count) {
        const result = settlePracticeDay(day++, id, [practice], weeks, [{ habitId: 'fixture_reading', successes: 1, misses: 0, mature: true, weekly: null }]);
        practice = result.versions[0]; weeks = result.weeks;
    }
    const stored = { practice, version: 1, created: now };
    control.practiceVersions.push(stored); control.game.learned = ['kiem-y']; return stored;
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
    await browser.click('Vượt tầng', '.game-navigation button');
    await browser.evaluate("document.querySelector('.floor-next button').click()");
    await browser.wait("!!document.querySelector('.battle-preparation>.primary')");
}
async function capture(browser, name) {
    if (process.env.UI_SCREENSHOT_DIR) await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, name + '.png'));
}

test('cultivation keeps four fixed sections, sealed clues and mobile hierarchy without automatic writes', options, async () => {
    const control = fixture(), { browser, server } = await start(control);
    try {
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.game-navigation button')].map(n=>n.textContent)"), ['Hiện tại', 'Công pháp', 'Vượt tầng', 'Thành tựu']);
        assert.doesNotMatch((await snapshot(browser)).text, /Thần binh|Sưu tập/);
        for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
            await browser.resize(width, 844); await browser.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
            for (const label of ['Hiện tại', 'Công pháp', 'Vượt tầng', 'Thành tựu']) {
                await browser.click(label, '.game-navigation button');
                assert.equal((await snapshot(browser)).overflow, false, label + '/' + width + '/' + theme);
                await capture(browser, 'cultivation-' + label + '-' + width + '-' + theme);
            }
        }
        await browser.resize(320, 600); await browser.evaluate("document.documentElement.style.fontSize='200%'");
        for (const label of ['Hiện tại', 'Công pháp', 'Vượt tầng', 'Thành tựu']) {
            await browser.click(label, '.game-navigation button'); assert.equal((await snapshot(browser)).overflow, false, label + ' large text');
        }
        await browser.evaluate("document.documentElement.style.fontSize=''");
        await browser.click('Công pháp', '.game-navigation button'); await browser.click('Khám phá');
        assert.equal(await browser.evaluate("!!document.querySelector('.game-sealed-clue')"), true);
        assert.equal(await browser.evaluate("!!document.querySelector('[data-technique-id=thau-thien]')"), false);
        await browser.evaluate("document.querySelector('.game-library input').value='kiem y';document.querySelector('.game-library input').dispatchEvent(new Event('input'))");
        assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.technique-book')].map(n=>n.dataset.techniqueId)"), ['kiem-y']);
        await browser.click('Vượt tầng', '.game-navigation button');
        assert.equal(await browser.evaluate("document.querySelector('.floor-next').innerText.includes('TẦNG 01')"), true);
        assert.equal(await browser.evaluate("document.querySelector('[data-boss-id=song-nha]').innerText.includes('Song Nha')"), false);
        assert.equal(control.posts.length, 0); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('practice applies next day and a confirmed restart preserves every locked tier and existing work', options, async () => {
    const control = fixture(), account = clone(control.state.account), tasks = clone(control.state.tasks), { browser, server } = await start(control);
    try {
        await browser.click('Công pháp', '.game-navigation button'); await browser.tap('[data-technique-id=kiem-y]');
        await browser.wait("!!document.querySelector('.technique-sheet button.primary')"); await browser.click('Bắt đầu luyện');
        await browser.wait("!!document.querySelector('.game-pending')");
        assert.equal(control.game.current.mode, 'idle'); assert.equal(control.game.pending.fromDay, control.game.day.day + 1);
        const stored = control.practiceVersions[0];
        const locked = edition(control, 'practice_earned_tier'); control.practiceVersions.pop();
        stored.practice = { ...locked.practice, id: stored.practice.id, edition: stored.practice.edition };
        stored.practice.progressMilli = 6000; stored.practice.effortMilli = 6000; stored.practice.pendingWeeks = ['fixture_week'];
        control.game.current = control.game.pending; control.game.currentPractice = stored; control.game.pending = null; control.game.pendingPractice = null;
        control.game.day.day++; control.game.settledThrough = control.game.day.day - 1;
        await refresh(browser); await browser.wait("document.querySelector('.practice-card')?.innerText.includes('Chờ cam kết tuần')");
        const old = clone(stored.practice);
        await browser.click('Chi tiết & bản luyện'); await browser.wait("!!document.querySelector('.practice-version-row')");
        await browser.resize(320, 460); await browser.evaluate("document.querySelector('.technique-sheet').scrollTop=9999");
        assert.equal(await browser.evaluate("(() => {const r=document.querySelector('[data-sheet-close]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"), true);
        await browser.click('Luyện một bản mới'); assert.equal(control.practiceVersions.length, 1);
        await browser.click('Xác nhận'); await browser.wait("!!document.querySelector('.game-pending')");
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
        await browser.click('Đổi bộ chiêu'); await browser.wait("!!document.querySelector('.battle-loadout-form')");
        await browser.evaluate("document.querySelector('.battle-version-picker').open=true");
        await browser.wait("!!document.querySelector('.battle-edition-row button:not([disabled])')");
        await browser.evaluate("document.querySelector('.battle-edition-row button:not([disabled])').click();document.querySelector('.battle-loadout-customize').open=true;document.querySelector('.battle-loadout-form select').value='browser_edition_old';document.querySelector('.battle-loadout-form select').dispatchEvent(new Event('change'))");
        await browser.click('Lưu bộ chiêu'); await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(control.game.battles.length, 1); assert.equal(battle.id, id); assert.equal(battle.startsDay, starts);
        assert.equal(battle.state.loadout[0].versionId, first.practice.id); assert.equal(battle.version, 2);
        assert.deepEqual(control.posts.filter(post => post.path === 'game').map(post => post.input.operation), ['prepare_battle', 'update_prepared_battle']);
        await browser.click('Đổi bộ chiêu'); await browser.wait("!!document.querySelector('.battle-loadout-form')");
        control.game.version++;
        await browser.evaluate("document.querySelector('.battle-loadout-form select').value='browser_edition_new';document.querySelector('.battle-loadout-form select').dispatchEvent(new Event('change'))");
        await browser.click('Lưu bộ chiêu'); await browser.wait("document.querySelector('#sheet-feedback')?.textContent.includes('Tiến trình đã thay đổi')");
        assert.equal(battle.state.loadout[0].versionId, first.practice.id); assert.equal(battle.version, 2);
        assert.equal(await browser.evaluate("document.querySelector('.battle-loadout-form select').value"), second.practice.id); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('daily battle choice remains pending, read stance explains penalties, and rescue shows the actual cost', options, async () => {
    const control = fixture(); edition(control, 'battle_choice_edition'); const { browser, server } = await start(control);
    try {
        await prepare(browser); await browser.click('Chuẩn bị xuất chiến'); await browser.wait("!!document.querySelector('.battle-card') && !document.querySelector('#sheet').open");
        const battle = control.game.battles[0], run = control.battleRuns.get(battle.id);
        control.game.current = control.game.pending; control.game.pending = null; control.game.day.day++; control.game.settledThrough = control.game.day.day - 1;
        battle.status = 'active';
        await refresh(browser); await browser.wait("!!document.querySelector('.battle-choices')");
        await browser.evaluate("document.documentElement.dataset.theme='dark'");
        await browser.wait("getComputedStyle(document.querySelector('[data-choice-id=vo-ky]')).backgroundColor==='rgb(34, 33, 45)'");
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[data-choice-id=vo-ky]')).color"), 'rgb(238, 231, 221)');
        await browser.click('Võ Kỹ'); await browser.wait("document.querySelector('[data-choice-id=vo-ky]')?.getAttribute('aria-pressed')==='true'");
        assert.equal(run.state.turn, 0); assert.equal(control.game.choices[0].techniqueId, 'vo-ky');
        const hp = run.state.player.hp;
        await browser.click('Kiếm Ý'); await browser.wait("document.querySelector('[data-choice-id=kiem-y]')?.getAttribute('aria-pressed')==='true'");
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
        await browser.click('Xác nhận'); await browser.wait("!!document.querySelector('.battle-choices')");
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#sheet')).display"), 'none');
        assert.equal(control.state.account.state.qi, before - cost); assert.equal(run.state.rescueUsed, true); assert.deepEqual(browser.errors, []);
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
        await browser.tap('[data-sheet-close]'); await browser.click('Công pháp', '.game-navigation button'); await browser.click('Khám phá');
        assert.equal(await browser.evaluate("!!document.querySelector('[data-technique-id=thau-thien]')"), false);
        wins(control, 8); await refresh(browser); await browser.wait("!!document.querySelector('[data-technique-id=thau-thien]')");
        assert.ok(control.calls.filter(call => call === 'GET game-catalog').length >= 2, 'Refresh player-specific catalog after unlock/discovery');
        await browser.evaluate("document.querySelector('[data-technique-id=thau-thien]').scrollIntoView({block:'center'})");
        await browser.tap('[data-technique-id=thau-thien]'); await browser.wait("!!document.querySelector('.technique-sources')");
        assert.match(await browser.evaluate("document.querySelector('#sheet').innerText"), /Người Đoạt Huyết/);
        assert.equal(control.practiceVersions.length, 0, 'Discovering or winning does not grant a ready edition');
        assert.equal(control.posts.length, 0); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('saved sets retain exact older editions and retry an ambiguous save once without reintroducing weapons', options, async () => {
    const control = fixture(); edition(control, 'preset_browser_old'); edition(control, 'preset_browser_new', 2, 2);
    control.game.rewards = [{ kind: 'weapon', id: 'thach-tam' }];
    const { browser, server } = await start(control);
    try {
        await prepare(browser); await browser.evaluate("document.querySelector('.battle-version-picker').open=true");
        await browser.wait("!!document.querySelector('.battle-edition-row button:not([disabled])')");
        await browser.evaluate("document.querySelector('.battle-edition-row button:not([disabled])').click();document.querySelector('.battle-loadout-form select').value='preset_browser_old';document.querySelector('.battle-loadout-form select').dispatchEvent(new Event('change'));document.querySelector('.battle-presets').open=true");
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
        await browser.click('Áp dụng'); await browser.wait("document.querySelector('.battle-loadout-form select').value==='preset_browser_old'");
        control.presets.version++;
        await browser.evaluate("document.querySelector('.battle-presets input').value='Nháp giữ lại'");
        await browser.click('Cập nhật'); await browser.wait("document.querySelector('#sheet-feedback')?.textContent.includes('Bộ chiêu đã thay đổi')");
        assert.equal(await browser.evaluate("document.querySelector('.battle-presets input').value"), 'Nháp giữ lại');
        assert.equal(await browser.evaluate("document.querySelector('.battle-loadout-form select').value"), 'preset_browser_old');
        assert.deepEqual(control.game.rewards, [{ kind: 'weapon', id: 'thach-tam' }]); assert.deepEqual(browser.errors, []);
    } finally { await close(browser, server); }
});

test('every encounter, chapter scene and technique identity loads through real redesigned screens', { ...options, timeout: 180000 }, async () => {
    const control = fixture();
    control.game.victories = GAME_BOSSES.map(boss => boss.id); control.game.owned = TECHNIQUES.map(technique => technique.id);
    control.game.learned = [...control.game.owned]; const { browser, server } = await start(control, 360);
    try {
        await browser.click('Công pháp', '.game-navigation button');
        assert.equal(await browser.evaluate("document.querySelectorAll('.technique-symbol').length"), 39);
        for (let index = 0; index < 39; index++) {
            await browser.evaluate(`document.querySelectorAll('.technique-symbol')[${index}].scrollIntoView({block:'center'})`);
            await browser.wait(`document.querySelectorAll('.technique-symbol')[${index}].complete&&document.querySelectorAll('.technique-symbol')[${index}].naturalWidth>0`);
        }
        assert.equal(await browser.evaluate("new Set([...document.querySelectorAll('.technique-symbol')].map(image=>new URL(image.src).pathname)).size"), 39);
        await browser.click('Vượt tầng', '.game-navigation button');
        const evidence = [];
        for (const [index, boss] of GAME_BOSSES.entries()) {
            control.game.victories = GAME_BOSSES.filter(value => value.id !== boss.id).map(value => value.id);
            await refresh(browser);
            const selector = '.floor-row[data-boss-id="' + boss.id + '"] button,.opportunity-row[data-boss-id="' + boss.id + '"] button';
            await browser.evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});n.closest('details')?.setAttribute('open','');n.click();})()`);
            await browser.wait("!!document.querySelector('.battle-preparation>.primary') && document.querySelector('.battle-preparation-art')?.naturalWidth>0");
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
