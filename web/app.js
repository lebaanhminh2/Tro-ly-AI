import {connectLive,liveMutation,createDemo,realms,loot,talismans,demoDraw,demoFuse,demoBreakthrough,demoCompleteTask} from './api.js';
import {renderToday} from './views/today.js';
import {renderReminders} from './views/reminders.js';
import {renderAchievements} from './views/achievements.js';

const state=createDemo(),content=document.querySelector('#content'),sheet=document.querySelector('#sheet'),sheetContent=document.querySelector('#sheet-content');
let toastTimer;
let saving=false;
async function performLive(path,input){
 if(saving)return null;saving=true;
 const controls=[...document.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
 try{const data=await liveMutation(path,input);Object.assign(state,data);sheet.close();render();toast('Đã lưu.');return data.result?.result??data.result;}
 catch(error){toast(error.message||'Chưa lưu được, kiểm tra lại nhé.');return null;}
 finally{saving=false;controls.forEach(b=>b.disabled=false);render();}
}
state.live=location.pathname.startsWith('/app/');
if(state.live){state.tasks=[];state.reminders=[];state.cultivation={...state.cultivation,qi:0,totalEarned:0,rank:0,highestRank:0,streak:0,tickets:0,inventory:{basic:0,middle:0,high:0,supreme:0,heart:0,peace:0,keepsake:0}};}
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
 if(state.live){confirm(task.done?'Mở lại #'+task.code:'Hoàn thành #'+task.code,task.done?'Mở lại task cha, giữ trạng thái các bước đã xong.':'Đánh dấu xong cả task và các bước còn lại?',()=>performLive('tasks',{operation:'complete',taskId:task.id,version:task.version,complete:!task.done,confirm:true}));return;}

 if(task.done){confirm('Mở lại #'+task.code,'Task sẽ trở lại danh sách đang làm. Các bước đã xong vẫn giữ.',()=>{task.done=false;render();toast('Demo: đã mở lại task.');});return;}
 const open=task.steps.filter(s=>!s.done).length;
 confirm('Hoàn thành #'+task.code,open?'Còn '+open+' bước chưa xong. Đánh dấu hoàn thành cả task và các bước còn lại?':'Xác nhận đã xong toàn bộ công việc này?',()=>{task.done=true;demoCompleteTask(state.cultivation,task.code);task.steps.forEach(s=>s.done=true);render();toast('Ui xong rồi này :> · Chỉ là thao tác demo');});
}
function openTask(task){
 openSheet(task?'#'+task.code+' · Chi tiết':'Thêm công việc');
 const form=el('form'),name=field('Tên công việc','text',task?.title??''),deadline=field('Ngày hết hạn','date',task?.deadline?.slice(0,10)??'',false);name.input.maxLength=160;form.append(name.wrap,deadline.wrap);
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
 const actions=el('div',undefined,'actions'),save=el('button',state.live?'Lưu thay đổi':'Lưu thay đổi mẫu','primary');save.type='submit';actions.append(save);
 if(task)actions.append(button(task.done?'Mở lại':'Hoàn thành',()=>toggleTask(task),'secondary'));
 form.append(actions);form.addEventListener('submit',event=>{event.preventDefault();const title=name.input.value.trim();if(!title)return;if(state.live){performLive('tasks',{operation:task?'edit':'create',...(task?{taskId:task.id,version:task.version}:{}),title,...(!task||deadline.input.value!==task.deadline?.slice(0,10)?{deadline:deadline.input.value||null}:{})});return;}if(task){task.title=title;task.deadline=deadline.input.value;}else state.tasks.push({code:state.nextTask++,title,deadline:deadline.input.value,done:false,steps:[],nextStep:1});sheet.close();render();toast('Đã đổi bản mẫu · Không lưu lên bot');});
 sheetContent.append(form,el('p','Mã không đổi khi sắp xếp. Trong bản thật cậu có thể nói “sửa task #24”.','hint'));
}
function confirmDelete(){if(state.live){const items=state.tasks.filter(t=>state.selected.has(t.code));confirm('Xóa '+items.length+' công việc?',items.map(t=>'#'+t.code+' '+t.title).join(' · ')+' — lời nhắc liên quan sẽ được hủy.',async()=>{const result=await performLive('tasks-delete',{items:items.map(t=>({id:t.id,version:t.version})),confirm:true});if(result){state.selected.clear();state.selecting=false;render();}});return;}const selected=state.tasks.filter(t=>state.selected.has(t.code));confirm('Xóa '+selected.length+' công việc?',selected.map(t=>'#'+t.code+' '+t.title).join(' · ')+' — thao tác này chỉ tác động dữ liệu demo.',()=>{state.tasks=state.tasks.filter(t=>!state.selected.has(t.code));state.selected.clear();state.selecting=false;render();toast('Đã xóa trong bản mẫu. Tải lại trang để khôi phục.');});}
function openReminder(reminder){
 openSheet(reminder?'Chỉnh lời nhắc':'Thêm lời nhắc');
 const form=el('form'),name=field('Nhắc việc gì?','text',reminder?.title??''),times=field('Giờ nhắc · ví dụ 09:00, 15:00','text',reminder?.times??'09:00');
 const typeLabel=el('label','Lặp lại','form-field'),type=el('select');for(const [value,label] of [['once','Một lần'],['daily','Hằng ngày'],['weekdays','Các thứ trong tuần']]){const option=el('option',label);option.value=value;type.append(option);}type.value=reminder?.kind??'daily';typeLabel.append(type);
 const from=field('Bắt đầu từ','date',reminder?.start??'2026-09-13'),end=field('Kết thúc · bỏ trống để tiếp tục','date',reminder?.end??'',false);
 const days=el('div',undefined,'weekday-list');for(let n=1;n<=7;n++){const label=el('label'),input=el('input');input.type='checkbox';input.value=String(n);input.checked=reminder?.weekdays.includes(n)??[1,3,5].includes(n);label.append(input,el('span',n===7?'CN':'T'+(n+1)));days.append(label);}
 const showDays=()=>{days.hidden=type.value!=='weekdays';end.wrap.hidden=type.value==='once';};type.addEventListener('change',showDays);showDays();
 form.append(name.wrap,typeLabel,days,times.wrap,from.wrap,end.wrap,el('p','Lịch lặp tiếp tục đến khi tắt hoặc đến ngày kết thúc. Không phải thiết lập lại mỗi sáng.','hint'));
 const submit=el('button',state.live?(reminder?'Lưu cả lịch':'Tạo lịch'):(reminder?'Lưu cả lịch mẫu':'Tạo lịch mẫu'),'primary');submit.type='submit';form.append(submit);
 form.addEventListener('submit',event=>{
  event.preventDefault();const slots=times.input.value.split(',').map(t=>t.trim());if(slots.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))){toast('Nhập giờ dạng HH:mm, cách nhau bằng dấu phẩy.');return;}
  const weekdays=[...days.querySelectorAll('input:checked')].map(i=>Number(i.value));if(type.value==='weekdays'&&!weekdays.length){toast('Chọn ít nhất một thứ.');return;}if(end.input.value&&end.input.value<from.input.value){toast('Ngày kết thúc phải sau ngày bắt đầu.');return;}
  const value={title:name.input.value.trim(),kind:type.value,times:[...new Set(slots)].join(', '),weekdays,start:from.input.value,end:type.value==='once'?'':end.input.value,enabled:reminder?.enabled??true};
  if(!value.title)return;if(state.live){performLive('reminders',{rule:{...(reminder?{id:reminder.id}:{}),title:value.title,kind:value.kind,times:[...new Set(slots)],weekdays,startDate:value.start,endDate:value.end||null,enabled:value.enabled,version:reminder?.version??0}});return;}if(reminder)Object.assign(reminder,value);else state.reminders.push({id:state.nextReminder++,...value});sheet.close();render();toast('Đã cập nhật lịch mẫu, chưa tạo thông báo thật.');
 });
 sheetContent.append(form);
 if(reminder){const actions=el('div',undefined,'actions');actions.style.marginTop='18px';actions.append(button('Dời lần kế tiếp',()=>{openSheet('Dời riêng lần kế tiếp');const f=el('form'),date=field('Ngày','date',new Date((state.serverNow??Date.now())+7*3600000).toISOString().slice(0,10)),time=field('Giờ Việt Nam','time','19:00');f.append(date.wrap,time.wrap,el('p','Những lần sau vẫn giữ quy tắc cũ.','hint'));const save=el('button','Lưu lần này','primary');save.type='submit';f.append(save);f.addEventListener('submit',e=>{e.preventDefault();const due=Date.parse(date.input.value+'T'+time.input.value+':00+07:00');if(due<=Date.now()){toast('Chọn giờ tương lai nhé.');return;}if(state.live)performLive('reminder-instance',{ruleId:reminder.id,operation:'move',due});else{toast('Demo: chỉ dời một lần, chưa lưu server.');sheet.close();}});sheetContent.append(f);},'secondary'),button('Bỏ lần kế tiếp',()=>{if(state.live){performLive('reminder-instance',{ruleId:reminder.id,operation:'skip'});return;}reminder.skipped=true;sheet.close();render();toast('Demo: bỏ một lần, không tắt lịch lặp.');},'secondary'),button(reminder.enabled?'Tắt cả lịch':'Bật cả lịch',()=>{if(state.live){performLive('reminders',{rule:{id:reminder.id,title:reminder.title,kind:reminder.kind,times:reminder.times.split(',').map(t=>t.trim()),weekdays:reminder.weekdays,startDate:reminder.start,endDate:reminder.end||null,enabled:!reminder.enabled,version:reminder.version}});return;}reminder.enabled=!reminder.enabled;sheet.close();render();},'secondary'));sheetContent.append(actions);}
}
function openSettings(){
 openSheet('Nhịp sinh hoạt');const form=el('form'),start=field('Bắt đầu ngày','time',state.start),sleep=field('Giờ nghỉ mục tiêu','time',state.sleep);form.append(start.wrap,sleep.wrap,el('p','Giờ nghỉ là mục tiêu. /ngu mới xác nhận cậu bắt đầu nghỉ; chat và chỉnh dữ liệu vẫn hoạt động.','hint'));
 const save=el('button',state.live?'Lưu giờ sinh hoạt':'Lưu trong bản mẫu','primary');save.type='submit';form.append(save);form.addEventListener('submit',e=>{e.preventDefault();if(start.input.value===sleep.input.value){toast('Giờ bắt đầu và giờ nghỉ cần khác nhau.');return;}if(state.live){performLive('settings',{start:start.input.value,sleep:sleep.input.value,version:state.settingsVersion});return;}state.start=start.input.value;state.sleep=sleep.input.value;sheet.close();render();toast('Demo: chưa đổi giờ sinh hoạt trên bot.');});sheetContent.append(form);
}
function openAvailability(){
 if(state.live){
  openSheet('Thời gian hôm nay');
  if(!state.day){sheetContent.append(el('p','Chọn giờ sinh hoạt trước nhé.','hint'),button('Cài đặt',openSettings,'primary'));return;}
  const form=el('form'),from=field('Có thể bắt đầu lúc','time',state.start),to=field('Có thể làm đến','time',state.sleep);
  form.append(from.wrap,to.wrap,el('p','Xếp lại các buổi chưa bắt đầu trong hôm nay, giữ nguyên deadline. Ước lượng dưới đây do cậu xác nhận.','hint'));
  const estimates=[];
  for(const task of state.tasks.filter(t=>!t.done)){const f=field('#'+task.code+' · '+task.title+' (phút còn lại)','number','25');f.input.min='5';f.input.max='600';form.append(f.wrap);estimates.push({task,f});}
  const submit=el('button','Xếp lại hôm nay','primary');submit.type='submit';form.append(submit);
  form.addEventListener('submit',e=>{
   e.preventDefault();
   const date=new Date(state.serverNow+7*3600000).toISOString().slice(0,10);
   const start=Date.parse(date+'T'+from.input.value+':00+07:00'),end=Date.parse(date+'T'+to.input.value+':00+07:00');
   if(end<=start){toast('Khoảng kết thúc cần sau lúc bắt đầu.');return;}
   performLive('schedule',{version:state.day.version??1,free:[{start,end}],busy:[],estimates:estimates.map(({task,f})=>({id:task.id,minutes:Number(f.input.value)}))});
  });sheetContent.append(form);return;
 }
 openSheet('Thời gian hôm nay');sheetContent.append(el('p','04:30–22:30 là khung mẫu, không có nghĩa cậu phải làm việc cả ngày.','hint'),el('h3','Điều chỉnh bằng trò chuyện'),el('p','/lich hôm nay 14–17h tớ có việc, xếp lại giúp tớ.','card'),el('p','Bản này chỉ minh họa. Editor giờ rảnh và planner sẽ được nối backend ở bước sau.','hint'));}
function openShare(){openSheet(state.live?'Thẻ thành tích':'Thẻ thành tích mẫu');const c=el('div',undefined,'rank-card');c.append(el('div','✧','rank-seal'),el('p','TU LUYỆN KỶ LUẬT','eyebrow'),el('h2',realms[state.cultivation.rank].name),el('p','Tổng tích lũy: '+state.cultivation.totalEarned+' tu vi'),el('p',state.live?'MINH ANH · TRỢ LÝ CỦA CẬU':'MINH ANH · DEMO','eyebrow'));sheetContent.append(c,el('p','Không chứa tên task hoặc lịch cá nhân. Chỉ chia sẻ khi cậu chủ động chọn.','hint'),button('Lưu thẻ PNG',()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#242034';ctx.fillRect(0,0,800,1000);ctx.textAlign='center';ctx.fillStyle='#e6c382';ctx.font='28px sans-serif';ctx.fillText('TU LUYỆN KỶ LUẬT',400,220);ctx.font='64px serif';ctx.fillText(realms[state.cultivation.rank].name,400,440);ctx.fillStyle='#f4f0ff';ctx.font='30px sans-serif';ctx.fillText('Tổng tích lũy: '+state.cultivation.totalEarned+' tu vi',400,550);ctx.font='22px sans-serif';ctx.fillText(state.live?'MINH ANH · TRỢ LÝ CỦA CẬU':'MINH ANH · DEMO',400,830);canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='minh-anh-thanh-tich.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},'image/png');},'primary'));}
function demoDay(){if(state.live&&state.day)return state.day.day;return Math.floor((Date.now()+7*3600000-4.5*3600000)/86400000);}

function openDraw(){
 if(state.live){openSheet('Quay thưởng');sheetContent.append(el('p','1 vé mỗi lượt. Kết quả được lưu ở server, không quay lại khi retry.','hint'),button('Dùng 1 vé',async()=>{const r=await performLive('cultivation',{operation:'draw'});if(r)toast('Nhận: '+(r.reward??'phần thưởng'));},'primary'));return;}
 openSheet('Linh bảo · Quay thưởng');
 sheetContent.append(el('p','1 vé / lần · Không mua bằng tiền · Kết quả demo','hint'));
 const result=el('div','Cậu có '+state.cultivation.tickets+' vé','loot-result');result.setAttribute('role','status');
 const draw=button('Dùng 1 vé quay',()=>{
  const reward=demoDraw(state.cultivation);
  if(!reward)return;
  result.textContent='✦ '+reward.label+' · Còn '+state.cultivation.tickets+' vé';
  draw.disabled=state.cultivation.tickets===0;render();
 },'primary');draw.disabled=state.cultivation.tickets===0;sheetContent.append(result,draw);
 const odds=el('details',undefined,'realm-path');odds.append(el('summary','Xác suất công khai'));
 for(const item of loot)odds.append(el('p',item.label+' — '+item.weight+'%','hint'));sheetContent.append(odds);
}
function openInventory(){
 openSheet('Túi vật phẩm');
 const c=state.cultivation;
 for(const [key,name,description] of [
  ['heart','Hộ Tâm Phù','Giữ chuỗi cho một ngày lỡ, không cộng ngày đúng giờ. Không chặn trừ tu vi.'],
  ['peace','An Tâm Phù','Chặn một lần −20 tu vi trong ngày đã dùng; không giữ chuỗi.']
 ]){
  const item=el('section',undefined,'item-row');item.append(el('h3',name+' · '+c.inventory[key]),el('p',description,'hint'));
  const use=button(c.active[key]?(state.live?'Đã kích hoạt hôm nay':'Đã kích hoạt trong demo'):'Dùng hôm nay',()=>confirm('Dùng '+name+'?',description+' Chỉ áp dụng ngày sinh hoạt này trong demo.',()=>{
   if(c.active[key]||c.inventory[key]<1)return;if(state.live){performLive('cultivation',{operation:'protect',item:key});return;}c.inventory[key]--;c.active[key]=true;c.log.unshift('Dùng '+name+' (demo)');openInventory();render();
  }),'secondary');use.disabled=c.active[key]||c.inventory[key]<1;item.append(use);sheetContent.append(item);
 }
 for(const t of talismans){
  const item=el('section',undefined,'item-row');item.append(el('h3','Phá Cảnh Phù · '+t.name+' ×'+c.inventory[t.key]),el('p','+'+t.boost+' điểm % cho một lần đột phá.','hint'));
  if(t.next){const fuse=button('Ghép 3 lá · '+t.chance+'%',()=>confirm('Ghép lên '+talismans.find(n=>n.key===t.next).name+'?',
   'Thành công: tiêu hao 3 lá. Thất bại: mất 1, trả lại 2. Tỷ lệ '+t.chance+'%.',()=>{
    if(state.live){performLive('cultivation',{operation:'fuse',item:t.key});return;}const success=demoFuse(c,t.key);if(success===null)return;toast(success?'Ghép thành công ✦':'Chưa thành, đã trả lại 2 lá.');openInventory();render();
   }),'secondary');fuse.disabled=c.inventory[t.key]<3;item.append(fuse);}
  sheetContent.append(item);
 }
 sheetContent.append(el('h3','Tín vật Minh Anh · '+c.inventory.keepsake),el('p','Vật phẩm sưu tầm demo, không phải tu vi. Nội dung bộ sưu tập sẽ thiết kế riêng.','hint'));
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
 const explain=()=>{info.textContent='Thành công '+chance()+'% · Thất bại giữ tu vi/chuỗi, phù đã chọn vẫn tiêu hao. Mỗi ngày chỉ thử 1 lần.';};select.addEventListener('change',explain);explain();
 const attempt=button('Thử đột phá',()=>{
  if(state.live){performLive('cultivation',{operation:'breakthrough',item:select.value||null});return;}
  const r=demoBreakthrough(c,demoDay(),select.value||null);
  if(!r)return;attempt.disabled=true;select.disabled=true;result.hidden=false;
  result.textContent=r.success?'Đột phá thành công ✦ '+realms[c.rank].name+' · Được bảo vệ hạ bậc 72 giờ.':'Chưa thành công. Tu vi và chuỗi vẫn giữ, mai thử tiếp nhé.';
  render();
 },'primary');attempt.disabled=c.attemptDay===demoDay()||c.qi<target.qi||c.streak<target.days;
 sheetContent.append(info,attempt,result);
}
const ui={sessionAction:(session,action)=>performLive('session',{sessionId:session.id,version:session.version,action}),startWork:task=>{if(!state.live){toast('Demo: chưa tạo buổi làm trên bot.');return;}const session=(state.sessions??[]).find(s=>s.task_id===task.id&&['planned','paused','unknown'].includes(s.status));if(!session){openAvailability();return;}performLive('session',{sessionId:session.id,version:session.version,action:'start'});},state:()=>state,cultivation:()=>state.cultivation,demoDay,openDraw,openInventory,openBreakthrough,el,button,heading,card,toast,empty,render,openTask,toggleTask,confirmDelete,openReminder,openAvailability,openShare};
function render(){
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
document.querySelector('#settings').addEventListener('click',openSettings);
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{if(state.live&&!state.loaded){toast('Mở lại từ Telegram để tải dữ liệu thật.');return;}state.tab=b.dataset.tab;state.screenState='ready';render();window.scrollTo(0,0);});
sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientY<r.top)sheet.close();}});
sheet.addEventListener('close',render);
if(state.live){
 document.querySelector('.demo-strip').textContent='MINH ANH · Dữ liệu của cậu';
 state.tasks=[];state.reminders=[];state.screenState='loading';render();
 connectLive().then(data=>{Object.assign(state,data);state.screenState='ready';render();if(state.needsSetup)openSettings();}).catch(error=>{state.screenState='error';render();toast(error.message);});
}else render();
