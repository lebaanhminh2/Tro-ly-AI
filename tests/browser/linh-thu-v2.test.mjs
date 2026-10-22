import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { BEAST_CATALOG } from '../../src/domain/linh-thu-catalog.ts';
import {
  beastV2SpeciesProjection,
  beastV2SkillProgress,
  initialBeastV2State,
} from '../../src/domain/linh-thu-v2.ts';
import { beastFixture } from './linh-thu-fixture.mjs';
import { serve, chrome, browserBin } from './app-harness.mjs';

const captures = `trial-results/linh-thu/v2/run-${process.pid}`;
function v2Fixture(speciesId = 'flameow') {
  const control = beastFixture(),
    data = control.beastData,
    beast = control.ownedBeasts[0];
  beast.speciesId = speciesId;
  const species = BEAST_CATALOG.find((entry) => entry.id === speciesId);
  beast.attempt = {
    speciesId,
    ruleVersion: 1,
    form: 4,
    status: 'completed',
    earned: data.config.training[species.rank].capacity,
    gray: 0,
  };
  beast.skillStateV2 = {
    ...initialBeastV2State(),
    counters: { habit95: 2, perfect100: 1 },
    daily: { ...initialBeastV2State().daily, day: data.day.day, fusionUses: 2 },
  };
  data.config.skillVersion = 2;
  data.config.skillsV2 = Object.fromEntries(
    BEAST_CATALOG.map((entry) => [entry.id, beastV2SpeciesProjection(entry.id)]),
  );
  data.v2 = {
    active: true,
    day: data.day.day,
    taskCount: 8,
    startSleepStreak: 21,
    multiplier: 1,
    pendingDay: data.day.day,
    taskBuff: { qi: 1, tickets: 1 },
    selfBurnFinal: 36,
  };
  Object.defineProperty(data.v2, 'skillProgress', {
    enumerable: true,
    get() {
      if (!data.v2.active) return null;
      const role = data.roles.current.find((entry) => entry.role === 'companion');
      const selected = data.selected.find(
        (entry) => entry.id === role?.beastId && entry.attemptId === role?.attemptId,
      );
      if (!selected) return null;
      const state = selected.skillStateV2 ?? initialBeastV2State();
      const full =
        selected.attempt.form === 4 &&
        selected.attempt.status === 'completed' &&
        selected.attempt.gray === 0;
      return {
        beastId: selected.id,
        attemptId: selected.attemptId,
        items: beastV2SkillProgress(
          {
            speciesId: selected.speciesId,
            form: selected.attempt.form,
            awakened: full,
            perfect: full,
          },
          state,
          {
            day: data.v2.day,
            taskCount: data.v2.taskCount,
            daily: state.daily,
            startSleepStreak: data.v2.startSleepStreak,
            multiplier: data.v2.multiplier,
            claimedToday: [],
            recentRewards: [],
            tower: null,
          },
        ),
      };
    },
  });
  data.speciesCounts = { [speciesId]: 1 };
  return control;
}
async function open(browser, url) {
  await browser.navigate(url, 390);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
  await browser.wait('!!document.querySelector(\'.beast-support[data-skill-version="2"]\')');
  await browser.click('Đồng hành');
}

test(
  'mobile pre-cutover turtle roadmap shows approved five-qi refund and start time while current one-qi skill stays effective',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture('gibber'),
      data = control.beastData,
      beast = control.ownedBeasts[0];
    beast.attempt = { ...beast.attempt, form: 1, status: 'training', earned: 0, gray: 12 };
    data.config.skillVersion = 1;
    data.v2.active = false;
    data.v2.cutoverDay = data.day.day + 1;
    data.day.endAt = Date.parse('2026-10-23T05:30:00+07:00');
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-support')");
      await browser.click('Đồng hành');
      const current = await browser.evaluate(
        "document.querySelector('.beast-support').textContent",
      );
      assert.match(current, /tối đa 1 tu vi/);
      assert.match(current, /05:30 ngày 23\/10\/2026/);
      await browser.click('Toàn bộ năng lực ›');
      await browser.wait("!!document.querySelector('.beast-roadmap[data-skill-preview=true]')");
      const text = await browser.evaluate("document.querySelector('.beast-roadmap').textContent");
      assert.match(text, /Bộ kỹ năng mới đã chốt/);
      assert.match(text, /05:30 ngày 23\/10\/2026/);
      assert.match(text, /Hiện tại vẫn tính thưởng theo bộ kỹ năng cũ/);
      const t1 = await browser.evaluate(
        'document.querySelector(\'.beast-roadmap [data-tier="1"]\').textContent',
      );
      assert.match(t1, /25%.*5 tu vi/);
      assert.doesNotMatch(t1, /tối đa 1 tu vi/);
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('.beast-roadmap [data-tier]')].map(n=>n.dataset.tier)",
        ),
        ['1', '2', '3', '4', '95', '100'],
      );
      assert.equal(
        await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
        true,
      );
      await mkdir(captures, { recursive: true });
      await browser.screenshot(captures + '/pending-turtle-390.png');
      await browser.press('Escape');
      assert.match(
        await browser.evaluate("document.querySelector('.beast-support').textContent"),
        /tối đa 1 tu vi/,
      );
      assert.equal(
        control.posts.length,
        0,
        'opening the approved table never changes cutover or rewards',
      );
      data.config.skillVersion = 2;
      data.v2.active = true;
      await open(browser, server.url);
      const updated = await browser.evaluate(
        "document.querySelector('.beast-support').textContent",
      );
      assert.match(updated, /5 tu vi/);
      assert.doesNotMatch(updated, /Hiện tại vẫn tính thưởng theo bộ kỹ năng cũ/);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'v2 automatic abilities show authoritative descriptions and progress without weekly activation on mobile',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture(),
      server = await serve(control);
    let browser;
    try {
      await mkdir(captures, { recursive: true });
      browser = await chrome();
      await open(browser, server.url);
      const text = await browser.evaluate("document.querySelector('.beast-support').textContent");
      assert.match(text, /60%/);
      assert.match(text, /Không giới hạn số việc/);
      assert.match(text, /Thiên phú xét 5 công việc/);
      assert.match(text, /Đã hoàn thành 8 công việc hôm nay/);
      assert.match(text, /Thưởng công việc hôm nay/);
      assert.doesNotMatch(text, /Đang chờ chốt|Chuỗi ngủ đúng giờ đầu ngày|Tự động/);
      assert.doesNotMatch(text, /kích hoạt.*tuần|Xem tuyệt kỹ hoàn mỹ/);
      await browser.screenshot(captures + '/companion-390.png');
      await browser.click('Toàn bộ năng lực ›');
      const steps = await browser.evaluate(
        "[...document.querySelectorAll('#sheet-content [data-tier]')].map(el=>el.dataset.tier)",
      );
      assert.deepEqual(steps, ['1', '2', '3', '4', '95', '100']);
      const roadmap = await browser.evaluate(
        "document.querySelector('.beast-roadmap').textContent",
      );
      for (const chance of ['15%', '30%', '45%', '60%']) assert.ok(roadmap.includes(chance));
      assert.doesNotMatch(roadmap, /mỗi tuần|18 tu vi|bấm kích hoạt/i);
      assert.equal(
        await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),
        true,
      );
      await browser.screenshot(captures + '/roadmap-390.png');
      await browser.press('Escape');
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait('!!document.querySelector(\'.beast-support[data-skill-version="2"]\')');
      assert.equal(control.posts.filter((entry) => entry.input.operation === 'ultimate').length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'v2 all 18 roadmaps render six milestones and exact nonlinear rates; legacy paid choices remain accessible',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture('voltfawn');
    control.beastData.choices = [{ id: 'legacy-paid', options: [{ qi: 12 }, { tickets: 5 }] }];
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await open(browser, server.url);
      assert.match(
        await browser.evaluate("document.querySelector('.beast-reward-choice').textContent"),
        /Thành quả đang chờ/,
      );
      const projections = control.beastData.config.skillsV2;
      const results = await browser.evaluate(`(async () => {
      const {beastAbilityRoadmap} = await import('/views/linh-thu.js');
      const {el,button} = await import('/ui/dom.js');
      const data = ${JSON.stringify(control.beastData)};
      data.config.skillsV2 = ${JSON.stringify(projections)};
      return data.config.catalog.map(species => {
        const beast = {...data.selected[0],speciesId:species.id,attempt:{...data.selected[0].attempt,speciesId:species.id,earned:data.config.training[species.rank].capacity}};
        const node = beastAbilityRoadmap({el,button},data,beast);
        return {id:species.id,tiers:[...node.querySelectorAll('[data-tier]')].map(n=>n.dataset.tier),text:node.textContent};
      });
    })()`);
      assert.equal(results.length, 18);
      for (const result of results) {
        assert.deepEqual(result.tiers, ['1', '2', '3', '4', '95', '100']);
        assert.doesNotMatch(
          result.text,
          /mỗi tuần|Xem tuyệt kỹ hoàn mỹ|Không đạt trong lượt này|Hoàn mỹ giữ cả|· Tự động|X=min/,
        );
      }
      const deer = results.find((entry) => entry.id === 'voltfawn').text;
      for (const chance of ['10%', '20%', '30%', '35%']) assert.ok(deer.includes(chance));
      assert.match(results.find((entry) => entry.id === 'pyropup').text, /36/);
      assert.match(results.find((entry) => entry.id === 'humbug').text, /Phá Cảnh Phù trung cấp/);
      assert.match(
        results.find((entry) => entry.id === 'skinklet').text,
        /tỷ lệ nhận 1 vé triệu hồi linh thú của Huyễn Tức tăng từ 35% lên 55%/,
      );
      assert.match(
        results.find((entry) => entry.id === 'pyropup').text,
        /mất gấp 3 tu vi khi bị phạt/,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'v2 evolution uses the server roadmap for nonlinear upgrades and retains automatic skills after commit',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture('voltfawn');
    control.ownedBeasts[0].attempt.form = 3;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 1024);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-upgrade')");
      assert.match(
        await browser.evaluate("document.querySelector('.beast-upgrade').textContent"),
        /30%.*35%/,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-upgrade .beast-upgrade-change strong').textContent",
        ),
        '30% → 35%',
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-upgrade .beast-upgrade-copy').textContent",
        ),
        'Hoàn thành công việc: nhận thêm 1 tu vi.',
      );
      await browser.click('Tiến hóa');
      await browser.wait("!!document.querySelector('.beast-evolution-theatre.is-playing')");
      await browser.click('Bỏ qua hiệu ứng');
      assert.match(
        await browser.evaluate("document.querySelector('.beast-evolution-final').textContent"),
        /30%.*35%/,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-evolution-final .beast-upgrade-change strong').textContent",
        ),
        '30% → 35%',
      );
      await browser.click('Tiếp tục nuôi dưỡng');
      await browser.wait("document.querySelector('.beast-support')?.textContent.includes('35%')");
      assert.equal(control.posts.filter((entry) => entry.input.operation === 'evolve').length, 1);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'mobile turtle upgrade is concise and its T4 to purity rail remains connected in both themes and larger text',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture('gibber');
    Object.assign(control.ownedBeasts[0].attempt, {
      form: 1,
      status: 'training',
      earned: 0,
      gray: 12,
    });
    control.beastData.v2.taskBuff = { qi: 0, tickets: 0 };
    control.beastData.v2.taskCount = 0;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-upgrade')");
      const upgrade = await browser.evaluate(`(() => {
        const row=document.querySelector('.beast-upgrade-row');
        return {name:row.querySelector('.beast-upgrade-name').textContent,change:row.querySelector('.beast-upgrade-change strong').textContent,description:row.querySelector('.beast-upgrade-copy').textContent};
      })()`);
      assert.deepEqual(upgrade, {
        name: 'Thạch Giáp',
        change: '25% → 50%',
        description: 'Đột phá thất bại: hoàn tối đa 5 tu vi thực mất.',
      });
      await mkdir(captures, { recursive: true });
      await browser.evaluate(
        "document.querySelector('.beast-upgrade').scrollIntoView({block:'center'})",
      );
      await browser.screenshot(captures + '/turtle-upgrade-390.png');
      await browser.click('Toàn bộ năng lực ›');
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const scale of [1, 1.5]) {
          await browser.scaleText(scale);
          for (const width of [320, 390]) {
            await browser.resize(width, 844);
            const geometry = await browser.evaluate(`(() => {
              const track=document.querySelector('.beast-roadmap-track');
              const last=track.querySelector('[data-tier="100"]');
              const mark=last.querySelector('.beast-milestone-mark');
              const center=mark.getBoundingClientRect().top+mark.getBoundingClientRect().height/2;
              return {endGap:Math.abs(center-last.getBoundingClientRect().top-parseFloat(getComputedStyle(last,'::after').top)),overflow:track.scrollWidth>track.clientWidth+1,railColor:getComputedStyle(track,'::before').backgroundColor};
            })()`);
            assert.ok(geometry.endGap < 1, `${theme} ${width}px text ${scale}: last marker center`);
            assert.equal(geometry.overflow, false);
            assert.notEqual(geometry.railColor, 'rgba(0, 0, 0, 0)');
          }
        }
        await browser.scaleText(1);
        await browser.resize(390, 844);
        await browser.evaluate(`(() => {
          const sheet=document.querySelector('#sheet');
          const target=sheet.querySelector('[data-tier="4"]');
          const title=sheet.querySelector('.sheet-title-row');
          target.scrollIntoView({block:'start'});
          let scroller=target.parentElement;
          while(scroller && !(['auto','scroll'].includes(getComputedStyle(scroller).overflowY) && scroller.scrollHeight>scroller.clientHeight)) scroller=scroller.parentElement;
          if(scroller) scroller.scrollTop+=target.getBoundingClientRect().top-Math.max(scroller.getBoundingClientRect().top,title.getBoundingClientRect().bottom)-18;
        })()`);
        assert.equal(
          await browser.evaluate(`(() => {
          const title=document.querySelector('#sheet .sheet-title-row').getBoundingClientRect();
          return [...document.querySelectorAll('.beast-roadmap-track .beast-milestone-mark')].every(node=>node.getBoundingClientRect().top>=title.bottom && node.getBoundingClientRect().bottom<innerHeight);
        })()`),
          true,
        );
        await browser.screenshot(captures + '/turtle-unlocks-' + theme + '-390.png');
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
  'all companion meters attach to their own skill with accessible values, narrow layouts and no duplicate totals',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture('hootlet');
    const samples = BEAST_CATALOG.map((species) => {
      const sample = v2Fixture(species.id),
        data = sample.beastData,
        state = data.selected[0].skillStateV2;
      state.counters = {
        habit95: 2,
        sleep95: 2,
        sleepAccum95: 2,
        sleep100: 2,
        perfect95: 2,
        perfect100: 2,
        combined100: 2,
        task95: 2,
        habitDry: 2,
        drawMisses: 1,
        breakthroughFailures: 3,
      };
      data.v2.taskCount = 2;
      data.v2.taskBuff = { qi: 0, tickets: 0 };
      state.daily.fusionUses = 1;
      state.daily.beforeNoonTasks = 2;
      return JSON.parse(JSON.stringify(data));
    });
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await open(browser, server.url);
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const width of [320, 390, 430]) {
          await browser.resize(width, 844);
          const results = await browser.evaluate(`(async()=>{
            const {beastAbilities}=await import('/views/linh-thu.js');
            const {el,button}=await import('/ui/dom.js');
            return ${JSON.stringify(samples)}.map(data=>{
              const beast=data.selected[0];
              const node=beastAbilities({el,button,showBeast(){}},data,beast,4,'companion');
              document.querySelector('.beast-support').replaceWith(node);
              const meters=[...node.querySelectorAll('.beast-skill-meter')];
              return {id:beast.speciesId,expected:Object.keys(data.v2.skillProgress.items).sort(),actual:meters.map(m=>m.closest('[data-skill-id]')?.dataset.skillId).sort(),
                overflow:node.scrollWidth>node.clientWidth+1,
                values:[...node.querySelectorAll('[role=progressbar]')].map(m=>({value:+m.getAttribute('aria-valuenow'),max:+m.getAttribute('aria-valuemax'),label:m.getAttribute('aria-label'),text:m.getAttribute('aria-valuetext')})),
                duplicate:/Công việc hợp lệ hôm nay|Chuỗi ngủ đúng giờ đầu ngày/.test(node.textContent)};
            });
          })()`);
          for (const result of results) {
            assert.deepEqual(result.actual, result.expected, result.id + ' meter placement');
            assert.equal(result.overflow, false, theme + ' ' + width + ' ' + result.id);
            assert.equal(result.duplicate, false);
            for (const value of result.values)
              assert.ok(value.value >= 0 && value.value <= value.max && value.label && value.text);
          }
        }
      }
      await browser.resize(390, 844);
      await mkdir(captures, { recursive: true });
      for (const species of ['hootlet', 'humbug', 'skinklet', 'gibber']) {
        for (const theme of ['light', 'dark']) {
          await browser.evaluate(`(async()=>{
            document.documentElement.dataset.theme='${theme}';
            const {beastAbilities}=await import('/views/linh-thu.js');const {el,button}=await import('/ui/dom.js');
            const data=${JSON.stringify(samples)}.find(data=>data.selected[0].speciesId==='${species}');
            const node=beastAbilities({el,button,showBeast(){}},data,data.selected[0],4,'companion');document.querySelector('.beast-support').replaceWith(node);node.scrollIntoView({block:'start'});
          })()`);
          await browser.screenshot(captures + '/meters-' + species + '-' + theme + '-390.png');
        }
      }
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-support')");
      await browser.click('Đồng hành');
      const meterSelector = '.beast-support [data-skill-id="awakening"] [role="progressbar"]';
      await browser.wait(
        `document.querySelector('${meterSelector}')?.getAttribute('aria-valuenow')==='0'`,
      );
      control.beastData.selected[0].skillStateV2.counters.sleep95 = 2;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        `document.querySelector('${meterSelector}')?.getAttribute('aria-valuenow')==='2'`,
      );
      control.beastData.selected[0].skillStateV2.counters.sleep95 = 0;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        `document.querySelector('${meterSelector}')?.getAttribute('aria-valuenow')==='0'`,
      );
      await browser.click('Toàn bộ năng lực ›');
      assert.equal(
        await browser.evaluate(
          "getComputedStyle(document.querySelector('.sheet-title-row')).borderBottomWidth",
        ),
        '1px',
      );
      await browser.evaluate(
        "document.querySelector('.beast-roadmap [data-tier=\"4\"]').scrollIntoView({block:'start'})",
      );
      await browser.screenshot(captures + '/sheet-header-divider-390.png');
      assert.deepEqual(browser.errors, []);
      assert.equal(control.posts.length, 0);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'skill sheets stay aligned at phone and desktop sizes; long pyro exceptions expand without hiding daily costs',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = v2Fixture('pyropup');
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await open(browser, server.url);
      await browser.click('Toàn bộ năng lực ›');
      for (const width of [320, 390, 430, 1024]) {
        await browser.resize(width, width < 900 ? 844 : 1000);
        const results = await browser.evaluate(`(async () => {
          const {beastAbilityRoadmap} = await import('/views/linh-thu.js');
          const {el,button} = await import('/ui/dom.js');
          const data = ${JSON.stringify(control.beastData)};
          const host = document.querySelector('#sheet-content');
          return data.config.catalog.map(species => {
            const beast = {...data.selected[0],speciesId:species.id,attempt:{...data.selected[0].attempt,speciesId:species.id,earned:data.config.training[species.rank].capacity}};
            const node = beastAbilityRoadmap({el,button},data,beast);
            host.replaceChildren(node);
            const left = [...node.querySelectorAll('[data-tier] h2, [data-tier] h3')].map(n=>n.getBoundingClientRect().left);
            const track = node.querySelector('.beast-roadmap-track');
            const rail = getComputedStyle(track,'::before');
            const railX = track.getBoundingClientRect().left + parseFloat(rail.left) + parseFloat(rail.width)/2;
            const markers = [...track.querySelectorAll('.beast-roadmap-heading,.beast-milestone-mark')].map(anchor => {
              const style = getComputedStyle(anchor,'::before');
              const box = anchor.getBoundingClientRect();
              const border = getComputedStyle(anchor);
              return {
                x:box.left+parseFloat(border.borderLeftWidth)+parseFloat(style.left)+parseFloat(style.width)/2,
                y:box.top+parseFloat(border.borderTopWidth)+parseFloat(style.top)+parseFloat(style.height)/2,
              };
            });
            const last = track.querySelector('[data-tier="100"]');
            const end = last.getBoundingClientRect().top + parseFloat(getComputedStyle(last,'::after').top);
            return {
              id:species.id,
              overflow:host.scrollWidth > host.clientWidth + 1 || node.scrollWidth > node.clientWidth + 1,
              aligned:Math.max(...left)-Math.min(...left)<2,
              badges:node.querySelectorAll('.beast-milestone-mark').length,
              rail:parseFloat(rail.width)===2 && markers.length===6 && markers.every(marker=>Math.abs(marker.x-railX)<1),
              endpoints:Math.abs(markers[0].y-(track.getBoundingClientRect().top+parseFloat(rail.top)))<1 && Math.abs(markers.at(-1).y-end)<1,
              noSegmentBorders:[...track.querySelectorAll('[data-tier]')].every(row=>parseFloat(getComputedStyle(row).borderLeftWidth)===0),
              summaries:[...node.querySelectorAll('summary')].map(n=>n.getBoundingClientRect().height),
            };
          });
        })()`);
        for (const result of results) {
          assert.equal(result.overflow, false, `${width}px ${result.id}: overflow`);
          assert.equal(result.aligned, true, `${width}px ${result.id}: timeline alignment`);
          assert.equal(result.badges, 2);
          assert.equal(
            result.rail,
            true,
            `${width}px ${result.id}: shared rail and marker centers`,
          );
          assert.equal(
            result.endpoints,
            true,
            `${width}px ${result.id}: rail starts and ends at marker centers`,
          );
          assert.equal(
            result.noSegmentBorders,
            true,
            `${width}px ${result.id}: no separate connector segments`,
          );
          assert.ok(result.summaries.every((height) => height >= 44));
        }
      }
      await browser.resize(390, 844);
      await browser.press('Escape');
      await browser.click('Toàn bộ năng lực ›');
      const read = () =>
        browser.evaluate(`(() => {
        const row=document.querySelector('.beast-roadmap [data-tier="100"]');
        const details=row.querySelector('details');
        return {main:row.querySelector('.hint').textContent,open:details.open,text:details.textContent};
      })()`);
      assert.equal((await read()).open, false);
      assert.match((await read()).main, /gấp 3 phần thưởng.*gấp 3 tu vi.*36 tu vi/);
      await browser.evaluate(
        `document.querySelector('.beast-roadmap .beast-skill-details summary').focus()`,
      );
      await browser.press('Enter');
      assert.equal((await read()).open, true);
      assert.match((await read()).text, /ngủ muộn vẫn chịu phạt ×3/);
      assert.match((await read()).text, /Không nhân chi phí, khoản hoàn trả/);
      await mkdir(captures, { recursive: true });
      await browser.evaluate(
        `document.querySelector('.beast-roadmap [data-tier="95"]').scrollIntoView({block:'start'})`,
      );
      await browser.screenshot(captures + '/pyro-details-390.png');
      await browser.evaluate("document.documentElement.dataset.theme='dark'");
      assert.notEqual(
        await browser.evaluate(
          "getComputedStyle(document.querySelector('#sheet')).backgroundColor",
        ),
        'rgb(255, 255, 255)',
      );
      await browser.screenshot(captures + '/pyro-details-dark-390.png');
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);
