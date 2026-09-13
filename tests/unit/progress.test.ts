import test from 'node:test';
import assert from 'node:assert/strict';
import {statistics,type ProgressData} from '../../src/domain/progress.ts';
import {progressPng} from '../../src/application/progress-renderer.ts';
test('progress counts unique days and on-time date-only deadlines in Vietnam',()=>{
 const now=Date.parse('2026-09-13T21:00:00+07:00');
 const data:ProgressData={achievements:[],milestones:[{id:'m',task_id:'t',content:'outline',created:now-86400000}],completions:[{task_id:'t',title:'report',completed_at:now,deadline:'2026-09-13',precision:'date'}]};
 const s=statistics(data,now);
 assert.equal(s.streak,2);assert.equal(s.total,1);assert.equal(s.onTime,1);assert.equal(s.today,1);
 assert.equal(statistics(data,now+86400000).streak,2);
 assert.equal(statistics(data,now+2*86400000).streak,0);
});
test('native chart encoder generates a bounded PNG without external services',async()=>{
 const encoded=await progressPng({completions:[],milestones:[],achievements:[]},Date.now());
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
 assert.ok(bytes.length<50000);
});
