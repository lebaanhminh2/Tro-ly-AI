import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {approveBrowserCode,browserOwner} from '../../src/adapters/d1/browser-auth.ts';
import {miniAppApi} from '../../src/entrypoints/mini-app.ts';
import {createWorker} from '../../src/entrypoints/worker.ts';
import type {Database} from '../../src/adapters/d1/database.ts';

async function fixture(){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
 for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
 const now=Date.parse('2026-10-05T10:00:00+07:00');
 const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'synthetic-webhook-secret-12345678',TELEGRAM_BOT_TOKEN:'123:fake',AI_MODE:'off'};
 const req=(path:string,cookie='',body?:unknown,origin='https://local')=>new Request('https://local/api/'+path,{method:'POST',headers:{Origin:origin,'X-Minh-Anh-Request':'1',Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const auth=(action:string,cookie='',at=now)=>miniAppApi(req('browser-auth/'+action,cookie),env,at);
 const cookies=(response:Response)=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 return {mf,db,env,now,req,auth,cookies};
}

function telegramData(token:string,at:number,id=123){
 const params=new URLSearchParams({auth_date:String(Math.floor(at/1000)),user:JSON.stringify({id})});
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 const data=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>key+'='+value).join('\n');
 params.set('hash',createHmac('sha256',secret).update(data).digest('hex'));
 return params.toString();
}

test('Telegram bootstrap establishes one fixed 30-day session, reuses it past initData expiry and revokes it on logout',async()=>{
 const f=await fixture();try{
  const init=telegramData(f.env.TELEGRAM_BOT_TOKEN,f.now);
  const read=(cookie='',at=f.now,proof=init,path='bootstrap')=>miniAppApi(new Request('https://local/api/'+path,{headers:{Cookie:cookie,...(proof?{'X-Telegram-Init-Data':proof}:{})}}),f.env,at);
  const first=await read();assert.equal(first.status,200);
  const session=f.cookies(first);
  assert.match(first.headers.get('Set-Cookie')!,/__Host-minh-anh-session=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000/);
  assert.equal(first.headers.get('Cache-Control'),'no-store');
  const original=await f.db.prepare('SELECT * FROM browser_sessions').first<{token_hash:string;owner:string;created_at:number;expires_at:number}>();
  assert.equal(original!.owner,'123');assert.equal(original!.created_at,f.now);assert.equal(original!.expires_at,f.now+30*86400000);
  assert.ok(!session.includes(original!.token_hash));
  assert.ok(!JSON.stringify(original).includes(session.split('=')[1]!));
  const later=f.now+20*60000;
  // initData is deliberately expired and still sent by the Telegram SDK.
  assert.equal((await read('',later)).status,401);
  for(const at of [later,f.now+86400000,f.now+29*86400000]){
   const response=await read(session,at);assert.equal(response.status,200);
   assert.equal(response.headers.get('Set-Cookie'),null,'Reads do not renew the fixed expiry or create a session');
   assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM browser_sessions').first<{n:number}>())!.n,1);
  }
  assert.deepEqual(await f.db.prepare('SELECT * FROM browser_sessions').first(),original);
  assert.equal((await read(session,later,'','history')).status,200,'Cookie also works after a page reload without initData');
  const write=(id:string,extra:Record<string,string>={})=>miniAppApi(new Request('https://local/api/tasks',{method:'POST',headers:{Origin:'https://local',Cookie:session,'X-Telegram-Init-Data':init,...extra},body:JSON.stringify({id,operation:'create',title:'Session task',remainingMinutes:15})}),f.env,later);
  assert.equal((await write('session_no_header')).status,403);
  assert.equal((await write('session_cross_site',{'X-Minh-Anh-Request':'1',Origin:'https://other'})).status,403);
  assert.equal((await write('session_fetch_cross',{'X-Minh-Anh-Request':'1','Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await write('session_valid_write',{'X-Minh-Anh-Request':'1'})).status,200);
  assert.equal((await read(session,f.now+30*86400000)).status,401,'Expiry is enforced server-side at the exact boundary');
  assert.equal((await f.auth('logout',session,later)).status,200);
  assert.equal((await read(session,later)).status,401,'The revoked cookie cannot reuse expired Telegram credentials');
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM browser_sessions').first<{n:number}>())!.n,0);
 }finally{await f.mf.dispose();}
});

test('Telegram sessions require fresh authentic owner proof, isolate the configured owner and clean expired sessions on a new login',async()=>{
 const f=await fixture();try{
  const bootstrap=(proof:string,cookie='',at=f.now,env=f.env)=>miniAppApi(new Request('https://local/api/bootstrap',{headers:{'X-Telegram-Init-Data':proof,Cookie:cookie}}),env,at);
  for(const proof of [telegramData('wrong',f.now),telegramData(f.env.TELEGRAM_BOT_TOKEN,f.now,999),telegramData(f.env.TELEGRAM_BOT_TOKEN,f.now-901000),'invalid']){
   const response=await bootstrap(proof);assert.equal(response.status,401);assert.equal(response.headers.get('Set-Cookie'),null);
  }
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM browser_sessions').first<{n:number}>())!.n,0);
  const init=telegramData(f.env.TELEGRAM_BOT_TOKEN,f.now),first=await bootstrap(init),session=f.cookies(first);
  assert.equal(first.status,200);
  assert.equal((await bootstrap(init,session,f.now+1000000,{...f.env,TELEGRAM_USER_ID:'999'})).status,401);
  const later=f.now+30*86400000,fresh=telegramData(f.env.TELEGRAM_BOT_TOKEN,later);
  assert.equal((await bootstrap(init,session,later)).status,401);
  const reopened=await bootstrap(fresh,session,later);assert.equal(reopened.status,200);
  const nextSession=f.cookies(reopened);assert.notEqual(nextSession,session);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM browser_sessions').first<{n:number}>())!.n,1);
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:session}}),'123',later),null);
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:nextSession}}),'123',later),'123');
 }finally{await f.mf.dispose();}
});

test('a session-store outage is unavailable, never a false logout, and valid sessions use one indexed read without a renewal write',async()=>{
 const f=await fixture();try{
  const init=telegramData(f.env.TELEGRAM_BOT_TOKEN,f.now);
  const first=await miniAppApi(new Request('https://local/api/bootstrap',{headers:{'X-Telegram-Init-Data':init}}),f.env,f.now);
  const session=f.cookies(first),calls:string[]=[];
  const tracked:Database={
   prepare(sql){calls.push(sql);return f.db.prepare(sql);},
   batch(statements){calls.push('batch');return f.db.batch(statements);}
  };
  const request=()=>new Request('https://local/api/history',{headers:{Cookie:session,'X-Telegram-Init-Data':init}});
  assert.equal((await miniAppApi(request(),{...f.env,DB:tracked},f.now+1000000)).status,200);
  assert.equal(calls.filter(sql=>sql.includes('browser_sessions')).length,1);
  assert.match(calls.find(sql=>sql.includes('browser_sessions'))!,/^SELECT owner FROM browser_sessions WHERE token_hash=\?/);
  assert.ok(!calls.some(sql=>/^(INSERT|UPDATE|DELETE).*browser_sessions/.test(sql)));
  const unavailable:Database={prepare(){throw Error('synthetic database outage');},batch(){throw Error('synthetic database outage');}};
  const failed=await miniAppApi(request(),{...f.env,DB:unavailable},f.now+1000000);
  assert.equal(failed.status,503);assert.equal((await failed.json() as {error:string}).error,'LOGIN_UNAVAILABLE');
  assert.equal(failed.headers.get('Set-Cookie'),null);
  assert.equal((await miniAppApi(request(),f.env,f.now+1000000)).status,200);
 }finally{await f.mf.dispose();}
});

test('Chrome pairing is bound to its browser, owner-only, single use, remembered and revoked on logout',async()=>{
 const f=await fixture();try{
  const started=await f.auth('start');assert.equal(started.status,200);
  const pair=f.cookies(started),challenge=await started.json() as {code:string};
  assert.match(started.headers.get('Set-Cookie')!,/Secure; HttpOnly; SameSite=Strict/);
  assert.equal((await f.auth('status',pair)).status,200);
  assert.equal((await (await f.auth('status',pair)).json() as {authenticated:boolean}).authenticated,false);
  assert.equal(await approveBrowserCode(f.db,'999','123',challenge.code,f.now),false);
  const other=await f.auth('start'),otherPair=f.cookies(other);
  assert.equal(await approveBrowserCode(f.db,'123','123',challenge.code,f.now),true);
  assert.equal((await (await f.auth('status',otherPair)).json() as {authenticated:boolean}).authenticated,false);
  const exchanges=await Promise.all([f.auth('status',pair),f.auth('status',pair)]);
  assert.equal(exchanges.filter(result=>result.status===200).length,1);
  const session=f.cookies(exchanges.find(result=>result.status===200)!);
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:session}}),'123',f.now),'123');
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:session}}),'999',f.now),null);
  assert.equal(await approveBrowserCode(f.db,'123','123',challenge.code,f.now),false);
  assert.equal((await f.auth('status',pair)).status,401);
  const again=await f.auth('start',session);assert.deepEqual(await again.json(),{authenticated:true});
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:session}}),'123',f.now+30*86400000),null);
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:session}}),'123',f.now+30*86400000),null);
  const changed=await miniAppApi(f.req('tasks',session,{id:'browser-create001',operation:'create',title:'Chrome task',remainingMinutes:45}),f.env,f.now);
  assert.equal(changed.status,200);
  const crossSite=await miniAppApi(f.req('tasks',session,{id:'browser-forgery001',operation:'create',title:'Forged'},'https://other'),f.env,f.now);
  assert.equal(crossSite.status,403);
  const noHeader=new Request('https://local/api/tasks',{method:'POST',headers:{Origin:'https://local',Cookie:session},body:JSON.stringify({id:'no-header001',operation:'create',title:'Forged'})});
  assert.equal((await miniAppApi(noHeader,f.env,f.now)).status,403);
  assert.equal((await f.auth('logout',session)).status,200);
  assert.equal(await browserOwner(f.db,new Request('https://local',{headers:{Cookie:session}}),'123',f.now),null);
 }finally{await f.mf.dispose();}
});

test('pairing expires, rate limits creation and does not store plaintext codes or cookies',async()=>{
 const f=await fixture();try{
  const start=await f.auth('start'),pair=f.cookies(start),data=await start.json() as {code:string};
  const saved=await f.db.prepare('SELECT * FROM browser_pairings').first<Record<string,unknown>>();
  assert.ok(!JSON.stringify(saved).includes(data.code.replace(/-/g,'')));
  assert.equal(await approveBrowserCode(f.db,'123','123',data.code,f.now+600001),false);
  assert.equal((await f.auth('status',pair,f.now+600001)).status,401);
  for(let i=0;i<7;i++)assert.equal((await f.auth('start')).status,200);
  assert.equal((await f.auth('start')).status,429);
  assert.equal((await miniAppApi(f.req('browser-auth/start','','','https://other'),f.env,f.now)).status,403);
  const request=new Request('https://local/api/browser-auth/start',{method:'POST',headers:{Origin:'https://local'}});
  assert.equal((await miniAppApi(request,f.env,f.now)).status,403);
 }finally{await f.mf.dispose();}
});

test('Telegram command confirms browser sign-in without entering the AI conversation',async()=>{
 const f=await fixture();try{
  const start=await f.auth('start'),pair=f.cookies(start),data=await start.json() as {code:string};
  let modelCalls=0;
  const worker=createWorker(async()=>{modelCalls++;return 'unexpected';},fetch,{now:()=>f.now});
  const env={...f.env,ASSETS:{fetch:async()=>new Response('asset')}};
  const command=(owner:number,secret=f.env.TELEGRAM_WEBHOOK_SECRET)=>worker.fetch(new Request('https://local/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({update_id:100,message:{from:{id:owner},chat:{id:owner,type:'private'},text:'/dangnhap '+data.code}})}),env);
  assert.equal((await command(123,'wrong')).status,403);
  await command(999);assert.equal((await (await f.auth('status',pair)).json() as {authenticated:boolean}).authenticated,false);
  const result=await command(123);assert.equal(result.status,200);assert.match((await result.json() as {text:string}).text,/Đã xác nhận/);
  assert.equal((await (await f.auth('status',pair)).json() as {authenticated:boolean}).authenticated,true);
  assert.equal(modelCalls,0);
 }finally{await f.mf.dispose();}
});
