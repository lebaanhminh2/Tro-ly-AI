import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {miniAppApi} from '../../src/entrypoints/mini-app.ts';
import {HealthyStore} from '../../src/adapters/d1/healthy-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
test('Mini App rejects unauthenticated/cross-origin writes and retries one draw safely',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.parse('2026-09-13T08:00:00+07:00');
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const params=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  const data=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(data).digest('hex'));
  const req=(origin='https://local',init=params.toString())=>new Request('https://local/api/cultivation',{method:'POST',headers:{Origin:origin,'X-Telegram-Init-Data':init},body:JSON.stringify({id:'draw_test_001',operation:'draw'})});
  assert.equal((await miniAppApi(req('https://other'),env,now)).status,403);
  assert.equal((await miniAppApi(req('https://local','bad'),env,now)).status,401);
  assert.equal((await miniAppApi(req(),env,now)).status,409);
  await db.prepare('INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES(?,270,1350,?)').bind('123',now).run();
  const store=new HealthyStore(db);
  await store.mutate('123','fixture','seed',{},now,s=>({state:{...s,tickets:1},result:{}}));
  const first=await miniAppApi(req(),env,now);assert.equal(first.status,200);
  const second=await miniAppApi(req(),env,now);assert.equal(second.status,200);
  assert.deepEqual(await first.json(),await second.json());
  assert.equal((await store.read('123')).state.tickets,0);
 }finally{await mf.dispose();}
});

test('settings retry is idempotent and keeps the current day snapshot unchanged',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const store=new ScheduleStore(db),now=Date.parse('2026-09-13T08:00:00+07:00');
  const first=await store.configure('123','04:30','22:30',0,now,'setup_001');
  await store.configure('123','04:30','22:30',0,now,'setup_001');
  assert.equal((await store.settings('123'))!.version,1);
  const changed=await store.configure('123','05:00','23:00',1,now,'setup_002');
  assert.equal(changed!.target_sleep,first!.target_sleep);
 }finally{await mf.dispose();}
});

test('Telegram menu registration uses a boolean API receipt and never needs a model',async()=>{
 const {deliver}=await import('../../src/adapters/telegram/api.ts');
 let count=0;
 const r=await deliver('123:fake',{method:'setChatMenuButton',chat_id:123,menu_button:{type:'web_app',text:'Open',web_app:{url:'https://local/app/'}}},async(url,init)=>{
  count++;assert.ok(String(url).endsWith('/setChatMenuButton'));
  assert.equal(JSON.parse(String(init?.body)).menu_button.web_app.url,'https://local/app/');
  return Response.json({ok:true,result:true});
 });
 assert.equal(r.state,'sent');assert.equal(count,1);
});

test('asset routing serves app files with security headers and API never bypasses authentication',async()=>{
 const {createWorker}=await import('../../src/entrypoints/worker.ts');
 const seen:string[]=[];
 const env={DB:{} as Database,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',ASSETS:{fetch:async(request:Request)=>{seen.push(new URL(request.url).pathname);return new Response('<html>app</html>',{headers:{'Content-Type':'text/html'}});}}};
 const worker=createWorker();
 const redirect=await worker.fetch(new Request('https://local/app'),env);
 assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://local/app/');
 const page=await worker.fetch(new Request('https://local/app/'),env);
 assert.equal(page.status,200);assert.equal(page.headers.get('x-content-type-options'),'nosniff');
 assert.ok(page.headers.get('content-security-policy')?.includes("object-src 'none'"));
 assert.deepEqual(seen,['/']);
 const api=await worker.fetch(new Request('https://local/api/bootstrap'),env);
 assert.equal(api.status,401);assert.deepEqual(seen,['/']);
});

test('sleep suppresses reminders but allows task tickets and draws; errors distinguish no tickets from suspension',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T22:30:00+07:00'),token='123:fake';
  const p=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const req=(id:string)=>new Request('https://local/api/cultivation',{method:'POST',headers:{Origin:'https://local','X-Telegram-Init-Data':p.toString()},body:JSON.stringify({id,operation:'draw'})});
  const schedule=new ScheduleStore(db),work=new D1WorkStore(db),ledger=new HealthyStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  await schedule.reportSleep('123',now);
  assert.equal(await schedule.isResting('123',now),true);
  assert.equal((await (await miniAppApi(req('draw_empty'),env,now)).json() as {error:string}).error,'NO_TICKETS');
  const task=await work.mutateHierarchy('123','create_after_sleep',{operation:'create',title:'After sleep'},now);
  await work.mutateHierarchy('123','done_after_sleep',{operation:'complete',taskId:String(task.id),version:1,complete:true,confirm:true},now);
  assert.equal((await ledger.read('123')).state.tickets,1);
  const first=await miniAppApi(req('draw_after_sleep'),env,now),second=await miniAppApi(req('draw_after_sleep'),env,now);
  assert.equal(first.status,200);assert.deepEqual(await first.json(),await second.json());
  assert.equal((await ledger.read('123')).state.tickets,0);
  await ledger.mutate('123','fixture_suspend','test',{},now,s=>({state:{...s,suspended:true,tickets:1},result:{}}));
  const blocked=await miniAppApi(req('draw_suspended'),env,now);
  assert.equal((await blocked.json() as {error:string}).error,'ACCOUNT_SUSPENDED');
 }finally{await mf.dispose();}
});

test('configured outside first active window is not misreported as missing setup',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const {planCommand}=await import('../../src/application/plan-command.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-15T00:30:00+07:00'),schedule=new ScheduleStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  await assert.rejects(schedule.openDialog('123',now),/NO_ACTIVE_DAY/);
  const response=await planCommand({owner:'123',chat:123,updateId:1,text:'/lich'},new D1WorkStore(db),now,async()=>{throw Error('should not call model');});
  assert.match(response.view.text,/Thời gian hôm nay/);assert.match(response.view.text,/ứng dụng/);
 }finally{await mf.dispose();}
});

test('recurring reminder rejects text time on the server, not just in the form',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.now();
  const params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const response=await miniAppApi(new Request('https://local/api/reminders',{method:'POST',headers:{Origin:'https://local','X-Telegram-Init-Data':params.toString()},body:JSON.stringify({id:'invalid_time_001',rule:{title:'Test',kind:'daily',times:['abc'],weekdays:[],startDate:'2026-09-14',endDate:null,enabled:true,version:0}})}),env,now);
  assert.equal(response.status,400);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM recurrence_rules').first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});

test('bootstrap includes chat-created one-time reminders in the same management list',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.parse('2026-09-14T12:00:00+07:00');
  await db.prepare("INSERT INTO task_appointments(id,owner,task_id,due,subject) VALUES('chat-reminder','123',NULL,?,'collect paper')").bind(now+86400000).run();
  const params=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const response=await miniAppApi(new Request('https://local/api/bootstrap',{headers:{'X-Telegram-Init-Data':params.toString()}}),{DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token},now);
  assert.equal(response.status,200);
  const body=await response.json() as {reminders:{id:string;origin:string;kind:string;times:string[]}[]};
  assert.deepEqual(body.reminders[0]?.times,['12:00']);assert.equal(body.reminders[0]?.origin,'appointment');assert.equal(body.reminders[0]?.kind,'once');
 }finally{await mf.dispose();}
});

test('Mini App persists task notes and hides delivered one-time reminders next operating day',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.parse('2026-09-14T12:00:00+07:00'),headers=(at:number)=>{
   const params=new URLSearchParams({auth_date:String(at/1000),user:JSON.stringify({id:123})});
   params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
   return {'X-Telegram-Init-Data':params.toString(),'Content-Type':'application/json'};
  };
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  await db.prepare('INSERT INTO schedule_settings(owner,start_minutes,sleep_minutes,updated) VALUES(?,270,1350,?)').bind('123',now).run();
  const created=await miniAppApi(new Request('https://local/api/tasks',{method:'POST',headers:headers(now),body:JSON.stringify({id:'note_create_001',operation:'create',title:'Bài tập',note:'Công thức ở trang 12',deadline:null})}),env,now);
  assert.equal(created.status,200);const taskId=String(((await created.json()) as {result:{id:string}}).result.id);
  const saved=await db.prepare('SELECT note FROM tasks WHERE id=?').bind(taskId).first<{note:string}>();assert.equal(saved?.note,'Công thức ở trang 12');
  const updated=await miniAppApi(new Request('https://local/api/tasks',{method:'POST',headers:headers(now),body:JSON.stringify({id:'note_update_001',operation:'edit',taskId,version:1,title:'Bài tập',note:'Đổi sang trang 14'})}),env,now);
  assert.equal(updated.status,200);assert.equal((await db.prepare('SELECT note FROM tasks WHERE id=?').bind(taskId).first<{note:string}>())?.note,'Đổi sang trang 14');
  await db.prepare("INSERT INTO task_appointments(id,owner,task_id,due,status,subject) VALUES('delivered-once','123',NULL,?,'expired','Dậy thôi')").bind(Date.parse('2026-09-14T07:00:00+07:00')).run();
  await db.exec("INSERT INTO recurrence_rules(id,owner,title,kind,times_json,weekdays_json,start_date,end_date,enabled,version,created) VALUES('web-once','123','Nộp bài','once','[\"08:00\"]','[]','2026-09-14',NULL,1,1,0); INSERT INTO recurrence_occurrences(id,rule_id,owner,rule_version,slot,due,status) VALUES('web-once-slot','web-once','123',1,'2026-09-14T08:00',1789347600000,'sent')");
  const initial=await miniAppApi(new Request('https://local/api/bootstrap',{headers:headers(now)}),env,now);
  const initialBody=await initial.json() as {day:{version:number}};
  const scheduled=await miniAppApi(new Request('https://local/api/schedule',{method:'POST',headers:headers(now),body:JSON.stringify({id:'schedule_first_001',version:initialBody.day.version,free:[],busy:[],estimates:[{id:taskId,minutes:35}]})}),env,now);
  assert.equal(scheduled.status,200);
  const current=await miniAppApi(new Request('https://local/api/bootstrap',{headers:headers(now)}),env,now);
  const currentBody=await current.json() as {tasks:{id:string;note:string}[];reminders:{id:string;delivered?:boolean;past?:boolean}[];dailyPlan:{version:number}};
  assert.equal(currentBody.tasks.find(task=>task.id===taskId)?.note,'Đổi sang trang 14');
  assert.equal(currentBody.reminders.find(item=>item.id==='delivered-once')?.delivered,false);assert.equal(currentBody.reminders.find(item=>item.id==='delivered-once')?.past,true);
  assert.equal(currentBody.reminders.find(item=>item.id==='web-once')?.delivered,true);
  const editedPlan=await miniAppApi(new Request('https://local/api/day-plan',{method:'POST',headers:headers(now),body:JSON.stringify({id:'day_plan_edit_001',version:currentBody.dailyPlan.version,items:[{taskId,minutes:35}]})}),env,now);
  assert.equal(editedPlan.status,200);
  const next=now+86400000;
  const tomorrow=await miniAppApi(new Request('https://local/api/bootstrap',{headers:headers(next)}),env,next);
  const tomorrowBody=await tomorrow.json() as {reminders:{id:string}[]};assert.ok(!tomorrowBody.reminders.some(item=>item.id==='delivered-once'));assert.ok(!tomorrowBody.reminders.some(item=>item.id==='web-once'));
 }finally{await mf.dispose();}
});
