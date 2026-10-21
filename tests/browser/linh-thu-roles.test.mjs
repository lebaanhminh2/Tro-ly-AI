import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';
import { beastFixture } from './linh-thu-fixture.mjs';
import { displayedRole, roleBeast } from '../../web/models/linh-thu.js';

const options = { skip: !browserBin, timeout: 60000 };
const output = `trial-results/linh-thu/roles/run-${process.pid}`;
function addBeast(control, id, speciesId = 'pyropup', earned = 0, gray = 0, status = 'ready') {
  const beast = {
    ...clone(control.beastData.selected[0] ?? control.ownedBeasts[0]),
    id,
    attemptId: id + '_attempt',
    speciesId,
    attempt: { speciesId, ruleVersion: 1, earned, gray, status },
  };
  control.ownedBeasts.push(beast);
  control.beastData.speciesCounts[speciesId] =
    (control.beastData.speciesCounts[speciesId] ?? 0) + 1;
  return beast;
}
async function open(browser, url, panel = 'training', width = 390) {
  await browser.navigate(url, width);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
  await browser.wait("document.querySelector('.beast-updating')?.textContent===''");
  if (panel === 'companion') await browser.click('Đồng hành');
}
async function choose(browser, role, beast, first = false) {
  await browser.click(
    first ? 'Chọn linh thú' : role === 'training' ? 'Đổi linh thú luyện' : 'Đổi đồng hành',
  );
  await browser.evaluate(
    `document.querySelector('.beast-picker-item[data-beast-id="${beast.id}"]').click()`,
  );
}
async function shown(browser, beast, pending = true) {
  await browser.wait(
    `document.querySelector('.beast-hero')?.dataset.beastId===${JSON.stringify(beast.id)}&&` +
      `document.querySelector('.beast-hero')?.hasAttribute('data-pending')===${pending}`,
  );
}
async function settled(browser) {
  await browser.wait(
    "document.querySelector('.beast-updating')?.textContent===''&&!sessionStorage.getItem('minh-anh-beast-pending-v1')",
  );
}
async function refresh(browser) {
  await browser.evaluate("window.dispatchEvent(new Event('focus'))");
  await settled(browser);
}
async function using(control, run) {
  const server = await serve(control);
  let browser;
  try {
    browser = await chrome();
    await run(browser, server.url);
    assert.deepEqual(browser.errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
}

test('displayed roles resolve exact pending attempts while effective roles remain current', () => {
  const control = beastFixture(),
    data = control.beastData;
  const current = data.selected[0];
  const next = {
    ...clone(current),
    attemptId: 'new_attempt',
    attempt: { ...current.attempt, earned: 0, gray: 0 },
  };
  data.selected.push(next);
  data.roles.pending.push({
    role: 'training',
    beastId: next.id,
    attemptId: next.attemptId,
    day: data.day.day + 1,
  });
  assert.equal(roleBeast(data, 'training'), current);
  assert.equal(displayedRole(data, 'training').displayed, next);
  assert.equal(displayedRole(data, 'companion').displayed, current);
  data.selected.pop();
  assert.equal(
    displayedRole(data, 'training').displayed,
    current,
    'Incomplete data cannot hide the effective beast',
  );
});

test(
  'first training and companion selections display immediately after confirmation, before a slow refresh',
  options,
  async () => {
    const control = beastFixture();
    control.beastData.roles.current = [];
    control.beastData.selected = [];
    const beast = control.ownedBeasts[0];
    Object.assign(beast.attempt, { earned: 0, gray: 0, status: 'ready' });
    const original = control.beastApi;
    let gate;
    control.beastApi = async (request, endpoint) => {
      if (request.method === 'GET' && endpoint === 'linh-thu' && gate) {
        const body = clone(control.beastData);
        await gate.promise;
        return { body };
      }
      const response = await original(request, endpoint);
      if (request.method === 'POST') gate = Promise.withResolvers();
      return response;
    };
    try {
      await using(control, async (browser, url) => {
        for (const role of ['training', 'companion']) {
          await open(browser, url, role);
          await choose(browser, role, beast, true);
          assert.equal(
            await browser.evaluate(
              "document.querySelector('#sheet-content').textContent.includes('sẽ khóa')",
            ),
            false,
          );
          await browser.click('Xác nhận');
          await shown(browser, beast);
          await browser.wait("!document.querySelector('#sheet').open");
          assert.equal(
            await browser.evaluate("document.querySelector('.beast-role-label').textContent"),
            role === 'training' ? 'Bắt đầu luyện từ ngày mai' : 'Hỗ trợ từ ngày mai',
          );
          assert.equal(
            await browser.evaluate(
              "!!document.querySelector('.beast-empty,.beast-role-today,.beast-notice')",
            ),
            false,
          );
          assert.equal(control.beastData.roles.current.length, 0);
          assert.equal(
            await browser.evaluate("!!document.querySelector('.beast-evolution-cards')"),
            role === 'training',
          );
          if (role === 'training') {
            assert.equal(
              await browser.evaluate(
                "document.querySelector('.beast-stage-numbers strong').textContent",
              ),
              '0',
            );
            assert.equal(
              await browser.evaluate("document.querySelector('.beast-stage-message').textContent"),
              'Bắt đầu tính điểm từ ngày mai.',
            );
            assert.equal(
              await browser.evaluate("!!document.querySelector('.beast-support')"),
              true,
            );
          } else {
            assert.equal(
              await browser.evaluate(
                "document.querySelector('.beast-support .beast-skill-context').textContent",
              ),
              'Có hiệu lực khi đồng hành từ ngày mai',
            );
            assert.equal(
              await browser.evaluate("document.querySelectorAll('.beast-support h3').length"),
              1,
              'Only the unlocked first talent is shown',
            );
            assert.match(
              await browser.evaluate(
                "document.querySelector('.beast-support .beast-skill-description').textContent",
              ),
              /25%/,
            );
          }
          gate.resolve();
          gate = null;
          await settled(browser);
          await open(browser, url, role);
          await shown(browser, beast);
        }
        assert.equal(control.posts.length, 2);
      });
    } finally {
      gate?.resolve();
    }
  },
);

test(
  'replacement distinguishes same-species individuals, shows the old role once, and cancellation restores it',
  options,
  async () => {
    const control = beastFixture();
    const old = control.beastData.selected[0];
    const next = addBeast(control, 'same_species_new', 'frostnip');
    await using(control, async (browser, url) => {
      await open(browser, url);
      await choose(browser, 'training', next);
      assert.match(
        await browser.evaluate("document.querySelector('#sheet-content').textContent"),
        /lượt luyện của Frostique sẽ khóa tại tiến độ hiện có, giữ nguyên tạp chất/,
      );
      await browser.click('Xác nhận');
      await shown(browser, next);
      await settled(browser);
      assert.equal(roleBeast(control.beastData, 'training').id, old.id);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-hero img').alt"),
        'Frostnip',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-stage-numbers strong').textContent"),
        '0',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-role-today').textContent"),
        'Habit hôm nay vẫn tính cho Frostique.',
      );
      await browser.evaluate("document.querySelector('.beast-role-previous').click()");
      assert.match(
        await browser.evaluate("document.querySelector('#sheet-content').textContent"),
        /#-FIXTURE/,
      );
      await browser.press('Escape');
      await browser.click('Đổi linh thú luyện');
      assert.equal(
        await browser.evaluate(
          `document.querySelector('.beast-picker-item[data-beast-id="${next.id}"]').getAttribute('aria-pressed')`,
        ),
        'true',
      );
      assert.match(
        await browser.evaluate(
          `document.querySelector('.beast-picker-item[data-beast-id="${next.id}"]').textContent`,
        ),
        /Đã chọn · Từ ngày mai/,
      );
      await browser.evaluate(
        `document.querySelector('.beast-picker-item[data-beast-id="${next.id}"]').click()`,
      );
      assert.equal(
        control.posts.length,
        1,
        'Reselecting the pending individual never writes twice',
      );
      await browser.click('Đổi linh thú luyện');
      await browser.click('Hủy thay đổi');
      await shown(browser, old, false);
      await settled(browser);
      assert.equal(control.beastData.roles.pending.length, 0);
      assert.equal(await browser.evaluate("!!document.querySelector('.beast-role-today')"), false);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-stage-numbers strong').textContent"),
        '0',
      );
      assert.equal(old.attempt.status, 'training');
      await choose(browser, 'training', next);
      await browser.click('Xác nhận');
      await shown(browser, next);
      await settled(browser);
      await choose(browser, 'training', old);
      await browser.click('Xác nhận');
      await shown(browser, old, false);
      await settled(browser);
      assert.equal(
        control.beastData.roles.pending.length,
        0,
        'Choosing the effective beast also cancels the change',
      );
    });
  },
);

test(
  'pending perfect companion has future skills while the exact current companion retains ultimate access',
  options,
  async () => {
    const control = beastFixture();
    const old = control.beastData.selected[0];
    Object.assign(old.attempt, { earned: 1200, gray: 0, status: 'completed' });
    const next = addBeast(control, 'perfect_pyro_new', 'pyropup', 1600, 0, 'completed');
    await using(control, async (browser, url) => {
      await open(browser, url, 'companion');
      await choose(browser, 'companion', next);
      await browser.click('Xác nhận');
      await shown(browser, next);
      await settled(browser);
      assert.equal(roleBeast(control.beastData, 'companion').id, old.id);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-support .beast-skill-context').textContent",
        ),
        'Có hiệu lực khi đồng hành từ ngày mai',
      );
      await browser.click('Xem tuyệt kỹ hoàn mỹ', '#content button');
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('#sheet button')].some(b=>b.textContent==='Kích hoạt tuyệt kỹ tuần này')",
        ),
        false,
      );
      await browser.press('Escape');
      await browser.evaluate("document.querySelector('.beast-role-previous').click()");
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet-title').textContent"),
        'Frostluna',
      );
      await browser.click('Xem tuyệt kỹ hoàn mỹ', '#sheet button');
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('#sheet button')].some(b=>b.textContent==='Kích hoạt tuyệt kỹ tuần này'&&!b.disabled)",
        ),
        true,
      );
      assert.equal(control.posts.length, 1, 'Opening either skill never activates it');
      await browser.press('Escape');
      await browser.click('Chi tiết linh thú');
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet-title').textContent"),
        'Pyrodaemon',
      );
    });
  },
);

test(
  'failed selection keeps the current hero and ambiguous selection recovers its original receipt after reload',
  options,
  async () => {
    const control = beastFixture();
    const old = control.beastData.selected[0],
      next = addBeast(control, 'recovery_pyro');
    const original = control.beastApi;
    let fail = true,
      lose = false;
    control.beastApi = async (request, endpoint) => {
      if (request.method === 'POST' && fail) {
        fail = false;
        for await (const _part of request) {
          /* Consume the rejected request. */
        }
        return {
          status: 409,
          body: { error: 'BEAST_CHANGED', message: 'Lựa chọn vừa thay đổi. Thử lại nhé.' },
        };
      }
      const response = await original(request, endpoint);
      if (request.method === 'POST' && lose) {
        lose = false;
        return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
      }
      return response;
    };
    await using(control, async (browser, url) => {
      await open(browser, url, 'companion');
      await choose(browser, 'companion', next);
      await browser.click('Xác nhận');
      await browser.wait("document.body.textContent.includes('Lựa chọn vừa thay đổi')");
      await shown(browser, old, false);
      assert.equal(control.beastData.roles.pending.length, 0);
      await browser.press('Escape');
      await settled(browser);
      lose = true;
      await choose(browser, 'companion', next);
      await browser.click('Xác nhận');
      await browser.wait(
        "[...document.querySelectorAll('#content button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
      );
      await shown(browser, old, false);
      assert.equal(control.beastData.roles.pending[0].beastId, next.id);
      const receipt = control.posts[0].input.id;
      await open(browser, url, 'companion');
      await shown(browser, next);
      await browser.click('Kiểm tra kết quả');
      await settled(browser);
      assert.equal(
        control.posts.length,
        1,
        'Receipt recovery never resubmits a committed role selection',
      );
      assert.equal(control.receipts.has(receipt), true);
      assert.equal(roleBeast(control.beastData, 'companion').id, old.id);
    });
  },
);

test(
  'a delayed selection waits for confirmation, does not jump during saving, and never takes over a newer sheet',
  options,
  async () => {
    const control = beastFixture();
    const old = control.beastData.selected[0],
      next = addBeast(control, 'delayed_pyro');
    const original = control.beastApi;
    const committed = Promise.withResolvers(),
      release = Promise.withResolvers();
    control.beastApi = async (request, endpoint) => {
      const response = await original(request, endpoint);
      if (request.method === 'POST') {
        committed.resolve();
        await release.promise;
      }
      return response;
    };
    try {
      await using(control, async (browser, url) => {
        await open(browser, url);
        await browser.evaluate(
          "window.roleHero=document.querySelector('.beast-hero');window.roleTop=window.roleHero.getBoundingClientRect().top",
        );
        await choose(browser, 'training', next);
        await browser.click('Xác nhận');
        await committed.promise;
        await shown(browser, old, false);
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.beast-hero').getBoundingClientRect().top===window.roleTop",
          ),
          true,
        );
        assert.equal(
          await browser.evaluate(
            "[...document.querySelectorAll('#sheet button')].find(b=>b.textContent==='Xác nhận').disabled",
          ),
          true,
        );
        await browser.press('Escape');
        await browser.click('Chi tiết linh thú');
        const title = await browser.evaluate("document.querySelector('#sheet-title').textContent");
        release.resolve();
        await shown(browser, next);
        await settled(browser);
        assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), true);
        assert.equal(
          await browser.evaluate("document.querySelector('#sheet-title').textContent"),
          title,
        );
        assert.equal(
          await browser.evaluate("document.querySelector('.beast-hero')===window.roleHero"),
          true,
        );
      });
    } finally {
      release.resolve();
    }
  },
);

test(
  'activity-day rollover keeps the selected portrait, focus and scroll and removes pending status only after authoritative refresh',
  options,
  async () => {
    const control = beastFixture();
    const old = control.beastData.selected[0],
      next = addBeast(control, 'rollover_pyro');
    await using(control, async (browser, url) => {
      await open(browser, url);
      await choose(browser, 'training', next);
      await browser.click('Xác nhận');
      await shown(browser, next);
      await settled(browser);
      await browser.evaluate(
        "window.roleImage=document.querySelector('.beast-hero img');window.roleHero=document.querySelector('.beast-hero');scrollTo({top:130,behavior:'instant'});document.querySelectorAll('.beast-tab')[0].focus({preventScroll:true});window.savedScroll=scrollY",
      );
      old.attempt.status = 'sealed';
      next.attempt.status = 'training';
      control.beastData.roles.current = [
        control.beastData.roles.pending[0],
        ...control.beastData.roles.current.filter((role) => role.role !== 'training'),
      ];
      control.beastData.roles.pending = [];
      control.beastData.day.day++;
      control.beastData.day.endAt += 86400000;
      control.beastData.account.version++;
      await refresh(browser);
      await shown(browser, next, false);
      assert.deepEqual(
        await browser.evaluate(
          `({image:window.roleImage===document.querySelector('.beast-hero img'),hero:window.roleHero===document.querySelector('.beast-hero'),scroll:scrollY===window.savedScroll,focus:document.activeElement===document.querySelectorAll('.beast-tab')[0],note:!!document.querySelector('.beast-role-today'),label:document.querySelector('.beast-role-label').textContent})`,
        ),
        {
          image: true,
          hero: true,
          scroll: true,
          focus: true,
          note: false,
          label: 'Đang nuôi dưỡng',
        },
      );
    });
  },
);

test(
  'pending role screens and picker remain usable on narrow phones, large text and both themes',
  options,
  async () => {
    const control = beastFixture();
    const next = addBeast(control, 'mobile_pyro', 'pyropup');
    control.beastData.selected.push(next);
    control.beastData.roles.pending = ['training', 'companion'].map((role) => ({
      role,
      day: control.beastData.day.day + 1,
      beastId: next.id,
      attemptId: next.attemptId,
    }));
    await mkdir(output, { recursive: true });
    await using(control, async (browser, url) => {
      await open(browser, url);
      for (const [width, height] of [
        [320, 568],
        [375, 812],
        [390, 844],
        [414, 896],
        [1440, 1000],
      ]) {
        await browser.resize(width, height);
        for (const theme of ['light', 'dark']) {
          await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
          for (const factor of [1, 1.3, 2]) {
            for (const label of ['Đang luyện', 'Đồng hành']) {
              await browser.scaleText(1);
              await browser.click(label);
              await browser.scaleText(factor);
              const checks = await browser.evaluate(`(() => {
              const hero=document.querySelector('.beast-hero'),copy=hero.querySelector('.beast-hero-copy').getBoundingClientRect(),art=hero.querySelector('img').getBoundingClientRect();
              const tabs=document.querySelector('.beast-tabs');
              return {overflow:document.documentElement.scrollWidth>innerWidth+1,tabOverflow:tabs.scrollWidth>tabs.clientWidth+1,overlap:Math.min(copy.right,art.right)>Math.max(copy.left,art.left)+1&&Math.min(copy.bottom,art.bottom)>Math.max(copy.top,art.top)+1,clipped:hero.scrollWidth>hero.clientWidth+1,details:document.querySelectorAll('.beast-hero-view').length,pending:document.querySelectorAll('.beast-role-label').length};
            })()`);
              assert.deepEqual(
                checks,
                {
                  overflow: false,
                  tabOverflow: false,
                  overlap: false,
                  clipped: false,
                  details: 1,
                  pending: 1,
                },
                `${width}px ${theme} text ${factor} ${label}`,
              );
              if (process.env.LINH_THU_CAPTURE === '1' && theme === 'light' && factor === 1) {
                await browser.evaluate("scrollTo({top:0,behavior:'instant'})");
                await browser.evaluate(
                  'Promise.all(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))',
                );
                await browser.screenshot(
                  `${output}/${label === 'Đang luyện' ? 'training' : 'companion'}-${width}.png`,
                );
              }
            }
          }
        }
      }
      await browser.scaleText(1);
      await browser.resize(320, 568);
      await browser.click('Đổi đồng hành');
      await browser.scaleText(2);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet-content').scrollWidth>document.querySelector('#sheet-content').clientWidth+1",
        ),
        false,
      );
      assert.ok(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-picker-item')].every(node=>node.getBoundingClientRect().height>=44)",
        ),
      );
      await browser.scaleText(1);
      await browser.click('Hủy thay đổi');
      await settled(browser);
      assert.equal(
        control.beastData.roles.pending.length,
        1,
        'Cancel companion preserves the pending training choice',
      );
    });
  },
);
