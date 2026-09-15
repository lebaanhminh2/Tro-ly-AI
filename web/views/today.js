import {taskBuckets} from '../api.js';
export function renderToday(ui,state){
 const {el,button,heading,card,openTask,render}=ui;
 const buckets=taskBuckets(state.tasks,state.operatingDay,state.start);
 const root=el('section');
 root.append(heading('Một ngày, từng bước.',state.live?new Date(state.serverNow).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'long',day:'numeric',month:'long'}):'Chủ nhật, 13 tháng 9 · Dữ liệu mẫu'));
 const quickActions=el('div',undefined,'today-quick-actions');quickActions.append(button('+ Tạo task',()=>openTask(null),'primary'));root.append(quickActions);
 if(state.resting){
  const reason=state.rest?.reason;
  const until=state.rest?.until?new Date(state.rest.until).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):null;
  const title=({bedtime:'Đến giờ ngủ rồi, cậu 🌙',asleep:'Cậu đã báo ngủ 🌙',paused:'Đang tạm dừng lời nhắc',inactive:'Tạm ngưng vì lâu chưa trò chuyện'}[reason]??'Nghỉ ngơi thôi, cậu 🌙');
  const detail=reason==='bedtime'?'Không giao thêm việc. Tớ vẫn nhắc đi ngủ và gửi lời nhắc riêng đã hẹn; /ngu để ngừng nhắn chủ động.':reason==='inactive'?'Nhắn cho Minh Anh để hoạt động lại.':'Ngừng nhắn chủ động'+(until?' đến '+until:'')+'.';
  const rest=card();rest.append(el('h2',title),el('p',detail+(reason==='inactive'?' Cậu vẫn có thể chỉnh công việc.':' Cậu vẫn chỉnh lịch, công việc và nhận thưởng bình thường.'),'subtitle'),...(state.live?[]:[button('Hoạt động lại',()=>{state.resting=false;render();},'secondary')]));root.append(rest);
 }
 const planned=state.dailyPlan?.plan?.items??[];
 const next=state.dailyPlan?.plan?planned.map(item=>state.tasks.find(task=>task.id===item.taskId&&!task.done)).find(Boolean):buckets.active[0];
 if(next&&!state.resting){
  const hero=el('article',undefined,'hero focus-hero');
  hero.append(el('p','LÀM TIẾP · #'+next.code,'eyebrow'),el('h2',next.title),el('p',(next.steps.find(s=>!s.done)?.title??'Bắt đầu từ phần nhỏ nhất')+(state.live?'':' · dự kiến 25 phút')));
  const actions=el('div',undefined,'actions');
  actions.append(button('Xem công việc',()=>openTask(next),'secondary'));
  hero.append(actions);root.append(hero);
 }
 const capacity=el('div',undefined,'capacity');capacity.append(el('div','Kế hoạch mẫu · 2 giờ 30 phút / 3 giờ rảnh','capacity-row'));
 const track=el('div',undefined,'track'),fill=el('span');fill.style.width='83%';track.append(fill);capacity.append(track);if(!state.live)root.append(capacity);
 const toggle=el('div',undefined,'segment');
 for(const [value,label] of [['timeline','Lịch hôm nay'],['tasks','Danh sách việc']]){
  const b=button(label,()=>{state.mode=value;render();});b.setAttribute('aria-pressed',String(state.mode===value));toggle.append(b);
 }root.append(toggle);
 if(state.mode==='timeline'){
  root.append(renderDailyPlan(ui,state));
 }else{
  const tools=el('div',undefined,'section-heading'),actions=el('div',undefined,'heading-actions');const selectButton=button(state.selecting?'Thoát chọn':'Chọn nhiều',()=>{state.selecting=!state.selecting;state.selected.clear();render();},'text-button selection-toggle');selectButton.setAttribute('aria-pressed',String(state.selecting));actions.append(selectButton);tools.append(el('h2',buckets.active.length+' việc đang làm'),actions);root.append(tools);
  const taskList=(tasks,className='',groupHistory=false)=>{const list=card(className);let month='';
  for(const task of tasks){
   if(groupHistory){const key=task.completedAt?new Date(task.completedAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',month:'long',year:'numeric'}):'Ngày chưa rõ';if(key!==month){month=key;list.append(el('p',key,'history-month'));}}
   const row=el('div',undefined,'task-row'+(task.done?' done':'')),check=el('input');check.type='checkbox';check.className='check';check.checked=state.selecting?state.selected.has(task.code):task.done;check.setAttribute('aria-label',(state.selecting?'Chọn ':'Hoàn thành ')+task.title);
   check.addEventListener('change',()=>{if(state.selecting){check.checked?state.selected.add(task.code):state.selected.delete(task.code);render();}else ui.toggleTask(task);});
   const name=button('',()=>openTask(task),'task-open');name.append(el('span','#'+task.code,'code'),el('strong',task.title),el('small',task.deadline?'Hạn '+(task.deadline.length===10?task.deadline.split('-').reverse().join('/'):new Date(task.deadline).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'})):'Chưa có hạn'));
   row.append(check,name);list.append(row);
  }
  return list;};
  if(buckets.active.length)root.append(taskList(buckets.active));else root.append(el('p','Không còn việc đang làm. Ui giỏi ghê :>','hint'));
  if(buckets.completedToday.length){const done=el('details',undefined,'daily-later');done.open=true;done.append(el('summary',buckets.completedToday.length+' việc xong hôm nay'),taskList(buckets.completedToday,'completed-list'));root.append(done);}
  if(buckets.history.length){
   const history=el('details',undefined,'daily-later history-section');
   const ordered=[...buckets.history].sort((a,b)=>(b.completedAt??0)-(a.completedAt??0));
   const visible=ordered.slice(0,20),footer=el('div',undefined,'history-footer');
   footer.append(el('p','Lịch sử được giữ lại để xem, không đưa lại vào lịch hôm nay.','footer-note'));
   if(state.historyHasMore)footer.append(button(state.historyLoading?'Đang tải…':'Xem thêm lịch sử',()=>ui.loadHistory?.(),'secondary'));
   history.append(el('summary','Lịch sử · '+(state.historyTotal??ordered.length)+' việc đã hoàn thành'),taskList(visible,'history-list',true),footer);root.append(history);
  }
  if(state.selecting){const remove=button('Xóa '+state.selected.size+' việc đã chọn',()=>ui.confirmDelete(),'danger');remove.disabled=!state.selected.size;root.append(remove);}
 }
 root.append(el('p','Mã #24 không đổi khi sắp xếp. Lịch và danh sách dùng cùng một công việc.','footer-note'));
 return root;
}

function renderDailyPlan(ui,state){
 const {el,button,openTask}=ui,root=el('section',undefined,'daily-plan');
 const plan=state.dailyPlan?.plan;
 if(!plan){root.append(el('p','Chưa có kế hoạch hôm nay. Tớ sẽ xếp khi có lịch sinh hoạt và công việc nhé.','hint'));return root;}
 const completed=plan.items.filter(item=>state.tasks.find(task=>task.id===item.taskId)?.done).length,actualTotal=plan.items.reduce((sum,item)=>sum+Number(item.actualMinutes??0),0);
 const summary=el('div',undefined,'section-heading'),actions=el('div',undefined,'heading-actions');actions.append(button('Chỉnh việc hôm nay',()=>ui.openTodayPlan(),'primary'),button('Giờ bận/rảnh',()=>ui.openAvailability(),'text-button'));summary.append(el('p',`${plan.items.length} việc hôm nay · ${completed} đã xong${actualTotal?' · '+actualTotal+' phút đã làm':''} · ${plan.planned} phút kế hoạch / ${plan.capacity} phút sức chứa.`,'plan-summary'),actions);root.append(summary);
 const notices=[];
 if(plan.overflow>0)notices.push('Cậu đã chủ động thêm vượt sức chứa '+plan.overflow+' phút.');
 if(plan.unscheduled>0)notices.push(plan.unscheduled+' phút chưa có khung giờ thật nên Minh Anh chưa thể đặt mốc nhắc cho phần đó.');
 if(plan.risks?.length)notices.push('Có việc cần chú ý deadline. Tớ đã giữ phần chưa xếp để không nhồi quá tải.');
 if(notices.length){const notice=el('aside',undefined,'plan-notice');notice.setAttribute('aria-label','Lưu ý cho hôm nay');notice.append(el('strong','Lưu ý cho hôm nay'));for(const text of notices)notice.append(el('p',text));root.append(notice);}
 const list=el('div',undefined,'daily-list');
 for(const item of plan.items){const task=state.tasks.find(t=>t.id===item.taskId);if(!task)continue;const row=el('article',undefined,'daily-item'+(task.done?' done':'')),check=el('input');check.type='checkbox';check.className='check';check.checked=task.done;check.setAttribute('aria-label',(task.done?'Mở lại ':'Hoàn thành ')+task.title);check.addEventListener('change',()=>{check.checked=task.done;ui.toggleTask(task);});const info=el('button','', 'daily-item-open');const scheduled=item.scheduledMinutes??item.minutes,actual=Number(item.actualMinutes??task.actualMinutes??0),remaining=task.remainingMinutes??item.remaining;const details=[`${item.minutes} phút hôm nay`];if(actual)details.push(`đã làm ${actual} phút`);if(remaining!==null&&remaining!==undefined)details.push(`còn ${Math.max(0,Number(remaining))} phút`);if(scheduled<item.minutes)details.push(`${item.minutes-scheduled} phút chưa có giờ nhắc`);if(task.deadline)details.push(`hạn ${task.deadline.slice(0,10)}`);info.append(el('strong',(task.done?'✓ ':'')+'#'+task.code+' '+task.title),el('small',details.join(' · ')));info.addEventListener('click',()=>openTask(task));row.append(check,info);list.append(row);}
 if(!list.children.length)list.append(el('p','Hôm nay chưa có việc cần làm. Các task còn lại nằm trong danh sách việc.','hint'));
 root.append(list);
 const later=taskBuckets(state.tasks,state.operatingDay,state.start).active.filter(t=>!plan.items.some(i=>i.taskId===t.id));if(later.length){const details=el('details',undefined,'daily-later');details.append(el('summary',`${later.length} việc chưa chọn cho hôm nay`),el('p','Đây là việc còn trong danh sách, không phải lịch bị xếp thiếu.','hint'));for(const t of later){const row=el('div',undefined,'later-task'),info=button('',()=>openTask(t),'later-task-open');info.append(el('span','#'+t.code,'code'),el('strong',t.title));row.append(info,button('+ Hôm nay',()=>ui.openTodayPlan(t.id),'secondary'));details.append(row);}root.append(details);}
 return root;
}
