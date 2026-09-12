import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {D1UiStore} from '../../src/adapters/d1/ui-store.ts';
import {createWorker} from '../../src/entrypoints/worker.ts';
import type {Env} from '../../src/config/env.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {processInbox} from '../../src/application/process-inbox.ts';

test('sent reminder bridge rejects forged buttons and deleted cards get one replacement with fresh actions',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  const ui=new D1UiStore(db),now=100000;
  await db.exec("INSERT INTO tasks(id,owner,title,created) VALUES('t','123','test',0); INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('s','123','t',100000,25,'planned',900000); INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES('r','123','s',1,1,100000);");
  const payload={method:'sendMessage',chat_id:123,text:'Reminder',reply_markup:{inline_keyboard:[[{text:'Start',callback_data:'s:start:s:1'}]]}};
  await db.prepare("INSERT INTO outbox(id,payload,state,available,message_id,reminder_id) VALUES('reminder',?,'sent',0,77,'r')").bind(JSON.stringify(payload)).run();
  assert.equal(await ui.adoptReminder('123',123,77,'rest',now),null);
  assert.equal(await ui.adoptReminder('999',999,77,'s:start:s:1',now),null);
  const adopted=(await ui.adoptReminder('123',123,77,'s:start:s:1',now))!;
  assert.ok(adopted);assert.ok(await ui.adoptReminder('123',123,77,'s:start:s:1',now));
  await db.batch(ui.update(adopted.card,adopted.action,{text:'Running',buttons:[[{text:'Pause',callback_data:'s:pause:s:2'}]]},'active',now));
  assert.equal(await ui.adoptReminder('123',123,77,'s:start:s:1',now),null);
  let sends=0,edits=0;
  const transport:typeof fetch=async(url)=>{
   if(String(url).endsWith('editMessageText')){edits++;return Response.json({ok:false,error_code:400,description:'Bad Request: message to edit not found'},{status:400});}
   sends++;return Response.json({ok:true,result:{message_id:88}});
  };
  await ui.flush('123','fake',transport,()=>now);
  await ui.flush('123','fake',transport,()=>now);
  await ui.flush('123','fake',transport,()=>now);
  assert.equal(edits,1);assert.equal(sends,1);
  assert.equal((await ui.card('123',adopted.card.id))!.status,'expired');
  const replacement=await db.prepare('SELECT view_json FROM ui_cards WHERE owner=? AND message_id=?').bind('123',88).first<{view_json:string}>();
  const button=JSON.parse(replacement!.view_json).buttons[0][0].callback_data;
  assert.equal((await ui.resolve('123',123,88,button,now))!.action.action,'s:pause:s:2');
 }finally{await mf.dispose();}
});

test('Worker UI mode: create, confirm, list/detail/back edits and stale notices without duplicate task',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  const env:Env={DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_BOT_TOKEN:'123:fake',DELIVERY_MODE:'outbox',AI_MODE:'off'};
  const sent:Record<string,any>[]=[];let message=10,update=0,now=100000;
  const transport:typeof fetch=async(url,init)=>{
   const body=JSON.parse(String(init?.body));const method=String(url).split('/').at(-1)!;
   sent.push({method,...body});
   return Response.json({ok:true,result:method==='answerCallbackQuery'?true:{message_id:method==='sendMessage'?++message:body.message_id}});
  };
  const run=async(text:string,messageId?:number)=>{
   now+=100;
   const updateId=++update;
   const payload=messageId?{update_id:updateId,callback_query:{id:`cb${updateId}`,data:text,from:{id:123},message:{message_id:messageId,chat:{id:123,type:'private'}}}}:
    {update_id:updateId,message:{text,from:{id:123},chat:{id:123,type:'private'}}};
   const result=await createWorker(undefined,transport,{now:()=>now},true).fetch(new Request('https://local/telegram',{
    method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(payload)
   }),env);assert.equal(result.status,200);
  };
  await run('/add test');
  const confirm=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  const proposalMessage=message;
  await run(confirm,proposalMessage);
  assert.equal(sent.at(-1)!.method,'editMessageText');
  assert.equal(sent.at(-1)!.message_id,proposalMessage);
  assert.ok(sent.at(-1)!.reply_markup.inline_keyboard.flat().some((b:any)=>b.text==='Xem việc'));
  const count=sent.length;await run(confirm,proposalMessage);
  assert.equal(sent.length,count+1);assert.equal(sent.at(-1)!.method,'answerCallbackQuery');
  assert.match(sent.at(-1)!.text,/đã cũ/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<{n:number}>())!.n,1);
  await run('/tasks');const listMessage=message;
  const open=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  await run(open,listMessage);
  assert.equal(sent.at(-1)!.method,'editMessageText');
  const back=sent.at(-1)!.reply_markup.inline_keyboard.at(-1)[0].callback_data;
  await run(back,listMessage);
  assert.equal(sent.at(-1)!.method,'editMessageText');assert.equal(sent.at(-1)!.message_id,listMessage);
  assert.equal(sent.filter(p=>p.method==='sendMessage').length,2);
  const before=sent.length;await run(back,listMessage);
  assert.equal(sent.length,before+1);assert.equal(sent.at(-1)!.method,'answerCallbackQuery');
  // A whole wizard stays on the same message, and a previous step cannot execute twice.
  const currentList=sent.filter(p=>p.method==='editMessageText').at(-1)!;
  await run(currentList.reply_markup.inline_keyboard[0][0].callback_data,listMessage);
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][1].callback_data,listMessage);
  const oldDay=sent.at(-1)!.reply_markup.inline_keyboard[1][0].callback_data;
  await run(oldDay,listMessage);
  const hour=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  await run(hour,listMessage);
  const duration=sent.at(-1)!.reply_markup.inline_keyboard[0][1].callback_data;
  await run(duration,listMessage);
  const confirmSession=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  await run(confirmSession,listMessage);
  assert.equal(sent.filter(p=>p.method==='sendMessage').length,2);
  const beforeOld=sent.length;await run(oldDay,listMessage);
  assert.equal(sent.length,beforeOld+1);assert.equal(sent.at(-1)!.method,'answerCallbackQuery');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{n:number}>())!.n,1);
  // Text entered after opening the date flow updates the same card, not a detached proposal.
  await run('/tasks');const textCard=message;
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data,textCard);
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data,textCard);
  const oldCancel=sent.at(-1)!.reply_markup.inline_keyboard.at(-1)[0].callback_data;
  const textSends=sent.filter(p=>p.method==='sendMessage').length;
  await run('not a date');
  assert.equal(sent.at(-1)!.method,'editMessageText');assert.equal(sent.at(-1)!.message_id,textCard);
  await run('01/01/2030 12:30');
  assert.equal(sent.at(-1)!.method,'editMessageText');
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data,textCard);
  assert.equal(sent.filter(p=>p.method==='sendMessage').length,textSends);
  assert.match((await db.prepare('SELECT deadline FROM tasks LIMIT 1').first<{deadline:string}>())!.deadline,/2030/);
  await run(oldCancel,textCard);assert.equal(sent.at(-1)!.method,'answerCallbackQuery');
  await run('/start');const homeCard=message;
  await run(sent.at(-1)!.reply_markup.inline_keyboard[1][0].callback_data,homeCard);
  assert.match(sent.at(-1)!.text,/không chặn giờ yên lặng/);
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data,homeCard);
  assert.match(sent.at(-1)!.text,/dừng nhắc/);
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data,homeCard);
  await run(sent.at(-1)!.reply_markup.inline_keyboard[0][1].callback_data,homeCard);
  assert.match(sent.at(-1)!.text,/mở nhắc lại/);
  await run('/remember thích trà');await run('/memory');const memoryCard=message;
  const forget=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  await run(forget,memoryCard);assert.match(sent.at(-1)!.text,/Đã quên/);
  const afterForget=sent.length;await run(forget,memoryCard);
  assert.equal(sent.length,afterForget+1);assert.equal(sent.at(-1)!.method,'answerCallbackQuery');
  await run('/remember thích cacao');await run('/forgetall');const forgetCard=message;
  const forgetAll=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  await run(forgetAll,forgetCard);assert.match(sent.at(-1)!.text,/Đã xóa bộ nhớ/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM memories').first<{n:number}>())!.n,0);
  const afterAll=sent.length;await run(forgetAll,forgetCard);assert.equal(sent.length,afterAll+1);
 }finally{await mf.dispose();}
});

test('UI dispatcher persists Telegram 429 retry and stops at its attempt budget',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  const ui=new D1UiStore(db);let now=100000,calls=0;
  const card=ui.create('123',123,{text:'test',buttons:[]},now,now+900000);await db.batch(card.statements);
  const limited:typeof fetch=async()=>{calls++;return Response.json({ok:false,error_code:429,parameters:{retry_after:10}},{status:429});};
  await ui.flush('123','123:fake',limited,()=>now);await ui.flush('123','123:fake',limited,()=>now);
  assert.equal(calls,1);
  now+=10000;await ui.flush('123','123:fake',limited,()=>now);
  now+=10000;await ui.flush('123','123:fake',limited,()=>now);
  now+=10000;await ui.flush('123','123:fake',limited,()=>now);
  assert.equal(calls,3);
  assert.equal((await db.prepare('SELECT state FROM ui_deliveries WHERE card_id=?').bind(card.id).first<{state:string}>())!.state,'failed');
 }finally{await mf.dispose();}
});

test('uncertain initial send is never resent or recovered from an unbound message',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
  const ui=new D1UiStore(db);let now=100000,calls=0;
  const created=ui.create('123',123,{text:'test',buttons:[[{text:'Open',callback_data:'page:0'}]]},now,now+900000);
  await db.batch(created.statements);
  const callback=JSON.parse((await ui.card('123',created.id))!.view_json).buttons[0][0].callback_data;
  const lost:typeof fetch=async()=>{calls++;throw Error('synthetic timeout');};
  await ui.flush('123','fake',lost,()=>now);
  now+=120000;await ui.flush('123','fake',lost,()=>now);
  assert.equal(calls,1);
  assert.equal(await ui.recoverOnInteraction('123',123,12345,callback,now),false);
  assert.equal((await ui.card('123',created.id))!.message_id,null);
 }finally{await mf.dispose();}
});

test('UI cards: opaque actions, owner/message/revision fencing, atomic rollback and in-place delivery',async()=>{
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
  try {
    const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
    for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`migrations/${file}`,'utf8').replace(/\r?\n/g,' '));
    let ui=new D1UiStore(db),now=100000;
    const view={text:'Danh sách việc',buttons:[[{text:'Mở việc',callback_data:'task:private-id'}]]};
    const created=ui.create('123',123,view,now,now+900000);await db.batch(created.statements);
    const original=(await ui.card('123',created.id))!;
    const button=JSON.parse(original.view_json).buttons[0][0].callback_data;
    assert.match(button,/^ui:[a-f0-9]{32}$/);assert.ok(!button.includes('private-id'));
    assert.equal(await ui.resolve('123',123,7,button,now),null); // not delivered yet
    const claims=await Promise.all([ui.claim('123',created.id,now),ui.claim('123',created.id,now)]);
    const first=claims.find(Boolean)!;assert.equal(claims.filter(Boolean).length,1);
    assert.equal(first.payload.method,'sendMessage');
    await ui.finish(first,'sent',now+1,7);
    ui=new D1UiStore(db);
    assert.equal(await ui.resolve('999',999,7,button,now),null);
    assert.equal(await ui.resolve('123',123,8,button,now),null);
    const active=(await ui.resolve('123',123,7,button,now))!;
    assert.equal(active.action.action,'task:private-id');
    const updated={text:'Chi tiết việc',buttons:[[{text:'Quay lại',callback_data:'page:0'}]]};
    // Business mutation + card transition either both commit or neither does.
    await assert.rejects(db.batch([
      db.prepare("INSERT INTO tasks(id,owner,title,created) VALUES('rollback','123','test',0)"),
      ...ui.update(active.card,active.action,updated,'active',now),
      db.prepare('INSERT INTO transaction_guard VALUES(0)')
    ]));
    assert.equal(await db.prepare("SELECT id FROM tasks WHERE id='rollback'").first(),null);
    assert.ok(await ui.resolve('123',123,7,button,now));
    await db.batch(ui.update(active.card,active.action,updated,'active',now));
    assert.equal(await ui.resolve('123',123,7,button,now),null);
    await assert.rejects(db.batch(ui.update(active.card,active.action,updated,'active',now)));
    const edit=(await ui.claim('123',created.id,now))!;
    assert.equal(edit.payload.method,'editMessageText');assert.equal(edit.payload.message_id,7);
    await ui.finish(edit,'sent',now+1,7);
    const newButton=JSON.parse((await ui.card('123',created.id))!.view_json).buttons[0][0].callback_data;
    assert.ok(await ui.resolve('123',123,7,newButton,now));
    assert.equal(await ui.resolve('123',123,7,newButton,now+900000),null);
    const next=(await ui.resolve('123',123,7,newButton,now))!;
    await db.batch(ui.update(next.card,next.action,{text:'Đã xong',buttons:[]},'completed',now));
    const final=(await ui.claim('123',created.id,now))!;
    now+=30001;await ui.recover(now);
    await assert.rejects(ui.finish(final,'sent',now,7)); // stale sender cannot publish success
    assert.equal(await ui.claim('123',created.id,now),null); // no blind retry on uncertain
    assert.equal(await ui.recoverOnInteraction('999',999,7,newButton,now),false);
    assert.equal(await ui.recoverOnInteraction('123',123,8,newButton,now),false);
    assert.equal(await ui.recoverOnInteraction('123',123,7,newButton,now),true);
    assert.equal(await ui.recoverOnInteraction('123',123,7,newButton,now),false);
    assert.equal((await ui.card('123',created.id))!.status,'expired');
    let recoverySends=0;
    await ui.flush('123','fake',async()=>{recoverySends++;return Response.json({ok:true,result:{message_id:99}});},()=>now);
    await ui.flush('123','fake',async()=>{recoverySends++;return Response.json({ok:true,result:{message_id:100}});},()=>now);
    assert.equal(recoverySends,1);
    assert.equal(await ui.resolve('123',123,7,newButton,now),null);
  } finally {await mf.dispose();}
});
