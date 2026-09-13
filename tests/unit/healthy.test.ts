import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHealthy,assessSleep,resumeHealthy,breakthrough,drawReward,fuseCharm,useProtection,dayWindow,operatingDay,minutes,DAY_MS,REALMS,LOOT} from '../../src/domain/healthy.ts';
import {healthyCommand} from '../../src/application/healthy-command.ts';
import {scheduleEntry} from '../../src/application/schedule-command.ts';
const window=dayWindow(20000,270,1350);
const assessment={day:20000,...window,reportedAt:null,chatActive:false,assessedAt:window.end};
test('sleep command preserves companion text and cannot accidentally match another command',()=>{
 assert.deepEqual(healthyCommand('/ngu mai làm báo cáo nhé'),{kind:'sleep',message:'mai làm báo cáo nhé'});
 assert.equal(healthyCommand('/ngung'),null);
 assert.deepEqual(scheduleEntry('/lich chiều nay bận'),{kind:'setup',message:'chiều nay bận'});
 assert.equal(scheduleEntry('tớ bận'),null);
});
test('late sleep demotes below rank threshold, not below zero; only once per day',()=>{
 const s={...initialHealthy(),qi:30,earned:100,rank:2,highestRank:3};
 const r=assessSleep(s,assessment);
 assert.equal(r.state.qi,10);assert.equal(r.state.rank,1);assert.equal(r.state.earned,100);
 assert.equal(r.state.highestRank,3);assert.equal(assessSleep(r.state,assessment).applied,false);
 assert.equal(s.qi,30);
});
test('72h prevents demotion but not qi penalty, expiry alone changes nothing',()=>{
 const s={...initialHealthy(),qi:10,rank:2,protectedUntil:window.end+1};
 const r=assessSleep(s,assessment);
 assert.equal(r.state.qi,0);assert.equal(r.state.rank,2);
 const nextWindow=dayWindow(20001,270,1350);
 const later=assessSleep(r.state,{day:20001,...nextWindow,reportedAt:null,chatActive:false,assessedAt:nextWindow.end});
 assert.equal(later.state.rank,1);assert.equal(later.state.qi,0);
});
test('on-time earns5; heart and peace affect different rules',()=>{
 const s={...initialHealthy(),streak:4,qi:30,rank:2};
 const good=assessSleep(s,{...assessment,reportedAt:window.target});
 assert.equal(good.state.qi,35);assert.equal(good.state.earned,5);assert.equal(good.state.streak,5);
 s.inventory.heart=1;s.inventory.peace=1;
 const protectedState=useProtection(useProtection(s,'heart',20000),'peace',20000);
 const late=assessSleep(protectedState,assessment);
 assert.equal(late.state.qi,30);assert.equal(late.state.rank,2);assert.equal(late.state.streak,4);
 assert.throws(()=>useProtection(late.state,'heart',20000));
});
test('only three inactive days penalized; resume never charges absent days',()=>{
 let s={...initialHealthy(),qi:200};
 for(let n=0;n<10;n++){const w=dayWindow(20000+n,270,1350);s=assessSleep(s,{day:20000+n,...w,reportedAt:null,chatActive:false,assessedAt:w.end}).state;}
 assert.equal(s.qi,140);assert.equal(s.suspended,true);
 s=resumeHealthy(s,20020);assert.equal(s.qi,140);assert.equal(s.lastScoredDay,20019);
 assert.equal(assessSleep(s,assessment).applied,false);
});
test('day crosses midnight; exact sleep target is on time',()=>{
 const now=Date.parse('2026-09-14T01:00:00+07:00'),day=operatingDay(now,minutes('04:30'));
 const w=dayWindow(day,270,minutes('01:30'));
 assert.equal(new Date(w.target).toISOString(),'2026-09-13T18:30:00.000Z');
 assert.throws(()=>minutes('24:00'));
 assert.equal(assessSleep(initialHealthy(),{day,...w,reportedAt:w.target,assessedAt:w.target,chatActive:true}).state.qi,5);
});
test('odds, pity, daily attempts, fusion and lifetime rewards',()=>{
 assert.equal(LOOT.reduce((n,i)=>n+i.weight,0),100);
 let s={...initialHealthy(),qi:20,rank:1,streak:3,tickets:1};
 const draw=drawReward(s,.55);assert.equal(draw.reward,'basic');assert.equal(draw.state.tickets,0);
 s=breakthrough(s,1,1000,null,.99).state;
 assert.throws(()=>breakthrough(s,1,1001,null,0));
 s=breakthrough(s,2,2000,null,.99).state;
 const r=breakthrough(s,3,3000,null,.99);assert.equal(r.success,true);assert.equal(r.state.protectedUntil,3000+72*3600000);
 s.inventory.basic=3;const fused=fuseCharm(s,'basic',.99);assert.equal(fused.state.inventory.basic,2);
 assert.equal(REALMS.at(-1)!.qi,2000);assert.equal(REALMS.at(-1)!.days,45);
});
