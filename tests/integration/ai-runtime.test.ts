import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {createWorker} from '../../src/entrypoints/worker.ts';
import {configured, type Env} from '../../src/config/env.ts';
import {query, type Database} from '../../src/adapters/d1/database.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';

test('runtime config requires explicit AI switch, key, model and bounded budget', () => {
  const env: Env = {DB: {} as Database, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32)};
  assert.equal(configured(env), true);
  env.AI_MODE = 'enabled';
  assert.equal(configured(env), false);
  Object.assign(env, {GEMINI_API_KEY: 'synthetic-key', GEMINI_MODEL: 'test-model', AI_DAILY_LIMIT: '20'});
  assert.equal(configured(env), true);
  for (const value of ['', '0', '-1', '501', '1.5', 'NaN', ' 20']) {
    assert.equal(configured({...env, AI_DAILY_LIMIT: value}), false);
  }
  assert.equal(configured({...env, GEMINI_MODEL: '../other-host'}), false);
  assert.equal(configured({...env, GEMINI_API_KEY: 'key\nheader'}), false);
  assert.equal(configured({...env, AI_MODE: 'typo'}), false);
});

test('runtime Gemini wiring: context, switches, persistent quota, replay and safe failure', async () => {
  const mf = new Miniflare({modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: ['DB']});
  try {
    const db = await mf.getD1Database('DB') as unknown as Database & {exec(sql: string): Promise<unknown>};
    for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(`migrations/${file}`, 'utf8').replace(/\r?\n/g, ' '));
    }
    const env: Env = {DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      AI_MODE: 'off', GEMINI_API_KEY: 'synthetic-key', GEMINI_MODEL: 'test-model', AI_DAILY_LIMIT: '2'};
    let now = Date.parse('2026-09-12T08:00:00+07:00'), seq = 0, calls = 0;
    let failure = false;
    const bodies: string[] = [];
    const transport: typeof fetch = async (url, options) => {
      calls++;
      assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
      assert.equal(options?.redirect, 'error');
      assert.equal(new Headers(options?.headers).get('x-goog-api-key'), 'synthetic-key');
      bodies.push(String(options?.body));
      if (failure) return new Response('synthetic-key: provider details', {status: 429});
      return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({
        kind: 'chat', reply: 'ừ, kể tớ nghe tiếp nhé', draft: null
      })}]}}]});
    };
    // Recreate the worker on every request to exercise durable, not in-memory, quotas.
    const request = (text: string, updateId = ++seq, owner = 123, secret = env.TELEGRAM_WEBHOOK_SECRET) =>
      createWorker(undefined, transport, {now: () => now}).fetch(new Request('https://bot.test/telegram', {
        method: 'POST', headers: {'X-Telegram-Bot-Api-Secret-Token': secret},
        body: JSON.stringify({update_id: updateId, message: {from: {id: owner}, chat: {id: owner, type: 'private'}, text}})
      }), env);
    await request('/remember thích cacao');
    await request('/ai on');
    await request('chào khi runtime tắt');
    assert.equal(calls, 0);
    env.AI_MODE = 'enabled';
    assert.equal((await request('chào', ++seq, 123, 'wrong')).status, 403);
    await request('chào', ++seq, 999);
    await request('/tasks');
    assert.equal(calls, 0);
    const first = ++seq;
    const response = await request('chào cậu', first);
    assert.match(await response.text(), /kể tớ nghe/);
    assert.ok(bodies[0]!.includes('thích cacao'));
    await request('chào cậu', first);
    assert.equal(calls, 1);
    await request('/ai off');
    await request('không gọi nhé');
    assert.equal(calls, 1);
    await request('/ai on');
    now += 61000;
    await request('tiếp chuyện nhé');
    assert.ok(bodies[1]!.includes('chào cậu'));
    assert.equal(calls, 2);
    const limited = await request('hết quota');
    assert.match(await limited.text(), /giới hạn/);
    assert.equal(calls, 2);
    // Changing model cannot bypass the application's shared reservation budget.
    env.GEMINI_MODEL = 'another-model';
    await request('thử lại');
    assert.equal(calls, 2);
    env.GEMINI_MODEL = 'test-model';
    now += 86400001;
    failure = true;
    const failed = await request('lỗi provider');
    const failedText = await failed.text();
    assert.match(failedText, /gián đoạn/);
    assert.ok(!failedText.includes('synthetic-key'));
    assert.equal(calls, 3);
    await request('/tasks');
    assert.equal(calls, 3);
    // Scheduled recovery uses the same runtime and charges failed attempts too.
    const store = new D1WorkStore(db);
    await store.accept({owner: '123', chat: 123, updateId: ++seq, text: 'chờ xử lý'}, now, false);
    await createWorker(undefined, transport, {now: () => now}).scheduled({}, env);
    assert.equal(calls, 4);
    assert.match((await store.result('123', seq))!.text, /gián đoạn/);
    const reservations = await query(db, 'SELECT COUNT(*) AS n FROM ai_reservations').first<{n: number}>();
    assert.equal(reservations!.n, 4);
    assert.equal((await store.tasks('123', 0)).length, 0);
  } finally { await mf.dispose(); }
});
