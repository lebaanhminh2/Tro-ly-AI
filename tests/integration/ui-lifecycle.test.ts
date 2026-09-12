import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {D1UiStore} from '../../src/adapters/d1/ui-store.ts';
import {createWorker} from '../../src/entrypoints/worker.ts';
import type {Env} from '../../src/config/env.ts';

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
   const result=await createWorker(undefined,transport,{now:()=>now},undefined,true).fetch(new Request('https://local/telegram',{
    method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(payload)
   }),env);assert.equal(result.status,200);
  };
  await run('/add test');
  const confirm=sent.at(-1)!.reply_markup.inline_keyboard[0][0].callback_data;
  const proposalMessage=message;
  await run(confirm,proposalMessage);
  assert.equal(sent.at(-1)!.method,'editMessageText');
  assert.equal(sent.at(-1)!.message_id,proposalMessage);
  assert.deepEqual(sent.at(-1)!.reply_markup.inline_keyboard,[]);
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
  } finally {await mf.dispose();}
});
