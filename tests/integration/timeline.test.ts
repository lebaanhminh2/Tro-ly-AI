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
test('timeline displays the canonical task plan and task blocks are read-only',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=at('08:00'),schedule=new ScheduleStore(db),store=new TimelineStore(db);
  const day=(await schedule.configure('123','04:30','22:30',0,now))!;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',0)");
  const {D1WorkStore}=await import('../../src/adapters/d1/work-store.ts');
  const {DayPlanStore}=await import('../../src/adapters/d1/day-plan-store.ts');
  const prepared=await new D1WorkStore(db).prepareSchedule('123',now,day.version,
   [{start:at('09:00'),end:at('13:00')}],[{start:at('10:00'),end:at('11:00')}],
   [{id:'a',minutes:90},{id:'b',minutes:30}],'timeline-plan');
  await db.batch(prepared.statements);await new DayPlanStore(db).ensure('123',now);
  const before=(await store.read('123',now))!;
  assert.ok(before.blocks.length>=2);
  assert.ok(before.blocks.every(block=>block.id.startsWith('taskplan_')));
  assert.ok(before.blocks.every(block=>block.start_at<at('10:00')||block.start_at>=at('11:00')));
  const selected=before.blocks[0]!;
  await assert.rejects(store.change('123','move',{stamp:before.stamp,sessionId:selected.id,at:at('12:00')},now),/TIMELINE_READ_ONLY/);
  assert.equal((await store.read('123',now))!.stamp,before.stamp);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,2);
  const token='123:synthetic',params=new URLSearchParams({auth_date:String(now/1000),user:JSON.stringify({id:123})});
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:token};
  const apiRequest=(payload:unknown,auth=true)=>new Request('https://local/api/timeline',{method:'POST',headers:{Origin:'https://local','Content-Type':'application/json','X-Telegram-Init-Data':auth?params.toString():''},body:JSON.stringify(payload)});
  const payload={id:'api-move',stamp:before.stamp,sessionId:selected.id,at:at('12:00')};
  assert.equal((await miniAppApi(apiRequest(payload,false),env,now)).status,401);
  assert.equal((await miniAppApi(apiRequest({...payload,undo:4}),env,now)).status,400);
  const response=await miniAppApi(apiRequest(payload),env,now);assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:'TIMELINE_READ_ONLY'});
 }finally{await mf.dispose();}
});
