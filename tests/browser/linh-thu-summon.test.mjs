import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';
import { beastFixture } from './linh-thu-fixture.mjs';

const out = new URL(`../../trial-results/linh-thu/summon/run-${process.pid}/`, import.meta.url);
async function openSummon(browser, url) {
  await browser.navigate(url, 390);
  await browser.wait('!!document.querySelector(".focus-flip-card")');
  await browser.evaluate('document.querySelector("[data-tab=beasts]").click()');
  await browser.wait('!!document.querySelector(".beast-hero")');
  await browser.click('Triệu hồi');
  await browser.wait('document.querySelector(".beast-summon-banner img")?.naturalWidth>0');
}
async function shot(browser, name) {
  await mkdir(out, { recursive: true });
  await browser.screenshot(fileURLToPath(new URL(name + '.png', out)));
}

test(
  'summon layout stays usable at all approved sizes and sheets show actual catalog, rates and balances',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    control.beastData.account.state.pity = { ssr: 7, ur: 27 };
    const server = await serve(control);
    let browser;
    const layouts = [];
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      for (const [width, height] of [
        [360, 780],
        [375, 667],
        [390, 740],
        [390, 730],
        [393, 730],
        [390, 844],
        [414, 774],
        [430, 932],
        [1440, 960],
      ]) {
        await browser.resize(width, height);
        await browser.evaluate('scrollTo({top:0,behavior:"instant"})');
        const layout = await browser.evaluate(`(()=>{
          const rect=s=>document.querySelector(s).getBoundingClientRect();
          const button=rect('.beast-summon-actions'),pool=rect('.beast-summon-pool-link'),nav=rect('.bottom-nav');
          const panel=rect('.beast-summon-panel'),banner=rect('.beast-summon-banner');
          const img=document.querySelector('.beast-summon-banner img');
          return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
            documentHeight:document.documentElement.scrollHeight,panelTop:panel.top,panelBottom:panel.bottom,
            bannerHeight:banner.height,
            primaryBottom:button.bottom,poolBottom:pool.bottom,navTop:nav.top,
            tabs:document.querySelectorAll('.beast-tab').length,imageLoaded:img.complete&&img.naturalWidth>0,
            genericCard:!img.dataset.artVariant,
            pity:[...document.querySelectorAll('.beast-pity progress')].map(p=>[p.value,p.max]),
            sizes:[...document.querySelectorAll('.beast-tab,.beast-summon-actions button')].map(b=>b.getBoundingClientRect().height)};
        })()`);
        assert.equal(layout.overflow, false);
        assert.equal(layout.tabs, 4);
        assert.equal(layout.imageLoaded, true);
        assert.equal(layout.genericCard, true);
        assert.ok(layout.sizes.every((n) => n >= 44));
        assert.deepEqual(layout.pity, [
          [7, 20],
          [27, 80],
        ]);
        if (width < 900) {
          assert.ok(
            layout.primaryBottom <= layout.navTop,
            'Primary controls clear the bottom navigation',
          );
          assert.ok(
            layout.panelTop <= 200,
            'The header leaves room for the large card and actions',
          );
          assert.ok(layout.bannerHeight >= 240, 'The card stays large on a short phone');
          await browser.evaluate(
            'document.querySelector(".beast-summon-pool-link").scrollIntoView({block:"center",behavior:"instant"})',
          );
          assert.equal(
            await browser.evaluate(`(()=>{
            const b=document.querySelector('.beast-summon-pool-link'),r=b.getBoundingClientRect();
            return r.bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top
              &&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===b;
          })()`),
            true,
            'Scrolling makes the complete footer reachable above navigation',
          );
          await browser.tap('.beast-summon-pool-link');
          await browser.wait('document.querySelectorAll(".beast-pool-card").length===18');
          await browser.press('Escape');
          await browser.evaluate('scrollTo({top:0,behavior:"instant"})');
        }
        layouts.push(layout);
        await shot(browser, 'main-' + width);
        if (width === 390) await shot(browser, 'main-' + width + '-' + height);
      }
      await browser.resize(390, 844);
      const initialArtHeight = layouts.find(
        (l) => l.width === 390 && l.height === 844,
      ).bannerHeight;
      control.beastData.recentSummons = Array.from({ length: 5 }, (_, i) => ({
        id: 'past_summon_' + i,
        result: { count: 1, beasts: [{ id: 'past_beast_' + i, speciesId: 'pyropup' }] },
      }));
      await browser.evaluate('window.dispatchEvent(new Event("focus"))');
      await browser.wait(
        'document.querySelectorAll(".beast-page--summon > .text-button").length===5',
      );
      const afterHistory = await browser.evaluate(`(()=>{
        const r=s=>document.querySelector(s).getBoundingClientRect();
        return {art:r('.beast-summon-banner').height,panelBottom:r('.beast-summon-panel').bottom,
          navTop:r('.bottom-nav').top};
      })()`);
      assert.ok(
        Math.abs(afterHistory.art - initialArtHeight) < 2,
        'Five receipts cannot shrink the card',
      );
      assert.ok(
        afterHistory.panelBottom <= afterHistory.navTop,
        'Receipts stay below the first panel',
      );
      await shot(browser, 'main-with-history');
      await browser.tap('.beast-summon-pool-link');
      await browser.wait('document.querySelectorAll(".beast-pool-card").length===18');
      assert.deepEqual(
        await browser.evaluate(
          '[...document.querySelectorAll(".beast-pool-card strong")].map(n=>n.textContent)',
        ),
        control.beastData.config.catalog.map((s) => s.forms[0]),
      );
      await browser.evaluate(
        'document.querySelectorAll(".beast-pool-card img").forEach(i=>i.loading="eager")',
      );
      await browser.wait(
        '[...document.querySelectorAll(".beast-pool-card img")].every(i=>i.complete&&i.naturalWidth>0)',
      );
      await shot(browser, 'pool');
      await browser.press('Escape');
      await browser.tap('.beast-summon-rates');
      assert.ok(
        await browser.evaluate(
          'document.querySelector("#sheet-content").textContent.includes("SSR 4,5%")',
        ),
      );
      await shot(browser, 'rates');
      await browser.press('Escape');
      await browser.tap('.beast-summon-exchange');
      assert.ok(
        await browser.evaluate(
          'document.querySelector("#sheet-content").textContent.includes("20 vé thường")',
        ),
      );
      await shot(browser, 'exchange');
      await browser.press('Escape');
      for (const [width, height, textScale] of [
        [320, 568, 1],
        [740, 360, 1],
        [390, 844, 2],
      ]) {
        await browser.resize(width, height);
        await browser.scaleText(textScale);
        const readable = await browser.evaluate(`(()=>{
          const actions=[...document.querySelectorAll('.beast-summon-actions button')];
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,
            buttons:actions.every(b=>b.scrollWidth<=b.clientWidth+1&&b.scrollHeight<=b.clientHeight+1)};
        })()`);
        assert.deepEqual(
          readable,
          { overflow: false, buttons: true },
          'Small screens and large text stay readable',
        );
        await browser.evaluate(
          'document.querySelector(".beast-summon-pool-link").scrollIntoView({block:"center",behavior:"instant"})',
        );
        await browser.tap('.beast-summon-pool-link');
        await browser.wait('document.querySelectorAll(".beast-pool-card").length===18');
        await browser.press('Escape');
        await browser.scaleText(1);
      }
      await browser.resize(390, 844);
      control.beastData.account.state.summonTickets = 0;
      await browser.evaluate('window.dispatchEvent(new Event("focus"))');
      await browser.wait('!!document.querySelector(".beast-summon-empty")');
      assert.equal(
        await browser.evaluate(
          '[...document.querySelectorAll(".beast-summon-actions button")].every(b=>b.disabled)',
        ),
        true,
      );
      await browser.evaluate(
        'document.querySelector(".beast-summon-empty button").scrollIntoView({block:"center",behavior:"instant"})',
      );
      await browser.tap('.beast-summon-empty button');
      await browser.wait('!!document.querySelector(".habits-page")');
      assert.equal(control.posts.length, 0, 'Read-only sheets never submit mutations');
      assert.deepEqual(browser.errors, []);
      await writeFile(new URL('layouts.json', out), JSON.stringify(layouts, null, 2) + '\n');
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a paid special choice stays pending until the user confirms the exact candidate',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    control.beastData.summonChoice = {
      id: 'pending_choice',
      candidates: ['hootlet', 'fluffle', 'punchimp'],
    };
    control.beastData.account.state.summonTickets = 0;
    control.beastApi = async (request, endpoint) => {
      if (request.method !== 'POST') return original(request, endpoint);
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const input = JSON.parse(raw);
      assert.equal(input.operation, 'choose_summon');
      assert.equal(input.choiceId, 'pending_choice');
      assert.equal(input.option, 1);
      control.posts.push({ path: endpoint, input });
      control.beastData.summonChoice = null;
      control.beastData.account.version++;
      const result = { count: 1, beasts: [{ id: 'chosen_fluffle', speciesId: 'fluffle' }] };
      control.beastData.recentSummons = [{ id: input.id, result }];
      const body = { result, account: control.beastData.account, wallet: control.beastData.wallet };
      control.receipts.set(input.id, clone(body));
      return { body };
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.reducedMotion();
      await openSummon(browser, server.url);
      assert.equal(
        await browser.evaluate(
          '[...document.querySelectorAll(".beast-summon-actions button")].every(b=>b.disabled)',
        ),
        true,
      );
      await browser.click('Chọn linh thú triệu hồi');
      assert.equal(
        await browser.evaluate('document.querySelectorAll(".beast-picker-item").length'),
        3,
      );
      assert.equal(control.posts.length, 0);
      await browser.press('Escape');
      assert.ok(control.beastData.summonChoice);
      await browser.click('Chọn linh thú triệu hồi');
      await browser.evaluate('document.querySelectorAll(".beast-picker-item")[1].click()');
      assert.equal(control.posts.length, 0);
      await browser.click('Xác nhận');
      await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      assert.equal(
        await browser.evaluate('document.querySelector(".beast-reveal-identity h2").textContent'),
        'Fluffle',
      );
      assert.equal(
        await browser.evaluate('document.querySelector(".beast-reveal").dataset.rank'),
        'SR',
      );
      assert.equal(control.beastData.account.state.summonTickets, 0);
      assert.equal(control.posts.length, 1);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'v12 seven-second openings, nine rank transitions, replay and navigation preserve paid results',
  { skip: !browserBin, timeout: 180000 },
  async () => {
    const control = beastFixture();
    control.beastData.account.state.summonTickets = 30;
    const server = await serve(control);
    let browser;
    const performance = [];
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      for (const [rank, id] of [
        ['R', 'hootlet'],
        ['SR', 'fluffle'],
        ['SSR', 'punchimp'],
        ['UR', 'pyropup'],
      ]) {
        control.summonSpecies = [id];
        await browser.evaluate(
          `(()=>{const native=requestAnimationFrame;globalThis.__summonFrames=[];if(!globalThis.__rafOriginal){globalThis.__rafOriginal=native;window.requestAnimationFrame=cb=>__rafOriginal(t=>{if(document.querySelector('.beast-reveal.has-canvas'))__summonFrames.push(t);cb(t)})}})()`,
        );
        const start = Date.now();
        await browser.tap('.beast-summon-actions .secondary');
        await browser.wait('!!document.querySelector(".beast-reveal.has-canvas")');
        await browser.wait('document.querySelector(".beast-reveal").dataset.phase==="rarity"');
        assert.equal(
          await browser.evaluate('document.querySelector(".beast-reveal").dataset.rank'),
          rank,
        );
        await shot(browser, rank.toLowerCase() + '-cue');
        await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
        const elapsed = Date.now() - start;
        assert.ok(elapsed >= 6900 && elapsed < 11000, 'Seven-second opening: ' + elapsed);
        await delay(280);
        const species = control.beastData.config.catalog.find((s) => s.id === id);
        assert.equal(
          await browser.evaluate('document.querySelector("[data-reveal=beast-name]").textContent'),
          species.forms[0],
        );
        assert.equal(
          await browser.evaluate(
            'document.querySelector("[data-reveal=beast-art]").dataset.artVariant',
          ),
          'normal',
        );
        await shot(browser, rank.toLowerCase() + '-result');
        const frames = await browser.evaluate('__summonFrames.slice()');
        const gaps = frames
          .slice(1)
          .map((v, i) => v - frames[i])
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        performance.push({
          rank,
          durationMs: elapsed,
          frames: frames.length,
          medianFrameMs: gaps[Math.floor(gaps.length / 2)],
          p95FrameMs: gaps[Math.floor(gaps.length * 0.95)],
        });
        if (rank === 'R') {
          await browser.tap('[data-reveal=replay]');
          await browser.wait('!!document.querySelector(".beast-reveal:not(.is-revealed)")');
          await browser.evaluate('document.querySelector(".beast-reveal").click()');
          await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
        }
        await browser.evaluate(
          'globalThis.__closedCanvas=document.querySelector(".beast-reveal canvas")',
        );
        await browser.press('Escape');
        await browser.wait('!document.querySelector(".beast-reveal")');
        await browser.resize(375, 667);
        assert.equal(await browser.evaluate('__closedCanvas.width'), 1);
        await browser.resize(390, 844);
      }
      control.summonSpecies = [
        'hootlet',
        'fluffle',
        'punchimp',
        'pyropup',
        'hootlet',
        'pyropup',
        'fluffle',
        'punchimp',
        'hootlet',
        'pyropup',
      ];
      await browser.tap('.beast-summon-actions .primary');
      await browser.wait('!!document.querySelector(".beast-reveal.has-canvas")');
      const expected = control.beastData.recentSummons[0].result.beasts,
        posts = control.posts.length,
        balance = control.beastData.account.state.summonTickets;
      await browser.evaluate('document.querySelector(".beast-reveal").click()');
      for (let i = 0; i < expected.length; i++) {
        await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
        const item = control.beastData.config.catalog.find((s) => s.id === expected[i].speciesId);
        const state = await browser.evaluate(
          `(()=>{const d=document.querySelector('.beast-reveal');return {id:d.dataset.beastId,index:d.dataset.revealIndex,rank:d.dataset.rank,name:d.querySelector('[data-reveal=beast-name]').textContent,intros:d.dataset.introRuns,transitions:d.dataset.resultTransitions}})()`,
        );
        assert.deepEqual(state, {
          id: expected[i].id,
          index: String(i + 1),
          rank: item.rank,
          name: item.forms[0],
          intros: '1',
          transitions: String(i),
        });
        assert.equal(control.posts.length, posts);
        assert.equal(control.beastData.account.state.summonTickets, balance);
        assert.equal(
          await browser.evaluate('document.querySelector("[data-reveal=replay]").hidden'),
          true,
        );
        if (i < expected.length - 1) await browser.tap('[data-reveal=next]');
      }
      await browser.tap('[data-reveal=next]');
      await browser.wait('!!document.querySelector(".beast-reveal.is-summary")');
      assert.deepEqual(
        await browser.evaluate(
          '[...document.querySelectorAll(".beast-result-card")].map(c=>c.dataset.beastId)',
        ),
        expected.map((b) => b.id),
      );
      await shot(browser, 'results-ten');
      await browser.click('Tiếp tục hành trình');
      await browser.reducedMotion();
      await browser.click('Xem lại lần triệu hồi · 10 linh thú');
      await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      await browser.tap('[data-reveal=next]');
      assert.equal(
        await browser.evaluate('document.querySelector(".beast-reveal").dataset.beastId'),
        expected[1].id,
      );
      await browser.tap('[data-reveal=skip-batch]');
      await browser.wait('!!document.querySelector(".beast-reveal.is-summary")');
      await browser.reducedMotion(false);
      await browser.evaluate('document.querySelector("[data-reveal=summary-replay]").click()');
      await browser.wait('!!document.querySelector(".beast-reveal:not(.is-revealed)")');
      await browser.evaluate('document.querySelector(".beast-reveal").click()');
      assert.equal(
        await browser.evaluate(
          'document.querySelector(".beast-reveal").classList.contains("is-summary")',
        ),
        false,
      );
      await browser.tap('[data-reveal=skip-batch]');
      await browser.press('Escape');
      assert.equal(control.posts.length, posts);
      assert.equal(control.beastData.account.state.summonTickets, balance);
      await browser.click('Xem lại lần triệu hồi · 10 linh thú');
      await browser.wait('!!document.querySelector(".beast-reveal.has-canvas")');
      await browser.evaluate('document.querySelector("[data-tab=today]").click()');
      await browser.wait('!document.querySelector(".beast-reveal")');
      assert.deepEqual(browser.errors, []);
      await writeFile(
        new URL('animation-performance.json', out),
        JSON.stringify(performance, null, 2) + '\n',
      );
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'unavailable canvas and failed effect image both retain the confirmed result and can be dismissed',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.evaluate(
        'globalThis.__nativeContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=()=>null',
      );
      await browser.tap('.beast-summon-actions .secondary');
      await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      assert.equal(
        await browser.evaluate('document.querySelector(".beast-reveal-identity h2").textContent'),
        'Pyropup',
      );
      await browser.click('Hoàn tất');
      await browser.evaluate(`(()=>{
        HTMLCanvasElement.prototype.getContext=__nativeContext;
        const native=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
        Object.defineProperty(HTMLImageElement.prototype,'src',{...native,set(value){native.set.call(this,value.includes('summon-card.webp')?'/missing-summon-card.webp':value)}});
      })()`);
      await browser.tap('.beast-summon-actions .secondary');
      await browser.wait('!!document.querySelector(".beast-reveal.is-revealed")');
      assert.equal(
        await browser.evaluate('document.querySelector(".beast-reveal canvas").hidden'),
        true,
      );
      await browser.wait('document.querySelector(".beast-reveal-fallback img").naturalWidth>0');
      await shot(browser, 'fallback-result');
      await browser.press('Escape');
      assert.equal(control.posts.length, 2);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
