import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {TimelineStore} from '../../src/adapters/d1/timeline-store.ts';
import {ScheduleStore} from '../../src/adapters/d1/schedule-store.ts';
import {queueReminders,reminderAllowed} from '../../src/adapters/d1/reminders.ts';
import {miniAppApi} from '../../src/entrypoints/mini-app.ts';
import {createHmac} from 'node:crypto';
const at=(time:string)=>Date.parse('2026-09-14T'+time+':00+07:00');
test('timeline insertion, conflict rollback, reminder invalidation, replay and undo are atomic',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=at('08:00'),schedule=new ScheduleStore(db),store=new TimelineStore(db);
  const day=(await schedule.configure('123','04:30','22:30',0,now))!;
  await db.prepare('UPDATE schedule_days SET intervals_json=? WHERE owner=? AND day=?').bind(JSON.stringify({busy:[{start:at('10:00'),end:at('11:00')}]}),'123',day.day).run();
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',0)");
  for(const [id,time] of [['a','09:00'],['b','11:00']] as const){
   await db.prepare("INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES(?,'123',?,?,30,'planned',?)").bind(id,id,at(time!),at('22:30')).run();
   await db.prepare("INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,'123',?,1,1,?)").bind(id+':1:1',id,at(time!)).run();
  }
  await db.exec("INSERT INTO reminder_preferences(owner,quiet_start,quiet_end) VALUES('123',0,0)");
  const before=(await store.read('123',now))!;
  await assert.rejects(store.change('123','busy',{stamp:before.stamp,sessionId:'a',at:at('10:00')},now),/TIMELINE_BLOCKED/);
  assert.equal((await store.read('123',now))!.stamp,before.stamp);
  const request={stamp:before.stamp,sessionId:'a',at:at('11:00')};
  const result=await store.change('123','move',request,now);
  assert.deepEqual(await store.change('123','move',request,now),result);
  const after=(await store.read('123',now))!;
  assert.equal(after.blocks.find(b=>b.id==='a')!.start_at,at('11:00'));
  assert.equal(after.blocks.find(b=>b.id==='b')!.start_at,at('11:40'));
  assert.equal(after.stamp,result.after);
  assert.equal(await reminderAllowed(db,'a:1:1',at('09:00')),false);
  await assert.rejects(store.change('123','stale',{stamp:before.stamp,sessionId:'a',at:at('12:00')},now),/TIMELINE_CHANGED/);
  await store.change('123','undo',{stamp:after.stamp,undo:'move'},now);
  assert.equal((await store.read('123',now))!.blocks.find(b=>b.id==='a')!.start_at,at('09:00'));
  await assert.rejects(store.change('123','undo-again',{stamp:(await store.read('123',now))!.stamp,undo:'move'},now),/TIMELINE_CHANGED/);
  await queueReminders(db,'123',at('09:00'));
  const outgoing=await db.prepare("SELECT payload FROM outbox WHERE reminder_id='a:3:1'").first<{payload:string}>();
  assert.ok(outgoing);assert.equal(JSON.parse(outgoing.payload).reply_markup,undefined);
  await db.prepare("UPDATE sessions SET start_at=?,version=version+1 WHERE id='b'").bind(at('22:00')).run();
  const current=(await store.read('123',now))!;
  await assert.rejects(store.change('123','full',{stamp:current.stamp,sessionId:'a',at:at('22:00')},now),/TIMELINE_NO_ROOM/);
  assert.equal((await store.read('123',now))!.stamp,current.stamp);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,2);
  const token='123:synthetic',params=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const apiRequest=(payload:unknown,auth=true)=>new Request('https://local/api/timeline',{method:'POST',headers:{Origin:'https://local','Content-Type':'application/json','X-Telegram-Init-Data':auth?params.toString():''},body:JSON.stringify(payload)});
  const payload={id:'api-move',stamp:current.stamp,sessionId:'a',at:at('12:00')};
  assert.equal((await miniAppApi(apiRequest(payload,false),env,now)).status,401);
  assert.equal((await miniAppApi(apiRequest({...payload,undo:4}),env,now)).status,400);
  const response=await miniAppApi(apiRequest(payload),env,now);assert.equal(response.status,200);
  assert.deepEqual(await (await miniAppApi(apiRequest(payload),env,now)).json(),await response.json());
 }finally{await mf.dispose();}
});
