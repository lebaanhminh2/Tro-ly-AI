import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import worker, { createWorker, flushOutbox } from '../../src/entrypoints/worker.ts';
import { deliver } from '../../src/adapters/telegram/api.ts';
import { recoverInterrupted } from '../../src/adapters/d1/database.ts';
import { trialChat } from '../../experiments/ai-trial/chat.ts';
import { GeminiTrial } from '../../experiments/ai-trial/gemini.ts';
import type { Env } from '../../src/config/env.ts';
import type { Database } from '../../src/adapters/d1/database.ts';
import { getTask, listTasks } from '../../src/adapters/d1/tasks.ts';
import { propose, resolveProposal } from '../../src/adapters/d1/proposals.ts';

test('Telegram webhook and D1: complete flow, duplicate, owner, stale, expiry, rollback', async () => {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("test"); } }', d1Databases: ['DB'] });
  try {
    const d1 = await mf.getD1Database('DB');
    for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()) await d1.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
    const db = d1 as unknown as Database;
    const secret = 'synthetic-webhook-secret-12345678';
    const env: Env = { DB: db, TELEGRAM_USER_ID: '123456', TELEGRAM_WEBHOOK_SECRET: secret, AI_MODE: 'off' };
    let seq = 0;
    function update(text: string, callback = false, id = ++seq, owner = 123456) {
      const message = { message_id: id, from: { id: owner }, chat: { id: owner, type: 'private' }, text };
      return callback ? { update_id: id, callback_query: { id: `cb${id}`, from: { id: owner }, message, data: text } } : { update_id: id, message };
    }
    const send = (body: unknown, token = secret) => worker.fetch(new Request('https://local/telegram', {
      method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': token }, body: JSON.stringify(body)
    }), env);
    const capture = update('/add Bài vẽ');
    assert.equal((await send(capture, 'wrong')).status, 403);
    assert.equal((await send(update('/add чужой', false, ++seq, 999))).status, 200);
    assert.equal((await listTasks(db, '123456')).length, 0);
    const proposal = await (await send(capture)).json() as any;
    assert.equal(proposal.method, 'sendMessage');
    assert.equal((await listTasks(db, '123456')).length, 0);
    assert.equal(await (await send(capture)).text(), 'OK');
    const yes = proposal.reply_markup.inline_keyboard[0][0].callback_data;
    await send(update(yes, true));
    await send(update(yes, true));
    const tasks = await listTasks(db, '123456');
    assert.equal(tasks.length, 1);
    const task = tasks[0]!;
    assert.equal(task.deadline, null);
    await send(update(`deadline:${task.id}`, true));
    const invalid = await (await send(update('31/02/2030 12:00'))).json() as any;
    assert.match(invalid.text, /ngày giờ tương lai/);
    const changed = await (await send(update('12/09/2030 20:00'))).json() as any;
    assert.equal((await getTask(db, '123456', task.id))!.deadline, null);
    await send(update(changed.reply_markup.inline_keyboard[0][0].callback_data, true));
    assert.equal((await getTask(db, '123456', task.id))!.deadline, '2030-09-12T20:00:00+07:00');
    assert.equal((await getTask(db, '123456', task.id))!.version, 2);
    // New repository calls still see persisted D1 data (not an in-memory Task Map).
    const listing = await (await send(update('/tasks'))).json() as any;
    assert.match(listing.text, /Bài vẽ/);
    const now = Date.now();
    const p1 = await propose(db, '123456', 1001, task.id, '2031-01-01T12:00:00+07:00', 2, now);
    const p2 = await propose(db, '123456', 1002, task.id, '2032-01-01T12:00:00+07:00', 2, now);
    assert.equal(await resolveProposal(db, 'other', p1, true, now), false);
    assert.equal(await resolveProposal(db, '123456', p1, true, now + 300001), false);
    assert.equal(await resolveProposal(db, '123456', p2, true, now), true);
    await assert.rejects(resolveProposal(db, '123456', p1, true, now));
    assert.equal((await getTask(db, '123456', task.id))!.deadline, '2032-01-01T12:00:00+07:00');
    const stale = await db.prepare('SELECT status FROM proposals WHERE id=?').bind(p1).first<{ status: string }>();
    assert.equal(stale!.status, 'pending'); // trigger error rolled the transaction back
    const p3 = await propose(db, '123456', 1003, null, 'No thanks', 0, now);
    await resolveProposal(db, '123456', p3, false, now);
    assert.equal(await resolveProposal(db, '123456', p3, true, now), false);
    assert.equal((await listTasks(db, '123456')).length, 1);
    const concurrent = update('/add Concurrent');
    const responses = await Promise.all([send(concurrent), send(concurrent)]);
    assert.ok(responses.every(r => r.status === 200));
    await worker.scheduled({}, env); // Queue ACK may precede execution under an owner lease.
    const once = await db.prepare('SELECT COUNT(*) AS count FROM proposals WHERE id=?').bind(`p123456_${concurrent.update_id}`).first<{count:number}>();
    assert.equal(once!.count, 1);
    const ai = await (await send(update('Chào cậu'))).json() as any;
    assert.match(ai.text, /chưa bật/);
    const mockClient = new GeminiTrial({ apiKey: 'synthetic', model: 'synthetic', transport: async () =>
      new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ kind: 'chat', reply: 'ơ, kể tớ nghe nào', draft: null }) }] } }] })) });
    const chatWorker = createWorker(trialChat(mockClient));
    const chatRequest = new Request('https://local/telegram', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(update('chào')) });
    assert.match((await (await chatWorker.fetch(chatRequest, env)).json() as any).text, /kể tớ nghe/);
    assert.equal((await listTasks(db, '123456')).length, 1);
    assert.equal((await worker.fetch(new Request('https://local/telegram', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: 'x'.repeat(20001) }), env)).status, 413);
    assert.equal((await worker.fetch(new Request('https://local/telegram', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: '{' }), env)).status, 400);
  } finally { await mf.dispose(); }
});

test('Bot API classifies failures without retrying or leaking token', async () => {
  for (const [status,body,state] of [
    [200,{ok:true,result:{message_id:42}},'sent'],
    [429,{ok:false,error_code:429,parameters:{retry_after:5}},'pending'],
    [403,{ok:false,error_code:403},'failed'],
    [500,{ok:false,error_code:500},'uncertain']
  ] as const) {
    let count=0;
    const result=await deliver('123:fake',{method:'sendMessage',chat_id:123,text:'test'},async (url,opts)=>{
      count++; assert.match(String(url), /^https:\/\/api.telegram.org\/bot/); assert.equal(opts?.redirect,'manual');
      return new Response(JSON.stringify(body),{status});
    });
    assert.equal(result.state,state); assert.equal(count,1);
  }
  assert.equal((await deliver('secret',{method:'sendMessage',text:'test'},async()=>{throw new Error('secret');})).state,'uncertain');
  assert.equal((await deliver('secret',{method:'sendMessage',text:'test'},async()=>new Response('bad JSON'))).state,'uncertain');
  const timed=await deliver('secret',{method:'sendMessage',text:'test'},async(_url,options)=>new Promise((_resolve,reject)=>{
    options?.signal?.addEventListener('abort',()=>reject(new Error('secret')));
  }),5);
  assert.equal(timed.state,'uncertain');
});

test('edit message and no-op edit are successful without misclassifying other HTTP 400 errors', async () => {
  const payload={method:'editMessageText',chat_id:123,message_id:7,text:'Updated',reply_markup:{inline_keyboard:[]}};
  const result=await deliver('fake',payload,async(_url,init)=>{
    assert.equal(init?.redirect,'manual');
    assert.deepEqual(JSON.parse(String(init?.body)).reply_markup,{inline_keyboard:[]});
    return Response.json({ok:true,result:{message_id:7}});
  });
  assert.deepEqual(result,{state:'sent',messageId:7});
  const noop:typeof fetch=async()=>Response.json({ok:false,error_code:400,description:'Bad Request: message is not modified: specified new message content and reply markup are exactly the same'},{status:400});
  assert.deepEqual(await deliver('fake',payload,noop),{state:'sent',messageId:7});
  assert.equal((await deliver('fake',{...payload,method:'sendMessage'},noop)).state,'failed');
  assert.equal((await deliver('fake',payload,async()=>Response.json({ok:false,error_code:400,description:'Bad Request: message to edit not found'},{status:400}))).state,'failed');
});

test('delivery diagnostics expose only fixed labels and numeric status, never provider secrets', async () => {
  const logs: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { logs.push(args.join(' ')); };
  try {
    const secret = 'private-token-and-chat';
    const payload = {method: 'sendMessage', chat_id: 123, text: secret};
    await deliver(secret, payload, async () => { throw new TypeError('Illegal invocation ' + secret); });
    await deliver(secret, payload, async () => new Response(secret, {status: 502}));
    await deliver(secret, payload, async () => Response.json({ok: false, error_code: 401, description: secret}, {status: 401}));
    await deliver(secret, payload, async () => Response.json({ok: false, error_code: secret, description: secret}, {status: 500}));
    await deliver(secret, payload, async (_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error(secret)), {once: true});
    }), 5);
    assert.deepEqual(logs.map(line => JSON.parse(line).code), [
      'TRANSPORT_ILLEGAL_INVOCATION', 'RESPONSE_DECODE_FAILED', 'API_REJECTED', 'API_REJECTED', 'TIMEOUT'
    ]);
    assert.equal(JSON.parse(logs[1]!).httpStatus, 502);
    assert.equal(JSON.parse(logs[2]!).apiStatus, 401);
    assert.ok(!logs.join('').includes(secret));
    for (const line of logs) assert.ok(Object.keys(JSON.parse(line)).every(k => ['event', 'code', 'phase', 'httpStatus', 'apiStatus'].includes(k)));
  } finally { console.warn = original; }
});

test('outbox persisted replies, callback ack, retry cap, restart recovery and concurrent send claim', async()=>{
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
  try {
    const db=await mf.getD1Database('DB') as unknown as Database & {exec(sql:string):Promise<unknown>};
    for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
    const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'synthetic-secret-long-enough',DELIVERY_MODE:'outbox',TELEGRAM_BOT_TOKEN:'123:fake'};
    const calls:string[]=[];
    const transport:typeof fetch=async(url)=>{calls.push(String(url).split('/').at(-1)!); return Response.json({ok:true,result:String(url).endsWith('answerCallbackQuery')?true:{message_id:99}});};
    const request=(id:number,callback=false)=>new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(callback?{
      update_id:id,callback_query:{id:'cb',data:'no:p123_1',from:{id:123},message:{chat:{id:123,type:'private'}}}
    }:{update_id:id,message:{from:{id:123},chat:{id:123,type:'private'},text:'/add A'}})});
    assert.equal(await (await createWorker(undefined,transport).fetch(request(1),env)).text(),'OK');
    await createWorker(undefined,transport).fetch(request(1),env);
    assert.deepEqual(calls,['sendMessage']);
    await createWorker(undefined,transport).fetch(request(2,true),env);
    assert.deepEqual(calls,['sendMessage','answerCallbackQuery','sendMessage']);
    const row=await db.prepare("SELECT state,message_id FROM outbox WHERE id='reply:123:1'").first<any>();
    assert.equal(row.state,'sent'); assert.equal(row.message_id,99);
    const now=Date.now();
    await db.prepare("INSERT INTO updates(id,status,created,chat) VALUES(3,'processing',?,123)").bind(now-61000).run();
    await recoverInterrupted(db,now);
    assert.equal((await db.prepare('SELECT status FROM updates WHERE id=3').first<any>()).status,'interrupted');
    await Promise.all([flushOutbox(env,transport,now,()=>0),flushOutbox(env,transport,now,()=>0)]);
    assert.equal(calls.filter(x=>x==='sendMessage').length,3);
    await db.prepare("INSERT INTO outbox(id,payload,available) VALUES('retry',?,?)").bind(JSON.stringify({method:'sendMessage',chat_id:123,text:'rate limited'}),now).run();
    let retries=0;
    const limited:typeof fetch=async()=>{retries++; return Response.json({ok:false,error_code:429,parameters:{retry_after:10}},{status:429});};
    await flushOutbox(env,limited,now,()=>0); await flushOutbox(env,limited,now+9999,()=>0); assert.equal(retries,1);
    await flushOutbox(env,limited,now+10000,()=>0); await flushOutbox(env,limited,now+20000,()=>0);
    assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='retry'").first<any>()).state,'failed');
    await db.prepare("INSERT INTO outbox(id,payload,state,available,lease) VALUES('crashed','{}','sending',?,?)").bind(now,now-1).run();
    await createWorker(undefined,transport).scheduled({},env);
    assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='crashed'").first<any>()).state,'uncertain');
  } finally {await mf.dispose();}
});
