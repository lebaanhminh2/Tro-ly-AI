import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chrome, serve, browserBin } from './app-harness.mjs';
import { beastFixture } from './linh-thu-fixture.mjs';

const out = new URL('../../output/linh-thu-reveal-integration/', import.meta.url);
const sizes = [
  [320, 568],
  [375, 667],
  [390, 730],
  [390, 844],
  [414, 844],
  [1440, 1000],
];
const ranks = [
  ['R', 'hootlet'],
  ['SR', 'fluffle'],
  ['SSR', 'punchimp'],
  ['UR', 'pyropup'],
];
const durations = { R: 400, SR: 740, SSR: 1120, UR: 1680 };
const dialog = 'document.querySelector(".beast-reveal")';
const node = (id) => '[data-reveal="' + id + '"]';
async function click(b, id) {
  await b.evaluate('document.querySelector(' + JSON.stringify(node(id)) + ').click()');
}
async function shot(b, name) {
  await mkdir(out, { recursive: true });
  await b.screenshot(fileURLToPath(new URL(name + '.png', out)));
}
async function report(name, value) {
  await mkdir(out, { recursive: true });
  await writeFile(new URL(name + '.json', out), JSON.stringify(value, null, 2) + '\n');
}
async function openApp(b, url) {
  await b.navigate(url, 390);
  await b.wait('!!document.querySelector(".focus-flip-card")');
  await b.evaluate('document.querySelector("[data-tab=beasts]").click()');
  await b.wait('!!document.querySelector(".beast-hero")');
  await b.click('Triệu hồi');
  await b.wait('document.querySelector(".beast-summon-banner img")?.naturalWidth>0');
}
// The test controls the browser's clock rather than adding debug controls to production.
async function freeze(b) {
  await b.evaluate(`(()=>{
    let id=0;const pending=new Map();
    globalThis.__clock={now:10000,pending,
      step(ms){this.now+=ms;for(const[key,entry]of [...pending]){if(!pending.delete(key))continue;entry.fn(this.now);}},
      revealPending(){return [...pending.values()].filter(e=>e.reveal).length;}};
    Object.defineProperty(performance,'now',{value:()=>__clock.now,configurable:true});
    window.requestAnimationFrame=fn=>{pending.set(++id,{fn,reveal:new Error().stack.includes('beast-reveal-motion.js')});return id};
    window.cancelAnimationFrame=id=>pending.delete(id);
  })()`);
}
async function advance(b, ms) {
  await b.evaluate('__clock.step(' + ms + ')');
}
async function summon(b, count = 1) {
  await b.evaluate(
    'document.querySelector(".beast-summon-actions .' +
      (count === 10 ? 'primary' : 'secondary') +
      '").click()',
  );
  await b.wait('(()=>{__clock.step(0);return !!document.querySelector(".beast-reveal")})()');
}
async function tapBackground(b) {
  await b.evaluate(dialog + '.click()');
}
async function state(b) {
  return b.evaluate(
    `(()=>{const d=${dialog};return {id:d.dataset.beastId,index:Number(d.dataset.revealIndex),rank:d.dataset.rank,intros:Number(d.dataset.introRuns),transitions:Number(d.dataset.resultTransitions),phase:d.dataset.phase,mode:d.dataset.mode,duration:Number(d.dataset.duration),complete:d.classList.contains('is-revealed'),summary:d.classList.contains('is-summary')}})()`,
  );
}
async function layout(b, reference = false) {
  const selectors = reference
    ? {
        frame: '.rarity-frame',
        identity: '#identity',
        art: '#beast-art',
        name: '#beast-name',
        dock: '#dock',
        next: '#next',
        root: '#reveal',
      }
    : {
        frame: '.rarity-frame',
        identity: node('identity'),
        art: node('beast-art'),
        name: node('beast-name'),
        dock: node('dock'),
        next: node('next'),
        root: '.beast-reveal',
      };
  return b.evaluate(`(()=>{const s=${JSON.stringify(selectors)},root=document.querySelector(s.root),rect=key=>{const r=root.querySelector(s[key]).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
    const style=key=>getComputedStyle(root.querySelector(s[key]));return {frame:rect('frame'),identity:rect('identity'),art:rect('art'),dock:rect('dock'),next:rect('next'),
      frameBorder:parseFloat(style('frame').borderTopWidth),corner:style('frame').borderRadius,nameHeight:rect('name').height,nameLine:parseFloat(style('name').lineHeight),
      scroll:[root.scrollLeft,root.scrollTop],root:root.getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth+1,
      captionDisplay:style('identity').display,artLoaded:root.querySelector(s.art).naturalWidth>0,
      rankColor:getComputedStyle(root).getPropertyValue('--rank').trim()};})()`);
}

test(
  'approved v12 and production agree at the same rank cues, flip and result timestamps',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = beastFixture();
    control.beastData.account.state.summonTickets = 30;
    const server = await serve(control);
    let app, reference;
    const comparisons = [];
    try {
      app = await chrome();
      reference = await chrome();
      await openApp(app, server.url);
      await freeze(app);
      await reference.navigate(
        new URL('../../output/linh-thu-reveal-preview/demo.html', import.meta.url).href,
        390,
      );
      await reference.wait('!!window.revealPreview');
      for (const [rank, id] of ranks) {
        control.summonSpecies = [id];
        await summon(app);
        await reference.evaluate(
          'document.querySelector(".rank-picker [data-rank=' +
            rank +
            ']").click();document.querySelector("#species").value=' +
            JSON.stringify(id),
        );
        await reference.evaluate('window.revealPreview.start(1)');
        let elapsed = 0;
        for (const ms of [1300, 2800, 3850, 5250, 5680, 6300, 7000]) {
          await advance(app, ms - elapsed);
          elapsed = ms;
          await reference.evaluate('window.revealPreview.seek(' + ms / 7000 + ')');
          await app.wait('document.querySelector("[data-reveal=beast-art]").naturalWidth>0');
          if (ms === 7000) await delay(300);
          const a = await layout(app),
            r = await layout(reference, true);
          assert.equal(a.corner, r.corner);
          assert.equal(a.frameBorder, 4);
          // The x1 controls and caption reserve exactly the same card dimensions.
          for (const key of ['x', 'y', 'width', 'height'])
            assert.ok(
              Math.abs(a.frame[key] - r.frame[key]) < 1.2,
              rank + ' ' + ms + ' frame ' + key + ': ' + a.frame[key] + ' vs ' + r.frame[key],
            );
          assert.equal(a.rankColor, r.rankColor, rank + ' cue colour at ' + ms);
          assert.equal(a.captionDisplay, 'block');
          const canvasHashes = {};
          for (const id of ['scene', 'particles']) {
            const production = await app.evaluate(
              'document.querySelector(' + JSON.stringify(node(id)) + ').toDataURL()',
            );
            const baseline = await reference.evaluate(
              'document.getElementById(' + JSON.stringify(id) + ').toDataURL()',
            );
            const digest = (value) => createHash('sha256').update(value).digest('hex');
            assert.equal(
              digest(production),
              digest(baseline),
              rank + ' ' + ms + ' ' + id + ' pixels',
            );
            canvasHashes[id] = digest(production);
          }
          if (ms === 2800 || ms === 5250 || ms === 7000) {
            await shot(app, 'app-' + rank.toLowerCase() + '-' + ms);
            await shot(reference, 'reference-' + rank.toLowerCase() + '-' + ms);
          }
          comparisons.push({ rank, ms, canvasHashes, app: a, reference: r });
        }
        await click(app, 'close');
        await reference.evaluate('window.revealPreview.close()');
      }
      assert.deepEqual(app.errors, []);
      assert.deepEqual(reference.errors, []);
      await report('visual-comparison', comparisons);
    } finally {
      await app?.close();
      await reference?.close();
      await server.close();
    }
  },
);

test(
  'ten real receipt entries keep order through all skip phases, rapid taps and rank-specific transitions',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    control.beastData.account.state.summonTickets = 100;
    // UR is both in the middle and last; the first outcome is only R. Duplicates keep distinct IDs.
    control.summonSpecies = [
      'hootlet',
      'fluffle',
      'hootlet',
      'punchimp',
      'pyropup',
      'hootlet',
      'punchimp',
      'fluffle',
      'hootlet',
      'pyropup',
    ];
    const server = await serve(control);
    let b;
    const records = [];
    try {
      b = await chrome();
      await openApp(b, server.url);
      await freeze(b);
      for (const when of [1300, 2800, 5320]) {
        await summon(b, 10);
        const expected = control.beastData.recentSummons[0].result.beasts;
        const posts = control.posts.length,
          balance = control.beastData.account.state.summonTickets;
        await advance(b, when);
        if (when === 2800)
          assert.equal(
            await b.evaluate(
              'getComputedStyle(' + dialog + ').getPropertyValue("--omen-color").trim()',
            ),
            'rgba(252,88,112,1)',
          );
        await tapBackground(b);
        for (let n = 0; n < 5; n++) await tapBackground(b);
        assert.equal((await state(b)).id, expected[0].id);
        assert.equal((await state(b)).summary, false);
        assert.equal(
          await b.evaluate('document.querySelector(".beast-reveal-top .beast-reveal-skip")===null'),
          true,
        );
        assert.equal(
          await b.evaluate('document.querySelector("[data-reveal=replay]").hidden'),
          true,
        );
        for (let i = 1; i < expected.length; i++) {
          await click(b, 'next');
          let s = await state(b);
          const rank = control.beastData.config.catalog.find(
            (e) => e.id === expected[i].speciesId,
          ).rank;
          assert.equal(s.id, expected[i].id);
          assert.equal(s.duration, durations[rank]);
          assert.equal(s.mode, 'next');
          await advance(b, Math.round(durations[rank] * 0.22));
          if (i % 2) await tapBackground(b);
          else await advance(b, durations[rank]);
          s = await state(b);
          assert.equal(s.complete, true);
          assert.equal(s.id, expected[i].id);
          assert.equal(s.intros, 1);
          assert.equal(s.transitions, i);
          records.push({ openingTapMs: when, ...s });
        }
        await click(b, 'next');
        assert.equal((await state(b)).summary, true);
        assert.deepEqual(
          await b.evaluate(
            '[...document.querySelectorAll(".beast-result-card")].map(e=>e.dataset.beastId)',
          ),
          expected.map((e) => e.id),
        );
        await click(b, 'summary-replay');
        await tapBackground(b);
        assert.equal((await state(b)).id, expected[0].id);
        await click(b, 'skip-batch');
        assert.equal((await state(b)).summary, true);
        assert.equal(control.posts.length, posts);
        assert.equal(control.beastData.account.state.summonTickets, balance);
        await click(b, 'close');
        assert.equal(await b.evaluate('__clock.revealPending()'), 0);
      }
      assert.deepEqual(b.errors, []);
      await report('batch-interactions', records);
    } finally {
      await b?.close();
      await server.close();
    }
  },
);

test(
  'mobile viewports, 130 percent text, simulated safe areas and resizing keep the full card readable',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    control.beastData.account.state.summonTickets = 100;
    const server = await serve(control);
    let b;
    const layouts = [];
    try {
      b = await chrome();
      await openApp(b, server.url);
      await b.reducedMotion();
      await b.tap('.beast-summon-actions .primary');
      await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      for (const [width, height] of sizes) {
        await b.resize(width, height);
        for (const scale of [1, 1.3]) {
          await b.scaleText(scale);
          await delay(80);
          const l = await layout(b);
          assert.equal(l.overflow, false);
          assert.deepEqual(l.scroll, [0, 0]);
          assert.equal(l.corner, '0px');
          assert.equal(l.frameBorder, 4);
          assert.ok(l.identity.bottom < l.dock.y);
          assert.ok(l.dock.bottom <= l.root.bottom + 1);
          assert.ok(l.art.bottom <= l.identity.y + 1);
          assert.ok(
            l.nameHeight <= l.nameLine + 1,
            'Name must stay whole at ' + width + ' ' + scale,
          );
          assert.equal(l.artLoaded, true);
          layouts.push({ width, height, scale, ...l });
          await shot(b, 'layout-' + width + 'x' + height + '-' + scale);
        }
        await b.scaleText(1);
      }
      await b.resize(390, 730);
      await b.evaluate(
        'document.querySelector("[data-reveal=top]").style.top="44px";document.querySelector("[data-reveal=dock]").style.bottom="34px"',
      );
      await b.resize(390, 729);
      await delay(80);
      const safe = await layout(b);
      assert.ok(safe.frame.y >= safe.root.y + 95);
      assert.ok(safe.dock.bottom <= safe.root.bottom - 33);
      layouts.push({ simulatedSafeArea: { top: 44, bottom: 34 }, ...safe });
      await shot(b, 'safe-area-simulation');
      // Every catalog caption also needs to fit the narrowest screen with enlarged text.
      await click(b, 'close');
      await b.resize(320, 568);
      for (const species of control.beastData.config.catalog) {
        control.summonSpecies = [species.id];
        await b.evaluate('document.querySelector(".beast-summon-actions .secondary").click()');
        await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
        await b.scaleText(1.3);
        await delay(30);
        const l = await layout(b);
        assert.ok(l.nameHeight <= l.nameLine + 1, species.id + ' breaks its name');
        assert.ok(l.identity.bottom < l.dock.y);
        assert.ok(l.art.bottom <= l.identity.y + 1);
        layouts.push({ species: species.id, width: 320, height: 568, scale: 1.3, ...l });
        await click(b, 'close');
        await b.scaleText(1);
      }
      assert.deepEqual(b.errors, []);
      await report('mobile-layouts', layouts);
    } finally {
      await b?.close();
      await server.close();
    }
  },
);

test(
  'visibility, motion preference, live refresh and close/reopen preserve progress and release resources',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let b;
    try {
      b = await chrome();
      await openApp(b, server.url);
      await freeze(b);
      await summon(b);
      await advance(b, 2800);
      const before = await state(b);
      await b.evaluate(
        'Object.defineProperty(document,"hidden",{value:true,configurable:true});document.dispatchEvent(new Event("visibilitychange"))',
      );
      assert.equal(await b.evaluate('__clock.revealPending()'), 0);
      await advance(b, 60000);
      assert.deepEqual(await state(b), before);
      await b.evaluate(
        'Object.defineProperty(document,"hidden",{value:false,configurable:true});document.dispatchEvent(new Event("visibilitychange"))',
      );
      await advance(b, 100);
      assert.equal((await state(b)).phase, 'rarity');
      // A real focus refresh may replace page data but must leave this dialog and index intact.
      await b.evaluate(
        'globalThis.__sameReveal=document.querySelector(".beast-reveal");window.dispatchEvent(new Event("focus"))',
      );
      await delay(120);
      await advance(b, 0);
      assert.equal(
        await b.evaluate('__sameReveal===document.querySelector(".beast-reveal")'),
        true,
      );
      await b.evaluate(
        'import("/app/core/experience.js").then(m=>m.setExperiencePreferences({motion:"reduce"}))',
      );
      await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      assert.equal(await b.evaluate('__clock.revealPending()'), 0);
      assert.equal(
        await b.evaluate(
          'getComputedStyle(document.querySelector(".beast-reveal")).backgroundColor',
        ),
        'rgb(7, 13, 28)',
      );
      const canvases = await b.evaluate(
        'globalThis.__released=[...document.querySelectorAll(".beast-reveal canvas")];__released.length',
      );
      assert.equal(canvases, 2);
      await click(b, 'close');
      assert.equal(await b.evaluate('__released.every(c=>c.width===1&&c.height===1)'), true);
      assert.equal(await b.evaluate('__clock.revealPending()'), 0);
      await b.evaluate(
        'import("/app/core/experience.js").then(m=>m.setExperiencePreferences({motion:"system"}))',
      );
      const pending = [];
      for (let i = 0; i < 12; i++) {
        await b.evaluate(
          '[...document.querySelectorAll(".beast-page--summon > .text-button")][0].click()',
        );
        await b.wait('!!document.querySelector(".beast-reveal")');
        await advance(b, 100);
        await click(b, 'close');
        const n = await b.evaluate('__clock.revealPending()');
        assert.equal(n, 0);
        pending.push(n);
      }
      await b.evaluate(
        '[...document.querySelectorAll(".beast-page--summon > .text-button")][0].click()',
      );
      await b.wait('!!document.querySelector(".beast-reveal")');
      await b.evaluate('document.querySelector("[data-tab=today]").click()');
      await advance(b, 0);
      await b.wait('!document.querySelector(".beast-reveal")');
      assert.equal(await b.evaluate('__clock.revealPending()'), 0);
      assert.equal(control.posts.length, 1);
      assert.deepEqual(b.errors, []);
      await report('lifecycle', {
        visibilityPaused: true,
        resumedWithoutJump: true,
        liveRefreshPreserved: true,
        reducedMotionStopped: true,
        closedCanvasSize: 1,
        reopenCycles: pending.length,
        pendingFramesAfterEach: pending,
        posts: control.posts.length,
        browser: 'Chromium emulation; visibility injected through document.hidden',
        heapBytes: await b.evaluate('performance.memory?.usedJSHeapSize??null'),
      });
    } finally {
      await b?.close();
      await server.close();
    }
  },
);

test(
  'resizing during the opening preserves its timeline, and unavailable Canvas still exposes paid results',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    control.beastData.account.state.summonTickets = 30;
    const server = await serve(control);
    let b;
    try {
      b = await chrome();
      await openApp(b, server.url);
      await b.tap('.beast-summon-actions .secondary');
      await b.wait('document.querySelector(".beast-reveal")?.dataset.phase==="rarity"');
      await b.evaluate('globalThis.__resizedReveal=document.querySelector(".beast-reveal")');
      const samples = [];
      for (const [width, height] of [
        [390, 730],
        [375, 667],
        [414, 844],
      ]) {
        const before = await b.evaluate('Number(__resizedReveal.dataset.progress)');
        const identity = await state(b);
        await b.resize(width, height);
        const after = await b.evaluate('Number(__resizedReveal.dataset.progress)');
        assert.ok(after >= before, 'Resize must not restart or reverse the timeline');
        assert.equal((await state(b)).id, identity.id);
        assert.equal((await state(b)).intros, 1);
        assert.equal(
          await b.evaluate('__resizedReveal===document.querySelector(".beast-reveal")'),
          true,
        );
        samples.push({ width, height, before, after });
      }
      await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      await shot(b, 'resized-during-opening');
      await click(b, 'close');
      await b.evaluate('HTMLCanvasElement.prototype.getContext=()=>null');
      await b.tap('.beast-summon-actions .primary');
      await b.wait('!!document.querySelector(".beast-reveal.is-static.is-revealed")');
      const expected = control.beastData.recentSummons[0].result.beasts;
      assert.equal((await state(b)).id, expected[0].id);
      assert.equal(
        await b.evaluate('document.querySelector("[data-reveal=next]").disabled'),
        false,
      );
      await click(b, 'next');
      assert.equal((await state(b)).id, expected[1].id);
      await click(b, 'skip-batch');
      assert.deepEqual(
        await b.evaluate(
          '[...document.querySelectorAll(".beast-result-card")].map(e=>e.dataset.beastId)',
        ),
        expected.map((e) => e.id),
      );
      assert.equal(control.posts.length, 2);
      await shot(b, 'canvas-unavailable-summary');
      await click(b, 'close');
      assert.deepEqual(b.errors, []);
      await report('resize-and-canvas-fallback', {
        samples,
        canvasUnavailable: true,
        summaryIds: expected.map((e) => e.id),
        posts: control.posts.length,
      });
    } finally {
      await b?.close();
      await server.close();
    }
  },
);

test(
  'opening and replay focus the reveal without a purple close outline, while Tab and Escape remain usable',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    control.beastData.account.state.summonTickets = 21;
    let b;
    try {
      b = await chrome();
      await openApp(b, server.url);
      for (const keyboard of [false, true]) {
        const selector = '.beast-summon-actions .' + (keyboard ? 'primary' : 'secondary');
        if (keyboard) {
          await b.press('Tab');
          await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
          await b.press('Enter');
        } else {
          await b.tap(selector);
          await freeze(b);
        }
        await b.wait('(()=>{__clock.step(0);return !!document.querySelector(".beast-reveal")})()');
        const focusState = () =>
          b.evaluate(
            `(()=>{const d=${dialog},close=d.querySelector('[data-reveal=close]');return {dialogFocused:document.activeElement===d,closeOutlined:close.matches(':focus-visible'),outline:getComputedStyle(close).outlineStyle}})()`,
          );
        assert.deepEqual(await focusState(), {
          dialogFocused: true,
          closeOutlined: false,
          outline: 'none',
        });
        await b.screenshot(
          'output/linh-thu-roles-focus-release-20261021/opening-' +
            (keyboard ? 'keyboard' : 'pointer') +
            '.png',
        );
        await b.press('Tab');
        assert.deepEqual(
          await b.evaluate(
            `(()=>{const close=${dialog}.querySelector('[data-reveal=close]');return {focused:document.activeElement===close,visible:close.matches(':focus-visible'),outline:getComputedStyle(close).outlineStyle}})()`,
          ),
          { focused: true, visible: true, outline: 'solid' },
          'Keyboard navigation still shows the close control focus indicator',
        );
        await tapBackground(b);
        await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
        if (keyboard) {
          await click(b, 'skip-batch');
          assert.deepEqual(await focusState(), {
            dialogFocused: true,
            closeOutlined: false,
            outline: 'none',
          });
        } else {
          await click(b, 'replay');
          assert.equal((await focusState()).dialogFocused, true);
          assert.equal((await focusState()).closeOutlined, false);
        }
        await b.press('Escape');
        assert.equal(await b.evaluate('!!document.querySelector(".beast-reveal")'), false);
        assert.equal(
          await b.evaluate(
            `document.activeElement===document.querySelector(${JSON.stringify(selector)})`,
          ),
          true,
          'Closing returns focus to the available summon control',
        );
      }
      assert.equal(control.posts.length, 2, 'Replay and focus changes never create another summon');
      assert.deepEqual(b.errors, []);
    } finally {
      await b?.close();
      await server.close();
    }
  },
);

test(
  'delayed or failed portraits keep their result, and keyboard focus returns after closing',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let b;
    try {
      b = await chrome();
      await openApp(b, server.url);
      await b.reducedMotion();
      await b.evaluate(
        `(()=>{const original=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');globalThis.__imageSrc=original;Object.defineProperty(HTMLImageElement.prototype,'src',{...original,set(value){if(value.includes('/assets/linh-thu/designed/'))setTimeout(()=>original.set.call(this,value),600);else original.set.call(this,value)}})})()`,
      );
      await b.tap('.beast-summon-actions .secondary');
      await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      const before = await layout(b);
      await b.wait('document.querySelector("[data-reveal=beast-art]").naturalWidth>0');
      const after = await layout(b);
      assert.deepEqual(before.frame, after.frame);
      await b.press('Tab');
      assert.equal(
        await b.evaluate(
          'document.querySelector(".beast-reveal").contains(document.activeElement)',
        ),
        true,
      );
      await click(b, 'close');
      assert.equal(
        await b.evaluate(
          'document.activeElement===document.querySelector(".beast-summon-actions .secondary")',
        ),
        true,
      );
      await b.evaluate(
        `(()=>{Object.defineProperty(HTMLImageElement.prototype,'src',{...__imageSrc,set(value){__imageSrc.set.call(this,value.includes('/assets/linh-thu/designed/')?'/missing-beast-art.png':value)}})})()`,
      );
      await b.tap('.beast-summon-actions .secondary');
      await b.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      await b.wait('!document.querySelector("[data-reveal=placeholder]").hidden');
      assert.equal(
        await b.evaluate('document.querySelector("[data-reveal=beast-name]").textContent'),
        'Pyropup',
      );
      await shot(b, 'missing-art-result');
      await b.press('Escape');
      assert.equal(control.posts.length, 2);
      assert.deepEqual(b.errors, []);
      await report('image-and-keyboard', {
        delayedImageNoLayoutShift: true,
        failedArtKeepsIdentity: true,
        focusContained: true,
        focusRestored: true,
        posts: control.posts.length,
      });
    } finally {
      await b?.close();
      await server.close();
    }
  },
);
