import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {miniAppApi} from '../../src/entrypoints/mini-app.ts';
import {HealthyStore} from '../../src/adapters/d1/healthy-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';

test('sleep controls share bot and browser state, reject forged timing and keep retries from repeating undone actions',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {approveBrowserCode}=await import('../../src/adapters/d1/browser-auth.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.parse('2026-10-07T20:00:00+07:00'),env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const telegram={'X-Telegram-Init-Data':params.toString()},cookies=(r:Response)=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const post=(path:string,body:unknown,headers:Record<string,string>=telegram,at=now)=>miniAppApi(new Request('https://local/api/'+path,{method:'POST',headers:{Origin:'https://local','X-Minh-Anh-Request':'1',...headers},body:JSON.stringify(body)}),env,at);
  const get=(at=now)=>miniAppApi(new Request('https://local/api/bootstrap',{headers:telegram}),env,at);
  const schedule=new ScheduleStore(db),healthy=new HealthyStore(db);
  const input={id:'sleep_api_report',operation:'report'};
  assert.equal((await post('sleep',input,{})).status,401);
  assert.equal((await post('sleep',input)).status,409,'Web report requires saved settings');
  await schedule.configure('123','04:30','22:30',0,now);
  for(const body of [{...input,reportedAt:now-60000},{...input,owner:'456'},{...input,generation:99},{id:'sleep_api_undo',operation:'undo'},{id:'sleep_api_undo',operation:'undo',generation:0}])
   assert.equal((await post('sleep',body)).status,400);
  const forbidden=new Request('https://local/api/sleep',{method:'POST',headers:{Origin:'https://other',...telegram},body:JSON.stringify(input)});
  assert.equal((await miniAppApi(forbidden,env,now)).status,403);
  const started=await post('browser-auth/start',{},{}),pair=cookies(started),code=(await started.json() as {code:string}).code;
  assert.equal(await approveBrowserCode(db,'123','123',code,now),true);
  const browser={Cookie:cookies(await post('browser-auth/status',{}, {Cookie:pair}))};
  const first=await post('sleep',input,browser);assert.equal(first.status,200);
  const data=await first.json() as {result:{generation:number;sleep:{asleep:boolean;reportedAt:number;canUndo:boolean;undoUntil:number}}};
  assert.equal(data.result.sleep.reportedAt,now);assert.equal(data.result.sleep.canUndo,true);assert.equal(data.result.sleep.undoUntil,now+300000);
  const replay=await post('sleep',input);assert.deepEqual(await replay.json(),data);
  const botDuplicate=await schedule.reportSleep('123',now+60000);assert.equal(botDuplicate.applied,false);
  assert.equal((await healthy.read('123')).state.qi,5);
  const undo={id:'sleep_api_undo',operation:'undo',generation:data.result.generation};
  assert.equal((await post('sleep',undo,browser,now+120000)).status,200);
  assert.equal((await healthy.read('123')).state.qi,0);
  assert.equal((await post('sleep',input,telegram,now+121000)).status,200,'Lost report response returns its receipt without restarting sleep');
  const awake=await (await get(now+121000)).json() as {sleepStatus:{asleep:boolean};rest:{reason:string};day:{asleep_at:number|null}};
  assert.equal(awake.sleepStatus.asleep,false);assert.equal(awake.rest.reason,'active');assert.equal(awake.day.asleep_at,null);
  const bot=await schedule.reportSleep('123',now+122000);
  assert.equal((await post('sleep',undo,browser,now+123000)).status,200,'Replay of old undo must not undo a newer report');
  assert.equal((await schedule.sleepStatus('123',now+123000)).asleep,true);
  assert.equal((await post('sleep',{...undo,id:'sleep_stale_undo'},browser,now+123000)).status,409);
  const fresh={id:'sleep_fresh_undo',operation:'undo',generation:bot.generation};
  assert.equal((await post('sleep',fresh,browser,now+123000)).status,200);
  const expiring=await schedule.reportSleep('123',now+124000);
  const expired=await post('sleep',{id:'sleep_expired_undo',operation:'undo',generation:expiring.generation},browser,now+424000);
  assert.equal(expired.status,409);assert.match((await expired.json() as {message:string}).message,/5 phút/);
  assert.equal((await schedule.sleepStatus('123',now+424000)).canUndo,false);
 }finally{await mf.dispose();}
});

test('checkin is owner-authenticated, server-chosen and shared by Chrome and Telegram without resuming reminders',async()=>{
 const {approveBrowserCode}=await import('../../src/adapters/d1/browser-auth.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.parse('2026-10-05T23:59:59+07:00'),env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const telegram={'X-Telegram-Init-Data':params.toString()},cookies=(r:Response)=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const post=(path:string,body:unknown,extra:Record<string,string>={},at=now)=>miniAppApi(new Request('https://local/api/'+path,{method:'POST',headers:{Origin:'https://local','X-Minh-Anh-Request':'1',...extra},body:JSON.stringify(body)}),env,at);
  const started=await post('browser-auth/start',{}),pair=cookies(started),code=(await started.json() as {code:string}).code;
  assert.equal(await approveBrowserCode(db,'123','123',code,now),true);
  const session=cookies(await post('browser-auth/status',{}, {Cookie:pair})),browser={Cookie:session};
  const store=new HealthyStore(db);await store.mutate('123','suspended-seed','seed',{},now,s=>({state:{...s,suspended:true,inactiveDays:3},result:{}}));
  const input={id:'daily_api001',operation:'checkin'};
  assert.equal((await post('cultivation',input)).status,401);
  const first=await post('cultivation',input,browser);assert.equal(first.status,200);
  const replay=await post('cultivation',input,telegram);assert.equal(replay.status,200);
  assert.deepEqual(await first.json(),await replay.json());
  assert.equal((await post('cultivation',{...input,id:'daily_api002'},telegram)).status,409);
  assert.equal((await post('cultivation',{...input,id:'daily_forged',reward:{qi:999}},telegram)).status,400);
  assert.equal((await post('cultivation',{...input,id:'daily_item001',item:'supreme'},telegram)).status,400);
  const next=await post('cultivation',{...input,id:'daily_next001'},telegram,now+1000);assert.equal(next.status,200);
  const account=(await store.read('123')).state;assert.equal(account.qi,1);assert.equal(account.tickets,1);
  assert.equal(account.checkin!.count,2);assert.equal(account.suspended,true);assert.equal(account.inactiveDays,3);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM daily_checkins WHERE owner='123'").first<{n:number}>())!.n,2);
  const bootstrap=await miniAppApi(new Request('https://local/api/bootstrap',{headers:telegram}),env,now+1000);
  assert.equal(bootstrap.status,200);const view=await bootstrap.json() as {checkin:{count:number;claimedToday:boolean;rewards:unknown[]}};
  assert.equal(view.checkin.count,2);assert.equal(view.checkin.claimedToday,true);assert.equal(view.checkin.rewards.length,30);
  assert.deepEqual((view.checkin.rewards[6] as {items:unknown}).items,{basic:3});
  assert.deepEqual((view.checkin.rewards[13] as {items:unknown}).items,{middle:3});
  assert.deepEqual((view.checkin.rewards[20] as {items:unknown}).items,{high:3});
  assert.ok(view.checkin.rewards.slice(0,29).every(r=>!(r as {items:{supreme?:number}}).items.supreme));
 }finally{await mf.dispose();}
});
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
  const postTask=(body:Record<string,unknown>)=>miniAppApi(new Request('https://local/api/tasks',{method:'POST',headers:{Origin:'https://local','X-Telegram-Init-Data':params.toString()},body:JSON.stringify(body)}),env,now);
  const created=await postTask({id:'estimate_api_create',operation:'create',title:'Estimate via API',remainingMinutes:75});
  assert.equal(created.status,200);
  const taskId=(await created.json() as {result:{id:string}}).result.id;
  assert.equal((await db.prepare('SELECT remaining_minutes FROM task_planning WHERE task_id=?').bind(taskId).first<{remaining_minutes:number}>())?.remaining_minutes,75);
  assert.equal((await postTask({id:'estimate_api_invalid',operation:'edit',taskId,version:1,title:'Estimate via API',remainingMinutes:'60'})).status,400);
  assert.equal((await postTask({id:'estimate_api_edit',operation:'edit',taskId,version:1,title:'Estimate via API',remainingMinutes:30})).status,200);
  assert.equal((await db.prepare('SELECT remaining_minutes FROM task_planning WHERE task_id=?').bind(taskId).first<{remaining_minutes:number}>())?.remaining_minutes,30);
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

test('Mini App focus button persists the current plan-window end and bootstrap restores it',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const token='123:fake',now=Date.parse('2026-09-14T09:00:00+07:00'),schedule=new ScheduleStore(db);
  const day=(await schedule.configure('123','04:30','22:30',0,now))!;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('focus-task','123','Tài liệu BA',0)");
  const params=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const headers={'X-Telegram-Init-Data':params.toString(),'Content-Type':'application/json'},env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const post=(path:string,body:Record<string,unknown>)=>miniAppApi(new Request('https://local/api/'+path,{method:'POST',headers,body:JSON.stringify(body)}),env,now);
  const scheduled=await post('schedule',{id:'focus_schedule_001',version:day.version,free:[{start:now,end:now+2*3600000}],busy:[],estimates:[{id:'focus-task',minutes:60}]});
  assert.equal(scheduled.status,200);
  const before=await miniAppApi(new Request('https://local/api/bootstrap',{headers}),env,now);
  const plan=(await before.json() as {dailyPlan:{plan:{day:number;items:{taskId:string;windows:{start:number;end:number}[]}[]}}}).dailyPlan.plan;
  const end=plan.items.find(item=>item.taskId==='focus-task')!.windows.find(slot=>slot.start<=now&&now<slot.end)!.end;
  const taskSpecific=await post('task-focus',{id:'focus_legacy_001',operation:'start',taskId:'focus-task'});
  assert.equal(taskSpecific.status,400,'the global focus action does not accept a client-selected task');
  const started=await post('task-focus',{id:'focus_button_001',operation:'start'});
  assert.equal(started.status,200);assert.equal(((await started.json()) as {result:{endsAt:number}}).result.endsAt,end);
  const restored=await miniAppApi(new Request('https://local/api/bootstrap',{headers}),env,now+60000);
  const body=await restored.json() as {taskFocus:{taskId:string;day:number;startedAt:number;endsAt:number}};
  assert.equal(body.taskFocus.taskId,'focus-task');assert.equal(body.taskFocus.day,plan.day);assert.equal(body.taskFocus.startedAt,now);assert.equal(body.taskFocus.endsAt,end);
  const stopped=await post('task-focus',{id:'focus_button_002',operation:'stop'});assert.equal(stopped.status,200);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM task_focus_state WHERE owner='123'").first<{n:number}>())!.n,0);
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

test('early sleep is published to the app while allowing task tickets and draws; suspension remains distinct',async()=>{
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-14T20:00:00+07:00'),token='123:fake';
  const p=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const req=(id:string)=>new Request('https://local/api/cultivation',{method:'POST',headers:{Origin:'https://local','X-Telegram-Init-Data':p.toString()},body:JSON.stringify({id,operation:'draw'})});
  const schedule=new ScheduleStore(db),work=new D1WorkStore(db),ledger=new HealthyStore(db);
  await schedule.configure('123','04:30','22:30',0,now);
  await schedule.reportSleep('123',now);
  assert.equal(await schedule.isResting('123',now),true);
  const bootstrap=await miniAppApi(new Request('https://local/api/bootstrap',{headers:{'X-Telegram-Init-Data':p.toString()}}),env,now);
  const state=await bootstrap.json() as {rest:{reason:string;reportedAt:number;until:number};resting:boolean;day:{asleep_at:number}};
  assert.equal(state.rest.reason,'asleep');assert.equal(state.rest.reportedAt,now);assert.equal(state.day.asleep_at,now);assert.equal(state.resting,true);
  assert.equal(state.rest.until,Date.parse('2026-09-15T04:30:00+07:00'));
  assert.equal(await schedule.personalRemindersPaused('123',now),false);
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

test('retired game routes leave legacy records untouched and old rank locks cannot block shared rewards', async () => {
 const {ScheduleStore}=await import('../../src/adapters/d1/schedule-store.ts');
 const {DatabaseSync}=await import('node:sqlite');
 const {sqliteDatabase}=await import('../../scripts/benchmark-habit-runtime.ts');
 const raw=new DatabaseSync(':memory:');
 try {
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())raw.exec(readFileSync('migrations/'+file,'utf8'));
  const db=sqliteDatabase(raw),now=Date.parse('2026-10-18T10:00:00+07:00'),token='123:fake';
  const schedule=new ScheduleStore(db);await schedule.configure('123','04:30','22:30',0,now);
  const day=(await schedule.ensureDay('123',now))!;
  raw.prepare('INSERT INTO game_accounts(owner,joined_day,anchor_start,next_day,updated,rank_lock_until_day) VALUES(?,?,?,?,?,?)')
   .run('123',day.day-10,day.start_at-10*86400000,day.day-5,now,day.day+10);
  raw.prepare("INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES('123','old_active','retired','awaiting_rescue',?,'{}','{}',?,?)").run(day.day-5,now,now);
  const legacy=()=>[raw.prepare('SELECT * FROM game_accounts').all(),raw.prepare('SELECT * FROM battles').all(),raw.prepare('SELECT * FROM game_receipts').all()];
  const before=legacy();
  const healthy=new HealthyStore(db);
  await healthy.mutate('123','retirement_seed','fixture',{},now,state=>({state:{...state,qi:100,earned:100,streak:35,bestStreak:35,tickets:1},result:{}}));
  const guarded:Database={prepare:sql=>{assert.doesNotMatch(sql,/\b(?:game_accounts|game_receipts|battles|practice_versions)\b/i);return db.prepare(sql);},batch:writes=>db.batch(writes)};
  const env={DB:guarded,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const params=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const auth={'X-Telegram-Init-Data':params.toString()};
  const request=(path:string,method='GET',headers:Record<string,string>=auth,body?:unknown)=>miniAppApi(new Request('https://local/api/'+path,{method,headers:{Origin:'https://local',...headers},...(method==='POST'?{body:JSON.stringify(body??{id:'retired_request',operation:'start_practice'})}:{})}),env,now);
  for(const path of ['game','game-catalog','game-technique','game-boss','game-chapter','game-presets','game-victories','game-export','practice-versions','battle-history','battle-loadout','battle-choice','battles']){
   assert.equal((await request(path)).status,404,path);
   assert.equal((await request(path,'POST')).status,404,path);
  }
  assert.equal((await request('game','POST',{})).status,401);
  assert.equal((await request('game','POST',{...auth,Origin:'https://other'})).status,403);
  const bootstrap=await request('bootstrap');assert.equal(bootstrap.status,200);
  const view=await bootstrap.json() as {account:Record<string,unknown>};
  assert.equal('combatRestrictions' in view.account,false);
  const input={id:'retirement_checkin',operation:'checkin'};
  const claim=await request('cultivation','POST',auth,input);assert.equal(claim.status,200);const claimed=await claim.json();
  assert.deepEqual(await(await request('cultivation','POST',auth,input)).json(),claimed);
  const attempt={id:'retirement_breakthrough',operation:'breakthrough',item:null};
  const result=await request('cultivation','POST',auth,attempt);assert.equal(result.status,200);const saved=await result.json();
  assert.deepEqual(await(await request('cultivation','POST',auth,attempt)).json(),saved);
  assert.deepEqual(legacy(),before);
 }finally{raw.close();}
});
