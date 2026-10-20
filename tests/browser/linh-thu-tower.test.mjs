import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import {
  beginBeastTower,
  pickBeastTower,
  continueBeastTower,
  expireBeastTower,
} from '../../src/domain/linh-thu-tower.ts';
import { beastFixture } from './linh-thu-fixture.mjs';
import { serve, chrome, browserBin } from './app-harness.mjs';

const evidence = 'output/tower-implementation-20261020';
const pendingKey = 'minh-anh-beast-pending-v1';
const options = { skip: !browserBin, timeout: 60000 };
const choosing = "!!document.querySelector('.tower-card:not(:disabled)')";
const decision = "!!document.querySelector('.beast-tower-claim:not(:disabled)')";
const recovery =
  "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)";

async function boot(browser, url, width = 390) {
  await browser.navigate(url, width);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
  await browser.wait("!!document.querySelector('.beast-tower-entry')");
}
async function open(browser) {
  await browser.evaluate("document.querySelector('.beast-tower-entry button').click()");
  await browser.wait(
    "!!document.querySelector('.tower-experience')&&(document.querySelector('.tower-stage-title').hidden||!document.querySelector('.tower-stage-title').textContent.includes('Đang mở'))",
  );
}
async function start(browser) {
  await open(browser);
  await browser.wait(
    "[...document.querySelectorAll('button')].some(b=>b.textContent==='Bắt đầu · Miễn phí'&&!b.disabled)",
  );
  await browser.click('Bắt đầu · Miễn phí');
  await browser.wait(choosing);
}
async function pick(browser, index = 1) {
  await browser.evaluate(`document.querySelectorAll('.tower-card')[${index}].click()`);
}
async function next(browser, floor) {
  await browser.tap('.beast-tower-continue');
  await browser.wait(
    `document.querySelector('.tower-floor-label').textContent==='Tầng ${floor} / 4'&&${choosing}`,
  );
}
function seed(control, floor, status = 'decision', rescue = false) {
  let run = beginBeastTower(control.habits.day.day, rescue, () => 0);
  for (let i = 1; i <= floor; i++) {
    if (i === floor && status === 'choosing') break;
    run = pickBeastTower(run, 1, () => 0);
    if (i < floor) run = continueBeastTower(run, () => 0);
  }
  control.setTowerState(run, floor * 2);
}
async function settle(browser) {
  await browser.evaluate('Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))');
}
async function shot(browser, name) {
  await mkdir(`${evidence}/screenshots`, { recursive: true });
  await browser.screenshot(`${evidence}/screenshots/${name}.png`);
}
async function scenario(callback, setup = () => {}) {
  const control = beastFixture();
  setup(control);
  const server = await serve(control),
    browser = await chrome();
  try {
    await callback(browser, control, server.url);
    assert.deepEqual(browser.errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
}

test(
  'tower keeps the board through the flip, stable right continuation and a real fourth-floor loss',
  options,
  async () => {
    await scenario(async (b, c, url) => {
      await boot(b, url);
      const wallet = structuredClone(c.beastData.wallet.state),
        summon = c.beastData.account.state.summonTickets;
      await start(b);
      await settle(b);
      await shot(b, 'app-choosing-390');
      const positions = [];
      for (let floor = 1; floor <= 3; floor++) {
        assert.equal(
          await b.evaluate("document.querySelectorAll('.tower-card').length"),
          floor === 3 ? 3 : 4,
        );
        await b.evaluate(
          "window.towerBoard=document.querySelector('.tower-board');window.chosen=document.querySelectorAll('.tower-card')[1]",
        );
        await pick(b);
        await b.wait("!!document.querySelector('.tower-card.is-revealed')");
        assert.equal(
          await b.evaluate(
            "towerBoard===document.querySelector('.tower-board')&&chosen===document.querySelector('.tower-card.is-selected')",
          ),
          true,
        );
        assert.equal(
          await b.evaluate("document.querySelectorAll('.tower-card[data-result]').length"),
          1,
        );
        assert.equal(
          await b.evaluate(
            "[...document.querySelectorAll('.tower-card:not(.is-selected)')].every(b=>!b.dataset.result&&!b.classList.contains('is-revealed'))",
          ),
          true,
        );
        if (floor === 1) {
          await b.wait(
            "document.querySelector('.tower-card.is-selected .tower-card-inner').getAnimations().some(a=>a.transitionProperty==='transform')",
          );
          await b.evaluate(`(()=>{
          window.towerFlip=document.querySelector('.tower-card.is-selected .tower-card-inner').getAnimations().find(a=>a.transitionProperty==='transform');
          towerFlip.pause();towerFlip.currentTime=250;
        })()`);
          await shot(b, 'app-flip-390');
          await b.evaluate('towerFlip.play()');
        }
        await b.wait(decision);
        await settle(b);
        assert.equal(
          await b.evaluate("document.querySelector('.tower-result-label strong')===null"),
          false,
        );
        const amount = await b.evaluate(
          "document.querySelector('.tower-card.is-selected .tower-result-label').innerText",
        );
        assert.match(
          amount,
          floor === 1 ? /2\s+vé thường/ : floor === 2 ? /3\s+vé thường/ : /1\s+vé triệu hồi/,
        );
        positions.push(
          await b.evaluate(
            `(()=>{const a=document.querySelector('.beast-tower-claim').getBoundingClientRect(),b=document.querySelector('.beast-tower-continue').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,left:a.x}})()`,
          ),
        );
        if (floor === 3) await shot(b, 'app-reward-390');
        await next(b, floor + 1);
        assert.equal(c.posts.filter((p) => p.input.operation === 'tower_continue').length, floor);
      }
      for (const p of positions) {
        assert.ok(p.x > p.left);
        assert.ok(
          Math.abs(p.x - positions[0].x) <= 1 && Math.abs(p.y - positions[0].y) <= 1,
          JSON.stringify(positions),
        );
      }
      assert.equal(await b.evaluate("document.querySelectorAll('.tower-card').length"), 2);
      await pick(b, 0);
      await b.wait("!!document.querySelector('.tower-stage.is-failed')");
      assert.equal(
        await b.evaluate("document.querySelector('.tower-purse-value').textContent"),
        '1 vé triệu hồi',
      );
      assert.equal(
        await b.evaluate("document.querySelector('.tower-stage-hint').textContent"),
        'Lượt kết thúc ở tầng 4.',
      );
      assert.match(
        await b.evaluate("document.querySelector('.tower-status').textContent"),
        /Vé đã có trong ví được giữ nguyên/,
      );
      assert.equal(c.beastData.account.state.summonTickets, summon);
      assert.deepEqual(c.beastData.wallet.state, wallet);
      await settle(b);
      await shot(b, 'app-loss-390');
      await boot(b, url);
      await open(b);
      await b.wait("!!document.querySelector('.tower-stage.is-failed')");
      assert.equal(
        await b.evaluate("document.querySelector('.tower-purse-value').textContent"),
        '1 vé triệu hồi',
      );
    });
  },
);

test(
  'tower claim credits only the selected floor reward, waits for confirmation and prevents double credit',
  options,
  async () => {
    for (let floor = 1; floor <= 4; floor++) {
      let release;
      await scenario(
        async (b, c, url) => {
          await boot(b, url);
          await open(b);
          await b.wait(decision);
          const tickets = c.beastData.wallet.state.tickets,
            summon = c.beastData.account.state.summonTickets;
          await b.evaluate(
            "const button=document.querySelector('.beast-tower-claim');button.click();button.click();button.click()",
          );
          await b.wait(
            "document.querySelector('.tower-status').textContent.includes('Đang xác nhận')",
          );
          assert.equal(await b.evaluate("!!document.querySelector('.tower-receipt')"), false);
          release();
          await b.wait("!!document.querySelector('.tower-receipt')");
          const normal = [0, 2, 3, 0, 0][floor],
            special = [0, 0, 0, 1, 2][floor];
          assert.equal(c.beastData.wallet.state.tickets, tickets + normal);
          assert.equal(c.beastData.account.state.summonTickets, summon + special);
          assert.equal(c.posts.filter((p) => p.input.operation === 'tower_claim').length, 1);
          assert.equal(
            await b.evaluate("document.querySelector('#sheet-title').textContent"),
            'Đã nhận thưởng',
          );
          assert.equal(
            await b.evaluate("document.querySelector('.tower-receipt-reward').textContent"),
            `+${normal || special} vé ${normal ? 'thường' : 'triệu hồi'}`,
          );
          assert.equal(
            await b.evaluate("document.querySelector('.tower-receipt-balance').textContent"),
            `Số dư: ${normal ? tickets + normal : summon + special} vé ${normal ? 'thường' : 'triệu hồi'}`,
          );
          if (floor === 3) await shot(b, 'app-receipt-390');
          await b.press('Escape');
          await open(b);
          await b.wait("!!document.querySelector('.tower-receipt')");
          assert.equal(
            c.posts.length,
            1,
            'Reopening an already claimed run cannot create another run or claim',
          );
        },
        (c) => {
          seed(c, floor);
          const api = c.beastApi;
          const gate = new Promise((resolve) => {
            release = resolve;
          });
          c.beastApi = async (request, endpoint) => {
            const response = await api(request, endpoint);
            if (request.method === 'POST') await gate;
            return response;
          };
        },
      );
    }
  },
);

test(
  'tower uses protection once, reshuffles the same floor and never rescues on floor four',
  options,
  async () => {
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(choosing);
        await pick(b, 0);
        await b.wait(
          "document.querySelector('.tower-stage-title').textContent==='Bảo hộ đã kích hoạt'",
        );
        await shot(b, 'app-protection-390');
        await b.wait(choosing);
        assert.equal(c.towerRun.floor, 2);
        assert.deepEqual(c.towerRun.atRisk, { tickets: 2, summonTickets: 0 });
        assert.equal(c.towerRun.rescueAvailable, false);
        assert.equal(
          await b.evaluate("document.querySelectorAll('.tower-card.is-revealed').length"),
          0,
        );
        await pick(b, 0);
        await b.wait("!!document.querySelector('.tower-stage.is-failed')");
        assert.equal(c.towerRun.status, 'failed');
        assert.equal(
          await b.evaluate("document.querySelector('.tower-purse-value').textContent"),
          '2 vé thường',
        );
      },
      (c) => seed(c, 2, 'choosing', true),
    );
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(choosing);
        assert.equal(
          await b.evaluate("document.querySelector('.tower-protection').textContent"),
          '',
        );
        await pick(b, 0);
        await b.wait("!!document.querySelector('.tower-stage.is-failed')");
        assert.equal(c.towerRun.rescued, false);
      },
      (c) => seed(c, 4, 'choosing', true),
    );
  },
);

test(
  'tower recovers committed pick and claim after reload without repeating the mutation',
  options,
  async () => {
    for (const operation of ['tower_pick', 'tower_claim']) {
      await scenario(
        async (b, c, url) => {
          await boot(b, url);
          await open(b);
          await b.wait(operation === 'tower_pick' ? choosing : decision);
          const before = c.beastData.wallet.state.tickets;
          if (operation === 'tower_pick') await pick(b);
          else await b.tap('.beast-tower-claim');
          await b.wait(recovery);
          assert.ok(await b.evaluate(`sessionStorage.getItem('${pendingKey}')`));
          await boot(b, url);
          if (operation === 'tower_claim')
            await b.evaluate("document.querySelector('[data-tab=beasts]').click()");
          else await open(b);
          await b.wait(recovery);
          await b.click('Kiểm tra kết quả');
          await b.wait(
            operation === 'tower_pick' ? decision : "!!document.querySelector('.tower-receipt')",
          );
          assert.equal(c.posts.length, 1);
          assert.equal(
            c.beastData.wallet.state.tickets,
            before + (operation === 'tower_claim' ? 3 : 0),
          );
          assert.equal(await b.evaluate(`sessionStorage.getItem('${pendingKey}')`), null);
        },
        (c) => {
          seed(c, 2, operation === 'tower_pick' ? 'choosing' : 'decision');
          const api = c.beastApi;
          let lose = true;
          c.beastApi = async (request, endpoint) => {
            const response = await api(request, endpoint);
            if (request.method === 'POST' && lose) {
              lose = false;
              return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
            }
            return response;
          };
        },
      );
    }
  },
);

test(
  'tower recovers a committed prior-day claim as a receipt instead of a new run',
  options,
  async () => {
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(decision);
        const before = c.beastData.wallet.state.tickets;
        await b.tap('.beast-tower-claim');
        await b.wait(recovery);
        await boot(b, url);
        await open(b);
        await b.wait(recovery);
        await b.click('Kiểm tra kết quả');
        await b.wait("!!document.querySelector('.tower-receipt')");
        assert.equal(
          await b.evaluate("document.querySelector('.tower-receipt-reward').textContent"),
          '+3 vé thường',
        );
        assert.equal(c.beastData.wallet.state.tickets, before + 3);
        assert.equal(c.posts.length, 1);
      },
      (c) => {
        seed(c, 2);
        const api = c.beastApi;
        let nextDay = false;
        c.beastApi = async (request, endpoint) => {
          const response = await api(request, endpoint);
          if (request.method === 'POST') {
            nextDay = true;
            return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
          }
          if (endpoint === 'linh-thu/tower' && nextDay)
            return {
              body: {
                ...response.body,
                run: null,
                eligibility: {
                  ...response.body.eligibility,
                  day: response.body.eligibility.day + 1,
                },
              },
            };
          return response;
        };
      },
    );
  },
);

test(
  'tower retries an uncommitted intent with the original identity and reconciles a version conflict',
  options,
  async () => {
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(decision);
        await b.networkConditions(true, 0);
        await b.tap('.beast-tower-claim');
        await b.wait(recovery);
        const intent = await b.evaluate(`JSON.parse(sessionStorage.getItem('${pendingKey}'))`);
        assert.equal(c.posts.length, 0);
        await b.networkConditions(false, 0, 10000000);
        await boot(b, url);
        await open(b);
        await b.wait(recovery);
        await b.click('Kiểm tra kết quả');
        await b.wait("!!document.querySelector('.tower-receipt')");
        assert.equal(c.posts.length, 1);
        assert.equal(c.posts[0].input.id, intent.id);
      },
      (c) => seed(c, 1),
    );
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(choosing);
        c.setTowerState(
          pickBeastTower(c.towerState, 1, () => 0),
          c.towerRun.version + 1,
        );
        await pick(b);
        await b.wait(decision);
        assert.equal(await b.evaluate(`sessionStorage.getItem('${pendingKey}')`), null);
        assert.equal(
          await b.evaluate("document.querySelectorAll('.tower-card.is-revealed').length"),
          1,
        );
        await b.tap('.beast-tower-claim');
        await b.wait("!!document.querySelector('.tower-receipt')");
        assert.equal(c.towerRun.status, 'claimed');
      },
      (c) => seed(c, 1, 'choosing'),
    );
  },
);

test(
  'tower close, reopen and late recovery preserve a newer sheet and authoritative result',
  options,
  async () => {
    let release, releaseReceipt;
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(choosing);
        await pick(b);
        await b.wait(
          "document.querySelector('.tower-experience').getAttribute('aria-busy')==='true'",
        );
        await b.press('Escape');
        await b.evaluate("document.querySelector('#settings').click()");
        const title = await b.evaluate("document.querySelector('#sheet-title').textContent");
        release();
        await b.wait(
          `!!sessionStorage.getItem('${pendingKey}')&&document.querySelector('#sheet-title').textContent===${JSON.stringify(title)}`,
        );
        await delay(150);
        await b.press('Escape');
        await open(b);
        await b.wait(recovery);
        await b.click('Kiểm tra kết quả');
        await delay(100);
        await b.press('Escape');
        await b.evaluate("document.querySelector('#settings').click()");
        releaseReceipt();
        await b.wait(`sessionStorage.getItem('${pendingKey}')===null`);
        await delay(150);
        assert.equal(await b.evaluate("document.querySelector('#sheet-title').textContent"), title);
        await b.press('Escape');
        await open(b);
        await b.wait(decision);
        assert.equal(c.posts.length, 1);
      },
      (c) => {
        seed(c, 1, 'choosing');
        const api = c.beastApi;
        const post = new Promise((r) => {
            release = r;
          }),
          receipt = new Promise((r) => {
            releaseReceipt = r;
          });
        c.beastApi = async (request, endpoint) => {
          const result = await api(request, endpoint);
          if (request.method === 'POST') {
            await post;
            return { status: 503, body: { error: 'OPERATION_NOT_CONFIRMED' } };
          }
          if (endpoint === 'linh-thu/receipt') await receipt;
          return result;
        };
      },
    );
  },
);

test(
  'tower freezes after an unsynced rejection and can show a confirmed receipt despite a failed follow-up read',
  options,
  async () => {
    await scenario(
      async (b, c, url) => {
        await boot(b, url);
        await open(b);
        await b.wait(choosing);
        c.setTowerState(c.towerState, c.towerRun.version + 1);
        await pick(b);
        await b.wait(
          "[...document.querySelectorAll('.tower-actions button')].some(b=>b.textContent==='Thử lại')",
        );
        assert.equal(await b.evaluate(choosing), false);
        c.failedReads.clear();
        await b.click('Thử lại');
        await b.wait(choosing);
        await pick(b);
        await b.wait(decision);
        const before = c.beastData.wallet.state.tickets;
        await b.tap('.beast-tower-claim');
        await b.wait("!!document.querySelector('.tower-receipt')");
        assert.equal(c.beastData.wallet.state.tickets, before + 2);
        assert.equal(
          await b.evaluate("document.querySelector('.tower-receipt-balance').textContent"),
          `Số dư: ${before + 2} vé thường`,
        );
      },
      (c) => {
        seed(c, 1, 'choosing');
        const api = c.beastApi;
        c.beastApi = async (request, endpoint) => {
          const result = await api(request, endpoint);
          if (
            request.method === 'POST' &&
            (result.status === 409 || result.body.result?.tower?.status === 'claimed')
          )
            c.failedReads = new Set(['linh-thu/tower']);
          return result;
        };
      },
    );
  },
);

test(
  'tower restores expired runs without offering a new daily run or crediting on the client',
  options,
  async () => {
    for (const cleared of [0, 2]) {
      await scenario(
        async (b, c, url) => {
          const wallet = structuredClone(c.beastData.wallet);
          await boot(b, url);
          await open(b);
          await b.wait(
            cleared
              ? "!!document.querySelector('.tower-receipt')"
              : "document.querySelector('.tower-stage-title').textContent==='Lượt tháp đã hết hạn'",
          );
          assert.equal(c.posts.length, 0);
          assert.deepEqual(c.beastData.wallet, wallet);
          assert.equal(
            await b.evaluate("!!document.querySelector('.tower-card:not(:disabled)')"),
            false,
          );
        },
        (c) => {
          seed(c, cleared || 1, cleared ? 'decision' : 'choosing');
          const expired = expireBeastTower(c.towerState);
          c.setTowerState(expired.state, c.towerRun.version + 1);
          c.beastData.wallet.state.tickets += expired.reward.tickets;
        },
      );
    }
  },
);

test(
  'tower fits mobile, desktop, larger text and reduced motion with reachable controls',
  options,
  async () => {
    const layouts = [];
    for (const [width, height, text] of [
      [320, 730, 1],
      [390, 844, 1],
      [430, 932, 1],
      [1440, 1000, 1],
      [320, 730, 1.25],
    ]) {
      await scenario(
        async (b, c, url) => {
          await b.reducedMotion();
          await boot(b, url, width);
          await open(b);
          await b.wait(choosing);
          await b.resize(width, height);
          await b.scaleText(text);
          await settle(b);
          await shot(b, `app-choosing-${width}${text > 1 ? '-text125' : ''}`);
          await pick(b);
          await b.wait(decision);
          await b.scaleText(text);
          const layout = await b.evaluate(`(()=>{
        const sheet=document.querySelector('#sheet'),root=document.querySelector('.tower-experience');
        const overflow=[...root.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5)}).map(n=>n.className.baseVal??n.className);
        const actions=[...document.querySelectorAll('.tower-action')].map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()}));
        return {overflow,actions,sheet:sheet.getBoundingClientRect().toJSON(),scrollWidth:sheet.scrollWidth,clientWidth:sheet.clientWidth,transition:getComputedStyle(document.querySelector('.tower-card-inner')).transitionDuration};
      })()`);
          assert.deepEqual(layout.overflow, [], JSON.stringify(layout));
          assert.ok(layout.scrollWidth <= layout.clientWidth + 1);
          assert.equal(layout.transition, '0s');
          for (const a of layout.actions) assert.ok(a.rect.height >= 44 && a.rect.width >= 44);
          if (text === 1)
            assert.ok(
              layout.actions.every((a) => a.rect.bottom <= layout.sheet.bottom),
              JSON.stringify(layout),
            );
          if (width < 700) assert.equal(layout.sheet.height, height);
          // At 125% text the sheet can scroll; both actions must become reachable.
          await b.evaluate(
            "document.querySelector('.beast-tower-continue').scrollIntoView({block:'nearest'})",
          );
          assert.equal(
            await b.evaluate(
              "document.querySelector('.beast-tower-continue').getBoundingClientRect().bottom<=document.querySelector('#sheet').getBoundingClientRect().bottom",
            ),
            true,
          );
          await shot(b, `app-reward-${width}${text > 1 ? '-text125' : ''}`);
          layouts.push({ width, height, text, ...layout });
          await b.tap('.beast-tower-claim');
          await b.wait("!!document.querySelector('.tower-receipt')");
        },
        (c) => seed(c, 1, 'choosing'),
      );
    }
    await writeFile(`${evidence}/layouts.json`, JSON.stringify(layouts, null, 2));
  },
);
