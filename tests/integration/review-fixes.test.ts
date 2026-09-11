import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {processInbox} from '../../src/application/process-inbox.ts';
import {sessionStatements} from '../../src/adapters/d1/session-store.ts';
import {queueReminders} from '../../src/adapters/d1/reminders.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';

test('review regressions: pause scope, one-use deletion, memory pages and actual send interval',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(s:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  let now=Date.parse('2026-09-11T09:00:00+07:00'),id=0;
  const store=new D1WorkStore(db);
  const run=async(text:string,callback=false,owner='123')=>{
   const updateId=++id;await store.accept({owner,chat:Number(owner),updateId,...(callback?{callback:text}:{text})},now,false);
   await processInbox(store,owner,{now:()=>now});return (await store.result(owner,updateId))!;
  };
  const confirmation=(await run('/forgetall')).buttons[0]![0]!.callback_data;
  await run('/remember first');
  await run(confirmation,true,'999');assert.equal((await store.memories('123',now)).length,1);
  await run(confirmation,true);assert.equal((await store.memories('123',now)).length,0);
  await run('/remember new');await run(confirmation,true);assert.equal((await store.memories('123',now)).length,1);
  const cancel=(await run('/forgetall')).buttons[0]![1]!.callback_data;
  await run(cancel,true);await run(cancel.replace('memory-no:','memory-yes:'),true);assert.equal((await store.memories('123',now)).length,1);
  const expired=(await run('/forgetall')).buttons[0]![0]!.callback_data;now+=300001;
  await run(expired,true);assert.equal((await store.memories('123',now)).length,1);
  await run('forget-all',true);assert.equal((await store.memories('123',now)).length,1);
  for(let i=0;i<35;i++)await db.prepare('INSERT INTO memories(id,owner,content,kind,source,created) VALUES(?,?,?,\'preference\',\'test\',?)').bind(`long${i}`,'123',String(i).padStart(2,'0')+'x'.repeat(298),now+i).run();
  const seen=new Set<string>();let page=await run('/memory');
  for(let n=0;n<10;n++){
   assert.ok(page.text.length<4096);
   for(const row of page.buttons)for(const b of row)if(b.callback_data.startsWith('forget:'))seen.add(b.callback_data);
   const next=page.buttons.flat().find(b=>b.text==='Trang tiếp');if(!next)break;
   page=await run(next.callback_data,true);
  }
  assert.equal(seen.size,36);
  assert.equal((await run('memory-page:bad',true)).text,'Trang không hợp lệ.');
  const clear=(await run('/forgetall')).buttons[0]![0]!.callback_data;await run(clear,true);
  assert.equal((await store.memories('123',now)).length,0);
  await db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','test',?)").bind(now).run();
  const tomorrow=now+86400000;
  await db.prepare("INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('s','123','t',?,60,'planned',?)").bind(now,tomorrow).run();
  for(const [rid,due]of [['today',now],['tomorrow',tomorrow]] as const)await db.prepare('INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,\'123\',\'s\',?,1,?)').bind(rid,rid==='today'?1:2,due).run();
  await db.batch(sessionStatements(db,'123',{type:'preferences',preferences:{owner:'123',quiet_start:1320,quiet_end:420,pause_until:now+3600000}}));
  assert.equal((await db.prepare("SELECT status FROM reminders WHERE id='today'").first<{status:string}>())!.status,'cancelled');
  assert.equal((await db.prepare("SELECT status FROM reminders WHERE id='tomorrow'").first<{status:string}>())!.status,'pending');
  await db.prepare("UPDATE reminder_preferences SET pause_until=0 WHERE owner='123'").run();
  for(const ordinal of [1,2])await db.prepare('INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,\'123\',\'s\',3,?,?)').bind(`s:3:${ordinal}`,ordinal,now+(ordinal-1)*900000).run();
  await db.prepare("UPDATE sessions SET generation=3 WHERE id='s'").run();
  await queueReminders(db,'123',now);
  const env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'synthetic-secret-long-enough',DELIVERY_MODE:'outbox' as const,TELEGRAM_BOT_TOKEN:'123:fake'};
  let tick=0;
  await flushOutbox(env,async()=>{tick+=5000;return Response.json({ok:true,result:{message_id:1}});},now,()=>tick);
  assert.equal((await db.prepare("SELECT sent_at FROM outbox WHERE reminder_id='s:3:1'").first<{sent_at:number}>())!.sent_at,now+5000);
  await queueReminders(db,'123',now+900000);
  assert.equal(await db.prepare("SELECT id FROM outbox WHERE reminder_id='s:3:2'").first(),null);
  await queueReminders(db,'123',now+905000);
  assert.ok(await db.prepare("SELECT id FROM outbox WHERE reminder_id='s:3:2'").first());
 }finally{await mf.dispose();}
});
