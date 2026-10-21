import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { beastFixture } from './linh-thu-fixture.mjs';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';

const captures = `trial-results/linh-thu/evolution/run-${process.pid}`;
function evolutionFixture(earned = 100, gray = 0, form = 1) {
  const control = beastFixture(),
    beast = control.ownedBeasts[0];
  beast.speciesId = 'gibber';
  beast.attempt = {
    speciesId: 'gibber',
    ruleVersion: 1,
    form,
    status: earned + gray === 600 ? 'completed' : 'training',
    earned,
    gray,
  };
  control.beastData.speciesCounts = { gibber: 1 };
  return control;
}
async function open(browser, url) {
  await browser.navigate(url, 390);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
  await browser.wait("!!document.querySelector('.beast-journey')");
}

test(
  'unknown forms never render future art; a committed evolution reveals the new form and precise ability gain',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = evolutionFixture(),
      server = await serve(control);
    let browser;
    try {
      await mkdir(captures, { recursive: true });
      browser = await chrome();
      await open(browser, server.url);
      await browser.evaluate(
        "document.querySelector('.beast-hero').scrollIntoView({block:'start'})",
      );
      await browser.screenshot(captures + '/main-390.png');
      assert.match(
        await browser.evaluate("document.querySelector('.beast-support').textContent"),
        /25% cơ hội.*hoàn/,
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-journey img').length"),
        1,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-upgrade').textContent.includes('25% → 50%')",
        ),
        true,
      );
      await browser.evaluate('document.querySelector(\'.beast-journey [data-form="3"]\').click()');
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('#sheet-content .beast-detail-image').length",
        ),
        0,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet-content').textContent.includes('Nham Giáp Linh Quy')",
        ),
        false,
      );
      await browser.screenshot(captures + '/unknown-form-390.png');
      await browser.press('Escape');
      await browser.evaluate(
        "document.querySelector('.beast-progress').scrollIntoView({block:'center'})",
      );
      await browser.screenshot(captures + '/ready-390.png');
      await browser.click('Tiến hóa');
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
      assert.deepEqual(
        await browser.evaluate(`(() => {
          const dialog=document.querySelector('dialog.beast-evolution'), r=dialog.getBoundingClientRect();
          return {open:dialog.open,full:r.width===innerWidth && r.height===innerHeight,
            backdrop:getComputedStyle(dialog,'::backdrop').backgroundColor,
            secret:dialog.querySelector('.evolution-identity').getAttribute('aria-hidden'),
            result:dialog.querySelector('.beast-evolution-final').hidden};
        })()`),
        { open: true, full: true, backdrop: 'rgb(9, 12, 22)', secret: 'true', result: true },
      );
      assert.equal(control.posts.filter((post) => post.input.operation === 'evolve').length, 1);
      assert.equal(control.ownedBeasts[0].attempt.form, 2);
      await browser.screenshot(captures + '/evolution-390.png');
      await browser.click('Bỏ qua hiệu ứng');
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolution-final').hidden"),
        false,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-evolved-result').textContent.includes('25% → 50%')",
        ),
        true,
      );
      await browser.screenshot(captures + '/evolved-390.png');
      await browser.click('Xem lại hiệu ứng');
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
      assert.equal(control.posts.filter((post) => post.input.operation === 'evolve').length, 1);
      assert.equal(control.ownedBeasts[0].attempt.form, 2);
      await browser.press('Escape');
      assert.equal(await browser.evaluate("document.querySelector('.beast-evolution').open"), true);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolution-final').hidden"),
        false,
      );
      await browser.click('Tiếp tục nuôi dưỡng');
      await browser.wait("document.querySelector('.beast-hero img')?.alt==='Kiên Giáp Quy'");
      assert.equal(
        await browser.evaluate("document.querySelectorAll('#content .beast-journey img').length"),
        2,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'cinematic transitions render every species; T2, T3 and T4 have distinct timing and accessible result controls',
  { skip: !browserBin, timeout: 120000 },
  async () => {
    const control = evolutionFixture(),
      server = await serve(control);
    let browser;
    try {
      await mkdir(captures, { recursive: true });
      browser = await chrome();
      const catalog = control.beastData.config.catalog;
      const cases = [
        ...catalog.map((species) => [species, 1]),
        ...['gibber', 'pyropup'].flatMap((id) =>
          [2, 3].map((form) => [catalog.find((s) => s.id === id), form]),
        ),
      ];
      for (const [species, from] of cases) {
        const beast = control.ownedBeasts[0],
          rule = control.beastData.config.training[species.rank];
        beast.speciesId = species.id;
        beast.attempt = {
          speciesId: species.id,
          ruleVersion: 1,
          form: from,
          status: 'training',
          earned: rule.thresholds[from - 1],
          gray: 0,
        };
        control.beastData.speciesCounts = { [species.id]: 1 };
        control.beastData.discoveries = {};
        await open(browser, server.url);
        await browser.evaluate("document.querySelector('.beast-evolve-button').click()");
        await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
        const expected = from === 3 ? 6600 : from === 2 ? 6000 : 5600;
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.beast-evolution').getAnimations()[0].effect.getTiming().duration",
          ),
          expected,
        );
        await browser.evaluate(
          "globalThis.__evolutionClock=document.querySelector('.beast-evolution').getAnimations()[0];__evolutionClock.playbackRate=0",
        );
        const capture = ['gibber', 'pyropup'].includes(species.id);
        for (const [phase, part] of capture
          ? [
              ['gather', 0.24],
              ['compress', 0.41],
              ['burst', 0.49],
              ['reveal', 0.65],
              ['settle', 0.92],
            ]
          : [['reveal', 0.65]]) {
          await browser.evaluate(
            `__evolutionClock.currentTime=${expected * part};new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`,
          );
          assert.equal(
            await browser.evaluate("document.querySelector('.beast-evolution').dataset.phase"),
            phase,
          );
          if (capture)
            await browser.screenshot(`${captures}/${species.id}-t${from + 1}-${phase}.png`);
        }
        await browser.evaluate("document.querySelector('.evolution-skip').click()");
        const final = await browser.evaluate(`(() => {
          const d=document.querySelector('.beast-evolution');
          return {name:d.querySelector('h2').textContent,hidden:d.querySelector('.beast-evolution-final').hidden,
            buttons:[...d.querySelectorAll('button:not([hidden])')].map(b=>({height:b.getBoundingClientRect().height,disabled:b.disabled})),
            htmlOverflow:document.documentElement.scrollWidth>innerWidth,
            accessible:d.querySelector('.evolution-identity').getAttribute('aria-hidden'),
            frames:d.getAnimations().filter(a=>a.effect.getTiming().duration>1000).length,
            audio:d.querySelectorAll('audio').length};
        })()`);
        assert.equal(final.name, species.forms[from]);
        assert.equal(final.hidden, false);
        assert.equal(final.accessible, null);
        assert.equal(final.htmlOverflow, false);
        assert.equal(final.frames, 0);
        assert.equal(final.audio, 0);
        assert.ok(final.buttons.every((b) => b.height >= 44 && !b.disabled));
        if (capture) {
          await browser.wait(
            "!document.querySelector('.beast-evolution-final').getAnimations().some(a=>a.playState==='running')",
          );
          await browser.screenshot(`${captures}/${species.id}-t${from + 1}-result.png`);
        }
        if (species.id === 'gibber' && from === 3) {
          for (const [width, height] of [
            [320, 568],
            [390, 640],
            [1440, 900],
          ]) {
            await browser.resize(width, height);
            if (width === 320) await browser.scaleText(1.5);
            const layout = await browser.evaluate(
              `(() => {const d=document.querySelector('.beast-evolution'),b=d.querySelector('.evolution-continue'),r=b.getBoundingClientRect();return {width:d.getBoundingClientRect().width,inside:r.left>=0&&r.right<=innerWidth,scrollable:d.querySelector('.evolution-dock').scrollHeight>=d.querySelector('.evolution-dock').clientHeight};})()`,
            );
            assert.equal(layout.width, width);
            assert.equal(layout.inside, true);
            assert.equal(layout.scrollable, true);
            await browser.screenshot(`${captures}/result-${width}-${height}.png`);
            if (width === 320) await browser.scaleText(1);
          }
          await browser.resize(390, 844);
        }
        await browser.press('Escape');
        assert.equal(await browser.evaluate("!!document.querySelector('.beast-evolution')"), false);
      }
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'automatic completion, background pause, preference changes and missing art preserve the committed result',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = evolutionFixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await open(browser, server.url);
      await browser.evaluate("document.querySelector('.beast-evolve-button').click()");
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
      await browser.evaluate(
        "Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-evolution').getAnimations()[0].playState",
        ),
        'paused',
      );
      await browser.evaluate(
        "delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))",
      );
      await browser.wait("document.querySelector('.beast-evolution-final').hidden===false");
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.evolution-status').textContent.includes('Kiên Giáp Quy')",
        ),
        true,
      );
      assert.equal(
        await browser.evaluate('document.activeElement.className'),
        'evolution-continue',
      );
      await browser.evaluate("document.querySelector('.evolution-replay').click()");
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
      await browser.reducedMotion(true);
      await browser.wait(
        "document.querySelector('.beast-evolution').classList.contains('is-static')",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.evolution-replay').hidden"),
        true,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.evolution-fallback').hidden"),
        false,
      );
      await browser.press('Escape');
      await browser.reducedMotion(false);
      control.ownedBeasts[0].attempt.form = 1;
      control.beastData.discoveries = {};
      await open(browser, server.url);
      await browser.evaluate("document.querySelector('.beast-evolve-button').click()");
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
      await browser.evaluate(
        "document.querySelector('.evolution-fallback img').dispatchEvent(new Event('error'))",
      );
      await browser.wait("document.querySelector('.beast-evolution-final').hidden===false");
      assert.equal(control.ownedBeasts[0].attempt.form, 2);
      await browser.press('Escape');
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'ability roadmaps identify each numbered individual and show only its committed purity milestones',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = evolutionFixture(350, 20, 3),
      first = control.ownedBeasts[0];
    const second = {
      ...clone(first),
      id: 'numbered_second',
      attemptId: 'numbered_attempt_second',
      attempt: { ...first.attempt, form: 4, earned: 570, gray: 30, status: 'completed' },
    };
    const third = {
      ...clone(first),
      id: 'numbered_third',
      attemptId: 'numbered_attempt_third',
      attempt: { ...first.attempt, form: 4, earned: 600, gray: 0, status: 'completed' },
    };
    control.ownedBeasts.push(second, third);
    control.beastData.selected.push(second, third);
    Object.assign(
      control.beastData.roles.current.find((role) => role.role === 'companion'),
      {
        beastId: second.id,
        attemptId: second.attemptId,
      },
    );
    control.beastData.speciesCounts.gibber = 3;
    control.beastData.discoveries = { gibber: { form: 4, awakened: true, perfect: true } };
    const server = await serve(control);
    let browser;
    try {
      await mkdir(captures, { recursive: true });
      browser = await chrome();
      await open(browser, server.url);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-support .beast-skill-context')?.textContent.includes('Đang hỗ trợ bạn') ?? false",
        ),
        false,
      );
      const read = () =>
        browser.evaluate(`(() => {
        const summary=document.querySelector('.beast-individual-summary');
        return {id:summary.dataset.beastId,attempt:summary.dataset.attemptId,
          number:summary.querySelector('strong').textContent,
          status:summary.querySelector('.beast-individual-heading > span').textContent,
          totals:[...summary.querySelectorAll('dl > div')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]),
          opened:[...document.querySelectorAll('.beast-roadmap .beast-milestone')].map(row=>row.classList.contains('is-open'))};
      })()`);
      await browser.click('Toàn bộ năng lực ›');
      assert.deepEqual(await read(), {
        id: first.id,
        attempt: first.attemptId,
        number: '#1',
        status: 'Đang luyện',
        totals: [
          ['Điểm thực', '35 / 58'],
          ['Tạp chất tích lũy', '2'],
          ['Độ thuần', '94,5% · Tạm tính'],
        ],
        opened: [false, false],
      });
      await browser.press('Escape');
      await browser.click('Đồng hành');
      await browser.click('Toàn bộ năng lực ›');
      assert.deepEqual(await read(), {
        id: second.id,
        attempt: second.attemptId,
        number: '#2',
        status: 'Luyện hoàn tất',
        totals: [
          ['Điểm thực', '57 / 57'],
          ['Tạp chất tích lũy', '3'],
          ['Độ thuần', '95%'],
        ],
        opened: [true, false],
      });
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const width of [320, 390, 1440]) {
          await browser.resize(width, 1000);
          await browser.scaleText(1.5);
          assert.equal(
            await browser.evaluate(
              "document.querySelector('#sheet-content').scrollWidth > document.querySelector('#sheet-content').clientWidth + 1",
            ),
            false,
          );
          await browser.scaleText(1);
        }
        await browser.resize(390, 1000);
        await browser.evaluate(
          "document.querySelector('.beast-roadmap-intro').scrollIntoView({block:'start'})",
        );
        await browser.screenshot(`${captures}/individual-two-${theme}-390.png`);
        await browser.evaluate(
          "document.querySelector('.beast-milestones').scrollIntoView({block:'start'})",
        );
        const colors = await browser.evaluate(
          `Array.from(document.querySelectorAll('.beast-milestone-mark')).map(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor,accent:getComputedStyle(node).getPropertyValue('--accent').trim()}))`,
        );
        assert.notEqual(colors[0].color, colors[1].color);
        assert.notEqual(colors[0].background, colors[1].background);
        await browser.screenshot(`${captures}/purity-95-${theme}-390.png`);
      }
      await browser.press('Escape');
      await browser.click('Bộ sưu tập');
      await browser.evaluate("document.querySelector('[data-species=gibber]').click()");
      await browser.wait("document.querySelectorAll('.beast-collection-card').length === 3");
      await browser.evaluate(
        "document.querySelector('.beast-collection-card[data-beast-id=numbered_third]').click()",
      );
      await browser.evaluate(
        "document.querySelector('#sheet-content .beast-abilities-link').click()",
      );
      assert.deepEqual(await read(), {
        id: third.id,
        attempt: third.attemptId,
        number: '#3',
        status: 'Luyện hoàn tất',
        totals: [
          ['Điểm thực', '60 / 60'],
          ['Tạp chất tích lũy', '0'],
          ['Độ thuần', '100% · Hoàn mỹ'],
        ],
        opened: [true, true],
      });
      await browser.evaluate(
        "document.querySelector('.beast-milestones').scrollIntoView({block:'start'})",
      );
      await browser.screenshot(`${captures}/purity-100-dark-390.png`);
      await browser.press('Escape');
      await browser.click('Đang luyện');
      for (const [attempt, purity, status] of [
        [{ form: 4, earned: 500, gray: 0, status: 'training' }, '100% · Tạm tính', 'Đang luyện'],
        [{ form: 4, earned: 500, gray: 20, status: 'sealed' }, '96,1% · Đã khóa', 'Đã khóa lượt'],
        [{ form: 1, earned: 0, gray: 0, status: 'ready' }, 'Chưa xác định', 'Chưa luyện'],
      ]) {
        Object.assign(first.attempt, attempt);
        await browser.evaluate("window.dispatchEvent(new Event('focus'))");
        await browser.wait(
          `document.querySelector('.beast-hero').dataset.individual.includes(':${attempt.earned}:${attempt.gray}:${attempt.status}')`,
        );
        await browser.click('Toàn bộ năng lực ›');
        const state = await read();
        assert.equal(state.id, first.id);
        assert.equal(state.number, '#1');
        assert.equal(state.status, status);
        assert.deepEqual(state.totals[2], ['Độ thuần', purity]);
        assert.deepEqual(state.opened, [false, false]);
        await browser.press('Escape');
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
  'all 18 ability roadmaps name the counted event, expose every tier and preserve secret artwork',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = evolutionFixture(0),
      server = await serve(control);
    const expected = {
      pyropup: /20 công việc nhận thưởng/,
      rubblet: /5 ngày vừa đủ thói quen vừa báo ngủ đúng giờ/,
      frostnip: /đủ thói quen và báo ngủ đúng giờ trong cùng ngày/,
      zappur: /công việc nhận thưởng thứ 3/,
      skinklet: /3 lượt quay thường có thưởng tu vi/,
      punchimp: /5 ngày hoàn thành đủ thói quen/,
      shardsnail: /5 ngày hoàn thành đủ thói quen/,
      flameow: /công việc nhận thưởng thứ 3/,
      manteeny: /công việc nhận thưởng thứ 3/,
      fluffle: /3 lần báo ngủ đúng giờ/,
      maskfry: /đủ thói quen trong ngày/,
      goonbug: /ngày đủ thói quen thứ 7 chắc chắn/,
      humbug: /3 ngày hoàn thành đủ thói quen/,
      hootlet: /Tối đa một lần\/tuần/,
      gibber: /đủ thói quen trong ngày/,
      voltfawn: /công việc nhận thưởng thứ 3/,
      cheerling: /công việc nhận thưởng thứ 3/,
      funglet: /đủ thói quen và báo ngủ đúng giờ trong cùng ngày/,
    };
    let browser;
    try {
      await mkdir(captures, { recursive: true });
      browser = await chrome();
      for (const species of control.beastData.config.catalog) {
        const beast = control.ownedBeasts[0];
        beast.speciesId = species.id;
        Object.assign(beast.attempt, {
          speciesId: species.id,
          form: 1,
          earned: 0,
          gray: 0,
          status: 'training',
        });
        control.beastData.speciesCounts = { [species.id]: 1 };
        await open(browser, server.url);
        await browser.click('Toàn bộ năng lực ›');
        await browser.wait("!!document.querySelector('.beast-roadmap')");
        const view = await browser.evaluate(`({
        forms:[...document.querySelectorAll('.beast-roadmap-step[data-tier]')].map(x=>x.dataset.tier),
        quality:[...document.querySelectorAll('.beast-milestone .hint')].map(x=>x.textContent),
        full:document.querySelector('.beast-roadmap-full').textContent,
        text:document.querySelector('.beast-roadmap').textContent,
        images:document.querySelectorAll('#sheet img').length,
        overflow:document.documentElement.scrollWidth>innerWidth+1
      })`);
        assert.deepEqual(view.forms, ['1', '2', '3', '4'], species.id);
        assert.match(view.full, /Chốt độ thuần cuối lượt/);
        assert.match(view.quality[0], expected[species.id], species.id);
        assert.equal(view.images, 0, species.id);
        assert.equal(view.overflow, false, species.id);
        assert.match(view.text, /Độ thuần ≥ 95%/);
        assert.match(view.text, /Độ thuần 100%/);
        if (species.id === 'pyropup') {
          assert.match(view.text, /40% cơ hội nhận thêm 1 vé thường/);
          assert.match(view.text, /40% → 80%/);
          await browser.screenshot(captures + '/pyropup-roadmap-390.png');
          await browser.evaluate(
            "document.querySelector('.beast-milestones').scrollIntoView({block:'start'})",
          );
          await browser.screenshot(captures + '/pyropup-quality-390.png');
          for (const width of [320, 390, 1440]) {
            await browser.resize(width, 844);
            await browser.scaleText(1.5);
            for (const theme of ['light', 'dark']) {
              await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
              assert.equal(
                await browser.evaluate(
                  "document.documentElement.scrollWidth>innerWidth+1 || document.querySelector('#sheet').scrollWidth>document.querySelector('#sheet').clientWidth+1",
                ),
                false,
                `${width}px roadmap ${theme}`,
              );
            }
          }
          await browser.scaleText(1);
        }
        if (species.id === 'funglet') {
          assert.match(view.quality[1], /đủ thói quen trong 3 ngày/);
          assert.doesNotMatch(view.quality[1], /ngủ/);
        }
        assert.deepEqual(browser.errors, []);
      }
      assert.equal(control.posts.length, 0, 'Reading a roadmap never changes the beast');
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'companion skills show saved cumulative progress and the correct weekly claim after rollover',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = evolutionFixture(600, 0, 4),
      server = await serve(control);
    const beast = control.ownedBeasts[0];
    let browser;
    try {
      browser = await chrome();
      beast.speciesId = 'pyropup';
      Object.assign(beast.attempt, {
        speciesId: 'pyropup',
        earned: 1600,
        form: 4,
        status: 'completed',
      });
      beast.counters = { awakening: 19 };
      await open(browser, server.url);
      await browser.click('Đồng hành');
      assert.match(
        await browser.evaluate("document.querySelector('.beast-skill-counter').textContent"),
        /19\/20 công việc tích lũy/,
      );
      beast.speciesId = 'hootlet';
      Object.assign(beast.attempt, { speciesId: 'hootlet', earned: 600 });
      const day = control.beastData.day.day,
        week = day - ((((day + 3) % 7) + 7) % 7);
      beast.counters = {
        awakening: 2,
        week: week - 7,
        weekPaid: 1,
        [`awakening:${week - 7}`]: 2,
        [`weekPaid:${week - 7}`]: 1,
      };
      await open(browser, server.url);
      await browser.click('Đồng hành');
      assert.match(
        await browser.evaluate("document.querySelector('.beast-skill-counter').textContent"),
        /0\/3 lần báo ngủ đúng giờ trong tuần/,
      );
      beast.counters[`weekPaid:${week}`] = 1;
      await open(browser, server.url);
      await browser.click('Đồng hành');
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-skill-counter').textContent"),
        'Đã nhận phần thưởng tuần này',
      );
      assert.deepEqual(browser.errors, []);
      assert.equal(control.posts.length, 0);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'discovered variants are gray, impurity blocks T4, and narrow, dark and large-text layouts retain usable controls',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = evolutionFixture(320, 240, 3),
      server = await serve(control);
    control.beastData.discoveries = { gibber: { form: 4, awakened: true, perfect: true } };
    let browser;
    try {
      browser = await chrome();
      await open(browser, server.url);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolve-button').disabled"),
        true,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-progress').dataset.evolutionState"),
        'blocked',
      );
      assert.equal(
        await browser.evaluate(
          'getComputedStyle(document.querySelector(\'[data-form="4"] img\')).filter',
        ),
        'grayscale(1)',
      );
      await browser.evaluate(
        "document.querySelector('.beast-progress').scrollIntoView({block:'center'})",
      );
      await browser.screenshot(captures + '/blocked-t3-390.png');
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [1440, 1000],
      ]) {
        await browser.resize(width, height);
        for (const theme of ['light', 'dark']) {
          await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
          await browser.scaleText(1);
          await browser.scaleText(1.5);
          const layout = await browser.evaluate(`(() => {
          const copy=document.querySelector('.beast-hero-copy').getBoundingClientRect(),art=document.querySelector('.beast-hero > img').getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,overlap:copy.bottom>art.top+1&&copy.right>art.left+1};
        })()`);
          assert.deepEqual(layout, { overflow: false, overlap: false }, `${width}px ${theme}`);
        }
      }
      await browser.scaleText(1);
      await browser.resize(390, 844);
      await browser.evaluate(
        "document.querySelector('.beast-hero').scrollIntoView({block:'start'})",
      );
      await browser.screenshot(captures + '/dark-390.png');
      Object.assign(control.ownedBeasts[0].attempt, { form: 4, earned: 500, gray: 20 });
      await open(browser, server.url);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-stage-message').textContent"),
        'Còn 8 điểm để luyện đầy T4.',
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.beast-milestones .beast-milestone').length",
        ),
        2,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'reduced motion skips the sequence and a lost response recovers the same evolution without spending another transition',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = evolutionFixture(),
      original = control.beastApi;
    let lose = true;
    control.beastApi = async (request, endpoint) => {
      const response = await original(request, endpoint);
      if (request.method === 'POST' && lose) {
        lose = false;
        return {
          status: 503,
          body: { error: 'OPERATION_NOT_CONFIRMED', message: 'Kiểm tra kết quả tiến hóa.' },
        };
      }
      return clone(response);
    };
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.reducedMotion();
      await open(browser, server.url);
      await browser.click('Tiến hóa');
      await browser.wait("document.body.textContent.includes('Kiểm tra kết quả')");
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "[...document.querySelectorAll('button')].some(button=>button.textContent==='Kiểm tra kết quả')",
      );
      await browser.click('Kiểm tra kết quả');
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-finished')");
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolution-final').hidden"),
        false,
      );
      assert.equal(control.ownedBeasts[0].attempt.form, 2);
      assert.equal(control.posts.filter((post) => post.input.operation === 'evolve').length, 1);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
