import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import type {Database} from '../../src/adapters/d1/database.ts';

test('completed history is paged and old detail rows are archived without touching active work',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
 try{
  const db=await mf.getD1Database('DB') as unknown as Database&{exec(sql:string):Promise<unknown>};
  for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\r?\n/g,' '));
  const now=Date.parse('2026-09-15T12:00:00+07:00'),old=now-91*86400000;
  await db.exec("INSERT INTO tasks(id,owner,title,created,status) VALUES('old','123','Old done',0,'completed'),('active','123','Still doing',0,'active');");
  await db.prepare("INSERT INTO task_completions(owner,task_id,completed_at) VALUES('123','old',?)").bind(old).run();
  await db.exec(`INSERT INTO task_steps(id,owner,task_id,step_code,title,created) VALUES('step','123','old',1,'Detail',0);
    INSERT INTO sessions(id,owner,task_id,start_at,minutes,status,expires) VALUES('session','123','old',0,25,'completed',0);
    INSERT INTO reminders(id,owner,session_id,generation,ordinal,due,status) VALUES('reminder','123','session',1,1,0,'done');`);
  const store=new D1WorkStore(db);
  const before=await store.historyPage('123',0,20);assert.equal(before.items.length,1);assert.equal(before.items[0]!.id,'old');
  const result=await store.archiveCompleted('123',now);assert.equal(result.archived,1);
  assert.equal((await store.hierarchy('123')).some(task=>task.id==='old'),false);
  assert.equal((await store.hierarchy('123')).some(task=>task.id==='active'),true);
  const archived=await store.historyPage('123',0,20);assert.equal(archived.items[0]!.archived_at,now);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM task_steps WHERE task_id='old'").first<{n:number}>())!.n,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE task_id='old'").first<{n:number}>())!.n,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reminders WHERE session_id='session'").first<{n:number}>())!.n,0);
 }finally{await mf.dispose();}
});
