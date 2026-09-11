import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import type { Database, Statement } from '../../src/adapters/d1/database.ts';
import { planCommand } from '../../src/application/plan-command.ts';
import { processInbox } from '../../src/application/process-inbox.ts';
import type { Input } from '../../src/domain/work.ts';

const now = Date.parse('2026-09-11T10:00:00+07:00');
function input(updateId: number, text: string, owner = '123'): Input { return {updateId,text,owner,chat:Number(owner)}; }
function createRuntime(path?: string) {
  return new Miniflare({ modules:true, script:'export default {fetch(){return new Response("offline")}}',
    d1Databases:{DB:'test-db'}, ...(path ? {d1Persist:path} : {}) });
}
async function migrate(db: Database & {exec(s:string):Promise<unknown>}) {
  for (const name of ['0001_initial.sql','0002_delivery.sql','0003_command_transactions.sql','0004_sessions_reminders.sql'])
    await db.exec(readFileSync(`migrations/${name}`,'utf8').replace(/\r?\n/g,' '));
}

test('atomic task/command/outbox, rollback midway, retry after lost commit receipt, persisted restart', async () => {
  const path = mkdtempSync(join(tmpdir(),'assistant-p1-'));
  let runtime = createRuntime(path);
  try {
    let db = await runtime.getD1Database('DB') as unknown as Database & {exec(s:string):Promise<unknown>};
    await migrate(db);
    let store = new D1WorkStore(db);
    await store.accept(input(1,'/add Bài hình học'),now,true);
    await processInbox(store,'123',{now:()=>now});
    assert.equal((await store.tasks('123',0)).length,0);
    const confirm = { ...input(2,''), callback:'yes:p123_1' };
    await store.accept(confirm,now,true);
    const lease = (await store.claim('123',now))!;
    const plan = await planCommand(lease.input,store,now);
    let fail = true;
    const faultDb: Database = {
      prepare: sql => db.prepare(sql),
      batch: (statements: Statement[]) => {
        if (fail) { fail = false;
          // Fail at end of actual transaction, after proposal trigger would have created task.
          return db.batch([...statements,db.prepare('INSERT INTO transaction_guard VALUES(0)')]);
        }
        return db.batch(statements);
      }
    };
    await assert.rejects(new D1WorkStore(faultDb).commit(lease,plan,now));
    assert.equal((await store.tasks('123',0)).length,0);
    assert.equal((await store.proposal('123','p123_1'))!.status,'pending');
    assert.equal(await store.result('123',2),null);
    assert.equal(await db.prepare("SELECT id FROM outbox WHERE id='reply:123:2'").first(),null);
    await store.commit(lease,plan,now);
    await assert.rejects(store.commit(lease,plan,now)); // Lost receipt does not mean execute again.
    assert.equal((await store.tasks('123',0)).length,1);
    assert.equal(await store.accept(confirm,now,true),false);
    assert.equal((await store.task('123','t123_1'))!.version,1);
    await runtime.dispose();
    runtime = createRuntime(path);
    db = await runtime.getD1Database('DB') as unknown as typeof db;
    store = new D1WorkStore(db);
    assert.equal((await store.task('123','t123_1'))!.title,'Bài hình học');
    assert.ok(await store.result('123',2));
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id='reply:123:2'").first<{n:number}>())!.n,1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM transaction_guard').first<{n:number}>())!.n,0);
  } finally { await runtime.dispose(); }
});

test('expired owner lease fences old worker; queued command recovers without duplicate effects', async () => {
  const runtime = createRuntime();
  try {
    const db = await runtime.getD1Database('DB') as unknown as Database & {exec(s:string):Promise<unknown>};
    await migrate(db); const store = new D1WorkStore(db);
    await store.accept(input(1,'/add A'),now,true);
    const oldLease = (await store.claim('123',now))!;
    const oldPlan = await planCommand(oldLease.input,store,now);
    assert.equal(await store.claim('123',now+1),null);
    const newLease = (await store.claim('123',now+30001))!;
    await assert.rejects(store.commit(oldLease,oldPlan,now+30001));
    await store.release(oldLease); // Must not delete new owner's lease.
    assert.equal(await store.claim('123',now+30002),null);
    await store.commit(newLease,await planCommand(newLease.input,store,now+30001),now+30001);
    await store.accept(input(2,'/add B'),now+30002,true);
    // Simulate accepted webhook whose process died before claim.
    await processInbox(new D1WorkStore(db),'123',{now:()=>now+30002});
    assert.ok(await store.proposal('123','p123_2'));
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM command_audit').first<{n:number}>())!.n,2);
    assert.equal(await store.task('other','t123_1'),null);
    assert.equal(await store.proposal('other','p123_1'),null);
  } finally { await runtime.dispose(); }
});

test('owner commands serialize selection, date and confirmations; parallel stale proposal cannot overwrite', async () => {
  const runtime = createRuntime();
  try {
    const db = await runtime.getD1Database('DB') as unknown as Database & {exec(s:string):Promise<unknown>};
    await migrate(db); const store = new D1WorkStore(db);
    const run = async (i:Input) => {await store.accept(i,now,true);await processInbox(store,'123',{now:()=>now});};
    await run(input(1,'/add Test'));
    await run({...input(2,''),callback:'yes:p123_1'});
    await store.accept({...input(3,''),callback:'deadline:t123_1'},now,true);
    await store.accept(input(4,'12/09/2026 18:30'),now,true);
    await Promise.all([processInbox(store,'123',{now:()=>now}),processInbox(store,'123',{now:()=>now})]);
    assert.equal((await store.task('123','t123_1'))!.deadline,null);
    assert.ok(await store.proposal('123','p123_4'));
    await run({...input(5,''),callback:'deadline:t123_1'});
    await run(input(6,'13/09/2026 09:00'));
    await run({...input(7,''),callback:'yes:p123_6'});
    await run({...input(8,''),callback:'yes:p123_4'});
    assert.equal((await store.task('123','t123_1'))!.deadline,'2026-09-13T09:00:00+07:00');
    assert.match((await store.result('123',8))!.text,/đã cũ/);
    await run({...input(9,''),callback:'yes:p123_6'});
    assert.equal((await store.task('123','t123_1'))!.version,2);
    await run({...input(10,''),callback:'deadline:t123_1'});
    await run(input(11,'/cancel'));
    assert.equal(await store.selection('123'),null);
  } finally {await runtime.dispose();}
});
