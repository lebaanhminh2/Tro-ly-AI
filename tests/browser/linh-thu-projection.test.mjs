import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { beastFixture } from './linh-thu-fixture.mjs';
import { serve, chrome, browserBin, clone } from './app-harness.mjs';

const options = { skip: !browserBin, timeout: 60000 };
const captures = `trial-results/linh-thu/roles-main/run-${process.pid}`;
function fixture() {
  const control = beastFixture(),
    day = control.habits.day.day;
  Object.assign(control.beastData.selected[0].attempt, { form: 3, earned: 716, gray: 0 });
  control.habits.habits = Array.from({ length: 4 }, (_, i) => {
    const definition = {
      name: 'Thói quen ' + (i + 1),
      metric: 'check',
      target: 100,
      unit: 'lần',
      note: '',
      cadence: { kind: 'daily' },
      commitmentFrom: day - 1,
    };
    return {
      habit: {
        id: 'projection_habit_' + i,
        version: 1,
        createdDay: day - 1,
        archivedFrom: null,
        revisions: [{ fromDay: day - 1, definition }],
      },
      definition,
      pending: null,
      log: { value: i < 2 ? 100 : 0, note: '', version: 0 },
      preview: { status: i < 2 ? 'achieved' : 'missed' },
      slot: null,
      reminderTime: null,
    };
  });
  return control;
}
async function using(control, callback) {
  const server = await serve(control);
  let browser;
  try {
    browser = await chrome();
    await browser.reducedMotion(true);
    await browser.navigate(server.url, 390);
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
    await browser.wait("!!document.querySelector('.beast-training-forecast')");
    await callback(browser);
    assert.deepEqual(browser.errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
}

test(
  'direct Linh thú entry gets real forecast; habit writes update it without changing committed points',
  options,
  async () => {
    const control = fixture(),
      before = clone(control.beastData.selected[0].attempt);
    await using(control, async (browser) => {
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-training-forecast').textContent"),
        'Hôm nay dự tính: +0,8 điểm thực · 0,8 tạp chất',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolve-button').disabled"),
        true,
      );
      await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
      await browser.wait("document.querySelectorAll('.habit-check').length===4");
      await browser.evaluate(
        "document.querySelector('[data-habit-id=projection_habit_2] .habit-check').click()",
      );
      await browser.wait(
        "document.querySelector('[data-habit-id=projection_habit_2] .habit-check')?.getAttribute('aria-pressed')==='true'&&!document.querySelector('[aria-busy=true]')",
      );
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait(
        "document.querySelector('.beast-training-forecast')?.textContent==='Hôm nay dự tính: +1,2 điểm thực · 0,4 tạp chất'",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-progress-track').getAttribute('aria-valuenow')",
        ),
        '21.6',
      );
      assert.deepEqual(control.beastData.selected[0].attempt, before);
    });
  },
);

test(
  'training totals stay in the renamed disclosure and exclude uncommitted forecasts',
  options,
  async () => {
    const control = fixture();
    control.beastData.selected[0].attempt.gray = 16;
    await using(control, async (browser) => {
      const readTotals = () =>
        browser.evaluate(
          "Array.from(document.querySelectorAll('.beast-training-totals > div')).map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])",
        );
      const expected = [
        ['Điểm thực', '71,6 / 118,4'],
        ['Tạp chất tích lũy', '1,6'],
        ['Độ thuần', '97,8% · Tạm tính'],
      ];
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-training-details summary').textContent",
        ),
        'Điểm thực và tạp chất',
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-training-details').open"),
        false,
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.beast-training-details p').length"),
        0,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-training-totals').closest('details') === document.querySelector('.beast-training-details')",
        ),
        true,
      );
      await browser.evaluate("document.querySelector('.beast-training-details summary').click()");
      assert.deepEqual(await readTotals(), expected);
      control.habits.habits.forEach((habit) => {
        habit.preview.status = 'achieved';
      });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-training-forecast')?.textContent.includes('+1,6')",
      );
      assert.deepEqual(await readTotals(), expected);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-training-details').open"),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-progress-track').getAttribute('aria-valuenow')",
        ),
        '21.6',
      );
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const width of [320, 390, 1440]) {
          await browser.resize(width, 1000);
          assert.equal(
            await browser.evaluate('document.documentElement.scrollWidth > innerWidth + 1'),
            false,
          );
        }
      }
      Object.assign(control.beastData.selected[0].attempt, { earned: 724, gray: 24 });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-training-totals dd')?.textContent === '72,4 / 117,6'",
      );
      assert.deepEqual(await readTotals(), [
        ['Điểm thực', '72,4 / 117,6'],
        ['Tạp chất tích lũy', '2,4'],
        ['Độ thuần', '96,7% · Tạm tính'],
      ]);
      Object.assign(control.beastData.selected[0].attempt, {
        form: 4,
        earned: 1176,
        gray: 24,
        status: 'completed',
      });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait("!!document.querySelector('.beast-training-result')");
      assert.deepEqual(await readTotals(), [
        ['Điểm thực', '117,6 / 117,6'],
        ['Tạp chất tích lũy', '2,4'],
      ]);
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-training-result').textContent"),
        'Độ thuần cuối lượt · 98%',
      );
      Object.assign(control.beastData.selected[0].attempt, { earned: 1200, gray: 0 });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-training-totals dd')?.textContent === '120 / 120'",
      );
      assert.deepEqual(await readTotals(), [
        ['Điểm thực', '120 / 120'],
        ['Tạp chất tích lũy', '0'],
      ]);
    });
  },
);

test(
  'focus refresh preserves bar nodes, forecasts never unlock evolution, and pending roles do not get today points',
  options,
  async () => {
    const control = fixture();
    await using(control, async (browser) => {
      await browser.evaluate(
        "window.forecastTrack=document.querySelector('.beast-progress-track');window.dayWidth=document.querySelector('.beast-progress-day').getBoundingClientRect().width",
      );
      control.habits.habits.forEach((h) => {
        h.preview.status = 'achieved';
      });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-training-forecast')?.textContent.includes('+1,6')",
      );
      assert.equal(
        await browser.evaluate(
          "window.forecastTrack===document.querySelector('.beast-progress-track')",
        ),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "window.dayWidth===document.querySelector('.beast-progress-day').getBoundingClientRect().width",
        ),
        true,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.beast-progress-preview-gray').getBoundingClientRect().width",
        ),
        0,
      );
      control.beastData.selected[0].attempt.earned = 792;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-progress-track').getAttribute('aria-valuenow')==='29.2'",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolve-button').disabled"),
        true,
      );
      const replacement = clone(control.beastData.selected[0]);
      replacement.id = 'replacement_beast';
      replacement.attemptId = 'replacement_attempt';
      control.beastData.selected.push(replacement);
      control.beastData.roles.pending.push({
        role: 'training',
        day: control.beastData.day.day + 1,
        beastId: replacement.id,
        attemptId: replacement.attemptId,
      });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-hero').dataset.beastId==='replacement_beast'",
      );
      assert.equal(
        await browser.evaluate("!!document.querySelector('.beast-training-forecast')"),
        false,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-evolve-button').disabled"),
        true,
      );
    });
  },
);

test(
  'late preview responses and failed requests cannot show stale daily points',
  options,
  async () => {
    const control = fixture(),
      original = control.beastApi;
    let release,
      blocked = false,
      fail = false;
    control.beastApi = async (request, endpoint) => {
      const result = await original(request, endpoint);
      if (endpoint === 'linh-thu/training-preview') {
        if (fail) return { status: 503, body: { error: 'UNAVAILABLE' } };
        if (blocked) {
          blocked = false;
          await new Promise((resolve) => {
            release = resolve;
          });
        }
      }
      return result;
    };
    await using(control, async (browser) => {
      blocked = true;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait("document.querySelector('.beast-updating').textContent!==''");
      for (let i = 0; i < 100 && !release; i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.ok(release);
      control.beastData.selected[0].attempt.earned = 730;
      control.habits.habits.forEach((h) => {
        h.preview.status = 'achieved';
      });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "document.querySelector('.beast-training-forecast')?.textContent.includes('+1,6')",
      );
      release();
      await browser.evaluate('new Promise(resolve=>setTimeout(resolve,50))');
      assert.equal(
        await browser.evaluate("document.querySelector('.beast-training-forecast').textContent"),
        'Hôm nay dự tính: +1,6 điểm thực · 0 tạp chất',
      );
      fail = true;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait(
        "!document.querySelector('.beast-training-forecast')&&document.querySelector('.beast-updating').textContent===''",
      );
      assert.equal(await browser.evaluate("!!document.querySelector('.beast-hero')"), true);
    });
  },
);

test(
  'normal motion interpolates daily gains while the progress card stays connected',
  options,
  async () => {
    const control = fixture();
    await using(control, async (browser) => {
      await browser.reducedMotion(false);
      await browser.evaluate("document.documentElement.dataset.motion='system'");
      await browser.evaluate('new Promise(resolve=>setTimeout(resolve,300))');
      const before = await browser.evaluate(
        "document.querySelector('.beast-progress-preview-earned').getBoundingClientRect().width",
      );
      control.habits.habits.forEach((habit) => {
        habit.preview.status = 'achieved';
      });
      await browser.evaluate(`
        window.projectionFrames = [];
        window.projectionRecording = true;
        window.progressCard = document.querySelector('.beast-progress');
        function recordProjection() {
          const segment = document.querySelector('.beast-progress-preview-earned');
          if (segment) window.projectionFrames.push(segment.getBoundingClientRect().width);
          if (window.projectionRecording) requestAnimationFrame(recordProjection);
        }
        recordProjection();
        window.dispatchEvent(new Event('focus'));
      `);
      await browser.wait(
        "document.querySelector('.beast-training-forecast')?.textContent.includes('+1,6')",
      );
      await browser.evaluate('new Promise(resolve=>setTimeout(resolve,350))');
      const result = await browser.evaluate(`(() => {
        window.projectionRecording = false;
        return { frames: window.projectionFrames,
          same: window.progressCard === document.querySelector('.beast-progress'),
          width: document.querySelector('.beast-progress-preview-earned').getBoundingClientRect().width };
      })()`);
      assert.equal(result.same, true);
      assert.ok(result.frames.some((width) => width > before + 0.1 && width < result.width - 0.1));
    });
  },
);

test(
  'daily preview expires and refreshes at the operating-day boundary without a tab switch',
  options,
  async () => {
    const control = fixture();
    await using(control, async (browser) => {
      const endAt = control.beastData.day.endAt;
      control.beastData.now = endAt - 2000;
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait("document.querySelector('.beast-updating').textContent===''");
      control.beastData.now = endAt + 1;
      control.beastData.day = { day: control.beastData.day.day + 1, endAt: endAt + 86400000 };
      control.habits.day = {
        ...control.habits.day,
        day: control.beastData.day.day,
        startAt: endAt,
        endAt: endAt + 86400000,
      };
      Object.assign(control.beastData.selected[0].attempt, { earned: 724, gray: 8 });
      control.habits.habits.forEach((h) => {
        h.preview.status = 'missed';
      });
      await browser.wait(
        "document.querySelector('.beast-progress-track').getAttribute('aria-valuenow')==='22.4'&&document.querySelector('.beast-training-forecast')?.textContent==='Hôm nay dự tính: +0 điểm thực · 1,6 tạp chất'",
      );
    });
  },
);

test(
  'approved role layouts, joined bar and original ability roadmap work in light, dark and reduced motion',
  options,
  async () => {
    const control = fixture();
    await using(control, async (browser) => {
      await mkdir(captures, { recursive: true });
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const width of [320, 390, 1440]) {
          await browser.resize(width, 1000);
          const result = await browser.evaluate(
            `(() => { const day=document.querySelector('.beast-progress-day'), real=document.querySelector('.beast-progress-earned'); return {overflow:document.documentElement.scrollWidth>innerWidth+1,gap:day.getBoundingClientRect().left-real.getBoundingClientRect().right,left:getComputedStyle(day).borderTopLeftRadius,right:getComputedStyle(day).borderTopRightRadius,shadow:getComputedStyle(document.querySelector('.beast-progress-preview-gray')).boxShadow,transition:getComputedStyle(day).transitionDuration}; })()`,
          );
          assert.equal(result.overflow, false);
          assert.equal(result.gap, 0);
          assert.equal(result.left, '0px');
          assert.equal(result.right, '4px');
          assert.equal(result.shadow, 'none');
          assert.equal(result.transition, '0s');
          const typography = await browser.evaluate(`(() => {
            const style = node => {
              const s = getComputedStyle(node);
              return { size: s.fontSize, weight: s.fontWeight, family: s.fontFamily,
                lineHeight: s.lineHeight, transform: s.textTransform };
            };
            return {
              actions: Array.from(document.querySelectorAll('.beast-role-actions button'), style),
              forecast: style(document.querySelector('.beast-training-forecast')),
              message: style(document.querySelector('.beast-stage-message'))
            };
          })()`);
          assert.deepEqual(typography.actions[0], typography.actions[1]);
          assert.deepEqual(typography.forecast, typography.message);
          assert.equal(
            await browser.evaluate(
              "getComputedStyle(document.querySelector('.beast-evolve-button')).color",
            ),
            theme === 'dark' ? 'rgb(165, 154, 175)' : 'rgb(137, 131, 149)',
          );
          await browser.screenshot(`${captures}/training-${theme}-${width}.png`);
        }
        await browser.resize(390, 1000);
        await browser.evaluate(
          "document.querySelector('.beast-progress').scrollIntoView({block:'start'})",
        );
        await browser.screenshot(`${captures}/progress-${theme}-390.png`);
        await browser.click('Đồng hành');
        await browser.screenshot(`${captures}/companion-${theme}-390.png`);
        assert.equal(
          await browser.evaluate("!!document.querySelector('.beast-training-forecast')"),
          false,
        );
        await browser.click('Toàn bộ năng lực ›');
        assert.equal(
          await browser.evaluate(
            "document.querySelectorAll('.beast-roadmap-step[data-tier]').length",
          ),
          4,
        );
        await browser.screenshot(`${captures}/roadmap-${theme}-390.png`);
        await browser.press('Escape');
        await browser.click('Đang luyện');
      }
      Object.assign(control.beastData.selected[0].attempt, {
        form: 4,
        earned: 1200,
        gray: 0,
        status: 'completed',
      });
      await browser.evaluate("window.dispatchEvent(new Event('focus'))");
      await browser.wait("!!document.querySelector('.beast-quality-label')");
      for (const theme of ['light', 'dark']) {
        await browser.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        for (const label of ['Đang luyện', 'Đồng hành']) {
          await browser.click(label);
          assert.equal(
            await browser.evaluate("!!document.querySelector('.beast-training-forecast')"),
            false,
          );
          assert.equal(
            await browser.evaluate("!!document.querySelector('.beast-evolve-button')"),
            false,
          );
          await browser.screenshot(
            `${captures}/perfect-${theme}-${label === 'Đang luyện' ? 'training' : 'companion'}-390.png`,
          );
        }
        await browser.evaluate(
          "document.querySelector('.beast-role-ultimate').scrollIntoView({block:'center'})",
        );
        await browser.screenshot(`${captures}/perfect-abilities-${theme}-390.png`);
      }
    });
  },
);
