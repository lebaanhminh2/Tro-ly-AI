import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { once } from 'node:events';
import { Miniflare } from 'miniflare';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { browserBin, chrome } from './app-harness.mjs';

test(
  'Telegram browser keeps its HttpOnly session after 15 minutes, reloads and writes without another login request',
  { skip: !browserBin, timeout: 60000 },
  async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ['DB'],
    });
    let browser, server;
    try {
      const db = await mf.getD1Database('DB');
      for (const file of (await readdir('migrations'))
        .filter((file) => file.endsWith('.sql'))
        .sort())
        await db.exec((await readFile('migrations/' + file, 'utf8')).replace(/\r?\n/g, ' '));
      const started = Date.parse('2026-10-05T10:00:00+07:00'),
        token = '123:synthetic-browser-session',
        env = { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_BOT_TOKEN: token },
        params = new URLSearchParams({
          auth_date: String(started / 1000),
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
      await new ScheduleStore(db).configure('123', '04:30', '22:30', 0, started);
      const root = resolve('web'),
        calls = [];
      let now = started,
        cookieResponses = 0;
      server = createServer(async (incoming, outgoing) => {
        try {
          const url = new URL(incoming.url, 'http://' + incoming.headers.host);
          if (url.pathname.startsWith('/api/')) {
            calls.push(incoming.method + ' ' + url.pathname);
            let body = '';
            for await (const chunk of incoming) body += chunk;
            const response = await miniAppApi(
              new Request(url, {
                method: incoming.method,
                headers: incoming.headers,
                ...(incoming.method === 'POST' ? { body } : {}),
              }),
              env,
              now,
            );
            outgoing.statusCode = response.status;
            for (const [key, value] of response.headers)
              if (key !== 'set-cookie') outgoing.setHeader(key, value);
            const cookies = response.headers.getSetCookie();
            if (cookies.length) {
              outgoing.setHeader('Set-Cookie', cookies);
              if (cookies.some((cookie) => cookie.includes('Max-Age=2592000'))) cookieResponses++;
            }
            outgoing.end(await response.text());
            return;
          }
          const path = resolve(root, url.pathname.replace(/^\/app\//, '') || 'index.html');
          if (!path.startsWith(root + sep)) throw Error('NOT_FOUND');
          let content = await readFile(path);
          if (path.endsWith('index.html'))
            content = Buffer.from(
              content
                .toString()
                .replace(
                  '<head>',
                  '<head><script>window.Telegram={WebApp:{initData:' +
                    JSON.stringify(params.toString()) +
                    ',colorScheme:"light",ready(){},expand(){},onEvent(){}}};</script>',
                ),
            );
          outgoing.setHeader(
            'Content-Type',
            path.endsWith('.js')
              ? 'text/javascript'
              : path.endsWith('.css')
                ? 'text/css'
                : 'text/html',
          );
          outgoing.end(content);
        } catch {
          outgoing.statusCode = 404;
          outgoing.end('Not found');
        }
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const url = 'http://127.0.0.1:' + server.address().port + '/app/';
      browser = await chrome();
      await browser.navigate(url, 390);
      await browser.wait('document.body.classList.contains("app-ready")');
      assert.equal(cookieResponses, 1);
      assert.equal(calls.filter((call) => call === 'GET /api/bootstrap').length, 1);
      assert.equal(await browser.evaluate('document.cookie.includes("minh-anh-session")'), false);
      const saved = await db.prepare('SELECT * FROM browser_sessions').first();
      assert.equal(saved.expires_at, started + 30 * 86400000);
      now += 20 * 60000;
      assert.equal(
        await browser.evaluate(
          '(async()=>{const {liveRequest}=await import("/app/core/http.js");await liveRequest("bootstrap");return true})()',
        ),
        true,
      );
      await browser.navigate(url, 390);
      await browser.wait('document.body.classList.contains("app-ready")');
      const written = await browser.evaluate(`(async()=>{
        const {liveRequest}=await import('/app/core/http.js');
        return liveRequest('tasks',{id:'telegram_session_browser',operation:'create',title:'Session retained',remainingMinutes:15});
      })()`);
      assert.equal(written.task.title, 'Session retained');
      assert.equal(written.task.id, written.result.id);
      assert.equal(
        (
          await db
            .prepare('SELECT COUNT(*) AS n FROM tasks WHERE title=?')
            .bind('Session retained')
            .first()
        ).n,
        1,
      );
      assert.equal(
        cookieResponses,
        1,
        'Background return, reload and writes do not create another session',
      );
      assert.deepEqual(await db.prepare('SELECT * FROM browser_sessions').first(), saved);
      assert.equal(
        calls.some((call) => call.includes('browser-auth')),
        false,
        'Login uses the initial bootstrap without an extra request',
      );
      await browser.evaluate(
        '(async()=>{const {browserAuthRequest}=await import("/app/core/http.js");await browserAuthRequest("logout")})()',
      );
      assert.equal(
        await browser.evaluate(
          '(async()=>{try{await (await import("/app/core/http.js")).liveRequest("bootstrap");return "unexpected"}catch(error){return error.code}})()',
        ),
        'AUTH_REQUIRED',
      );
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM browser_sessions').first()).n, 0);
      assert.deepEqual(browser.errors, []);
    } finally {
      await browser?.close();
      if (server) await new Promise((done) => server.close(done));
      await mf.dispose();
    }
  },
);
