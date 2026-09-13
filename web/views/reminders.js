export function renderReminders(ui,state){
 const {el,button,heading}=ui,root=el('section');
 root.append(heading('Nhớ việc, nhẹ đầu.','Chỉ những lời nhắc cậu chủ động đặt.'));
 const toggle=el('div',undefined,'segment');
 for(const [value,label] of [['recurring','Định kỳ'],['once','Một lần']]){const b=button(label,()=>{state.reminderFilter=value;ui.render();});b.setAttribute('aria-pressed',String(value===state.reminderFilter));toggle.append(b);}root.append(toggle);
 const rows=state.reminders.filter(r=>(r.kind==='once')===(state.reminderFilter==='once'));
 for(const r of rows){
  const row=button('',()=>ui.openReminder(r),'reminder-row'+(r.enabled?'':' off'));
  const main=el('div',undefined,'reminder-main');
  const repeat=r.kind==='daily'?'Hằng ngày':r.kind==='once'?r.start.split('-').reverse().join('/'):'Thứ '+r.weekdays.map(n=>n===7?'CN':n+1).join(', ');
  main.append(el('strong',r.title),el('small',r.times.replaceAll(',',' ·')+' · '+repeat),el('small',r.enabled?(r.skipped?'Đã bỏ lần kế tiếp · Chuỗi vẫn bật':'Đang bật · '+(r.end?'Đến '+r.end:'Không giới hạn ngày')):'Đã tắt · Không tạo lần nhắc mới'));
  row.append(el('span',r.kind==='once'?'◷':'↻','reminder-icon'),main,el('span','›','chevron'));root.append(row);
 }
 if(!rows.length)root.append(ui.empty('Chưa có lời nhắc','Tạo một lần hoặc lịch lặp. Lịch lặp không cần cài lại mỗi ngày.',()=>ui.openReminder(null),'+ Thêm lời nhắc'));
 else root.append(button('+ Thêm lời nhắc',()=>ui.openReminder(null),'primary'));
 root.append(el('p','Lời nhắc bắt đầu task nằm trong “Hôm nay”. Nhắc ngủ theo giờ nghỉ ở Cài đặt.','footer-note'));
 return root;
}
