import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {createWorker} from '../../src/entrypoints/worker.ts';
import {configured, type Env} from '../../src/config/env.ts';
import {query, type Database} from '../../src/adapters/d1/database.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';

test('native Worker creates a pending card and its confirmation button commits without another model call',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('existing','123','rửa bát',0)").run();
  const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox',AI_MODE:'on',GEMINI_API_KEY:'fake',GEMINI_MODEL:'test-model',AI_DAILY_LIMIT:'4'};
  const sent:Record<string,any>[]=[];let modelCalls=0;
  const transport:typeof fetch=async(url,init)=>{
   if(String(url).includes('generativelanguage')){modelCalls++;return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{functionCall:{name:'create_task',args:{title:'rửa bát',deadline:null}}}]}}]});}
   const body=JSON.parse(String(init?.body)),method=String(url).split('/').at(-1)!;sent.push({method,...body});
   return Response.json({ok:true,result:method==='answerCallbackQuery'?true:{message_id:77}});
  };
  const worker=createWorker(undefined,transport,{now:()=>Date.parse('2026-09-12T12:00:00+07:00')},true);
  const run=(body:unknown)=>worker.fetch(new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(body)}),env);
  assert.equal((await run({update_id:1,message:{from:{id:123},chat:{id:123,type:'private'},text:'/ Thêm cho tớ việc rửa bát'}})).status,200);
  const button=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  const callback={update_id:2,callback_query:{id:'cb',data:button,from:{id:123},message:{message_id:77,chat:{id:123,type:'private'}}}};
  assert.equal((await run(callback)).status,200);assert.equal(modelCalls,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,2);
  assert.equal(sent.at(-1)!.method,'editMessageText');assert.match(sent.at(-1)!.text,/đã thêm/);
  await run({...callback,update_id:3});assert.equal(modelCalls,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,2);
 }finally{await mf.dispose();}
});

test('runtime config requires explicit AI switch, key, model and bounded budget', () => {
  const env: Env = {DB: {} as Database, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32)};
  assert.equal(configured(env), true);
  env.AI_MODE = 'on';
  assert.equal(configured(env), false);
  Object.assign(env, {GEMINI_API_KEY: 'synthetic-key', GEMINI_MODEL: 'test-model', AI_DAILY_LIMIT: '20'});
  assert.equal(configured(env), true);
  assert.equal(configured({...env,AI_DAILY_LIMIT:undefined}),true);
  for (const value of ['', '0', '-1', '501', '1.5', 'NaN', ' 20']) {
    assert.equal(configured({...env, AI_DAILY_LIMIT: value}), false);
  }
  assert.equal(configured({...env, GEMINI_MODEL: '../other-host'}), false);
  assert.equal(configured({...env, GEMINI_API_KEY: 'key\nheader'}), false);
  assert.equal(configured({...env, GEMINI_API_KEY: 'synthetic.key'}), true);
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
      assert.equal(options?.redirect, 'manual');
      assert.equal(new Headers(options?.headers).get('x-goog-api-key'), 'synthetic-key');
      bodies.push(String(options?.body));
      if (failure) return new Response('synthetic-key: provider details', {status: 429});
      return Response.json({candidates: [{finishReason: 'STOP', content: {role:'model',parts: [{text:'ừ, kể tớ nghe tiếp nhé'}]}}]});
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
    env.AI_MODE = 'on';
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
    assert.match(failedText, /Google/);
    assert.ok(!failedText.includes('synthetic-key'));
    assert.equal(calls, 3);
    await request('/tasks');
    assert.equal(calls, 3);
    // Scheduled recovery uses the same runtime and charges failed attempts too.
    const store = new D1WorkStore(db);
    await store.accept({owner: '123', chat: 123, updateId: ++seq, text: 'chờ xử lý'}, now, false);
    await createWorker(undefined, transport, {now: () => now}).scheduled({}, env);
    assert.equal(calls, 4);
    assert.match((await store.result('123', seq))!.text, /Google/);
    const reservations = await query(db, 'SELECT COUNT(*) AS n FROM ai_reservations').first<{n: number}>();
    assert.equal(reservations!.n, 4);
    assert.equal((await store.tasks('123', 0)).length, 0);
  } finally { await mf.dispose(); }
});

test('production without pilot settings passes forty daily and four minute calls, preserving dedupe',async()=>{
 const {reserveAi}=await import('../../src/adapters/d1/memory.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T08:00:00+07:00');
  for(let i=0;i<45;i++)assert.equal(await reserveAi(db,'runtime:gemini','prior:'+i,now,null),true);
  assert.equal(await reserveAi(db,'runtime:gemini','prior:0',now,null),false);
  let calls=0;
  const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),AI_MODE:'on',GEMINI_API_KEY:'fake',GEMINI_MODEL:'test-model'};
  const transport:typeof fetch=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'Still available.'}]}}]});};
  const request=()=>new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({update_id:991,message:{from:{id:123},chat:{id:123,type:'private'},text:'hello'}})});
  const worker=createWorker(undefined,transport,{now:()=>now});
  assert.match(await (await worker.fetch(request(),env)).text(),/Still available/);
  await worker.fetch(request(),env);assert.equal(calls,1);
 }finally{await mf.dispose();}
});
