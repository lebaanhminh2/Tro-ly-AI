import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, serve, chrome, browserBin } from './app-harness.mjs';

function cultivationFixture() {
  const control = fixture(),
    bootstrap = control.bootstrap;
  Object.assign(control.state.account.state, { qi: 3000, streak: 45, rank: 0, failures: 0 });
  control.state.account.state.inventory.supreme = 1;
  control.modifier = { chancePoints: 0, preventLoss: false, penaltyMultiplier: 1 };
  control.bootstrap = () => ({
    ...bootstrap(),
    beastV2: {
      active: true,
      day: control.habits.day.day,
      multiplier: control.modifier.penaltyMultiplier,
      breakthrough: control.modifier,
      selfBurnFinal: 36,
    },
  });
  return control;
}
async function achievements(browser, url) {
  await browser.navigate(url, 390);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
}
const description = (browser) =>
  browser.evaluate(
    "[...document.querySelectorAll('#sheet .hint')].find(el=>el.textContent.startsWith('Lần này có '))?.textContent",
  );

test(
  'v2 breakthrough refreshes the modifier before showing +5 chance, zero loss or triple penalty',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = cultivationFixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await achievements(browser, server.url);
      // Change after bootstrap: the sheet must fetch current state instead of using the old modifier.
      control.modifier = { chancePoints: 5, preventLoss: true, penaltyMultiplier: 1 };
      await browser.click('Đột phá');
      await browser.wait("!!document.querySelector('#sheet select')");
      assert.match(await description(browser), /^Lần này có 70%/);
      assert.match(await description(browser), /Thất bại −0 tu vi/);
      assert.match(await description(browser), /Mai Đá Hộ Thể/);
      await browser.evaluate(
        "document.querySelector('#sheet select').value='supreme';document.querySelector('#sheet select').dispatchEvent(new Event('change'))",
      );
      assert.match(await description(browser), /^Lần này có 95%/);
      await browser.press('Escape');
      await browser.wait(
        "document.querySelector('.breakthrough-card').textContent.includes('thất bại −0 tu vi')",
      );
      assert.match(
        await browser.evaluate("document.querySelector('.breakthrough-card').textContent"),
        /thất bại −0 tu vi/,
      );
      control.modifier = { chancePoints: 0, preventLoss: false, penaltyMultiplier: 3 };
      await browser.click('Đột phá');
      await browser.wait("!!document.querySelector('#sheet select')");
      assert.match(await description(browser), /^Lần này có 65%/);
      assert.match(await description(browser), /Thất bại −9 tu vi/);
      assert.match(await description(browser), /Hình phạt tu vi hôm nay nhân 3/);
      await browser.press('Escape');
      await browser.wait(
        "document.querySelector('.breakthrough-card').textContent.includes('thất bại −9 tu vi')",
      );
      assert.match(
        await browser.evaluate("document.querySelector('.breakthrough-card').textContent"),
        /thất bại −9 tu vi/,
      );
      control.modifier = { chancePoints: 0, preventLoss: false, penaltyMultiplier: 1 };
      await browser.click('Đột phá');
      await browser.wait("!!document.querySelector('#sheet select')");
      assert.match(await description(browser), /Thất bại −3 tu vi/);
      assert.doesNotMatch(await description(browser), /Mai Đá Hộ Thể|hôm nay nhân/);
      assert.equal(control.posts.length, 0, 'Previews must never perform a breakthrough');
      assert.equal(
        await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
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
  'v2 failed preview refresh offers retry and cannot enable stale breakthrough controls',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = cultivationFixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await achievements(browser, server.url);
      await browser.click('Đột phá');
      await browser.wait("!!document.querySelector('#sheet select')");
      await browser.press('Escape');
      control.failBootstrap = true;
      await browser.click('Đột phá');
      await browser.wait(
        "[...document.querySelectorAll('#sheet button')].some(el=>el.textContent==='Thử lại')",
      );
      assert.equal(await browser.evaluate("!!document.querySelector('#sheet select')"), false);
      control.failBootstrap = false;
      control.modifier = { chancePoints: 5, preventLoss: true, penaltyMultiplier: 1 };
      await browser.click('Thử lại');
      await browser.wait("!!document.querySelector('#sheet select')");
      assert.match(await description(browser), /^Lần này có 70%/);
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
