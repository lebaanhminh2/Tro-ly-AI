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
