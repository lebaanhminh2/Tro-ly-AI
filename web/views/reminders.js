export function renderReminders(ui,state){
 const {el,button,heading}=ui,root=el('section');
 root.append(heading('Nhớ việc, nhẹ đầu.','Chỉ những lời nhắc cậu chủ động đặt.'));
 root.append(button('+ Tạo lời nhắc',()=>ui.openReminder(null),'primary top-create'));
 if(['asleep','paused','inactive'].includes(state.rest?.reason))root.append(el('p','Đang ngừng gửi nhắc chủ động. Cậu vẫn sửa được các lịch bên dưới; “đang bật” không có nghĩa sẽ gửi trong lúc nghỉ.','footer-note'));
 const toggle=el('div',undefined,'segment');
 for(const [value,label] of [['recurring','Định kỳ'],['once','Một lần']]){const b=button(label,()=>{state.reminderFilter=value;ui.render();});b.setAttribute('aria-pressed',String(value===state.reminderFilter));toggle.append(b);}root.append(toggle);
 const rows=state.reminders.filter(r=>(r.kind==='once')===(state.reminderFilter==='once'));
 for(const r of rows){
  const row=button('',()=>ui.openReminder(r),'reminder-row'+(r.enabled?'':' off'));
  const main=el('div',undefined,'reminder-main');
  const repeat=r.kind==='daily'?'Hằng ngày':r.kind==='once'?r.start.split('-').reverse().join('/'):'Thứ '+r.weekdays.map(n=>n===7?'CN':n+1).join(', ');
  main.append(el('strong',r.title),el('small',r.times.replaceAll(',',' ·')+' · '+repeat),el('small',r.delivered?'Đã nhắc · sẽ tự ẩn khi sang ngày mới':r.past?'Đã qua giờ · sẽ tự ẩn khi sang ngày mới':r.enabled?(r.skipped?'Đã bỏ lần kế tiếp · Chuỗi vẫn bật':'Đang bật · '+(r.end?'Đến '+r.end:'Không giới hạn ngày')):'Đã tắt · Không tạo lần nhắc mới'));
  row.append(el('span',r.kind==='once'?'◷':'↻','reminder-icon'),main,el('span','›','chevron'));root.append(row);
 }
 if(!rows.length)root.append(el('p','Chưa có lời nhắc trong nhóm này.','hint'));
 root.append(el('p','Lời nhắc bắt đầu task nằm trong “Hôm nay”. Nhắc ngủ theo giờ nghỉ ở Cài đặt.','footer-note'));
 return root;
}
