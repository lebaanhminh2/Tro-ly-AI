import {createDemo} from './api.js';
import {renderToday} from './views/today.js';
import {renderReminders} from './views/reminders.js';
import {renderAchievements} from './views/achievements.js';

const state=createDemo(),content=document.querySelector('#content'),sheet=document.querySelector('#sheet'),sheetContent=document.querySelector('#sheet-content');
let toastTimer;
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function button(text,action,className='secondary'){const b=el('button',text,className);b.type='button';b.addEventListener('click',action);return b;}
function card(extra=''){return el('div',undefined,'card '+extra);}
function heading(title,description){const box=el('div',undefined,'heading'),group=el('div');group.append(el('h1',title),el('p',description,'subtitle'));box.append(group);return box;}
function toast(message){const node=document.querySelector('#toast');clearTimeout(toastTimer);node.textContent=message;node.classList.add('visible');toastTimer=setTimeout(()=>node.classList.remove('visible'),3500);}
function openSheet(title){sheetContent.replaceChildren();const row=el('div',undefined,'sheet-title-row'),h=el('h2',title);h.id='sheet-title';row.append(h,button('✕',()=>sheet.close(),'icon-button'));sheetContent.append(row);if(!sheet.open)sheet.showModal();}
function field(label,type,value='',required=true){const wrap=el('label',label,'form-field'),input=el('input');input.type=type;input.value=value;input.required=required;wrap.append(input);return {wrap,input};}
function empty(title,text,action,label){const c=card('empty');c.append(el('span','✧','empty-symbol'),el('h2',title),el('p',text),button(label,action,'primary'));return c;}
function confirm(title,description,action){openSheet(title);sheetContent.append(el('p',description,'hint'));const actions=el('div',undefined,'actions');actions.append(button('Xác nhận',()=>{sheet.close();action();},'primary'),button('Quay lại',()=>sheet.close(),'secondary'));sheetContent.append(actions);}
function toggleTask(task){
 if(task.done){confirm('Mở lại #'+task.code,'Task sẽ trở lại danh sách đang làm. Các bước đã xong vẫn giữ.',()=>{task.done=false;render();toast('Demo: đã mở lại task.');});return;}
 const open=task.steps.filter(s=>!s.done).length;
 confirm('Hoàn thành #'+task.code,open?'Còn '+open+' bước chưa xong. Đánh dấu hoàn thành cả task và các bước còn lại?':'Xác nhận đã xong toàn bộ công việc này?',()=>{task.done=true;task.steps.forEach(s=>s.done=true);render();toast('Ui xong rồi này :> · Chỉ là thao tác demo');});
}
function openTask(task){
 openSheet(task?'#'+task.code+' · Chi tiết':'Thêm công việc');
 const form=el('form'),name=field('Tên công việc','text',task?.title??''),deadline=field('Ngày hết hạn','date',task?.deadline??'',false);name.input.maxLength=160;form.append(name.wrap,deadline.wrap);
 if(task){
  form.append(el('h3','Các bước nhỏ'));
  for(const step of task.steps){const row=el('label',undefined,'task-row'),check=el('input');check.type='checkbox';check.className='check';check.checked=step.done;const label=el('span','#'+step.code+' · '+step.title);
   check.addEventListener('change',()=>{
    if(task.done&&!check.checked){confirm('Mở lại bước và task?','Mở lại #'+step.code+' cũng mở lại #'+task.code+'.',()=>{task.done=false;step.done=false;render();openTask(task);});return;}
    step.done=check.checked;
    if(task.steps.every(s=>s.done)&&!task.done){confirm('Các bước đều xong rồi','Cậu muốn đánh dấu hoàn thành cả #'+task.code+' không?',()=>{task.done=true;render();});}
   });row.append(check,label);form.append(row);
  }
  form.append(button('+ Thêm bước',()=>{openSheet('Thêm bước cho #'+task.code);const f=el('form'),title=field('Tên bước','text');f.append(title.wrap);const save=el('button','Thêm bước','primary');save.type='submit';f.append(save);f.addEventListener('submit',e=>{e.preventDefault();const value=title.input.value.trim();if(!value)return;task.steps.push({code:task.code+'.'+task.nextStep++,title:value,done:false});task.done=false;render();openTask(task);});sheetContent.append(f);},'text-button'));
 }
 const actions=el('div',undefined,'actions'),save=el('button','Lưu thay đổi mẫu','primary');save.type='submit';actions.append(save);
 if(task)actions.append(button(task.done?'Mở lại':'Hoàn thành',()=>toggleTask(task),'secondary'));
 form.append(actions);form.addEventListener('submit',event=>{event.preventDefault();const title=name.input.value.trim();if(!title)return;if(task){task.title=title;task.deadline=deadline.input.value;}else state.tasks.push({code:state.nextTask++,title,deadline:deadline.input.value,done:false,steps:[],nextStep:1});sheet.close();render();toast('Đã đổi bản mẫu · Không lưu lên bot');});
 sheetContent.append(form,el('p','Mã không đổi khi sắp xếp. Trong bản thật cậu có thể nói “sửa task #24”.','hint'));
}
function confirmDelete(){const selected=state.tasks.filter(t=>state.selected.has(t.code));confirm('Xóa '+selected.length+' công việc?',selected.map(t=>'#'+t.code+' '+t.title).join(' · ')+' — thao tác này chỉ tác động dữ liệu demo.',()=>{state.tasks=state.tasks.filter(t=>!state.selected.has(t.code));state.selected.clear();state.selecting=false;render();toast('Đã xóa trong bản mẫu. Tải lại trang để khôi phục.');});}
function openReminder(reminder){
 openSheet(reminder?'Chỉnh lời nhắc':'Thêm lời nhắc');
 const form=el('form'),name=field('Nhắc việc gì?','text',reminder?.title??''),times=field('Giờ nhắc · ví dụ 09:00, 15:00','text',reminder?.times??'09:00');
 const typeLabel=el('label','Lặp lại','form-field'),type=el('select');for(const [value,label] of [['once','Một lần'],['daily','Hằng ngày'],['weekdays','Các thứ trong tuần']]){const option=el('option',label);option.value=value;type.append(option);}type.value=reminder?.kind??'daily';typeLabel.append(type);
 const from=field('Bắt đầu từ','date',reminder?.start??'2026-09-13'),end=field('Kết thúc · bỏ trống để tiếp tục','date',reminder?.end??'',false);
 const days=el('div',undefined,'weekday-list');for(let n=1;n<=7;n++){const label=el('label'),input=el('input');input.type='checkbox';input.value=String(n);input.checked=reminder?.weekdays.includes(n)??[1,3,5].includes(n);label.append(input,el('span',n===7?'CN':'T'+(n+1)));days.append(label);}
 const showDays=()=>{days.hidden=type.value!=='weekdays';end.wrap.hidden=type.value==='once';};type.addEventListener('change',showDays);showDays();
 form.append(name.wrap,typeLabel,days,times.wrap,from.wrap,end.wrap,el('p','Lịch lặp tiếp tục đến khi tắt hoặc đến ngày kết thúc. Không phải thiết lập lại mỗi sáng.','hint'));
 const submit=el('button',reminder?'Lưu cả lịch mẫu':'Tạo lịch mẫu','primary');submit.type='submit';form.append(submit);
 form.addEventListener('submit',event=>{
  event.preventDefault();const slots=times.input.value.split(',').map(t=>t.trim());if(slots.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))){toast('Nhập giờ dạng HH:mm, cách nhau bằng dấu phẩy.');return;}
  const weekdays=[...days.querySelectorAll('input:checked')].map(i=>Number(i.value));if(type.value==='weekdays'&&!weekdays.length){toast('Chọn ít nhất một thứ.');return;}if(end.input.value&&end.input.value<from.input.value){toast('Ngày kết thúc phải sau ngày bắt đầu.');return;}
  const value={title:name.input.value.trim(),kind:type.value,times:[...new Set(slots)].join(', '),weekdays,start:from.input.value,end:type.value==='once'?'':end.input.value,enabled:reminder?.enabled??true};
  if(!value.title)return;if(reminder)Object.assign(reminder,value);else state.reminders.push({id:state.nextReminder++,...value});sheet.close();render();toast('Đã cập nhật lịch mẫu, chưa tạo thông báo thật.');
 });
 sheetContent.append(form);
 if(reminder){const actions=el('div',undefined,'actions');actions.style.marginTop='18px';actions.append(button('Bỏ lần kế tiếp',()=>{reminder.skipped=true;sheet.close();render();toast('Demo: bỏ một lần, không tắt lịch lặp.');},'secondary'),button(reminder.enabled?'Tắt cả lịch':'Bật cả lịch',()=>{reminder.enabled=!reminder.enabled;sheet.close();render();},'secondary'));sheetContent.append(actions);}
}
function openSettings(){
 openSheet('Nhịp sinh hoạt');const form=el('form'),start=field('Bắt đầu ngày','time',state.start),sleep=field('Giờ nghỉ mục tiêu','time',state.sleep);form.append(start.wrap,sleep.wrap,el('p','Giờ nghỉ là mục tiêu. /ngu mới xác nhận cậu bắt đầu nghỉ; chat và chỉnh dữ liệu vẫn hoạt động.','hint'));
 const save=el('button','Lưu trong bản mẫu','primary');save.type='submit';form.append(save);form.addEventListener('submit',e=>{e.preventDefault();if(start.input.value===sleep.input.value){toast('Giờ bắt đầu và giờ nghỉ cần khác nhau.');return;}state.start=start.input.value;state.sleep=sleep.input.value;sheet.close();render();toast('Demo: chưa đổi giờ sinh hoạt trên bot.');});sheetContent.append(form);
}
function openAvailability(){openSheet('Thời gian hôm nay');sheetContent.append(el('p','04:30–22:30 là khung mẫu, không có nghĩa cậu phải làm việc cả ngày.','hint'),el('h3','Điều chỉnh bằng trò chuyện'),el('p','/lich hôm nay 14–17h tớ có việc, xếp lại giúp tớ.','card'),el('p','Bản này chỉ minh họa. Editor giờ rảnh và planner sẽ được nối backend ở bước sau.','hint'));}
function openShare(){openSheet('Thẻ thành tích mẫu');const c=el('div',undefined,'rank-card');c.append(el('div','✧','rank-seal'),el('p','TU LUYỆN KỶ LUẬT','eyebrow'),el('h2','Luyện Khí'),el('p','3 ngày báo ngủ đúng giờ'),el('p','MINH ANH · DEMO','eyebrow'));sheetContent.append(c,el('p','Không chứa tên task hoặc lịch cá nhân. Bản mẫu chưa có thao tác chia sẻ/lưu ảnh.','hint'));}
const ui={el,button,heading,card,toast,empty,render,openTask,toggleTask,confirmDelete,openReminder,openAvailability,openShare};
function render(){
 content.removeAttribute('aria-busy');
 for(const b of document.querySelectorAll('[data-tab]')){if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 content.replaceChildren();
 if(state.screenState==='empty')content.append(heading('Bắt đầu nhẹ thôi.','Mọi thứ sẽ hiện ở đây khi cậu thêm dữ liệu.'),empty('Một khoảng mới cho cậu','Không có biểu đồ rỗng hay thành tích được bịa ra.',()=>{state.screenState='ready';render();},'Xem dữ liệu mẫu'));
 else if(state.screenState==='error')content.append(heading('Chưa tải được dữ liệu','Đây là trạng thái lỗi giả lập.'),empty('Không có thay đổi nào được lưu','Trong bản thật, thử lại sẽ giữ nguyên thao tác đang làm.',()=>{state.screenState='ready';render();},'Thử lại'));
 else if(state.screenState==='loading'){content.append(heading('Đang mở không gian…','Trạng thái tải giả lập'),el('div',undefined,'loading'));content.setAttribute('aria-busy','true');}
 else{content.removeAttribute('aria-busy');content.append(state.tab==='today'?renderToday(ui,state):state.tab==='reminders'?renderReminders(ui,state):renderAchievements(ui));}
 const controls=el('div',undefined,'demo-controls');
 for(const [mode,label] of [['ready','Có dữ liệu'],['empty','Trống'],['loading','Đang tải'],['error','Lỗi']])controls.append(button(label,()=>{state.screenState=mode;render();},'text-button'));
 controls.append(button('Sáng / tối',()=>{const dark=document.documentElement.dataset.theme==='dark';document.documentElement.dataset.theme=dark?'light':'dark';},'text-button'),button('Xem chế độ nghỉ',()=>{state.resting=!state.resting;state.tab='today';state.screenState='ready';render();},'text-button'));
 content.append(controls);
}
document.querySelector('#settings').addEventListener('click',openSettings);
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{state.tab=b.dataset.tab;state.screenState='ready';render();window.scrollTo(0,0);});
sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientY<r.top)sheet.close();}});
sheet.addEventListener('close',render);
render();
