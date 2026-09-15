import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('web/app.js','utf8');
const today=readFileSync('web/views/today.js','utf8');
const api=readFileSync('web/api.js','utf8');
const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts as Record<string,string>;

test('web syntax check covers every shipped JavaScript asset',()=>{
 assert.match(scripts['check:web']??'',/node --check web\/api\.js/);
 assert.match(scripts['check:web']??'',/node --check web\/app\.js/);
 for(const file of ['achievements','reminders','timeline','today'])assert.match(scripts['check:web']??'',new RegExp(`node --check web/views/${file}\\.js`));
});

test('today controls use the shared task and progress flows',()=>{
 assert.ok(today.includes('today-quick-actions'));
 assert.ok(today.includes('ui.openTodayPlan(t.id)'));
 assert.ok(app.includes("performLive('task-work'"));
 assert.ok(app.includes("performLive('day-plan'"));
 assert.ok(!app.includes("entries.push({taskId:select.value,minutes:45})"));
 assert.ok(api.includes('actualMinutes'));
});
