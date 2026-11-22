import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import ts from 'typescript';
import { Miniflare } from 'miniflare';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { D1FirstStepStore } from '../../src/adapters/d1/first-step-store.ts';
import { fixture, serve } from './app-harness.mjs';

export function firstStepEvidenceDirectory() {
  const pointer = 'trial-results/anti-procrastination/implementation/current-run.txt';
  const directory =
    process.env.FIRST_STEP_EVIDENCE_DIR ??
    (existsSync(pointer)
      ? readFileSync(pointer, 'utf8').trim()
      : 'trial-results/anti-procrastination/browser/run-' + Date.now() + '-' + process.pid);
  mkdirSync(directory, { recursive: true });
  return directory;
}

// Native workerd loads the real Worker entrypoint and its actual source modules.
// The proxy supplies a freshly signed test-only Telegram identity, never bypasses
// API auth, and never loads environment secrets or calls external providers.
export async function firstStepFixture() {
  const modules = readdirSync('src', { recursive: true })
    .filter((path) => typeof path === 'string' && path.endsWith('.ts'))
    .map((path) => ({
      type: 'ESModule',
      path: resolve('src', path),
      contents: ts.transpileModule(readFileSync(resolve('src', path), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    }));
  const main = resolve('src/entrypoints/worker.ts');
  modules.sort((a, b) => Number(b.path === main) - Number(a.path === main));
  const token = '123:first_step_local_only';
  const mf = new Miniflare({
    modulesRoot: process.cwd(),
    modules,
    d1Databases: ['DB'],
    serviceBindings: {
      ASSETS: () => new Response('Static assets are served by the local browser harness.'),
    },
    bindings: {
      TELEGRAM_USER_ID: '123',
      TELEGRAM_BOT_TOKEN: token,
      TELEGRAM_WEBHOOK_SECRET: 'test-only-secret'.repeat(3),
      AI_MODE: 'off',
    },
    outboundService: () => {
      throw Error('Unexpected external network request in first-step E2E');
    },
  });
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('migrations')
    .filter((path) => path.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
  // Seed an existing schedule, including runs during the overnight rest window.
  // First-time setup after bedtime intentionally has no retroactive active day.
  await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, Date.now() - 86400000);
  await new ScheduleStore(db).ensureDay('123', Date.now());
  const control = fixture();
  control.firstStepPosts = [];
  control.dropReply = null;
  control.api = async (request, endpoint) => {
    if (endpoint === 'habits' && request.method === 'GET') await control.habitReadGate;
    let body = '';
    for await (const part of request) body += part;
    const auth = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    const check = [...auth]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => k + '=' + v)
      .join('\n');
    const key = createHmac('sha256', 'WebAppData').update(token).digest();
    auth.set('hash', createHmac('sha256', key).update(check).digest('hex'));
    const headers = {
      'X-Telegram-Init-Data': auth.toString(),
      'Content-Type': 'application/json',
      'X-Minh-Anh-Request': '1',
    };
    if (request.method === 'POST' && endpoint === 'first-step')
      control.firstStepPosts.push(JSON.parse(body));
    if (
      request.method === 'POST' &&
      endpoint === 'first-step' &&
      JSON.parse(body).operation === 'start'
    )
      await control.startGate;
    const result = await mf.dispatchFetch('http://' + request.headers.host + request.url, {
      method: request.method,
      headers,
      ...(request.method === 'POST' ? { body } : {}),
    });
    if (
      endpoint === 'first-step' &&
      request.method === 'POST' &&
      JSON.parse(body).operation === control.replyGateOperation
    )
      await control.replyGate;
    if (
      endpoint === 'first-step' &&
      request.method === 'POST' &&
      control.dropReply === JSON.parse(body).operation
    ) {
      control.dropReply = null;
      await result.text();
      return Response.json({ error: 'OPERATION_NOT_CONFIRMED' }, { status: 503 });
    }
    return result;
  };
  const server = await serve(control);
  return {
    control,
    server,
    mf,
    db,
    healthy: new HealthyStore(db),
    store: new D1FirstStepStore(db),
    async close() {
      await server.close();
      await mf.dispose();
    },
  };
}

export async function openFirstStep(browser, server, width = 390) {
  await browser.navigate(server.url, width);
  await browser.wait(
    '!!document.querySelector("[data-tab=habits]") && document.body.classList.contains("app-ready")',
  );
  await browser.tap('[data-tab=habits]');
  await browser.wait(
    '!!document.querySelector("#pb-entry")?.dataset.state && !document.querySelector("#pb-entry .pb-network")',
  );
  await browser.evaluate(
    'document.querySelector("#pb-entry").scrollIntoView({block:"center",behavior:"instant"})',
  );
}

export async function holdPointer(browser, duration, kind = 'mouse') {
  const point = await browser.evaluate(
    '(()=>{const r=document.querySelector("#pb-hold").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()',
  );
  if (kind === 'touch')
    await browser.dispatchInput('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...point, id: 1 }],
    });
  else
    await browser.dispatchInput('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...point,
      button: 'left',
      clickCount: 1,
    });
  await new Promise((resolve) => setTimeout(resolve, duration));
  if (kind === 'touch')
    await browser.dispatchInput('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else
    await browser.dispatchInput('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...point,
      button: 'left',
      clickCount: 1,
    });
}
