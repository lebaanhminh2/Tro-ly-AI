import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('web/app.js','utf8');
const styles=readFileSync('web/styles.css','utf8');
const today=readFileSync('web/views/today.js','utf8');
const achievements=readFileSync('web/views/achievements.js','utf8');
const api=readFileSync('web/api.js','utf8');
const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts as Record<string,string>;

test('work card keeps the flip interaction and shows current, next and expired states',async()=>{
 const viewPath='../../web/views/today.js';
 const {renderWorkState}=await import(viewPath);
 const make=(tag:string,value='',className='')=>({tag,value,className,children:[] as any[],attrs:{} as Record<string,string>,style:{setProperty(){}},
  append(...children:any[]){this.children.push(...children);},setAttribute(key:string,value:string){this.attrs[key]=value;}});
 let clicked=false;
 const ui={el:make,button:(label:string,click:()=>void,css:string)=>({...make('button',label,css),click}),toggleTaskFocus:()=>{clicked=true;}};
 const now=Date.parse('2026-09-22T14:10:00+07:00');
 const start=now-10*60000,end=now+20*60000,nextStart=now+50*60000,nextEnd=now+95*60000;
 const plan={items:[{taskId:'a',windows:[{start,end}]},{taskId:'b',windows:[{start:nextStart,end:nextEnd}]}]};
 const state={tasks:[{id:'a',title:'Báo cáo',done:false},{id:'b',title:'Tiếng Anh',done:false}],taskFocus:null as any,taskFocusTarget:{taskId:'a',endsAt:end},resting:false};
 const flatten=(node:any):string=>[node.value,...node.children.map(flatten)].join(' ');
 let root=renderWorkState(ui,state,plan,now),text=flatten(root);
 assert.match(text,/14:00–14:30/);assert.match(text,/Tiếp theo · 15:00–15:45/);
 assert.doesNotMatch(text,/Không đang làm|Tớ đang làm/);
 assert.match(text,/ngừng nhắc để cậu tập trung/);
 const card=root.children.find((child:any)=>child.tag==='button');
 assert.equal(card.attrs['aria-pressed'],'false');assert.match(card.attrs['aria-label'],/Bắt đầu nhé/);
 card.click();assert.equal(clicked,true);
 state.taskFocus={taskId:'a',endsAt:end};root=renderWorkState(ui,state,plan,now);
 assert.equal(root.children.find((child:any)=>child.tag==='button').attrs['aria-pressed'],'true');
 assert.match(flatten(root),/Đang làm đến 14:30/);
 root=renderWorkState(ui,state,plan,end);
 assert.match(flatten(root),/Sắp tới · 15:00–15:45/);
 assert.equal(root.children.find((child:any)=>child.tag==='button').attrs['aria-pressed'],'false');
 state.resting=true;assert.match(flatten(renderWorkState(ui,state,plan,end)),/Đang nghỉ/);
 state.tasks[1]!.done=true;assert.match(flatten(renderWorkState(ui,state,plan,end)),/Không còn phiên làm việc trong lịch/);
 assert.match(flatten(renderWorkState(ui,state,null,end)),/Chưa có lịch làm việc/);
});

test('web syntax check covers every shipped JavaScript asset',()=>{
 assert.match(scripts['check:web']??'',/node --check web\/api\.js/);
 assert.match(scripts['check:web']??'',/node --check web\/app\.js/);
 for(const file of ['achievements','reminders','timeline','today'])assert.match(scripts['check:web']??'',new RegExp(`node --check web/views/${file}\\.js`));
});

test('today controls use the shared task and progress flows',()=>{
 assert.ok(api.includes("mode:'timeline'"));
 assert.ok(today.includes('ui.openTodayPlan(t.id)'));
 assert.ok(app.includes("performLive('task-work'"));
 assert.ok(app.includes("performLive('day-plan'"));
 assert.ok(app.includes("performLive('task-focus'"));
 assert.ok(app.includes("{operation:active?'stop':'start'}"));
 assert.ok(!app.includes("operation:active?'stop':'start',taskId"));
 assert.ok(today.includes("ui.toggleTaskFocus(card)"));
 assert.ok(today.includes("'Bắt đầu nhé?'"));
 assert.ok(!today.includes('Không đang làm'));
 assert.ok(today.includes('Đang làm'));
 assert.ok(today.includes('Tiếp theo · '));
 assert.ok(today.includes('flameLevel(state.cultivation?.streak)'));
 assert.ok(achievements.includes('flameLevel(streak)'));
 assert.ok(today.includes("setProperty('--flame',flame.color)"));
 assert.ok(achievements.includes("setProperty('--flame',flame.color)"));
 assert.ok(app.includes('nextBoundary-now+20'));
 assert.ok(today.includes("'Cậu cứ tập trung nhé'"));
 assert.ok(today.includes("state.taskFocusTarget"));
 assert.ok(today.includes('focus-flip-card'));
 assert.ok(today.includes("addFace('front'"));
 assert.ok(today.includes("addFace('back'"));
 assert.ok(app.includes("focusEffect(target)"));
 assert.ok(app.includes("revertFocusEffect(target)"));
 assert.ok(styles.includes('@keyframes focus-card-flip-forward'));
 assert.ok(styles.includes('.focus-flip-card.focus-activating:not(.is-focused) .focus-flip-inner'));
 assert.ok(styles.includes('@media(prefers-reduced-motion:reduce){.focus-flip-card .focus-flip-inner'));
 assert.ok(styles.includes('.plan-actions .plan-action-main{background:var(--surface)'));
 assert.ok(!today.includes('VIỆC TIẾP THEO'));
 assert.ok(!today.includes("button('Mở việc'"));
 assert.ok(!today.includes('daily-focus-action'));
 assert.ok(!today.includes('Khung hôm nay đã hết'));
 assert.ok(!app.includes("entries.push({taskId:select.value,minutes:45})"));
 assert.ok(api.includes('actualMinutes'));
});

test('breakthrough progress tracks qi while sleep streak remains a separate condition',()=>{
 assert.ok(achievements.includes('Math.round(100*qi/next.qi)'));
 assert.ok(achievements.includes('Math.min(100,percent)'));
 assert.ok(achievements.includes("' · dư '+surplus+' tu vi'"));
 assert.ok(achievements.includes("'Điều kiện đột phá'"));
 assert.ok(achievements.includes("c.streak+' / '+next.days+' ngày đúng giờ'"));
 assert.ok(!achievements.includes('Math.min(c.qi/next.qi,c.streak/next.days)'));
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

test('reward result stays visually plain without a decorative star prefix',()=>{
 assert.ok(app.includes('reveal.textContent=rewardLabels[saved.reward]??saved.reward'));
 assert.ok(app.includes("result.textContent=reward.label+' · Còn '"));
 assert.ok(!app.includes("textContent='✦ '+(rewardLabels"));
 assert.ok(!app.includes("textContent='✦ '+reward.label"));
});
