import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chrome, browserBin } from './app-harness.mjs';
import {
  firstStepEvidenceDirectory,
  firstStepFixture,
  openFirstStep,
  holdPointer,
} from './first-step-fixture.mjs';
import { crop, decodePNG, gifEncode } from './first-step-images.mjs';

const evidence = firstStepEvidenceDirectory();

async function pointerDown(browser) {
  const point = await browser.evaluate(
    '(()=>{const n=document.querySelector("#pb-hold");n.addEventListener("pointerdown",e=>globalThis.__heldPointer=e.pointerId,{once:true});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()',
  );
  await browser.dispatchInput('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...point,
    button: 'left',
    clickCount: 1,
  });
  return point;
}
async function pointerUp(browser, point) {
  await browser.dispatchInput('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...point,
    button: 'left',
    clickCount: 1,
  });
}
async function cancelActive(browser) {
  await browser.tap('.pb-menu summary');
  await browser.tap('[data-pb=stop]');
  await browser.tap('[data-pb=stop-confirm]');
  await browser.wait(
    '!!document.querySelector("#pb-hold") && !document.querySelector("#pb-hold").disabled',
  );
}

test(
  'first-step trusted input/lifecycle: abort conditions, keyboard, retained pointer during Habit refresh and actual motion recording',
  { timeout: 180000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await openFirstStep(b, f.server);
      for (const cancel of ['escape', 'drag', 'capture', 'focusout', 'blur', 'hidden', 'resize']) {
        const point = await pointerDown(b);
        await delay(180);
        if (cancel === 'escape') await b.press('Escape');
        if (cancel === 'drag')
          await b.dispatchInput('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: point.x + 50,
            y: point.y,
            button: 'left',
            buttons: 1,
          });
        if (cancel === 'capture')
          await b.evaluate(
            'document.querySelector("#pb-hold").releasePointerCapture(__heldPointer)',
          );
        if (cancel === 'focusout') await b.evaluate('document.querySelector("#pb-hold").blur()');
        if (cancel === 'blur') await b.evaluate('window.dispatchEvent(new Event("blur"))');
        if (cancel === 'hidden')
          await b.evaluate(
            'Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));Object.defineProperty(document,"hidden",{configurable:true,value:false})',
          );
        if (cancel === 'resize') {
          await b.resize(430, 844);
          await b.resize(390, 844);
        }
        await pointerUp(b, point);
        assert.equal(
          await b.evaluate('!!document.querySelector("#pb-entry").dataset.holding'),
          false,
          cancel,
        );
        assert.equal(
          await b.evaluate('document.querySelectorAll(".pb-hold-canvas").length'),
          0,
          cancel,
        );
      }
      assert.equal(f.control.firstStepPosts.length, 0);
      for (const [key, code, virtual] of [
        [' ', 'Space', 32],
        ['Enter', 'Enter', 13],
      ]) {
        await b.evaluate('document.querySelector("#pb-hold").focus()');
        await b.dispatchInput('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          key,
          code,
          windowsVirtualKeyCode: virtual,
        });
        await delay(3100);
        await b.dispatchInput('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key,
          code,
          windowsVirtualKeyCode: virtual,
        });
        await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
        assert.equal((await f.healthy.read('123')).state.tickets, 0);
        await cancelActive(b);
      }
      let releaseRead;
      f.control.habitReadGate = new Promise((resolve) => {
        releaseRead = resolve;
      });
      await b.tap('[data-tab=habits]');
      await b.evaluate(
        'globalThis.__originalCard=document.querySelector("#pb-entry");globalThis.__originalButton=document.querySelector("#pb-hold")',
      );
      const point = await pointerDown(b),
        frames = [],
        timestamps = [];
      setTimeout(releaseRead, 450);
      const start = performance.now();
      while (performance.now() - start < 4300) {
        const elapsed = performance.now() - start;
        if (elapsed > 750 && elapsed < 2600) {
          assert.equal(
            await b.evaluate(
              '__originalCard===document.querySelector("#pb-entry") && __originalButton===document.querySelector("#pb-hold") && __originalButton.hasPointerCapture(__heldPointer)',
            ),
            true,
            'Habit refresh must keep the captured subtree connected',
          );
        }
        const rect = await b.evaluate(
          'document.querySelector("#pb-entry").getBoundingClientRect().toJSON()',
        );
        const path = evidence + '/motion-frame-' + frames.length + '.png';
        timestamps.push(performance.now() - start);
        await b.screenshot(path);
        frames.push(
          crop(decodePNG(readFileSync(path)), {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }),
        );
        await delay(Math.max(0, 100 - (performance.now() - start - elapsed)));
      }
      await pointerUp(b, point);
      f.control.habitReadGate = null;
      await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
      assert.equal(f.control.firstStepPosts.filter((p) => p.operation === 'start').length, 3);
      // A transient network note must not alter normal card geometry in the clip.
      assert.ok(frames.every((frame) => frame.w === 346 && frame.h === 113));
      const delays = timestamps.map((at, i) =>
        Math.max(1, Math.round(((timestamps[i + 1] ?? at + 100) - at) / 10)),
      );
      await writeFile(evidence + '/actual-input-motion.gif', gifEncode(frames, delays));
      await writeFile(
        evidence + '/actual-input-motion.json',
        JSON.stringify(
          {
            timestamps,
            delays,
            durationMs: delays.reduce((a, b) => a + b, 0) * 10,
            source:
              'Trusted mouse hold in the real app with workerd/D1; natural browser timing, no virtual clock',
          },
          null,
          2,
        ),
      );
      await cancelActive(b);
      await b.tap('[data-tab=today]');
      await b.evaluate(`(()=>{
        const add=EventTarget.prototype.addEventListener,raf=requestAnimationFrame,cancel=cancelAnimationFrame,
          interval=setInterval,clear=clearInterval;
        const listeners=new Set(),frames=new Set(),intervals=new Set();
        const feature=()=>new Error().stack.includes('/first-step');
        EventTarget.prototype.addEventListener=function(type,listener,options){
          if(options?.signal&&feature()){
            const registration={type,listener};listeners.add(registration);
            add.call(options.signal,'abort',()=>listeners.delete(registration),{once:true});
          }
          return add.call(this,type,listener,options);
        };
        globalThis.requestAnimationFrame=callback=>{
          let id;id=raf(now=>{frames.delete(id);callback(now);});if(feature())frames.add(id);return id;
        };
        globalThis.cancelAnimationFrame=id=>{frames.delete(id);return cancel(id);};
        globalThis.setInterval=(...args)=>{const id=interval(...args);if(feature())intervals.add(id);return id;};
        globalThis.clearInterval=id=>{intervals.delete(id);return clear(id);};
        globalThis.__firstStepResources=()=>({listeners:listeners.size,frames:frames.size,intervals:intervals.size});
      })()`);
      let mountedResources;
      for (let i = 0; i < 20; i++) {
        await b.tap('[data-tab=today]');
        await b.tap('[data-tab=habits]');
        await b.wait(
          '!!document.querySelector("#pb-hold") && !document.querySelector("#pb-hold").disabled',
        );
        await holdPointer(b, 35);
        const resources = await b.evaluate('__firstStepResources()');
        mountedResources ??= resources;
        assert.ok(resources.listeners > 0 && resources.intervals === 1 && resources.frames === 0);
        assert.deepEqual(resources, mountedResources, 'Mounted resources must not accumulate');
      }
      assert.equal(
        await b.evaluate('document.querySelectorAll(".pb-hold-canvas,#pb-fx,#pb-cinema").length'),
        0,
      );
      assert.equal(f.control.firstStepPosts.filter((p) => p.operation === 'start').length, 3);
      await b.tap('[data-tab=today]');
      const unmountedResources = await b.evaluate('__firstStepResources()');
      assert.deepEqual(unmountedResources, { listeners: 0, frames: 0, intervals: 0 });
      await writeFile(
        evidence + '/resource-lifecycle.json',
        JSON.stringify({ cycles: 20, mountedResources, unmountedResources }, null, 2),
      );
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step reduced motion and Canvas fallback retain the full timer and cancel interaction',
  { timeout: 60000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await openFirstStep(b, f.server);
      for (const fallback of ['reduce', 'canvas']) {
        if (fallback === 'reduce') await b.reducedMotion(true);
        else {
          await b.reducedMotion(false);
          await b.evaluate('HTMLCanvasElement.prototype.getContext=()=>null');
        }
        const point = await pointerDown(b);
        await delay(600);
        assert.equal(
          await b.evaluate('document.querySelector("#pb-entry").dataset.gachaMode'),
          'still',
        );
        assert.equal(
          await b.evaluate('getComputedStyle(document.querySelector(".pb-copy")).visibility'),
          'visible',
        );
        await delay(2500);
        await pointerUp(b, point);
        await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
        await cancelActive(b);
      }
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step recovery: reload keeps request identity and cancel wins against a start arriving after timeout',
  { timeout: 65000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    let releaseStart;
    try {
      await openFirstStep(b, f.server);
      f.control.dropReply = 'start';
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=start-accessible]');
      await b.wait('!!document.querySelector("[data-pb=retry]")');
      const first = (await f.store.read('123', Date.now())).active;
      await openFirstStep(b, f.server);
      assert.equal((await f.store.read('123', Date.now())).active.id, first.id);
      const attempts = f.control.firstStepPosts.filter((p) => p.operation === 'start');
      assert.equal(attempts.length, 2);
      assert.equal(attempts[0].id, attempts[1].id);
      await cancelActive(b);
      f.control.startGate = new Promise((resolve) => {
        releaseStart = resolve;
      });
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=start-accessible]');
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=stop]');
      await b.tap('[data-pb=stop-confirm]');
      // The real transport timeout releases the shared write lock, then the
      // queued cancel can commit a tombstone before the delayed start is handled.
      await delay(15200);
      await b.wait(
        '!!document.querySelector("#pb-hold") && !document.querySelector("#pb-hold").disabled',
      );
      const late = f.control.firstStepPosts.filter((p) => p.operation === 'start').at(-1);
      assert.equal(
        (await f.store.read('123', Date.now(), late.occurrenceId)).occurrence.status,
        'canceled',
      );
      releaseStart();
      f.control.startGate = null;
      await delay(350);
      assert.equal((await f.store.read('123', Date.now())).active, null);
      await openFirstStep(b, f.server);
      assert.equal((await f.store.read('123', Date.now())).active, null);
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      assert.deepEqual(b.errors, []);
    } finally {
      releaseStart?.();
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step network recovery preserves identities before send, after lost cancel and after malformed committed reward',
  { timeout: 70000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await openFirstStep(b, f.server);
      await b.evaluate(`(()=>{
        const original=fetch;
        globalThis.__offlineOnce=true;
        globalThis.fetch=(url,init)=>{
          if(__offlineOnce&&String(url)==='/api/first-step'&&init?.method==='POST'){
            __offlineOnce=false;globalThis.__blockedFirstStep=JSON.parse(init.body);
            return Promise.reject(new TypeError('Local offline simulation'));
          }
          return original(url,init);
        };
      })()`);
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=start-accessible]');
      await b.wait('!!document.querySelector("[data-pb=retry]")');
      const blocked = await b.evaluate('__blockedFirstStep');
      assert.equal(f.control.firstStepPosts.length, 0);
      assert.equal((await f.store.read('123', Date.now())).active, null);
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      await b.tap('[data-pb=retry]');
      await b.wait('!document.querySelector(".pb-network")');
      assert.equal(f.control.firstStepPosts[0].id, blocked.id);
      assert.equal((await f.store.read('123', Date.now())).active.id, blocked.occurrenceId);
      f.control.dropReply = 'cancel';
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=stop]');
      await b.tap('[data-pb=stop-confirm]');
      await b.wait('!!document.querySelector("[data-pb=retry]")');
      assert.equal(
        (await f.store.read('123', Date.now(), blocked.occurrenceId)).occurrence.status,
        'canceled',
      );
      await openFirstStep(b, f.server);
      const cancels = f.control.firstStepPosts.filter((p) => p.operation === 'cancel');
      assert.equal(cancels.length, 2);
      assert.equal(cancels[0].id, cancels[1].id);
      assert.equal((await f.store.read('123', Date.now())).active, null);
      await b.evaluate(`(()=>{
        const original=fetch;let malformed=true;
        globalThis.fetch=async(url,init)=>{
          const response=await original(url,init);
          if(malformed&&String(url)==='/api/first-step'&&init?.method==='POST'&&JSON.parse(init.body).operation==='outside'){
            malformed=false;await response.text();return new Response('invalid JSON',{status:200});
          }
          return response;
        };
      })()`);
      await b.tap('[data-pb=outside]');
      await b.tap('[data-pb=claim]');
      await b.wait('!!document.querySelector("[data-pb=retry]")');
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      await b.tap('[data-pb=retry]');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="reward"');
      const outside = f.control.firstStepPosts.filter((p) => p.operation === 'outside');
      assert.equal(outside.length, 2);
      assert.equal(outside[0].id, outside[1].id);
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step remains usable when browser storage access throws and confirms through the real server',
  { timeout: 35000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await openFirstStep(b, f.server);
      await b.evaluate(`(()=>{
        for(const name of ['sessionStorage','localStorage'])Object.defineProperty(window,name,{
          configurable:true,get(){throw new DOMException('Storage unavailable','SecurityError');}
        });
      })()`);
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=start-accessible]');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
      const active = (await f.store.read('123', Date.now())).active;
      assert.ok(active);
      await cancelActive(b);
      assert.equal(
        (await f.store.read('123', Date.now(), active.id)).occurrence.status,
        'canceled',
      );
      await b.tap('[data-pb=outside]');
      await b.tap('[data-pb=claim]');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="reward"');
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step two browser tabs converge on the same active occurrence and terminal cancellation',
  { timeout: 60000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await openFirstStep(b, f.server);
      assert.equal(
        await b.evaluate('globalThis.__peer=window.open(location.href,"first-step-peer");!!__peer'),
        true,
      );
      await b.wait('__peer.document.body?.classList.contains("app-ready")');
      await b.evaluate('__peer.document.querySelector("[data-tab=habits]").click()');
      await b.wait(
        '!!__peer.document.querySelector("#pb-hold") && !__peer.document.querySelector("#pb-hold").disabled',
      );
      await b.evaluate('document.querySelector("[data-pb=start-accessible]").click()');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
      await b.wait('__peer.document.querySelector("#pb-entry").dataset.state==="running"');
      const active = (await f.store.read('123', Date.now())).active;
      await b.evaluate(`(()=>{
        const original=fetch;globalThis.__holdRootRead=true;
        globalThis.fetch=(url,init)=>original(url,init).then(async response=>{
          if(__holdRootRead&&String(url).startsWith('/api/first-step')&&init?.method==='GET')
            await new Promise(resolve=>globalThis.__releaseRootRead=resolve);
          return response;
        });
        window.dispatchEvent(new Event('focus'));
      })()`);
      await b.wait('typeof __releaseRootRead==="function"');
      await b.evaluate(
        '__peer.document.querySelector("[data-pb=stop]").click();__peer.document.querySelector("[data-pb=stop-confirm]").click()',
      );
      await b.wait('!!__peer.document.querySelector("#pb-hold")');
      await b.evaluate('__holdRootRead=false;__releaseRootRead()');
      await b.wait(
        '!!document.querySelector("#pb-hold") && !!__peer.document.querySelector("#pb-hold")',
      );
      assert.equal(
        (await f.store.read('123', Date.now(), active.id)).occurrence.status,
        'canceled',
      );
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      await b.evaluate('__peer.close()');
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step logout discards a delayed acknowledgement and cleans feature scenes and session callbacks',
  { timeout: 35000 },
  async () => {
    const f = await firstStepFixture(),
      b = await chrome();
    let releaseReply;
    try {
      await openFirstStep(b, f.server);
      f.control.replyGateOperation = 'outside';
      f.control.replyGate = new Promise((resolve) => {
        releaseReply = resolve;
      });
      await b.tap('[data-pb=outside]');
      await b.tap('[data-pb=claim]');
      for (let attempt = 0; (await f.healthy.read('123')).state.tickets !== 1; attempt++) {
        assert.ok(attempt < 60, 'The actual backend write must commit before logging out');
        await delay(50);
      }
      await b.evaluate('scrollTo({top:0,behavior:"instant"})');
      await b.tap('#logout');
      await b.wait('document.body.classList.contains("login-screen")');
      releaseReply();
      f.control.replyGate = null;
      await delay(250);
      assert.equal(
        await b.evaluate(
          'document.querySelectorAll("#pb-entry,.pb-hold-canvas,#pb-cinema,#pb-fx").length',
        ),
        0,
      );
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      assert.equal(await b.evaluate('document.body.classList.contains("login-screen")'), true);
      assert.deepEqual(b.errors, []);
    } finally {
      releaseReply?.();
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step real Worker/D1 UI: short holds, trusted 3s input, cancel, outside reward and lost-response recovery',
  { timeout: 120000 },
  async () => {
    assert.ok(browserBin, 'A real browser is required; this test must not skip');
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await mkdir(evidence, { recursive: true });
      await openFirstStep(b, f.server);
      assert.deepEqual(
        await b.evaluate(
          '(()=>{const a=document.querySelector("#pb-entry").getBoundingClientRect(),s=document.querySelector(".pb-socket").getBoundingClientRect();return [a.width,a.height,s.width,s.height]})()',
        ),
        [346, 113, 102, 42],
      );
      await b.screenshot(evidence + '/ui-idle-first.png');
      await holdPointer(b, 650);
      await holdPointer(b, 650);
      assert.equal(f.control.firstStepPosts.length, 0);
      await holdPointer(b, 3100);
      await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
      assert.equal(f.control.firstStepPosts.filter((p) => p.operation === 'start').length, 1);
      const started = (await f.store.read('123', Date.now())).active;
      assert.ok(started && started.endsAt - started.startedAt === 300000);
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      await b.screenshot(evidence + '/ui-running-first.png');
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=stop]');
      await b.press('Escape');
      assert.equal((await f.store.read('123', Date.now())).active.id, started.id);
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=stop]');
      await b.screenshot(evidence + '/ui-cancel-confirm-first.png');
      await b.tap('[data-pb=stop-confirm]');
      await b.wait(
        '!!document.querySelector("#pb-hold") && !document.querySelector("#pb-hold").disabled',
      );
      assert.equal(
        (await f.store.read('123', Date.now(), started.id)).occurrence.status,
        'canceled',
      );
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      await openFirstStep(b, f.server);
      assert.equal((await f.store.read('123', Date.now())).active, null);
      await b.tap('[data-pb=outside]');
      await b.tap('[data-pb=back]');
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      f.control.dropReply = 'outside';
      await b.tap('[data-pb=outside]');
      await b.tap('[data-pb=claim]');
      await b.wait('!!document.querySelector("[data-pb=retry]")');
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      await b.tap('[data-pb=retry]');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="reward"');
      await delay(900);
      await b.screenshot(evidence + '/ui-reward-first.png');
      await b.wait(
        '!!document.querySelector("#pb-hold") && !document.querySelector("#pb-hold").disabled',
      );
      const requests = f.control.firstStepPosts.filter((p) => p.operation === 'outside');
      assert.equal(requests.length, 2);
      assert.equal(requests[0].id, requests[1].id);
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      assert.equal((await f.healthy.read('123')).state.qi, 1);
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);

test(
  'first-step real five-minute browser session: leave, reload, ready, explicit confirmation and wallet receipt',
  { timeout: 390000 },
  async () => {
    assert.ok(browserBin, 'A real browser is required; this test must not skip');
    const f = await firstStepFixture(),
      b = await chrome();
    try {
      await openFirstStep(b, f.server);
      await holdPointer(b, 3100, 'touch');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="running"');
      const started = (await f.store.read('123', Date.now())).active;
      assert.ok(started);
      await b.tap('[data-tab=today]');
      assert.equal(
        await b.evaluate('document.querySelectorAll(".pb-hold-canvas,#pb-cinema,#pb-fx").length'),
        0,
      );
      await delay(1500);
      await openFirstStep(b, f.server);
      assert.equal((await f.store.read('123', Date.now())).active.id, started.id);
      // Real wall time; no fake Date, shortened deadline, test API or production shortcut.
      while (Date.now() < started.endsAt - 1800)
        await delay(Math.min(20000, started.endsAt - 1800 - Date.now()));
      await b.tap('.pb-menu summary');
      await b.tap('[data-pb=stop]');
      while (Date.now() < started.endsAt + 150)
        await delay(Math.min(1000, started.endsAt + 150 - Date.now()));
      assert.equal(await b.evaluate('document.querySelector("#pb-entry").dataset.state'), 'stop');
      await b.press('Escape');
      await b.wait('document.querySelector("#pb-entry").dataset.state==="ready"');
      const stillActive = (await f.store.read('123', Date.now())).active;
      assert.equal(stillActive.id, started.id);
      assert.equal(stillActive.endsAt, started.endsAt);
      assert.equal((await f.healthy.read('123')).state.tickets, 0);
      await b.screenshot(evidence + '/real-five-minute-ready.png');
      f.control.dropReply = 'claim';
      await b.tap('[data-pb=claim]');
      await b.wait('!!document.querySelector("[data-pb=retry]")');
      assert.equal((await f.healthy.read('123')).state.tickets, 1);
      await openFirstStep(b, f.server);
      await b.wait('document.querySelector("#pb-entry").dataset.state==="reward"');
      const claims = f.control.firstStepPosts.filter((p) => p.operation === 'claim');
      assert.equal(claims.length, 2);
      assert.equal(claims[0].id, claims[1].id);
      const wallet = await f.healthy.read('123');
      assert.equal(wallet.state.qi, 1);
      assert.equal(wallet.state.earned, 1);
      assert.equal(wallet.state.tickets, 1);
      const row = (await f.store.read('123', Date.now(), started.id)).occurrence;
      assert.equal(row.status, 'completed');
      await writeFile(
        evidence + '/real-five-minute.json',
        JSON.stringify(
          {
            started,
            completedAt: row.completedAt,
            elapsed: row.completedAt - started.startedAt,
            wallet,
            posts: f.control.firstStepPosts,
            browserErrors: b.errors,
          },
          null,
          2,
        ),
      );
      assert.deepEqual(b.errors, []);
    } finally {
      await b.close();
      await f.close();
    }
  },
);
