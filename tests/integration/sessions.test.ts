import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import type {Database} from '../../src/adapters/d1/database.ts';
import {D1WorkStore} from '../../src/adapters/d1/work-store.ts';
import {processInbox} from '../../src/application/process-inbox.ts';
import {queueReminders} from '../../src/adapters/d1/reminders.ts';
import {flushOutbox} from '../../src/adapters/d1/outbox.ts';
import {dayStart,quiet} from '../../src/domain/session.ts';

test('local date and quiet hours wrap midnight without global daily reminder cap',()=>{
  const now=Date.parse('2026-09-11T23:30:00+07:00');
  assert.equal(new Date(dayStart(now)).toISOString(),'2026-09-10T17:00:00.000Z');
  assert.equal(quiet(now,{quiet_start:1320,quiet_end:420}),true);
  assert.equal(quiet(Date.parse('2026-09-12T07:00:00+07:00'),{quiet_start:1320,quiet_end:420}),false);
});
test('session lifecycle, two reminders per appointment, no daily cap, snooze, response suppression and persistence',async()=>{
  const path=mkdtempSync(join(tmpdir(),'p2-d1-'));
  const runtime=()=>new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'p2'},d1Persist:path});
  let mf=runtime();
  try{
    let db=await mf.getD1Database('DB') as unknown as Database&{exec(s:string):Promise<unknown>};
    for(const f of ['0001_initial.sql','0002_delivery.sql','0003_command_transactions.sql','0004_sessions_reminders.sql'])await db.exec(readFileSync(`migrations/${f}`,'utf8').replace(/\r?\n/g,' '));
    let store=new D1WorkStore(db),now=Date.parse('2026-09-11T08:00:00+07:00'),id=0;
    const run=async(text:string,callback=false)=>{
      const input={owner:'123',chat:123,updateId:++id,...(callback?{callback:text}:{text})};
      await store.accept(input,now,false);await processInbox(store,'123',{now:()=>now});return store.result('123',id);
    };
    await run('/add Task');await run('yes:p123_1',true);
    const make=async(time:string)=>{
      await run('schedule:t123_1',true);await run(`${time} | 45`);
      const sid=`b${id}`;await run(`s:confirm:${sid}:1`,true);return sid;
    };
    const first=await make('11/09/2026 09:00');
    const second=await make('11/09/2026 10:00');
    const third=await make('11/09/2026 11:00');
    const sent:string[]=[];
    const transport:typeof fetch=async(_url,o)=>{sent.push(JSON.parse(String(o?.body)).text);return Response.json({ok:true,result:{message_id:sent.length}});};
    const env=()=>({DB:db,TELEGRAM_USER_ID:'123',TELEGRAM_WEBHOOK_SECRET:'synthetic-secret-long-enough',DELIVERY_MODE:'outbox' as const,TELEGRAM_BOT_TOKEN:'123:fake'});
    for(const hour of [9,10,11]){
      now=Date.parse(`2026-09-11T${String(hour).padStart(2,'0')}:00:00+07:00`);
      await Promise.all([queueReminders(db,'123',now),queueReminders(db,'123',now)]);
      await flushOutbox(env(),transport,now);
      now+=900000;await queueReminders(db,'123',now);await flushOutbox(env(),transport,now);
      await queueReminders(db,'123',now+60000);await flushOutbox(env(),transport,now+60000);
    }
    assert.equal(sent.length,6); // Three appointments each receive two, no daily cap.
    assert.equal((await store.task('123','t123_1'))!.version,1);
    await run(`s:snooze:${third}:2`,true);
    const snoozed=(await store.session('123',third))!;assert.equal(snoozed.generation,2);
    now=snoozed.start_at;await queueReminders(db,'123',now);await flushOutbox(env(),transport,now);
    assert.equal(sent.length,7);
    await run('tớ nghe rồi'); // Any reply after first reminder suppresses its follow-up.
    now+=900000;await queueReminders(db,'123',now);await flushOutbox(env(),transport,now);assert.equal(sent.length,7);
    await run(`s:start:${third}:${snoozed.version}`,true);
    const running=(await store.session('123',third))!;assert.equal(running.status,'running');
    now+=120000;await run(`s:pause:${third}:${running.version}`,true);
    const paused=(await store.session('123',third))!;assert.equal(paused.spent_ms,120000);
    await run(`s:finish:${third}:${paused.version}`,true);assert.equal((await store.session('123',third))!.status,'completed');
    await run(`s:start:${third}:${snoozed.version}`,true);assert.equal((await store.session('123',third))!.status,'completed');
    assert.match((await run('/today'))!.text,/Đã kết thúc buổi/);
    await run('/quiet 12:00 13:00');
    const fourth=await make('11/09/2026 12:30');
    now=Date.parse('2026-09-11T12:30:00+07:00');await queueReminders(db,'123',now);await flushOutbox(env(),transport,now);assert.equal(sent.length,7);
    await run('/rest');assert.ok((await store.preferences('123'))!.pause_until>now);
    await run('/resume');await run('/quiet 22:00 07:00');
    const stale=await make('11/09/2026 14:00');
    now=Date.parse('2026-09-11T14:00:00+07:00');await queueReminders(db,'123',now);
    await run(`s:snooze:${stale}:2`,true); // Old first reminder is queued but must never send.
    await flushOutbox(env(),transport,now);assert.equal(sent.length,7);
    now+=900000;await queueReminders(db,'123',now);
    let limited=0;
    await flushOutbox(env(),async()=>{limited++;return Response.json({ok:false,error_code:429,parameters:{retry_after:60}},{status:429});},now);
    assert.equal(limited,1);
    await run('/rest');now+=60000;await flushOutbox(env(),transport,now);assert.equal(sent.length,7);
    now=Date.parse('2026-09-12T09:00:00+07:00');await queueReminders(db,'123',now);await flushOutbox(env(),transport,now);
    assert.equal(sent.length,7); // No catch-up spam on the next day.
    await mf.dispose();mf=runtime();db=await mf.getD1Database('DB') as unknown as typeof db;store=new D1WorkStore(db);
    assert.equal((await store.session('123',third))!.spent_ms,120000);
    assert.equal(await store.session('other',fourth),null);
    assert.ok(await store.session('123',first));assert.ok(await store.session('123',second));
  }finally{await mf.dispose();}
});
