import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chrome } from './app-harness.mjs';
import {
  firstStepEvidenceDirectory,
  firstStepFixture,
  openFirstStep,
} from './first-step-fixture.mjs';
import { crop, decodePNG, png } from './first-step-images.mjs';

test(
  'first-step approved reward scene preserves canvas, prizes, copy and geometry in both themes and DPRs',
  { timeout: 180000 },
  async () => {
    const f = await firstStepFixture(),
      actual = await chrome(),
      demo = await chrome();
    const run = firstStepEvidenceDirectory() + '/reward-parity';
    const results = [];
    try {
      await mkdir(run, { recursive: true });
      f.control.staticFiles = new Map([
        [
          'prototype.html',
          await readFile('docs/prototypes/anti-procrastination/index.html', 'utf8'),
        ],
      ]);
      for (const width of [320, 390, 1440])
        for (const theme of ['light', 'dark'])
          for (const dpr of [1, 2]) {
            await openFirstStep(actual, f.server, width);
            await demo.navigate(f.server.url + 'prototype.html', width);
            await demo.wait('!!document.querySelector("#pb-entry")');
            await Promise.all([actual.resize(width, 844, dpr), demo.resize(width, 844, dpr)]);
            const rectangles = [];
            for (const [browser, isActual] of [
              [actual, true],
              [demo, false],
            ]) {
              rectangles.push(
                await browser.evaluate(`(async()=>{
          document.documentElement.dataset.theme=${JSON.stringify(theme)};
          const entry=document.querySelector('#pb-entry'),width=entry.getBoundingClientRect().width;
          entry.style.cssText+=';position:fixed;top:180px;left:22px;margin:0;width:'+width+'px';
          globalThis.__rewardFrames=[];
          globalThis.requestAnimationFrame=callback=>(__rewardFrames.push(callback),__rewardFrames.length);
          globalThis.setTimeout=()=>0;
          Object.defineProperty(performance,'now',{configurable:true,value:()=>0});
          ${
            isActual
              ? `
            const {firstStepInner}=await import('./views/first-step.js');
            const {createFirstStepMotion}=await import('./ui/first-step-motion.js');
            entry.dataset.state='reward';entry.innerHTML=firstStepInner('reward',null,0);
            globalThis.__rewardMotion=createFirstStepMotion(()=>entry,()=>({coin:1,ticket:1}));
            __rewardMotion.reward();
          `
              : `
            pbCancelHold();pbView='reward';pbData.active=null;pbData.events=[{id:'visual_reward'}];
            entry.dataset.state='reward';entry.innerHTML=pbInner('reward');pbFlight(false);
          `
          }
          for(const callback of __rewardFrames.splice(0))callback(900);
          for(const animation of document.getAnimations()){animation.pause();animation.currentTime=900;}
          const panel=document.querySelector('.pb-theatre');
          return {rect:panel.getBoundingClientRect().toJSON(),copy:panel.innerText};
        })()`),
              );
            }
            const [a, d] = rectangles;
            assert.equal(a.copy, d.copy);
            for (const key of ['x', 'y', 'width', 'height'])
              assert.ok(Math.abs(a.rect[key] - d.rect[key]) <= 1, key);
            const tag = width + '-' + theme + '-dpr' + dpr;
            const shots = await Promise.all(
              [
                [actual, 'actual'],
                [demo, 'demo'],
              ].map(async ([browser, name]) => {
                const path = run + '/' + tag + '-' + name + '.png';
                await browser.screenshot(path);
                const image = crop(decodePNG(await readFile(path)), d.rect, dpr);
                await writeFile(path.replace('.png', '-scene.png'), png(image));
                return image;
              }),
            );
            assert.equal(shots[0].rgb.length, shots[1].rgb.length);
            let sum = 0;
            for (let i = 0; i < shots[0].rgb.length; i++)
              sum += Math.abs(shots[0].rgb[i] - shots[1].rgb[i]);
            const mae = sum / shots[0].rgb.length;
            results.push({ width, theme, dpr, mae, geometry: a.rect });
            await writeFile(run + '/results.json', JSON.stringify(results, null, 2));
            assert.ok(mae <= 2, tag + ' reward scene MAE ' + mae);
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
