import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {D1UiStore} from '../../src/adapters/d1/ui-store.ts';

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
