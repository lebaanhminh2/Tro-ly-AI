import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';
import { beastFixture } from './linh-thu-fixture.mjs';

const evidence = `output/sheet-layout/run-${process.pid}`;
const options = { skip: !browserBin, timeout: 90000 };
const frame = `(() => {
  const rect = selector => {
    const r = document.querySelector(selector)?.getBoundingClientRect();
    return r && {top:r.top, left:r.left, width:r.width, height:r.height, bottom:r.bottom};
  };
  return {
    sheet:rect('#sheet'), header:rect('.sheet-title-row'), close:rect('[data-sheet-close]'),
    tabs:rect('.beast-exchange-tabs'), footer:rect('.beast-sacrifice-footer'),
    filter:rect('.beast-sacrifice-filters'),
    overflow:document.querySelector('#sheet-content').scrollWidth > document.querySelector('#sheet-content').clientWidth + 1
  };
})()`;

function sameRect(actual, expected, label) {
  for (const key of ['top', 'left', 'width', 'height'])
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= 1,
      `${label}.${key}: ${actual[key]} / ${expected[key]}`,
    );
}

function inventory() {
  const control = beastFixture();
  const template = clone(control.ownedBeasts[0]);
  control.ownedBeasts.push(
    ...Array.from({ length: 26 }, (_, i) => ({
      ...clone(template),
      id: `layout_r_${i}`,
      speciesId: 'gibber',
      attemptId: `layout_attempt_${i}`,
      isProtected: false,
      attempt: {
        speciesId: 'gibber',
        ruleVersion: 1,
        status: 'ready',
        form: 1,
        earned: 0,
        gray: 0,
      },
    })),
  );
  control.beastData.speciesCounts.gibber = 26;
  return control;
}

async function boot(browser, url, width = 390) {
  await browser.navigate(url, width);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
}

async function summon(browser) {
  await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
  await browser.wait("!!document.querySelector('.beast-tabs')");
  await browser.evaluate("document.querySelectorAll('.beast-tab')[3].click()");
  await browser.wait("!!document.querySelector('.beast-summon-exchange')");
}

async function pinnedHeader(browser, label) {
  const before = await browser.evaluate(frame);
  const scrolled = await browser.evaluate(`(() => {
    const nodes = [...document.querySelectorAll('#sheet, #sheet-content, #sheet-content *')];
    let count = 0;
    for (const n of nodes) {
      if (['auto','scroll'].includes(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1) {
        n.scrollTop = n.scrollHeight;
        if (n.scrollTop > 0) count++;
      }
    }
    return count;
  })()`);
  const after = await browser.evaluate(frame);
  sameRect(after.sheet, before.sheet, label + ' frame');
  sameRect(after.header, before.header, label + ' header');
  sameRect(after.close, before.close, label + ' close');
  assert.equal(after.overflow, false, label + ' horizontal overflow');
  assert.ok(after.header.top >= after.sheet.top && after.close.bottom <= after.sheet.bottom, label);
  assert.equal(
    await browser.evaluate(`(() => {
    const c = document.querySelector('[data-sheet-close]'), r = c.getBoundingClientRect();
    return c.contains(document.elementFromPoint(r.left+r.width/2, r.top+r.height/2));
  })()`),
    true,
    label + ' close remains tappable',
  );
  return scrolled;
}

test(
  'exchange, sacrifice and empty rarity filters keep one frame, pinned controls and selection scroll',
  options,
  async () => {
    const control = inventory(),
      server = await serve(control);
    let browser;
    const measurements = [];
    try {
      browser = await chrome();
      await boot(browser, server.url);
      for (const [width, height, text] of [
        [320, 568, 1],
        [390, 844, 1],
        [740, 360, 1],
        [1440, 1000, 1],
        [390, 844, 2],
        [320, 568, 2],
      ]) {
        await browser.scaleText(1);
        await browser.resize(width, height);
        await summon(browser);
        await browser.tap('.beast-summon-exchange');
        await browser.scaleText(text);
        const initial = await browser.evaluate(frame);
        await browser.evaluate(
          "window.layoutTitle=document.querySelector('.sheet-title-row');window.layoutTabs=document.querySelector('.beast-exchange-tabs')",
        );
        await browser.tap('[data-exchange-tab=sacrifice]');
        await browser.evaluate(`(() => {
        for (let i=0;i<2 && !document.querySelector('.beast-sacrifice-choose');i++)
          document.querySelector('.beast-sacrifice [data-sacrifice-focus=back]')?.click();
      })()`);
        await browser.scaleText(text);
        const summary = await browser.evaluate(frame);
        sameRect(summary.sheet, initial.sheet, 'exchange / sacrifice');
        sameRect(summary.header, initial.header, 'exchange / sacrifice header');
        sameRect(summary.tabs, initial.tabs, 'exchange / sacrifice tabs');
        await browser.evaluate(
          "document.querySelector('.beast-sacrifice-choose').scrollIntoView({block:'nearest'})",
        );
        await browser.tap('.beast-sacrifice-choose');
        await browser.wait(
          "!document.querySelector('.beast-sacrifice .beast-atlas-entry')?.disabled",
        );
        await browser.scaleText(text);
        const all = await browser.evaluate(frame);
        for (const rank of ['SR', 'R', 'SSR', 'UR', 'all']) {
          await browser.tap(`[data-sacrifice-focus=rank-${rank}]`);
          await browser.scaleText(text);
          const filtered = await browser.evaluate(frame);
          sameRect(filtered.sheet, all.sheet, 'rarity ' + rank);
          sameRect(filtered.filter, all.filter, 'rarity filter ' + rank);
          sameRect(filtered.footer, all.footer, 'rarity footer ' + rank);
          assert.equal(
            await browser.evaluate(`document.activeElement.dataset.sacrificeFocus`),
            'rank-' + rank,
          );
          if (rank === 'SR')
            assert.equal(
              await browser.evaluate(
                "document.querySelector('.beast-sacrifice .beast-atlas').childElementCount",
              ),
              0,
            );
        }
        await browser.tap('[data-sacrifice-focus=rank-R]');
        await browser.evaluate(
          "document.querySelector('.beast-sacrifice [data-species=gibber]').click()",
        );
        await browser.wait(
          "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===24",
        );
        await browser.scaleText(text);
        assert.ok((await pinnedHeader(browser, `${width}x${height} text ${text}`)) > 0);
        const selection = await browser.evaluate(`(() => {
        const outer=document.querySelector('.beast-sacrifice'), outerBefore=outer.scrollTop;
        const body=document.querySelector('.beast-sacrifice-body');
        body.scrollTop=200;
        const before=body.scrollTop, c=document.querySelector('.beast-sacrifice [data-beast-id=layout_r_0]');
        c.focus({preventScroll:true}); c.click();
        return {before,after:document.querySelector('.beast-sacrifice-body').scrollTop,outerBefore,outerAfter:document.querySelector('.beast-sacrifice').scrollTop,focused:document.activeElement.dataset.beastId};
      })()`);
        // scaleText applies inline styles to existing nodes; replacement nodes are normal size.
        // Measure scroll retention at native text size and reapply large text for geometry checks.
        if (text === 1) {
          assert.equal(selection.after, selection.before, 'selection retains scroll');
          assert.equal(
            selection.outerAfter,
            selection.outerBefore,
            'selection retains compact layout scroll',
          );
        }
        assert.equal(selection.focused, 'layout_r_0');
        const beforeLoading = await browser.evaluate(
          "document.querySelector('.beast-sacrifice-body').scrollTop",
        );
        await browser.evaluate("document.querySelector('[data-sacrifice-focus=more]').click()");
        await browser.wait(
          "document.querySelectorAll('.beast-sacrifice .beast-collection-card').length===26",
        );
        assert.equal(
          await browser.evaluate("document.querySelector('.beast-sacrifice-body').scrollTop"),
          beforeLoading,
        );
        await browser.scaleText(text);
        await pinnedHeader(browser, `loaded individuals ${width} text ${text}`);
        await browser.tap('[data-exchange-tab=exchange]');
        await browser.scaleText(text);
        sameRect((await browser.evaluate(frame)).sheet, initial.sheet, 'return to exchange');
        assert.equal(
          await browser.evaluate(
            "layoutTitle===document.querySelector('.sheet-title-row')&&layoutTabs===document.querySelector('.beast-exchange-tabs')",
          ),
          true,
        );
        await browser.press('ArrowRight');
        assert.equal(
          await browser.evaluate('document.activeElement.dataset.exchangeTab'),
          'sacrifice',
        );
        await browser.press('Home');
        assert.equal(
          await browser.evaluate('document.activeElement.dataset.exchangeTab'),
          'exchange',
        );
        measurements.push({ width, height, text, initial, summary, all, selection });
        await mkdir(evidence, { recursive: true });
        await browser.screenshot(`${evidence}/exchange-${width}-text${text}.png`);
        await browser.tap('[data-sheet-close]');
        await browser.wait("!document.querySelector('#sheet').open");
      }
      assert.deepEqual(browser.errors, []);
      assert.equal(control.posts.length, 0);
      await writeFile(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'shared sheets and tower keep title and close visible while real content scrolls',
  options,
  async () => {
    const server = await serve(beastFixture());
    let browser;
    try {
      browser = await chrome();
      await boot(browser, server.url);
      for (const [width, height] of [
        [320, 568],
        [740, 360],
        [1440, 1000],
      ]) {
        await browser.resize(width, height);
        await summon(browser);
        for (const selector of ['.beast-summon-pool-link', '.beast-summon-rates']) {
          await browser.evaluate(`document.querySelector('${selector}').click()`);
          await browser.wait("document.querySelector('#sheet').open");
          await pinnedHeader(browser, selector + ' ' + width);
          await browser.tap('[data-sheet-close]');
          await browser.wait("!document.querySelector('#sheet').open");
        }
        await browser.evaluate(
          "document.querySelector('[data-tab=reminders]').click();document.querySelector('.top-create').click()",
        );
        await browser.wait("document.querySelector('#sheet').open");
        await pinnedHeader(browser, 'reminder ' + width);
        await browser.tap('[data-sheet-close]');
        await browser.wait("!document.querySelector('#sheet').open");
        await browser.evaluate("document.querySelector('#settings').click()");
        await pinnedHeader(browser, 'settings ' + width);
        await browser.click('Hướng dẫn nhanh', '#sheet button');
        await pinnedHeader(browser, 'help ' + width);
        await browser.tap('[data-sheet-close]');
        await browser.wait("!document.querySelector('#sheet').open");
        await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
        await browser.wait("!!document.querySelector('.beast-tower-entry')");
        await browser.evaluate("document.querySelector('.beast-tower-entry button').click()");
        await browser.wait(
          "!!document.querySelector('.tower-experience') && !document.querySelector('.tower-stage-title').textContent.includes('Đang mở')",
        );
        await pinnedHeader(browser, 'tower ' + width);
        await browser.tap('[data-sheet-close]');
        await browser.wait("!document.querySelector('#sheet').open");
      }
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
