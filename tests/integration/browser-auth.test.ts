import test from 'node:test';
import assert from 'node:assert/strict';
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
