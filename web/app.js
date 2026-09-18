import {applyTheme,setThemePreference,themePreference,connectLive,liveMutation,refreshLive,historyPage,createDemo,realms,loot,talismans,demoDraw,demoFuse,demoBreakthrough,demoCompleteTask} from './api.js';
import {renderToday} from './views/today.js';
import {updateTimelineClock} from './views/timeline.js';
import {renderReminders} from './views/reminders.js';
import {renderAchievements} from './views/achievements.js';

const state=createDemo(),content=document.querySelector('#content'),sheet=document.querySelector('#sheet'),sheetContent=document.querySelector('#sheet-content');
let toastTimer;
let saving=false;
const rewardLabels={qi1:'+1 tu vi',qi2:'+2 tu vi',basic:'Phá Cảnh Phù sơ cấp',keepsake:'Tín vật Minh Anh',heart:'Hộ Tâm Phù',peace:'An Tâm Phù'};
applyTheme();
async function performLive(path,input,options={}){
 if(saving)return null;saving=true;
 const controls=[...document.querySelectorAll('button')].map(b=>({button:b,disabled:b.disabled}));
 const save=sheet.querySelector('button[type=submit]');const oldLabel=save?.textContent;if(save)save.textContent='Đang lưu…';controls.forEach(({button:b})=>b.disabled=true);
 try{const data=await liveMutation(path,input);Object.assign(state,data);if(!options.keepSheet)sheet.close();render();const result=data.result?.result??data.result;
  if(!options.silent)toast(result?.reward?'Nhận '+(rewardLabels[result.reward]??result.reward):typeof result?.success==='boolean'?(result.success?'Thành công ✦':'Chưa thành công. Kết quả đã lưu, không thử lại trong cùng lượt.'):result?.protected?'Đã kích hoạt bảo vệ cho hôm nay.':'Đã lưu.');return result;}
 catch(error){toast(error.message||'Chưa lưu được, kiểm tra lại nhé.');return null;}
 finally{if(save?.isConnected)save.textContent=oldLabel;saving=false;controls.forEach(({button:b,disabled})=>{if(b.isConnected)b.disabled=disabled;});render();}
}
state.live=location.pathname.startsWith('/app/');
if(state.live){state.tasks=[];state.reminders=[];state.cultivation={...state.cultivation,qi:0,totalEarned:0,rank:0,highestRank:0,streak:0,tickets:0,inventory:{basic:0,middle:0,high:0,supreme:0,heart:0,peace:0,keepsake:0}};}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function button(text,action,className='secondary'){const b=el('button',text,className);b.type='button';b.addEventListener('click',action);return b;}
function card(extra=''){return el('div',undefined,'card '+extra);}
function heading(title,description){const box=el('div',undefined,'heading'),group=el('div');group.append(el('h1',title),el('p',description,'subtitle'));box.append(group);return box;}
function toast(message){const inline=document.querySelector('#sheet-feedback');if(sheet.open&&inline){inline.textContent=message;inline.hidden=false;}const node=document.querySelector('#toast');clearTimeout(toastTimer);node.textContent=message;node.classList.add('visible');toastTimer=setTimeout(()=>node.classList.remove('visible'),3500);}
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',name==='close'?'M6 6l12 12M18 6L6 18':'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0');svg.append(path);return svg;}
function lockPageScroll(){document.documentElement.classList.add('sheet-open');document.body.classList.add('sheet-open');}
function unlockPageScroll(){document.documentElement.classList.remove('sheet-open');document.body.classList.remove('sheet-open');}
function closeSheet(){sheet.classList.remove('task-sheet-open','schedule-sheet-open');if(sheet.open)sheet.close();else{unlockPageScroll();render();}}
function openSheet(title){sheet.classList.remove('task-sheet-open','schedule-sheet-open');sheetContent.replaceChildren();const row=el('div',undefined,'sheet-title-row'),h=el('h2',title);h.id='sheet-title';h.tabIndex=-1;const close=button('',closeSheet,'icon-button');close.setAttribute('aria-label','Đóng');close.setAttribute('data-sheet-close','true');close.append(icon('close'));row.append(h,close);sheetContent.append(row);const feedback=el('p','','form-feedback');feedback.id='sheet-feedback';feedback.hidden=true;feedback.setAttribute('role','status');sheetContent.append(feedback);if(!sheet.open){lockPageScroll();sheet.showModal();}h.focus({preventScroll:true});}
function field(label,type,value='',required=true){const wrap=el('label',label,'form-field'),input=el('input');input.type=type;input.value=value;input.required=required;wrap.append(input);if(type==='time'){input.step='60';const hint=el('span','','clock-hint');const update=()=>{if(!input.value){hint.textContent='Chọn giờ · định dạng 24 giờ';return;}const [h,m]=input.value.split(':').map(Number);hint.textContent=input.value+' — '+(h%12||12)+' giờ'+(m?' '+m+' phút':'')+' '+(h<12?'sáng':h<18?'chiều':'tối');};input.addEventListener('input',update);update();wrap.append(hint);}return {wrap,input};}
function noteField(value=''){const wrap=el('label','Ghi chú','form-field'),input=el('textarea');input.value=value;input.maxLength=2000;input.rows=5;input.placeholder='Thông tin quan trọng, đường dẫn, ý tưởng…';wrap.append(input,el('span','Chỉ lưu cùng task, không tự gửi cho Gemini.','clock-hint'));return {wrap,input};}
function empty(title,text,action,label){const c=card('empty');c.append(el('span','✧','empty-symbol'),el('h2',title),el('p',text),button(label,action,'primary'));return c;}
function confirm(title,description,action){openSheet(title);sheetContent.append(el('p',description,'hint'));const actions=el('div',undefined,'actions');actions.append(button('Xác nhận',()=>{sheet.close();action();},'primary'),button('Quay lại',()=>sheet.close(),'secondary'));sheetContent.append(actions);}
function toggleTask(task){
 if(state.live){confirm(task.done?'Mở lại #'+task.code:'Hoàn thành #'+task.code,task.done?'Mở lại task cha, giữ trạng thái các bước đã xong.':'Đánh dấu xong cả task và các bước còn lại?',()=>performLive('tasks',{operation:'complete',taskId:task.id,version:task.version,complete:!task.done,confirm:true}));return;}

 if(task.done){confirm('Mở lại #'+task.code,'Task sẽ trở lại danh sách đang làm. Các bước đã xong vẫn giữ.',()=>{task.done=false;render();toast('Demo: đã mở lại task.');});return;}
 const open=task.steps.filter(s=>!s.done).length;
 confirm('Hoàn thành #'+task.code,open?'Còn '+open+' bước chưa xong. Đánh dấu hoàn thành cả task và các bước còn lại?':'Xác nhận đã xong toàn bộ công việc này?',()=>{task.done=true;demoCompleteTask(state.cultivation,task.code);task.steps.forEach(s=>s.done=true);render();toast('Ui xong rồi này :> · Chỉ là thao tác demo');});
}
function openTask(task){
 openSheet(task?'#'+task.code+' · Chi tiết':'Thêm công việc');
 sheet.classList.add('task-sheet-open');
 const shell=el('div',undefined,'task-sheet'),body=el('div',undefined,'task-sheet-body'),form=el('form');
 form.id='task-sheet-form';
 const name=field('Tên công việc','text',task?.title??''),note=noteField(task?.note??''),deadline=field('Ngày hết hạn','date',task?.deadline?.slice(0,10)??'',false),deadlineTime=field('Giờ hết hạn · để trống là 23:59','time',task?.deadline?.includes('T')?task.deadline.slice(11,16):'',false);name.input.maxLength=160;form.append(name.wrap,note.wrap,deadline.wrap,deadlineTime.wrap);
 let progress=null;
 if(task&&state.live){
  const planned=state.dailyPlan?.plan?.items.find(item=>item.taskId===task.id),actual=Number(planned?.actualMinutes??task.actualMinutes??0);
  const remaining=task.remainingMinutes??planned?.remaining??null,baseRemaining=remaining===null?null:Number(remaining)+actual;
  let sliderMax=Math.min(1440,Math.max(120,actual+Number(remaining??0)));
  const box=el('section',undefined,'work-progress'),head=el('div',undefined,'progress-head'),label=el('label','Đã làm hôm nay','progress-label'),minutesControl=el('div',undefined,'minutes-control');
  const minutes=el('input');minutes.type='number';minutes.min='0';minutes.max='1440';minutes.step='5';minutes.value=String(actual);minutes.inputMode='numeric';minutes.className='work-minutes';minutes.setAttribute('aria-label','Số phút đã làm hôm nay');
  const slider=el('input');slider.type='range';slider.min='0';slider.max=String(sliderMax);slider.step='1';slider.value=String(Math.min(actual,sliderMax));slider.className='work-slider';slider.setAttribute('aria-label','Thanh trượt số phút đã làm hôm nay');
  const remainingText=el('p','','progress-remaining'),hint=el('p','Nhập tổng số phút cậu đã làm trong hôm nay, hoặc kéo thanh trượt. Lưu lại không bị cộng/trừ lặp.','hint');
  const updateProgress=value=>{let next=Number(value);if(!Number.isInteger(next)||next<0)next=0;next=Math.min(1440,next);if(next>sliderMax){sliderMax=next;slider.max=String(next);}minutes.value=String(next);slider.value=String(next);remainingText.textContent=baseRemaining===null?'Chưa có ước lượng tổng cho task này':`Còn khoảng ${Math.max(0,baseRemaining-next)} phút`;progress.dirty=next!==actual;progress.minutes=next;};
  minutes.addEventListener('input',()=>updateProgress(minutes.value));slider.addEventListener('input',()=>updateProgress(slider.value));
  progress={dirty:false,minutes:actual};updateProgress(actual);minutesControl.append(minutes,el('span','phút'));head.append(label,minutesControl);box.append(head,slider,remainingText,hint);form.append(box);
 }
 if(task){
  form.append(el('h3','Các bước nhỏ'));
  for(const step of task.steps){const row=el('label',undefined,'task-row'),check=el('input');check.type='checkbox';check.className='check';check.checked=step.done;const label=el('span','#'+step.code+' · '+step.title);
   check.addEventListener('change',()=>{
    if(state.live){const act=()=>performLive('tasks',{operation:'step_status',taskId:task.id,stepId:step.id,version:task.version,complete:check.checked,confirm:true});if(task.done&&!check.checked)confirm('Mở lại bước và task?','Task cha sẽ trở lại đang làm.',act);else act();return;}

    if(task.done&&!check.checked){confirm('Mở lại bước và task?','Mở lại #'+step.code+' cũng mở lại #'+task.code+'.',()=>{task.done=false;step.done=false;render();openTask(task);});return;}
    step.done=check.checked;
    if(task.steps.every(s=>s.done)&&!task.done){confirm('Các bước đều xong rồi','Cậu muốn đánh dấu hoàn thành cả #'+task.code+' không?',()=>{task.done=true;demoCompleteTask(state.cultivation,task.code);render();});}
   });row.append(check,label);form.append(row);
  }
  form.append(button('+ Thêm bước',()=>{openSheet('Thêm bước cho #'+task.code);const f=el('form'),title=field('Tên bước','text');f.append(title.wrap);const save=el('button','Thêm bước','primary');save.type='submit';f.append(save);f.addEventListener('submit',e=>{e.preventDefault();const value=title.input.value.trim();if(!value)return;if(state.live){performLive('tasks',{operation:'add_step',taskId:task.id,version:task.version,title:value,confirm:false});return;}task.steps.push({code:task.code+'.'+task.nextStep++,title:value,done:false});task.done=false;render();openTask(task);});sheetContent.append(f);},'text-button'));
 }
 body.append(form,el('p','Mã không đổi khi sắp xếp. Trong bản thật cậu có thể nói “sửa task #24”.','hint'));shell.append(body);
 const actions=el('div',undefined,'actions task-actions'),save=el('button',state.live?(progress?'Lưu task và tiến độ':'Lưu thay đổi'):'Lưu thay đổi mẫu','primary');save.type='submit';save.setAttribute('form',form.id);actions.append(save);
 if(task)actions.append(button(task.done?'Mở lại':'Hoàn thành',()=>toggleTask(task),'secondary'));
 if(task&&state.live)actions.append(button(state.dailyPlan?.plan?.items.some(item=>item.taskId===task.id)?'Chỉnh trong hôm nay':'Thêm vào hôm nay',()=>openTodayPlan(task.id),'secondary'));
 shell.append(actions);
 form.addEventListener('submit',async event=>{event.preventDefault();const title=name.input.value.trim();if(!title)return;const deadlineValue=deadline.input.value?(deadlineTime.input.value?deadline.input.value+'T'+deadlineTime.input.value+':00+07:00':deadline.input.value):null;if(state.live){const taskChanged=!task||title!==task.title||note.input.value!==(task.note??'')||deadlineValue!==(task.deadline||null);if(!taskChanged&&!progress?.dirty){sheet.close();return;}if(taskChanged){const saved=await performLive('tasks',{operation:task?'edit':'create',...(task?{taskId:task.id,version:task.version}:{}),title,note:note.input.value,...(!task||deadlineValue!==(task.deadline||null)?{deadline:deadlineValue}:{})},{keepSheet:true,silent:true});if(!saved)return;}if(task&&progress?.dirty){const saved=await performLive('task-work',{taskId:task.id,minutes:progress.minutes,note:null},{keepSheet:true,silent:true});if(!saved)return;}sheet.close();render();toast(progress?.dirty?'Đã lưu task và tiến độ hôm nay.':'Đã lưu thay đổi.');return;}if(task){task.title=title;task.note=note.input.value;task.deadline=deadlineValue??'';}else state.tasks.push({code:state.nextTask++,title,note:note.input.value,deadline:deadlineValue??'',done:false,steps:[],nextStep:1});sheet.close();render();toast('Đã đổi bản mẫu · Không lưu lên bot');});
 sheetContent.append(shell);
}

function openTodayPlan(addTaskId=null){
 openSheet('Chỉnh kế hoạch hôm nay');
 if(!state.live||!state.dailyPlan?.plan){sheetContent.append(el('p','Chưa có kế hoạch để chỉnh. Cài giờ sinh hoạt trước nhé.','hint'));return;}
 const plan=state.dailyPlan.plan;
 const entries=plan.items.map(item=>({taskId:item.taskId,minutes:item.minutes}));
 const totalMinutes=()=>entries.reduce((sum,item)=>sum+(Number.isInteger(item.minutes)?item.minutes:0),0);
 const suggestedMinutes=task=>{const remaining=Number(task.remainingMinutes),spare=Math.max(0,(plan.capacity??0)-totalMinutes());if(!Number.isFinite(remaining)||remaining<=0)return null;return Math.max(5,Math.min(960,remaining,spare||remaining));};
 if(addTaskId&&!entries.some(item=>item.taskId===addTaskId)){const task=state.tasks.find(item=>item.id===addTaskId);if(task&&!task.done)entries.push({taskId:task.id,minutes:suggestedMinutes(task)});}
 const intro=el('p','Đổi phút, sắp xếp hoặc để task sang hôm khác. Task đã hoàn thành được giữ nguyên để tổng hôm nay không bị giảm.','hint'),rows=el('div'),picker=el('div',undefined,'plan-picker'),feedback=el('p','','hint');
 const sync=()=>{[...rows.querySelectorAll('[data-task-id]')].forEach(row=>{const item=entries.find(entry=>entry.taskId===row.dataset.taskId),input=row.querySelector('[data-plan-minutes]');if(item&&input&&!input.disabled)item.minutes=input.value===''?null:Number(input.value);});};
 const draw=()=>{
  rows.replaceChildren();
  for(const [index,item] of entries.entries()){
   const task=state.tasks.find(value=>value.id===item.taskId);if(!task)continue;
   const row=el('section',undefined,'plan-edit-row'+(task.done?' plan-edit-done':''));row.dataset.taskId=item.taskId;
   const info=el('div',undefined,'plan-edit-info');info.append(el('strong','#'+task.code+' '+task.title),el('small',task.done?'Đã xong · giữ trong tổng hôm nay':'Trong kế hoạch hôm nay'));
   const minutes=field('Phút hôm nay','number',item.minutes===null?'':String(item.minutes),!task.done);minutes.input.min='5';minutes.input.max='960';minutes.input.step='5';minutes.input.dataset.planMinutes='';minutes.input.placeholder='Nhập phút';minutes.input.disabled=task.done;
   const controls=el('div',undefined,'plan-order');
   const up=button('↑',()=>{sync();[entries[index-1],entries[index]]=[entries[index],entries[index-1]];draw();},'secondary');up.disabled=index===0;up.setAttribute('aria-label','Đưa lên');
   const down=button('↓',()=>{sync();[entries[index],entries[index+1]]=[entries[index+1],entries[index]];draw();},'secondary');down.disabled=index===entries.length-1;down.setAttribute('aria-label','Đưa xuống');
   controls.append(up,down);if(task.done)controls.append(el('span','Đã ghi nhận','plan-status'));else controls.append(button('Để hôm khác',()=>{sync();entries.splice(index,1);draw();},'text-button'));row.append(info,minutes.wrap,controls);rows.append(row);
  }
  picker.replaceChildren();const available=state.tasks.filter(task=>!task.done&&!entries.some(item=>item.taskId===task.id));
  if(available.length){const select=el('select');for(const task of available){const option=el('option','#'+task.code+' · '+task.title);option.value=task.id;select.append(option);}picker.append(select,button('+ Thêm vào hôm nay',()=>{sync();const task=available.find(item=>item.id===select.value);if(!task)return;entries.push({taskId:task.id,minutes:suggestedMinutes(task)});draw();if(entries.at(-1)?.minutes===null)rows.querySelector('[data-task-id="'+task.id+'"] [data-plan-minutes]')?.focus();},'secondary'));}
  else picker.append(el('p','Không còn task nào để thêm.','hint'));
  const total=totalMinutes(),capacity=plan.capacity??0,missing=entries.filter(item=>!Number.isInteger(item.minutes)).length;feedback.textContent=(missing?missing+' task cần nhập số phút · ':'')+total+' phút đã chọn · sức chứa hôm nay '+capacity+' phút'+(total>capacity?' · vượt '+(total-capacity)+' phút':'')+'.';
 };
 draw();
 const form=el('form'),save=el('button','Lưu kế hoạch hôm nay','primary');save.type='submit';form.append(intro,rows,picker,feedback,save);form.addEventListener('submit',async event=>{event.preventDefault();sync();if(entries.some(item=>!Number.isInteger(item.minutes)||item.minutes<5||item.minutes>960)){toast('Nhập từ 5 đến 960 phút cho mỗi task hôm nay nhé.');return;}const result=await performLive('day-plan',{version:state.dailyPlan.version,items:entries});if(result?.unscheduled)toast('Đã lưu, nhưng còn '+result.unscheduled+' phút chưa có khung giờ thật để nhắc.');});sheetContent.append(form);
}
function confirmDelete(){if(state.live){const items=state.tasks.filter(t=>state.selected.has(t.code));confirm('Xóa '+items.length+' công việc?',items.map(t=>'#'+t.code+' '+t.title).join(' · ')+' — lời nhắc liên quan sẽ được hủy.',async()=>{const result=await performLive('tasks-delete',{items:items.map(t=>({id:t.id,version:t.version})),confirm:true});if(result){state.selected.clear();state.selecting=false;render();}});return;}const selected=state.tasks.filter(t=>state.selected.has(t.code));confirm('Xóa '+selected.length+' công việc?',selected.map(t=>'#'+t.code+' '+t.title).join(' · ')+' — thao tác này chỉ tác động dữ liệu demo.',()=>{state.tasks=state.tasks.filter(t=>!state.selected.has(t.code));state.selected.clear();state.selecting=false;render();toast('Đã xóa trong bản mẫu. Tải lại trang để khôi phục.');});}
function openReminder(reminder){
 openSheet(reminder?'Chỉnh lời nhắc':'Thêm lời nhắc');
 const form=el('form'),name=field('Nhắc việc gì?','text',reminder?.title??'');
 const times=el('fieldset',undefined,'time-slots'),legend=el('legend','Giờ nhắc · 24 giờ');times.append(legend);
 const rows=el('div');times.append(rows);
 const addTime=value=>{
  if(rows.children.length>=8)return;
  const row=el('div',undefined,'time-slot'),time=field('Giờ '+(rows.children.length+1),'time',value),remove=button('Bỏ giờ',()=>{row.remove();refreshTimes();},'secondary');
  row.append(time.wrap,remove);rows.append(row);refreshTimes();
 };
 const refreshTimes=()=>{[...rows.children].forEach((row,index)=>{row.querySelector('label').firstChild.textContent='Giờ '+(index+1);row.querySelector('button').disabled=rows.children.length===1;});add.disabled=rows.children.length>=8;};
 const add=button('+ Thêm giờ',()=>addTime(''),'text-button');times.append(add);
 for(const value of (reminder?.times??'09:00').split(',').map(t=>t.trim()))addTime(value);

 const typeLabel=el('label','Lặp lại','form-field'),type=el('select');for(const [value,label] of [['once','Một lần'],['daily','Hằng ngày'],['weekdays','Các thứ trong tuần']]){const option=el('option',label);option.value=value;type.append(option);}type.value=reminder?.kind??'daily';if(reminder?.origin==='appointment')type.disabled=true;typeLabel.append(type);
 const from=field('Bắt đầu từ','date',reminder?.start??new Date((state.serverNow??Date.now())+25200000).toISOString().slice(0,10)),end=field('Kết thúc · bỏ trống để tiếp tục','date',reminder?.end??'',false);
 const days=el('div',undefined,'weekday-list');for(let n=1;n<=7;n++){const label=el('label'),input=el('input');input.type='checkbox';input.value=String(n);input.checked=reminder?.weekdays.includes(n)??[1,3,5].includes(n);label.append(input,el('span',n===7?'CN':'T'+(n+1)));days.append(label);}
 const showDays=()=>{days.hidden=type.value!=='weekdays';end.wrap.hidden=type.value==='once';};type.addEventListener('change',showDays);showDays();
 form.append(name.wrap,typeLabel,days,times,from.wrap,end.wrap,el('p','Lịch lặp tiếp tục đến khi tắt hoặc đến ngày kết thúc. Không phải thiết lập lại mỗi sáng.','hint'));
 const submit=el('button',state.live?(reminder?'Lưu cả lịch':'Tạo lịch'):(reminder?'Lưu cả lịch mẫu':'Tạo lịch mẫu'),'primary');submit.type='submit';form.append(submit);
 form.addEventListener('submit',event=>{
  event.preventDefault();const slots=[...rows.querySelectorAll('input')].map(t=>t.value);if(slots.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))){toast('Chọn giờ hợp lệ cho từng lần nhắc nhé.');return;}
  const weekdays=[...days.querySelectorAll('input:checked')].map(i=>Number(i.value));if(type.value==='weekdays'&&!weekdays.length){toast('Chọn ít nhất một thứ.');return;}if(end.input.value&&end.input.value<from.input.value){toast('Ngày kết thúc phải sau ngày bắt đầu.');return;}
  const value={title:name.input.value.trim(),kind:type.value,times:[...new Set(slots)].join(', '),weekdays,start:from.input.value,end:type.value==='once'?'':end.input.value,enabled:reminder?.enabled??true};
  if(!value.title)return;if(state.live){performLive('reminders',{rule:{...(reminder?{id:reminder.id,...(reminder.origin?{origin:reminder.origin}:{})}:{}),title:value.title,kind:value.kind,times:[...new Set(slots)],weekdays,startDate:value.start,endDate:value.end||null,enabled:value.enabled,version:reminder?.version??0}});return;}if(reminder)Object.assign(reminder,value);else state.reminders.push({id:state.nextReminder++,...value});sheet.close();render();toast('Đã cập nhật lịch mẫu, chưa tạo thông báo thật.');
 });
 sheetContent.append(form);
 if(reminder?.origin==='appointment')sheetContent.append(button('Hủy lời nhắc',()=>confirm('Hủy lời nhắc này?','Không xóa công việc liên quan.',()=>performLive('reminders',{rule:{id:reminder.id,origin:'appointment',title:reminder.title,kind:'once',times:reminder.times.split(',').map(t=>t.trim()),weekdays:[],startDate:reminder.start,endDate:null,enabled:false,version:reminder.version}})),'danger'));
 if(reminder&&!reminder.origin){const actions=el('div',undefined,'actions');actions.style.marginTop='18px';actions.append(button('Dời lần kế tiếp',()=>{openSheet('Dời riêng lần kế tiếp');const f=el('form'),date=field('Ngày','date',new Date((state.serverNow??Date.now())+7*3600000).toISOString().slice(0,10)),time=field('Giờ Việt Nam','time','19:00');f.append(date.wrap,time.wrap,el('p','Những lần sau vẫn giữ quy tắc cũ.','hint'));const save=el('button','Lưu lần này','primary');save.type='submit';f.append(save);f.addEventListener('submit',e=>{e.preventDefault();const due=Date.parse(date.input.value+'T'+time.input.value+':00+07:00');if(due<=Date.now()){toast('Chọn giờ tương lai nhé.');return;}if(state.live)performLive('reminder-instance',{ruleId:reminder.id,operation:'move',due});else{toast('Demo: chỉ dời một lần, chưa lưu server.');sheet.close();}});sheetContent.append(f);},'secondary'),button('Bỏ lần kế tiếp',()=>{if(state.live){performLive('reminder-instance',{ruleId:reminder.id,operation:'skip'});return;}reminder.skipped=true;sheet.close();render();toast('Demo: bỏ một lần, không tắt lịch lặp.');},'secondary'),button(reminder.enabled?'Tắt cả lịch':'Bật cả lịch',()=>{if(state.live){performLive('reminders',{rule:{id:reminder.id,...(reminder.origin?{origin:reminder.origin}:{}),title:reminder.title,kind:reminder.kind,times:reminder.times.split(',').map(t=>t.trim()),weekdays:reminder.weekdays,startDate:reminder.start,endDate:reminder.end||null,enabled:!reminder.enabled,version:reminder.version}});return;}reminder.enabled=!reminder.enabled;sheet.close();render();},'secondary'));sheetContent.append(actions);}
}
function openHelp(){openSheet('Hướng dẫn nhanh');for(const [command,description] of [['Chat thường','Trò chuyện, không tự ghi công việc.'],['/ thêm bài toán hạn mai','Thực hiện yêu cầu. Thiếu thông tin thì tớ hỏi.'],['/ mai 7h nhắc tớ dậy','Đặt nhắc một lần; lời nhắc vẫn tuân theo chế độ nghỉ.'],['/lich','Mở phần “Thời gian hôm nay” để cậu tự ghi giờ rảnh, giờ bận và thời lượng task cho chính xác.'],['/ngu','Báo nghỉ, dừng nhắc chủ động; vẫn sửa dữ liệu được.'],['/huy','Thoát phiên nhập đang mở.']]){const box=el('section',undefined,'item-row');box.append(el('strong',command),el('p',description,'hint'));sheetContent.append(box);}}
function openSettings(){
 openSheet('Cài đặt');const form=el('form'),start=field('Bắt đầu ngày','time',state.start),sleep=field('Giờ nghỉ mục tiêu','time',state.sleep),autoDelay=field('Tự xếp lịch nếu chưa cập nhật sau (phút)','number',String(state.autoPlanDelayMinutes??180));autoDelay.input.min='30';autoDelay.input.max='720';autoDelay.input.step='30';form.append(start.wrap,sleep.wrap,autoDelay.wrap,el('p','Thời gian chờ áp dụng từ ngày tiếp theo. Giờ nghỉ là mục tiêu; /ngu mới xác nhận cậu bắt đầu nghỉ.','hint'));
 const save=el('button',state.live?'Lưu giờ sinh hoạt':'Lưu trong bản mẫu','primary');save.type='submit';form.append(save);form.addEventListener('submit',e=>{e.preventDefault();const delay=Number(autoDelay.input.value);if(start.input.value===sleep.input.value){toast('Giờ bắt đầu và giờ nghỉ cần khác nhau.');return;}if(!Number.isInteger(delay)||delay<30||delay>720||delay%30){toast('Chọn thời gian chờ từ 30 đến 720 phút, theo nấc 30 phút nhé.');return;}if(state.live){performLive('settings',{start:start.input.value,sleep:sleep.input.value,autoPlanDelayMinutes:delay,version:state.settingsVersion});return;}state.start=start.input.value;state.sleep=sleep.input.value;state.autoPlanDelayMinutes=delay;sheet.close();render();toast('Demo: chưa đổi giờ sinh hoạt trên bot.');});const themeLabel=el('label','Giao diện','form-field'),theme=el('select');for(const [value,label] of [['auto','Theo Telegram'],['light','Sáng'],['dark','Tối']]){const option=el('option',label);option.value=value;theme.append(option);}theme.value=themePreference();theme.addEventListener('change',()=>setThemePreference(theme.value));themeLabel.append(theme);sheetContent.append(form,themeLabel,button('Hướng dẫn nhanh',openHelp,'secondary'));
}
function openAvailability(){
 if(state.live){
  openSheet('Xếp lịch hôm nay');sheet.classList.add('schedule-sheet-open');
  if(!state.day){sheetContent.append(el('p',state.needsSetup?'Chọn giờ sinh hoạt trước nhé.':'Giờ sinh hoạt đã lưu. Chưa bắt đầu ngày hoạt động tiếp theo; cậu không cần cài lại.','hint'),button('Cài đặt',openSettings,'primary'));return;}
  let saved={};try{saved=JSON.parse(state.day.intervals_json??'{}');}catch{}
  const form=el('form',undefined,'schedule-form');
  const ranges=(title,initial)=>{
   const box=el('fieldset',undefined,'time-slots');box.append(el('legend',title));const rows=el('div');box.append(rows);
   const add=(r={})=>{
    if(rows.children.length>=20)return;
    const local=n=>n?new Date(n+25200000).toISOString().slice(11,16):'';
    const row=el('div',undefined,'availability-row'),from=field('Từ','time',local(r.start)),to=field('Đến','time',local(r.end));
    row.append(from.wrap,to.wrap,button('Bỏ',()=>row.remove(),'secondary'));rows.append(row);
   };
   box.append(button('+ Thêm khoảng',()=>add(),'text-button'));for(const r of initial??[])add(r);form.append(box);return rows;
  };
  form.append(el('p','Chọn giờ cậu có thể làm và giờ bận. Kế hoạch mới chỉ tính từ lúc cậu bấm lưu.','schedule-intro'),el('h3','Thời gian','schedule-section-title'));
  const freeRows=ranges('Có thể làm việc',saved.free),busyRows=ranges('Bận',saved.busy);
  form.append(el('h3','Task cần chỉnh thời lượng','schedule-section-title'),el('p','Không chọn thì task giữ nguyên thời lượng đã lưu. Task chưa có thời lượng sẽ chưa được xếp vào lịch.','estimate-help'));
  const activeTasks=state.tasks.filter(t=>!t.done),picker=el('div',undefined,'duration-picker'),select=el('select'),addTask=button('Chọn task',()=>{},'secondary'),estimateList=el('div',undefined,'estimate-list');
  const estimates=[];
  const refreshPicker=()=>{
   const selected=new Set(estimates.map(item=>item.task.id));select.replaceChildren();
   const placeholder=el('option','Chọn một task…');placeholder.value='';select.append(placeholder);
   for(const task of activeTasks.filter(task=>!selected.has(task.id))){const option=el('option','#'+task.code+' · '+task.title+(task.remainingMinutes==null?' · chưa có thời lượng':' · '+task.remainingMinutes+' phút'));option.value=task.id;select.append(option);}
   addTask.disabled=!select.value;select.disabled=select.options.length===1;
  };
  const addEstimate=task=>{
   const old=saved.estimates?.find(e=>e.id===task.id),remaining=task.remainingMinutes??old?.minutes??'';
   const box=el('section',undefined,'estimate-editor'),title=el('div',undefined,'estimate-title'),f=field('Còn cần làm (phút)','number',remaining===null?'':String(remaining));
   title.append(el('strong','#'+task.code+' · '+task.title),button('Bỏ',()=>{const index=estimates.findIndex(item=>item.task.id===task.id);if(index>=0)estimates.splice(index,1);box.remove();refreshPicker();},'text-button'));
   f.input.min='5';f.input.max='100000';f.input.step='5';f.input.placeholder='Nhập ít nhất 5 phút';
   const slider=el('input');slider.type='range';slider.min='5';slider.max=String(Math.max(600,Math.min(100000,Number(remaining)||600)));slider.step='5';slider.value=String(Math.max(5,Number(remaining)||60));slider.className='work-slider';slider.setAttribute('aria-label','Kéo thời lượng còn lại của '+task.title);
   slider.addEventListener('input',()=>{f.input.value=slider.value;});f.input.addEventListener('input',()=>{const value=Number(f.input.value);if(Number.isFinite(value)&&value>=5){if(value>Number(slider.max))slider.max=String(value);slider.value=String(value);}});
   box.append(title,f.wrap,slider);estimateList.append(box);estimates.push({task,f});refreshPicker();
  };
  select.addEventListener('change',()=>{addTask.disabled=!select.value;});addTask.addEventListener('click',()=>{const task=activeTasks.find(item=>item.id===select.value);if(task)addEstimate(task);});picker.append(select,addTask);form.append(picker,estimateList);refreshPicker();
  const submit=el('button','Lưu và xếp lại kế hoạch','primary');submit.type='submit';const footer=el('div',undefined,'sheet-submit');footer.append(submit);form.append(footer);
  form.addEventListener('submit',e=>{
   e.preventDefault();
   const date=new Date(state.day.start_at+25200000).toISOString().slice(0,10);
   const convert=rows=>[...rows.children].map(row=>{
    const inputs=row.querySelectorAll('input');let start=Date.parse(date+'T'+inputs[0].value+':00+07:00'),end=Date.parse(date+'T'+inputs[1].value+':00+07:00');
    if(start<state.day.start_at)start+=86400000;if(end<=start)end+=86400000;
    return {start,end};
   });
   performLive('schedule',{version:state.day.version,free:convert(freeRows),busy:convert(busyRows),estimates:estimates.map(({task,f})=>({id:task.id,minutes:Number(f.input.value)}))});
  });sheetContent.append(form);return;
 }
 openSheet('Xếp lịch hôm nay');sheetContent.append(el('p','Bản mẫu không lưu dữ liệu. Mở Mini App từ Telegram để xếp lịch thật.','hint'));}
function openShare(){openSheet(state.live?'Thẻ thành tích':'Thẻ thành tích mẫu');const c=el('div',undefined,'rank-card');c.append(el('div','✧','rank-seal'),el('p','TU LUYỆN KỶ LUẬT','eyebrow'),el('h2',realms[state.cultivation.rank].name),el('p','Tổng tích lũy: '+state.cultivation.totalEarned+' tu vi'),el('p',state.live?'MINH ANH · TRỢ LÝ CỦA CẬU':'MINH ANH · DEMO','eyebrow'));sheetContent.append(c,el('p','Không chứa tên task hoặc lịch cá nhân. Chỉ chia sẻ khi cậu chủ động chọn.','hint'),button('Lưu thẻ PNG',()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#242034';ctx.fillRect(0,0,800,1000);ctx.textAlign='center';ctx.fillStyle='#e6c382';ctx.font='28px sans-serif';ctx.fillText('TU LUYỆN KỶ LUẬT',400,220);ctx.font='64px serif';ctx.fillText(realms[state.cultivation.rank].name,400,440);ctx.fillStyle='#f4f0ff';ctx.font='30px sans-serif';ctx.fillText('Tổng tích lũy: '+state.cultivation.totalEarned+' tu vi',400,550);ctx.font='22px sans-serif';ctx.fillText(state.live?'MINH ANH · TRỢ LÝ CỦA CẬU':'MINH ANH · DEMO',400,830);canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='minh-anh-thanh-tich.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},'image/png');},'primary'));}
function demoDay(){if(state.live&&state.day)return state.day.day;return Math.floor((Date.now()+7*3600000-4.5*3600000)/86400000);}

async function playEffect(target,type,duration=720){
 target.classList.remove('effect-spin','effect-breakthrough','effect-success','effect-failure');
 target.classList.add(type==='draw'?'effect-spin':'effect-breakthrough');
 await new Promise(resolve=>setTimeout(resolve,duration));
 target.classList.remove('effect-spin','effect-breakthrough');
}
function openDraw(){
 if(state.live){openSheet('Quay thưởng');const c=state.cultivation,blocked=c.suspended||c.tickets<1;const hint=c.suspended?'Tạm ngưng vì lâu không chat. Nhắn Minh Anh để hoạt động lại.':c.tickets<1?'Chưa có vé. Hoàn thành một task lần đầu để nhận 1 vé.':'Cậu có '+c.tickets+' vé. /ngu không khóa quay thưởng.';const reveal=el('div','?','loot-result mystery-card');reveal.setAttribute('aria-label','Phần thưởng bí ẩn');const draw=button('Dùng 1 vé',async()=>{if(state.cultivation.tickets<1||state.cultivation.suspended||draw.disabled)return;draw.disabled=true;draw.textContent='Đang mở…';await playEffect(reveal,'draw',620);const saved=await performLive('cultivation',{operation:'draw'},{keepSheet:true,silent:true});if(saved===null&&draw.isConnected){draw.disabled=false;draw.textContent='Dùng 1 vé';return;}if(!draw.isConnected)return;reveal.classList.add('mystery-revealed');reveal.textContent='✦ '+(rewardLabels[saved.reward]??saved.reward);const tickets=state.cultivation.tickets;draw.disabled=tickets<1;draw.textContent=tickets<1?'Hết vé':'Quay tiếp · '+tickets+' vé';},'primary reward-action');draw.disabled=blocked;sheetContent.append(el('p',hint,'hint'),reveal,draw);return;}
 openSheet('Linh bảo · Quay thưởng');
 sheetContent.append(el('p','1 vé / lần · Không mua bằng tiền · Kết quả demo','hint'));
 const result=el('div','?','loot-result mystery-card');result.setAttribute('role','status');result.setAttribute('aria-label','Phần thưởng bí ẩn');
 const draw=button('Dùng 1 vé quay',async()=>{
  if(draw.disabled)return;
  draw.disabled=true;draw.textContent='Đang mở…';await playEffect(result,'draw',620);
  const reward=demoDraw(state.cultivation);
  if(!reward){draw.disabled=false;draw.textContent='Dùng 1 vé quay';return;}
  result.classList.add('mystery-revealed');
  result.textContent='✦ '+reward.label+' · Còn '+state.cultivation.tickets+' vé';
  draw.disabled=state.cultivation.tickets===0;render();
  draw.textContent=state.cultivation.tickets===0?'Hết vé':'Quay tiếp';
 },'primary');draw.disabled=state.cultivation.tickets===0;sheetContent.append(result,draw);
 const odds=el('details',undefined,'realm-path');odds.append(el('summary','Xác suất công khai'));
 for(const item of loot)odds.append(el('p',item.label+' — '+item.weight+'%','hint'));sheetContent.append(odds);
}
function openInventory(){
 openSheet('Túi vật phẩm');
 const c=state.cultivation;
 const itemHeading=(name,count)=>{const row=el('div',undefined,'inventory-heading');row.append(el('h3',name),el('span','×'+count,'quantity-badge'));return row;};
 sheetContent.append(el('p','BẢO VỆ','inventory-group'));
 for(const [key,name,description] of [
  ['heart','Hộ Tâm Phù','Nếu cậu ngủ muộn, chuỗi ngủ đúng giờ không bị mất. Tu vi vẫn bị trừ 20 như bình thường.'],
  ['peace','An Tâm Phù','Nếu cậu ngủ muộn, phù chặn lần trừ 20 tu vi của ngày đó. Chuỗi ngủ đúng giờ vẫn bị mất.']
 ]){
  const item=el('section',undefined,'item-row');item.append(itemHeading(name,c.inventory[key]),el('p',description,'hint'));
  const use=button(c.active[key]?(state.live?'Đã kích hoạt hôm nay':'Đã kích hoạt trong demo'):'Dùng hôm nay',()=>confirm('Dùng '+name+'?',description+(state.live?' Chỉ áp dụng ngày sinh hoạt hiện tại.':' Chỉ áp dụng ngày sinh hoạt này trong demo.'),()=>{
   if(c.active[key]||c.inventory[key]<1)return;if(state.live){performLive('cultivation',{operation:'protect',item:key});return;}c.inventory[key]--;c.active[key]=true;c.log.unshift('Dùng '+name+' (demo)');openInventory();render();
  }),'secondary');use.disabled=c.active[key]||c.inventory[key]<1;item.append(use);sheetContent.append(item);
 }
 sheetContent.append(el('p','PHÁ CẢNH','inventory-group'));
 for(const t of talismans){
  const item=el('section',undefined,'item-row');item.append(itemHeading('Phá Cảnh Phù · '+t.name,c.inventory[t.key]),el('p','Khi dùng trong lần đột phá này, cơ hội thành công tăng thêm '+t.boost+' điểm %. Dùng xong sẽ tiêu hao.','hint'));
  if(t.next){const fuse=button('Ghép 3 lá · '+t.chance+'%',()=>confirm('Ghép lên '+talismans.find(n=>n.key===t.next).name+'?',
   'Ghép 3 phù cùng cấp. Thành công nhận 1 phù cấp cao hơn; thất bại mất 1 và trả lại 2. Tỷ lệ thành công '+t.chance+'%.',()=>{
    if(state.live){performLive('cultivation',{operation:'fuse',item:t.key});return;}const success=demoFuse(c,t.key);if(success===null)return;toast(success?'Ghép thành công ✦':'Chưa thành, đã trả lại 2 lá.');openInventory();render();
   }),'secondary');fuse.disabled=c.inventory[t.key]<3;item.append(fuse);}
  sheetContent.append(item);
 }
 sheetContent.append(el('p','TÍN VẬT','inventory-group'),(()=>{const box=el('section',undefined,'item-row');box.append(itemHeading('Tín vật Minh Anh',c.inventory.keepsake),el('p','Vật phẩm sưu tầm, không phải tu vi.','hint'));return box;})());
}
function openBreakthrough(){
 const c=state.cultivation,target=realms[c.rank+1];if(!target)return;
 openSheet('Đột phá · '+target.name);
 sheetContent.append(el('p','Cần '+target.qi+' tu vi và '+target.days+' ngày ngủ đúng giờ. Không tiêu hao tu vi.','hint'));
 const select=el('select'),label=el('label','Dùng Phá Cảnh Phù','form-field'),none=el('option','Không dùng phù');none.value='';select.append(none);
 for(const t of talismans){if(c.inventory[t.key]>0){const option=el('option',t.name+' · +'+t.boost+' điểm %');option.value=t.key;select.append(option);}}
 label.append(select);sheetContent.append(label);
 const info=el('p',undefined,'hint'),result=el('div',undefined,'loot-result');result.hidden=true;result.setAttribute('role','status');
 const chance=()=>Math.min(100,[70,85,100][Math.min(c.failures,2)]+(talismans.find(t=>t.key===select.value)?.boost??0));
 const explain=()=>{info.textContent='Lần này có '+chance()+'% cơ hội thành công. Nếu thất bại, tu vi và chuỗi ngủ không mất; Phá Cảnh Phù đã chọn vẫn được dùng. Mỗi ngày chỉ thử 1 lần.';};select.addEventListener('change',explain);explain();
 const attempt=button('Đột phá',async()=>{
  if(attempt.disabled)return;
  attempt.disabled=true;attempt.textContent='Đang đột phá…';await playEffect(attempt,'breakthrough',860);
  if(state.live){const saved=await performLive('cultivation',{operation:'breakthrough',item:select.value||null},{keepSheet:true,silent:true});if(saved===null&&attempt.isConnected){attempt.disabled=false;attempt.textContent='Đột phá';return;}if(!attempt.isConnected)return;select.disabled=true;result.hidden=false;result.classList.add(saved.success?'effect-success':'effect-failure');result.textContent=saved.success?'Đột phá thành công ✦ '+target.name+' · Được bảo vệ hạ bậc 72 giờ.':'Chưa thành công · Tu vi và chuỗi vẫn giữ, mai mình thử lại nhé.';attempt.textContent='Đã thử hôm nay';return;}
  const r=demoBreakthrough(c,demoDay(),select.value||null);
  if(!r){attempt.disabled=false;attempt.textContent='Đột phá';return;}select.disabled=true;result.hidden=false;
  result.classList.add(r.success?'effect-success':'effect-failure');
  result.textContent=r.success?'Đột phá thành công ✦ '+realms[c.rank].name+' · Được bảo vệ hạ bậc 72 giờ.':'Chưa thành công. Tu vi và chuỗi vẫn giữ, mai thử tiếp nhé.';
  attempt.textContent='Đã thử hôm nay';
  render();
 },'primary');attempt.disabled=c.attemptDay===demoDay()||c.qi<target.qi||c.streak<target.days;
 sheetContent.append(info,attempt,result);
}
async function loadHistory(){
 if(!state.live||state.historyLoading||!state.historyHasMore)return;
 state.historyLoading=true;render();
 try{
  const page=await historyPage(state.historyOffset??0);
  for(const task of page.items??[])if(!state.tasks.some(item=>item.id===task.id))state.tasks.push(task);
  state.historyOffset=(page.offset??state.historyOffset??0)+(page.items?.length??0);
  state.historyHasMore=!!page.hasMore;state.historyTotal=page.total??state.historyTotal;
 }catch(error){toast(error.message||'Chưa tải thêm lịch sử được.');}
 finally{state.historyLoading=false;render();}
}
const ui={loadHistory,state:()=>state,cultivation:()=>state.cultivation,demoDay,openDraw,openInventory,openBreakthrough,el,button,heading,card,toast,empty,render,openTask,openTodayPlan,toggleTask,confirmDelete,openReminder,openAvailability,openShare};
function render(){
 const previousScroll=document.querySelector('.time-scroll');if(previousScroll)state.timelineScroll=previousScroll.scrollTop;
 content.removeAttribute('aria-busy');
 for(const b of document.querySelectorAll('[data-tab]')){if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 content.replaceChildren();
 if(state.live&&!state.loaded&&state.screenState==='error'){content.append(heading('Chưa kết nối được','Không hiển thị dữ liệu mẫu thay dữ liệu thật.'),el('p','Đóng và mở lại ứng dụng từ Telegram.','hint'));return;}
 if(state.screenState==='empty')content.append(heading('Bắt đầu nhẹ thôi.','Mọi thứ sẽ hiện ở đây khi cậu thêm dữ liệu.'),empty('Một khoảng mới cho cậu','Không có biểu đồ rỗng hay thành tích được bịa ra.',()=>{state.screenState='ready';render();},'Xem dữ liệu mẫu'));
 else if(state.screenState==='error')content.append(heading('Chưa tải được dữ liệu','Đây là trạng thái lỗi giả lập.'),empty('Không có thay đổi nào được lưu','Trong bản thật, thử lại sẽ giữ nguyên thao tác đang làm.',()=>{state.screenState='ready';render();},'Thử lại'));
 else if(state.screenState==='loading'){content.append(heading('Minh Anh đang chuẩn bị…','Trạng thái tải giả lập'),el('div',undefined,'loading'));content.setAttribute('aria-busy','true');}
 else{content.removeAttribute('aria-busy');content.append(state.tab==='today'?renderToday(ui,state):state.tab==='reminders'?renderReminders(ui,state):renderAchievements(ui,state));}
 const controls=el('div',undefined,'demo-controls');
 for(const [mode,label] of [['ready','Có dữ liệu'],['empty','Trống'],['loading','Đang tải'],['error','Lỗi']])controls.append(button(label,()=>{state.screenState=mode;render();},'text-button'));
 controls.append(button('Sáng / tối',()=>{const dark=document.documentElement.dataset.theme==='dark';document.documentElement.dataset.theme=dark?'light':'dark';},'text-button'),button('Xem chế độ nghỉ',()=>{state.resting=!state.resting;state.tab='today';state.screenState='ready';render();},'text-button'));
 if(!state.live)content.append(controls);
}
let refreshing=false,lastRefresh=0;
async function refreshOnReturn(){
 if(!state.live||!state.loaded||saving||refreshing||sheet.open||state.timelineDragging||Date.now()-lastRefresh<2000)return;
 refreshing=true;
 try{const latest=await refreshLive();Object.assign(state,latest);lastRefresh=Date.now();render();}catch(error){toast(error.message);}finally{refreshing=false;}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshOnReturn();});
setInterval(()=>{if(document.visibilityState==='visible')updateTimelineClock(state);},15000);
setInterval(()=>{if(document.visibilityState==='visible')refreshOnReturn();},60000);
window.addEventListener('focus',refreshOnReturn);
document.querySelector('#settings').replaceChildren(icon('settings'));
document.querySelector('#settings').addEventListener('click',openSettings);
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{if(state.live&&!state.loaded){toast('Mở lại từ Telegram để tải dữ liệu thật.');return;}state.tab=b.dataset.tab;state.screenState='ready';render();refreshOnReturn();window.scrollTo(0,0);});
sheet.addEventListener('click',event=>{const target=event.target?.closest?.('[data-sheet-close]');if(target){event.preventDefault();closeSheet();return;}if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientY<r.top)closeSheet();}});
sheet.addEventListener('cancel',event=>{event.preventDefault();closeSheet();});
sheet.addEventListener('close',()=>{sheet.classList.remove('task-sheet-open','schedule-sheet-open');unlockPageScroll();render();});
// Keep the live reward hint short; rest/sleep rules are shown elsewhere in the app.
const rewardHintCleaner=new MutationObserver(()=>{for(const node of sheetContent.querySelectorAll('.hint')){if(node.textContent?.includes('/ngu không khóa quay thưởng'))node.textContent=node.textContent.replace(/\s*\/ngu không khóa quay thưởng\.?/,'');}});rewardHintCleaner.observe(sheetContent,{childList:true,subtree:true});
if(state.live){
 document.querySelector('.demo-strip').textContent='MINH ANH · Dữ liệu của cậu';
 state.tasks=[];state.reminders=[];state.screenState='loading';render();
 connectLive().then(data=>{globalThis.Telegram?.WebApp?.onEvent?.('activated',refreshOnReturn);Object.assign(state,data);state.screenState='ready';render();if(state.needsSetup)openSettings();}).catch(error=>{state.screenState='error';render();toast(error.message);});
}else render();
