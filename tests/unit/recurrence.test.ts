import test from 'node:test';
import assert from 'node:assert/strict';
import {occurrences,type RecurrenceRule} from '../../src/domain/recurrence.ts';
const rule:RecurrenceRule={id:'daily',owner:'123',title:'Drink water',kind:'daily',times:['09:00','15:00'],weekdays:[],startDate:'2026-09-13',endDate:null,enabled:true,version:1};
test('daily rule really repeats with stable unique occurrence identities',()=>{
 const from=Date.parse('2026-09-13T00:00:00+07:00'),to=from+7*86400000;
 const list=occurrences(rule,from,to);
 assert.equal(list.length,14);assert.equal(new Set(list.map(o=>o.id)).size,14);
 assert.deepEqual(list,occurrences(rule,from,to));
 assert.equal(new Date(list[0]!.due).toISOString(),'2026-09-13T02:00:00.000Z');
 assert.equal(occurrences({...rule,enabled:false},from,to).length,0);
});
test('one-time, weekday and inclusive end dates do not spill into other dates',()=>{
 const from=Date.parse('2026-09-13T00:00:00+07:00'),to=from+7*86400000;
 assert.equal(occurrences({...rule,kind:'once'},from,to).length,2);
 assert.equal(occurrences({...rule,kind:'weekdays',weekdays:[1,3,5]},from,to).length,6);
 assert.equal(occurrences({...rule,endDate:'2026-09-14'},from,to).length,4);
 assert.throws(()=>occurrences({...rule,times:['24:00']},from,to));
 assert.throws(()=>occurrences({...rule,startDate:'2026-02-30'},from,to));
});
