import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chrome, browserBin } from './app-harness.mjs';
import {
  firstStepEvidenceDirectory,
  firstStepFixture,
  openFirstStep,
} from './first-step-fixture.mjs';
import { crop, decodePNG, png } from './first-step-images.mjs';

const run = firstStepEvidenceDirectory();
const trackIntervals =
  '<script>globalThis.__qaIntervals=[];const nativeInterval=setInterval;globalThis.setInterval=(...args)=>{const id=nativeInterval(...args);__qaIntervals.push(id);return id;};</script>';
const cases = [
  ['idle', 'idle'],
  ['running', 'running'],
  ['ready', 'ready'],
  ['outside', 'confirm'],
  ['cancel', 'stop'],
  ['reward', 'reward'],
  ['blue', 'idle', 0.4],
  ['gold', 'idle', 2 / 3],
  ['pass', 'idle', 29 / 30],
  ...[0, 0.1, 0.2, 0.3, 0.55, 0.78, 1].map((q) => ['launch-' + q, 'launch', 1, q]),
];

async function normalize(browser) {
  return browser.evaluate(`(()=>{
    for(const id of globalThis.__qaIntervals??[])clearInterval(id);
    const node=document.querySelector('#pb-entry'),r=node.getBoundingClientRect();
    const geometry={width:r.width,height:r.height};
    // Normalize only capture origin, after measuring natural geometry. The two
    // surrounding pages have different heights; neither card's style is masked.
    node.style.cssText+=';position:fixed;left:22px;top:180px;margin:0;width:'+r.width+'px;z-index:90';
    return geometry;
  })()`);
}
async function prepare(browser, kind, state, progress, release, theme) {
  return browser.evaluate(`(async()=>{
    document.documentElement.dataset.theme=${JSON.stringify(theme)};
    const entry=document.querySelector('#pb-entry'),now=Date.now();
    const active=${['launch', 'running', 'ready', 'stop'].includes(state)}?{id:'visual_occurrence',endsAt:now+300000}:null;
    ${
      kind === 'demo'
        ? `
      pbCancelHold();pbDropMeteor();pbData.active=active;pbView=${JSON.stringify(state)};
      entry.dataset.state=${JSON.stringify(state)};entry.innerHTML=pbInner(${JSON.stringify(state)});
      entry.querySelector('.pb-clock')?.replaceChildren('05:00');
      ${progress !== undefined ? `pbMakeMeteor();pbDrawMeteor(pbMeteor,${progress},0,${release ?? 'null'});` : ''}
    `
        : `
      globalThis.__qaMotion?.clear();
      const {firstStepInner}=await import('./views/first-step.js');
      const {createFirstStepMotion}=await import('./ui/first-step-motion.js');
      entry.dataset.state=${JSON.stringify(state)};entry.innerHTML=firstStepInner(${JSON.stringify(state)},active,now);
      globalThis.__qaMotion=createFirstStepMotion(()=>entry,()=>({coin:1,ticket:1}));
      ${progress !== undefined ? `const scene=__qaMotion.begin();__qaMotion.draw(scene,${progress},0,${release ?? 'null'});` : ''}
    `
    }
    // Stop confirmation text uses the same not-yet-expired active timer.
    return {card:entry.getBoundingClientRect().toJSON(),pill:entry.querySelector('.pb-socket')?.getBoundingClientRect().toJSON()};
  })()`);
}
function metrics(expected, actual) {
  assert.equal(actual.w, expected.w);
  assert.equal(actual.h, expected.h);
  let sum = 0,
    changed = 0;
  for (let i = 0; i < expected.rgb.length; i++) {
    const n = Math.abs(actual.rgb[i] - expected.rgb[i]);
    sum += n;
    if (n > 8) changed++;
  }
  return { mae: sum / expected.rgb.length, changedOver8: changed / expected.rgb.length };
}

test(
  'first-step frozen demo parity: natural geometry and deterministic card, pill, comet and copy regions',
  { timeout: 300000 },
  async () => {
    assert.ok(browserBin, 'Visual parity requires the real browser');
    const f = await firstStepFixture(),
      actual = await chrome(),
      demo = await chrome();
    const results = [];
    try {
      await mkdir(run + '/parity', { recursive: true });
      const demoHTML = readFileSync('docs/prototypes/anti-procrastination/index.html', 'utf8');
      f.control.staticFiles = new Map([
        ['prototype.html', demoHTML.replace('<head>', '<head>' + trackIntervals)],
        [
          'index.html',
          readFileSync('web/index.html', 'utf8').replace('<head>', '<head>' + trackIntervals),
        ],
      ]);
      const widths = process.env.FIRST_STEP_PARITY_QUICK ? [390] : [320, 375, 390, 430, 768, 1440];
      for (const [width, dpr] of widths.flatMap((width) => [1, 2].map((dpr) => [width, dpr]))) {
        await openFirstStep(actual, f.server, width);
        await demo.navigate(f.server.url + 'prototype.html', width);
        await demo.wait('!!document.querySelector("#pb-entry")');
        await Promise.all([actual.resize(width, 844, dpr), demo.resize(width, 844, dpr)]);
        const [a, d] = await Promise.all([normalize(actual), normalize(demo)]);
        assert.ok(
          Math.abs(a.width - d.width) <= 1 && Math.abs(a.height - d.height) <= 1,
          JSON.stringify({ width, actual: a, demo: d }),
        );
        for (const theme of ['light', 'dark']) {
          for (const [name, state, progress, release] of cases) {
            const rects = await Promise.all([
              prepare(actual, 'actual', state, progress, release, theme),
              prepare(demo, 'demo', state, progress, release, theme),
            ]);
            await delay(30);
            const tag = width + '-' + theme + '-' + name + (dpr === 1 ? '' : '-dpr2');
            const actualPath = run + '/parity/' + tag + '-actual-page.png';
            const demoPath = run + '/parity/' + tag + '-demo-page.png';
            await Promise.all([actual.screenshot(actualPath), demo.screenshot(demoPath)]);
            const [aFrame, dFrame] = await Promise.all([readFile(actualPath), readFile(demoPath)]);
            const cardRect = { x: 22, y: 180, width: a.width, height: a.height };
            const aCard = crop(decodePNG(aFrame), cardRect, dpr),
              dCard = crop(decodePNG(dFrame), cardRect, dpr);
            await Promise.all([
              writeFile(actualPath.replace('-page', '-card'), png(aCard)),
              writeFile(demoPath.replace('-page', '-card'), png(dCard)),
            ]);
            const regions = {
              card: metrics(dCard, aCard),
              copy: metrics(
                crop(dCard, { x: 9, y: 8, width: Math.min(170, a.width - 123), height: 60 }, dpr),
                crop(aCard, { x: 9, y: 8, width: Math.min(170, a.width - 123), height: 60 }, dpr),
              ),
            };
            if (rects[0].pill && rects[1].pill) {
              const ar = rects[0].pill,
                dr = rects[1].pill;
              for (const key of ['x', 'y', 'width', 'height'])
                assert.ok(Math.abs(ar[key] - dr[key]) <= 1, tag + ' pill ' + key);
              const region = {
                x: Math.floor(dr.x - 22),
                y: Math.floor(dr.y - 180),
                width: Math.ceil(dr.width),
                height: Math.ceil(dr.height),
              };
              regions.pill = metrics(crop(dCard, region, dpr), crop(aCard, region, dpr));
            }
            results.push({ width, dpr, theme, state: name, regions });
            await writeFile(run + '/parity/results.json', JSON.stringify(results, null, 2));
            for (const [region, value] of Object.entries(regions))
              assert.ok(value.mae <= 2, tag + ' ' + region + ' MAE ' + value.mae);
          }
        }
      }
      assert.deepEqual(actual.errors, []);
      assert.deepEqual(demo.errors, []);
    } finally {
      await actual.close();
      await demo.close();
      await f.close();
    }
  },
);
