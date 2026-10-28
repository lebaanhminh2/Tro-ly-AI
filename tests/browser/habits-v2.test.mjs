import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Miniflare } from 'miniflare';
import { fixture, serve, chrome, browserBin, snapshot, now } from './app-harness.mjs';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';

const evidence = 'trial-results/habits-v2/live';
async function setup() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('migrations')
    .filter((p) => p.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
  await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, now);
  const store = new D1HabitStore(db),
    service = new HabitService(store),
    healthy = new HealthyStore(db);
  const day = (await store.today('123', now)).day.day;
  const ids = [];
  for (const [index, definition] of [
    { name: 'Đọc sách', metric: 'duration', target: 20, cadence: { kind: 'daily' } },
    { name: 'Uống đủ nước', metric: 'quantity', target: 8, unit: 'ly', cadence: { kind: 'daily' } },
    { name: 'Tập thể dục', metric: 'check', target: 1, cadence: { kind: 'weekly', quota: 3 } },
    {
      name: 'Học ngoại ngữ',
      metric: 'check',
      target: 1,
      cadence: { kind: 'weekdays', weekdays: [5] },
    },
  ].entries()) {
    const result = await service.execute(
      '123',
      'mobile_habit_' + index,
      { operation: 'create', definition },
      now,
    );
    ids.push(result.habitId);
    const row = await db
      .prepare('SELECT definition_json FROM habit_revisions WHERE owner=? AND habit_id=?')
      .bind('123', result.habitId)
      .first();
    const saved = JSON.parse(row.definition_json);
    saved.commitmentFrom = day - 7;
    await db
      .prepare('UPDATE habit_revisions SET definition_json=? WHERE owner=? AND habit_id=?')
      .bind(JSON.stringify(saved), '123', result.habitId)
      .run();
  }
  await service.execute(
    '123',
    'partial_read_initial',
    {
      operation: 'log',
      habitId: ids[0],
      day,
      version: 1,
      logVersion: 0,
      value: 15.25,
      note: 'Trang 42',
    },
    now,
  );
  const control = fixture();
  control.staticFiles = new Map([
    ['prototype.html', readFileSync('docs/prototypes/habits-v2/index.html', 'utf8')],
  ]);
  const secret = 'local-test-token';
  control.testNow = now;
  control.api = async (request, endpoint) => {
    if (endpoint === 'journals' || endpoint === 'habits') {
      if (control.failJournals && endpoint === 'journals' && request.method === 'POST')
        return Response.json(
          { error: 'OPERATION_NOT_CONFIRMED', message: 'Mất kết nối thử nghiệm' },
          { status: 503 },
        );
      const data = new URLSearchParams({
        auth_date: String(Math.floor(control.testNow / 1000)),
        user: JSON.stringify({ id: 123 }),
      });
      const check = [...data]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => key + '=' + value)
        .join('\n');
      const key = createHmac('sha256', 'WebAppData').update(secret).digest();
      data.set('hash', createHmac('sha256', key).update(check).digest('hex'));
      let body = '';
      for await (const part of request) body += part;
      return miniAppApi(
        new Request('https://fixture.local' + request.url, {
          method: request.method,
          headers: { 'X-Telegram-Init-Data': data.toString(), 'Content-Type': 'application/json' },
          ...(request.method === 'POST' ? { body } : {}),
        }),
        { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: secret },
        control.testNow,
      );
    }
    if (endpoint === 'bootstrap')
      return Response.json({ ...control.bootstrap(), account: await healthy.read('123') });
    if (endpoint === 'linh-thu/tower')
      return Response.json({
        eligibility: { day, eligible: false },
        run: null,
        account: { version: 1, state: { summonTickets: 0 } },
        wallet: await healthy.read('123'),
      });
    if (endpoint === 'history')
      return Response.json({ result: { items: [], offset: 0, total: 0, hasMore: false } });
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  };
  const server = await serve(control);
  return { mf, db, store, healthy, ids, day, control, server };
}

test(
  'approved habit UI uses real API: immediate check/undo, numeric logging, defer/resume, archive/restore and multiple delete',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const f = await setup(),
      b = await chrome();
    const click = (selector) =>
      b.evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    const row = (index) => '[data-habit-id="' + f.ids[index] + '"]';
    try {
      await mkdir(evidence, { recursive: true });
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('document.querySelectorAll(".hv2-row").length===4');
      await b.screenshot(evidence + '/10-real-habits-390.png');
      for (const width of [320, 390, 430, 1440]) {
        await b.resize(width, 844);
        assert.equal((await snapshot(b)).overflow, false);
        assert.equal(
          await b.evaluate('document.querySelector(".hv2-check").getBoundingClientRect().width'),
          21,
        );
      }
      await b.resize(390, 844);
      await click(row(0) + ' .hv2-check');
      await b.wait('!!document.querySelector("#toast .notice-action")');
      assert.equal(
        (await f.store.today('123', now)).habits.find((v) => v.habit.id === f.ids[0]).log.value,
        2000,
      );
      await b.tap('#toast .notice-action');
      await b.wait(
        'document.querySelector(' +
          JSON.stringify(row(0) + ' .hv2-amount') +
          ').textContent.includes("15,25")',
      );
      await b.wait('document.querySelector("#toast").textContent.includes("Đã hoàn tác")');
      assert.equal(
        (await f.store.today('123', now)).habits.find((v) => v.habit.id === f.ids[0]).log.value,
        1525,
      );
      await b.tap(row(1) + ' .hv2-amount');
      await b.click('+1', '.habit-counter button');
      await b.click('+1', '.habit-counter button');
      await b.evaluate('document.querySelector(".habit-form").requestSubmit()');
      await b.wait('!document.querySelector("#sheet").open');
      assert.equal(
        (await f.store.today('123', now)).habits.find((v) => v.habit.id === f.ids[1]).log.value,
        200,
      );
      await b.tap(row(2) + ' .hv2-row-options > summary');
      await b.click('Để hôm khác', '.hv2-row-options[open] .hv2-menu-items button');
      await b.wait('!!document.querySelector(' + JSON.stringify(row(2) + '.is-outside') + ')');
      assert.equal(
        await b.evaluate(
          '!!document.querySelector(' + JSON.stringify(row(2) + ' .hv2-check') + ')',
        ),
        false,
      );
      await b.evaluate('document.querySelector(".hv2-group:last-child").open=true');
      await b.tap(row(2) + ' .hv2-row-options > summary');
      await b.click('Làm hôm nay', '.hv2-menu-items button');
      await b.wait(
        '!!document.querySelector(' + JSON.stringify(row(2) + ':not(.is-outside) .hv2-check') + ')',
      );
      const towerBefore = (await f.store.today('123', now)).habits.find(
        (v) => v.habit.id === f.ids[2],
      ).preview;
      await b.tap(row(2) + ' .hv2-name');
      await b.click('Lưu trữ', '.hv2-detail button');
      await b.wait('!document.querySelector("#sheet").open');
      await b.wait('!document.querySelector(' + JSON.stringify(row(2)) + ')');
      assert.deepEqual(
        (await f.store.today('123', now)).habits.find((v) => v.habit.id === f.ids[2]).preview,
        towerBefore,
        'UI archive cannot remove already-incurred commitment',
      );
      await b.tap('.hv2-menu > summary');
      await b.click('Đã lưu trữ', '.hv2-menu-items button');
      await b.wait('!!document.querySelector(' + JSON.stringify(row(2)) + ')');
      await b.tap(row(2) + ' .hv2-name');
      await b.click('Khôi phục thói quen', '.hv2-detail button');
      await b.wait('!document.querySelector("#sheet").open');
      await b.click('‹ Thói quen');
      await b.wait('!!document.querySelector(' + JSON.stringify(row(2)) + ')');
      await b.click('Chọn nhiều');
      await click(row(0) + ' .hv2-check');
      await click(row(1) + ' .hv2-check');
      assert.equal(
        await b.evaluate('document.querySelectorAll(".hv2-check[aria-checked=true]").length'),
        2,
      );
      await b.click('Xóa 2 đã chọn');
      await b.screenshot(evidence + '/app-delete-confirmation-390.png');
      await b.click('Hủy');
      assert.equal((await f.store.today('123', now)).habits.length, 4);
      await b.click('Xóa 2 đã chọn');
      await b.click('Xóa 2 thói quen', '#sheet button');
      await b.wait('document.querySelectorAll(".hv2-row").length===2');
      assert.equal(await b.evaluate('!!document.querySelector(".hv2-bulk")'), false);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.server.close();
      await f.mf.dispose();
    }
  },
);

test(
  'selection arrows reorder real habits, retain checks and persist after reload without changing logs',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const f = await setup(),
      b = await chrome();
    const row = (index) => '[data-habit-id="' + f.ids[index] + '"]';
    const click = (selector) =>
      b.evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    const order = () =>
      b.evaluate(
        'Array.from(document.querySelectorAll(".hv2-panel > .hv2-row")).map(row=>row.dataset.habitId)',
      );
    try {
      await mkdir(evidence, { recursive: true });
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-row")');
      await b.click('Chọn nhiều', '.hv2-section-actions button');
      await click(row(0) + ' .hv2-check');
      assert.equal(
        await b.evaluate(
          'document.querySelector(' +
            JSON.stringify(row(0) + ' .hv2-order button:first-child') +
            ').disabled',
        ),
        true,
      );
      assert.equal(
        await b.evaluate(
          'document.querySelector(' +
            JSON.stringify(row(2) + ' .hv2-order button:last-child') +
            ').disabled',
        ),
        true,
      );
      await click(row(1) + ' .hv2-order button:first-child');
      await b.wait(
        'document.querySelector(".hv2-panel > .hv2-row").dataset.habitId===' +
          JSON.stringify(f.ids[1]),
      );
      await b.wait(
        '!document.querySelector(' +
          JSON.stringify(row(1) + ' .hv2-order button:last-child') +
          ').disabled',
      );
      assert.deepEqual(await order(), [f.ids[1], f.ids[0], f.ids[2]]);
      assert.equal(
        await b.evaluate(
          'document.querySelector(' +
            JSON.stringify(row(0) + ' .hv2-check') +
            ').getAttribute("aria-checked")',
        ),
        'true',
      );
      for (const width of [320, 390, 430, 1440]) {
        await b.resize(width, 844);
        assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), true);
        await b.screenshot(evidence + '/reorder-' + width + '.png');
      }
      const actual = await f.store.today('123', now);
      assert.deepEqual(
        actual.habits.map((v) => v.habit.id),
        [f.ids[1], f.ids[0], f.ids[2], f.ids[3]],
      );
      assert.equal(actual.habits.find((v) => v.habit.id === f.ids[0]).log.value, 1525);
      await b.click('Thoát chọn', '.hv2-section-actions button');
      assert.equal(await b.evaluate('document.querySelectorAll(".hv2-order").length'), 0);
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-row")');
      assert.deepEqual(await order(), [f.ids[1], f.ids[0], f.ids[2]]);
      await click(row(0) + ' .hv2-amount');
      await b.wait('!!document.querySelector("[name=amount]")');
      assert.equal(
        await b.evaluate('Number(document.querySelector("[name=amount]").value)'),
        15.25,
      );
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.server.close();
      await f.mf.dispose();
    }
  },
);

test(
  'edited quantity unit is consistent across the list, details and logging after reload without changing committed values',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const f = await setup(),
      b = await chrome(),
      row = '[data-habit-id="' + f.ids[1] + '"]';
    const click = (selector) =>
      b.evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    const view = async () =>
      (await f.store.today('123', f.control.testNow)).habits.find(
        (item) => item.habit.id === f.ids[1],
      );
    try {
      await mkdir(evidence, { recursive: true });
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(' + JSON.stringify(row + ' .hv2-amount') + ')');
      await click(row + ' .hv2-name');
      await b.click('Chỉnh sửa', '.hv2-manage button');
      await b.evaluate(
        'document.querySelector("[name=unit]").value="cốc";document.querySelector("form.habit-editor").requestSubmit()',
      );
      await b.wait(
        '!document.querySelector("#sheet").open && document.querySelector(' +
          JSON.stringify(row + ' .hv2-amount small') +
          ').textContent==="cốc"',
      );
      assert.equal((await view()).definition.target, 800);
      assert.equal((await view()).log.value, 0);
      assert.equal((await view()).pending.definition.unit, 'cốc');
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(' + JSON.stringify(row + ' .hv2-amount small') + ')');
      assert.equal(
        await b.evaluate(
          'document.querySelector(' + JSON.stringify(row + ' .hv2-amount small') + ').textContent',
        ),
        'cốc',
      );
      await b.screenshot(evidence + '/quantity-renamed-list-390.png');
      await click(row + ' .hv2-name');
      assert.ok(
        (await b.evaluate('document.querySelector(".hv2-detail-number").textContent')).includes(
          '8 cốc',
        ),
      );
      assert.ok(
        (await b.evaluate('document.querySelector(".hv2-detail-info").textContent')).includes(
          '8 cốc',
        ),
      );
      await b.click('Ghi nhận hôm nay', '.hv2-detail-footer button');
      assert.ok(
        (await b.evaluate('document.querySelector(".hv2-log-progress").textContent')).includes(
          '8 cốc',
        ),
      );
      assert.equal(
        await b.evaluate(
          'document.querySelector(".habit-counter > button:last-child").getAttribute("aria-label")',
        ),
        'Thêm 1 cốc',
      );
      await b.screenshot(evidence + '/quantity-renamed-log-390.png');
      await b.evaluate(
        'document.querySelector("[name=amount]").value="1.5";document.querySelector("form.habit-editor").requestSubmit()',
      );
      await b.wait('!document.querySelector("#sheet").open');
      assert.equal((await view()).log.value, 150);
      assert.equal((await view()).definition.target, 800);
      await click(row + ' .hv2-name');
      await b.click('Chỉnh sửa', '.hv2-manage button');
      await b.evaluate(
        'window.__habitResponsesBefore=performance.getEntriesByType("resource").filter(entry=>new URL(entry.name).pathname==="/api/habits").length;document.querySelector("[name=target]").value="10";document.querySelector("form.habit-editor").requestSubmit()',
      );
      await b.wait('!document.querySelector("#sheet").open');
      await b.wait(
        'performance.getEntriesByType("resource").filter(entry=>new URL(entry.name).pathname==="/api/habits").length>=window.__habitResponsesBefore+2',
      );
      assert.equal(
        await b.evaluate(
          'document.querySelector(' + JSON.stringify(row + ' .hv2-amount small') + ').textContent',
        ),
        'cốc',
      );
      const pending = await view();
      assert.equal(pending.definition.target, 800);
      assert.equal(pending.pending.definition.target, 1000);
      assert.equal(pending.log.value, 150);
      await click(row + ' .hv2-name');
      assert.ok(
        (
          await b.evaluate('document.querySelector(".hv2-detail .hv2-detail-note").textContent')
        ).includes('10 cốc'),
      );
      await click('[data-sheet-close]');
      const closedDay = f.day;
      await f.store.settle('123', now + 86400000, 10);
      const history = await f.store.history('123', closedDay, closedDay, f.ids[1], null, 10);
      assert.equal(history.rows[0].definition.unit, 'ly');
      assert.equal(history.rows[0].definition.target, 800);
      assert.equal(history.rows[0].value, 150);
      const next = (await f.store.today('123', now + 86400000)).habits.find(
        (item) => item.habit.id === f.ids[1],
      );
      assert.equal(next.definition.unit, 'cốc');
      assert.equal(next.definition.target, 1000);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.server.close();
      await f.mf.dispose();
    }
  },
);

test(
  'journal opens once at its final size after a slow read, retries failures and ignores abandoned navigation',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const f = await setup(),
      b = await chrome(),
      originalApi = f.control.api;
    let gate = Promise.withResolvers(),
      fail = false;
    f.control.api = async (request, endpoint) => {
      if (request.method === 'GET' && endpoint.startsWith('journals')) {
        await gate.promise;
        if (fail) return Response.json({ error: 'OPERATION_NOT_CONFIRMED' }, { status: 503 });
      }
      return originalApi(request, endpoint);
    };
    const reads = () => f.control.calls.filter((call) => call.startsWith('GET journals'));
    const click = (selector) =>
      b.evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    try {
      await mkdir(evidence, { recursive: true });
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-diary-entry")');
      await b.evaluate(`(() => {
        const sheet=document.querySelector('#sheet');
        window.__journalFrames=[];
        window.__journalOpens=0;
        new MutationObserver(records=>{
          window.__journalOpens+=records.filter(r=>r.attributeName==='open' && r.oldValue===null).length;
        }).observe(sheet,{attributes:true,attributeOldValue:true,attributeFilter:['open']});
        const record=()=>{
          if(sheet.open)window.__journalFrames.push({height:sheet.getBoundingClientRect().height,ready:!!sheet.querySelector('.diary-sheet textarea')});
          requestAnimationFrame(record);
        };
        requestAnimationFrame(record);
      })()`);
      const before = reads().length;
      await click('.hv2-diary-entry');
      await click('.hv2-diary-entry');
      await b.wait('document.querySelector(".hv2-diary-entry").getAttribute("aria-busy")==="true"');
      await b.evaluate(`(() => {
        window.__journalEntryBeforeRefresh=document.querySelector('.hv2-diary-entry');
        dispatchEvent(new Event('focus'));
      })()`);
      await b.wait(
        'document.querySelector(".hv2-diary-entry")!==window.__journalEntryBeforeRefresh',
      );
      await delay(300);
      assert.equal(await b.evaluate('document.querySelector("#sheet").open'), false);
      assert.equal(await b.evaluate('document.querySelector(".hv2-diary-entry").disabled'), true);
      assert.equal(
        await b.evaluate('document.querySelector(".hv2-diary-entry").getAttribute("aria-busy")'),
        'true',
      );
      assert.equal(reads().length - before, 1, 'A double click starts only one day read');
      await b.screenshot(evidence + '/journal-slow-read-pending-390.png');
      gate.resolve();
      await b.wait('!!document.querySelector(".diary-sheet textarea")');
      await delay(150);
      const opened = await b.evaluate(
        '({frames:window.__journalFrames,opens:window.__journalOpens})',
      );
      assert.equal(opened.opens, 1);
      assert.ok(opened.frames.length >= 2);
      assert.ok(
        opened.frames.every((frame) => frame.ready),
        'Every visible frame has the complete editor',
      );
      assert.ok(
        Math.max(...opened.frames.map((frame) => frame.height)) -
          Math.min(...opened.frames.map((frame) => frame.height)) <
          1,
        'No short loading sheet or second height jump',
      );
      assert.equal(
        reads().length - before,
        1,
        'The default entry does not fetch the list before fetching its day',
      );
      await b.screenshot(evidence + '/journal-slow-read-ready-390.png');
      gate = Promise.withResolvers();
      fail = true;
      await b.evaluate(`(() => {
        const date=document.querySelector('.diary-date-label input');
        window.__journalOriginalDate=date.value;
        date.value=new Date(${f.day - 1}*86400000).toISOString().slice(0,10);
        date.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await b.wait('document.querySelector(".diary-date-label input").disabled');
      assert.equal(await b.evaluate('document.querySelector("#sheet").open'), true);
      assert.equal(await b.evaluate('!!document.querySelector(".diary-sheet textarea")'), true);
      gate.resolve();
      await b.wait('!document.querySelector(".diary-date-label input").disabled');
      assert.equal(
        await b.evaluate(
          'document.querySelector(".diary-date-label input").value===window.__journalOriginalDate',
        ),
        true,
        'An unsuccessful date change preserves the original day and editor',
      );
      fail = false;
      await click('[data-sheet-close]');
      await b.wait('!document.querySelector("#sheet").open');

      gate = Promise.withResolvers();
      fail = true;
      await click('.hv2-diary-entry');
      await b.wait('document.querySelector(".hv2-diary-entry").disabled');
      gate.resolve();
      await b.wait('!document.querySelector(".hv2-diary-entry").disabled');
      assert.equal(await b.evaluate('document.querySelector("#sheet").open'), false);
      fail = false;
      await click('.hv2-diary-entry');
      await b.wait(
        '!!document.querySelector(".diary-sheet textarea") && document.querySelector("#sheet").open',
      );
      await click('[data-sheet-close]');
      await b.wait('!document.querySelector("#sheet").open');

      gate = Promise.withResolvers();
      await click('.hv2-diary-entry');
      await b.wait('document.querySelector(".hv2-diary-entry").disabled');
      await b.tap('[data-tab=today]');
      gate.resolve();
      await delay(300);
      assert.equal(
        await b.evaluate('document.querySelector("#sheet").open'),
        false,
        'A late read must not open a journal over another tab',
      );
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-diary-entry")');
      f.control.testNow += 86400000;
      await click('.hv2-diary-entry');
      await b.wait(
        '!!document.querySelector(".diary-sheet textarea") && document.querySelector("#sheet").open',
      );
      assert.equal(
        await b.evaluate('Number(document.querySelector(".diary-sheet").dataset.journalDay)'),
        f.day + 1,
        'The default journal follows the new server day even if the habit page is stale',
      );
      assert.equal(await f.db.prepare('SELECT COUNT(*) AS n FROM daily_journals').first('n'), 0);
      assert.deepEqual(b.errors, []);
    } finally {
      gate.resolve();
      await b.close();
      await f.server.close();
      await f.mf.dispose();
    }
  },
);

test(
  'daily journal real API: draft, readable history, editing/deletion, reward once and offline retry across reload',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const f = await setup(),
      b = await chrome();
    const read = () =>
      f.db
        .prepare('SELECT * FROM daily_journals WHERE owner=? AND day=?')
        .bind('123', f.day)
        .first();
    const write = async (value) =>
      b.evaluate(
        '(()=>{const input=document.querySelector("[name=achieved]");input.value=' +
          JSON.stringify(value) +
          ';input.dispatchEvent(new Event("input",{bubbles:true}));})()',
      );
    try {
      await mkdir(evidence, { recursive: true });
      await b.navigate(f.server.url + '/prototype.html', 390);
      await b.evaluate("DAY='2026-10-05';openJournal(DAY)");
      const referenceEditor = await b.evaluate(
        'document.querySelector("#sheet").getBoundingClientRect().height',
      );
      await b.screenshot(evidence + '/demo-journal-editor-390.png');
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-diary-entry")');
      await b.tap('.hv2-diary-entry');
      await b.wait('!!document.querySelector(".diary-sheet textarea")');
      await b.evaluate(
        'localStorage.setItem("minh-anh-theme","light");document.documentElement.dataset.theme="light";document.querySelector("[name=lessons]").focus()',
      );
      await b.colorScheme('dark');
      await b.evaluate(
        'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
      );
      assert.equal(
        await b.evaluate('getComputedStyle(document.querySelector("[name=lessons]")).caretColor'),
        'rgb(116, 96, 213)',
      );
      assert.equal(
        await b.evaluate('getComputedStyle(document.querySelector(".diary-sheet .primary")).color'),
        'rgb(255, 255, 255)',
      );
      await b.screenshot(evidence + '/journal-dark-host-light-app-390.png');
      await b.evaluate('document.documentElement.dataset.theme="dark"');
      assert.equal(
        await b.evaluate('getComputedStyle(document.querySelector("[name=lessons]")).caretColor'),
        'rgb(181, 160, 255)',
      );
      assert.equal(
        await b.evaluate('getComputedStyle(document.querySelector("[name=lessons]")).color'),
        'rgb(239, 237, 247)',
      );
      await b.colorScheme('light');
      await b.evaluate('document.documentElement.dataset.theme="light"');
      const editorHeight = await b.evaluate(
        'document.querySelector("#sheet").getBoundingClientRect().height',
      );
      assert.ok(
        Math.abs(editorHeight - referenceEditor) < 60,
        'Journal form keeps the approved compact layout',
      );
      await b.screenshot(evidence + '/app-journal-editor-390.png');
      await b.resize(390, 410);
      await b.evaluate(
        'document.querySelector("[name=tomorrow]").focus();document.querySelector("[name=tomorrow]").scrollIntoView({block:"center"})',
      );
      assert.equal(
        await b.evaluate(`(()=>{
        const input=document.querySelector('[name=tomorrow]').getBoundingClientRect();
        const footer=document.querySelector('.diary-sheet .habit-form-footer').getBoundingClientRect();
        return input.top>=0 && input.bottom<=footer.top+1 && footer.bottom<=innerHeight;
      })()`),
        true,
        'Last journal field and save remain accessible with a short keyboard viewport',
      );
      await b.screenshot(evidence + '/14-real-journal-keyboard-390.png');
      await b.resize(390, 844);
      const text = 'Đọc sách được 20 phút\nNgày mai bắt đầu sớm hơn. <img src=x onerror=alert(1)>';
      await write(text);
      await b.tap('[data-sheet-close]');
      await b.tap('.hv2-diary-entry');
      await b.wait('!!document.querySelector(".diary-sheet textarea")');
      assert.equal(await b.evaluate('document.querySelector("[name=achieved]").value'), text);
      const before = (await f.healthy.read('123')).state;
      f.control.failJournals = true;
      await b.evaluate('document.querySelector(".diary-sheet").requestSubmit()');
      await b.wait('!document.querySelector(".diary-error").hidden');
      assert.equal(await read(), null);
      assert.equal((await f.healthy.read('123')).state.tickets, before.tickets);
      f.control.failJournals = false;
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(".hv2-diary-entry")');
      await b.tap('.hv2-diary-entry');
      await b.wait('!!document.querySelector(".diary-sheet textarea")');
      await b.evaluate('document.querySelector(".diary-sheet").requestSubmit()');
      await b.wait('!!document.querySelector(".diary-reading")');
      assert.equal((await read()).achieved, text);
      assert.equal((await f.healthy.read('123')).state.qi, before.qi + 1);
      assert.equal((await f.healthy.read('123')).state.tickets, before.tickets + 1);
      assert.equal(await b.evaluate('document.querySelectorAll(".diary-reading img").length'), 0);
      assert.equal(
        await b.evaluate('document.querySelectorAll(".diary-reading-section").length'),
        1,
      );
      await b.screenshot(evidence + '/11-real-journal-reader-390.png');
      await b.click('Chỉnh sửa');
      await write('Hôm nay đã tiến bộ');
      await b.evaluate('document.querySelector(".diary-sheet").requestSubmit()');
      await b.wait('!!document.querySelector(".diary-reading")');
      assert.equal((await f.healthy.read('123')).state.tickets, before.tickets + 1);
      for (const width of [320, 390, 430, 1440]) {
        await b.resize(width, 844);
        assert.equal((await snapshot(b)).overflow, false);
      }
      await b.resize(320, 740);
      await b.scaleText(2);
      assert.equal((await snapshot(b)).overflow, false);
      await b.screenshot(evidence + '/12-real-journal-reader-320-text200.png');
      await b.scaleText(1);
      await b.resize(390, 844);
      await b.tap('[data-sheet-close]');
      await b.tap('.hv2-menu > summary');
      await b.click('Nhật ký', '.hv2-menu-items button');
      await b.wait('!!document.querySelector(".diary-day")');
      await b.screenshot(evidence + '/13-real-journal-list-390.png');
      await b.evaluate('document.documentElement.dataset.theme="dark"');
      await b.screenshot(evidence + '/15-real-journal-list-dark-390.png');
      assert.equal((await snapshot(b)).overflow, false);
      await b.evaluate('document.documentElement.dataset.theme="light"');
      await b.tap('.diary-day');
      await b.wait('!!document.querySelector(".diary-reading")');
      await b.click('Xóa', '.diary-sheet button');
      await b.click('Hủy');
      await b.click('Xóa', '.diary-sheet button');
      await b.click('Xóa nhật ký');
      await b.wait('!!document.querySelector(".diary-empty")');
      assert.equal((await read()).deleted, 1);
      assert.equal((await f.healthy.read('123')).state.tickets, before.tickets + 1);
      await b.click('Viết hôm nay');
      await b.wait('!!document.querySelector(".diary-sheet textarea")');
      await write('Viết lại');
      await b.evaluate('document.querySelector(".diary-sheet").requestSubmit()');
      await b.wait('!!document.querySelector(".diary-reading")');
      assert.equal((await f.healthy.read('123')).state.tickets, before.tickets + 1);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.server.close();
      await f.mf.dispose();
    }
  },
);

test(
  'weekly numeric deferral hides logging, resets with the operating day, and pending restore offers no unavailable action',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const f = await setup(),
      b = await chrome();
    const service = new HabitService(f.store);
    try {
      const weekly = await service.execute(
        '123',
        'weekly_numeric_mobile',
        {
          operation: 'create',
          definition: {
            name: 'Chạy bộ',
            metric: 'quantity',
            target: 3,
            unit: 'km',
            cadence: { kind: 'weekly', quota: 3 },
          },
        },
        now,
      );
      const row = '[data-habit-id="' + weekly.habitId + '"]';
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait('!!document.querySelector(' + JSON.stringify(row + ' .hv2-row-options') + ')');
      await b.tap(row + ' .hv2-row-options > summary');
      await b.click('Để hôm khác', '.hv2-row-options[open] .hv2-menu-items button');
      await b.wait('!!document.querySelector(' + JSON.stringify(row + '.is-outside') + ')');
      assert.equal(
        await b.evaluate(
          '!!document.querySelector(' + JSON.stringify(row + ' .habit-log-button') + ')',
        ),
        false,
      );
      assert.equal(
        await b.evaluate('!!document.querySelector(' + JSON.stringify(row + ' .habit-check') + ')'),
        false,
      );
      f.control.testNow += 86400000;
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      await b.wait(
        '!!document.querySelector(' +
          JSON.stringify(row + ':not(.is-outside) .habit-log-button') +
          ')',
      );
      await service.execute(
        '123',
        'archive_before_restore_mobile',
        { operation: 'archive', habitId: f.ids[0], version: 1 },
        f.control.testNow,
      );
      f.control.testNow += 86400000;
      await service.execute(
        '123',
        'restore_effective_mobile',
        { operation: 'restore', habitId: f.ids[0], version: 2 },
        f.control.testNow,
      );
      await b.navigate(f.server.url, 390);
      await b.wait('!!document.querySelector(".focus-flip-card")');
      await b.tap('[data-tab=habits]');
      const restored = '[data-habit-id="' + f.ids[0] + '"]';
      await b.wait('!!document.querySelector(' + JSON.stringify(restored + '.is-outside') + ')');
      assert.equal(
        await b.evaluate(
          '!!document.querySelector(' + JSON.stringify(restored + ' .hv2-row-options') + ')',
        ),
        false,
      );
      assert.equal(
        await b.evaluate(
          '!!document.querySelector(' + JSON.stringify(restored + ' .habit-log-button') + ')',
        ),
        false,
      );
      await b.evaluate('document.querySelector(".hv2-group:last-child").open=true');
      await b.tap(restored + ' .hv2-name');
      await b.wait('!!document.querySelector(".hv2-detail")');
      assert.equal(
        await b.evaluate(
          '[...document.querySelectorAll(".hv2-detail button")].some(b=>b.textContent==="Làm hôm nay")',
        ),
        false,
      );
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.server.close();
      await f.mf.dispose();
    }
  },
);
