import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('web/app.js','utf8');
const styles=readFileSync('web/styles.css','utf8');
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

test('task sheet has touch, backdrop and system-close escape paths',()=>{
 assert.ok(app.includes("data-sheet-close"));
 assert.ok(app.includes("sheet.addEventListener('cancel'"));
 assert.ok(app.includes('closeSheet()'));
 assert.ok(app.includes("sheet.classList.remove('task-sheet-open','schedule-sheet-open')"));
});

test('schedule sheet locks the page and only edits explicitly selected tasks',()=>{
 assert.ok(app.includes("sheet.classList.add('schedule-sheet-open')"));
 assert.ok(app.includes("document.body.classList.add('sheet-open')"));
 assert.ok(app.includes("const estimates=[]"));
 assert.ok(app.includes("button('Chọn task'"));
 assert.ok(app.includes('Không chọn thì task giữ nguyên thời lượng đã lưu'));
 assert.ok(!app.includes('document.body.style.top='));
 assert.ok(styles.includes('dialog.schedule-sheet-open .schedule-form{flex:1 1 auto'));
 assert.ok(styles.includes('dialog.schedule-sheet-open{display:flex;flex-direction:column;height:min(88dvh,760px)'));
 assert.ok(styles.includes('dialog.schedule-sheet-open input[type=time]{position:relative;pointer-events:auto}'));
});
