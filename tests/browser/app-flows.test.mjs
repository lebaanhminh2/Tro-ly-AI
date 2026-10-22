import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createDemo } from '../../web/demo/state.js';
import { checkinProgress } from '../../web/models/cultivation.js';
import { assessHabitDay, newHabitPeriod } from '../../src/domain/habits.ts';
import { browserBin, fixture, serve, chrome, snapshot, clone, now } from './app-harness.mjs';
import { beastFixture } from './linh-thu-fixture.mjs';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { D1BeastStore } from '../../src/adapters/d1/linh-thu-store.ts';

test(
  'browser navigation waits for the new document and deferred module, including same-document navigation',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    let releaseModule, moduleRequested;
    const moduleGate = new Promise((resolve) => {
      releaseModule = resolve;
    });
    const requested = new Promise((resolve) => {
      moduleRequested = resolve;
    });
    const server = createServer(async (request, response) => {
      if (request.url === '/startup.js') {
        moduleRequested();
        await moduleGate;
        response.setHeader('Content-Type', 'text/javascript');
        response.end('window.newDocumentReady = true;');
        return;
      }
      response.setHeader('Content-Type', 'text/html');
      response.end(
        request.url === '/old'
          ? '<html><body data-document="old"><script>window.oldDocument = true;</script></body></html>'
          : '<html><body data-document="new"><script type="module" src="/startup.js"></script></body></html>',
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    let browser, navigation;
    try {
      browser = await chrome();
      await browser.navigate(url + '/old', 390);
      assert.equal(await browser.evaluate('window.oldDocument'), true);
      let completed = false;
      navigation = browser.navigate(url + '/new', 390).then(() => {
        completed = true;
      });
      await Promise.race([
        requested,
        delay(5000).then(() => {
          throw Error('Module was not requested');
        }),
      ]);
      assert.equal(
        completed,
        false,
        'Navigation must wait while the new document module is blocked',
      );
      releaseModule();
      await navigation;
      assert.deepEqual(
        await browser.evaluate(`({
        document: document.body.dataset.document,
        ready: window.newDocumentReady,
        old: 'oldDocument' in window
      })`),
        { document: 'new', ready: true, old: false },
      );
      await browser.navigate(url + '/new#section', 390);
      assert.equal(await browser.evaluate('location.hash'), '#section');
      assert.equal(await browser.evaluate('window.newDocumentReady'), true);
      assert.deepEqual(browser.errors, []);
      await browser.close();
      await browser.close();
      await assert.rejects(browser.evaluate('1'), /Browser connection is not open/);
    } finally {
      releaseModule();
      if (navigation) await navigation.catch(() => {});
      if (browser) await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);

test(
  'browser reloads fresh application documents and bootstraps after repeated offline and online transitions',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      html = await readFile('web/index.html', 'utf8'),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      for (let cycle = 0; cycle < 5; cycle++) {
        if (cycle) {
          await browser.networkConditions(true, 0);
          assert.equal(await browser.evaluate('navigator.onLine'), false);
          assert.equal(
            await browser.evaluate(`fetch('/api/cultivation', {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({id:'harness_offline_${cycle}',operation:'draw',count:1})
            }).then(() => false, () => true)`),
            true,
            'The transport must reject an offline mutation before reloading',
          );
          if (cycle % 2) await browser.navigate(server.url, 390);
        }
        control.staticFiles = new Map([
          [
            'index.html',
            html.replace('<head>', `<head><script>window.reloadCycle = ${cycle};</script>`),
          ],
        ]);
        const reads = control.calls.filter((call) => call === 'GET bootstrap').length;
        await browser.networkConditions(false, 0, 10000000);
        assert.equal(await browser.evaluate('navigator.onLine'), true);
        await browser.navigate(server.url, 390);
        assert.equal(await browser.evaluate('window.reloadCycle'), cycle);
        assert.equal(await browser.evaluate("'oldDocument' in window"), false);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        assert.equal(control.calls.filter((call) => call === 'GET bootstrap').length, reads + 1);
        await browser.evaluate('window.oldDocument = true');
        assert.deepEqual(browser.errors, []);
      }
      assert.equal(control.posts.length, 0, 'Reload recovery must not mutate personal data');
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'browser timeout diagnostics include script and resource failures and reset after navigation',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.staticFiles = new Map([
      [
        'index.html',
        `<!doctype html><html><head>
      <script>console.error('controlled console failure');throw Error('controlled script failure');</script>
      <script type="module" src="/app/controlled-missing-module.js"></script>
      </head><body><main id="content">Controlled startup failure</main></body></html>`,
      ],
    ]);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await assert.rejects(browser.wait('window.applicationStarted === true'), (error) => {
        for (const text of [
          'controlled script failure',
          'controlled console failure',
          'controlled-missing-module.js',
          '404',
          'resourceFailures',
          'readyState',
          'Controlled startup failure',
          server.url,
        ])
          assert.ok(error.message.includes(text), 'Missing diagnostic: ' + text);
        return true;
      });
      assert.equal(browser.errors.length, 1);
      control.staticFiles.clear();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'ordinary draws use the production API and real delayed D1, preserve waiting UX and recover a lost x10 response',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ['DB'],
    });
    let browser, server;
    let releaseResponse;
    try {
      const db = await mf.getD1Database('DB');
      for (const file of readdirSync('migrations')
        .filter((file) => file.endsWith('.sql'))
        .sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
      const healthy = new HealthyStore(db),
        schedule = new ScheduleStore(db),
        token = 'local-draw-test-token';
      await schedule.configure('123', '04:30', '22:30', 0, now);
      const day = (await schedule.ensureDay('123', now)).day;
      await new D1BeastStore(db).initialize('123', day, now);
      await healthy.mutate('123', 'draw_ui_seed_001', 'fixture', {}, now, (state) => ({
        state: { ...state, tickets: 30 },
        result: {},
      }));
      const calls = [],
        native = new WeakMap();
      const slow = {
        prepare(sql) {
          const wrap = (statement) => {
            const wrapped = {
              bind: (...values) => wrap(statement.bind(...values)),
              first: async () => {
                calls.push('read');
                await delay(50);
                return statement.first();
              },
              all: async () => {
                calls.push('read');
                await delay(50);
                return statement.all();
              },
              run: async () => {
                calls.push('write');
                await delay(50);
                return statement.run();
              },
            };
            native.set(wrapped, statement);
            return wrapped;
          };
          return wrap(db.prepare(sql));
        },
        batch: async (statements) => {
          calls.push('batch');
          await delay(50);
          return db.batch(statements.map((statement) => native.get(statement)));
        },
      };
      const control = fixture();
      control.state.account = await healthy.read('123');
      let holdResponse = false,
        loseResponse = false,
        committed = false;
      const timings = [];
      control.api = async (incoming, endpoint) => {
        if (endpoint === 'bootstrap') return Response.json(control.bootstrap());
        if (endpoint === 'history')
          return Response.json({ result: { items: [], offset: 0, total: 0, hasMore: false } });
        if (endpoint === 'habits') return Response.json(control.habits);
        if (endpoint === 'linh-thu/tower')
          return Response.json({
            eligibility: { day, eligible: false },
            run: null,
            account: { version: 1, state: {} },
            wallet: control.state.account,
          });
        if (endpoint !== 'cultivation')
          return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
        let raw = '';
        for await (const part of incoming) raw += part;
        const input = JSON.parse(raw);
        control.posts.push({ path: endpoint, input });
        const params = new URLSearchParams({
          auth_date: String(Math.floor(now / 1000)),
          user: JSON.stringify({ id: 123 }),
        });
        params.set(
          'hash',
          createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
            .update(
              [...params]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => key + '=' + value)
                .join('\n'),
            )
            .digest('hex'),
        );
        const response = await miniAppApi(
          new Request(new URL(incoming.url, server.url), {
            method: 'POST',
            headers: {
              'X-Telegram-Init-Data': params.toString(),
              'Content-Type': 'application/json',
            },
            body: raw,
          }),
          { DB: slow, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: token },
          now,
        );
        assert.equal(response.status, 200);
        timings.push(response.headers.get('Server-Timing'));
        control.state.account = (await response.clone().json()).account;
        committed = true;
        await delay(150); // Response transport latency, separate from database latency.
        if (holdResponse)
          await new Promise((resolve) => {
            releaseResponse = resolve;
          });
        if (loseResponse) {
          loseResponse = false;
          return Response.json({ error: 'OPERATION_NOT_CONFIRMED' }, { status: 503 });
        }
        return response;
      };
      server = await serve(control);
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.click('Quay thưởng · 30 vé');
      for (const [index, count] of [1, 10, 1].entries()) {
        calls.length = 0;
        committed = false;
        holdResponse = index === 0;
        loseResponse = index === 1;
        await browser.evaluate(`(() => {
          const node=document.querySelector('.draw-result');
          const frames=window.realDrawFrames=[];
          function sample(){
            const reward=!!node.querySelector('.draw-rewards');
            const animation=node.getAnimations().find(animation=>'animationName' in animation&&animation.animationName==='draw-open');
            frames.push({reward,opening:animation?.playState==='running',time:animation?.currentTime??null});
            if(node.getAttribute('aria-busy')==='true'||!reward)requestAnimationFrame(sample);
          }
          document.querySelector('[data-draw-count="${count}"]').click();
          requestAnimationFrame(sample);
        })()`);
        if (holdResponse) {
          const deadline = Date.now() + 10000;
          while ((!committed || !releaseResponse) && Date.now() < deadline) await delay(20);
          assert.ok(
            committed && releaseResponse,
            'The real draw must commit before the response gate',
          );
          await delay(450);
          assert.deepEqual(
            await browser.evaluate(
              `({busy:document.querySelector('.draw-result').getAttribute('aria-busy'),hint:document.querySelector('.draw-hint').textContent,reveal:!!document.querySelector('.mystery-revealed'),disabled:[...document.querySelectorAll('[data-draw-count]')].every(button=>button.disabled)})`,
            ),
            { busy: 'true', hint: 'Đang xác nhận phần thưởng…', reveal: false, disabled: true },
          );
          releaseResponse();
        }
        if (index === 1) {
          await browser.wait(
            "document.querySelector('[data-draw-count=\"10\"]').textContent.includes('Kiểm tra lại')",
          );
          assert.equal((await healthy.read('123')).state.tickets, 19);
          assert.equal(
            await browser.evaluate('document.querySelector(\'[data-draw-count="1"]\').disabled'),
            true,
          );
          await browser.evaluate('document.querySelector(\'[data-draw-count="10"]\').click()');
        }
        const balance = [29, 19, 18][index];
        await browser.wait(
          `document.querySelector('[data-ticket-balance]').textContent==='${balance}'&&document.querySelector('.draw-result').getAttribute('aria-busy')==='false'`,
        );
        assert.equal((await healthy.read('123')).state.tickets, balance);
        const frames = await browser.evaluate('window.realDrawFrames');
        assert.equal(
          frames.find((frame) => frame.reward)?.opening,
          true,
          'The production API result must first appear during the opening half',
        );
        assert.deepEqual(
          calls,
          index === 1 ? ['read', 'read', 'batch', 'read'] : ['read', 'read', 'batch'],
        );
        assert.match(timings.at(-1), /total;dur=\d/);
      }
      assert.equal(new Set(control.posts.map((post) => post.input.id)).size, 3);
      assert.equal(control.posts.length, 4, 'Recovery reuses the original request id');
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM cultivation_receipts WHERE operation='draw'")
            .first()
        ).n,
        3,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM beast_skill_events WHERE kind='v2:draw'")
            .first()
        ).n,
        3,
        'V2 audits one paid transaction per bundle, including one x10 transaction',
      );
      assert.equal(
        (
          await db
            .prepare(
              "SELECT SUM(json_extract(result_json,'$.count')) AS n FROM beast_skill_events WHERE kind='v2:draw'",
            )
            .first()
        ).n,
        12,
        'Three bundle receipts cover all twelve paid rolls without replaying the recovered x10',
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      releaseResponse?.();
      await browser?.close();
      await server?.close();
      await mf.dispose();
    }
  },
);

test(
  'draw rewards appear during the opening half with fast or slow x1/x10 responses and reduced motion',
  { skip: !browserBin, timeout: 60000 },
  async (t) => {
    const control = fixture();
    control.state.account.state.tickets = 60;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.click('Quay thưởng · 60 vé');
      const cases = [
        { count: 1, latency: 0 },
        { count: 10, latency: 250 },
        { count: 1, latency: 1800 },
        { count: 10, latency: 1800 },
        { count: 1, latency: 0, motion: 'system' },
        { count: 10, latency: 250, motion: 'app' },
      ];
      let balance = 60;
      for (const { count, latency, motion } of cases) {
        await browser.reducedMotion(motion === 'system');
        await browser.evaluate(
          `import('/app/core/experience.js').then(module=>module.setExperiencePreferences({motion:'${motion === 'app' ? 'reduce' : 'system'}'}))`,
        );
        await browser.evaluate(`(() => {
          const native=window.drawNativeFetch??=window.fetch.bind(window);
          const probe=window.drawProbe={start:performance.now(),samples:[],done:false};
          window.fetch=async(...args)=>{
            if(String(args[0]).endsWith('/api/cultivation')&&args[1]?.method==='POST'){
              probe.request=performance.now()-probe.start;
              const response=await native(...args);
              const buffered=new Response(await response.text(),{status:response.status,headers:response.headers});
              probe.held=true;
              await new Promise(resolve=>setTimeout(resolve,${latency}));
              probe.response=performance.now()-probe.start;
              return buffered;
            }
            return native(...args);
          };
          const node=document.querySelector('.draw-result');
          const observe=()=>{
            const reward=!!node.querySelector('.draw-rewards');
            const animation=node.getAnimations().find(animation=>'animationName' in animation&&animation.animationName==='draw-open');
            const style=getComputedStyle(node);
            probe.samples.push({at:performance.now()-probe.start,reward,opening:animation?.playState==='running',time:animation?.currentTime??null,opacity:Number(style.opacity),transform:style.transform});
            if(node.getAttribute('aria-busy')==='false'&&reward)probe.done=true;
            else if(window.drawProbe===probe)requestAnimationFrame(observe);
          };
          document.querySelector('[data-draw-count="${count}"]').click();
          requestAnimationFrame(observe);
        })()`);
        if (latency === 1800) {
          await browser.wait('window.drawProbe.held===true');
          await delay(450);
          assert.deepEqual(
            await browser.evaluate(`({
              reward:!!document.querySelector('.draw-rewards'),
              busy:document.querySelector('.draw-result').getAttribute('aria-busy'),
              opening:document.querySelector('.draw-result').classList.contains('draw-opening'),
              closing:document.querySelector('.draw-result').classList.contains('draw-closing')
            })`),
            { reward: false, busy: 'true', opening: false, closing: true },
            'An unconfirmed result must never open an empty reward face',
          );
        }
        await browser.wait('window.drawProbe.done===true');
        const probe = await browser.evaluate('window.drawProbe');
        const first = probe.samples.find((sample) => sample.reward);
        assert.ok(first.at >= probe.response, 'Reward content must follow the confirmed response');
        if (motion) {
          assert.equal(first.opening, false, 'Reduced motion must skip both halves');
          assert.equal(first.transform, 'none');
        } else {
          assert.equal(
            first.opening,
            true,
            'The first reward frame must be inside the opening half',
          );
          assert.ok(
            probe.samples.some(
              (sample) =>
                sample.reward &&
                sample.opening &&
                sample.time > 0 &&
                sample.time < 350 &&
                sample.opacity > 0.45 &&
                sample.transform !== 'none',
            ),
            'Confirmed content must become visible while the card is still turning',
          );
        }
        balance -= count;
        assert.equal(
          await browser.evaluate("document.querySelector('[data-ticket-balance]').textContent"),
          String(balance),
        );
        assert.equal(control.state.account.state.tickets, balance);
        assert.equal(
          await browser.evaluate("document.querySelector('.draw-rewards strong').textContent"),
          '×' + count,
        );
        t.diagnostic(
          JSON.stringify({
            count,
            responseLatencyMs: latency,
            reducedMotion: motion ?? false,
            requestMs: Math.round(probe.request),
            responseMs: Math.round(probe.response),
            firstRewardMs: Math.round(first.at),
            rewardDuringOpening: first.opening,
          }),
        );
      }
      assert.equal(control.posts.length, cases.length);
      assert.equal(new Set(control.posts.map((post) => post.input.id)).size, cases.length);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'mobile screens and sheets keep Vietnamese text and controls reachable at large text and short heights',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = beastFixture();
    const longTitle = 'Chuẩn bị nội dung thuyết trình và kiểm tra toàn bộ công việc trong tuần';
    control.state.tasks[0].title = longTitle;
    control.state.reminders[0].title = longTitle;
    const server = await serve(control);
    let browser;
    const checkLayout = async (label) => {
      const issues = await browser.evaluate(`(()=>{
        const dialog=document.querySelector('#sheet[open]');
        const root=dialog??document.querySelector('#content');
        const overflow=root.scrollWidth>root.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1;
        const clipped=[...root.querySelectorAll('button,.sheet-title-row h2,.beast-hero-copy h2,.beast-atlas-entry strong,.beast-collection-card strong')].filter(e=>{
          if(!e.getClientRects().length)return false;
          const s=getComputedStyle(e);
          return (['hidden','clip'].includes(s.overflowX)&&e.scrollWidth>e.clientWidth+1)||(['hidden','clip'].includes(s.overflowY)&&e.scrollHeight>e.clientHeight+1);
        }).map(e=>e.textContent);
        return {overflow,clipped};
      })()`);
      assert.deepEqual(issues, { overflow: false, clipped: [] }, label);
    };
    try {
      browser = await chrome();
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [430, 740],
        [740, 360],
      ]) {
        await browser.resize(width, height);
        for (const tab of ['today', 'habits', 'reminders', 'beasts', 'achievements']) {
          await browser.evaluate(`document.querySelector('[data-tab=${tab}]').click()`);
          if (tab === 'beasts') await browser.wait("!!document.querySelector('.beast-hero')");
          await browser.scaleText(2);
          await checkLayout(`${tab} ${width}x${height} text 200%`);
          await browser.scaleText(1);
          if (tab === 'beasts') {
            for (const panel of [1, 2, 3, 0]) {
              await browser.evaluate(`document.querySelectorAll('.beast-tab')[${panel}].click()`);
              await browser.scaleText(2);
              await checkLayout(`beast panel ${panel} ${width}x${height}`);
              await browser.scaleText(1);
            }
          }
        }
      }
      for (const tab of ['habits', 'reminders']) {
        await browser.resize(320, 568);
        await browser.evaluate(`document.querySelector('[data-tab=${tab}]').click()`);
        if (tab === 'habits') {
          await browser.wait('!!document.querySelector(\'[aria-label="Thêm thói quen"]\')');
          await browser.evaluate(
            'document.querySelector(\'[aria-label="Thêm thói quen"]\').click()',
          );
        } else await browser.click('+ Tạo lời nhắc');
        await browser.wait("document.querySelector('#sheet').open");
        await browser.scaleText(2);
        await checkLayout(`${tab} editor text 200%`);
        await browser.scaleText(1);
        await browser.evaluate(`(() => {
          Object.defineProperty(visualViewport,'height',{configurable:true,value:280});
          Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:0});
          visualViewport.dispatchEvent(new Event('resize'));
        })()`);
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet').getBoundingClientRect().bottom<=281",
          ),
          true,
          'An overlay keyboard keeps the sheet inside the visible viewport',
        );
        await browser.evaluate(
          "delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'))",
        );
        await browser.resize(320, 320);
        await browser.evaluate(
          `(()=>{const input=document.querySelector('#sheet input:not([type=hidden])');input?.focus();input?.scrollIntoView({block:'center'});})()`,
        );
        await checkLayout(`${tab} reduced viewport`);
        await browser.evaluate(
          `(()=>{const buttons=[...document.querySelectorAll('#sheet button')];buttons.at(-1)?.scrollIntoView({block:'center'});})()`,
        );
        assert.equal(
          await browser.evaluate(
            `(()=>{const button=[...document.querySelectorAll('#sheet button')].at(-1),r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1})()`,
          ),
          true,
          `${tab} last action remains reachable`,
        );
        await browser.press('Escape');
        await browser.wait("!document.querySelector('#sheet').open");
      }
      assert.equal(control.posts.length, 0, 'Layout inspection does not modify account data');
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'habit completion awards one visible ticket through undo and redo, then x10 keeps mobile controls reachable',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = fixture(),
      day = control.habits.day.day;
    const definition = {
      name: 'Đọc mỗi ngày',
      metric: 'check',
      target: 100,
      unit: 'lần',
      note: '',
      cadence: { kind: 'daily' },
      commitmentFrom: day - 1,
    };
    control.habits.habits = [
      {
        habit: {
          id: 'habit_ticket_demo',
          version: 1,
          createdDay: day - 1,
          archivedFrom: null,
          revisions: [{ fromDay: day - 1, definition }],
        },
        definition,
        pending: null,
        log: { value: 0, note: '', version: 0 },
        preview: null,
        slot: null,
        reminderTime: null,
      },
    ];
    control.state.account.state.tickets = 10;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
      await browser.wait("!!document.querySelector('.habit-check')");
      await browser.evaluate("document.querySelector('.habit-check').click()");
      await browser.wait(
        "!!document.querySelector('.habit-check.checked')&&!document.querySelector('.habit-check').disabled",
      );
      assert.equal(control.state.account.state.tickets, 11);
      await browser.wait("document.body.textContent.includes('+1 vé quay')");
      await browser.click('Hoàn tác');
      await browser.wait(
        "!!document.querySelector('.habit-check:not(.checked)')&&!document.querySelector('.habit-check').disabled",
      );
      assert.equal(control.state.account.state.tickets, 11);
      await browser.evaluate("document.querySelector('.habit-check').click()");
      await browser.wait(
        "!!document.querySelector('.habit-check.checked')&&!document.querySelector('.habit-check').disabled",
      );
      assert.equal(control.state.account.state.tickets, 11);
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.wait("!!document.querySelector('.checkin-claim')");
      await browser.evaluate(
        "[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Quay thưởng ·')).click()",
      );
      await browser.evaluate('document.querySelector(\'[data-draw-count="10"]\').click()');
      await browser.wait('!!document.querySelector(\'.mystery-revealed[aria-busy="false"]\')');
      assert.equal(control.state.account.state.tickets, 1);
      assert.equal(
        control.posts.filter((p) => p.path === 'cultivation' && p.input.operation === 'draw')
          .length,
        1,
      );
      for (const width of [320, 390, 900]) {
        await browser.resize(width, 720);
        await browser.evaluate(
          "document.querySelector('.draw-probabilities').open=true;document.querySelector('.draw-body').scrollTop=9999",
        );
        const layout = await browser.evaluate(`(()=>{
          const panel=document.querySelector('#sheet').getBoundingClientRect();
          const actions=[...document.querySelectorAll('[data-draw-count]')].map(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,disabled:b.disabled}});
          return {panelBottom:panel.bottom,actions,overflow:document.documentElement.scrollWidth>innerWidth+1};
        })()`);
        assert.equal(layout.overflow, false);
        assert.ok(
          layout.actions.every(
            (a) => a.height >= 44 && a.bottom <= layout.panelBottom + 1 && a.top >= 0,
          ),
        );
        assert.equal(layout.actions[0].disabled, false);
        assert.equal(layout.actions[1].disabled, true);
      }
      await browser.resize(390, 720);
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'draw-x10-mobile.png'));
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'lost x10 response can be recovered after reopening the sheet without spending twice',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = fixture();
    control.state.account.state.tickets = 12;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.wait("!!document.querySelector('.checkin-claim')");
      await browser.evaluate(`(()=>{
        const original=window.fetch;let lost=true;
        window.fetch=async(...args)=>{const response=await original(...args);
          if(lost&&String(args[0]).endsWith('/api/cultivation')&&args[1]?.method==='POST'){lost=false;throw Error('LOST_RESPONSE');}
          return response;};
        [...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Quay thưởng ·')).click();
      })()`);
      await browser.evaluate('document.querySelector(\'[data-draw-count="10"]\').click()');
      await browser.wait(
        "document.querySelector('[data-draw-count=\"10\"]').textContent.includes('Kiểm tra lại')",
      );
      assert.equal(control.state.account.state.tickets, 2);
      assert.equal(
        await browser.evaluate('document.querySelector(\'[data-draw-count="1"]\').disabled'),
        true,
      );
      await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
      await browser.wait("!document.querySelector('#sheet').open");
      await browser.evaluate(
        "[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Quay thưởng ·')).click()",
      );
      await browser.wait(
        "document.querySelector('[data-draw-count=\"10\"]').textContent.includes('Kiểm tra lại')",
      );
      await browser.evaluate('document.querySelector(\'[data-draw-count="10"]\').click()');
      await browser.wait("!!document.querySelector('.mystery-revealed')");
      assert.equal(control.state.account.state.tickets, 2);
      assert.equal(
        control.posts.filter((p) => p.path === 'cultivation' && p.input.operation === 'draw')
          .length,
        1,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('[data-ticket-balance]').textContent"),
        '2',
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);
test(
  'x1 and x10 draw receipts update rewards and wallet without waiting for unrelated refreshes',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.state.account.state.tickets = 30;
    const initialBasic = control.state.account.state.inventory.basic;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.click('Quay thưởng · 30 vé');
      control.calls.length = 0;
      control.readDelays = { bootstrap: 3000 };
      control.failBootstrap = true;
      let balance = 30;
      for (const count of [1, 10, 1]) {
        balance -= count;
        await browser.evaluate(`document.querySelector('[data-draw-count="${count}"]').click()`);
        await browser.wait(
          `document.querySelector('[data-ticket-balance]').textContent==='${balance}'&&document.querySelector('.draw-result').getAttribute('aria-busy')==='false'`,
        );
        assert.equal(
          await browser.evaluate("document.querySelector('.draw-result h3').textContent"),
          `Đã nhận ${count} phần thưởng`,
        );
        assert.equal(control.state.account.state.tickets, balance);
        assert.equal(control.calls.filter((call) => call.startsWith('GET ')).length, 0);
      }
      assert.equal(new Set(control.posts.map((post) => post.input.id)).size, 3);
      assert.equal(control.state.account.state.inventory.basic, initialBasic + 12);
      await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
      await browser.wait("document.querySelector('#toast').textContent.length>0");
      assert.equal(control.calls.filter((call) => call === 'GET bootstrap').length, 1);
      // A failed optional refresh must not turn a confirmed draw into a retry.
      await browser.click('Quay thưởng · 18 vé');
      await browser.evaluate('document.querySelector(\'[data-draw-count="1"]\').click()');
      await browser.wait("document.querySelector('[data-ticket-balance]').textContent==='17'");
      assert.equal(control.posts.length, 4);
      assert.equal(new Set(control.posts.map((post) => post.input.id)).size, 4);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a refresh started after closing a draw cannot replace the wallet from a newer draw',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.state.account.state.tickets = 30;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.click('Quay thưởng · 30 vé');
      await browser.evaluate('document.querySelector(\'[data-draw-count="1"]\').click()');
      await browser.wait("document.querySelector('[data-ticket-balance]').textContent==='29'");
      await browser.evaluate(`(() => {
        const original=window.fetch;
        window.fetch=async(...args)=>{
          const response=await original(...args);
          if(String(args[0]).endsWith('/api/bootstrap')){
            const saved=new Response(await response.text(),{status:response.status,headers:response.headers});
            window.drawRefreshHeld=true;
            await new Promise(resolve=>window.releaseDrawRefresh=resolve);
            window.drawRefreshReleased=true;
            return saved;
          }
          return response;
        };
        document.querySelector('[data-sheet-close]').click();
      })()`);
      await browser.wait('window.drawRefreshHeld===true');
      await browser.click('Quay thưởng · 29 vé');
      await browser.evaluate('document.querySelector(\'[data-draw-count="10"]\').click()');
      await browser.wait("document.querySelector('[data-ticket-balance]').textContent==='19'");
      await browser.evaluate('window.releaseDrawRefresh()');
      await browser.wait('window.drawRefreshReleased===true');
      await delay(200);
      assert.equal(
        await browser.evaluate("document.querySelector('[data-ticket-balance]').textContent"),
        '19',
      );
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('#content button')].some(b=>b.textContent==='Quay thưởng · 19 vé')",
        ),
        true,
      );
      assert.equal(control.posts.length, 2);
      assert.equal(control.state.account.state.tickets, 19);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a slow draw POST keeps its waiting status and a closed sheet never receives a late reveal',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.state.account.state.tickets = 12;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.click('Quay thưởng · 12 vé');
      await browser.evaluate(`(() => {
        const original=window.fetch;
        window.fetch=async(...args)=>{
          const response=await original(...args);
          if(String(args[0]).endsWith('/api/cultivation')&&args[1]?.method==='POST'){
            window.drawPostHeld=true;
            await new Promise(resolve=>window.releaseDrawPost=resolve);
          }
          return response;
        };
        document.querySelector('[data-draw-count="10"]').click();
      })()`);
      await browser.wait('window.drawPostHeld===true');
      await delay(650);
      assert.equal(await browser.evaluate("!!document.querySelector('.mystery-revealed')"), false);
      assert.equal(
        await browser.evaluate("document.querySelector('.draw-hint').textContent"),
        'Đang xác nhận phần thưởng…',
      );
      assert.equal(control.posts.length, 1);
      assert.equal(control.state.account.state.tickets, 2);
      await browser.press('Escape');
      await browser.wait("!document.querySelector('#sheet').open");
      await browser.evaluate('window.releaseDrawPost()');
      await browser.wait(
        "!document.querySelector('#sheet').open&&[...document.querySelectorAll('#content button')].some(b=>b.textContent==='Quay thưởng · 2 vé'&&!b.disabled)",
      );
      await browser.click('Quay thưởng · 2 vé');
      assert.equal(
        await browser.evaluate("document.querySelector('[data-ticket-balance]').textContent"),
        '2',
      );
      assert.equal(await browser.evaluate("!!document.querySelector('.mystery-revealed')"), false);
      assert.equal(control.posts.length, 1);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'a late confirmed draw cannot restore rewards after the session changes',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.state.account.state.tickets = 12;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      await browser.click('Quay thưởng · 12 vé');
      await browser.evaluate(`(() => {
        const original=window.fetch;
        window.fetch=async(...args)=>{
          const response=await original(...args);
          if(String(args[0]).endsWith('/api/cultivation')&&args[1]?.method==='POST'){
            window.drawPostHeld=true;
            await new Promise(resolve=>window.releaseDrawPost=resolve);
            window.drawPostReleased=true;
          }
          return response;
        };
        document.querySelector('[data-draw-count="10"]').click();
      })()`);
      await browser.wait('window.drawPostHeld===true');
      // Model an external authentication change while the control is disabled.
      await browser.evaluate(
        "document.querySelector('#logout').disabled=false;document.querySelector('#logout').click()",
      );
      await browser.wait("!!document.querySelector('.login-card')");
      await browser.evaluate('window.releaseDrawPost()');
      await browser.wait('window.drawPostReleased===true');
      await delay(550);
      assert.equal(await browser.evaluate("!!document.querySelector('.login-card')"), true);
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), false);
      assert.equal(await browser.evaluate("!!document.querySelector('.mystery-revealed')"), false);
      assert.equal(control.posts.length, 1);
      assert.equal(control.state.account.state.tickets, 2);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'mobile frame prioritizes content, shares heading geometry and follows stable Telegram viewport and safe areas',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = beastFixture();
    const html = await readFile(new URL('../../web/index.html', import.meta.url), 'utf8');
    const telegram = `<script>
      globalThis.__telegramEvents=new Map();
      globalThis.Telegram={WebApp:{initData:'local-mobile-test',colorScheme:'light',
        viewportStableHeight:730,safeAreaInset:{top:0,bottom:34,left:0,right:0},
        contentSafeAreaInset:{top:0,bottom:0,left:0,right:0},
        ready(){},expand(){},onEvent(name,fn){__telegramEvents.set(name,fn)}}};
    </script>`;
    control.staticFiles = new Map([
      [
        'index.html',
        Buffer.from(html.replace('<script type="module"', telegram + '<script type="module"')),
      ],
    ]);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.resize(390, 730);
      await browser.wait('!!document.querySelector(".focus-flip-card")');
      const expected = {
        today: 'Hôm nay',
        habits: 'Thói quen',
        reminders: 'Lời nhắc',
        beasts: 'Linh thú',
        achievements: 'Thành tích',
      };
      for (const [tab, title] of Object.entries(expected)) {
        await browser.tap('[data-tab=' + tab + ']');
        await browser.wait('!!document.querySelector("#content h1")');
        const geometry = await browser.evaluate(`(()=>{
          const heading=document.querySelector('#content h1'),r=heading.getBoundingClientRect();
          const gear=document.querySelector('#settings'),g=gear.getBoundingClientRect();
          return {title:heading.textContent,font:getComputedStyle(heading).fontSize,top:r.top,
            gearTop:g.top,gearReachable:document.elementFromPoint(g.left+g.width/2,g.top+g.height/2)?.closest('button')===gear,
            strip:getComputedStyle(document.querySelector('.demo-strip')).display,
            identity:getComputedStyle(document.querySelector('.identity')).display,
            overflow:document.documentElement.scrollWidth>innerWidth+1};
        })()`);
        assert.deepEqual(geometry, {
          title,
          font: '28px',
          top: 24,
          gearTop: 24,
          gearReachable: true,
          strip: 'none',
          identity: 'none',
          overflow: false,
        });
      }
      await browser.evaluate('scrollTo({top:180,behavior:"instant"})');
      await browser.tap('[data-tab=today]');
      await browser.tap('[data-tab=achievements]');
      assert.equal(
        await browser.evaluate('scrollY'),
        180,
        'Every primary tab retains its own scroll position',
      );
      await browser.evaluate('scrollTo({top:0,behavior:"instant"})');
      await browser.tap('[data-tab=beasts]');
      await browser.wait('!!document.querySelector(".beast-hero")');
      await browser.click('Triệu hồi');
      await browser.wait('document.querySelector(".beast-summon-banner img")?.naturalWidth>0');
      await browser.evaluate(
        `Telegram.WebApp.viewportStableHeight=640;__telegramEvents.get('viewportChanged')({isStateStable:false})`,
      );
      assert.equal(
        await browser.evaluate(
          'document.documentElement.style.getPropertyValue("--app-viewport-height")',
        ),
        '730px',
      );
      await browser.resize(390, 640);
      await browser.evaluate(`__telegramEvents.get('viewportChanged')({isStateStable:true})`);
      assert.equal(
        await browser.evaluate(
          'document.documentElement.style.getPropertyValue("--app-viewport-height")',
        ),
        '640px',
      );
      await browser.wait('document.documentElement.scrollHeight>innerHeight');
      await browser.evaluate('scrollTo({top:10000,behavior:"instant"})');
      const bottom = await browser.evaluate(`(()=>{
        const nav=document.querySelector('.bottom-nav'),n=nav.getBoundingClientRect();
        const pool=document.querySelector('.beast-summon-pool-link').getBoundingClientRect();
        return {scrolled:scrollY>0,clear:pool.bottom<=n.top-12,safe:getComputedStyle(nav).paddingBottom,
          art:document.querySelector('.beast-summon-banner').getBoundingClientRect().height};
      })()`);
      assert.equal(bottom.scrolled, true);
      assert.equal(bottom.clear, true);
      assert.equal(bottom.safe, '34px');
      assert.ok(bottom.art >= 220);
      await browser.evaluate(
        `scrollTo(0,0);Telegram.WebApp.contentSafeAreaInset.top=20;__telegramEvents.get('contentSafeAreaChanged')()`,
      );
      assert.equal(
        await browser.evaluate('document.querySelector("#settings").getBoundingClientRect().top'),
        44,
      );
      await browser.tap('#settings');
      await browser.wait('document.querySelector("#sheet").open');
      await browser.press('Escape');
      await browser.wait('!document.querySelector("#sheet").open');
      assert.equal(control.posts.length, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      await server.close();
    }
  },
);

test(
  'all five mobile navigation icons and labels share rows across screen sizes',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const server = await serve(fixture());
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      for (const width of [320, 375, 390, 391, 393, 414, 430, 899, 900, 1440]) {
        await browser.resize(width, width < 900 ? 844 : 1000);
        const view = await browser.evaluate(`(() => {
                const rows=[...document.querySelectorAll('.bottom-nav button')].map(button=>{
                    const icon=button.querySelector('.nav-svg').getBoundingClientRect();
                    const label=button.querySelector('.nav-label').getBoundingClientRect();
                    return {iconY:icon.y,labelY:label.y,width:icon.width,height:icon.height,display:getComputedStyle(button).display,
                      labelHeight:label.height,lineHeight:parseFloat(getComputedStyle(button).lineHeight),svg:!!button.querySelector('svg')};
                });return {rows,overflow:document.documentElement.scrollWidth>innerWidth+1};
            })()`);
        assert.equal(view.rows.length, 5);
        assert.equal(view.overflow, false);
        for (const row of view.rows) {
          assert.equal(row.width, 24);
          assert.equal(row.height, 24);
          assert.equal(row.svg, true);
          if (width < 900)
            assert.ok(row.labelHeight <= row.lineHeight + 1, 'Normal labels stay on one line');
        }
        if (width < 900) {
          assert.ok(
            Math.max(...view.rows.map((row) => row.iconY)) -
              Math.min(...view.rows.map((row) => row.iconY)) <=
              1,
            'Icon alignment at ' + width,
          );
          assert.ok(
            Math.max(...view.rows.map((row) => row.labelY)) -
              Math.min(...view.rows.map((row) => row.labelY)) <=
              1,
            'Label alignment at ' + width,
          );
        } else
          assert.ok(
            view.rows.every((row) => row.display === 'flex'),
            'Desktop sidebar layout',
          );
      }
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'six habits and assistant screens remain usable with large text, keyboard and a slow offline recovery',
  { skip: !browserBin, timeout: 120000 },
  async () => {
    const control = fixture();
    for (let index = 0; index < 6; index++)
      control.mutate('habits', {
        id: 'large_habit_' + index,
        operation: 'create',
        definition: {
          name: index
            ? ['Thiền buổi sáng', 'Đọc sách', 'Đi bộ', 'Viết nhật ký', 'Uống nước'][index - 1]
            : 'Luyện tập vận động nhẹ và ghi lại điều mình học được trong ngày',
          metric: 'check',
          target: 1,
          cadence: index === 5 ? { kind: 'weekly', quota: 3 } : { kind: 'daily' },
        },
      });
    const writes = control.posts.length,
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.networkConditions();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      const initial = await browser.evaluate(
        "({ duration: performance.now(), resources: performance.getEntriesByType('resource').map(r=>({url:new URL(r.name).pathname,bytes:r.encodedBodySize})) })",
      );
      assert.ok(
        initial.resources.reduce((total, resource) => total + resource.bytes, 0) < 1024 * 1024,
        'Cold Today load stays below 1 MiB uncompressed fixture resources',
      );
      assert.ok(
        !initial.resources.some((resource) => /\/art\/.*(?:boss|chapter)/.test(resource.url)),
        'Today does not preload the story art',
      );
      const measurements = [{ screen: 'today-cold', ...initial }];
      const scaleText = async () => {
        await browser.evaluate(
          "{ document.querySelectorAll('[data-large-qa]').forEach(node=>{node.style.fontSize='';delete node.dataset.largeQa});const sizes=[...document.querySelectorAll('body *')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);sizes.forEach(([node,size])=>{node.style.fontSize=(size*2)+'px';node.dataset.largeQa='true'}) }",
        );
        await browser.evaluate(
          'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
        );
      };
      for (const [width, theme] of [
        [360, 'light'],
        [390, 'dark'],
        [414, 'light'],
        [1440, 'light'],
      ]) {
        await browser.resize(width, width < 900 ? 844 : 1000);
        await browser.colorScheme(theme);
        await browser.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
        for (const tab of ['today', 'habits', 'reminders', 'achievements']) {
          await browser.evaluate(`document.querySelector('[data-tab=${tab}]').click()`);
          await browser.wait(
            "!document.querySelector('#content [aria-busy=true]') && !!document.querySelector('#content section')",
          );
          if (tab === 'habits')
            await browser.wait("document.querySelectorAll('.habit-card').length===6");
          await scaleText();
          const view = await snapshot(browser);
          assert.equal(view.overflow, false, tab + ' / text 200% / ' + width + ' / ' + theme);
          const labelsOutside = await browser.evaluate(
            "[...document.querySelectorAll('.bottom-nav button,.habit-filters button,.habit-navigation button')].filter(button=>{const rect=button.getBoundingClientRect();if(!rect.width)return false;const range=document.createRange();range.selectNodeContents(button);return [...range.getClientRects()].some(text=>text.left<rect.left-1||text.right>rect.right+1)}).map(button=>button.textContent)",
          );
          assert.deepEqual(
            labelsOutside,
            [],
            'Navigation labels must fit their touch controls at large text: ' + tab + '/' + width,
          );
          if (process.env.UI_SCREENSHOT_DIR && width < 900)
            await browser.screenshot(
              join(
                process.env.UI_SCREENSHOT_DIR,
                'f6-large-' + tab + '-' + width + '-' + theme + '.png',
              ),
            );
          measurements.push({ screen: tab, width, theme, textScale: 2, geometry: view.geometry });
        }
      }
      await browser.resize(390, 844);
      await browser.evaluate("document.querySelector('#settings').focus()");
      assert.equal(await browser.evaluate('document.activeElement.id'), 'settings');
      await browser.press('Enter');
      await browser.wait("document.querySelector('#sheet').open");
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet').contains(document.activeElement)"),
        true,
        'Dialog moves keyboard focus inside',
      );
      await browser.press('Escape');
      await browser.wait("!document.querySelector('#sheet').open");
      assert.equal(
        await browser.evaluate('document.activeElement.id'),
        'settings',
        'Closing returns focus to opener',
      );
      await browser.networkConditions(true);
      await browser.navigate(server.url, 390);
      await browser.networkConditions(false);
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      assert.equal(
        control.posts.length,
        writes,
        'Navigation, accessibility checks and recovery do not write personal data',
      );
      assert.deepEqual(browser.errors, []);
      if (process.env.UI_SCREENSHOT_DIR)
        await writeFile(
          join(process.env.UI_SCREENSHOT_DIR, 'f6-ui-network-metrics.json'),
          JSON.stringify(
            {
              fixture:
                'localhost, Chrome emulation, 150ms latency/100KiB per second, synthetic text 200%; no device or remote latency claim',
              measurements,
            },
            null,
            2,
          ),
        );
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'feature tabs coalesce reads, show cached rows immediately and reconcile a habit without bootstrap or blocking navigation',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    for (let index = 0; index < 8; index++)
      control.mutate('habits', {
        id: 'ux_seed_' + index,
        operation: 'create',
        definition: {
          name: 'Thói quen ' + (index + 1),
          metric: 'check',
          target: 1,
          cadence: { kind: 'daily' },
        },
      });
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      control.readDelays = { habits: 650 };
      const start = control.calls.length;
      await browser.evaluate(
        "document.querySelector('[data-tab=habits]').click();document.querySelector('[data-tab=habits]').click()",
      );
      await browser.wait(
        "document.querySelectorAll('.habit-card').length===8 && !document.querySelector('.feature-updating')",
      );
      assert.deepEqual(control.calls.slice(start), ['GET linh-thu/tower', 'GET habits']);
      const transitionCalls = control.calls.slice(start);
      await browser.evaluate('window.scrollTo(0,300)');
      const scroll = await browser.evaluate('scrollY');
      assert.ok(scroll > 100);
      await browser.tap('[data-tab=today]');
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      const returning = await browser.evaluate(
        "(() => {const started=performance.now();document.querySelector('[data-tab=habits]').click();return {elapsed:performance.now()-started,rows:document.querySelectorAll('.habit-card').length,scroll:scrollY}})()",
      );
      assert.equal(returning.rows, 8);
      assert.ok(
        returning.elapsed < 200,
        'Cached screen renders within 200 ms in this localhost fixture',
      );
      assert.ok(
        Math.abs(returning.scroll - scroll) <= 2,
        'Returning keeps the habit list position',
      );
      await browser.wait("!document.querySelector('.feature-updating')");
      control.failBootstrap = true;
      const writes = control.posts.length,
        savingStart = control.calls.length;
      await browser.evaluate("document.querySelector('.habit-check').click()");
      await browser.wait(
        "document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='true' && !!document.querySelector('#toast .notice-action')",
      );
      assert.equal(
        await browser.evaluate("!!document.querySelector('.habit-check[aria-busy=true]')"),
        false,
      );
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('.bottom-nav button')].some(button=>button.disabled)",
        ),
        false,
      );
      await browser.wait(
        "document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='true'",
      );
      assert.equal(control.posts.length, writes + 1);
      assert.equal(control.calls.slice(savingStart).includes('GET bootstrap'), false);
      assert.equal(control.calls.slice(savingStart).includes('GET history'), false);
      await browser.tap('[data-tab=today]');
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait(
        "document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='true'",
      );
      assert.equal(control.posts.length, writes + 1);

      assert.equal(control.habits.habits[0].log.value, 100);
      assert.deepEqual(browser.errors, []);
      if (process.env.UX_BASELINE_REF) {
        const original = fixture();
        for (let index = 0; index < 8; index++)
          original.mutate('habits', {
            id: 'ux_seed_' + index,
            operation: 'create',
            definition: {
              name: 'Thói quen ' + (index + 1),
              metric: 'check',
              target: 1,
              cadence: { kind: 'daily' },
            },
          });
        const baseline = await serve(original, process.env.UX_BASELINE_REF);
        try {
          await browser.navigate(baseline.url, 390);
          await browser.wait("!!document.querySelector('.focus-flip-card')");
          const baselineStart = original.calls.length;
          await browser.evaluate(
            "document.querySelector('[data-tab=habits]').click();document.querySelector('[data-tab=habits]').click()",
          );
          await browser.wait("document.querySelectorAll('.habit-card').length===8");
          const beforeCalls = original.calls.slice(baselineStart);
          assert.ok(
            beforeCalls.filter((call) => call === 'GET habits').length >
              transitionCalls.filter((call) => call === 'GET habits').length,
          );
          assert.ok(beforeCalls.includes('GET bootstrap'));
          if (process.env.UI_SCREENSHOT_DIR)
            await writeFile(
              join(process.env.UI_SCREENSHOT_DIR, 'ux-request-comparison.json'),
              JSON.stringify(
                {
                  fixture:
                    'Localhost Chrome 390px; identical eight-habit seed; two consecutive tab clicks; no remote/device timing claim',
                  baselineRef: process.env.UX_BASELINE_REF,
                  beforeCalls,
                  afterCalls: transitionCalls,
                  cachedRenderMs: returning.elapsed,
                  scrollRestored: Math.abs(returning.scroll - scroll) <= 2,
                  saveCalls: control.calls.slice(savingStart),
                  bootstrapUnavailableDuringSave: true,
                },
                null,
                2,
              ),
            );
        } finally {
          await baseline.close();
        }
      }
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'habit receipts remain usable when reads fail and old reads cannot restore a logged-out screen',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.mutate('habits', {
      id: 'recovery_seed',
      operation: 'create',
      definition: { name: 'Thiền', metric: 'check', target: 1, cadence: { kind: 'daily' } },
    });
    const healthy = clone(control.state.account),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait("!!document.querySelector('.habit-check')");
      const before = control.posts.length;
      control.failedReads = new Set(['habits']);
      await browser.evaluate("document.querySelector('.habit-check').click()");
      await browser.wait("!!document.querySelector('#toast .notice-action')");
      assert.equal(control.posts.length, before + 1);
      assert.equal(control.habits.habits[0].log.version, 1);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.habit-check').getAttribute('aria-pressed')",
        ),
        'true',
        'The receipt confirms the exact log without depending on another read',
      );
      control.failedReads.clear();
      await browser.tap('[data-tab=today]');
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait(
        "document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='true'",
      );
      assert.equal(control.posts.length, before + 1, 'Reconciliation is read-only');
      await browser.evaluate("document.querySelector('.habit-check').click()");
      await browser.wait(
        "document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='false'",
      );
      assert.equal(control.habits.habits[0].log.version, 2);
      assert.deepEqual(control.state.account, healthy);
      await browser.wait(
        "document.querySelector('#toast .notice-message')?.textContent==='Đã cập nhật hôm nay.'",
      );
      await browser.evaluate(
        "window.holdHabitRead=true;const savedFetch=fetch;window.fetch=(url,init)=>savedFetch(url,init).then(async response=>{if(String(url).startsWith('/api/habits')&&init.method==='GET'&&window.holdHabitRead){await new Promise(resolve=>window.releaseHabitRead=resolve)}return response});document.querySelector('[data-tab=habits]').click()",
      );
      await browser.wait("typeof window.releaseHabitRead==='function'");
      await browser.evaluate('scrollTo({top:0,behavior:"instant"})');
      await browser.tap('#logout');
      await browser.wait("!!document.querySelector('.browser-login')");
      await browser.evaluate('window.holdHabitRead=false;window.releaseHabitRead()');
      await delay(120);
      assert.equal(await browser.evaluate("document.querySelectorAll('.habit-card').length"), 0);
      assert.equal(await browser.evaluate("!!document.querySelector('.browser-login')"), true);
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'an acknowledged feature write cannot restore the previous account snapshot after an authentication change',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.mutate('habits', {
      id: 'private_seed',
      operation: 'create',
      definition: {
        name: 'Habit của phiên trước',
        metric: 'check',
        target: 1,
        cadence: { kind: 'daily' },
      },
    });
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait("!!document.querySelector('.habit-check')");
      await browser.evaluate(
        "window.holdSavedSnapshot=true;const originalFetch=fetch;window.fetch=(url,init)=>originalFetch(url,init).then(async response=>{if(String(url).startsWith('/api/habits')&&init.method==='POST'&&window.holdSavedSnapshot){await new Promise(resolve=>window.releaseSavedSnapshot=resolve)}return response});document.querySelector('.habit-check').click()",
      );
      await browser.wait("typeof window.releaseSavedSnapshot==='function'");
      assert.equal(
        await browser.evaluate("document.querySelector('#logout').disabled"),
        false,
        'Logout remains available while a write is pending; late replies are discarded',
      );
      // Force an auth transition to model a session changed outside this pending control.
      // The controller must also discard its response, rather than relying only on disabled UI.
      await browser.evaluate(
        "document.querySelector('#logout').disabled=false;document.querySelector('#logout').click()",
      );
      await browser.wait("!!document.querySelector('.browser-login')");
      await browser.evaluate('window.holdSavedSnapshot=false;window.releaseSavedSnapshot()');
      await delay(120);
      control.habits.habits = [];
      control.authenticated = true;
      await browser.click('Lấy mã đăng nhập');
      await browser.wait("!!document.querySelector('.habits-page')");
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.habit-card').length"),
        0,
        'The old acknowledged response cannot populate the new session',
      );
      await browser.tap('[data-tab=habits]');
      await browser.wait("!document.querySelector('[aria-busy=true]')");
      assert.equal(await browser.evaluate("document.querySelectorAll('.habit-card').length"), 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'offline habit form preserves its draft and retry identity without reporting a successful save',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait(
        "!!document.querySelector('.habits-page') && !document.querySelector('[aria-busy=true]')",
      );
      await browser.tap('[aria-label="Thêm thói quen"]');
      await browser.evaluate(
        "document.querySelector('.habit-form input').value='Đọc sách sau bữa sáng';window.habitAttempts=[];const actualFetch=window.fetch;window.fetch=(url,init)=>{if(String(url)==='/api/habits'&&init?.method==='POST')habitAttempts.push(JSON.parse(init.body));return actualFetch(url,init)}",
      );
      await browser.networkConditions(true);
      await browser.evaluate("document.querySelector('.habit-form').requestSubmit()");
      await browser.wait(
        "document.querySelector('#sheet-feedback').textContent.includes('Chưa xác nhận được lần lưu') && !document.querySelector('.habit-form button[type=submit]').disabled",
      );
      assert.equal(control.posts.length, 0);
      assert.equal(control.habits.habits.length, 0);
      assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), true);
      assert.equal(
        await browser.evaluate("document.querySelector('.habit-form input').value"),
        'Đọc sách sau bữa sáng',
      );
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(
          join(process.env.UI_SCREENSHOT_DIR, 'f6-offline-habit-draft-390.png'),
        );
      await browser.networkConditions(false);
      await browser.evaluate("document.querySelector('.habit-form').requestSubmit()");
      await browser.wait(
        "!document.querySelector('#sheet').open && document.querySelectorAll('.habit-card').length===1",
      );
      const attempts = await browser.evaluate('habitAttempts');
      assert.equal(attempts.length, 2);
      assert.deepEqual(attempts[0], attempts[1]);
      assert.equal(control.posts.length, 1);
      assert.equal(control.habits.habits.length, 1);
      assert.equal(control.habits.habits[0].definition.name, 'Đọc sách sau bữa sáng');
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'habit rows keep one secondary line, log controls draft changes and Undo respects versions and day boundaries',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = fixture(),
      day = control.habits.day.day;
    for (const [id, name, metric, target, unit] of [
      ['read', 'Đọc sách', 'duration', 20, 'phút'],
      ['water', 'Uống nước', 'quantity', 8, 'ly'],
      ['check', 'Thiền', 'check', 1, 'lần'],
    ]) {
      control.mutate('habits', {
        id,
        operation: 'create',
        definition: { name, metric, target, unit, cadence: { kind: 'daily' }, note: '' },
        reminderTime: '19:00',
      });
      const view = control.habits.habits.at(-1);
      view.definition.commitmentFrom = day - 10;
      view.habit.revisions[0].definition = view.definition;
    }
    const read = control.habits.habits[0],
      water = control.habits.habits[1];
    control.mutate('habits', {
      id: 'partial',
      operation: 'log',
      habitId: read.habit.id,
      value: 15.25,
      note: 'Trang 42',
    });
    read.slot = { startAt: Date.parse('2026-10-05T19:00:00+07:00'), minutes: 20, version: 1 };
    read.pending = { fromDay: day + 1, definition: { ...read.definition, name: 'Đọc mỗi tối' } };
    control.habitOutcomes = [];
    for (const view of control.habits.habits) {
      for (let ended = day - 7; ended < day; ended++) {
        const result = assessHabitDay(
          view.definition,
          ended,
          ended % 2 ? view.definition.target : 0,
          newHabitPeriod(view.definition, ended),
          null,
        );
        control.habitOutcomes.push({
          habitId: view.habit.id,
          name: view.definition.name,
          day: ended,
          ...result,
        });
      }
    }
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait("document.querySelectorAll('.habit-card').length===3");
      assert.equal(
        control.calls.some((call) => call.startsWith('GET habit-report')),
        false,
      );
      assert.equal(await browser.evaluate("document.querySelectorAll('.habit-check').length"), 3);
      assert.equal(
        await browser.evaluate("document.querySelector('.habit-more').textContent"),
        '+4',
      );
      await browser.tap('.habit-more');
      assert.match(
        await browser.evaluate("document.querySelector('.habit-detail').innerText"),
        /Lịch 19:00.*Mỗi ngày.*Nhắc lúc 19:00.*Thay đổi từ.*Trang 42/s,
      );
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-details-390.png'));
      await browser.tap('[data-sheet-close]');
      for (const width of [320, 360, 390, 414, 1440]) {
        await browser.resize(width, 844);
        assert.equal((await snapshot(browser)).overflow, false);
        assert.equal(
          await browser.evaluate(
            "[...document.querySelectorAll('.habit-meta')].every(node=>node.getBoundingClientRect().height===24)",
          ),
          true,
        );
      }
      await browser.resize(390, 844);
      if (process.env.UI_SCREENSHOT_DIR) {
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-list-390.png'));
        await browser.resize(360, 844);
        await browser.evaluate(
          "import('/app/core/theme.js').then(theme=>theme.setThemePreference('dark'))",
        );
        await browser.evaluate('new Promise(resolve=>setTimeout(resolve,300))');
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-list-dark-360.png'));
        await browser.evaluate(
          "import('/app/core/theme.js').then(theme=>theme.setThemePreference('light'))",
        );
        await browser.resize(390, 844);
      }
      await browser.tap('.habit-log-button');
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-duration-390.png'));
      await browser.evaluate(
        "const range=document.querySelector('.habit-form input[type=range]');range.value='12.5';range.dispatchEvent(new Event('input'))",
      );
      assert.equal(await browser.evaluate("document.querySelector('[name=amount]').value"), '12.5');
      await browser.evaluate(
        "const amount=document.querySelector('[name=amount]');amount.value='25.75';amount.dispatchEvent(new Event('input'))",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.habit-form input[type=range]').value"),
        '25.75',
      );
      await browser.tap('[data-sheet-close]');
      assert.equal(read.log.value, 1525, 'Closing preserves the authoritative partial value');
      await browser.tap('.habit-check');
      await browser.wait("!!document.querySelector('#toast .notice-action')");
      assert.equal(read.log.value, 2000, 'Tick completes the actual duration target');
      await browser.tap('#toast .notice-action');
      await browser.wait(
        "document.querySelector('.habit-log-button').textContent.includes('15,25')",
      );
      assert.equal(read.log.value, 1525);
      assert.equal(read.log.note, 'Trang 42');
      await browser.tap('.habit-card:nth-child(2) .habit-log-button');
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-quantity-390.png'));
      await browser.click('+1', '.habit-counter button');
      await browser.click('+1', '.habit-counter button');
      await browser.click('−', '.habit-counter button');
      assert.equal(await browser.evaluate("document.querySelector('[name=amount]').value"), '1');
      assert.equal(water.log.value, 0, 'Counter changes are drafts until Save');
      await browser.evaluate(
        "document.querySelector('[name=amount]').value='9.5';document.querySelector('.habit-form').requestSubmit()",
      );
      await browser.wait(
        "!document.querySelector('#sheet').open && !!document.querySelector('#toast .notice-action')",
      );
      assert.equal(water.log.value, 950);
      await browser.tap('.habit-card:nth-child(2) .habit-check');
      await browser.wait(
        "!document.querySelector('[aria-busy=true]') && !!document.querySelector('#toast .notice-action')",
      );
      assert.equal(water.log.value, 0);
      await browser.tap('#toast .notice-action');
      await browser.wait(
        "document.querySelector('.habit-card:nth-child(2) .habit-log-button').textContent.includes('9,5')",
      );
      assert.equal(water.log.value, 950, 'Untick Undo preserves over-target progress');
      await browser.tap('.habit-check');
      await browser.wait("!!document.querySelector('#toast .notice-action')");
      read.log.version++;
      const writes = control.posts.length;
      await browser.tap('[data-tab=today]');
      await browser.tap('[data-tab=habits]');
      await browser.wait("!document.querySelector('.feature-updating')");
      await browser.tap('#toast .notice-action');
      assert.equal(control.posts.length, writes, 'Undo must not overwrite a newer external log');
      await browser.click('Tiến bộ', '.habit-tabs button');
      await browser.wait("!!document.querySelector('.habit-progress-table')");
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.habit-progress-table tbody tr').length",
        ),
        3,
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('.habit-progress-table thead th').length",
        ),
        8,
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.habit-day-mark.achieved').length"),
        control.habitOutcomes.filter((row) => row.status === 'achieved').length,
      );
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-progress-7-390.png'));
      const reports = control.calls.filter((call) => call.startsWith('GET habit-report')).length;
      await browser.click('Hôm nay', '.habit-tabs button');
      await browser.click('Tiến bộ', '.habit-tabs button');
      assert.equal(
        control.calls.filter((call) => call.startsWith('GET habit-report')).length,
        reports,
        'Cached progress needs no new report request',
      );
      await browser.click('30 ngày', '.habit-progress-toolbar button');
      await browser.wait("document.querySelectorAll('.habit-rate').length===3");
      assert.match(
        await browser.evaluate("document.querySelector('.habit-rate .hint').textContent"),
        /[34]\/7 ngày/,
      );
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-progress-30-390.png'));
      await browser.click('Hôm nay', '.habit-tabs button');
      await browser.tap('.habit-check');
      await browser.wait("!!document.querySelector('#toast .notice-action')");
      control.habits.day.day++;
      control.habits.day.endAt += 86400000;
      await browser.tap('[data-tab=today]');
      await browser.tap('[data-tab=habits]');
      await browser.wait("!document.querySelector('.feature-updating')");
      const beforeClosedUndo = control.posts.length;
      await browser.tap('#toast .notice-action');
      assert.equal(
        control.posts.length,
        beforeClosedUndo,
        'Undo cannot edit a closed operating day',
      );
      await browser.tap('[aria-label="Thêm thói quen"]');
      await browser.click('Thời lượng', '.habit-choices button');
      await browser.evaluate("document.querySelector('[name=target]').value='35.5'");
      await browser.click('Số lượng', '.habit-choices button');
      await browser.evaluate(
        "document.querySelector('[name=target]').value='9';document.querySelector('[name=unit]').value='ly'",
      );
      await browser.click('Thời lượng', '.habit-choices button');
      assert.equal(await browser.evaluate("document.querySelector('[name=target]').value"), '35.5');
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelector('.habit-choices').children].filter(node=>node.getAttribute('aria-pressed')==='true').map(node=>node.dataset.value)",
        ),
        ['duration'],
      );
      await browser.click('X ngày/tuần', '.habit-choices button');
      await browser.evaluate("document.querySelector('.habit-form input[min=\"1\"]').value='0'");
      await browser.click('Hằng ngày', '.habit-choices button');
      await browser.evaluate(
        "document.querySelector('[name=name]').value='Đọc buổi sáng';document.querySelector('.habit-form-fields').scrollTop=9999",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.habit-form').checkValidity()"),
        true,
        'Inactive fields cannot block a valid draft',
      );
      assert.equal(
        await browser.evaluate(
          "(() => {const r=document.querySelector('.habit-form-footer button[type=submit]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()",
        ),
        true,
      );
      if (process.env.UI_SCREENSHOT_DIR) {
        await browser.evaluate("document.querySelector('.habit-form-fields').scrollTop=0");
        await browser.evaluate('new Promise(resolve=>setTimeout(resolve,300))');
        await browser.screenshot(join(process.env.UI_SCREENSHOT_DIR, 'habit-composer-390.png'));
      }
      await browser.tap('[data-sheet-close]');
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'habit mobile flow creates three cadences, edits quantity without duplicate rewards and preserves fixed modal controls',
  { skip: !browserBin, timeout: 90000 },
  async () => {
    const control = fixture(),
      server = await serve(control),
      original = clone(control.state.account),
      tasks = clone(control.state.tasks);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.tap('[data-tab=habits]');
      await browser.wait(
        "document.querySelector('.habits-page') && !document.querySelector('[aria-busy=true]')",
      );
      const create = async (name, metric, cadence) => {
        await browser.tap('[aria-label="Thêm thói quen"]');
        await browser.evaluate(
          `(() => { const f=document.querySelector('.habit-form'); const inputs=f.querySelectorAll('input'); inputs[0].value=${JSON.stringify(name)}; const selects=f.querySelectorAll('select'); selects[0].value=${JSON.stringify(metric)}; selects[0].dispatchEvent(new Event('change')); if(${JSON.stringify(metric)}!=='check') inputs[1].value='20'; selects[1].value=${JSON.stringify(cadence)}; selects[1].dispatchEvent(new Event('change')); f.requestSubmit(); })()`,
        );
        await browser.wait(
          "!document.querySelector('#sheet').open && !document.querySelector('#content button:disabled')",
        );
        await browser.wait(
          `document.querySelector('.habit-list')?.innerText.includes(${JSON.stringify(name)})`,
        );
      };
      await create('Thiền', 'check', 'daily');
      await create('Đọc sách', 'duration', 'weekly');
      await create('Đi bộ', 'check', 'weekdays');
      assert.equal(control.habits.habits.length, 3);
      assert.deepEqual(
        control.habits.habits.map((view) => view.definition.cadence.kind),
        ['daily', 'weekly', 'weekdays'],
      );
      await browser.evaluate("document.querySelector('.habit-card .habit-check').click()");
      await browser.wait(
        "document.querySelector('.habit-check')?.getAttribute('aria-pressed')==='true'",
      );
      assert.equal(control.habits.habits[0].log.value, 100);
      await browser.tap('.habit-log-button');
      await browser.evaluate(
        "document.querySelector('.habit-form input[type=number]').value='15';document.querySelector('.habit-form input[type=text]').value='<img src=x onerror=alert(1)>';document.querySelector('.habit-form').requestSubmit()",
      );
      await browser.wait("!document.querySelector('#sheet').open");
      assert.equal(control.habits.habits[1].log.value, 1500);
      assert.equal(control.habits.habits[1].preview.successes, 0);
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.habit-note img').length"),
        0,
      );
      await browser.click('Đọc sách', '.habit-name');
      await browser.wait("!!document.querySelector('.habit-detail')");
      assert.equal(
        await browser.evaluate("document.querySelector('.habit-note').textContent"),
        '<img src=x onerror=alert(1)>',
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.habit-note img').length"),
        0,
      );
      await browser.click('Xếp thời gian', '.habit-detail button');
      await browser.evaluate(
        "document.querySelector('.habit-form input[type=time]').value='12:00';document.querySelector('.habit-form input[type=number]').value='20';document.querySelector('.habit-form').requestSubmit()",
      );
      await browser.wait("!document.querySelector('#sheet').open");
      assert.equal(control.habits.habits[1].slot.minutes, 20);
      assert.equal(control.habits.habits[1].slot.startAt, Date.parse('2026-10-05T12:00:00+07:00'));
      await browser.tap('[data-tab=today]');
      await browser.wait("!!document.querySelector('.plan-habit')");
      assert.match((await snapshot(browser)).text, /Thói quen đã xếp giờ/);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.plan-habit').innerText.includes('Đọc sách') && document.querySelector('.plan-habit').innerText.includes('12:00–12:20')",
        ),
        true,
      );
      for (const width of [390, 320]) {
        await browser.resize(width, 844);
        assert.equal((await snapshot(browser)).overflow, false);
        await browser.evaluate(
          "document.querySelector('.plan-habits').scrollIntoView({block:'center'})",
        );
        if (process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(
              /\.png$/,
              '-habit-today-' + width + '.png',
            ),
          );
      }
      await browser.evaluate("document.querySelector('.plan-habit').click()");
      await browser.wait("document.querySelectorAll('.habit-card').length===3");
      for (const width of [390, 320, 1440]) {
        await browser.resize(width, 844);
        assert.equal((await snapshot(browser)).overflow, false);
        if (process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-habits-' + width + '.png'),
          );
      }
      await browser.resize(320, 460);
      await browser.evaluate("document.querySelector('.habit-card .habit-name').click()");
      await browser.click('Chỉnh thói quen');
      await browser.evaluate("document.querySelector('.habit-form').scrollTop=9999");
      assert.equal(
        await browser.evaluate(
          "(() => {const r=document.querySelector('[data-sheet-close]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()",
        ),
        true,
      );
      await browser.tap('[data-sheet-close]');
      await browser.click('Lịch sử & báo cáo', '#content button');
      await browser.wait("!!document.querySelector('.habit-history-tools')");
      await browser.wait("!!document.querySelector('.habit-report')");
      await browser.resize(390, 844);
      if (process.env.WEB_TEST_SCREENSHOT_PATH)
        await browser.screenshot(
          process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-habit-report.png'),
        );
      // Capture the actual download Blob; do not create files outside this
      // localhost browser fixture or substitute a hand-built export payload.
      await browser.evaluate(
        'window.exportBlob=null;window.exportFilename=null;const originalCreate=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exportBlob=blob;return originalCreate(blob)};HTMLAnchorElement.prototype.click=function(){window.exportFilename=this.download}',
      );
      const writes = control.posts.length;
      await browser.click('Xuất dữ liệu');
      await browser.click('Tải JSON');
      await browser.wait('!!window.exportBlob');
      const exported = JSON.parse(await browser.evaluate('window.exportBlob.text()'));
      assert.equal(exported.format, 'assistant-habits');
      assert.equal(exported.version, 1);
      assert.equal(exported.valueScale, 100);
      assert.equal(exported.range.to, control.habits.day.day);
      assert.equal(exported.habits.length, 3);
      assert.ok(
        exported.history.some(
          (row) => row.value === 1500 && row.note === '<img src=x onerror=alert(1)>',
        ),
      );
      assert.equal('account' in exported, false);
      assert.equal('tasks' in exported, false);
      assert.equal(await browser.evaluate("window.exportFilename.endsWith('.json')"), true);
      assert.equal(control.posts.length, writes, 'Export cannot mutate any habit or shared reward');
      assert.deepEqual(control.state.account, original);
      assert.deepEqual(control.state.tasks, tasks);
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'settings keep the title and close button visible when scrolling and when the viewport shrinks',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      for (const width of [320, 390, 1440]) {
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('#settings').click()");
        await browser.wait("!!document.querySelector('.settings-sheet-body')");
        const layout = await browser.evaluate(`(async () => {
                const sheet=document.querySelector('#sheet'),body=sheet.querySelector('.settings-sheet-body'),header=sheet.querySelector('.sheet-title-row'),close=sheet.querySelector('[data-sheet-close]');
                const before=header.getBoundingClientRect().top;
                body.scrollTop=body.scrollHeight;
                await new Promise(requestAnimationFrame);
                const rect=close.getBoundingClientRect(),sheetRect=sheet.getBoundingClientRect();
                return {scrolled:body.scrollTop>0,headerStayed:Math.abs(before-header.getBoundingClientRect().top)<1,
                    outerStayed:sheet.scrollTop===0,closeVisible:rect.top>=sheetRect.top&&rect.bottom<=sheetRect.bottom,
                    closeReachable:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.closest('[data-sheet-close]')===close,
                    bounded:sheetRect.top>=0&&sheetRect.bottom<=innerHeight+1,overflow:body.scrollWidth>body.clientWidth+1};
            })()`);
        assert.deepEqual(
          layout,
          {
            scrolled: true,
            headerStayed: true,
            outerStayed: true,
            closeVisible: true,
            closeReachable: true,
            bounded: true,
            overflow: false,
          },
          width + 'px',
        );
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-settings-scrolled.png'),
          );
        await browser.tap('[data-sheet-close]');
        await browser.wait("!document.querySelector('#sheet').open");
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet').classList.contains('settings-sheet-open')",
          ),
          false,
        );
        await browser.evaluate("document.querySelector('#settings').click()");
        assert.equal(
          await browser.evaluate("document.querySelector('.settings-sheet-body').scrollTop"),
          0,
        );
        // Navigating to another sheet clears the settings layout before rendering it.
        await browser.click('Hướng dẫn nhanh', '#sheet button');
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet').classList.contains('settings-sheet-open')",
          ),
          false,
        );
        assert.equal(
          await browser.evaluate("!!document.querySelector('.settings-sheet-body')"),
          false,
        );
        await browser.tap('[data-sheet-close]');
        await browser.wait("!document.querySelector('#sheet').open");
        if (width === 390) {
          await browser.evaluate("document.querySelector('#settings').click()");
          await browser.resize(width, 430);
          await browser.evaluate(
            "document.querySelector('.settings-sheet-body input[type=number]').focus();document.querySelector('.settings-sheet-body').scrollTop=9999",
          );
          assert.equal(
            await browser.evaluate(
              "(() => { const close=document.querySelector('[data-sheet-close]'),r=close.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('[data-sheet-close]')===close; })()",
            ),
            true,
          );
          await browser.tap('[data-sheet-close]');
          await browser.wait("!document.querySelector('#sheet').open");
        }
        assert.deepEqual(browser.errors, []);
      }
      assert.deepEqual(
        control.posts,
        [],
        'Scrolling and closing settings must not save drafts or mutate sleep',
      );
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);
test(
  'realm protection appears below the rank card before balances and hides when expired',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      server = await serve(control);
    const protectedUntil = now + 72 * 3600000;
    control.state.account.state.protectedUntil = protectedUntil;
    const account = clone(control.state.account);
    let browser;
    try {
      browser = await chrome();
      for (const width of [1440, 390, 320]) {
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
        const layout = await browser.evaluate(`(() => {
                const card=document.querySelector('.rank-card'),note=document.querySelector('.rank-summary>.protection'),balances=document.querySelector('.cultivation-balances');
                const r=card.getBoundingClientRect(),n=note.getBoundingClientRect(),b=balances.getBoundingClientRect();
                return {text:note.textContent,outside:!card.contains(note),below:n.top>=r.bottom,beforeBalances:n.bottom<=b.top,
                    gap:n.top-r.bottom,fits:n.left>=0&&n.right<=innerWidth,share:!!card.querySelector('button')};
            })()`);
        assert.equal(
          layout.text,
          '🛡 Miễn hạ bậc đến ' +
            new Date(protectedUntil).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        );
        assert.equal(layout.outside, true);
        assert.equal(layout.below, true);
        assert.equal(layout.beforeBalances, true);
        assert.equal(layout.gap, 8);
        assert.equal(layout.fits, true);
        assert.equal(layout.share, true);
        assert.equal((await snapshot(browser)).overflow, false);
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH) {
          await browser.evaluate(
            "document.querySelector('.rank-summary').scrollIntoView({block:'center'})",
          );
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-protection.png'),
          );
        }
      }
      assert.deepEqual(control.state.account, account);
      assert.deepEqual(control.posts, []);
      control.state.account.state.protectedUntil = now - 60000;
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      assert.equal(await browser.evaluate("document.querySelectorAll('.protection').length"), 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'settings report sleep and undo with preserved drafts; achievements heading shows the saved daily bedtime on mobile',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      server = await serve(control);
    const tasks = clone(control.state.tasks),
      plan = clone(control.state.dailyPlan),
      focus = { ...control.state.taskFocusTarget, startedAt: now - 1000 };
    control.state.taskFocus = focus;
    let browser;
    try {
      browser = await chrome();
      for (const width of [390, 320]) {
        const beforePosts = control.posts.filter((p) => p.path === 'sleep').length;
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
        const flame = await browser.evaluate("document.querySelector('.flame-card').innerText");
        assert.doesNotMatch(
          flame,
          /Giờ ngủ hôm nay|Chuỗi ngủ đúng giờ|không phải chuỗi điểm danh|chưa báo ngủ/,
        );
        const bedtime = await browser.evaluate(`(() => {
                const header=document.querySelector('.achievements-page>.heading'),line=header.querySelector('.achievement-bedtime'),subtitle=header.querySelector('.subtitle'),rect=line.getBoundingClientRect(),sub=subtitle.getBoundingClientRect();
                return {text:line.textContent,below:rect.top>=sub.bottom,aligned:Math.abs(rect.left-sub.left)<1,fits:rect.left>=0&&rect.right<=innerWidth,count:document.querySelectorAll('.achievement-bedtime').length};
            })()`);
        assert.deepEqual(bedtime, {
          text: 'Giờ ngủ hôm nay · 22:30',
          below: true,
          aligned: true,
          fits: true,
          count: 1,
        });
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-bedtime.png'),
          );
        await browser.evaluate(
          "document.querySelector('[data-tab=today]').click();document.querySelector('#settings').click()",
        );
        await browser.wait("!!document.querySelector('.sleep-report')");
        assert.equal((await snapshot(browser)).overflow, false);
        const fits = await browser.evaluate(
          "[...document.querySelectorAll('.settings-sleep-row>*')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})",
        );
        assert.equal(fits, true);
        await browser.evaluate("document.querySelector('#sheet input[type=time]').value='05:30'");
        await browser.click('Đi ngủ', '.settings-sleep-controls button');
        assert.equal(
          control.posts.filter((p) => p.path === 'sleep').length,
          beforePosts,
          'Opening confirmation is read-only',
        );
        assert.match(
          await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),
          /Đi ngủ bây giờ\?/,
        );
        await browser.click('Để sau', '.settings-sleep-controls button');
        assert.equal(
          await browser.evaluate("document.querySelector('#sheet input[type=time]').value"),
          '05:30',
        );
        await browser.click('Đi ngủ', '.settings-sleep-controls button');
        await browser.click('Đi ngủ', '.sleep-confirm-actions button');
        await browser.wait("!!document.querySelector('.sleep-undo')");
        assert.equal(
          await browser.evaluate("document.querySelector('#sheet input[type=time]').value"),
          '05:30',
          'Reporting sleep preserves the unsaved settings draft',
        );
        assert.equal(control.posts.filter((p) => p.path === 'settings').length, 0);
        assert.equal(control.state.settings.start_minutes, 270);
        const sleeping = await browser.evaluate(
          "document.querySelector('.settings-sleep-controls').innerText",
        );
        assert.match(sleeping, /Đang ngủ · từ 10:00/);
        assert.match(sleeping, /Có thể hủy đến 10:05/);
        assert.doesNotMatch(sleeping, /1 lần|Bấm nhầm/);
        assert.deepEqual(control.state.taskFocus, focus);
        assert.deepEqual(control.state.tasks, tasks);
        assert.deepEqual(control.state.dailyPlan, plan);
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-settings-sleep.png'),
          );
        await browser.click('Hoàn tác', '.settings-sleep-controls button');
        await browser.click('Giữ nguyên', '.settings-sleep-controls button');
        assert.equal(control.state.sleepStatus.asleep, true);
        await browser.click('Hoàn tác', '.settings-sleep-controls button');
        await browser.click('Hoàn tác', '.sleep-confirm-actions button');
        await browser.wait("!!document.querySelector('.sleep-report')");
        assert.equal(control.state.sleepStatus.asleep, false);
        assert.deepEqual(control.state.taskFocus, focus);
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        await browser.wait(
          "document.querySelector('.focus-flip-card')?.getAttribute('aria-pressed')==='true'",
        );
        assert.deepEqual(browser.errors, []);
      }
      assert.deepEqual(
        control.posts.filter((p) => p.path === 'sleep').map((p) => p.input.operation),
        ['report', 'undo', 'report', 'undo'],
        'Second correction is allowed on the same operating day',
      );
      // The heading uses the day's saved target, not an unsaved or future-day setting.
      control.state.settings.sleep_minutes = 1410;
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
      assert.match(
        await browser.evaluate("document.querySelector('.achievements-page>.heading').innerText"),
        /Giờ ngủ hôm nay · 22:30/,
      );
      // Sleep is independent of a separate pause, even when that pause expires.
      Object.assign(control.state, {
        rest: { reason: 'paused', until: now - 1000 },
        resting: true,
        sleepStatus: {
          asleep: true,
          until: control.state.day.end_at,
          reportedAt: now,
          generation: 9,
          canUndo: true,
          undoUntil: now + 300000,
        },
      });
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.rest-state')");
      await browser.evaluate("document.querySelector('#settings').click()");
      assert.match(
        await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),
        /Đang ngủ/,
      );
      await browser.click('Hoàn tác', '.settings-sleep-controls button');
      control.state.sleepStatus.canUndo = false;
      control.sleepError = true;
      await browser.click('Hoàn tác', '.sleep-confirm-actions button');
      await browser.wait(
        "!document.querySelector('.sleep-undo')&&!document.querySelector('.sleep-confirm-actions')",
      );
      assert.match(
        await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),
        /Đang ngủ/,
      );
      control.sleepError = false;
      await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
      // An open settings panel removes undo as its five-minute window expires.
      Object.assign(control.state, {
        rest: { reason: 'asleep', reportedAt: now - 297500, until: control.state.day.end_at },
        resting: true,
        sleepStatus: {
          asleep: true,
          reportedAt: now - 297500,
          generation: 10,
          canUndo: true,
          undoUntil: now + 2500,
        },
      });
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.sleep-card')");
      assert.doesNotMatch(
        await browser.evaluate("document.querySelector('.sleep-card').innerText"),
        /10:00|Nghỉ đến|Đã ghi nhận/,
      );
      await browser.evaluate("document.querySelector('#settings').click()");
      await browser.wait("!!document.querySelector('.sleep-undo')");
      await browser.wait("!document.querySelector('.sleep-undo')");
      assert.doesNotMatch(
        await browser.evaluate("document.querySelector('.settings-sleep-controls').innerText"),
        /Có thể hủy|Hoàn tác/,
      );
      await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
      // Acknowledged report remains visible even when the subsequent refresh fails.
      Object.assign(control.state, {
        rest: { reason: 'active' },
        resting: false,
        sleepStatus: { asleep: false, canUndo: false },
      });
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('#settings').click()");
      await browser.click('Đi ngủ', '.settings-sleep-controls button');
      control.failBootstrap = true;
      await browser.click('Đi ngủ', '.sleep-confirm-actions button');
      await browser.wait(
        "document.querySelector('.settings-sleep-label')?.textContent.startsWith('Đang ngủ')",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.sleep-undo')?.disabled"),
        false,
        'The acknowledged sleep state and undo generation do not depend on optional bootstrap',
      );
      await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
      await browser.wait("!!document.querySelector('.sleep-card')");
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'sleep replaces the focus card without changing tasks or configured reminders and restores focus after wake',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      recorded = now - 60000,
      until = now + 18.5 * 3600000;
    Object.assign(control.state, {
      resting: true,
      rest: { reason: 'asleep', reportedAt: recorded, until },
    });
    control.state.day.asleep_at = recorded;
    control.state.taskFocus = { ...control.state.taskFocusTarget, startedAt: now - 120000 };
    const tasks = clone(control.state.tasks),
      plan = clone(control.state.dailyPlan);
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      for (const width of [1440, 390, 320]) {
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.sleep-card')");
        const view = await browser.evaluate(`(() => {
                const card=document.querySelector('.sleep-card'),rect=card.getBoundingClientRect();
                return {text:card.innerText,interactive:card.querySelectorAll('button,input').length,
                    focus:!!document.querySelector('.focus-flip-card'),rest:!!document.querySelector('.rest-state'),
                    duplicate:[...document.querySelectorAll('#content h2')].filter(node=>node.textContent==='Ngủ ngon nhé').length,
                    fits:rect.left>=0&&rect.right<=innerWidth,height:rect.height,
                    alignment:getComputedStyle(card).textAlign,artHidden:card.querySelector('.sleep-card-seal')?.getAttribute('aria-hidden')==='true',
                    moon:card.querySelector('.sleep-card-seal')?.textContent,role:card.getAttribute('role')};
            })()`);
        assert.match(view.text, /ĐANG NGỦ/);
        assert.match(view.text, /Ngủ ngon nhé/);
        assert.doesNotMatch(view.text, /Đã ghi nhận|Nghỉ đến|09:59|04:30/);
        assert.match(view.text, /Lời nhắc đã đặt vẫn theo lịch/);
        assert.equal(view.interactive, 0);
        assert.equal(view.focus, false);
        assert.equal(view.rest, false);
        assert.equal(view.duplicate, 1);
        assert.equal(view.fits, true);
        assert.equal(view.alignment, 'center');
        assert.equal(view.artHidden, true);
        assert.equal(view.moon, '☾');
        assert.equal(view.role, 'status');
        if (width < 900)
          assert.ok(
            view.height >= 176 && view.height <= 184,
            'The mobile sleep card should match the focus card sizing',
          );
        else
          assert.equal(
            view.height,
            240,
            'The desktop sleep card should match the focus card sizing',
          );
        assert.equal((await snapshot(browser)).overflow, false);
        await browser.click('Danh sách việc');
        assert.ok(await browser.evaluate("!!document.querySelector('.sleep-card')"));
        await browser.click('Lịch hôm nay');
        await browser.click('Chỉnh lịch');
        await browser.wait("!!document.querySelector('.plan-edit-row')");
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        await browser.evaluate("document.querySelector('[data-tab=reminders]').click()");
        assert.match((await snapshot(browser)).text, /lời nhắc đã đặt ở đây vẫn gửi theo lịch/);
        assert.ok(
          (await snapshot(browser)).buttons.some(
            (button) => button.text === '+ Tạo lời nhắc' && !button.disabled,
          ),
        );
        await browser.click('+ Tạo lời nhắc');
        await browser.wait("!!document.querySelector('#sheet form')");
        await browser.evaluate(
          "document.querySelector('[data-sheet-close]').click();document.querySelector('[data-tab=today]').click()",
        );
        assert.deepEqual(browser.errors, []);
        if (width === 390) {
          if (process.env.WEB_TEST_SCREENSHOT_PATH)
            await browser.screenshot(
              process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-sleep.png'),
            );
          await browser.evaluate(
            "(() => { document.querySelector('#settings').click();const theme=document.querySelector('#sheet .form-field select');theme.value='dark';theme.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-sheet-close]').click(); })()",
          );
          await browser.wait(
            "getComputedStyle(document.querySelector('.sleep-card')).color==='rgb(237, 218, 180)'",
          );
          if (process.env.WEB_TEST_SCREENSHOT_PATH)
            await browser.screenshot(
              process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-sleep-dark.png'),
            );
          await browser.evaluate(
            "(() => { document.querySelector('#settings').click();const theme=document.querySelector('#sheet .form-field select');theme.value='light';theme.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-sheet-close]').click(); })()",
          );
          await browser.wait(
            "getComputedStyle(document.querySelector('.sleep-card')).color==='rgb(103, 83, 47)'",
          );
        } else if (process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(
              /\.png$/,
              width === 320 ? '-sleep-small.png' : '-sleep-desktop.png',
            ),
          );
      }
      assert.deepEqual(
        control.posts,
        [],
        'Viewing sleep and opening editors must not mutate focus or reminders',
      );
      assert.deepEqual(control.state.tasks, tasks);
      assert.deepEqual(control.state.dailyPlan, plan);
      Object.assign(control.state, { resting: false, rest: { reason: 'active' }, taskFocus: null });
      control.state.day.asleep_at = null;
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      assert.equal(await browser.evaluate("!!document.querySelector('.sleep-card')"), false);
      await browser.evaluate("document.querySelector('.focus-flip-card').click()");
      await browser.wait(
        "document.querySelector('.focus-flip-card')?.getAttribute('aria-pressed')==='true'",
      );
      assert.equal(control.posts.at(-1).path, 'task-focus');
      assert.equal(control.posts.at(-1).input.operation, 'start');
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'waiting Today separates its setup button from the hint and respects the app theme on mobile',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    control.state.dailyPlan = null;
    control.state.taskFocusTarget = null;
    Object.assign(control.state.day, {
      task_plan_status: 'waiting',
      task_plan_due: now + 91 * 60000,
    });
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      for (const width of [390, 320])
        for (const os of ['light', 'dark'])
          for (const theme of ['light', 'dark']) {
            await browser.colorScheme(os);
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.plan-empty>.primary')");
            await browser.evaluate(
              `document.documentElement.dataset.theme=${JSON.stringify(theme)}`,
            );
            await delay(180); // Allow the button's theme transition to finish before checking its colors.
            const layout = await browser.evaluate(`(() => {
                        const button=document.querySelector('.plan-empty>.primary');
                        const hint=document.querySelector('.plan-empty>.hint');
                        const rect=button.getBoundingClientRect(),style=getComputedStyle(button);
                        const probe=document.createElement('span');
                        probe.style.backgroundColor=getComputedStyle(document.documentElement).getPropertyValue('--accent');
                        document.body.append(probe);
                        const accent=getComputedStyle(probe).backgroundColor;probe.remove();
                        const luminance=color=>{
                            const channels=color.match(/[0-9]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
                            return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
                        };
                        const foreground=luminance(style.color),background=luminance(style.backgroundColor);
                        return {gap:rect.top-hint.getBoundingClientRect().bottom,height:rect.height,color:style.color,
                            background:style.backgroundColor,accent,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05),
                            fits:rect.left>=0&&rect.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1};
                    })()`);
            assert.ok(layout.gap >= 12, 'The button must have space above it');
            assert.ok(layout.height >= 44);
            assert.equal(layout.background, layout.accent, os + ' OS / ' + theme + ' app');
            assert.equal(
              layout.color,
              theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 18, 34)',
            );
            assert.ok(layout.contrast >= 4.5);
            assert.equal(layout.fits, true);
            assert.equal(layout.overflow, false);
            if (
              width === 390 &&
              os === 'dark' &&
              theme === 'light' &&
              process.env.WEB_TEST_SCREENSHOT_PATH
            ) {
              await browser.evaluate(
                "document.querySelector('.today-main').scrollIntoView({block:'start'})",
              );
              await browser.screenshot(
                process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-waiting.png'),
              );
            }
            await browser.click('Xếp thời gian hôm nay');
            await browser.wait("!!document.querySelector('.schedule-form')");
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
            assert.deepEqual(browser.errors, []);
          }
      assert.deepEqual(control.posts, [], 'Opening the time editor must not save a schedule');
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'breakthrough screen shows decreasing realm odds, delayed capped failure bonuses and every charm boost',
  { skip: !browserBin, timeout: 120000 },
  async () => {
    const control = fixture();
    Object.assign(control.state.account.state, { qi: 3000, streak: 45 });
    Object.assign(control.state.account.state.inventory, {
      basic: 1,
      middle: 1,
      high: 1,
      supreme: 1,
    });
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      const cases = [65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15].map((base, rank) => ({
        rank,
        failures: 0,
        base,
      }));
      cases.push(
        ...[60, 60, 65, 70, 75, 75, 75].map((base, failures) => ({ rank: 1, failures, base })),
      );
      cases.push({ rank: 0, failures: 4, base: 80 }, { rank: 10, failures: 4, base: 30 });
      for (const { rank, failures, base } of cases) {
        Object.assign(control.state.account.state, { rank, highestRank: rank, failures });
        await browser.navigate(server.url, 390);
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
        await browser.click('Đột phá');
        await browser.wait("!!document.querySelector('#sheet select')");
        const options = await browser.evaluate(
          "[...document.querySelectorAll('#sheet select option')].map(option=>option.textContent)",
        );
        assert.deepEqual(options, [
          'Không dùng phù',
          'Sơ cấp · +5 điểm %',
          'Trung cấp · +10 điểm %',
          'Cao cấp · +20 điểm %',
          'Cực phẩm · +25 điểm %',
        ]);
        const description = () =>
          browser.evaluate(
            "[...document.querySelectorAll('#sheet .hint')].find(node=>node.textContent.startsWith('Lần này có ')).textContent",
          );
        assert.ok((await description()).startsWith('Lần này có ' + base + '%'));
        assert.match(
          await description(),
          /Tỷ lệ cơ bản lên .+: (65|60|55|50|45|40|35|30|25|20|15)%/,
        );
        assert.match(
          await description(),
          /Thất bại 1 lần chưa cộng; 2\/3\/4 lần liên tiếp cộng 5\/10\/15 điểm %/,
        );
        assert.match(await description(), /tối đa \+15 điểm %/);
        assert.doesNotMatch(await description(), /chắc chắn thành công/);
        for (const [key, boost] of [
          ['basic', 5],
          ['middle', 10],
          ['high', 20],
          ['supreme', 25],
        ]) {
          await browser.evaluate(
            `(() => { const select=document.querySelector('#sheet select');select.value=${JSON.stringify(key)};select.dispatchEvent(new Event('change')); })()`,
          );
          assert.ok(
            (await description()).startsWith('Lần này có ' + Math.min(100, base + boost) + '%'),
          );
        }
        assert.equal((await snapshot(browser)).overflow, false);
        assert.deepEqual(browser.errors, []);
      }
      assert.deepEqual(control.posts, [], 'Reading odds must not attempt a breakthrough');
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'Today keeps every session visible and distinguishes work remaining from the deadline',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    const at = (time) => Date.parse('2026-10-05T' + time + ':00+07:00');
    const windows = [
      { start: at('07:10'), end: at('09:10') },
      { start: at('09:20'), end: at('10:38') },
      { start: at('12:30'), end: at('14:30') },
    ];
    Object.assign(control.state.tasks[0], {
      title: 'Ôn kiểm tra tài trợ khởi nghiệp',
      remaining_minutes: 360,
      actual_minutes: 0,
      deadline: '2026-10-05T13:00:00+07:00',
    });
    Object.assign(control.state.tasks[1], {
      title: 'Ôn code quản trị rr',
      remaining_minutes: 240,
      actual_minutes: 0,
      deadline: '2026-10-06T09:00:00+07:00',
    });
    Object.assign(control.state.tasks[2], {
      remaining_minutes: null,
      actual_minutes: 0,
      deadline: null,
    });
    control.state.dailyPlan.plan.items = [
      {
        taskId: 'task-0',
        minutes: 318,
        remaining: 360,
        actualMinutes: 0,
        scheduledMinutes: 318,
        windows,
      },
      {
        taskId: 'task-1',
        minutes: 120,
        remaining: 240,
        actualMinutes: 0,
        scheduledMinutes: 120,
        windows: [{ start: at('20:00'), end: at('22:00') }],
      },
      {
        taskId: 'task-2',
        minutes: 30,
        remaining: null,
        actualMinutes: 0,
        scheduledMinutes: 0,
        windows: [],
      },
    ];
    control.state.dailyPlan.plan.planned = 468;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      for (const width of [1440, 390, 320]) {
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.plan-position')");
        const layout = await browser.evaluate(`(() => {
                const row = document.querySelector('.daily-item');
                const slots = [...row.querySelectorAll('.session-window')];
                const active = row.querySelector('.session-window.is-current');
                const rect = active.getBoundingClientRect();
                return {
                    windows: slots.map(slot => slot.textContent),
                    visible: slots.every(slot => { const box=slot.getBoundingClientRect();return box.width>0 && box.left>=0 && box.right<=innerWidth; }),
                    past: row.querySelectorAll('.session-window.is-past').length,
                    current: row.querySelectorAll('.session-window.is-current').length,
                    marked: active.getAttribute('aria-current') === 'time',
                    highlighted: getComputedStyle(active).backgroundColor !== 'rgba(0, 0, 0, 0)' && rect.height>0,
                    metrics: [...row.querySelectorAll('.task-metric')].map(line => line.textContent),
                    today: row.innerText.includes('Hôm nay: 5 giờ 18 phút'),
                    done: row.querySelector('.check').checked,
                    position: document.querySelector('.plan-position').textContent
                };
            })()`);
        assert.deepEqual(layout.windows, ['07:10–09:10', '▶09:20–10:38', '12:30–14:30']);
        assert.equal(
          layout.visible,
          true,
          width + 'px: every session should fit without horizontal scrolling',
        );
        assert.equal(layout.past, 1);
        assert.equal(layout.current, 1);
        assert.equal(layout.marked, true);
        assert.equal(layout.highlighted, true);
        assert.deepEqual(layout.metrics, ['Khối lượng còn lại:6 giờ', 'Đến hạn còn:3 giờ']);
        assert.equal(layout.today, true);
        assert.equal(layout.done, false, 'Elapsed sessions must not complete the task');
        assert.match(
          layout.position,
          /Bây giờ 10:00.*Đến giờ làm · Ôn kiểm tra tài trợ khởi nghiệp/,
        );
        assert.equal((await snapshot(browser)).overflow, false);
        assert.equal(
          await browser.evaluate(
            "document.querySelectorAll('.daily-item')[2].innerText.includes('Chưa có giờ làm') && document.querySelectorAll('.daily-item')[2].innerText.includes('Chưa có hạn')",
          ),
          true,
        );
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH) {
          await browser.evaluate(
            "document.querySelector('.today-main').scrollIntoView({block:'start'})",
          );
          await browser.screenshot(process.env.WEB_TEST_SCREENSHOT_PATH);
        }
        await browser.click('Danh sách việc');
        assert.deepEqual(
          await browser.evaluate(
            "[...document.querySelector('.task-row .task-metrics').children].map(line=>line.textContent)",
          ),
          layout.metrics,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.task-row.is-current .session-window.is-current').getAttribute('aria-current')",
          ),
          'time',
        );
        assert.equal((await snapshot(browser)).overflow, false);
      }
      // The same plan moves from a gap into a later session, with no automatic completion.
      for (const [time, current, past, next] of [
        ['09:10', false, 1, 'Sắp tới 09:20'],
        ['10:38', false, 2, 'Sắp tới 12:30'],
        ['12:30', true, 2, 'Đến giờ làm'],
        ['14:30', false, 3, 'Sắp tới 20:00'],
      ]) {
        control.state.now = at(time);
        await browser.navigate(server.url, 320);
        await browser.wait("!!document.querySelector('.plan-position')");
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.daily-item').classList.contains('is-current')",
          ),
          current,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.daily-item').querySelectorAll('.session-window.is-past').length",
          ),
          past,
        );
        assert.equal(
          await browser.evaluate("document.querySelector('.daily-item .check').checked"),
          false,
        );
        assert.ok(
          (await browser.evaluate("document.querySelector('.plan-position').textContent")).includes(
            next,
          ),
        );
      }
      assert.equal(
        await browser.evaluate("document.querySelector('.daily-item .task-deadline').textContent"),
        'Quá hạn:2 giờ',
      );
      control.state.now = at('10:00');
      control.state.tasks[0].status = 'completed';
      control.state.tasks[0].completed_at = at('09:55');
      for (const width of [390, 320]) {
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.plan-position')");
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.daily-plan>.daily-list').querySelectorAll('.daily-item.done').length",
          ),
          0,
        );
        assert.equal(
          await browser.evaluate("document.querySelector('.completed-today').open"),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.completed-today .daily-item').checkVisibility()",
          ),
          false,
        );
        assert.ok(
          (await browser.evaluate("document.querySelector('.plan-position').textContent")).includes(
            'Sắp tới 20:00',
          ),
        );
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH) {
          await browser.evaluate(
            "document.querySelector('.today-main').scrollIntoView({block:'start'})",
          );
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-completed.png'),
          );
        }
        await browser.click('Xem việc đã xong (1)', 'summary');
        assert.equal(
          await browser.evaluate("document.querySelector('.completed-today .check').checked"),
          true,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.completed-today').querySelectorAll('.session-window.is-current').length",
          ),
          0,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.completed-today .daily-item').checkVisibility()",
          ),
          true,
        );
        await browser.evaluate(
          "document.querySelector('.completed-today .daily-item-open').click()",
        );
        await browser.wait("!!document.querySelector('#task-sheet-form')");
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        assert.equal((await snapshot(browser)).overflow, false);
        await browser.click('Danh sách việc');
        assert.equal(
          await browser.evaluate("document.querySelector('.completed-today').open"),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.task-list-section>.task-board').querySelectorAll('.task-row.done').length",
          ),
          0,
        );
        await browser.click('Xem việc đã xong (1)', 'summary');
        assert.equal(
          await browser.evaluate(
            "document.querySelector('.completed-today .task-row').checkVisibility()",
          ),
          true,
        );
        assert.equal((await snapshot(browser)).overflow, false);
      }
      assert.deepEqual(browser.errors, []);
      assert.deepEqual(control.posts, [], 'Presentation must not write progress or completion');
      // Reopening a completed task uses the existing confirmation and returns it to the plan.
      await browser.evaluate("document.querySelector('.completed-today .check').click()");
      await browser.click('Xác nhận');
      await browser.wait(
        "!document.querySelector('#sheet').open&&!document.querySelector('.completed-today')",
      );
      assert.equal(control.state.tasks[0].status, 'active');
      await browser.click('Lịch hôm nay');
      assert.equal(
        await browser.evaluate(
          "document.querySelector('.daily-plan>.daily-list .daily-item.is-current .check').checked",
        ),
        false,
      );
      assert.equal(control.posts.length, 1);
      assert.equal(control.posts[0].input.complete, false);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'plan editor reorders only unfinished tasks and preserves completed minutes when saving',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture();
    Object.assign(control.state.tasks[1], { status: 'completed', completed_at: now - 60000 });
    control.state.dailyPlan.plan.items = [
      { taskId: 'task-0', minutes: 90, windows: [] },
      { taskId: 'task-1', minutes: 80, windows: [] },
      { taskId: 'task-2', minutes: 60, windows: [] },
    ];
    control.state.dailyPlan.plan.planned = 230;
    const server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      const order = () =>
        browser.evaluate(
          "[...document.querySelectorAll('#sheet .plan-edit-row')].map(row=>row.dataset.taskId)",
        );
      for (const width of [390, 320]) {
        await browser.navigate(server.url, width);
        await browser.wait("!!document.querySelector('.daily-plan')");
        await browser.click('Chỉnh lịch');
        assert.deepEqual(await order(), ['task-0', 'task-2']);
        assert.equal(
          await browser.evaluate("document.querySelector('.plan-completed-summary').textContent"),
          'Đã xong 1 việc',
        );
        assert.equal(
          await browser.evaluate("!!document.querySelector('#sheet [data-task-id=task-1]')"),
          false,
        );
        assert.equal(
          await browser.evaluate(
            'document.querySelector(\'#sheet [aria-label="Đưa lên"]\').disabled',
          ),
          true,
        );
        assert.equal(
          await browser.evaluate(
            '[...document.querySelectorAll(\'#sheet [aria-label="Đưa xuống"]\')].at(-1).disabled',
          ),
          true,
        );
        await browser.evaluate(
          "document.querySelector('#sheet [data-task-id=task-0] input').value='45';document.querySelector('#sheet [data-task-id=task-0] [aria-label=\"Đưa xuống\"]').click()",
        );
        assert.deepEqual(await order(), ['task-2', 'task-0']);
        assert.equal(
          await browser.evaluate(
            "document.querySelector('#sheet [data-task-id=task-0] input').value",
          ),
          '45',
        );
        await browser.evaluate(
          'document.querySelector(\'#sheet [data-task-id=task-0] [aria-label="Đưa lên"]\').click()',
        );
        assert.deepEqual(await order(), ['task-0', 'task-2']);
        assert.equal((await snapshot(browser)).overflow, false);
        if (width === 390 && process.env.WEB_TEST_SCREENSHOT_PATH)
          await browser.screenshot(
            process.env.WEB_TEST_SCREENSHOT_PATH.replace(/\.png$/, '-plan-editor.png'),
          );
        await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
      }
      await browser.click('Chỉnh lịch');
      await browser.evaluate(
        "[...document.querySelectorAll('#sheet [data-task-id=task-0] button')].find(button=>button.textContent==='Để hôm khác').click()",
      );
      assert.deepEqual(await order(), ['task-2']);
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet form').innerText.includes('140 phút đã chọn')",
        ),
        true,
      );
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('.plan-picker option')].map(option=>option.value)",
        ),
        ['task-0'],
      );
      await browser.click('+ Thêm vào hôm nay');
      assert.deepEqual(await order(), ['task-2', 'task-0']);
      await browser.evaluate(
        "document.querySelector('#sheet [data-task-id=task-0] input').value='70'",
      );
      await browser.click('Lưu kế hoạch hôm nay');
      await browser.wait(
        "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled",
      );
      assert.deepEqual(control.posts.at(-1).input.items, [
        { taskId: 'task-1', minutes: 80 },
        { taskId: 'task-2', minutes: 60 },
        { taskId: 'task-0', minutes: 70 },
      ]);
      assert.equal(
        control.state.dailyPlan.plan.items.reduce((sum, item) => sum + item.minutes, 0),
        210,
      );
      assert.equal(control.state.tasks[1].status, 'completed');
      // An entirely completed plan has no editable fields and still saves its recorded totals.
      control.state.tasks.forEach((task) =>
        Object.assign(task, { status: 'completed', completed_at: now }),
      );
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.daily-plan')");
      await browser.click('Chỉnh lịch');
      assert.deepEqual(await order(), []);
      assert.equal(
        await browser.evaluate("document.querySelectorAll('#sheet [data-plan-minutes]').length"),
        0,
      );
      assert.equal(
        await browser.evaluate("document.querySelector('.plan-completed-summary').textContent"),
        'Đã xong 3 việc',
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet form').innerText.includes('210 phút đã chọn')",
        ),
        true,
      );
      await browser.click('Lưu kế hoạch hôm nay');
      await browser.wait("!document.querySelector('#sheet').open");
      assert.equal(
        control.posts.at(-1).input.items.reduce((sum, item) => sum + item.minutes, 0),
        210,
      );
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'motion preferences survive retired game settings and reload without writes or lost settings drafts',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const control = fixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate(
        "localStorage.setItem('minh-anh-experience',JSON.stringify({gameVisible:false,gameGuideDismissed:false,motion:'system'}))",
      );
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      const writes = control.posts.length;
      assert.deepEqual(
        await browser.evaluate(
          "[...document.querySelectorAll('[data-tab]')].map(button=>button.dataset.tab)",
        ),
        ['today', 'habits', 'reminders', 'beasts', 'achievements'],
      );
      await browser.evaluate(
        "document.querySelector('#settings').click();document.querySelector('#sheet input[type=time]').value='06:00';document.querySelector('#sheet input[type=time]').dispatchEvent(new Event('input'));const select=document.querySelector('.settings-experience select');select.value='reduce';select.dispatchEvent(new Event('change'))",
      );
      assert.equal(
        await browser.evaluate("document.querySelector('#sheet input[type=time]').value"),
        '06:00',
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('.settings-experience select').length"),
        1,
      );
      assert.equal(await browser.evaluate('document.documentElement.dataset.motion'), 'reduce');
      assert.equal(
        await browser.evaluate(
          "getComputedStyle(document.querySelector('.focus-flip-card')).transitionDuration",
        ),
        '0s',
      );
      await browser.evaluate(
        "document.querySelector('.settings-sheet-body').scrollTop=document.querySelector('.settings-sheet-body').scrollHeight",
      );
      if (process.env.UI_SCREENSHOT_DIR)
        await browser.screenshot(
          join(process.env.UI_SCREENSHOT_DIR, 'cleanup-motion-settings-320-light.png'),
        );
      await browser.navigate(server.url, 320);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      assert.equal(await browser.evaluate('document.documentElement.dataset.motion'), 'reduce');
      assert.equal((await snapshot(browser)).overflow, false);
      assert.equal(control.posts.length, writes);
      assert.ok(!control.calls.some((call) => /\b(game|battle|practice)/.test(call)));
      assert.deepEqual(browser.errors, []);
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);

test(
  'real browser preserves desktop/mobile UI and feature flows',
  { skip: !browserBin, timeout: 120000 },
  async (t) => {
    const control = fixture(),
      server = await serve(control);
    let browser;
    try {
      browser = await chrome();
      await t.test(
        'desktop and mobile layouts, stable Today switching and bounded reward sheet',
        async () => {
          for (const width of [1440, 390, 320]) {
            await browser.navigate(server.url, width);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            assert.equal((await snapshot(browser)).overflow, false);
            await browser.evaluate(
              "globalThis.frameBefore=document.querySelector('.focus-flip-card');globalThis.frameTop=frameBefore.getBoundingClientRect().top",
            );
            await browser.click('Danh sách việc');
            await browser.wait("!!document.querySelector('.task-list-section')");
            assert.equal(
              await browser.evaluate(
                "frameBefore===document.querySelector('.focus-flip-card')&&Math.abs(frameTop-frameBefore.getBoundingClientRect().top)<1",
              ),
              true,
            );
            await browser.click('Lịch hôm nay');
            await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
            await browser.wait("!!document.querySelector('.checkin-calendar-link')");
            assert.equal(
              await browser.evaluate("document.querySelectorAll('.reward-cell').length"),
              0,
            );
            await browser.evaluate("document.querySelector('.checkin-calendar-link').click()");
            await browser.wait("document.querySelectorAll('.reward-cell').length===30");
            const layout = await browser.evaluate(
              "(() => { const sheet=document.querySelector('#sheet'),calendar=document.querySelector('.checkin-calendar-content');const header=document.querySelector('.sheet-title-row');const before=header.getBoundingClientRect().top;calendar.scrollTop=calendar.scrollHeight;return {bounded:sheet.getBoundingClientRect().bottom<=innerHeight+1,header:Math.abs(before-header.getBoundingClientRect().top)<1,scroll:calendar.scrollTop>0};})()",
            );
            assert.deepEqual(layout, { bounded: true, header: true, scroll: true });
            await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
            assert.deepEqual(browser.errors, []);
          }
        },
      );
      await t.test(
        'task estimate, subtask deletion, creation and reminder editor use the same interactions',
        async () => {
          await browser.navigate(server.url);
          await browser.wait("!!document.querySelector('.daily-item-open')");
          await browser.evaluate("document.querySelector('.daily-item-open').click()");
          await browser.wait("!!document.querySelector('.remaining-editor input[type=number]')");
          await browser.evaluate(
            "const input=document.querySelector('.remaining-editor input[type=number]');input.value='75';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#task-sheet-form').requestSubmit()",
          );
          await browser.wait("!document.querySelector('#sheet').open");
          assert.equal(control.state.tasks[0].remaining_minutes, 75);
          await browser.evaluate("document.querySelector('.daily-item-open').click()");
          await browser.wait("!!document.querySelector('.step-delete')");
          await browser.evaluate("document.querySelector('.step-delete').click()");
          await browser.click('Xác nhận');
          await browser.wait("!document.querySelector('#sheet').open");
          await browser.wait("!document.querySelector('[data-tab=reminders]').disabled");
          for (
            let attempt = 0;
            attempt < 50 && control.state.tasks[0].steps.length !== 2;
            attempt++
          )
            await delay(20);
          assert.equal(control.state.tasks[0].steps.length, 2);
          await browser.evaluate("document.querySelector('[data-tab=reminders]').click()");
          await browser.wait("!!document.querySelector('.top-create')");
          await browser.click('+ Tạo lời nhắc');
          await browser.wait("document.querySelector('#sheet').open");
          await browser.evaluate(
            "document.querySelector('#sheet input[type=text]').value='Nhắc kiểm thử';document.querySelector('#sheet form').requestSubmit()",
          );
          await browser.wait("!document.querySelector('#sheet').open");
          assert.equal(control.state.reminders.at(-1).title, 'Nhắc kiểm thử');
          await browser.evaluate("document.querySelector('[data-tab=today]').click()");
          await browser.wait("!!document.querySelector('.focus-flip-card')");
          await browser.click('Danh sách việc');
          await browser.click('+ Tạo task');
          await browser.wait("!!document.querySelector('#task-sheet-form')");
          await browser.evaluate(
            "document.querySelector('#task-sheet-form input[type=text]').value='Task mới kiểm thử';document.querySelector('#task-sheet-form').requestSubmit()",
          );
          await browser.wait("!document.querySelector('#sheet').open");
          assert.equal(control.state.tasks.at(-1).title, 'Task mới kiểm thử');
          assert.deepEqual(browser.errors, []);
        },
      );
      await t.test(
        'focus, checkin and reward mutations avoid unnecessary history reads',
        async () => {
          await browser.navigate(server.url);
          await browser.wait("!!document.querySelector('.focus-flip-card')");
          control.calls.length = 0;
          await browser.evaluate("document.querySelector('.focus-flip-card').click()");
          await browser.wait("!!document.querySelector('.focus-flip-card.is-focused')");
          assert.ok(control.state.taskFocus);
          assert.equal(control.calls.filter((c) => c.includes('history')).length, 0);
          await browser.evaluate("document.querySelector('.focus-flip-card').click()");
          await browser.wait("!document.querySelector('.focus-flip-card.is-focused')");
          await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
          await browser.wait("!!document.querySelector('.checkin-claim')");
          await browser.evaluate("document.querySelector('.checkin-claim').click()");
          await browser.wait("document.querySelector('.checkin-claim').disabled");
          assert.equal(control.state.account.state.checkin.count, 1);
          assert.deepEqual(browser.errors, []);
        },
      );
      await t.test(
        'work progress, day plan, availability and settings keep their existing editors',
        async () => {
          await browser.navigate(server.url);
          await browser.wait("!!document.querySelector('.daily-item-open')");
          await browser.evaluate("document.querySelector('.daily-item-open').click()");
          await browser.click('Đã làm hôm nay');
          await browser.evaluate(
            "(() => {const input=document.querySelector('.work-minutes');input.value='25';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#task-sheet-form').requestSubmit();})()",
          );
          await browser.wait(
            "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled",
          );
          assert.equal(control.state.tasks[0].actual_minutes, 25);
          await browser.click('Chỉnh lịch');
          await browser.wait("!!document.querySelector('[data-plan-minutes]')");
          await browser.evaluate(
            "(() => {const input=document.querySelector('[data-plan-minutes]');input.value='60';document.querySelector('#sheet form').requestSubmit();})()",
          );
          await browser.wait(
            "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled",
          );
          assert.equal(control.state.dailyPlan.plan.items[0].minutes, 60);
          await browser.click('Giờ bận/rảnh');
          await browser.wait("!!document.querySelector('.schedule-form')");
          await browser.evaluate("document.querySelector('.schedule-form').requestSubmit()");
          await browser.wait(
            "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled",
          );
          assert.equal(control.posts.at(-1).path, 'schedule');
          await browser.evaluate("document.querySelector('#settings').click()");
          await browser.wait("!!document.querySelector('#sheet input[type=number]')");
          await browser.evaluate(
            "document.querySelector('#sheet input[type=number]').value='240';document.querySelector('#sheet form').requestSubmit()",
          );
          await browser.wait(
            "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled",
          );
          assert.equal(control.state.settings.auto_plan_delay_minutes, 240);
          assert.deepEqual(browser.errors, []);
        },
      );
      await t.test(
        'draw, fusion, protection and breakthrough remain usable through feature controllers',
        async () => {
          await browser.navigate(server.url);
          await browser.wait("!!document.querySelector('.focus-flip-card')");
          await browser.evaluate("document.querySelector('[data-tab=achievements]').click()");
          await browser.wait("!!document.querySelector('.checkin-claim')");
          const tickets = control.state.account.state.tickets;
          await browser.evaluate(
            "[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Quay thưởng ·')).click()",
          );
          await browser.evaluate('document.querySelector(\'[data-draw-count="1"]\').click()');
          await browser.wait("!!document.querySelector('.mystery-revealed')");
          assert.equal(control.state.account.state.tickets, tickets - 1);
          await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
          await browser.click('Túi vật phẩm');
          await browser.click('Ghép 3 lá · 80%');
          await browser.click('Xác nhận');
          await browser.wait(
            "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=achievements]').disabled",
          );
          assert.equal(control.state.account.state.inventory.middle, 1);
          await browser.click('Túi vật phẩm');
          await browser.evaluate(
            "[...document.querySelectorAll('#sheet button')].find(b=>b.textContent==='Dùng hôm nay').click()",
          );
          await browser.click('Xác nhận');
          await browser.wait(
            "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=achievements]').disabled",
          );
          assert.equal(control.state.account.state.inventory.heart, 0);
          await browser.click('Đột phá');
          await browser.wait("!!document.querySelector('#sheet select')");
          await browser.click('Đột phá', '#sheet button');
          await browser.wait(
            "document.querySelector('#sheet .loot-result').textContent.includes('Đột phá thành công')",
          );
          assert.equal(control.state.account.state.rank, 2);
          assert.deepEqual(browser.errors, []);
          await browser.evaluate("document.querySelector('[data-sheet-close]').click()");
        },
      );
      await t.test(
        'committed save with refresh outage is acknowledged and not repeated',
        async () => {
          await browser.navigate(server.url);
          await browser.wait("!!document.querySelector('.focus-flip-card')");
          const before = control.posts.length;
          control.failBootstrap = true;
          await browser.evaluate("document.querySelector('.focus-flip-card').click()");
          await browser.wait(
            "document.querySelector('#toast .notice-message')?.textContent.includes('Cậu cứ tập trung')",
          );
          assert.equal(control.posts.length, before + 1);
          control.failBootstrap = false;
          await browser.evaluate("document.querySelector('.focus-flip-card').click()");
          await browser.wait("!document.querySelector('.focus-flip-card.is-focused')");
          assert.equal(control.posts.length, before + 2);
          assert.deepEqual(browser.errors, []);
        },
      );
      await t.test('Chrome pairing and logout remain usable without Telegram SDK', async () => {
        control.failBootstrap = false;
        control.authenticated = false;
        await browser.navigate(server.url);
        await browser.wait("!!document.querySelector('.login-card')");
        await browser.click('Lấy mã đăng nhập');
        await browser.wait("!!document.querySelector('.login-command')");
        control.authenticated = true;
        await browser.wait("!!document.querySelector('.focus-flip-card')");
        await browser.evaluate("document.querySelector('#logout').click()");
        await browser.wait("!!document.querySelector('.login-card')");
        assert.equal(control.authenticated, false);
        assert.deepEqual(browser.errors, []);
        control.authenticated = true;
      });
      await t.test(
        'more than200 active tasks remain reachable without loading every task initially',
        async () => {
          const large = fixture(),
            first = large.state.tasks[0];
          large.state.tasks = Array.from({ length: 205 }, (_, i) => ({
            ...clone(first),
            id: 'task-' + i,
            public_code: i + 1,
            title: 'Task ' + (i + 1),
          }));
          const make = large.bootstrap;
          large.bootstrap = () => ({
            ...make(),
            tasks: large.state.tasks.slice(0, 200),
            activeTasksPage: { offset: 200, total: 205, hasMore: true },
          });
          const largeServer = await serve(large);
          try {
            await browser.navigate(largeServer.url);
            await browser.wait("!!document.querySelector('.focus-flip-card')");
            await browser.click('Danh sách việc');
            assert.equal(
              await browser.evaluate("document.querySelectorAll('.task-open').length"),
              200,
            );
            await browser.click('Xem thêm công việc');
            await browser.wait("document.querySelectorAll('.task-open').length===205");
            assert.equal(
              await browser.evaluate(
                "[...document.querySelectorAll('button')].some(b=>b.textContent==='Xem thêm công việc')",
              ),
              false,
            );
            await browser.evaluate("document.querySelector('.task-open').click()");
            await browser.wait("!!document.querySelector('#task-sheet-form')");
            await browser.evaluate(
              "const input=document.querySelector('.remaining-editor input[type=number]');input.value='70';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#task-sheet-form').requestSubmit()",
            );
            await browser.wait(
              "!document.querySelector('#sheet').open&&!document.querySelector('[data-tab=today]').disabled",
            );
            assert.equal(
              await browser.evaluate("document.querySelectorAll('.task-open').length"),
              205,
            );
            assert.deepEqual(browser.errors, []);
          } finally {
            await largeServer.close();
          }
        },
      );
      if (process.env.UI_BASELINE_REF)
        await t.test(
          'current layout matches the approved baseline on all three screens',
          async () => {
            const baselineControl = fixture(),
              baseline = await serve(baselineControl, process.env.UI_BASELINE_REF),
              currentControl = fixture(),
              current = await serve(currentControl);
            try {
              for (const width of [1440, 390])
                for (const tab of ['today', 'reminders', 'achievements']) {
                  const collect = async (url) => {
                    await browser.navigate(url, width);
                    await browser.wait("!!document.querySelector('.focus-flip-card')");
                    if (tab !== 'today')
                      await browser.evaluate(`document.querySelector('[data-tab=${tab}]').click()`);
                    await delay(150);
                    return snapshot(browser);
                  };
                  const old = await collect(baseline.url),
                    updated = await collect(current.url);
                  assert.deepEqual(updated, old, width + 'px / ' + tab);
                  assert.deepEqual(browser.errors, []);
                }
            } finally {
              await baseline.close();
              await current.close();
            }
          },
        );
    } finally {
      if (browser) await browser.close();
      await server.close();
    }
  },
);
