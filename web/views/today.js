import {renderTimeline} from './timeline.js';
export function renderToday(ui,state){
 const {el,button,heading,card,openTask,render}=ui;
 const root=el('section');
 root.append(heading('Một ngày, từng bước.',state.live?new Date(state.serverNow).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'long',day:'numeric',month:'long'}):'Chủ nhật, 13 tháng 9 · Dữ liệu mẫu'));
 if(state.resting){
  const reason=state.rest?.reason;
  const until=state.rest?.until?new Date(state.rest.until).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):null;
  const title=({bedtime:'Đến giờ ngủ rồi, cậu 🌙',asleep:'Cậu đã báo ngủ 🌙',paused:'Đang tạm dừng lời nhắc',inactive:'Tạm ngưng vì lâu chưa trò chuyện'}[reason]??'Nghỉ ngơi thôi, cậu 🌙');
  const detail=reason==='bedtime'?'Không giao thêm việc. Tớ vẫn nhắc đi ngủ và gửi lời nhắc riêng đã hẹn; /ngu để ngừng nhắn chủ động.':reason==='inactive'?'Nhắn cho Minh Anh để hoạt động lại.':'Ngừng nhắn chủ động'+(until?' đến '+until:'')+'.';
  const rest=card();rest.append(el('h2',title),el('p',detail+(reason==='inactive'?' Cậu vẫn có thể chỉnh công việc.':' Cậu vẫn chỉnh lịch, công việc và nhận thưởng bình thường.'),'subtitle'),...(state.live?[]:[button('Hoạt động lại',()=>{state.resting=false;render();},'secondary')]));root.append(rest);
 }
 const next=state.tasks.find(t=>!t.done);
 if(next&&!state.resting&&state.mode==='tasks'){
  const hero=el('article',undefined,'hero');
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
  root.append(renderTimeline(ui,state));
  root.append(button('Điều chỉnh lịch →',()=>ui.openAvailability(),'text-button'));
  const unplanned=card();unplanned.append(el('h3','Còn 2 việc chưa xếp'),el('p','Chưa biết thời lượng. Cậu có thể trao đổi qua /lich để xếp phần còn lại.','subtitle'));if(!state.live)root.append(unplanned);else {let missing=[];try{missing=JSON.parse(state.day?.intervals_json??'{}').unplanned??[];}catch{}if(missing.length){const c=card();c.append(el('h3',missing.length+' việc chưa xếp đủ'));for(const m of missing)c.append(el('p',(state.tasks.find(t=>t.id===m.taskId)?.title??'Công việc')+' · '+(m.reason==='needs_estimate'?'Chưa có ước lượng':'Còn '+m.minutes+' phút chưa xếp'),'hint'));root.append(c);}}
 }else{
  const tools=el('div',undefined,'section-heading');tools.append(el('h2',state.tasks.length+' công việc'),button(state.selecting?'Thoát chọn':'Chọn nhiều',()=>{state.selecting=!state.selecting;state.selected.clear();render();},'text-button'));root.append(tools);
  const list=card();
  for(const task of state.tasks){
   const row=el('div',undefined,'task-row'+(task.done?' done':'')),check=el('input');check.type='checkbox';check.className='check';check.checked=state.selecting?state.selected.has(task.code):task.done;check.setAttribute('aria-label',(state.selecting?'Chọn ':'Hoàn thành ')+task.title);
   check.addEventListener('change',()=>{if(state.selecting){check.checked?state.selected.add(task.code):state.selected.delete(task.code);render();}else ui.toggleTask(task);});
   const name=button('',()=>openTask(task),'task-open');name.append(el('span','#'+task.code,'code'),el('strong',task.title),el('small',task.deadline?'Hạn '+(task.deadline.length===10?task.deadline.split('-').reverse().join('/'):new Date(task.deadline).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'})):'Chưa có hạn'));
   row.append(check,name);list.append(row);
  }
  root.append(list);
  if(state.selecting){const remove=button('Xóa '+state.selected.size+' việc đã chọn',()=>ui.confirmDelete(),'danger');remove.disabled=!state.selected.size;root.append(remove);}
  else root.append(button('+ Thêm công việc',()=>openTask(null),'text-button'));
 }
 root.append(el('p','Mã #24 không đổi khi sắp xếp. Lịch và danh sách dùng cùng một công việc.','footer-note'));
 return root;
}
