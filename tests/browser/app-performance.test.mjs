import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { browserBin, fixture, serve, chrome } from './app-harness.mjs';

const options = { skip: !browserBin, timeout: 45000 };
async function open(t, count = 3) {
  const control = fixture();
  for (let index = 0; index < count; index++) {
    control.mutate('habits', {
      id: 'performance_seed_' + index,
      operation: 'create',
      definition: {
        name: 'Thói quen ' + index,
        metric: 'check',
        target: 1,
        cadence: { kind: 'daily' },
      },
    });
    control.habits.habits[index].definition.commitmentFrom = control.habits.day.day;
  }
  const server = await serve(control),
    browser = await chrome();
  t.after(async () => {
    await browser.close();
    await server.close();
  });
  await browser.navigate(server.url, 390);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  return { control, browser, server };
}
async function habits(browser, count = 3) {
  await browser.tap('[data-tab=habits]');
  await browser.wait(
    `document.querySelectorAll('.habit-card').length===${count} && !document.querySelector('.feature-updating')`,
  );
}

test(
  'startup fetches bootstrap while the main feature graph is still loading',
  options,
  async (t) => {
    const control = fixture();
    control.staticFiles = new Map([
      [
        'features/linh-thu.js',
        Buffer.from(
          'await new Promise(resolve => setTimeout(resolve, 1400)); window.featureGraphReadyAt=performance.now();\n' +
            (await readFile('web/features/linh-thu.js', 'utf8')),
        ),
      ],
    ]);
    const server = await serve(control),
      browser = await chrome();
    t.after(async () => {
      await browser.close();
      await server.close();
    });
    await browser.navigate(server.url, 390);
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    const timing = await browser.evaluate(`(() => {
    const resources = performance.getEntriesByType('resource');
    return {
      bootstrap: resources.find(r => r.name.endsWith('/api/bootstrap')).startTime,
      feature: window.featureGraphReadyAt,
      effects: resources.filter(r => /\\/beast-(reveal|evolution)\\.js$/.test(r.name)).length,
    };
  })()`);
    assert.ok(timing.bootstrap < timing.feature - 500, JSON.stringify(timing));
    assert.equal(timing.effects, 0, 'Cinematic effects do not belong to initial load');
    assert.equal(control.calls.filter((call) => call === 'GET bootstrap').length, 1);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'early startup waits for one Telegram SDK and consumes its bootstrap once',
  options,
  async (t) => {
    const control = fixture();
    const html = await readFile('web/index.html', 'utf8');
    control.staticFiles = new Map([
      [
        'index.html',
        Buffer.from(
          html.replace(
            '<head>',
            `<head><script>
    history.replaceState(null,'',location.pathname+'#tgWebAppData=fixture');
    window.sdkLoads=0;window.sdkReady=0;window.sdkExpanded=0;
    const append=document.head.append.bind(document.head);
    document.head.append=(node,...rest)=>{
      if(node.src==='https://telegram.org/js/telegram-web-app.js'){
        window.sdkLoads++;
        setTimeout(()=>{
          window.Telegram={WebApp:{initData:'fixture',viewportStableHeight:730,colorScheme:'light',
            onEvent(){},ready(){window.sdkReady++;window.readyHasContent=!!document.querySelector('.focus-flip-card')},expand(){window.sdkExpanded++}}};
          node.onload();
        },150);
      }else append(node,...rest);
    };
  </script>`,
          ),
        ),
      ],
    ]);
    const server = await serve(control),
      browser = await chrome();
    t.after(async () => {
      await browser.close();
      await server.close();
    });
    await browser.navigate(server.url, 390);
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    const result =
      await browser.evaluate(`({loads:window.sdkLoads,ready:window.sdkReady,expanded:window.sdkExpanded,
    viewport:document.documentElement.style.getPropertyValue('--app-viewport-height'),readyHasContent:window.readyHasContent})`);
    assert.deepEqual(result, {
      loads: 1,
      ready: 1,
      expanded: 1,
      viewport: '730px',
      readyHasContent: true,
    });
    assert.equal(control.calls.filter((call) => call === 'GET bootstrap').length, 1);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'early connection errors are shown by the UI and a retry starts a fresh connection',
  options,
  async (t) => {
    const control = fixture();
    control.failBootstrap = true;
    const server = await serve(control),
      browser = await chrome();
    t.after(async () => {
      await browser.close();
      await server.close();
    });
    await browser.navigate(server.url, 390);
    await browser.wait(
      "document.querySelector('#content')?.textContent.includes('Chưa kết nối được')",
    );
    control.failBootstrap = false;
    await browser.click('Thử lại');
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    assert.equal(control.calls.filter((call) => call === 'GET bootstrap').length, 2);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'a delayed cinematic import cannot replace a newer sheet or spend a second ticket',
  options,
  async (t) => {
    const { beastFixture } = await import('./linh-thu-fixture.mjs');
    const control = beastFixture();
    const effect = await readFile('web/ui/beast-reveal.js', 'utf8');
    control.staticFiles = new Map([
      [
        'ui/beast-reveal.js',
        Buffer.from('await new Promise(resolve=>window.releaseRevealModule=resolve);\n' + effect),
      ],
    ]);
    const server = await serve(control),
      browser = await chrome();
    t.after(async () => {
      await browser.close();
      await server.close();
    });
    await browser.navigate(server.url, 390);
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    await browser.tap('[data-tab=beasts]');
    await browser.wait("!!document.querySelector('.beast-hero')");
    await browser.click('Triệu hồi');
    await browser.wait("!!document.querySelector('.beast-summon-banner')");
    const tickets = control.beastData.account.state.summonTickets;
    await browser.evaluate(
      'document.querySelector(\'[aria-label="Triệu hồi ×1 · 1 vé"]\').click()',
    );
    await browser.wait("typeof window.releaseRevealModule==='function'");
    await browser.wait(
      `!document.querySelector('#sheet').open && document.querySelector('.beast-summon-balance strong')?.textContent==='${tickets - 1}'`,
    );
    await browser.tap('#settings');
    const title = await browser.evaluate("document.querySelector('#sheet-title').textContent");
    await browser.evaluate('window.releaseRevealModule()');
    await delay(200);
    assert.equal(
      await browser.evaluate("document.querySelector('#sheet-title').textContent"),
      title,
    );
    assert.equal(await browser.evaluate("document.querySelector('#sheet').open"), true);
    assert.equal(await browser.evaluate("!!document.querySelector('.beast-reveal')"), false);
    assert.equal(control.beastData.account.state.summonTickets, tickets - 1);
    assert.equal(control.posts.filter((post) => post.input.operation === 'summon').length, 1);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'unconfirmed habit receipts survive reload and recover without a second award',
  options,
  async (t) => {
    const { control, browser, server } = await open(t);
    await habits(browser);
    const tickets = control.state.account.state.tickets;
    await browser.evaluate(`(() => {
    const original=fetch;window.fetch=async(url,init)=>{
      const response=await original(url,init);
      if(String(url)==='/api/habits'&&init?.method==='POST')throw Error('RESPONSE_LOST');
      return response;
    };document.querySelector('.habit-check').click();
  })()`);
    await browser.wait("!!document.querySelector('.habit-log-recovery')");
    const pending = await browser.evaluate(
      "JSON.parse(sessionStorage.getItem('minh-anh-habit-pending-v1'))",
    );
    assert.equal(pending.length, 1);
    await browser.navigate(server.url, 390);
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    await habits(browser);
    await browser.wait("!!document.querySelector('.habit-log-recovery')");
    await browser.tap('.habit-log-recovery button');
    await browser.wait("!document.querySelector('.habit-log-recovery')");
    assert.equal(control.state.account.state.tickets, tickets + 1);
    assert.equal(control.posts.filter((post) => post.input.operation === 'log').length, 1);
    assert.equal(
      await browser.evaluate("sessionStorage.getItem('minh-anh-habit-pending-v1')"),
      null,
    );
    assert.deepEqual(browser.errors, []);
  },
);

test('Undo updates the check immediately and saves in the background', options, async (t) => {
  const { control, browser } = await open(t);
  await habits(browser);
  await browser.tap('.habit-check');
  await browser.wait("!!document.querySelector('#toast .notice-action')");
  await browser.evaluate(`(() => {
    const original=fetch;window.fetch=async(url,init)=>{
      if(String(url)==='/api/habits'&&init?.method==='POST')await new Promise(resolve=>window.releaseUndo=resolve);
      return original(url,init);
    };document.querySelector('#toast .notice-action').click();
  })()`);
  await browser.wait("typeof window.releaseUndo==='function'");
  assert.equal(
    await browser.evaluate("document.querySelector('.habit-check').getAttribute('aria-pressed')"),
    'false',
  );
  assert.equal(control.habits.habits[0].log.value, 100);
  await browser.evaluate('window.releaseUndo()');
  await browser.wait(
    "document.querySelector('#toast .notice-message')?.textContent.includes('Đã hoàn tác')",
  );
  assert.equal(control.habits.habits[0].log.value, 0);
  assert.deepEqual(browser.errors, []);
});

test('reload preserves unsent habit intents behind an unconfirmed log', options, async (t) => {
  const { control, browser, server } = await open(t);
  await habits(browser);
  await browser.evaluate(`(() => {
    const original=fetch;window.fetch=async(url,init)=>{
      const response=await original(url,init);
      if(String(url)==='/api/habits'&&init?.method==='POST')await new Promise(resolve=>window.holdFirstLog=resolve);
      return response;
    };
    document.querySelectorAll('.habit-check')[0].click();
    document.querySelectorAll('.habit-check')[1].click();
  })()`);
  await browser.wait("typeof window.holdFirstLog==='function'");
  assert.equal(
    await browser.evaluate("JSON.parse(sessionStorage.getItem('minh-anh-habit-queue-v1')).length"),
    1,
  );
  await browser.navigate(server.url, 390);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  await habits(browser);
  await browser.wait(
    "!!document.querySelector('.habit-log-recovery') && document.querySelectorAll('.habit-check')[1].getAttribute('aria-pressed')==='true'",
  );
  for (let attempt = 0; attempt < 50 && control.habits.habits[1].log.value !== 100; attempt++)
    await delay(20);
  assert.equal(control.habits.habits[1].log.value, 100);
  await browser.tap('.habit-log-recovery button');
  await browser.wait("!document.querySelector('.habit-log-recovery')");
  assert.equal(control.posts.filter((post) => post.input.operation === 'log').length, 2);
  assert.equal(await browser.evaluate("sessionStorage.getItem('minh-anh-habit-queue-v1')"), null);
  assert.deepEqual(browser.errors, []);
});

test(
  'task receipts show the new task and version before a delayed app refresh and reject stale snapshots',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    await browser.evaluate(`(() => {
    const original=fetch;window.holdSnapshots=true;window.releaseSnapshots=[];
    window.fetch=async(url,init)=>{
      const response=await original(url,init);
      if(String(url)==='/api/bootstrap'&&window.holdSnapshots){
        const saved=new Response(await response.text(),{status:response.status,headers:response.headers});
        await new Promise(resolve=>window.releaseSnapshots.push(resolve));return saved;
      }return response;
    };
  })()`);
    const edit = async (title) => {
      await browser.tap('.daily-item-open');
      await browser.wait("document.querySelector('#sheet').open");
      await browser.evaluate(
        `document.querySelector('#task-sheet-form input[type=text]').value=${JSON.stringify(title)};document.querySelector('#task-sheet-form').requestSubmit()`,
      );
      await browser.wait("!document.querySelector('#sheet').open");
      await browser.wait(
        `document.querySelector('.daily-item-open strong')?.textContent.includes(${JSON.stringify(title)})`,
      );
    };
    await edit('Tên đã xác nhận');
    await browser.wait('window.releaseSnapshots.length>0');
    await edit('Tên mới nhất');
    const writes = control.posts.filter((post) => post.path === 'tasks');
    assert.deepEqual(
      writes.map((post) => post.input.version),
      [1, 2],
    );
    await browser.evaluate(
      'window.holdSnapshots=false;window.releaseSnapshots.forEach(resolve=>resolve())',
    );
    await delay(300);
    assert.equal(
      await browser.evaluate(
        "document.querySelector('.daily-item-open strong').textContent.includes('Tên mới nhất')",
      ),
      true,
    );
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'startup does not wait for history; cached tab navigation does not repeat reads',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    assert.deepEqual(control.calls, ['GET bootstrap']);
    await habits(browser);
    await browser.tap('[data-tab=today]');
    await browser.wait("!!document.querySelector('.focus-flip-card')");
    const start = control.calls.length;
    await habits(browser);
    await delay(100);
    assert.deepEqual(control.calls.slice(start), []);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'habit checks respond immediately, serialize rapid intents and never invent rewards while POST is pending',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    await habits(browser);
    const start = control.calls.length,
      tickets = control.state.account.state.tickets;
    await browser.evaluate(`(() => {
    const original = fetch; window.releasePosts = []; window.holdPosts = true;
    window.fetch = async (url, init) => {
      if (String(url) === '/api/habits' && init?.method === 'POST' && window.holdPosts)
        await new Promise(resolve => window.releasePosts.push(resolve));
      return original(url, init);
    };
    document.querySelector('.habit-check').click();
  })()`);
    await browser.wait('window.releasePosts.length===1');
    const immediate = await browser.evaluate(`(() => {
    document.querySelectorAll('.habit-check')[1].click();
    document.querySelectorAll('.habit-check')[0].click();
    return { values:[...document.querySelectorAll('.habit-check')].map(n=>n.getAttribute('aria-pressed')),
      disabled:[...document.querySelectorAll('.habit-check,[data-tab]')].some(n=>n.disabled),
      busy:!!document.querySelector('.habit-check[aria-busy=true]'),
      reward:document.querySelector('#toast').textContent.includes('vé quay') };
  })()`);
    assert.deepEqual(immediate, {
      values: ['false', 'true', 'false'],
      disabled: false,
      busy: false,
      reward: false,
    });
    assert.equal(control.state.account.state.tickets, tickets);
    await browser.evaluate(
      'window.holdPosts=false;window.releasePosts.forEach(resolve=>resolve())',
    );
    await browser.wait(
      "!!document.querySelector('#toast .notice-action') && document.querySelectorAll('.habit-check')[1].getAttribute('aria-pressed')==='true'",
    );
    for (
      let count = 0;
      count < 50 && control.posts.filter((post) => post.input.operation === 'log').length < 3;
      count++
    )
      await delay(40);
    const logs = control.posts.filter((post) => post.input.operation === 'log');
    assert.equal(logs.length, 3);
    assert.deepEqual(
      logs.map((post) => post.input.logVersion),
      [0, 1, 0],
    );
    assert.deepEqual(
      control.habits.habits.map((view) => view.log.value),
      [0, 100, 0],
    );
    assert.equal(control.state.account.state.tickets, tickets + 2);
    assert.equal(control.calls.slice(start).includes('GET habits'), false);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'rejected optimistic logs roll back without displaying a successful reward',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    await habits(browser);
    const tickets = control.state.account.state.tickets;
    await browser.evaluate(`(() => {
    const original=fetch; window.fetch=(url,init)=>String(url)==='/api/habits'&&init?.method==='POST'
      ? Promise.resolve(new Response(JSON.stringify({error:'HABIT_LOG_CHANGED',message:'Bản ghi vừa thay đổi.'}),{status:409})) : original(url,init);
    document.querySelector('.habit-check').click();
  })()`);
    await browser.wait("document.querySelector('#toast')?.dataset.kind==='error'");
    assert.equal(
      await browser.evaluate("document.querySelector('.habit-check').getAttribute('aria-pressed')"),
      'false',
    );
    assert.equal(control.state.account.state.tickets, tickets);
    assert.equal(
      await browser.evaluate("document.querySelector('#toast').textContent.includes('vé quay')"),
      false,
    );
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'a lost habit response retries the same receipt, preserves the confirmed ticket and clears recovery UI',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    await habits(browser);
    const tickets = control.state.account.state.tickets;
    await browser.evaluate(`(() => {
    const original=fetch; window.habitAttempts=[]; let lost=true;
    window.fetch=async(url,init)=>{
      const log=String(url)==='/api/habits'&&init?.method==='POST';
      if(log) window.habitAttempts.push(JSON.parse(init.body));
      const response=await original(url,init);
      if(log&&lost){lost=false;throw Error('RESPONSE_LOST')}
      return response;
    }; document.querySelector('.habit-check').click();
  })()`);
    await browser.wait("!!document.querySelector('.habit-log-recovery')");
    assert.equal(control.state.account.state.tickets, tickets + 1);
    assert.equal(
      await browser.evaluate("document.querySelector('.habit-check').getAttribute('aria-pressed')"),
      'false',
    );
    await browser.tap('.habit-log-recovery button');
    await browser.wait(
      "!document.querySelector('.habit-log-recovery') && document.querySelector('.habit-check').getAttribute('aria-pressed')==='true'",
    );
    const attempts = await browser.evaluate('window.habitAttempts');
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0], attempts[1]);
    assert.equal(control.state.account.state.tickets, tickets + 1);
    assert.equal(control.posts.filter((post) => post.input.operation === 'log').length, 1);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'a reversal queued behind a lost response is retained until recovery and saved once',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    await habits(browser);
    const tickets = control.state.account.state.tickets;
    await browser.evaluate(`(() => {
    const original=fetch;let first=true;window.fetch=async(url,init)=>{
      const response=await original(url,init);
      if(String(url)==='/api/habits'&&init?.method==='POST'&&first){
        first=false;await new Promise(resolve=>window.releaseLostLog=resolve);throw Error('RESPONSE_LOST');
      }return response;
    };document.querySelector('.habit-check').click();
  })()`);
    await browser.wait("typeof window.releaseLostLog==='function'");
    await browser.evaluate(
      "document.querySelector('.habit-check').click();window.releaseLostLog()",
    );
    await browser.wait("!!document.querySelector('.habit-log-recovery')");
    assert.equal(
      await browser.evaluate("document.querySelector('.habit-check').getAttribute('aria-pressed')"),
      'false',
    );
    await browser.tap('.habit-log-recovery button');
    await browser.wait(
      "!document.querySelector('.habit-log-recovery') && document.querySelector('#toast .notice-message')?.textContent==='Đã cập nhật hôm nay.'",
    );
    assert.equal(control.habits.habits[0].log.value, 0);
    assert.equal(control.habits.habits[0].log.version, 2);
    assert.equal(control.state.account.state.tickets, tickets + 1);
    assert.equal(control.posts.filter((post) => post.input.operation === 'log').length, 2);
    assert.equal(await browser.evaluate("sessionStorage.getItem('minh-anh-habit-queue-v1')"), null);
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'pending logs cannot restore data or dispatch queued writes after logout',
  options,
  async (t) => {
    const { control, browser } = await open(t);
    await habits(browser);
    await browser.evaluate(`(() => {
    const original=fetch;window.fetch=async(url,init)=>{
      const response=await original(url,init);
      if(String(url)==='/api/habits'&&init?.method==='POST')await new Promise(resolve=>window.releaseSavedLog=resolve);
      return response;
    };document.querySelector('.habit-check').click();
  })()`);
    await browser.wait("typeof window.releaseSavedLog==='function'");
    await browser.evaluate(
      "document.querySelectorAll('.habit-check')[1].click();document.querySelector('#logout').click()",
    );
    await browser.wait("!!document.querySelector('.browser-login')");
    await browser.evaluate('window.releaseSavedLog()');
    await delay(250);
    assert.equal(control.posts.filter((post) => post.input.operation === 'log').length, 1);
    assert.equal(await browser.evaluate("document.querySelectorAll('.habit-card').length"), 0);
    assert.equal(
      await browser.evaluate("document.querySelector('#toast').textContent.includes('vé quay')"),
      false,
    );
    assert.deepEqual(browser.errors, []);
  },
);

test(
  'notifications fit mobile and desktop, respect navigation, pause on focus and show once inside a modal',
  options,
  async (t) => {
    const { browser } = await open(t);
    await mkdir('output/app-performance', { recursive: true });
    await browser.evaluate(`(async()=>{
    const {createFeedback}=await import('/app/ui/feedback.js');
    window.notice=createFeedback({sheet:document.querySelector('#sheet')}).toast;
  })()`);
    const measurements = [];
    for (const width of [320, 390, 1280])
      for (const theme of ['light', 'dark']) {
        await browser.resize(width, 844);
        await browser.colorScheme(theme);
        await browser.wait(`document.documentElement.dataset.theme==='${theme}'`);
        await browser.evaluate(
          "window.notice('+3 vé quay', {label:'Hoàn tác',run(){}},{kind:'success'})",
        );
        await delay(180);
        const geometry = await browser.evaluate(`(() => {
      const node=document.querySelector('#toast'), r=node.getBoundingClientRect(), nav=document.querySelector('.bottom-nav').getBoundingClientRect();
      const button=node.querySelector('.notice-action').getBoundingClientRect(), close=node.querySelector('.notice-close').getBoundingClientRect();
      return {left:r.left,right:r.right,bottom:r.bottom,navTop:nav.top,width:r.width,height:r.height,buttonHeight:button.height,closeWidth:close.width,
        overflow:document.documentElement.scrollWidth>innerWidth+1};
    })()`);
        assert.ok(geometry.left >= 0 && geometry.right <= width);
        assert.ok(geometry.buttonHeight >= 44 && geometry.closeWidth >= 44);
        if (width < 1000)
          assert.ok(geometry.bottom <= geometry.navTop - 8, JSON.stringify(geometry));
        assert.equal(geometry.overflow, false);
        measurements.push({ viewportWidth: width, theme, ...geometry });
        await browser.screenshot(`output/app-performance/notice-${width}-${theme}.png`);
        await browser.tap('#toast .notice-close');
      }
    await browser.resize(320, 844);
    await browser.reducedMotion(true);
    await browser.evaluate(
      "document.documentElement.style.setProperty('--app-host-safe-bottom','20px');window.notice('Chưa xác nhận được lần lưu. Kiểm tra kết nối rồi thử lại để giữ đúng kết quả và số dư.', {label:'Kiểm tra lại',run(){}},{kind:'error'})",
    );
    await browser.scaleText(2);
    await browser.evaluate(
      'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',
    );
    const accessible = await browser.evaluate(`(() => {
      const node=document.querySelector('#toast'),r=node.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,navTop:nav.top,overflow:node.scrollWidth>node.clientWidth+1,
        bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...node.querySelectorAll('button')].map(n=>({height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width}))};
    })()`);
    assert.ok(accessible.left >= 0 && accessible.right <= 320 && accessible.top >= 0);
    assert.ok(accessible.bottom <= accessible.navTop - 8, JSON.stringify(accessible));
    assert.equal(accessible.overflow, false);
    assert.equal(accessible.bodyOverflow, false);
    assert.ok(accessible.buttons.every((button) => button.height >= 44));
    measurements.push({
      viewportWidth: 320,
      textScale: 2,
      reducedMotion: true,
      safeBottom: 20,
      ...accessible,
    });
    await browser.screenshot('output/app-performance/notice-320-large-text.png');
    await browser.scaleText(1);
    await browser.evaluate(
      "document.documentElement.style.removeProperty('--app-host-safe-bottom')",
    );
    await browser.resize(390, 844);
    await browser.tap('#settings');
    await browser.evaluate(
      "window.notice('Chưa lưu được. Vui lòng kiểm tra kết nối rồi thử lại.', {label:'Thử lại',run(){}},{kind:'error'})",
    );
    assert.equal(await browser.evaluate("document.querySelector('#sheet-feedback').hidden"), false);
    assert.equal(
      await browser.evaluate("document.querySelector('#toast').classList.contains('visible')"),
      false,
    );
    assert.equal(
      await browser.evaluate("document.querySelectorAll('#sheet .notice-message').length"),
      1,
    );
    await browser.screenshot('output/app-performance/notice-dialog-390.png');
    await browser.press('Escape');
    await browser.evaluate(`(() => {
    const nativeTimeout=window.setTimeout;
    window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===8000?120:ms,...args);
    window.notice('Đã lưu', {label:'Hoàn tác',run(){}},{kind:'success'});
    document.querySelector('#toast .notice-action').focus();
  })()`);
    await delay(200);
    assert.equal(
      await browser.evaluate("document.querySelector('#toast').classList.contains('visible')"),
      true,
      'Focused actions pause dismissal',
    );
    await browser.evaluate('document.activeElement.blur()');
    await browser.wait("!document.querySelector('#toast').classList.contains('visible')");
    await writeFile(
      'output/app-performance/notice-geometry.json',
      JSON.stringify(measurements, null, 2),
    );
    assert.deepEqual(browser.errors, []);
  },
);
