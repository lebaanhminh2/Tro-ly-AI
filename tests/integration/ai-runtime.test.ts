import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {createWorker} from '../../src/entrypoints/worker.ts';
import {configured, type Env} from '../../src/config/env.ts';
import {query, type Database, type Statement} from '../../src/adapters/d1/database.ts';
import {logChatTiming} from '../../src/adapters/observability.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';

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

test('runtime sleep context suppresses unsolicited sleep and work prompts immediately, survives midnight and expires at wake',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),AI_MODE:'on',GEMINI_API_KEY:'fake',GEMINI_MODEL:'test-model',ASSETS:{fetch:async()=>new Response('')}};
  let now=Date.parse('2026-10-07T19:59:00+07:00'),seq=0;
  const schedule=new ScheduleStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  const requests:any[]=[];
  const transport:typeof fetch=async(_url,options)=>{
   requests.push(JSON.parse(String(options?.body)));
   return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'Tớ đang nghe cậu đây.'}]}}]});
  };
  const send=async(text:string)=>{
   const result=await createWorker(undefined,transport,{now:()=>now}).fetch(new Request('https://local/telegram',{
    method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify({update_id:++seq,message:{from:{id:123},chat:{id:123,type:'private'},text}})
   }),env);
   assert.equal(result.status,200);
   return result.text();
  };
  const context=()=>JSON.parse(requests.at(-1).contents[0].parts[0].text).contextData;
  const instruction=()=>requests.at(-1).systemInstruction.parts[0].text;
  await send('Chào cậu');
  assert.equal(context().notificationState.reason,'active');
  assert.doesNotMatch(instruction(),/Server xác nhận cậu đã báo \/ngu/);
  now=Date.parse('2026-10-07T20:00:00+07:00');
  const calls=requests.length,report=await send('/ngu');
  assert.equal(requests.length,calls,'Bare /ngu records sleep without an LLM call');
  assert.match(report,/ngừng nhắc làm task/);assert.match(report,/lời nhắc cậu đã đặt vẫn theo lịch/);
  now+=60000;
  await send('Kể chuyện một chút nhé');
  assert.equal(context().notificationState.reason,'asleep');
  assert.equal(context().notificationState.reportedAt,Date.parse('2026-10-07T20:00:00+07:00'));
  assert.match(instruction(),/Không tự nhắc đi ngủ/);assert.match(instruction(),/thúc làm task hoặc bật tập trung/);
  assert.match(instruction(),/lời nhắc cậu chủ động đặt vẫn gửi theo lịch/);
  assert.doesNotMatch(instruction(),/Nhắc \/ngu nhẹ nhàng/);
  const sleeping=await schedule.sleepStatus('123',now);
  await schedule.undoSleep('123',now,'runtime-sleep-undo',sleeping.generation!);
  now+=1000;
  await send('Tớ vừa hoàn tác trên web');
  assert.equal(context().notificationState.reason,'active');
  assert.doesNotMatch(instruction(),/Server xác nhận cậu đã báo \/ngu/,'Old /ngu in chat history must not override the server undo');
  await schedule.reportSleep('123',now,'runtime-web-sleep');
  now+=1000;
  await send('Kể tiếp nhé');
  assert.equal(context().notificationState.reason,'asleep');assert.match(instruction(),/Không tự nhắc đi ngủ/);
  now=Date.parse('2026-10-07T23:00:00+07:00');
  await send('/ngu mai mình nói tiếp nhé');
  assert.equal(context().notificationState.reason,'asleep');assert.doesNotMatch(instruction(),/Nhắc \/ngu nhẹ nhàng/);
  now=Date.parse('2026-10-08T00:30:00+07:00');
  await send('Hôm nay đã báo ngủ chưa?');
  assert.equal(context().notificationState.reason,'asleep');
  now=Date.parse('2026-10-08T04:30:00+07:00');
  await send('Chào buổi sáng');
  assert.equal(context().notificationState.reason,'active');
  assert.doesNotMatch(instruction(),/Server xác nhận cậu đã báo \/ngu/);
  now=Date.parse('2026-10-08T22:35:00+07:00');
  await send('Tớ vẫn chưa ngủ');
  assert.equal(context().notificationState.reason,'bedtime');
  assert.match(instruction(),/chưa báo ngủ/);assert.match(instruction(),/Nhắc \/ngu nhẹ nhàng/);
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

async function chatFixture(){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
 for(const file of readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+file,'utf8').replace(/\r?\n/g,' '));
 const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox',AI_MODE:'on',GEMINI_API_KEY:'private-key',GEMINI_MODEL:'test-model'};
 return {mf,db,env};
}
const chatUpdate=(id:number,text='Chào cậu')=>({update_id:id,message:{from:{id:123},chat:{id:123,type:'private'},text}});
const chatRequest=(body:unknown,secret:string)=>new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify(body)});
const modelText=(text:string)=>Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text}]}}]});

function observeDatabase(db:Database,before:(sql:string)=>void|Promise<void>,beforeBatch?:(sql:string)=>void|Promise<void>):Database{
 const originals=new WeakMap<Statement,Statement>();
 const queries=new WeakMap<Statement,string>();
 const wrap=(statement:Statement,sql:string):Statement=>{
  const observed:Statement={
   bind:(...values)=>wrap(statement.bind(...values),sql),
   first:async<T>()=>{await before(sql);return statement.first<T>();},
   all:async<T>()=>{await before(sql);return statement.all<T>();},
   run:async()=>{await before(sql);return statement.run();},
  };
  originals.set(observed,statement);queries.set(observed,sql);return observed;
 };
 return {prepare:sql=>wrap(db.prepare(sql),sql),batch:async statements=>{
  await beforeBatch?.(statements.map(statement=>queries.get(statement)??'').join('\n'));
  return db.batch(statements.map(statement=>originals.get(statement)??statement));
 }};
}

test('ordinary chat omits summary maintenance without losing memory, history, task codes or action context',async()=>{
 const {mf,db,env}=await chatFixture();
 try{
  const now=Date.parse('2026-10-21T12:00:00+07:00');
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  await db.prepare("INSERT INTO tasks(id,owner,title,public_code,created) VALUES('known','123','Known task',42,?)").bind(now).run();
  await db.prepare("INSERT INTO task_steps(id,owner,task_id,step_code,title,created) VALUES('known-step','123','known',1,'Known step',?)").bind(now).run();
  await db.prepare("INSERT INTO conversation_summaries(owner,content,covered_through,version,updated) VALUES('123','Existing long-term context',0,2,?)").bind(now).run();
  for(let i=1;i<=8;i++)await db.prepare("INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES('123',?,?,?,?,?)").bind(i,'History question '+i,'History answer '+i,now-10000+i,now+86400000).run();
  let sourceReads=0;
  const observed=observeDatabase(db,sql=>{if(sql.includes('command_id>? ORDER BY command_id LIMIT 40'))sourceReads++;});
  const bodies:any[]=[];
  const transport:typeof fetch=async(url,options)=>{
   if(!String(url).includes('generativelanguage'))return Response.json({ok:true,result:{message_id:77}});
   const body=JSON.parse(String(options?.body));bodies.push(body);
   if(bodies.length===1)return modelText('Tớ nhớ cuộc trò chuyện của mình.');
   return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[
    {functionCall:{name:'create_task',args:{title:'New explicit task',deadline:null}}},
    {functionCall:{name:'respond',args:{message:'Đã thêm việc mới.'}}},
   ]}}]});
  };
  const runtimeEnv={...env,DB:observed,ASSETS:{fetch:async()=>new Response('asset')}};
  const worker=createWorker(undefined,transport,{now:()=>now});
  assert.equal((await worker.fetch(chatRequest(chatUpdate(901,'Kể tiếp chuyện với tớ nhé'),env.TELEGRAM_WEBHOOK_SECRET),runtimeEnv)).status,200);
  const chat=JSON.parse(bodies[0].contents[0].parts[0].text).contextData;
  assert.equal(Object.hasOwn(chat,'summary_request'),false);
  assert.equal(sourceReads,0,'Chat must not read a transcript it cannot summarize');
  assert.equal(chat.summary.content,'Existing long-term context');
  assert.ok(bodies[0].contents.some((turn:any)=>turn.parts[0].text==='History question 8'));
  assert.equal(chat.notificationState.reason,'active');assert.ok(chat.schedule);assert.ok(chat.habitCompanion);
  assert.equal(chat.task_codes[0].code,'#42');assert.equal(chat.task_codes[0].steps[0].code,'#42.1');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,1);
  assert.equal((await worker.fetch(chatRequest(chatUpdate(902,'/ Thêm một việc mới'),env.TELEGRAM_WEBHOOK_SECRET),runtimeEnv)).status,200);
  const action=JSON.parse(bodies[1].contents[0].parts[0].text).contextData;
  assert.equal(sourceReads,1);assert.ok(action.summary_request.source_turns.length>=8);
  assert.equal(action.summary_request.expected_version,2);
  assert.ok(bodies[1].tools[0].functionDeclarations.some((tool:any)=>tool.name==='update_summary'));
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE title='New explicit task'").first<{n:number}>())!.n,1);
 }finally{await mf.dispose();}
});

test('slow notification reads do not block history, task hierarchy or schedule preparation',{timeout:15000},async()=>{
 const {mf,db,env}=await chatFixture();
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 let timer:ReturnType<typeof setTimeout>|undefined;
 let request:Promise<Response>|undefined;
 try{
  const now=Date.parse('2026-10-21T12:00:00+07:00');
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  let held=false;const started=new Set<string>();let ready!:()=>void;
  const concurrent=new Promise<void>(resolve=>{ready=resolve;});
  const observed=observeDatabase(db,async sql=>{
   if(sql.includes('FROM (SELECT ? AS owner) o')){held=true;await gate;return;}
   if(!held)return;
   if(sql.includes('ORDER BY command_id DESC LIMIT 12'))started.add('history');
   if(sql.includes('ORDER BY status,deadline IS NULL,deadline,public_code LIMIT 200'))started.add('hierarchy');
   if(sql==='SELECT * FROM schedule_settings WHERE owner=?')started.add('schedule');
   if(started.size===3)ready();
  });
  const transport:typeof fetch=async url=>String(url).includes('generativelanguage')?modelText('Tớ đang nghe.'):Response.json({ok:true,result:{message_id:77}});
  request=createWorker(undefined,transport,{now:()=>now}).fetch(chatRequest(chatUpdate(911),env.TELEGRAM_WEBHOOK_SECRET),{...env,DB:observed,ASSETS:{fetch:async()=>new Response('asset')}});
  await Promise.race([concurrent,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('Independent context reads were blocked')),3000);})]);
  assert.deepEqual([...started].sort(),['hierarchy','history','schedule']);
  release();assert.equal((await request).status,200);
 }finally{if(timer)clearTimeout(timer);release();if(request)await request;await mf.dispose();}
});

test('chat timing logs measure stages and provider failures without private data',async t=>{
 const {mf,db,env}=await chatFixture();
 const lines:string[]=[];
 t.mock.method(console,'info',(value:unknown)=>lines.push(String(value)));
 try{
  const metadata={step:1,inputChars:70,owner:'private-owner',prompt:'private-prompt',apiKey:'private-key'};
  logChatTiming('model',12.6,'ok',metadata);
  assert.deepEqual(JSON.parse(lines.pop()!),{event:'chat_timing',phase:'model',durationMs:13,status:'ok',step:1,inputChars:70});
  logChatTiming('model',NaN,'failed');logChatTiming('model',-1,'failed');
  assert.equal(lines.length,0);
  logChatTiming('model',0,'failed',{step:-1,inputChars:Infinity});
  assert.deepEqual(JSON.parse(lines.pop()!),{event:'chat_timing',phase:'model',durationMs:0,status:'failed'});
  let now=Date.parse('2026-10-21T12:00:00+07:00'),failure=false;
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  const transport:typeof fetch=async url=>{
   if(String(url).includes('generativelanguage')){now+=150;return failure?new Response('private-key private-prompt',{status:503}):modelText('private-response');}
   now+=40;return Response.json({ok:true,result:{message_id:77}});
  };
  const worker=createWorker(undefined,transport,{now:()=>now});
  const runtimeEnv={...env,ASSETS:{fetch:async()=>new Response('asset')}};
  const run=(id:number,secret=env.TELEGRAM_WEBHOOK_SECRET)=>worker.fetch(chatRequest(chatUpdate(id,'private-user-message'),secret),runtimeEnv);
  assert.equal((await run(920,'wrong-secret')).status,403);assert.equal(lines.length,0);
  assert.equal((await run(921)).status,200);
  const timings=lines.map(line=>JSON.parse(line));
  const originalPhases=['webhook_prepare','context_prepare','model','reply_delivery','webhook_total'];
  assert.deepEqual(timings.map(row=>row.phase).filter(phase=>originalPhases.includes(phase)),originalPhases);
  for(const phase of ['inbox_accept','reminder_reply','schedule_activity','context_data','pending_read','task_hierarchy','schedule_context','journal_lookup','journal_context','journal_start','model_prepare','journal_finish','command_commit'])assert.ok(timings.some(row=>row.phase===phase),phase);
  assert.equal(timings.find(row=>row.phase==='model').durationMs,150);
  assert.equal(timings.find(row=>row.phase==='reply_delivery').durationMs,40);
  assert.equal(timings.at(-1).durationMs,190);
  assert.ok(timings.every(row=>row.status==='ok'));
  lines.length=0;failure=true;now+=60000;
  assert.equal((await run(922)).status,200);
  assert.equal(lines.map(line=>JSON.parse(line)).find(row=>row.phase==='model').status,'failed');
  assert.doesNotMatch(lines.join('\n'),/private-|telegram-assistant|generativelanguage/);
  for(const line of lines)assert.ok(Object.keys(JSON.parse(line)).every(key=>['event','phase','durationMs','status','step','inputChars','promptTokens','outputTokens','thinkingTokens','cachedTokens','totalTokens'].includes(key)));
 }finally{await mf.dispose();}
});

test('optimized chat sends identical complete model requests for follow-ups and actions',async t=>{
 const now=Date.parse('2026-10-21T12:00:00+07:00');
 const capture=async()=>{
  const {mf,db,env}=await chatFixture();
  try{
   const configured=await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
   assert.ok(configured);
   const day=configured.day;
   await db.prepare("INSERT INTO tasks(id,owner,title,public_code,created) VALUES('known','123','Known task',42,?)").bind(now).run();
   await db.prepare("INSERT INTO task_steps(id,owner,task_id,step_code,title,created) VALUES('known-step','123','known',1,'Known step',?)").bind(now).run();
   await db.prepare("INSERT INTO memories(id,owner,content,kind,source,created) VALUES('memory','123','Persistent preference','preference','user',?)").bind(now).run();
   await db.prepare("INSERT INTO conversation_summaries(owner,content,covered_through,version,updated) VALUES('123','Existing summary',0,2,?)").bind(now).run();
   await db.prepare("INSERT INTO conversation_clarifications(id,owner,subject,question,task_id,created,expires) VALUES('clarification','123','Known task','Which day?','known',?,?)").bind(now-1000,now+86400000).run();
   const operatingDay=typeof day==='number'?day:Math.floor((now+25200000)/86400000);
   await db.prepare("INSERT INTO habits(id,owner,created_day,next_day,created,updated) VALUES('habit','123',?,?,?,?)").bind(operatingDay,operatingDay,now,now).run();
   await db.prepare("INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json) VALUES('123','habit',?,?)").bind(operatingDay,JSON.stringify({name:'Read',metric:'duration',target:2000,unit:'minutes',note:'',commitmentFrom:operatingDay,cadence:{kind:'weekly',quota:3}})).run();
   for(let i=1;i<=12;i++){
    await db.prepare("INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES('123',?,?,?,?,?)").bind(i,'Earlier question '+i,'Earlier reply '+i,now-20000+i,now+86400000).run();
    await db.prepare("INSERT INTO task_progress(id,owner,task_id,content,created,source_update) VALUES(?,'123','known',?,?,?)").bind('progress-'+i,'Finished step '+i,now-1000+i,i).run();
   }
   const requests:any[]=[],reads:number[]=[];let queryCount=0,batches=0;
   const observed=observeDatabase(db,()=>{queryCount++;},()=>{batches++;});
   const transport:typeof fetch=async(url,init)=>{
    if(!String(url).includes('generativelanguage'))return Response.json({ok:true,result:{message_id:77}});
    requests.push(JSON.parse(String(init?.body)));reads.push(queryCount);queryCount=0;
    return modelText('Same reply');
   };
   const worker=createWorker(undefined,transport,{now:()=>now});
   for(const [id,text] of [[940,'Ừ, mai thì sao với #42.1?'],[941,'/ Kiểm tra lại công việc #42']] as const){
    queryCount=0;
    assert.equal((await worker.fetch(chatRequest(chatUpdate(id,text),env.TELEGRAM_WEBHOOK_SECRET),{...env,DB:observed,ASSETS:{fetch:async()=>new Response('asset')}})).status,200);
   }
   assert.equal(requests.length,2);
   const context=JSON.parse(requests[0].contents[0].parts[0].text).contextData;
   assert.equal(context.memories[0].content,'Persistent preference');
   assert.equal(context.clarifications[0].id,'clarification');
   assert.equal(context.task_codes[0].steps[0].code,'#42.1');
   assert.equal(context.progress.recent_steps.length,3);
   assert.ok(JSON.stringify(context.habitCompanion).includes('Read'));
   assert.ok(requests[0].contents.some((turn:any)=>turn.parts[0].text==='Earlier question 12'));
   assert.ok(JSON.parse(requests[1].contents[0].parts[0].text).contextData.summary_request);
   const state=await db.prepare("SELECT (SELECT COUNT(*) FROM command_audit) AS audits,(SELECT COUNT(*) FROM tool_steps) AS steps,(SELECT COUNT(*) FROM outbox) AS replies,(SELECT COUNT(*) FROM tasks) AS tasks").first();
   return {requests,reads,batches,state};
  }finally{await mf.dispose();}
 };
 const original=t.mock.method(D1WorkStore.prototype,'conversationProgress',function(this:D1WorkStore,owner:string){return this.progress(owner,now);});
 let before:Awaited<ReturnType<typeof capture>>;
 try{before=await capture();}finally{original.mock.restore();}
 const after=await capture();
 assert.deepEqual(after.requests,before.requests,'System prompt, tools, history and every context field must stay identical');
 assert.deepEqual(after.reads,before.reads.map(count=>count-3));
 assert.equal(after.batches,before.batches,'Diagnostics must not add database transactions');
 assert.deepEqual(after.state,before.state,'Committed runtime state must stay identical');
 t.diagnostic(JSON.stringify({kind:'chat-input-equivalence',modelCalls:after.requests.length,beforeDbReads:before.reads,afterDbReads:after.reads,batches:after.batches,inputChars:after.requests.map(request=>JSON.stringify(request).length)}));
});

test('timings isolate database waits from provider time and report usage without extra calls',async t=>{
 const {mf,db,env}=await chatFixture();
 const lines:string[]=[];
 t.mock.method(console,'info',(value:unknown)=>lines.push(String(value)));
 try{
  let now=Date.parse('2026-10-21T12:00:00+07:00'),calls=0,sent=0,failJournal=false;
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  t.mock.method(Date,'now',()=>now);
  const observed=observeDatabase(db,sql=>{
   if(sql.startsWith('SELECT state,kind,request_json,result_json FROM tool_steps'))now+=5;
  },sql=>{
   if(sql.includes("'started',?,?)"))now+=11;
   if(sql.includes("UPDATE tool_steps SET state='done'")){
    now+=13;if(failJournal)throw Error('private-database-error');
   }
   if(sql.includes('INSERT INTO command_audit'))now+=19;
  });
  const transport:typeof fetch=async url=>{
   if(String(url).includes('generativelanguage')){
    calls++;now+=150;
    return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'private-response'}]}}],usageMetadata:{promptTokenCount:120,candidatesTokenCount:30,thoughtsTokenCount:10,cachedContentTokenCount:0,totalTokenCount:160}});
   }
   sent++;now+=7;return Response.json({ok:true,result:{message_id:77}});
  };
  const worker=createWorker(undefined,transport,{now:()=>now});
  const run=(id:number)=>worker.fetch(chatRequest(chatUpdate(id),env.TELEGRAM_WEBHOOK_SECRET),{...env,DB:observed,ASSETS:{fetch:async()=>new Response('asset')}});
  assert.equal((await run(950)).status,200);
  const timings=lines.map(line=>JSON.parse(line));
  assert.equal(timings.find(row=>row.phase==='journal_start').durationMs,11);
  assert.equal(timings.find(row=>row.phase==='journal_finish').durationMs,13);
  assert.equal(timings.find(row=>row.phase==='command_commit').durationMs,19);
  assert.equal(timings.find(row=>row.phase==='reply_delivery').durationMs,7);
  assert.deepEqual(timings.find(row=>row.phase==='model'),{event:'chat_timing',phase:'model',durationMs:150,status:'ok',step:0,promptTokens:120,outputTokens:30,thinkingTokens:10,cachedTokens:0,totalTokens:160});
  const step=await db.prepare("SELECT result_json FROM tool_steps WHERE update_id=950 AND step_key='model:0'").first<{result_json:string}>();
  assert.doesNotMatch(step!.result_json,/promptTokens|usageMetadata/);
  await run(950);assert.equal(calls,1);assert.equal(sent,1);
  lines.length=0;now+=60000;failJournal=true;
  assert.equal((await run(951)).status,200);
  assert.equal(lines.map(line=>JSON.parse(line)).find(row=>row.phase==='journal_finish').status,'failed');
  assert.equal(calls,2);
  await run(951);assert.equal(calls,2,'Failed persistence must never repeat the provider call');
  assert.doesNotMatch(lines.join('\n'),/private-/);
 }finally{await mf.dispose();}
});

test('Telegram chat delivers a Gemini response slower than 8s once and replays without another model call',{timeout:30000},async()=>{
 const {mf,db,env}=await chatFixture();
 try{
  let calls=0;const sent:string[]=[];
  const transport:typeof fetch=async(url,options)=>{
   if(String(url).includes('generativelanguage')){
    calls++;
    await new Promise(resolve=>setTimeout(resolve,8250));
    assert.equal(options?.signal?.aborted,false,'The old 8s cutoff must no longer interrupt the response');
    return modelText('Tớ đang nghe cậu đây.');
   }
   sent.push(JSON.parse(String(options?.body)).text);
   return Response.json({ok:true,result:{message_id:77}});
  };
  const worker=createWorker(undefined,transport,{now:Date.now});
  const request=()=>chatRequest(chatUpdate(501),env.TELEGRAM_WEBHOOK_SECRET);
  assert.equal((await worker.fetch(request(),env)).status,200);
  assert.deepEqual(sent,['Tớ đang nghe cậu đây.']);
  assert.equal((await worker.fetch(request(),env)).status,200);
  assert.equal(calls,1);assert.equal(sent.length,1);
  const row=await db.prepare("SELECT state,attempts FROM command_inbox WHERE update_id=501").first<{state:string;attempts:number}>();
  assert.deepEqual(row,{state:'done',attempts:1});
 }finally{await mf.dispose();}
});

test('Telegram persists classified provider failures, delivers a useful reply and never retries the same update',async()=>{
 const {mf,db,env}=await chatFixture();
 try{
  const cases:[number|string,string,RegExp][]=[
   [401,'PROVIDER_HTTP_401',/quyền truy cập/],
   [403,'PROVIDER_HTTP_403',/quyền truy cập/],
   [400,'PROVIDER_HTTP_400',/cấu hình model/],
   [404,'PROVIDER_HTTP_404',/cấu hình model/],
   [503,'PROVIDER_HTTP_503',/Google đang tạm gián đoạn/],
   [429,'PROVIDER_RATE_LIMIT',/giới hạn lượt gọi/],
   ['json','PROVIDER_INVALID_RESPONSE',/không hợp lệ/],
   ['incomplete','PROVIDER_INVALID_RESPONSE',/chưa đầy đủ/],
   ['network','PROVIDER_TRANSPORT_ERROR',/chưa kết nối/],
  ];
  let failure:number|string=503,calls=0;const sent:string[]=[];
  const transport:typeof fetch=async(url,options)=>{
   if(String(url).includes('generativelanguage')){
    calls++;
    if(typeof failure==='number')return new Response('private-key: provider details',{status:failure});
    if(failure==='json')return new Response('private-key: invalid JSON');
    if(failure==='incomplete')return Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{role:'model',parts:[{text:'partial private-key'}]}}]});
    throw Error('private-key: network details');
   }
   sent.push(JSON.parse(String(options?.body)).text);
   return Response.json({ok:true,result:{message_id:100+sent.length}});
  };
  const worker=createWorker(undefined,transport,{now:()=>Date.parse('2026-10-21T09:00:00+07:00')});
  for(const [index,[scenario,code,expected]] of cases.entries()){
   failure=scenario;const id=600+index;
   const run=()=>worker.fetch(chatRequest(chatUpdate(id),env.TELEGRAM_WEBHOOK_SECRET),env);
   assert.equal((await run()).status,200);
   assert.match(sent.at(-1)!,expected);
   assert.doesNotMatch(sent.at(-1)!,/private-key|STEP_UNAVAILABLE/);
   const step=await db.prepare("SELECT state,result_json FROM tool_steps WHERE update_id=? AND step_key='model:0'").bind(id).first<{state:string;result_json:string}>();
   assert.equal(step!.state,'failed');assert.deepEqual(JSON.parse(step!.result_json),{error:code});
   await run();assert.equal(calls,index+1);assert.equal(sent.length,index+1);
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM command_inbox WHERE state='pending'").first<{n:number}>())!.n,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE state!='sent'").first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});

test('all Gemini steps share the owner lease deadline and late action responses cannot write',async()=>{
 const {mf,db,env}=await chatFixture();
 try{
  let now=Date.parse('2026-10-21T10:00:00+07:00'),calls=0,mode='two-step';
  const sent:string[]=[];
  const transport:typeof fetch=async(url,options)=>{
   if(!String(url).includes('generativelanguage')){
    sent.push(JSON.parse(String(options?.body)).text);
    return Response.json({ok:true,result:{message_id:100+sent.length}});
   }
   calls++;
   if(mode==='late-write'){
    now+=25500;
    return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{functionCall:{name:'create_task',args:{title:'Must not be created',deadline:null}}}]}}]});
   }
   if(calls===1){
    now+=mode==='two-step'?18000:24500;
    return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{functionCall:{name:'find_tasks',args:{query:'',status:'active',cursor:0}}}]}}]});
   }
   now+=6000;
   return modelText('Tớ đã đọc danh sách việc.');
  };
  const worker=createWorker(undefined,transport,{now:()=>now});
  const run=(id:number,text='Xem việc giúp tớ')=>worker.fetch(chatRequest(chatUpdate(id,text),env.TELEGRAM_WEBHOOK_SECRET),env);
  assert.equal((await run(701)).status,200);
  assert.equal(calls,2);assert.equal(sent.at(-1),'Tớ đã đọc danh sách việc.');
  now+=60000;calls=0;mode='spent-budget';
  assert.equal((await run(702)).status,200);
  assert.equal(calls,1,'Do not start another model request with less than 1s left');
  assert.match(sent.at(-1)!,/phản hồi quá chậm/);
  const reservations=await db.prepare("SELECT COUNT(*) AS n FROM ai_reservations WHERE command_key LIKE '%:702:%'").first<{n:number}>();
  assert.equal(reservations!.n,1,'No model quota is reserved when the turn budget is already spent');
  now+=60000;calls=0;mode='late-write';
  assert.equal((await run(703,'/ Thêm việc giúp tớ')).status,200);
  assert.equal(calls,1);assert.match(sent.at(-1)!,/phản hồi quá chậm/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,0);
  const step=await db.prepare("SELECT state,result_json FROM tool_steps WHERE update_id=703").first<{state:string;result_json:string}>();
  assert.equal(step!.state,'failed');assert.deepEqual(JSON.parse(step!.result_json),{error:'PROVIDER_TIMEOUT'});
  await run(703,'/ Thêm việc giúp tớ');assert.equal(calls,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM command_inbox WHERE state='pending'").first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});
