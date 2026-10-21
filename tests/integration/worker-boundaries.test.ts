import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';

const worker=readFileSync('src/entrypoints/worker.ts','utf8');
const chat=readFileSync('src/entrypoints/worker-chat.ts','utf8');
const scheduler=readFileSync('src/entrypoints/worker-scheduler.ts','utf8');
const webhook=readFileSync('src/entrypoints/telegram-webhook.ts','utf8');

test('whole scheduler invocations stay within 50 queries with tickets, all achievements, archive work and queued replies',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const {sqliteDatabase}=await import('../../scripts/benchmark-habit-runtime.ts');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {runScheduled}=await import('../../src/entrypoints/worker-scheduler.ts');
 for(const history of [0,30])for(const missing of [0,1,5,25,60])for(const phase of [0,3])for(const queued of [false,true])for(const old of [false,true]){
  const raw=new DatabaseSync(':memory:');
  try{
   for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())raw.exec(readFileSync('migrations/'+file,'utf8'));
   raw.exec('PRAGMA foreign_keys=ON');
   let queries=0,now=Date.parse('2026-10-21T10:00:00+07:00')+phase*60000;
   const db=sqliteDatabase(raw,()=>queries++);
   await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
   for(let i=0;i<history+missing;i++){
    const id='t'+String(i).padStart(3,'0'),completed= i<history?now-(history-i+(old?100:0))*86400000:now;
    raw.prepare("INSERT INTO tasks(id,owner,title,status,created) VALUES(?,'123',?,'completed',?)").run(id,id,completed);
    raw.prepare("INSERT INTO task_completions(owner,task_id,completed_at) VALUES('123',?,?)").run(id,completed);
    if(i<history)raw.prepare("INSERT INTO task_ticket_awards(owner,task_id,created) VALUES('123',?,?)").run(id,completed);
   }
   const directIds=['reply:123:fixture','menu:123:fixture'];
   if(queued)for(const id of directIds)raw.prepare('INSERT INTO outbox(id,payload,available) VALUES(?,?,?)').run(id,JSON.stringify({method:'sendMessage',chat_id:123,text:id}),now);
   const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('fixture')}};
   let sent=0;
   const deps={cardsEnabled:false,transport:(async()=>Response.json({ok:true,result:{message_id:++sent}})) as typeof fetch,clock:{now:()=>now},chat:undefined,flushCards:async()=>{}};
   const run=async()=>{
    queries=0;await runScheduled(env,deps);
    assert.ok(queries<=50,JSON.stringify({history,missing,phase,queued,old,now,queries}));
   };
   await run();
   if(queued)for(const id of directIds)assert.equal(raw.prepare('SELECT state FROM outbox WHERE id=?').get(id)!.state,'sent');
   if(phase===0){
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM daily_plans').get()!.n,1);
    now+=3*60000;
   }else now+=12*60000;
   for(let pass=0;pass<4;pass++,now+=12*60000)await run();
   const awards=raw.prepare('SELECT COUNT(*) AS n FROM task_ticket_awards').get()!.n;
   assert.equal(awards,history+missing);
   const account=raw.prepare("SELECT state_json FROM cultivation_accounts WHERE owner='123'").get();
   assert.equal(account?JSON.parse(String(account.state_json)).tickets:0,missing);
   const receipts=raw.prepare("SELECT COUNT(*) AS n FROM cultivation_receipts WHERE operation='task-ticket'").get()!.n;
   assert.equal(receipts,missing);
   assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{raw.close();}
 }
});

test('inbox recovery delivers its reply and defers optional maintenance until the next available slot',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const {sqliteDatabase}=await import('../../scripts/benchmark-habit-runtime.ts');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const {runScheduled}=await import('../../src/entrypoints/worker-scheduler.ts');
 const raw=new DatabaseSync(':memory:');
 try{
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())raw.exec(readFileSync('migrations/'+file,'utf8'));
  let queries=0,now=Date.parse('2026-10-21T10:03:00+07:00');
  const db=sqliteDatabase(raw,()=>queries++);
  await new ScheduleStore(db).configure('123','04:30','22:30',0,now);
  for(let i=0;i<25;i++){
   raw.prepare("INSERT INTO tasks(id,owner,title,status,created) VALUES(?,'123',?,'completed',?)").run('t'+i,'Task '+i,now-100*86400000);
   raw.prepare("INSERT INTO task_completions(owner,task_id,completed_at) VALUES('123',?,?)").run('t'+i,now-100*86400000);
  }
  await new D1WorkStore(db).accept({owner:'123',chat:123,updateId:900,text:'/help'},now,true);
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox' as const,ASSETS:{fetch:async()=>new Response('fixture')}};
  let sent=0;
  const deps={cardsEnabled:false,transport:(async()=>Response.json({ok:true,result:{message_id:++sent}})) as typeof fetch,clock:{now:()=>now},chat:undefined,flushCards:async()=>{}};
  queries=0;await runScheduled(env,deps);
  assert.ok(queries<=50,`Inbox recovery used ${queries} queries`);
  assert.equal(raw.prepare("SELECT state FROM command_inbox WHERE update_id=900").get()!.state,'done');
  assert.equal(raw.prepare("SELECT state FROM outbox WHERE id='reply:123:900'").get()!.state,'sent');
  for(const table of ['task_ticket_awards','achievements'])assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM '+table).get()!.n,0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM tasks WHERE archived_at IS NOT NULL').get()!.n,0);
  now+=12*60000;queries=0;await runScheduled(env,deps);
  assert.ok(queries<=50,`Deferred maintenance used ${queries} queries`);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM task_ticket_awards').get()!.n,25);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM achievements').get()!.n,2);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM tasks WHERE archived_at IS NOT NULL').get()!.n,25);
 }finally{raw.close();}
});

test('worker entrypoint delegates chat, scheduler and webhook responsibilities',()=>{
 assert.match(worker,/createRuntimeChat/);
 assert.match(worker,/runScheduled/);
 assert.match(worker,/handleTelegramWebhook/);
 assert.doesNotMatch(worker,/from ['"]\.\.\/ai\/gemini\.ts/);
 assert.doesNotMatch(worker,/from ['"]\.\.\/adapters\/d1\/work-store\.ts/);
 assert.doesNotMatch(worker,/receiveNudgeReply/);
});

test('entrypoint modules expose explicit bounded responsibilities',()=>{
 assert.match(chat,/export function createRuntimeChat/);
 assert.match(chat,/new Gemini/);
 assert.match(scheduler,/export async function runScheduled/);
 assert.match(scheduler,/queueWorkNudge/);
 assert.match(webhook,/export async function handleTelegramWebhook/);
 assert.match(webhook,/processInbox/);
 assert.match(webhook,/receiveNudgeReply/);
});

test('Telegram webhook acknowledges a directly replied appointment even without native cards',async()=>{
 const {handleTelegramWebhook}=await import('../../src/entrypoints/telegram-webhook.ts');
 const {queueAppointments}=await import('../../src/adapters/d1/conversation-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-10-05T10:00:00+07:00'),env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',ASSETS:{fetch:async()=>new Response('asset')}};
  await db.prepare("INSERT INTO task_appointments(id,owner,task_id,due,subject) VALUES('replied','123',NULL,?,'Example'),('other','123',NULL,?,'Other')").bind(now,now).run();
  await db.prepare("INSERT INTO outbox(id,payload,available,reminder_id,state,message_id,sent_at) VALUES('appointment:replied:1',?,?,'appointment:replied:1','sent',77,?)").bind(JSON.stringify({method:'sendMessage',chat_id:123,text:'Example'}),now,now).run();
  await db.prepare("INSERT INTO outbox(id,payload,available,reminder_id) VALUES('appointment:replied:2',?,?,'appointment:replied:2')").bind(JSON.stringify({method:'sendMessage',chat_id:123,text:'Repeat'}),now+15*60000).run();
  const update={update_id:900,message:{message_id:78,from:{id:123},chat:{id:123,type:'private'},text:'biết rồi',reply_to_message:{message_id:77}}};
  const response=await handleTelegramWebhook(new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(update)}),env,{cardsEnabled:false,transport:async()=>Response.json({ok:true,result:{message_id:99}}),clock:{now:()=>now+16*60000},chat:undefined,flushCards:async()=>{}});
  assert.equal(response.status,200);
  assert.equal((await db.prepare("SELECT responded FROM task_appointments WHERE id='replied'").first<{responded:number}>())!.responded,1);
  assert.equal((await db.prepare("SELECT responded FROM task_appointments WHERE id='other'").first<{responded:number}>())!.responded,0);
  assert.equal((await db.prepare("SELECT state FROM outbox WHERE id='appointment:replied:2'").first<{state:string}>())!.state,'failed');
  await queueAppointments(db,'123',now+20*60000);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE reminder_id='appointment:replied:2' AND state='pending'").first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});

test('all cron phases keep habit settlement running without reading or settling legacy battles', async () => {
 const {DatabaseSync}=await import('node:sqlite');
 const {sqliteDatabase}=await import('../../scripts/benchmark-habit-runtime.ts');
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {HabitService}=await import('../../src/application/habit-service.ts');
 const {D1HabitStore}=await import('../../src/adapters/d1/habit-store.ts');
 const {runScheduled}=await import('../../src/entrypoints/worker-scheduler.ts');
 const raw=new DatabaseSync(':memory:');
 try {
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())raw.exec(readFileSync('migrations/'+file,'utf8'));
  const db=sqliteDatabase(raw),dayMs=86400000;
  let now=Date.parse('2026-10-18T10:00:00+07:00');
  const schedule=new ScheduleStore(db);await schedule.configure('123','04:30','22:30',0,now-2*dayMs);
  const habits=new D1HabitStore(db),service=new HabitService(habits);
  const saved=await service.execute('123','retired_cron_habit',{operation:'create',definition:{name:'Read',metric:'duration',target:20,cadence:{kind:'daily'}}},now-2*dayMs);
  const yesterday=await habits.today('123',now-dayMs);
  await service.execute('123','retired_cron_log',{operation:'log',habitId:saved.habitId,version:1,logVersion:0,day:yesterday.day.day,value:20},now-dayMs);
  const day=(await schedule.ensureDay('123',now))!;
  raw.prepare('INSERT INTO game_accounts(owner,joined_day,anchor_start,next_day,updated,rank_lock_until_day) VALUES(?,?,?,?,?,?)')
   .run('123',day.day-10,day.start_at-10*dayMs,day.day-5,now,day.day+10);
  raw.prepare("INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES('123','old_active','retired','active',?,'{}','{}',?,?)").run(day.day-5,now,now);
  const legacy=()=>[raw.prepare('SELECT * FROM game_accounts').all(),raw.prepare('SELECT * FROM battles').all(),raw.prepare('SELECT * FROM game_days').all()];
  const before=legacy(),seen=new Set<string>();
  const guarded:Database={prepare:sql=>{assert.doesNotMatch(sql,/\b(?:game_accounts|game_days|game_receipts|battles|practice_versions)\b/i);return db.prepare(sql);},batch:writes=>db.batch(writes)};
  const env={DB:guarded,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',ASSETS:{fetch:async()=>new Response('fixture')}};
  const transport:typeof fetch=async()=>new Response(JSON.stringify({ok:true,result:{message_id:1}}),{headers:{'Content-Type':'application/json'}});
  for(let minute=0;minute<12;minute++,now+=60000){
   seen.add(String(Math.floor(now/60000)%4)+':'+String(Math.floor(now/240000)%3));
   await runScheduled(env,{cardsEnabled:false,transport,clock:{now:()=>now},chat:undefined,flushCards:async()=>{}});
  }
  assert.equal(seen.size,12);
  assert.ok(Number(raw.prepare('SELECT COUNT(*) AS n FROM habit_outcomes WHERE owner=?').get('123')!.n)>0);
  assert.deepEqual(legacy(),before);
 }finally{raw.close();}
});
