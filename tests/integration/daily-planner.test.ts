import test from 'node:test';
import assert from 'node:assert/strict';
import {planDay} from '../../src/application/daily-planner.ts';
import {availableRanges} from '../../src/domain/availability.ts';
const hour=3600000;
test('availability patches subtract busy time without erasing other hours',()=>{
 assert.deepEqual(availableRanges([{start:14*hour,end:17*hour}],[{start:15*hour,end:16*hour}],0),[{start:14*hour,end:15*hour},{start:16*hour,end:17*hour}]);
});
test('planner fills realistic capacity with breaks and keeps unfinished work explicit',()=>{
 const tasks=Array.from({length:6},(_,n)=>({id:'t'+n,status:'active' as const,deleted:false,deadline:12*hour,remainingMinutes:25}));
 const result=planDay(tasks,[{start:9*hour,end:12*hour}],[],8*hour);
 assert.equal(result.blocks.length,6); // Five full blocks plus a five-minute start.
 assert.equal(result.unplanned.length,1);
 assert.equal(result.unplanned[0]!.minutes,20);
 for(let n=1;n<result.blocks.length;n++)assert.ok(result.blocks[n]!.start>=result.blocks[n-1]!.end+10*60000);
 assert.ok(result.blocks.every(b=>b.end<=12*hour));
});
test('completed/deleted work excluded; missing estimate or missed deadline not guessed away',()=>{
 const result=planDay([
  {id:'done',status:'completed',deleted:false,deadline:null,remainingMinutes:25},
  {id:'deleted',status:'active',deleted:true,deadline:null,remainingMinutes:25},
  {id:'unknown',status:'active',deleted:false,deadline:null,remainingMinutes:null},
  {id:'late',status:'active',deleted:false,deadline:7*hour,remainingMinutes:25}
 ],[{start:9*hour,end:12*hour}],[],8*hour);
 assert.equal(result.blocks.length,0);
 assert.deepEqual(new Set(result.unplanned.map(t=>t.reason)),new Set(['needs_estimate','deadline_passed']));
});
