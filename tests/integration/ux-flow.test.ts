import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';
import {planCommand} from '../../src/application/plan-command.ts';
import {sessionButtons,canAct} from '../../src/domain/session.ts';
import {queueReminders} from '../../src/adapters/d1/reminders.ts';

test('UX task detail, persisted scheduling, old confirmations, sessions and forgotten-memory replay',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  let store=new D1WorkStore(db),id=0,now=Date.parse('2026-09-12T04:00:00+07:00');
  const run=async(value:string,callback=false,messageId?:number)=>{
   const updateId=++id;
   await store.accept({owner:'123',chat:123,updateId,...(callback?{callback:value,callbackId:`cb${id}`,messageId}:{text:value})},now,true);
   const lease=(await store.claim('123',now))!;
   await store.commit(lease,await planCommand(lease.input,store,now),now);
   return (await store.result('123',updateId))!;
  };
  const proposal=await run('/add kiểm tra trợ lý');
  // Simulate a Telegram-confirmed card ID. Only app-owned cards may be edited.
  await db.prepare("UPDATE outbox SET state='sent',message_id=77 WHERE id='reply:123:1'").run();
  const yes=proposal.buttons[0]![0]!.callback_data;
  assert.match((await run(yes,true,77)).text,/Đã thêm/);
  assert.ok(await db.prepare("SELECT id FROM outbox WHERE id='clear:123:77'").first());
  await run(yes,true,77);
  assert.equal(await db.prepare('SELECT id FROM outbox WHERE id=?').bind(`reply:123:${id}`).first(),null);
  const list=await run('/tasks');assert.equal(list.buttons[0]!.length,1);
  const detail=await run(list.buttons[0]![0]!.callback_data,true);
  assert.ok(!detail.buttons.flat().some(b=>b.callback_data.startsWith('focus:')));
  const schedule=detail.buttons[0]![1]!.callback_data;
  const deadline=await run(detail.buttons[0]![0]!.callback_data,true);
  const deadlineHours=await run(deadline.buttons[1]![0]!.callback_data,true);
  const deadlineConfirm=await run(deadlineHours.buttons[0]![0]!.callback_data,true);
  await run(deadlineConfirm.buttons[0]![0]!.callback_data,true);
  assert.ok((await store.tasks('123',0))[0]!.deadline);
  const day=await run(schedule,true);
  store=new D1WorkStore(db); // Wizard survives application instance replacement.
  const hours=await run(day.buttons[0]![0]!.callback_data,true);
  const hour=hours.buttons.flat().find(b=>b.text==='05:00')!;
  const durations=await run(hour.callback_data,true);
  const draft=await run(durations.buttons[0]![1]!.callback_data,true);
  await run(draft.buttons[0]![0]!.callback_data,true);
  const sessions=await store.sessions('123',0,now+86400000),first=sessions[0]!;
  now=first.start_at;await queueReminders(db,'123',now);
  assert.ok(await db.prepare('SELECT id FROM outbox WHERE reminder_id=?').bind(`${first.id}:1:1`).first());
  for(const status of ['planned','running','paused','unknown','completed','skipped'] as const){
   const s={...first,status};
   assert.ok(sessionButtons(s).flat().every(b=>canAct(s,b.callback_data.split(':')[1]!,now)));
  }
  await db.prepare("INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('second','123',?,?,25,'planned',?)").bind(first.task_id,now+3600000,now+7200000).run();
  assert.equal((await run('/today')).buttons.length,2);
  await run(`s:start:${first.id}:${first.version}`,true);
  assert.match((await run('s:start:second:1',true)).text,/đang có một buổi/);
  assert.equal((await store.session('123','second'))!.status,'planned');
  const guardedId=++id;
  await store.accept({owner:'123',chat:123,updateId:guardedId,text:'synthetic-guard'},now,false);
  const guardLease=(await store.claim('123',now))!;
  await assert.rejects(store.commit(guardLease,{view:{text:'test',buttons:[]},changes:[{type:'session-action',session:(await store.session('123','second'))!,action:'start',now}]},now),/CHECK constraint/);
  await store.release(guardLease);
  // Finish the synthetic test command without changing sessions.
  const cleanupLease=(await store.claim('123',now))!;
  await store.commit(cleanupLease,{view:{text:'guard checked',buttons:[]},changes:[]},now);
  await run(schedule,true);await run('/tasks');assert.equal(await store.sessionInput('123'),null);
  assert.match((await run(hour.callback_data,true)).text,/đã cũ/);
  await run('/remember thích trà');const memory=(await store.memories('123',now))[0]!;
  await run(`forget:${memory.id}`,true);
  await db.prepare('INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES(?,?,?,?,?,?)').bind('123',999,'new','context',now,now+86400000).run();
  await run(`forget:${memory.id}`,true);
  assert.equal((await store.history('123',now)).length,1);
  assert.equal(await db.prepare("SELECT id FROM outbox WHERE id='clear:123:99999'").first(),null);
 }finally{await mf.dispose();}
});
