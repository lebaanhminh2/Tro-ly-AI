import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Browser assets are plain JavaScript and intentionally have no declaration file.
import {taskBuckets} from '../../web/api.js';

test('completed tasks remain visible for their operating day then move to history',()=>{
 const start='04:30',startMinutes=4*60+30;
 const now=Date.parse('2026-09-14T10:00:00+07:00');
 const day=Math.floor((now+7*3600000-startMinutes*60000)/86400000);
 const tasks=[
  {id:'active',done:false,completedAt:null},
  {id:'today',done:true,completedAt:Date.parse('2026-09-14T04:31:00+07:00')},
  {id:'before-boundary',done:true,completedAt:Date.parse('2026-09-14T04:29:00+07:00')},
  {id:'legacy',done:true,completedAt:null}
 ];
 const result=taskBuckets(tasks,day,start);
 assert.deepEqual(result.active.map((task:{id:string})=>task.id),['active']);
 assert.deepEqual(result.completedToday.map((task:{id:string})=>task.id),['today']);
 assert.deepEqual(result.history.map((task:{id:string})=>task.id),['before-boundary','legacy']);
});
