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
  'Vietnamese summon pool aligns complete names, portraits and ranks without clipping at every text size',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let browser;
    const measurements = [];
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.evaluate("document.querySelector('.beast-summon-pool-link').click()");
      await browser.wait("document.querySelectorAll('.beast-pool-card').length===18");
      await browser.evaluate(
        "document.querySelectorAll('.beast-pool-card img').forEach(img=>img.loading='eager')",
      );
      await browser.wait(
        "[...document.querySelectorAll('.beast-pool-card img')].every(img=>img.complete&&img.naturalWidth>0)",
      );
      for (const [width, height, scale] of [
        [320, 568, 1],
        [375, 667, 1],
        [390, 844, 1],
        [430, 932, 1],
        [740, 360, 1],
        [1440, 1000, 1],
        [320, 568, 1.3],
        [390, 844, 2],
        [1440, 1000, 2],
      ]) {
        await browser.resize(width, height);
        for (const theme of ['light', 'dark']) {
          await browser.evaluate(
            `document.documentElement.dataset.theme='${theme}';document.querySelector('#sheet-content').scrollTop=0`,
          );
          await browser.scaleText(scale);
          const layout = await browser.evaluate(`(() => {
            const content=document.querySelector('#sheet-content'), viewport=content.getBoundingClientRect();
            const right=viewport.left+content.clientWidth;
            const cards=[...document.querySelectorAll('.beast-pool-card')].map(card=>{
              const name=card.querySelector('strong'),image=card.querySelector('img'),rank=card.querySelector('small');
              const box=card.getBoundingClientRect(),n=name.getBoundingClientRect(),i=image.getBoundingClientRect(),r=rank.getBoundingClientRect();
              const splitWords=[];
              for(const match of name.firstChild.textContent.matchAll(/\\S+/gu)){
                const range=document.createRange();range.setStart(name.firstChild,match.index);range.setEnd(name.firstChild,match.index+match[0].length);
                if(new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size>1)splitWords.push(match[0]);
              }
              return {name:name.textContent,top:box.top,bottom:box.bottom,imageTop:i.top,imageBottom:i.bottom,nameTop:n.top,nameBottom:n.bottom,
                centered:Math.abs((n.left+n.right-i.left-i.right)/2)<1 && getComputedStyle(name).textAlign==='center',
                inside:box.left>=viewport.left-1&&box.right<=right+1,
                ordered:r.bottom<=i.top+1 && i.bottom<=n.top+1 && n.bottom<=box.bottom+1,
                clipped:name.scrollWidth>name.clientWidth+1 || name.scrollHeight>name.clientHeight+1,splitWords};
            });
            const description=content.querySelector(':scope>.hint'),range=document.createRange();range.selectNodeContents(description);
            return {cards,overflow:content.scrollWidth>content.clientWidth+1,
              descriptionInside:[...range.getClientRects()].every(rect=>rect.left>=viewport.left-1&&rect.right<=right+1),
              closeVisible:(()=>{const n=content.querySelector('[data-sheet-close]'),r=n.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===n})()};
          })()`);
          const label = `${width}x${height} text${scale} ${theme}`;
          assert.deepEqual(
            layout.cards.map((card) => card.name),
            control.beastData.config.catalog.map((species) => species.forms[0]),
          );
          assert.equal(layout.overflow, false, label);
          assert.equal(layout.descriptionInside, true, label + ' description');
          assert.equal(layout.closeVisible, true, label + ' close');
          for (const card of layout.cards) {
            assert.ok(
              card.centered && card.inside && card.ordered && !card.clipped,
              label + ' ' + JSON.stringify(card),
            );
            assert.deepEqual(card.splitWords, [], label + ' ' + card.name);
          }
          const rows = Map.groupBy(layout.cards, (card) => Math.round(card.top));
          for (const row of rows.values())
            for (const key of ['bottom', 'imageTop', 'imageBottom', 'nameTop', 'nameBottom'])
              assert.ok(
                Math.max(...row.map((card) => card[key])) -
                  Math.min(...row.map((card) => card[key])) <=
                  1,
                label + ' misaligned ' + key,
              );
          measurements.push({
            width,
            height,
            scale,
            theme,
            columns: [...rows.values()][0].length,
            ...layout,
          });
          await shot(browser, `vietnamese-pool-${width}-${height}-${theme}-text${scale}`);
          await browser.evaluate("document.querySelector('#sheet-content').scrollTop=100000");
          assert.equal(
            await browser.evaluate(
              `(()=>{const content=document.querySelector('#sheet-content'),last=content.querySelector('.beast-pool-card:last-child'),r=last.getBoundingClientRect(),v=content.getBoundingClientRect();return r.bottom<=v.bottom+1})()`,
            ),
            true,
            label + ' last card reachable',
          );
          await browser.scaleText(1);
        }
      }
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
      await writeFile(
        new URL('vietnamese-pool-layouts.json', out),
        JSON.stringify(measurements, null, 2) + '\n',
      );
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

function sacrificeInventory(control) {
  const template = clone(control.ownedBeasts[0]);
  const individual = (speciesId, id) => ({
    ...clone(template),
    id,
    speciesId,
    attemptId: 'attempt_' + id,
    isProtected: false,
    attempt: { speciesId, ruleVersion: 1, status: 'ready', form: 1, earned: 0, gray: 0 },
  });
  control.ownedBeasts.push(
    ...Array.from({ length: 26 }, (_, i) => individual('gibber', 'sacrifice_r_' + i)),
    individual('frostnip', 'sacrifice_ssr'),
    individual('pyropup', 'sacrifice_ur'),
  );
  control.beastData.speciesCounts = { frostnip: 2, gibber: 26, pyropup: 1 };
  control.beastData.account.state.sacrificePoints = 2;
}

test(
  'protection acknowledges rapid clicks immediately and serializes only final desired values without replacing cards',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const api = control.beastApi;
    let simultaneous = 0,
      peak = 0;
    control.beastApi = async (request, endpoint) => {
      if (request.method !== 'POST') return api(request, endpoint);
      simultaneous++;
      peak = Math.max(peak, simultaneous);
      try {
        await delay(350);
        return await api(request, endpoint);
      } finally {
        simultaneous--;
      }
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.wait("document.querySelector('.beast-updating')?.textContent===''");
      const reads = control.collectionRequests.length;
      const immediate = await browser.evaluate(`(()=>{
      window.retainedCards=[...document.querySelectorAll('.beast-collection-card')];
      window.retainedImages=retainedCards.map(c=>c.querySelector('img'));
      window.retainedStars=[...document.querySelectorAll('.beast-protection')];
      window.removedCards=0;
      new MutationObserver(rs=>{for(const r of rs)for(const n of r.removedNodes)if(n.nodeType===1)window.removedCards+=Number(n.matches('.beast-collection-card'))+n.querySelectorAll('.beast-collection-card').length;}).observe(document.querySelector('.beast-page'),{childList:true,subtree:true});
      window.starScroll=120;scrollTo({top:starScroll,behavior:'instant'});
      const star=i=>document.querySelector('[data-protection-id=sacrifice_r_'+i+']');
      const t=performance.now();
      star(0).focus({preventScroll:true});
      for(const i of [0,1,0,0,2,2,3])star(i).click();
      return {elapsed:performance.now()-t,pressed:[0,1,2,3].map(i=>star(i).getAttribute('aria-pressed')),enabled:[...document.querySelectorAll('.beast-protection')].every(s=>!s.disabled),retained:retainedCards.every(c=>c.isConnected)};
    })()`);
      assert.deepEqual(immediate.pressed, ['true', 'true', 'false', 'true']);
      assert.equal(immediate.enabled, true);
      assert.equal(immediate.retained, true);
      assert.ok(immediate.elapsed < 100, JSON.stringify(immediate));
      await browser.wait(
        "!sessionStorage.getItem('minh-anh-beast-pending-v1') && [...document.querySelectorAll('.beast-protection')].every(s=>s.dataset.protectionStatus==='saved')",
      );
      assert.equal(peak, 1);
      assert.equal(control.posts.length, 3, 'Queued toggles with no final change require no write');
      assert.deepEqual(
        control.posts.map((p) => p.input.beastId),
        ['sacrifice_r_0', 'sacrifice_r_1', 'sacrifice_r_3'],
      );
      assert.equal(new Set(control.posts.map((p) => p.input.version)).size, 3);
      assert.equal(
        control.collectionRequests.length,
        reads,
        'Saving a star must not reload inventory',
      );
      const after = await browser.evaluate(
        `({cards:retainedCards.every((c,i)=>c===document.querySelectorAll('.beast-collection-card')[i]),images:retainedImages.every((img,i)=>img===document.querySelectorAll('.beast-collection-card img')[i]),stars:retainedStars.every((s,i)=>s===document.querySelectorAll('.beast-protection')[i]),removed:removedCards,scroll:scrollY,focused:document.activeElement===retainedStars[0]})`,
      );
      assert.deepEqual(after, {
        cards: true,
        images: true,
        stars: true,
        removed: 0,
        scroll: 120,
        focused: true,
      });
      await mkdir(out, { recursive: true });
      await writeFile(
        new URL('protection-performance.json', out),
        JSON.stringify(
          {
            simulatedServerDelayMs: 350,
            immediate,
            after,
            peakConcurrentWrites: peak,
            writes: control.posts.length,
          },
          null,
          2,
        ),
      );
      await browser.evaluate(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').click();document.querySelector('[data-protection-id=sacrifice_r_0]').click()",
      );
      await browser.wait(
        "!sessionStorage.getItem('minh-anh-beast-pending-v1') && document.querySelector('[data-protection-id=sacrifice_r_0]').dataset.protectionStatus==='saved'",
      );
      assert.equal(control.ownedBeasts.find((b) => b.id === 'sacrifice_r_0').isProtected, true);
      assert.equal(
        control.posts.length,
        5,
        'An already sent toggle is followed by its latest intent',
      );
      await shot(browser, 'protection-redesigned');
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a rejected protection write reverts queued stars and a stale client reconciles without replacing the grid',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const api = control.beastApi;
    let reject = true;
    control.beastApi = async (request, endpoint) => {
      if (request.method === 'POST' && reject) {
        reject = false;
        let raw = '';
        for await (const part of request) raw += part;
        control.posts.push({ path: endpoint, input: JSON.parse(raw) });
        await delay(250);
        return {
          status: 409,
          body: { error: 'ACCOUNT_SUSPENDED', message: 'Không thể lưu dấu sao lúc này.' },
        };
      }
      return api(request, endpoint);
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.evaluate(
        "window.sameGrid=document.querySelector('.beast-collection-grid');document.querySelector('[data-protection-id=sacrifice_r_0]').click();document.querySelector('[data-protection-id=sacrifice_r_1]').click()",
      );
      await browser.wait(
        "!!document.querySelector('.beast-protection-feedback') && !sessionStorage.getItem('minh-anh-beast-pending-v1')",
      );
      assert.deepEqual(
        await browser.evaluate(
          "[0,1].map(i=>document.querySelector('[data-protection-id=sacrifice_r_'+i+']').getAttribute('aria-pressed'))",
        ),
        ['false', 'false'],
      );
      assert.equal(control.posts.length, 1);
      assert.equal(
        await browser.evaluate("sameGrid===document.querySelector('.beast-collection-grid')"),
        true,
      );
      const remote = control.ownedBeasts.find((b) => b.id === 'sacrifice_r_0');
      remote.isProtected = true;
      control.beastData.account.version++;
      await browser.evaluate(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').click()",
      );
      await browser.wait(
        "document.querySelector('.beast-protection-feedback')?.textContent.includes('thay đổi') && document.querySelector('[data-protection-id=sacrifice_r_0]').getAttribute('aria-pressed')==='true'",
      );
      // Feedback may appear before reconciliation has acquired the new version.
      await browser.wait(
        "!sessionStorage.getItem('minh-anh-beast-pending-v1') && !document.querySelector('[data-protection-id=sacrifice_r_0]').disabled",
      );
      await browser.evaluate(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').click()",
      );
      await browser.wait(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').dataset.protectionStatus==='saved' && document.querySelector('[data-protection-id=sacrifice_r_0]').getAttribute('aria-pressed')==='false'",
      );
      assert.equal(remote.isProtected, false);
      assert.equal(
        await browser.evaluate("sameGrid===document.querySelector('.beast-collection-grid')"),
        true,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'an ambiguous protection write stops queued changes and recovers exactly once after reload',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const api = control.beastApi;
    let lose = true;
    control.beastApi = async (request, endpoint) => {
      if (request.method === 'POST' && lose) {
        lose = false;
        await delay(250);
        await api(request, endpoint);
        return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
      }
      return api(request, endpoint);
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.evaluate(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').click();document.querySelector('[data-protection-id=sacrifice_r_1]').click()",
      );
      await browser.wait(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').dataset.protectionStatus==='unconfirmed' && document.querySelector('[data-protection-id=sacrifice_r_0]').disabled",
      );
      assert.equal(control.posts.length, 1);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('[data-protection-id=sacrifice_r_1]').getAttribute('aria-pressed')",
        ),
        'false',
      );
      const pending = await browser.evaluate(
        "JSON.parse(sessionStorage.getItem('minh-anh-beast-pending-v1'))",
      );
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      await browser.click('Kiểm tra kết quả');
      await browser.wait("!sessionStorage.getItem('minh-anh-beast-pending-v1')");
      assert.equal(control.posts.length, 1);
      assert.equal(control.posts[0].input.id, pending.id);
      assert.equal(control.ownedBeasts.find((b) => b.id === 'sacrifice_r_0').isProtected, true);
      assert.equal(control.ownedBeasts.find((b) => b.id === 'sacrifice_r_1').isProtected, false);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'offline protection retains its original intent and can be recovered without a false success',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.networkConditions(true, 0, 10000000);
      await browser.evaluate(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').click()",
      );
      await browser.wait(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').dataset.protectionStatus==='unconfirmed'",
      );
      assert.equal(control.posts.length, 0);
      const pending = await browser.evaluate(
        "JSON.parse(sessionStorage.getItem('minh-anh-beast-pending-v1'))",
      );
      assert.equal(pending.input.isProtected, true);
      assert.match(
        await browser.evaluate("document.querySelector('.beast-protection-feedback').textContent"),
        /Chưa xác nhận/,
      );
      await browser.networkConditions(false, 0, 10000000);
      await browser.click('Kiểm tra kết quả');
      await browser.wait(
        "sessionStorage.getItem('minh-anh-beast-pending-v1')===null && document.querySelector('[data-protection-id=sacrifice_r_0]')?.getAttribute('aria-pressed')==='true'",
      );
      assert.equal(control.posts.length, 1);
      assert.equal(control.posts[0].input.id, pending.id);
      assert.equal(control.ownedBeasts.find((b) => b.id === 'sacrifice_r_0').isProtected, true);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a protection response updates a newly opened detail without closing or replacing it',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const api = control.beastApi;
    const released = Promise.withResolvers(),
      started = Promise.withResolvers();
    control.beastApi = async (request, endpoint) => {
      if (request.method === 'POST') {
        started.resolve();
        await released.promise;
      }
      return api(request, endpoint);
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.evaluate(
        "document.querySelector('[data-protection-id=sacrifice_r_0]').click()",
      );
      await started.promise;
      await browser.evaluate(
        "document.querySelector('.beast-collection-card[data-beast-id=sacrifice_r_0]').click();window.newDetailTitle=document.querySelector('.sheet-title-row');window.newDetailImage=document.querySelector('.beast-detail-image')",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-detail-identity-row .beast-protection').getAttribute('aria-pressed')",
        ),
        'true',
      );
      released.resolve();
      await browser.wait(
        "document.querySelector('.beast-detail-identity-row .beast-protection').dataset.protectionStatus==='saved'",
      );
      assert.equal(
        await browser.evaluate(
          "newDetailTitle===document.querySelector('.sheet-title-row') && newDetailImage===document.querySelector('.beast-detail-image') && document.querySelector('#sheet').open",
        ),
        true,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      released.resolve();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'protection stars stay separate from details; sacrifice retains multi-species selections, banks points and preserves discoveries',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      await browser.evaluate(
        "document.querySelector('.beast-collection-card[data-beast-id=sacrifice_r_0]').parentElement.querySelector('.beast-protection').click()",
      );
      await browser.wait(
        "document.querySelector('.beast-collection-card[data-beast-id=sacrifice_r_0]')?.parentElement.querySelector('.beast-protection').getAttribute('aria-pressed')==='true' && document.querySelector('[data-protection-id=sacrifice_r_0]')?.dataset.protectionStatus==='saved'",
      );
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
      assert.equal(control.posts.filter((p) => p.input.operation === 'protect').length, 1);
      await shot(browser, 'sacrifice-stars');
      await browser.click('Tải tiếp các cá thể');
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===26");
      for (const value of ['true', 'false']) {
        await browser.evaluate(
          "document.querySelector('.beast-collection-card[data-beast-id=sacrifice_r_25]').parentElement.querySelector('.beast-protection').click()",
        );
        await browser.wait(
          "document.querySelector('.beast-collection-card[data-beast-id=sacrifice_r_25]')?.parentElement.querySelector('.beast-protection').getAttribute('aria-pressed')==='" +
            value +
            "'",
        );
        await browser.wait(
          "document.querySelector('[data-protection-id=sacrifice_r_25]')?.dataset.protectionStatus==='saved'",
        );
        assert.equal(
          await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
          26,
        );
      }
      await browser.click('Triệu hồi');
      await browser.tap('.beast-summon-exchange');
      assert.equal(
        await browser.evaluate(
          "document.querySelector('[data-exchange-tab=exchange]').getAttribute('aria-selected')",
        ),
        'true',
      );
      await browser.click('Hiến tế');
      await shot(browser, 'sacrifice-summary');
      await browser.click('Chọn linh thú');
      await browser.wait(
        "!document.querySelector('.beast-sacrifice .beast-atlas-entry')?.disabled",
      );
      await browser.click('R', '.beast-sacrifice-filters button');
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait(
        "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===24",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_r_0]').disabled",
        ),
        true,
      );
      for (let i = 1; i <= 6; i++)
        await browser.evaluate(
          `document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_r_${i}]').click()`,
        );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-sacrifice-submit').disabled"),
        true,
      );
      await browser.click('Tải tiếp các cá thể');
      await browser.wait(
        "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===26",
      );
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_r_25]').click()",
      );
      await browser.click('‹ Các loài linh thú');
      await browser.click('SSR', '.beast-sacrifice-filters button');
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-atlas-entry[data-species=frostnip]').click()",
      );
      await browser.wait(
        "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===2",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=beast_frost_fixture]').disabled",
        ),
        true,
      );
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_ssr]').click()",
      );
      await browser.click('‹ Các loài linh thú');
      await browser.click('UR', '.beast-sacrifice-filters button');
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-atlas-entry[data-species=pyropup]').click()",
      );
      await browser.wait(
        "!!document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_ur]')",
      );
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_ur]').click()",
      );
      assert.match(
        await browser.evaluate("document.querySelector('.beast-sacrifice-total').textContent"),
        /9 cá thể · 12 điểm/,
      );
      assert.match(
        await browser.evaluate("document.querySelector('.beast-sacrifice-result').textContent"),
        /Nhận 1 vé triệu hồi · Còn dư 4 điểm/,
      );
      await shot(browser, 'sacrifice-picker');
      await browser.click('Xem lại hiến tế');
      assert.equal(control.posts.filter((p) => p.input.operation === 'sacrifice').length, 0);
      assert.match(
        await browser.evaluate("document.querySelector('.beast-sacrifice').textContent"),
        /SSR \/ UR/,
      );
      await shot(browser, 'sacrifice-review');
      for (const [width, height, scale] of [
        [320, 568, 1],
        [740, 360, 1],
        [390, 844, 2],
      ]) {
        await browser.resize(width, height);
        await browser.scaleText(scale);
        assert.equal(
          await browser.evaluate('document.documentElement.scrollWidth>innerWidth+1'),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet').scrollWidth>document.querySelector('#sheet').clientWidth+1",
          ),
          false,
        );
      }
      await browser.scaleText(1);
      await browser.resize(390, 844);
      const tickets = control.beastData.account.state.summonTickets;
      await browser.click('Hiến tế 9 cá thể');
      await browser.wait(
        "document.querySelector('.beast-sacrifice-balance')?.textContent.includes('4/10')",
      );
      assert.equal(control.beastData.account.state.summonTickets, tickets + 1);
      assert.equal(
        control.ownedBeasts.some((b) => b.id === 'sacrifice_ur'),
        false,
      );
      assert.equal(control.ownedBeasts.find((b) => b.id === 'sacrifice_r_0').isProtected, true);
      assert.equal(control.posts.filter((p) => p.input.operation === 'sacrifice').length, 1);
      await browser.press('Escape');
      await browser.click('Bộ sưu tập');
      await browser.click('‹ Bộ sưu tập');
      await browser.wait(
        "document.querySelector('.beast-atlas-entry[data-species=pyropup]')?.textContent.includes('0 cá thể')",
      );
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=pyropup]').click()",
      );
      await browser.wait(
        "document.querySelector('.beast-collection-heading')?.textContent.includes('0 cá thể')",
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
        0,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a sacrifice whose response is lost recovers from its receipt without consuming twice',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    sacrificeInventory(control);
    const api = control.beastApi;
    let lost = false;
    control.beastApi = async (request, endpoint) => {
      const response = await api(request, endpoint);
      if (!lost && request.method === 'POST' && response.body?.result?.sacrificedIds) {
        lost = true;
        return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
      }
      return response;
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await openSummon(browser, server.url);
      await browser.tap('.beast-summon-exchange');
      await browser.click('Hiến tế');
      await browser.click('Chọn linh thú');
      await browser.wait(
        "!document.querySelector('.beast-sacrifice .beast-atlas-entry')?.disabled",
      );
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-atlas-entry[data-species=gibber]').click()",
      );
      await browser.wait(
        "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===24",
      );
      for (let i = 0; i < 8; i++)
        await browser.evaluate(
          `document.querySelector('.beast-sacrifice .beast-collection-card[data-beast-id=sacrifice_r_${i}]').click()`,
        );
      await browser.click('Xem lại hiến tế');
      await browser.click('Hiến tế 8 cá thể');
      await browser.wait(
        "document.querySelector('.beast-sacrifice').textContent.includes('Kiểm tra kết quả')",
      );
      const committedTickets = control.beastData.account.state.summonTickets;
      assert.equal(control.ownedBeasts.length, 21);
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      await browser.click('Kiểm tra kết quả');
      await browser.wait("sessionStorage.getItem('minh-anh-beast-pending-v1')===null");
      await browser.click('Triệu hồi');
      await browser.tap('.beast-summon-exchange');
      await browser.click('Hiến tế');
      await browser.wait(
        "document.querySelector('.beast-sacrifice-balance')?.textContent.includes('0/10') && !document.querySelector('.beast-sacrifice').textContent.includes('Có thao tác chưa xác nhận')",
      );
      assert.equal(control.beastData.account.state.summonTickets, committedTickets);
      assert.equal(control.ownedBeasts.length, 21);
      assert.equal(control.posts.filter((p) => p.input.operation === 'sacrifice').length, 1);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

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
      await browser.wait('document.querySelector(".beast-updating").textContent===""');
      assert.equal(
        await browser.evaluate(
          'document.querySelectorAll(".beast-page--summon > .text-button").length',
        ),
        0,
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
        'Historical receipts do not add controls below the panel',
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
      for (const [width, scale] of [
        [320, 1],
        [320, 2],
        [390, 1.3],
        [1440, 1],
      ]) {
        await browser.resize(width, 844);
        for (const theme of ['light', 'dark']) {
          await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
          await browser.scaleText(scale);
          const candidates = await browser.evaluate(`(() => {
            const content=document.querySelector('#sheet-content'),v=content.getBoundingClientRect();
            return [...content.querySelectorAll('.beast-picker-item')].map(button=>{
              const copy=button.querySelector('.beast-picker-copy'),name=copy.querySelector('strong'),rank=copy.querySelector('small');
              const image=button.querySelector('img').getBoundingClientRect(),n=name.getBoundingClientRect(),r=rank.getBoundingClientRect();
              return {name:name.textContent,rank:rank.textContent,
                aligned:n.left>=image.right+8 && Math.abs(n.left-r.left)<1 && n.bottom<=r.top+1,
                inside:n.right<=v.left+content.clientWidth+1,
                clipped:name.scrollWidth>name.clientWidth+1 || name.scrollHeight>name.clientHeight+1};
            });
          })()`);
          assert.deepEqual(
            candidates.map(({ name, rank }) => ({ name, rank })),
            control.beastData.summonChoice.candidates.map((id) => {
              const species = control.beastData.config.catalog.find((s) => s.id === id);
              return { name: species.forms[0], rank: species.rank };
            }),
          );
          assert.ok(
            candidates.every(
              (candidate) => candidate.aligned && candidate.inside && !candidate.clipped,
            ),
            JSON.stringify({ width, scale, theme, candidates }),
          );
          await browser.evaluate("document.querySelector('#sheet-content').scrollTop=0");
          await shot(browser, `vietnamese-candidates-${width}-${theme}-text${scale}`);
          await browser.scaleText(1);
        }
      }
      await browser.resize(390, 844);
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
        'Tiểu Miên Dương',
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
      await browser.reducedMotion();
      await browser.evaluate(
        'document.querySelector("[data-reveal=summary-replay]").scrollIntoView({block:"center"})',
      );
      await browser.tap('[data-reveal=summary-replay]');
      await browser.wait('!!document.querySelector(".beast-reveal.is-revealed:not(.is-summary)")');
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
      await browser.wait('!!document.querySelector(".beast-reveal.is-summary")');
      assert.equal(control.posts.length, posts);
      assert.equal(control.beastData.account.state.summonTickets, balance);
      await browser.evaluate(
        'document.querySelector("[data-reveal=summary-replay]").scrollIntoView({block:"center"})',
      );
      await browser.tap('[data-reveal=summary-replay]');
      await browser.wait('!!document.querySelector(".beast-reveal.has-canvas")');
      await browser.evaluate('document.querySelector("[data-tab=today]").click()');
      await browser.wait('!document.querySelector(".beast-reveal")');
      await browser.evaluate('document.querySelector("[data-tab=beasts]").click()');
      await browser.wait('!!document.querySelector(".beast-page--summon")');
      assert.equal(
        await browser.evaluate(
          'document.querySelectorAll(".beast-page--summon > .text-button").length',
        ),
        0,
      );
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
        'Hỏa Khuyển Con',
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
