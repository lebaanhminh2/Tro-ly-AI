import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyMiniApp} from '../../src/adapters/telegram/mini-app-auth.ts';
const token='123:synthetic-secret',now=Date.parse('2026-09-13T12:00:00Z');
function signed(id=123,seconds=Math.floor(now/1000)){
 const p=new URLSearchParams({auth_date:String(seconds),query_id:'synthetic',user:JSON.stringify({id,first_name:'Test'})});
 const data=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 p.set('hash',createHmac('sha256',secret).update(data).digest('hex'));
 return p.toString();
}
test('valid Telegram initData authenticates only configured owner',async()=>{
 assert.equal((await verifyMiniApp(signed(),token,'123',now)).owner,'123');
 await assert.rejects(verifyMiniApp(signed(999),token,'123',now),/UNAUTHORIZED/);
 await assert.rejects(verifyMiniApp(signed(),token+'wrong','123',now),/UNAUTHORIZED/);
});
test('expired, future, duplicate and tampered credentials are rejected',async()=>{
 await assert.rejects(verifyMiniApp(signed(123,Math.floor(now/1000)-901),token,'123',now),/EXPIRED/);
 await assert.rejects(verifyMiniApp(signed(123,Math.floor(now/1000)+60),token,'123',now),/EXPIRED/);
 await assert.rejects(verifyMiniApp(signed()+'&auth_date=1',token,'123',now),/UNAUTHORIZED/);
 const p=new URLSearchParams(signed());p.set('user',JSON.stringify({id:999}));
 await assert.rejects(verifyMiniApp(p.toString(),token,'999',now),/UNAUTHORIZED/);
});
