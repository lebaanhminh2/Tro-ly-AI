import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import ts from 'typescript';
import {resolve} from 'node:path';

test('real workerd fetch supports production adapters and never follows credential redirects', async () => {
  let leakedRequests = 0;
  const counts = new Map<string, number>();
  // Replace only the external network, not workerd's native fetch implementation.
  const outboundService = async (request: Request) => {
    const url = new URL(request.url);
    if (url.hostname === 'credential-trap.invalid') { leakedRequests++; return Response.json({}); }
    const count = (counts.get(url.pathname) ?? 0) + 1;
    counts.set(url.pathname, count);
    if (count === 2) return new Response('', {status: 302, headers: {location: 'https://credential-trap.invalid/'}});
    if (url.hostname === 'api.telegram.org') return Response.json({ok: true, result: {message_id: 7}});
    if (url.pathname === '/token') return Response.json({access_token: 'access'});
    if (url.pathname === '/revoke') return new Response('');
    if (url.hostname === 'generativelanguage.googleapis.com') return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify({kind: 'chat', reply: 'hello', draft: null})}]}}]});
    throw Error('Unexpected outbound request');
  };

  // Transpile the actual source modules, not a reimplementation of their fetch logic.
  const modules = readdirSync('src', {recursive: true}).filter((p): p is string => typeof p === 'string' && p.endsWith('.ts'))
    .map(p => ({type: 'ESModule' as const, path: resolve('src', p),
      contents: ts.transpileModule(readFileSync(`src/${p}`, 'utf8'), {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}
      }).outputText}));
  const script = `
    import worker from './src/entrypoints/worker.ts';
    import {deliver} from './src/adapters/telegram/api.ts';
    import {GoogleClient} from './src/adapters/google-calendar/client.ts';
    export default {async fetch(request, env) {
      if (new URL(request.url).pathname === '/card-probe') return worker.fetch(new Request('https://test.invalid/telegram',{
        method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'x'.repeat(32)},body:JSON.stringify({update_id:99,message:{from:{id:123},chat:{id:123,type:'private'},text:'/tasks'}})
      }),{...env,DELIVERY_MODE:'outbox',TELEGRAM_BOT_TOKEN:'123:fake'});
      if (new URL(request.url).pathname === '/telegram') return worker.fetch(request, env);
      const result = {};
      result.telegram = await deliver('123:fake', {method:'sendMessage',chat_id:123,text:'test'});
      result.telegramRedirect = await deliver('123:fake', {method:'sendMessage',chat_id:123,text:'test'});
      result.clearKeyboard = await deliver('123:fake', {method:'editMessageReplyMarkup',chat_id:123,message_id:7,reply_markup:{inline_keyboard:[]}});
      result.editText = await deliver('123:fake', {method:'editMessageText',chat_id:123,message_id:7,text:'Updated',reply_markup:{inline_keyboard:[]}});
      const google = new GoogleClient({clientId:'fake',clientSecret:'fake',redirectUri:'https://test.invalid/oauth/google/callback'});
      result.refresh = await google.refresh('fake');
      try {await google.refresh('fake');} catch(e) {result.refreshRedirect = e.message;}
      await google.revoke('fake'); result.revoke = true;
      try {await google.revoke('fake');} catch(e) {result.revokeRedirect = e.message;}
      return Response.json(result);
    }};`;
  const mf = new Miniflare({modulesRoot: process.cwd(), modules: [{type: 'ESModule', path: resolve('runtime-probe.js'), contents: script}, ...modules],
    outboundService, d1Databases: ['DB'], bindings: {
      TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      AI_MODE: 'enabled', GEMINI_API_KEY: 'fake', GEMINI_MODEL: 'test-model', AI_DAILY_LIMIT: '10'
    }});
  try {
    const db = await mf.getD1Database('DB');
    for (const file of readdirSync('migrations').filter(p => p.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(`migrations/${file}`, 'utf8').replace(/\r?\n/g, ' '));
    }
    const probe = await mf.dispatchFetch('https://test.invalid/probe');
    const probeText = await probe.text();
    assert.equal(probe.status, 200, probeText);
    const result = JSON.parse(probeText) as Record<string, any>;
    assert.equal(result.telegram.state, 'sent');
    assert.equal(result.telegramRedirect.state, 'uncertain');
    assert.equal(result.clearKeyboard.state, 'sent');
    assert.equal(result.editText.state, 'sent');
    assert.equal(result.refresh, 'access');
    assert.equal(result.refreshRedirect, 'GOOGLE_HTTP_302');
    assert.equal(result.revoke, true);
    assert.equal(result.revokeRedirect, 'REVOCATION_UNCONFIRMED');
    for (const [id, text, expected] of [[1, '/ai on', ''], [2, 'hello', 'hello'], [3, 'again', 'gián đoạn']] as const) {
      const response = await mf.dispatchFetch('https://test.invalid/telegram', {
        method: 'POST', headers: {'X-Telegram-Bot-Api-Secret-Token': 'x'.repeat(32)},
        body: JSON.stringify({update_id: id, message: {from: {id: 123}, chat: {id: 123, type: 'private'}, text}})
      });
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes(expected));
    }
    assert.equal(leakedRequests, 0);
    const cardsResponse=await mf.dispatchFetch('https://test.invalid/card-probe');
    assert.equal(cardsResponse.status,200);
    const rendered=await db.prepare('SELECT rendered_revision,message_id FROM ui_cards LIMIT 1').first<{rendered_revision:number;message_id:number}>();
    assert.equal(rendered!.rendered_revision,1);assert.equal(rendered!.message_id,7);
  } finally {await mf.dispose();}
});
