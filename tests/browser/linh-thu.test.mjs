import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { BEAST_ART } from '../../web/assets/linh-thu/art.js';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';
import { beastFixture } from './linh-thu-fixture.mjs';

test(
  'protection SVG and detail identity row keep their geometry, artwork and focus across themes and enlarged text',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      seed = clone(control.ownedBeasts[0]);
    control.ownedBeasts.push({
      ...seed,
      id: 'protected_detail_beast',
      attemptId: 'protected_detail_attempt',
      isProtected: true,
    });
    control.beastData.speciesCounts = { frostnip: 2 };
    const server = await serve(control);
    let browser;
    const out = `trial-results/linh-thu/protection/run-${process.pid}`;
    try {
      await mkdir(out, { recursive: true });
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Bộ sưu tập');
      await browser.evaluate(
        "document.querySelector('.beast-atlas-entry[data-species=frostnip]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===2");
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const [width, scale] of [
          [320, 1],
          [390, 2],
        ]) {
          await browser.resize(width, 844);
          await browser.scaleText(scale);
          const geometry = await browser.evaluate(`(()=>{
          const stars=[...document.querySelectorAll('.beast-protection')];
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,
            stars:stars.map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector('svg').getBoundingClientRect(),rank=b.parentElement.querySelector('.beast-card-rank').getBoundingClientRect(),img=b.parentElement.querySelector('img').getBoundingClientRect();return {width:r.width,height:r.height,iconWidth:svg.width,iconHeight:svg.height,clipped:b.scrollWidth>b.clientWidth||b.scrollHeight>b.clientHeight,background:getComputedStyle(b).backgroundColor,rankClear:rank.right<=r.left,imageClear:r.bottom<=img.top+1};}),
            colors:stars.map(b=>({fill:getComputedStyle(b.querySelector('svg')).fill,stroke:getComputedStyle(b.querySelector('svg')).stroke})),nested:!!document.querySelector('button button')};
        })()`);
          assert.equal(geometry.overflow, false);
          assert.equal(geometry.nested, false);
          for (const star of geometry.stars)
            assert.deepEqual(star, {
              width: 44,
              height: 44,
              iconWidth: 20,
              iconHeight: 20,
              clipped: false,
              background: 'rgba(0, 0, 0, 0)',
              rankClear: true,
              imageClear: true,
            });
          assert.notEqual(geometry.colors[0].fill, geometry.colors[1].fill);
          await browser.screenshot(`${out}/collection-${theme}-${width}-${scale}.png`);
          await browser.scaleText(1);
        }
      }
      await browser.resize(390, 844);
      await browser.evaluate(
        "document.querySelector('.beast-collection-card[data-beast-id=protected_detail_beast]').click()",
      );
      await browser.wait(
        "!!document.querySelector('.beast-detail-identity-row .beast-protection')",
      );
      const layout = await browser.evaluate(`(()=>{
      const row=document.querySelector('.beast-detail-identity-row'),star=row.querySelector('.beast-protection'),img=document.querySelector('.beast-detail-image');
      window.identityRow=row;window.detailImage=img;window.detailStar=star;window.detailTitle=document.querySelector('.sheet-title-row');
      star.focus({preventScroll:true});
      const sr=star.getBoundingClientRect(),ir=img.getBoundingClientRect();
      return {aboveArt:sr.bottom<ir.top,onRight:sr.left>row.getBoundingClientRect().left+row.getBoundingClientRect().width/2,identity:row.textContent.includes('#2'),pressed:star.getAttribute('aria-pressed')};
    })()`);
      assert.deepEqual(layout, { aboveArt: true, onRight: true, identity: true, pressed: 'true' });
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        await browser.screenshot(`${out}/detail-${theme}.png`);
        await browser.scaleText(2);
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet').scrollWidth>document.querySelector('#sheet').clientWidth+1",
          ),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.beast-detail-identity-row .beast-protection svg').getBoundingClientRect().width",
          ),
          20,
        );
        await browser.screenshot(`${out}/detail-${theme}-large.png`);
        await browser.scaleText(1);
      }
      await browser.evaluate('detailStar.focus({preventScroll:true});detailStar.click()');
      await browser.wait(
        "detailStar.dataset.protectionStatus==='saved' && detailStar.getAttribute('aria-pressed')==='false'",
      );
      assert.deepEqual(
        await browser.evaluate(
          "({row:identityRow===document.querySelector('.beast-detail-identity-row'),image:detailImage===document.querySelector('.beast-detail-image'),star:detailStar===document.querySelector('.beast-detail-identity-row .beast-protection'),title:detailTitle===document.querySelector('.sheet-title-row'),focused:document.activeElement===detailStar,gridStar:document.querySelector('#content [data-protection-id=protected_detail_beast]').getAttribute('aria-pressed')})",
        ),
        { row: true, image: true, star: true, title: true, focused: true, gridStar: 'false' },
      );
      assert.equal(
        control.ownedBeasts.find((b) => b.id === 'protected_detail_beast').isProtected,
        false,
      );
      await browser.press('Escape');
      await browser.click('Triệu hồi');
      await browser.tap('.beast-summon-exchange');
      await browser.evaluate("document.querySelector('[data-exchange-tab=sacrifice]').click()");
      await browser.tap('.beast-sacrifice-choose');
      await browser.wait(
        "!document.querySelector('.beast-sacrifice .beast-atlas-entry')?.disabled",
      );
      await browser.evaluate(
        "document.querySelector('.beast-sacrifice .beast-atlas-entry').click()",
      );
      await browser.wait(
        "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===2",
      );
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-sacrifice .beast-protection')].every(s=>s.disabled&&s.querySelector('svg')&&s.dataset.protectionReadonly==='true')",
        ),
        true,
      );
      await browser.screenshot(`${out}/sacrifice-readonly.png`);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'role tabs retain decoded images, navigation focus and scroll during refresh and rapid switching',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let browser, held;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero img')");
      const before = await browser.evaluate(`(() => {
        window.roleImage = document.querySelector('.beast-hero > img');
        window.roleHero = document.querySelector('.beast-hero');
        window.roleTabs = document.querySelector('.beast-tabs');
        scrollTo({top:80,behavior:'instant'});
        return {scroll:scrollY,top:window.roleHero.getBoundingClientRect().top};
      })()`);
      await browser.evaluate(
        "document.querySelectorAll('.beast-tab')[1].focus({preventScroll:true});document.querySelectorAll('.beast-tab')[1].click()",
      );
      assert.deepEqual(
        await browser.evaluate(`({
        scroll:scrollY,top:document.querySelector('.beast-hero').getBoundingClientRect().top,
        sameImage:window.roleImage===document.querySelector('.beast-hero > img'),
        sameHero:window.roleHero===document.querySelector('.beast-hero'),
        sameTabs:window.roleTabs===document.querySelector('.beast-tabs'),
        focused:document.activeElement===document.querySelectorAll('.beast-tab')[1]
      })`),
        { ...before, sameImage: true, sameHero: true, sameTabs: true, focused: true },
      );
      held = holdRead(control, 'linh-thu');
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await held.started;
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-hero').getBoundingClientRect().top"),
        before.top,
      );
      held.release();
      await finishRead(browser, 'linh-thu', 1);
      assert.equal(
        await browser.evaluate("window.roleImage===document.querySelector('.beast-hero > img')"),
        true,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-hero').getBoundingClientRect().top"),
        before.top,
      );
      await browser.evaluate("scrollTo({top:0,behavior:'instant'})");
      const positions = await browser.evaluate(`(() => {
        const tops=[];
        for(const index of [0,1,3,2,0]) {
          document.querySelectorAll('.beast-tab')[index].click();
          tops.push(document.querySelector('.beast-tabs').getBoundingClientRect().top);
        }
        return tops;
      })()`);
      assert.equal(
        new Set(positions).size,
        1,
        'All four panels share the same navigation geometry',
      );
      const other = {
        ...clone(control.beastData.selected[0]),
        id: 'other_companion',
        attemptId: 'other_attempt',
        speciesId: 'pyropup',
        attempt: { speciesId: 'pyropup', ruleVersion: 1, status: 'training', earned: 0, gray: 0 },
      };
      control.beastData.selected.push(other);
      Object.assign(
        control.beastData.roles.current.find((role) => role.role === 'companion'),
        { beastId: other.id, attemptId: other.attemptId },
      );
      await browser.networkConditions(false, 120, 30000);
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await finishRead(browser, 'linh-thu', 2);
      await browser.wait("document.querySelector('.beast-updating')?.textContent===''");
      await browser.evaluate(
        "for(const i of [1,0,1,0,1]) document.querySelectorAll('.beast-tab')[i].click()",
      );
      assert.deepEqual(
        await browser.evaluate(
          "({name:document.querySelector('.beast-hero img').alt,ready:document.querySelector('.beast-hero img').complete && document.querySelector('.beast-hero img').naturalWidth>0})",
        ),
        { name: 'Pyropup', ready: true },
      );
      await browser.evaluate(`document.querySelectorAll('.beast-tab')[3].click();
        window.summonButton=document.querySelector('.beast-summon-actions .primary');
        window.summonButton.focus();window.dispatchEvent(new Event('focus'))`);
      assert.equal(
        await browser.evaluate(
          "window.summonButton===document.querySelector('.beast-summon-actions .primary') && document.activeElement===window.summonButton",
        ),
        true,
        'Starting a background refresh cannot replace a button under the finger',
      );
      await browser.wait("document.querySelector('.beast-updating')?.textContent===''");
      assert.equal(
        await browser.evaluate(
          "window.summonButton===document.querySelector('.beast-summon-actions .primary') && document.activeElement===window.summonButton",
        ),
        true,
        'Finishing an unchanged refresh preserves the button and focus',
      );
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      held?.release();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'species collection conceals unknown beasts, finds the highest owned form across pages and opens only that species',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    const first = clone(control.beastData.selected[0]);
    Object.assign(first.attempt, { earned: 0, gray: 0 });
    const highest = {
      ...clone(control.beastData.selected[0]),
      id: 'highest_frost',
      attemptId: 'highest_attempt',
    };
    const other = {
      ...clone(first),
      id: 'other_pyro',
      speciesId: 'pyropup',
      attemptId: 'pyro_attempt',
      attempt: { ...first.attempt, speciesId: 'pyropup' },
    };
    control.beastData.speciesCounts = { frostnip: 2, pyropup: 1 };
    control.ownedBeasts = [first, other, highest];
    const requests = [];
    control.beastApi = (request, endpoint) => {
      if (endpoint === 'linh-thu/collection') {
        const params = new URL(request.url, 'http://localhost').searchParams;
        const species = params.get('species'),
          index = Number(params.get('cursor') ?? 0);
        requests.push({ species, index });
        const beasts = control.ownedBeasts.filter(
          (beast) => !species || beast.speciesId === species,
        );
        return {
          body: {
            beasts: beasts.slice(index, index + 1),
            nextCursor: index + 1 < beasts.length ? String(index + 1) : null,
          },
        };
      }
      return original(request, endpoint);
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Bộ sưu tập');
      await browser.wait(
        "document.querySelector('[data-species=frostnip] img')?.alt==='Frostique'",
      );
      assert.deepEqual(
        await browser.evaluate(`({
        slots:document.querySelectorAll('.beast-atlas-entry').length,
        individuals:document.querySelectorAll('.beast-collection-card').length,
        unknown:document.querySelectorAll('.beast-atlas-entry.is-unowned .beast-paw').length,
        leaked:[...document.querySelectorAll('.beast-atlas-entry.is-unowned')].some(e=>e.querySelector('img')||e.dataset.species||e.dataset.rank||!e.disabled),
        count:document.querySelector('[data-species=frostnip] small').textContent
      })`),
        { slots: 18, individuals: 0, unknown: 16, leaked: false, count: 'SSR · 2 cá thể' },
      );
      assert.deepEqual(
        requests,
        [{ species: null, index: 0 }],
        'Atlas never drains inventory pages',
      );
      await browser.evaluate(
        "scrollTo({top:120,behavior:'instant'});document.querySelector('[data-species=frostnip]').click()",
      );
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===1");
      assert.deepEqual(requests.at(-1), { species: 'frostnip', index: 0 });
      await browser.click('Tải tiếp các cá thể');
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===2");
      assert.deepEqual(requests.at(-1), { species: 'frostnip', index: 1 });
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-collection-card img')].map(e=>e.alt)",
        ),
        ['Frostnip', 'Frostique'],
      );
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
      await browser.evaluate(
        "const card=document.querySelectorAll('.beast-collection-card')[1];card.focus();card.click()",
      );
      await browser.wait("document.querySelector('#sheet').open");
      await browser.press('Escape');
      await browser.wait("!document.querySelector('#sheet').open");
      assert.equal(await browser.evaluate('document.activeElement.dataset.beastId'), highest.id);
      await browser.click('‹ Bộ sưu tập');
      assert.equal(await browser.evaluate('scrollY'), 120);
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'alchemy stays compact, explains guarantee, locks pending writes, and pages the reset picker',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    Object.assign(control.beastData.account.state.alchemy, { days: 30, failures: 2, inventory: 2 });
    const eligible = {
      ...clone(control.beastData.selected[0]),
      id: 'sealed_fixture',
      attemptId: 'sealed_attempt',
      attempt: { ...control.beastData.selected[0].attempt, status: 'sealed' },
    };
    let page = 0;
    const committed = Promise.withResolvers(),
      reply = Promise.withResolvers();
    control.beastApi = async (request, endpoint) => {
      if (endpoint === 'linh-thu/collection') {
        const more = new URL(request.url, 'http://localhost').searchParams.has('cursor');
        page++;
        return {
          body: {
            beasts: more ? [eligible] : [control.beastData.selected[0]],
            nextCursor: more ? null : 'page_two',
          },
        };
      }
      const result = await original(request, endpoint);
      if (request.method === 'POST') {
        committed.resolve();
        await reply.promise;
      }
      return result;
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.reducedMotion();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Lò đan · 30/30');
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-alchemy-chance').textContent"),
        'Mẻ tiếp theo chắc chắn thành công',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-alchemy-rules').open"),
        false,
      );
      for (const [width, height] of [
        [320, 640],
        [390, 844],
        [1440, 900],
      ]) {
        await browser.resize(width, height);
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet').scrollWidth>document.querySelector('#sheet').clientWidth",
          ),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.beast-alchemy-craft').getBoundingClientRect().bottom>innerHeight",
          ),
          false,
        );
      }
      await browser.click('Dùng đan · Chọn linh thú');
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.beast-elixir-picker .beast-picker-item').length",
        ),
        0,
      );
      await browser.click('Tải thêm linh thú');
      await browser.wait(
        "document.querySelectorAll('.beast-elixir-picker .beast-picker-item').length===1",
      );
      assert.ok(page >= 2);
      await browser.click('Trở lại Lò đan');
      await browser.click('Luyện Tịnh Linh Đan');
      await committed.promise;
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-alchemy-craft').disabled"),
        true,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-alchemy-craft').textContent"),
        'Đang luyện…',
      );
      await browser.evaluate("document.querySelector('.beast-alchemy-craft').click()");
      assert.equal(control.posts.length, 1);
      reply.resolve();
      await browser.wait("!!document.querySelector('.beast-alchemy-result')");
      assert.equal(control.beastData.account.state.alchemy.inventory, 3);
      await browser.click('Trở lại Lò đan');
      assert.equal(await browser.evaluate("document.querySelector('progress').value"), 0);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-alchemy-craft').disabled"),
        true,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      reply.resolve();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'species pages ignore late navigation and refresh responses while role pickers keep independent inventory pages',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    const frost = control.beastData.selected[0];
    const other = {
      ...clone(frost),
      id: 'other_pyro',
      attemptId: 'other_attempt',
      speciesId: 'pyropup',
      attempt: { ...frost.attempt, speciesId: 'pyropup' },
    };
    control.ownedBeasts = [
      frost,
      ...Array.from({ length: 29 }, (_, i) => ({
        ...clone(frost),
        id: 'frost_page_' + i,
        attemptId: 'frost_attempt_' + i,
      })),
      other,
    ];
    control.beastData.speciesCounts = { frostnip: 30, pyropup: 1 };
    let pending;
    control.beastApi = async (request, endpoint) => {
      const result = await original(request, endpoint);
      const species = new URL(request.url, 'http://localhost').searchParams.get('species');
      if (endpoint === 'linh-thu/collection' && species === 'frostnip' && pending) {
        const held = pending;
        pending = null;
        held.started.resolve();
        await held.reply.promise;
      }
      return result;
    };
    const hold = () =>
      (pending = { started: Promise.withResolvers(), reply: Promise.withResolvers() });
    const server = await serve(control);
    let browser, held;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Bộ sưu tập');
      held = hold();
      await browser.evaluate("document.querySelector('[data-species=frostnip]').click()");
      await held.started.promise;
      await browser.click('‹ Bộ sưu tập');
      await browser.evaluate("document.querySelector('[data-species=pyropup]').click()");
      await browser.wait(
        "document.querySelector('.beast-collection-card')?.dataset.beastId==='other_pyro'",
      );
      const before = control.collectionRequests.length;
      held.reply.resolve();
      await finishRead(browser, 'linh-thu/collection', before - 1);
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
        1,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-collection-card').dataset.beastId"),
        other.id,
      );
      await browser.click('‹ Bộ sưu tập');
      await browser.evaluate("document.querySelector('[data-species=frostnip]').click()");
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===24");
      held = hold();
      await browser.click('Tải tiếp các cá thể');
      await held.started.promise;
      const reads = await browser.evaluate(
        "performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/api/linh-thu').length",
      );
      control.beastData.account.version++;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await finishRead(browser, 'linh-thu', reads);
      await browser.wait(
        "document.querySelectorAll('.beast-collection-card').length===24 && document.querySelector('.beast-updating')?.textContent===''",
      );
      const finished = control.collectionRequests.length;
      held.reply.resolve();
      await finishRead(browser, 'linh-thu/collection', finished - 1);
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
        24,
        'Old load-more cannot append into a refreshed page',
      );
      await browser.click('Đồng hành');
      await browser.click('Đổi đồng hành');
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-picker-item').length"),
        24,
      );
      await browser.click('Tải thêm linh thú');
      await browser.wait("document.querySelectorAll('.beast-picker-item').length===31");
      assert.equal(
        control.collectionRequests.at(-1).species,
        null,
        'Picker never inherits the species filter',
      );
      assert.equal(control.collectionRequests.at(-1).start, 24);
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      held?.reply.resolve();
      pending?.reply.resolve();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'tower shows each missing requirement and retries a failed read instead of offering stale actions',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    control.beastApi = async (request, endpoint) => {
      if (endpoint === 'linh-thu/tower')
        return {
          body: {
            eligibility: {
              day: control.habits.day.day,
              achieved: 2,
              missed: 0,
              taskId: null,
              eligible: false,
            },
            run: null,
            account: control.beastData.account,
            wallet: control.beastData.wallet,
          },
        };
      return original(request, endpoint);
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
      await browser.wait("!!document.querySelector('.beast-tower-entry')");
      await browser.click('Vào tháp');
      await browser.wait("!!document.querySelector('.tower-conditions')");
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('.tower-conditions p')].map(node=>node.textContent)",
        ),
        ['○ Hoàn thành 1 công việc hợp lệ hôm nay'],
      );
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet .primary').disabled"),
        true,
      );
      await browser.press('Escape');
      control.failedReads = new Set(['linh-thu/tower']);
      await browser.click('Vào tháp');
      await browser.wait(
        "[...document.querySelectorAll('#sheet button')].some(button=>button.textContent==='Thử lại')",
      );
      assert.equal(await browser.evaluate("!!document.querySelector('.tower-conditions')"), false);
      control.failedReads.clear();
      await browser.click('Thử lại');
      await browser.wait("!!document.querySelector('.tower-conditions')");
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'purity artwork follows completed individuals across hero, collection and detail without leaking into previews or summons',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    const beast = control.beastData.selected[0];
    Object.assign(beast.attempt, { status: 'completed', earned: 1200, gray: 0 });
    const imperfect = {
      ...clone(beast),
      id: 'imperfect_frost',
      attemptId: 'imperfect_attempt',
      attempt: { ...beast.attempt, earned: 1140, gray: 60 },
    };
    const unfinished = {
      ...clone(beast),
      id: 'unfinished_frost',
      attemptId: 'unfinished_attempt',
      attempt: { ...beast.attempt, status: 'training', earned: 800, gray: 0 },
    };
    control.beastData.selected.push(imperfect, unfinished);
    control.beastApi = (request, endpoint) =>
      endpoint === 'linh-thu/collection'
        ? { body: { beasts: [beast, imperfect, unfinished], nextCursor: null } }
        : original(request, endpoint);
    // These bytes are only a network fixture for source selection, not new art.
    const fixtureImage = readFileSync(
      'web/assets/linh-thu/reference/ssr/frostnip/t4-frostluna.webp',
    );
    const art = {
      ...BEAST_ART,
      'frostnip:4:perfect': {
        full: 'fixture/perfect.webp',
        thumb: 'fixture/perfect-thumb.webp',
        kind: 'fixture',
      },
      'frostnip:4:awakened': {
        full: 'fixture/awakened.webp',
        thumb: 'fixture/awakened-thumb.webp',
        kind: 'fixture',
      },
    };
    control.staticFiles = new Map([
      [
        'assets/linh-thu/art.js',
        'export const BEAST_ART = Object.freeze(' + JSON.stringify(art) + ');',
      ],
      ['assets/linh-thu/fixture/perfect.webp', fixtureImage],
      ['assets/linh-thu/fixture/perfect-thumb.webp', fixtureImage],
      ['assets/linh-thu/fixture/awakened.webp', fixtureImage],
      ['assets/linh-thu/fixture/awakened-thumb.webp', fixtureImage],
    ]);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.reducedMotion();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "document.querySelector('.beast-hero img')?.dataset.artVariant==='perfect'",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-hero img').src.endsWith('/fixture/perfect.webp')",
        ),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.beast-hero img[data-art-variant=perfect]').length",
        ),
        1,
      );
      await browser.click('Chi tiết linh thú');
      await browser.wait(
        "document.querySelector('.beast-detail-image')?.dataset.artVariant==='perfect'",
      );
      await browser.evaluate(
        'document.querySelector(\'#sheet-content .beast-journey [data-form="3"]\').click()',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-detail-image').dataset.artVariant"),
        'normal',
      );
      await browser.evaluate(
        'document.querySelector(\'#sheet-content .beast-journey [data-form="4"]\').click()',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-detail-image').dataset.artVariant"),
        'perfect',
      );
      await browser.press('Escape');
      await browser.click('Bộ sưu tập');
      await browser.evaluate("document.querySelector('[data-species=frostnip]').click()");
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===3");
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-collection-card img')].map(image=>image.dataset.artVariant)",
        ),
        ['perfect', 'awakened', 'normal'],
      );
      await browser.evaluate("document.querySelectorAll('.beast-collection-card')[1].click()");
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-detail-image').dataset.artVariant"),
        'awakened',
      );
      await browser.press('Escape');
      await browser.click('Đồng hành');
      await browser.click('Đổi đồng hành');
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-picker-item img')].map(image=>image.dataset.artVariant)",
        ),
        ['perfect', 'awakened', 'normal'],
      );
      await browser.press('Escape');
      await browser.click('Triệu hồi');
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-summon-banner img').alt"),
        'Thẻ triệu hồi chưa mở · Ấn tinh tú',
      );
      await browser.tap('.beast-summon-actions .secondary');
      await browser.wait("!!document.querySelector('.beast-reveal.is-revealed img')");
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-reveal [data-reveal=beast-art]').dataset.artVariant",
        ),
        'normal',
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-reveal [data-reveal=beast-art]').alt",
        ),
        'Pyropup',
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'duplicate beasts show distinct identities and purity, select the intended companion and identify the exact reset target',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    const first = control.beastData.selected[0];
    Object.assign(first.attempt, { status: 'completed', earned: 1200, gray: 0 });
    const second = {
      ...clone(first),
      id: 'beast_frost_second',
      attemptId: 'attempt_second',
      attempt: { ...first.attempt, earned: 1140, gray: 60 },
    };
    const third = {
      ...clone(first),
      id: 'beast_frost_sealed',
      attemptId: 'attempt_sealed',
      attempt: { ...first.attempt, status: 'sealed', earned: 1000, gray: 100 },
    };
    control.beastData.selected.push(second, third);
    control.beastData.speciesCounts = { frostnip: 3 };
    control.beastData.account.state.alchemy.inventory = 1;
    control.beastApi = (request, endpoint) =>
      endpoint === 'linh-thu/collection'
        ? { body: { beasts: [first, second, third], nextCursor: null } }
        : original(request, endpoint);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 360);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Đổi linh thú luyện');
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-picker-item')].every(b=>b.disabled)",
        ),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.beast-picker-item')[2].textContent.includes('Đã khóa lượt · Cần đan')",
        ),
        true,
      );
      await browser.press('Escape');
      await browser.click('Đồng hành');
      await browser.click('Đổi đồng hành');
      const labels = await browser.evaluate(
        "[...document.querySelectorAll('.beast-picker-item')].map(b=>({text:b.textContent,disabled:b.disabled}))",
      );
      assert.ok(labels.every((label) => !label.disabled));
      assert.ok(labels[0].text.includes('100% · Hoàn mỹ'));
      assert.ok(labels[1].text.includes('95%') && labels[1].text.includes('6 xám'));
      assert.ok(labels[0].text.includes('Đang đồng hành'));
      assert.ok(labels[2].text.includes('90,9% · Đã khóa'));
      assert.equal(labels[2].text.includes('Tạm tính'), false);
      assert.equal(new Set(labels.map((label) => label.text)).size, 3);
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        await browser.scaleText(2);
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet-content').scrollWidth>document.querySelector('#sheet-content').clientWidth+1",
          ),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "[...document.querySelectorAll('.beast-picker-copy')].some(copy=>{const image=copy.previousElementSibling.getBoundingClientRect(),text=copy.getBoundingClientRect();return text.left<image.right-1})",
          ),
          false,
        );
        await browser.scaleText(1);
      }
      await browser.evaluate("document.querySelectorAll('.beast-picker-item')[1].click()");
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet-content').textContent.includes('#2')",
        ),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet-content').textContent.includes('114 điểm thực · 6 tạp chất')",
        ),
        true,
      );
      await browser.click('Xác nhận');
      await browser.wait("!document.querySelector('#sheet').open");
      assert.equal(control.posts[0].input.beastId, second.id);
      assert.equal(control.posts[0].input.role, 'companion');
      await browser.click('Bộ sưu tập');
      await browser.evaluate("document.querySelector('[data-species=frostnip]').click()");
      await browser.wait("document.querySelectorAll('.beast-collection-card').length===3");
      const cards = await browser.evaluate(
        "[...document.querySelectorAll('.beast-collection-card')].map(b=>b.textContent)",
      );
      assert.ok(cards[0].includes('#1') && cards[0].includes('100% · Hoàn mỹ'));
      assert.ok(cards[1].includes('#2') && cards[1].includes('95%'));
      await browser.evaluate("document.querySelectorAll('.beast-collection-card')[2].click()");
      await browser.click('Luyện lại bằng Tịnh Linh Đan');
      assert.ok(
        (await browser.evaluate("document.querySelector('#sheet-title').textContent")).includes(
          '#3',
        ),
      );
      assert.ok(
        (await browser.evaluate("document.querySelector('#sheet-content').textContent")).includes(
          '100 điểm thực và 10 tạp chất',
        ),
      );
      assert.equal(control.posts.length, 1, 'Reviewing a reset must not spend an elixir');
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

function holdRead(control, endpoint) {
  const started = Promise.withResolvers(),
    held = Promise.withResolvers();
  control.readGates ??= new Map();
  control.readGates.set(endpoint, () => {
    started.resolve();
    return held.promise;
  });
  return {
    started: started.promise,
    release() {
      control.readGates.delete(endpoint);
      held.resolve();
    },
  };
}

async function finishRead(browser, endpoint, previous = 0) {
  await browser.wait(
    `performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/api/${endpoint}'&&r.responseEnd>0).length>${previous}`,
  );
  await browser.evaluate(
    'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
  );
}

test(
  'empty accounts have no owned beasts or starter tickets and exchange rejects insufficient or fractional amounts',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    Object.assign(control.beastData, { selected: [], speciesCounts: {} });
    control.beastData.roles = { current: [], pending: [] };
    control.beastData.account.state.summonTickets = 0;
    control.beastData.wallet.state.tickets = 19;
    control.beastApi = (request, endpoint) =>
      endpoint === 'linh-thu/collection'
        ? { body: { beasts: [], nextCursor: null } }
        : original(request, endpoint);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 360);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-empty')");
      assert.equal(await browser.evaluate("!!document.querySelector('.beast-hero')"), false);
      await browser.click('Bộ sưu tập');
      await browser.wait("document.body.textContent.includes('0/18 loài')");
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-collection-card').length"),
        0,
      );
      await browser.click('Triệu hồi');
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-summon-actions button')].every(b=>b.disabled)",
        ),
        true,
      );
      await browser.tap('.beast-summon-exchange');
      await browser.wait("!!document.querySelector('#sheet[open]')");
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet .primary').disabled"),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-cost').textContent.includes('19 vé')",
        ),
        true,
      );
      await browser.press('Escape');
      // Let the collection read and queued dialog-close event finish before
      // changing the server fixture and testing a separate refresh.
      await browser.wait(
        "!document.querySelector('.feature-updating')&&!document.body.classList.contains('sheet-open')",
      );
      control.beastData.wallet.state.tickets = 60;
      // Changing the fixture only becomes visible after the real data reload.
      await browser.evaluate(
        "document.querySelector('[data-tab=today]').click();document.querySelector('[data-tab=beasts]').click()",
      );
      await browser.wait(
        "document.querySelector('.beast-summon-exchange')?.getAttribute('aria-label').includes('60 vé thường')",
      );
      await browser.tap('.beast-summon-exchange');
      for (const [value, disabled] of [
        ['0', true],
        ['1.5', true],
        ['4', true],
        ['3', false],
      ]) {
        await browser.evaluate(
          `(()=>{const input=document.querySelector('#sheet input');input.value='${value}';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
        );
        assert.equal(
          await browser.evaluate("document.querySelector('#sheet .primary').disabled"),
          disabled,
          value,
        );
      }
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'ultimate task pagination retains targets and a dismissed picker stays closed after its read finishes',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      beast = control.beastData.selected[0],
      first = control.state.tasks[0];
    beast.speciesId = 'manteeny';
    Object.assign(beast.attempt, {
      speciesId: 'manteeny',
      status: 'completed',
      earned: 800,
      gray: 0,
    });
    control.beastData.speciesCounts = { manteeny: 1 };
    control.state.tasks = Array.from({ length: 405 }, (_, index) => ({
      ...clone(first),
      id: 'task-' + index,
      public_code: index + 1,
      title: 'Task ' + index,
    }));
    const bootstrap = control.bootstrap;
    control.bootstrap = () => ({
      ...bootstrap(),
      tasks: control.state.tasks.slice(0, 2),
      activeTasksPage: { offset: 2, total: 405, hasMore: true },
    });
    const server = await serve(control);
    let browser, held;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Đồng hành');
      await browser.click('Xem tuyệt kỹ hoàn mỹ');
      await browser.evaluate("document.querySelector('.beast-target-option input').click()");
      await browser.click('Tải thêm task để chọn');
      await browser.wait("document.querySelectorAll('.beast-target-option').length===202");
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.beast-target-option input:checked').length",
        ),
        1,
      );
      held = holdRead(control, 'tasks-page');
      await browser.click('Tải thêm task để chọn');
      await held.started;
      await browser.press('Escape');
      held.release();
      await finishRead(browser, 'tasks-page', 1);
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
      await browser.click('Xem tuyệt kỹ hoàn mỹ');
      await browser.wait("document.querySelectorAll('.beast-target-option').length===402");
      await browser.evaluate(
        "document.querySelectorAll('.beast-target-option input')[0].click();document.querySelectorAll('.beast-target-option input')[200].click()",
      );
      await browser.click('Kích hoạt tuyệt kỹ tuần này');
      await browser.click('Xác nhận');
      await browser.wait("!document.querySelector('#sheet').open");
      // Confirmation closes before the asynchronous mutation reaches the server.
      await browser.wait("document.querySelector('#toast')?.textContent.includes('Đã kích hoạt')");
      assert.deepEqual(
        control.posts.filter((p) => p.input.operation === 'ultimate').map((p) => p.input.targets),
        [['task-0', 'task-200']],
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      held?.release();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'late collection, reward-choice and tower reads never reopen dismissed sheets or replace a newer one',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    control.beastData.drawChoices = [{ id: 'choice', picks: 1, candidates: ['qi1', 'qi2'] }];
    control.beastApi = (request, endpoint) =>
      endpoint === 'linh-thu/collection'
        ? {
            body: {
              beasts: [control.beastData.selected[0]],
              nextCursor: new URL(request.url, 'http://localhost').searchParams.has('cursor')
                ? null
                : 'next',
            },
          }
        : original(request, endpoint);
    const server = await serve(control);
    let browser, held;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Đổi linh thú luyện');
      const before = await browser.evaluate(
        "performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/api/linh-thu/collection').length",
      );
      held = holdRead(control, 'linh-thu/collection');
      await browser.click('Tải thêm linh thú');
      await held.started;
      await browser.press('Escape');
      await browser.click('Lò đan · 0/30');
      held.release();
      await finishRead(browser, 'linh-thu/collection', before);
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet-title').textContent"),
        'Lò đan',
      );
      await browser.press('Escape');
      const reads = await browser.evaluate(
        "performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/api/linh-thu').length",
      );
      held = holdRead(control, 'linh-thu');
      await browser.click('Chọn phần thưởng quay thường');
      await held.started;
      await browser.press('Escape');
      held.release();
      await finishRead(browser, 'linh-thu', reads);
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
      await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
      await browser.wait("!!document.querySelector('.beast-tower-entry')");
      await finishRead(browser, 'linh-thu/tower');
      const towerReads = await browser.evaluate(
        "performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/api/linh-thu/tower').length",
      );
      held = holdRead(control, 'linh-thu/tower');
      await browser.click('Vào tháp');
      await held.started;
      await browser.press('Escape');
      held.release();
      await finishRead(browser, 'linh-thu/tower', towerReads);
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      held?.release();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a committed elixir result updates inventory without taking over the sheet opened while awaiting its response',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    const committed = Promise.withResolvers(),
      reply = Promise.withResolvers();
    control.beastData.account.state.alchemy.days = 30;
    control.beastApi = async (request, endpoint) => {
      const result = await original(request, endpoint);
      if (request.method === 'POST') {
        committed.resolve();
        await reply.promise;
      }
      return result;
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Lò đan · 30/30');
      await browser.click('Luyện Tịnh Linh Đan');
      await committed.promise;
      await browser.press('Escape');
      await browser.click('Triệu hồi');
      await browser.evaluate(
        "document.querySelector('.beast-summon-rates').scrollIntoView({block:'center',behavior:'instant'})",
      );
      await browser.tap('.beast-summon-rates');
      await browser.wait(
        "document.querySelector('#sheet[open] #sheet-title')?.textContent==='Tỷ lệ và bảo hiểm'",
      );
      reply.resolve();
      await browser.wait("sessionStorage.getItem('minh-anh-beast-pending-v1')===null");
      await browser.wait(
        "document.body.textContent.includes('Tịnh Linh Đan đã thành · Đã cất vào kho.')",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet-title').textContent"),
        'Tỷ lệ và bảo hiểm',
      );
      assert.equal(control.beastData.account.state.alchemy.inventory, 1);
      assert.equal(control.posts.length, 1);
      await browser.press('Escape');
      await browser.click('Lò đan · 0/30');
      await browser.wait(
        "document.querySelector('#sheet-content').textContent.includes('Kho đan: 1')",
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      reply.resolve();
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'two browser clients reconcile a stale summon without spending or revealing a second result',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let first, second;
    try {
      first = await chrome();
      second = await chrome();
      for (const browser of [first, second]) {
        await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
        await browser.wait("!!document.querySelector('.beast-hero')");
        await browser.click('Triệu hồi');
      }
      await first.reducedMotion();
      await first.tap('.beast-summon-actions .primary');
      await first.wait("document.querySelectorAll('.beast-result-card').length===10");
      await second.evaluate("document.querySelector('.beast-summon-actions .primary').click()");
      await second.wait(
        "document.querySelector('.beast-wallet strong')?.getAttribute('aria-label')==='1 vé triệu hồi'",
      );
      assert.equal(control.beastData.account.state.summonTickets, 1);
      assert.equal(control.receipts.size, 1);
      assert.equal(control.posts.length, 2);
      assert.deepEqual(
        control.posts.map((p) => p.input.version),
        [1, 1],
      );
      assert.notEqual(control.posts[0].input.id, control.posts[1].input.id);
      assert.equal(await second.evaluate("!!document.querySelector('.beast-reveal')"), false);
      assert.equal(
        await second.evaluate("sessionStorage.getItem('minh-anh-beast-pending-v1')"),
        null,
      );
      assert.equal(
        await second.evaluate(
          "[...document.querySelectorAll('.beast-summon-actions button')].find(b=>b.textContent.includes('×10')).disabled",
        ),
        true,
      );
      assert.deepEqual([...first.errors, ...second.errors], []);
    } finally {
      await first?.close();
      await second?.close();
      await server.close();
    }
  },
);

test(
  'perfect companion exposes remaining ultimate progress, usable large-text dark sheets and keyboard dismissal',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      data = control.beastData;
    data.selected[0].attempt = {
      ...data.selected[0].attempt,
      earned: 1200,
      gray: 0,
      status: 'completed',
    };
    data.ultimate = {
      speciesId: 'rubblet',
      kind: 'meteor_guard',
      sleepRemaining: 1,
      breakthroughRemaining: 1,
      expiresAt: Date.now() + 86400000,
      cancelled: false,
      settled: false,
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 360);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero img')");
      await browser.click('Đồng hành');
      await browser.click('Xem tuyệt kỹ hoàn mỹ');
      await browser.wait(
        "document.querySelector('#sheet-content').textContent.includes('Còn 1 lượt bảo hộ ngủ')",
      );
      for (const theme of ['dark', 'light']) {
        await browser.colorScheme(theme);
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        await browser.scaleText(2);
        assert.equal(
          await browser.evaluate('document.documentElement.scrollWidth>innerWidth+1'),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet-content').scrollWidth>document.querySelector('#sheet-content').clientWidth+1",
          ),
          false,
        );
      }
      await browser.press('Tab');
      assert.equal(await browser.evaluate('document.activeElement!==document.body'), true);
      await browser.press('Escape');
      await browser.wait("!document.querySelector('#sheet[open]')");
      assert.equal(control.posts.length, 0);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'beast mobile navigation separates four panels, keeps gray anchored right, loads all art and commits before skippable reveal',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    Object.assign(control.beastData.selected[0].attempt, { form: 3, gray: 450 });
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero img')");
      for (const width of [360, 390, 768, 1024, 1440]) {
        await browser.resize(width, 900);
        const layout = await browser.evaluate(
          `(()=>{const bar=document.querySelector('.beast-progress-track').getBoundingClientRect(),gray=document.querySelector('.beast-progress-gray').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1, tabs:document.querySelectorAll('.beast-tab').length, grayRight:Math.abs(gray.right-bar.right),grayWidth:gray.width,buttons:[...document.querySelectorAll('.beast-tab')].map(b=>b.getBoundingClientRect().height)}})()`,
        );
        assert.equal(layout.overflow, false, 'width ' + width);
        assert.equal(layout.tabs, 4);
        assert.ok(layout.grayRight < 2);
        assert.ok(layout.grayWidth > 0);
        assert.ok(layout.buttons.every((height) => height >= 44));
      }
      await browser.resize(390, 900);
      await browser.scaleText(2);
      const large = await browser.evaluate(
        `(()=>{const copy=document.querySelector('.beast-hero-copy').getBoundingClientRect(),img=document.querySelector('.beast-hero img').getBoundingClientRect();return {overlap:Math.min(copy.right,img.right)>Math.max(copy.left,img.left)&&Math.min(copy.bottom,img.bottom)>Math.max(copy.top,img.top),tabs:[...document.querySelectorAll('.beast-tab')].map(b=>{const range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect(),box=b.getBoundingClientRect();return text.left>=box.left-1&&text.right<=box.right+1})}})()`,
      );
      assert.equal(large.overlap, false, 'Large text must not cover the character');
      assert.ok(large.tabs.every(Boolean), 'Each tab label must fit inside its own control');
      await browser.scaleText(1);
      await browser.click('Đồng hành');
      await browser.wait(
        "document.querySelector('.beast-role-label')?.textContent==='Đang đồng hành'",
      );
      assert.equal(await browser.evaluate("!!document.querySelector('.beast-hero img')"), true);
      await browser.click('Bộ sưu tập');
      await browser.wait("document.querySelectorAll('.beast-atlas-entry').length===18");
      await browser.evaluate(
        "document.querySelectorAll('.beast-atlas img').forEach(i=>i.loading='eager')",
      );
      await browser.wait(
        "[...document.querySelectorAll('.beast-atlas img')].every(i=>i.complete&&i.naturalWidth>0)",
      );
      await browser.click('Triệu hồi');
      await browser.wait("!!document.querySelector('.beast-summon-banner')");
      await browser.reducedMotion();
      assert.equal(
        await browser.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
        true,
      );
      await browser.tap('.beast-summon-actions .primary');
      await browser.wait("!!document.querySelector('dialog.beast-reveal[open]')");
      assert.equal(control.beastData.account.state.summonTickets, 1);
      assert.equal(control.posts.filter((post) => post.input.operation === 'summon').length, 1);
      await browser.wait("document.querySelectorAll('.beast-result-card').length===10");
      assert.equal(await browser.evaluate("!!document.querySelector('.beast-reveal-skip')"), true);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-reveal-counter').textContent"),
        'Linh thú 1 / 10',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-reveal').dataset.rank"),
        'UR',
      );
      await browser.tap('.beast-reveal-skip');
      await browser.wait("!!document.querySelector('.beast-reveal.is-summary')");
      await browser.click('Tiếp tục hành trình');
      await browser.click('Lò đan · 0/30');
      await browser.wait(
        "document.querySelector('#sheet-content')?.textContent.includes('30 ngày')||document.body.textContent.includes('0/30 ngày')",
      );
      assert.equal(control.posts.filter((post) => post.input.operation === 'summon').length, 1);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'Habit tower opens as a separate saved run and presents stop versus next-floor total reward',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 360);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
      await browser.wait("!!document.querySelector('.beast-tower-entry')");
      await browser.click('Vào tháp');
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Bắt đầu · Miễn phí'&&!b.disabled)",
      );
      await browser.click('Bắt đầu · Miễn phí');
      await browser.wait("document.querySelectorAll('.beast-tower-card').length===4");
      await browser.evaluate("document.querySelectorAll('.beast-tower-card')[1].click()");
      await browser.wait("!!document.querySelector('.beast-tower-claim')");
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-tower-continue').textContent.includes('3 vé thường')",
        ),
        true,
      );
      await browser.tap('.beast-tower-claim');
      await browser.wait("!!document.querySelector('.tower-receipt')");
      assert.deepEqual(
        control.posts.map((post) => post.input.operation),
        ['tower_start', 'tower_pick', 'tower_claim'],
      );
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'summon ambiguity survives a reload and recovers the original receipt without spending twice',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture(),
      original = control.beastApi;
    let loseAcknowledgement = true;
    control.beastApi = async (request, endpoint) => {
      const result = await original(request, endpoint);
      if (request.method === 'POST' && loseAcknowledgement) {
        loseAcknowledgement = false;
        return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
      }
      return result;
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero img')");
      await browser.click('Triệu hồi');
      await browser.tap('.beast-summon-actions .secondary');
      await browser.wait("!!sessionStorage.getItem('minh-anh-beast-pending-v1')");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      assert.equal(control.beastData.account.state.summonTickets, 10);
      const pending = await browser.evaluate(
        "JSON.parse(sessionStorage.getItem('minh-anh-beast-pending-v1'))",
      );
      assert.equal(pending.id, control.posts[0].input.id);
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      await browser.click('Kiểm tra kết quả');
      await browser.wait("!!document.querySelector('dialog.beast-reveal[open]')");
      assert.equal(control.posts.length, 1);
      assert.equal(control.beastData.account.state.summonTickets, 10);
      assert.equal(
        await browser.evaluate("sessionStorage.getItem('minh-anh-beast-pending-v1')"),
        null,
      );
      await browser.press('Escape');
      await browser.evaluate("document.querySelectorAll('.beast-tab')[3].click()");
      await browser.networkConditions(true, 0);
      await browser.tap('.beast-summon-actions .secondary');
      await browser.wait("!!sessionStorage.getItem('minh-anh-beast-pending-v1')");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      assert.equal(control.posts.length, 1, 'Offline intent has not reached the server');
      const offline = await browser.evaluate(
        "JSON.parse(sessionStorage.getItem('minh-anh-beast-pending-v1'))",
      );
      await browser.networkConditions(false, 0, 10000000);
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      await browser.click('Kiểm tra kết quả');
      await browser.wait("!!document.querySelector('dialog.beast-reveal[open]')");
      assert.equal(control.posts.length, 2);
      assert.equal(
        control.posts[1].input.id,
        offline.id,
        'Uncommitted offline intent retries its original identity',
      );
      assert.equal(control.beastData.account.state.summonTickets, 9);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
