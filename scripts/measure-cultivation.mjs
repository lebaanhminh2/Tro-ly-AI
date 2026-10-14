import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chrome, fixture, serve } from '../tests/browser/app-harness.mjs';
import { newTimePracticeVersion } from '../src/domain/practice-progression.ts';
import { settlePracticeDay } from '../src/domain/practice.ts';

// Browser transport/render evidence only. Fixture APIs have no Worker or D1
// latency; storage budgets are measured separately through Miniflare.
const output = resolve(process.argv[2] ?? '.wrangler/cultivation-v2-performance.json');
const samples = 5, reports = [];
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['web/features/game.js', 'web/views/game.js', 'web/ui/technique-profile.js', 'web/ui/game-art.js',
    'web/styles.css', 'web/core/lifecycle.js', 'tests/browser/app-harness.mjs', 'scripts/measure-cultivation.mjs'];
const sources = await Promise.all(files.map(async file => ({ file,
    sha256: createHash('sha256').update(await readFile(resolve(root, file))).digest('hex') })));
const arm = async (browser, predicate) => browser.evaluate(`(() => {
    window.__cultivationMeasure = { start: null, shell: null, ready: null };
    const state = window.__cultivationMeasure;
    const observer = new MutationObserver(() => {
        if (state.start === null) return;
        if (state.shell === null && document.querySelector('.game-page')) state.shell = performance.now();
        if (${predicate}) { state.ready = performance.now(); observer.disconnect(); }
    });
    observer.observe(document.querySelector('#content'), { childList:true, subtree:true });
    document.addEventListener('pointerdown', () => { state.start=performance.now(); }, { once:true });
})()`);
const timing = async browser => browser.evaluate(`(() => {
    const m=window.__cultivationMeasure;
    return { shellMs:m.shell-m.start, contentMs:m.ready-m.start,
        elapsedMs:performance.now()-m.start,
        resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,
            transferBytes:r.transferSize,bodyBytes:r.encodedBodySize,durationMs:r.duration})) };
})()`);
for (let sample = 0; sample < samples; sample++) {
    const control = fixture();
    let practice = newTimePracticeVersion('performance_edition', 'kiem-y', control.game.day.day - 9);
    for (let offset = 0; offset < 9; offset++) practice = settlePracticeDay(practice.createdDay + offset, practice.id, [practice], [],
        [{ habitId:'reading', successes:1, misses:0, mature:true, cadence:{kind:'daily'}, weekly:null }]).versions[0];
    const stored = { practice, maintained:true, version:1, created:control.state.now };
    control.practiceVersions.push(stored);
    control.game.current = { ...control.game.current, mode:'practice', practiceId:practice.id };
    control.game.currentPractice = stored;
    const server = await serve(control), browser = await chrome();
    try {
        await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.networkConditions(false, 150, 102400);
        await browser.evaluate('performance.clearResourceTimings()');
        await arm(browser, "!!document.querySelector('.cultivation-current')");
        await browser.tap('[data-tab=game]');
        await browser.wait('window.__cultivationMeasure.ready !== null');
        await browser.wait("[...document.querySelectorAll('#content img')].filter(i=>i.getBoundingClientRect().top<innerHeight&&i.getBoundingClientRect().bottom>0).every(i=>i.complete&&i.naturalWidth>0)");
        const cold = await timing(browser);
        await browser.click('Công pháp', '.game-navigation button');
        await browser.wait("!!document.querySelector('[data-school-id=thien-kiem]')");
        await browser.tap('[data-school-id=thien-kiem]');
        await browser.wait("!!document.querySelector('[data-technique-id=kiem-y]')");
        await browser.tap('[data-tab=today]');
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        const before = control.calls.length;
        await browser.evaluate('performance.clearResourceTimings()');
        await arm(browser, "!!document.querySelector('[data-technique-id=kiem-y]')");
        await browser.tap('[data-tab=game]');
        await browser.wait('window.__cultivationMeasure.ready !== null');
        const warm = await timing(browser);
        const detailStart = await browser.evaluate('performance.now()');
        await browser.tap('[data-technique-id=kiem-y]');
        await browser.wait("!!document.querySelector('.technique-detail-tabs')");
        const detailMs = await browser.evaluate('performance.now()') - detailStart;
        if (browser.errors.length) throw Error('BROWSER_ERRORS:' + browser.errors.join(';'));
        const row = { sample, userAgent:await browser.evaluate('navigator.userAgent'), cold, warm, detailMs,
            warmCalls:control.calls.slice(before), errors:browser.errors };
        reports.push(row);
        console.log(JSON.stringify({sample,coldShellMs:cold.shellMs,coldContentMs:cold.contentMs,
            coldAboveFoldMs:cold.elapsedMs,warmContentMs:warm.contentMs,detailMs}));
    } finally { await browser.close(); await server.close(); }
}
await mkdir(dirname(output), {recursive:true});
await writeFile(output, JSON.stringify({generatedAt:new Date().toISOString(),sources,
    environment:{viewport:[390,844],samples,latencyMs:150,bytesPerSecond:102400,cpuThrottle:'none',
        fixture:'localhost isolated browser, v2 trained edition, first game navigation cold then cached library warm; no Worker/D1 latency'},
    reports},null,2)+'\n');
