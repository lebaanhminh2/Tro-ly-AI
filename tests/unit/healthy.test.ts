import test from 'node:test';
import assert from 'node:assert/strict';
import {initialHealthy,assessSleep,resumeHealthy,breakthrough,drawReward,fuseCharm,useProtection,dayWindow,operatingDay,minutes,DAY_MS,REALMS,LOOT,DAILY_REWARDS,BREAKTHROUGH_PENALTIES,claimDailyReward,dailyCheckinProgress} from '../../src/domain/healthy.ts';
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
 let s={...initialHealthy(),qi:30,rank:1,streak:3,tickets:1};
 const draw=drawReward(s,.55);assert.equal(draw.reward,'basic');assert.equal(draw.state.tickets,0);
 s=breakthrough(s,1,1000,null,.99).state;
 assert.throws(()=>breakthrough(s,1,1001,null,0));
 s=breakthrough(s,2,2000,null,.99).state;
 const r=breakthrough(s,3,3000,null,.99);assert.equal(r.success,true);assert.equal(r.state.protectedUntil,3000+72*3600000);
 s.inventory.basic=3;const fused=fuseCharm(s,'basic',.99);assert.equal(fused.state.inventory.basic,2);
 assert.equal(REALMS.at(-1)!.qi,2000);assert.equal(REALMS.at(-1)!.days,45);
});

test('published daily calendar varies rewards and preserves all four milestones',async()=>{
 assert.equal(DAILY_REWARDS.length,30);
 assert.deepEqual(DAILY_REWARDS.map(r=>r.day),Array.from({length:30},(_,i)=>i+1));
 assert.ok(DAILY_REWARDS.some(r=>r.qi&&!r.tickets));assert.ok(DAILY_REWARDS.some(r=>r.tickets&&!r.qi));
 assert.equal(DAILY_REWARDS[6]!.tickets,2);assert.equal(DAILY_REWARDS[6]!.items.basic,3);
 assert.equal(DAILY_REWARDS[13]!.items.middle,3);assert.equal(DAILY_REWARDS[20]!.items.high,3);
 assert.ok(DAILY_REWARDS.slice(0,29).every(reward=>!reward.items.supreme),'Cực phẩm is only awarded at day30');
 assert.deepEqual(DAILY_REWARDS[29],{day:30,qi:30,tickets:5,items:{supreme:1},milestone:true});
 const webPath='../../web/api.js',demo=await import(webPath);
 assert.deepEqual(demo.dailyRewards,DAILY_REWARDS);assert.deepEqual(demo.breakthroughPenalties,BREAKTHROUGH_PENALTIES);
});

test('30 claims survive two missed dates, day32 is eligible and day33 resets only progress',()=>{
 const start=Date.parse('2026-10-05T00:00:00+07:00');let s=initialHealthy();
 for(let date=0;date<32;date++){
  if(date===3||date===18)continue;
  const before=s,outcome=claimDailyReward(s,start+date*DAY_MS);s=outcome.state;
  assert.equal(outcome.reward.day,(before.checkin?.count??0)+1);
  assert.notEqual(s.inventory,before.inventory);assert.throws(()=>claimDailyReward(s,start+date*DAY_MS),/ALREADY_CHECKED_IN/);
 }
 const progress=dailyCheckinProgress(s,start+31*DAY_MS);
 assert.equal(progress.count,30);assert.equal(progress.missedDays,2);assert.equal(progress.daysLeft,1);assert.equal(progress.canComplete,true);
 assert.equal(s.inventory.basic,3);assert.equal(s.inventory.middle,3);assert.equal(s.inventory.high,3);assert.equal(s.inventory.supreme,1);
 assert.equal(s.qi,DAILY_REWARDS.reduce((sum,r)=>sum+r.qi,0));assert.equal(s.earned,s.qi);
 assert.equal(s.tickets,DAILY_REWARDS.reduce((sum,r)=>sum+r.tickets,0));
 assert.throws(()=>claimDailyReward(s,start+31*DAY_MS+60000),/ALREADY_CHECKED_IN/);
 const fresh=dailyCheckinProgress(s,start+32*DAY_MS);assert.equal(fresh.expired,true);assert.equal(fresh.count,0);
 const reset=claimDailyReward(s,start+32*DAY_MS).state;assert.equal(reset.checkin!.count,1);
 assert.equal(reset.qi,s.qi+1);assert.equal(reset.inventory.supreme,1);assert.equal(reset.tickets,s.tickets);
});

test('milestone bundles can be fused and do not replace previously owned items or checkin progress',()=>{
 const now=Date.parse('2026-10-05T09:00:00+07:00'),day=operatingDay(now,0),seed=initialHealthy();
 seed.checkin={cycleStartDay:day-6,count:6,lastDay:day-1};seed.inventory={...seed.inventory,basic:2,middle:1,high:1,supreme:1};
 const {state,reward}=claimDailyReward(seed,now);
 assert.equal(reward.day,7);assert.equal(state.checkin!.count,7);
 assert.deepEqual(state.inventory,{...seed.inventory,basic:5});
 assert.equal(seed.inventory.basic,2);assert.equal(seed.checkin.count,6);
 const fused=fuseCharm(state,'basic',0).state;
 assert.equal(fused.inventory.basic,2);assert.equal(fused.inventory.middle,2);assert.equal(fused.inventory.supreme,1);
});

test('completed cycle waits until32 days; three misses cannot reach the final reward',()=>{
 const start=Date.parse('2026-10-05T08:00:00+07:00');let s=initialHealthy();
 for(let i=0;i<30;i++)s=claimDailyReward(s,start+i*DAY_MS).state;
 assert.throws(()=>claimDailyReward(s,start+30*DAY_MS),/CHECKIN_COMPLETE/);
 assert.equal(dailyCheckinProgress(s,start+31*DAY_MS).canClaim,false);
 s=claimDailyReward(initialHealthy(),start).state;
 assert.equal(dailyCheckinProgress(s,start+3*DAY_MS).canComplete,true);
 assert.equal(dailyCheckinProgress(s,start+4*DAY_MS).canComplete,false);
 const reset=claimDailyReward(s,start+32*DAY_MS);assert.equal(reset.reward.day,1);
});

test('checkin uses Vietnam midnight, independent of sleep day, and never resumes suspension',async()=>{
 const before=Date.parse('2026-10-05T23:59:59+07:00'),after=before+1000;
 let s={...initialHealthy(),suspended:true,inactiveDays:3,streak:4};
 const first=claimDailyReward(s,before);s=first.state;
 const second=claimDailyReward(s,after);assert.equal(second.reward.day,2);
 assert.equal(operatingDay(before,270),operatingDay(after,270));
 assert.equal(second.calendarDay,first.calendarDay+1);assert.equal(second.state.suspended,true);
 assert.equal(second.state.inactiveDays,3);assert.equal(second.state.streak,4);
 assert.throws(()=>claimDailyReward(second.state,before),/INVALID_CHECKIN_DAY/);
 const webPath='../../web/api.js',demo=await import(webPath);
 for(const now of [before,after,after+33*DAY_MS])assert.deepEqual(demo.checkinProgress(second.state,now),dailyCheckinProgress(second.state,now));
});

test('failed breakthrough penalties increase gently, never demote or reduce lifetime/streak, and success costs0',()=>{
 for(let rank=0;rank<REALMS.length-1;rank++){
  const target=REALMS[rank+1]!,s={...initialHealthy(),rank,highestRank:rank,qi:target.qi,earned:9999,streak:target.days};
  const failure=breakthrough(s,1,1000,null,.99);
  assert.equal(failure.success,false);assert.equal(failure.penalty,BREAKTHROUGH_PENALTIES[rank]);
  assert.equal(failure.state.qi,target.qi-BREAKTHROUGH_PENALTIES[rank]!);assert.ok(failure.state.qi>=0);
  assert.equal(failure.state.rank,rank);assert.equal(failure.state.highestRank,rank);
  assert.equal(failure.state.earned,9999);assert.equal(failure.state.streak,target.days);assert.equal(failure.state.failures,1);
  assert.equal(s.qi,target.qi);
  const success=breakthrough(s,1,1000,null,0);assert.equal(success.penalty,0);assert.equal(success.state.qi,s.qi);
 }
});
