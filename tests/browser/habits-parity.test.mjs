import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fixture, serve, chrome, browserBin } from './app-harness.mjs';

test(
  'habit screens match the approved demo geometry and isolate tower sheets',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const prototype = await readFile('docs/prototypes/habits-v2/index.html', 'utf8');
    const initial = runInNewContext(
      '(' + prototype.match(/const initial = \(\) => (\[[\s\S]*?\n      \]);/)[1] + ')',
    );
    const control = fixture(),
      day = control.habits.day.day;
    control.staticFiles = new Map([['prototype.html', prototype]]);
    control.habitOutcomes = [];
    for (const item of initial) {
      control.mutate('habits', {
        operation: 'create',
        id: item.id,
        definition: {
          name: item.name,
          metric: item.metric,
          target: item.target,
          unit: item.unit,
          note: item.note,
          cadence:
            item.cadence === 'weekly'
              ? { kind: 'weekly', quota: item.quota }
              : item.cadence === 'weekdays'
                ? { kind: 'weekdays', weekdays: item.days }
                : { kind: 'daily' },
        },
        reminderTime: item.reminder || null,
      });
      const view = control.habits.habits.at(-1);
      view.definition.commitmentFrom = day - 14;
      view.habit.archivedFrom = item.archived ? day - 1 : null;
      view.log.value = item.value * 100;
      if (item.cadence === 'weekly')
        view.preview = {
          reason: 'day_open',
          period: { completedDays: [day - 4, day - 2] },
          misses: 0,
        };
      item.history.forEach((value, index) =>
        control.habitOutcomes.push({
          habitId: view.habit.id,
          name: item.name,
          day: day - 6 + index,
          status: value === null ? 'neutral' : value >= item.target ? 'achieved' : 'missed',
          successes: value !== null && value >= item.target ? 1 : 0,
          misses: value !== null && value < item.target ? 1 : 0,
        }),
      );
    }
    const server = await serve(control),
      b = await chrome();
    const evidence = 'trial-results/habits-v2/parity';
    const click = (selector) =>
      b.evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    const box = (selector) =>
      b.evaluate(
        `(() => {const n=document.querySelector(${JSON.stringify(selector)}),r=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:r.x,y:r.y,width:r.width,height:r.height,fontSize:s.fontSize,color:s.color,background:s.backgroundColor}})()`,
      );
    const reference = {},
      actual = {};
    try {
      await mkdir(evidence, { recursive: true });
      await b.navigate(server.url + '/prototype.html', 390);
      await b.evaluate("DAY='2026-10-05';render()");
      await b.screenshot(evidence + '/demo-main-390.png');
      reference.summary = await box('.today-summary');
      reference.row = await box('.habit-row');
      await click('[data-action=open][data-id=read]');
      await b.screenshot(evidence + '/demo-detail-390.png');
      reference.detail = await box('#sheet');
      await b.evaluate('closeSheet();openLog(getHabit("read"))');
      await b.screenshot(evidence + '/demo-duration-390.png');
      reference.duration = await box('#sheet');
      await b.evaluate('closeSheet();openLog(getHabit("water"))');
      await b.screenshot(evidence + '/demo-quantity-390.png');
      reference.quantity = await box('#sheet');
      await b.evaluate('closeSheet();openEditor()');
      await b.screenshot(evidence + '/demo-add-390.png');
      await b.navigate(server.url, 390);
      await b.wait('document.body.classList.contains("app-ready")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-today")');
      for (const width of [320, 390, 430, 1440]) {
        await b.resize(width, 844);
        assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
        const geometry = await b.evaluate(
          `(() => {const r=s=>document.querySelector(s).getBoundingClientRect();return {summary:r('.hv2-today').height,dateX:r('.hv2-date').x,numberX:r('.hv2-number').x,check:r('.hv2-check').width,hit:r('.hv2-check-wrap').height,amount:r('.hv2-amount').height,other:r('.hv2-row-options>summary').height}})()`,
        );
        assert.ok(geometry.summary < 100 && geometry.numberX > geometry.dateX + 80);
        assert.equal(geometry.check, 21);
        assert.ok(geometry.hit >= 44);
        assert.equal(geometry.amount, geometry.other);
        await b.screenshot(evidence + '/app-main-' + width + '.png');
      }
      await b.resize(390, 844);
      actual.summary = await box('.hv2-today');
      actual.row = await box('.hv2-row');
      assert.ok(Math.abs(actual.summary.height - reference.summary.height) < 8);
      assert.ok(Math.abs(actual.row.height - reference.row.height) < 8);
      await click('[data-habit-id=h_read] .hv2-name');
      actual.detail = await box('#sheet');
      await b.screenshot(evidence + '/app-detail-390.png');
      assert.equal(await b.evaluate('document.querySelector(".hv2-detail-history").open'), false);
      await click('.hv2-detail-history > summary');
      await b.wait('document.querySelectorAll(".hv2-week-cell").length===7');
      assert.equal(
        await b.evaluate('document.querySelectorAll(".hv2-week-cell.is-met").length'),
        4,
      );
      await click('[data-sheet-close]');
      await click('[data-habit-id=h_read] .hv2-amount');
      actual.duration = await box('#sheet');
      await b.screenshot(evidence + '/app-duration-390.png');
      assert.ok(Math.abs(actual.duration.height - reference.duration.height) < 100);
      await b.evaluate(
        "const input=document.querySelector('[name=amount]');input.value='27.5';input.dispatchEvent(new Event('input'))",
      );
      assert.equal(
        await b.evaluate('document.querySelector(".hv2-log-progress > span").textContent'),
        '27,5',
      );
      await click('[data-sheet-close]');
      await click('[data-habit-id=h_water] .hv2-amount');
      await b.evaluate(
        'localStorage.setItem("minh-anh-theme","light");document.documentElement.dataset.theme="light"',
      );
      await b.colorScheme('dark');
      await b.evaluate(
        'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
      );
      const counter = await b.evaluate(`(() => {
        const input=document.querySelector('.habit-counter input'), row=input.parentElement;
        const label=document.createRange();label.selectNodeContents(row.parentElement.firstChild);
        const style=getComputedStyle(input), save=getComputedStyle(document.querySelector('.habit-form-footer .primary'));
        return {gap:row.getBoundingClientRect().top-label.getBoundingClientRect().bottom, caret:style.caretColor, text:style.color, save:save.color, height:row.getBoundingClientRect().height};
      })()`);
      assert.ok(counter.gap >= 8, 'Counter leaves room below the total label');
      assert.ok(counter.height >= 50 && counter.height <= 56);
      assert.equal(counter.caret, 'rgb(116, 96, 213)');
      assert.equal(counter.text, 'rgb(39, 36, 56)');
      assert.equal(counter.save, 'rgb(255, 255, 255)');
      await b.screenshot(evidence + '/app-quantity-dark-host-light-app-390.png');
      await b.colorScheme('light');
      await b.evaluate('document.documentElement.dataset.theme="light"');
      actual.quantity = await box('#sheet');
      await b.screenshot(evidence + '/app-quantity-390.png');
      assert.ok(Math.abs(actual.quantity.height - reference.quantity.height) < 100);
      await click('[data-sheet-close]');
      await click('[aria-label="Thêm thói quen"]');
      await b.screenshot(evidence + '/app-add-390.png');
      for (const width of [320, 390, 430]) {
        await b.resize(width, 500);
        await b.evaluate('document.querySelector(".habit-form-fields").scrollTop=9999');
        assert.equal(
          await b.evaluate(
            '(()=>{const r=document.querySelector(".habit-form-footer").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()',
          ),
          true,
        );
      }
      await b.resize(390, 844);
      await click('[data-sheet-close]');
      await b.click('Chọn nhiều', '.hv2-section-actions button');
      await b.screenshot(evidence + '/app-selection-390.png');
      assert.equal(await b.evaluate('document.querySelectorAll(".hv2-group[open]").length'), 2);
      assert.equal(
        await b.evaluate(
          'getComputedStyle(document.querySelector(".is-met .hv2-check")).borderTopColor',
        ),
        'rgb(200, 195, 213)',
      );
      assert.equal(
        await b.evaluate(
          'getComputedStyle(document.querySelector(".selection-toggle")).backgroundColor',
        ),
        'rgba(0, 0, 0, 0)',
      );
      const beforeSelection = await box('[data-habit-id=h_read]');
      await click('[data-habit-id=h_read] .hv2-check');
      await click('[data-habit-id=h_water] .hv2-check');
      assert.deepEqual(
        await box('[data-habit-id=h_read]'),
        beforeSelection,
        'Selecting keeps the row in place',
      );
      await b.colorScheme('dark');
      await b.evaluate(
        'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
      );
      for (const width of [320, 390, 430, 1440]) {
        await b.resize(width, 844);
        await b.screenshot(evidence + '/app-selected-light-' + width + '.png');
      }
      await b.resize(390, 844);
      await b.evaluate('document.documentElement.dataset.theme="dark"');
      await b.evaluate(
        'Promise.allSettled(document.querySelector(".hv2-bulk button").getAnimations().map(animation=>animation.finished))',
      );
      await b.screenshot(evidence + '/app-selected-dark-390.png');
      await b.evaluate('document.documentElement.dataset.theme="light"');
      await b.colorScheme('light');
      await b.click('Thoát chọn', '.hv2-section-actions button');
      await click('[data-habit-id=h_workout] .hv2-name');
      assert.equal(
        await b.evaluate(
          'document.querySelector(".hv2-detail-footer .hv2-row-options").getBoundingClientRect().width',
        ),
        64,
      );
      await b.screenshot(evidence + '/app-weekly-detail-390.png');
      await click('[data-sheet-close]');
      await b.tap('.hv2-menu > summary');
      await b.wait('document.querySelector(".hv2-menu").open');
      await b.screenshot(evidence + '/app-menu-390.png');
      await b.click('Đã lưu trữ', '.hv2-menu-items button');
      assert.equal(await b.evaluate('document.querySelectorAll(".hv2-row").length'), 2);
      await b.screenshot(evidence + '/app-archive-390.png');
      await click('[data-habit-id=h_run] .hv2-name');
      assert.equal(await b.evaluate('!!document.querySelector(".hv2-check")'), false);
      await b.screenshot(evidence + '/app-archive-detail-390.png');
      await click('[data-sheet-close]');
      await b.click('‹ Thói quen', '.feature-back');
      await b.click('Vào tháp', '.beast-tower-entry button');
      await b.wait('!!document.querySelector(".tower-experience")');
      assert.equal(
        await b.evaluate('document.querySelector("#sheet").classList.contains("habit-v2-sheet")'),
        false,
      );
      await b.screenshot(evidence + '/tower-preserved-390.png');
      assert.deepEqual(b.errors, []);
    } finally {
      await writeFile(evidence + '/geometry.json', JSON.stringify({ reference, actual }, null, 2));
      await b.close();
      await server.close();
    }
  },
);
