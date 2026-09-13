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
