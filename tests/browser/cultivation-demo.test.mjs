import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chrome, browserBin } from './app-harness.mjs';

const options = { skip: !browserBin, timeout: 90000 };
const url = pathToFileURL(resolve('docs/prototypes/cultivation/kiem-y-demo.html')).href;
async function tapVisible(browser, selector) {
    await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await browser.tap(selector);
}
async function scenario(browser, id) {
    await browser.tap('#demo-controls');
    await browser.evaluate(`document.querySelector('#demo-scenario').value=${JSON.stringify(id)}`);
    await browser.click('Mở tình huống');
    await browser.wait("!document.querySelector('#sheet').open");
}
async function capture(browser, name) {
    await browser.wait("[...document.querySelectorAll('img')].filter(image=>{const rect=image.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth}).every(image=>image.complete&&image.naturalWidth>0)");
    if (process.env.UI_SCREENSHOT_DIR) await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, name + '.png'));
}
const overflow = "document.documentElement.scrollWidth > innerWidth + 1";

test('standalone demo opens from a local file with tier art and shared upgrade UI at mobile sizes', options, async () => {
    const browser = await chrome();
    try {
        await browser.navigate(url, 360);
        await browser.wait("!!document.querySelector('.cultivation-current')");
        assert.equal(await browser.evaluate("document.querySelector('.cultivation-current .cultivation-damage').querySelectorAll('strong').length"), 1);
        await browser.wait("document.querySelector('.technique-tier-art')?.naturalWidth > 0");
        assert.match(await browser.evaluate("document.querySelector('.technique-tier-art').src"), /technique-kiem-y-tier-2\.webp/);
        assert.equal(await browser.evaluate(overflow), false);
        await capture(browser, 'demo-current-360');
        await browser.click('Xem công pháp');
        await browser.wait("!!document.querySelector('.technique-detail-tabs')");
        await browser.click('Nâng cấp', '.technique-detail-tabs button');
        assert.match(await browser.evaluate("document.querySelector('.technique-upgrade').innerText"), /Xuyên Phòng thủ|Xuyên phòng thủ/);
        for (const width of [320, 390, 1440]) {
            await browser.resize(width, 844);
            assert.equal(await browser.evaluate(overflow), false);
        }
        await browser.resize(320, 844);
        await browser.evaluate("document.documentElement.dataset.theme='dark';document.querySelector('.settings-sheet-body').scrollTop=0");
        await capture(browser, 'demo-upgrade-320-dark');
        await browser.press('Escape');
        await browser.wait("!document.querySelector('#sheet').open");
        await browser.click('Công pháp', '.game-navigation button');
        assert.equal(await browser.evaluate("document.querySelectorAll('[data-school-id]').length"), 7);
        await tapVisible(browser, '[data-school-id=thien-kiem]');
        await browser.evaluate("const q=document.querySelector('.game-library input');q.value='kiem y';q.dispatchEvent(new Event('input'))");
        assert.equal(await browser.evaluate("document.querySelectorAll('[data-technique-id]').length"), 1);
        const network = await browser.evaluate("fetch('https://example.com/api/game').then(()=>false,()=>true)");
        assert.equal(network, true, 'the local demo cannot fall through to live services');
        assert.deepEqual(browser.errors, []);
    } finally { await browser.close(); }
});

test('standalone demo performs real day settlement, victory records and guarded rescue through shared actions', options, async () => {
    const browser = await chrome();
    try {
        await browser.navigate(url, 390); await browser.wait("!!document.querySelector('.cultivation-current')");
        await scenario(browser, 'prepared');
        assert.match(await browser.evaluate('document.querySelector("main").innerText'), /Xuất chiến từ|Bắt đầu từ/);
        await browser.tap('#demo-advance');
        await browser.wait("!!document.querySelector('[data-write=battle-choice]')");
        await browser.click('Chọn chiêu');
        await tapVisible(browser, '[data-choice-id=kiem-y]');
        await browser.wait("!document.querySelector('.battle-choice-footer button').disabled");
        await browser.click('Chọn Kiếm Ý', '.battle-choice-footer button');
        await browser.wait("document.querySelector('main').innerText.includes('Đã chọn Kiếm Ý')");
        await browser.tap('#demo-advance');
        await browser.wait("document.querySelector('main').innerText.includes('Đã thắng')");
        await browser.click('Thành tựu', '.game-navigation button');
        assert.equal(await browser.evaluate("document.querySelectorAll('[data-victory-boss]').length"), 1);
        await browser.evaluate("document.querySelector('.game-victory').open=true");
        assert.match(await browser.evaluate("document.querySelector('.game-victory').innerText"), /Chiêu đã dùng[\s\S]*Kiếm Ý/);
        await capture(browser, 'demo-victory-390');
        await scenario(browser, 'rescue');
        await browser.wait("!!document.querySelector('.battle-rescue-actions')");
        await browser.evaluate("document.querySelector('.battle-rescue-actions .primary').click()");
        await browser.wait("document.querySelector('#sheet').open");
        assert.match(await browser.evaluate("document.querySelector('#sheet').innerText"), /quyền cứu duy nhất/);
        await browser.click('Xác nhận');
        await browser.wait("!!document.querySelector('[data-write=battle-choice]')");
        assert.equal(await browser.evaluate("!!document.querySelector('.battle-rescue-actions')"), false);
        await capture(browser, 'demo-after-rescue-390');
        await scenario(browser, 'pending');
        assert.match(await browser.evaluate("document.querySelector('main').innerText"), /chờ chốt cam kết tuần/);
        await capture(browser, 'demo-pending-390');
        for (let index = 0; index < 4; index++) await browser.tap('#demo-advance');
        await scenario(browser, 'all'); await browser.click('Công pháp', '.game-navigation button');
        await tapVisible(browser, '[data-school-id=forbidden]');
        assert.equal(await browser.evaluate("document.querySelectorAll('[data-technique-id]').length"), 8);
        await browser.scaleText(2);
        assert.equal(await browser.evaluate(overflow), false);
        assert.deepEqual(browser.errors, []);
    } finally { await browser.close(); }
});

test('demo state matrix remains readable across mobile, desktop, themes and large text', { ...options, timeout: 120000 }, async () => {
    const browser = await chrome();
    try {
        await browser.navigate(url, 360); await browser.wait("!!document.querySelector('.cultivation-current')");
        for (const width of [320, 360, 390, 1440]) for (const theme of ['light', 'dark']) {
            await browser.resize(width, 844); await browser.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
            for (const id of ['new', 'tier1', 'tier2', 'tier3', 'tier4', 'perfect', 'pending', 'retrain', 'prepared', 'battle', 'rescue', 'victory']) {
                await scenario(browser, id);
                assert.equal(await browser.evaluate(overflow), false, id + '/' + width + '/' + theme);
                await capture(browser, 'demo-state-' + id + '-' + width + '-' + theme);
            }
        }
        await browser.resize(320, 600);
        for (const id of ['perfect', 'pending', 'retrain', 'rescue']) {
            await browser.scaleText(); await scenario(browser, id); await browser.scaleText(2);
            assert.equal(await browser.evaluate(overflow), false, id + '/large');
            await capture(browser, 'demo-state-' + id + '-320-large');
            await browser.evaluate("document.querySelector('.practice-card, .battle-card').scrollIntoView({block:'start',behavior:'instant'})");
            await capture(browser, 'demo-state-' + id + '-320-large-content');
        }
        assert.deepEqual(browser.errors, []);
    } finally { await browser.close(); }
});
