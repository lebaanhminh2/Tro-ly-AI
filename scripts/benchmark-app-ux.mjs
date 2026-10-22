import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fixture, serve, chrome } from '../tests/browser/app-harness.mjs';

const control = fixture();
for (let index = 0; index < 8; index++)
  control.mutate('habits', {
    id: 'ux_measure_' + index,
    operation: 'create',
    definition: { name: 'Thói quen ' + index, metric: 'check', target: 1, cadence: { kind: 'daily' } },
  });
control.readDelays = { history: 800, bootstrap: 100 };
const server = await serve(control);
let browser;
try {
  browser = await chrome();
  const start = performance.now();
  await browser.navigate(server.url, 390);
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  const startupMs = performance.now() - start;
  const startupCalls = [...control.calls];
  await browser.tap('[data-tab=habits]');
  await browser.wait("document.querySelectorAll('.habit-card').length===8 && !document.querySelector('.feature-updating')");
  await browser.evaluate(`(() => {
    const original = window.fetch;
    window.fetch = async (url, init) => {
      if (String(url).startsWith('/api/habits') && init?.method === 'POST')
        await new Promise(resolve => setTimeout(resolve, 350));
      return original(url, init);
    };
  })()`);
  control.readDelays.habits = 800;
  const writeStart = control.calls.length;
  const tick = await browser.evaluate(`(async () => {
    const start = performance.now();
    document.querySelector('.habit-check').click();
    const immediate = {
      checked: document.querySelector('.habit-check').getAttribute('aria-pressed'),
      busy: document.querySelector('.habit-check').getAttribute('aria-busy'),
      disabledChecks: [...document.querySelectorAll('.habit-check')].filter(node => node.disabled).length,
      disabledNavigation: [...document.querySelectorAll('[data-tab]')].filter(node => node.disabled).length,
    };
    while (document.querySelector('.habit-check')?.getAttribute('aria-pressed') !== 'true')
      await new Promise(resolve => requestAnimationFrame(resolve));
    return { immediate, responseMs: performance.now() - start };
  })()`);
  await browser.wait("document.querySelector('#toast').textContent.length>0");
  const notification = await browser.evaluate(`(() => {
    const node = document.querySelector('#toast'), r = node.getBoundingClientRect();
    return { text: node.textContent, width: r.width, height: r.height, top: r.top, bottom: r.bottom };
  })()`);
  const saveCalls = control.calls.slice(writeStart);
  await browser.tap('[data-tab=today]');
  await browser.wait("!!document.querySelector('.focus-flip-card')");
  const warmStart = control.calls.length;
  const warm = await browser.evaluate(`(() => {
    const start = performance.now();
    document.querySelector('[data-tab=habits]').click();
    return { renderMs: performance.now() - start, rows: document.querySelectorAll('.habit-card').length };
  })()`);
  await browser.wait("!document.querySelector('.feature-updating')");
  const output = {
    fixture: 'Local Chrome 390px, eight habits; history delay 800ms, bootstrap 100ms; POST delay 350ms and habit refresh delay 800ms. Local measurements, not production latency.',
    startupMs, startupCalls, tick, notification, saveCalls, warm,
    warmCalls: control.calls.slice(warmStart), browserErrors: browser.errors,
  };
  const target = resolve(process.argv[2] ?? 'output/app-performance/current.json');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
