const SCALE=2.4/60000;
const clock=t=>new Date(t).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});
export function updateTimelineClock(state){
 const line=document.querySelector('.time-now');if(!line)return;
 const now=(state.serverNow??Date.now())+Date.now()-(state.loadedAt??Date.now());
 const start=Number(line.dataset.start),end=Number(line.dataset.end);
 line.hidden=now<start||now>=end;line.style.top=(now-start)*SCALE+'px';line.firstChild.textContent=clock(now);
 for(const block of document.querySelectorAll('.time-task')){
  const start=Number(block.dataset.start),end=Number(block.dataset.end);
  block.classList.toggle('current',now>=start&&now<end);
  const status=block.querySelector('.time-status');if(status)status.textContent=now>=end?'Chưa xác nhận xong':now>=start?'Đến giờ làm':'Dự kiến';
 }
}
export function renderTimeline(ui,state){
 const {el,button}=ui,root=el('div',undefined,'day-timeline');
 const data=state.timeline;
 if(!data){root.append(el('p',state.live?'Chưa có lịch để hiển thị. Cài giờ sinh hoạt và trao đổi /lich để xếp việc nhé.':'Mở từ Telegram để xem lịch thật.','hint'),button('Điều chỉnh thời gian',ui.openAvailability));return root;}
 const {window:range,blocks,busy,free}=data;
 const legend=el('div',undefined,'time-legend');legend.append(el('span','● Công việc'),el('span','▧ Bận / ngoài giờ rảnh'),el('span','━ Bây giờ'));root.append(legend);
 root.append(el('p','Giữ tay trên ⠿ để kéo · Chạm tên việc để đổi giờ · □ để đánh dấu xong','hint'));
 if(state.timelineUndo)root.append(button('Đã cập nhật lịch · Hoàn tác',()=>ui.undoTimeline(),'text-button'));
 const scroll=el('div',undefined,'time-scroll'),canvas=el('div',undefined,'time-canvas');scroll.tabIndex=0;scroll.setAttribute('aria-label','Lịch theo giờ, cuộn để xem');
 canvas.style.height=(range.target-range.start)*SCALE+24+'px';scroll.append(canvas);root.append(scroll);
 for(let t=range.start;t<=range.target;t+=3600000){const row=el('div',undefined,'time-hour');row.style.top=(t-range.start)*SCALE+'px';row.append(el('span',clock(t)));canvas.append(row);}
 // Shade the complement of actual availability, including user busy intervals/events.
 let cursor=range.start;const unavailable=[];
 for(const r of free){if(r.start>cursor)unavailable.push({start:cursor,end:r.start});cursor=Math.max(cursor,r.end);}if(cursor<range.target)unavailable.push({start:cursor,end:range.target});
 for(const r of unavailable){const block=el('div',undefined,'time-busy');block.style.top=(r.start-range.start)*SCALE+'px';block.style.height=(r.end-r.start)*SCALE+'px';const event=data.events.find(e=>e.start_at<r.end&&(e.end_at??e.start_at+3600000)>r.start);block.append(el('span','🔒 '+(event?.title??'Bận / ngoài giờ rảnh')),el('small',clock(r.start)+'–'+clock(r.end)));canvas.append(block);}
 for(const b of blocks){
  const task=state.tasks.find(t=>t.id===b.task_id);if(!task||task.done)continue;
  const block=el('article',undefined,'time-task');block.dataset.start=b.start_at;block.dataset.end=b.start_at+b.minutes*60000;
  block.style.top=(b.start_at-range.start)*SCALE+'px';block.style.height=Math.max(38,b.minutes*60000*SCALE-3)+'px';
  const check=el('input');check.type='checkbox';check.className='check';check.setAttribute('aria-label','Hoàn thành '+task.title);check.addEventListener('change',()=>{check.checked=false;ui.toggleTask(task);});
  const label=button('',()=>ui.editTimeline(b),'time-task-label');label.append(el('strong','#'+task.code+' '+task.title),el('small',clock(b.start_at)+'–'+clock(b.start_at+b.minutes*60000)),el('small','Dự kiến','time-status'));
  const handle=button('⠿',()=>{},'time-drag');handle.setAttribute('aria-label','Di chuyển '+task.title);handle.title='Giữ và kéo để đổi giờ';
  handle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ui.editTimeline(b);}});
  if(['running','paused'].includes(b.status)){handle.disabled=true;label.append(el('small','Buổi cũ đang mở · có thể tick xong'));}
  else attachDrag(handle,block,b,canvas,scroll,data,ui,state);
  block.append(check,label,handle);canvas.append(block);
 }
 const now=el('div',undefined,'time-now');now.dataset.start=range.start;now.dataset.end=range.target;now.append(el('span',''));canvas.append(now);
 const foot=el('p',clock(range.target)+' · Giờ ngủ mục tiêu','footer-note');root.append(foot);
 const done=state.tasks.filter(t=>t.done);if(done.length){const details=el('details',undefined,'time-completed');details.append(el('summary',done.length+' việc đã xong'));for(const t of done)details.append(button('✓ #'+t.code+' '+t.title,()=>ui.openTask(t),'text-button'));root.append(details);}
 requestAnimationFrame(()=>{if(!root.isConnected)return;updateTimelineClock(state);if(state.timelineScroll!==undefined)scroll.scrollTop=state.timelineScroll;else scroll.scrollTop=Math.max(0,(Math.min(state.serverNow??Date.now(),range.target)-range.start)*SCALE-100);});
 return root;
}
function attachDrag(handle,block,b,canvas,scroll,data,ui,state){
 let timer=null,drag=null,origin=null,raf=0;
 const hint=document.createElement('div');hint.className='time-drop-hint';hint.setAttribute('role','status');
 const reset=()=>{clearTimeout(timer);timer=null;cancelAnimationFrame(raf);state.timelineDragging=false;drag=null;origin=null;hint.remove();block.classList.remove('dragging','invalid');block.style.top=(b.start_at-data.window.start)*SCALE+'px';};
 const project=()=>{
  if(!drag)return;
  const box=scroll.getBoundingClientRect();if(drag.y<box.top+48)scroll.scrollTop-=8;else if(drag.y>box.bottom-48)scroll.scrollTop+=8;
  const offset=drag.y-canvas.getBoundingClientRect().top-drag.grab;
  const at=Math.round((data.window.start+offset/SCALE)/300000)*300000;
  const now=(state.serverNow??Date.now())+Date.now()-(state.loadedAt??Date.now());
  drag.at=at;drag.valid=at>=now&&data.free.some(r=>at>=r.start&&at+b.minutes*60000<=r.end);
  block.style.top=(at-data.window.start)*SCALE+'px';block.classList.toggle('invalid',!drag.valid);
  hint.textContent=clock(at)+'–'+clock(at+b.minutes*60000)+(drag.valid?' · Thả để lưu':' · Không thể đặt vào đây');
  raf=requestAnimationFrame(project);
 };
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0||state.timelineDragging)return;origin={x:e.clientX,y:e.clientY,id:e.pointerId};handle.setPointerCapture(e.pointerId);
  timer=setTimeout(()=>{state.timelineDragging=true;drag={y:e.clientY,grab:e.clientY-block.getBoundingClientRect().top,at:b.start_at,valid:false};block.classList.add('dragging');hint.style.position='fixed';hint.style.left='20px';hint.style.right='20px';hint.style.top='15px';document.body.append(hint);project();},e.pointerType==='mouse'?80:350);
 });
 handle.addEventListener('pointermove',e=>{if(drag){drag.y=e.clientY;return;}if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10){clearTimeout(timer);timer=null;}});
 handle.addEventListener('pointerup',()=>{const move=drag&&drag.valid?drag.at:null;reset();if(move!==null&&move!==b.start_at)ui.moveTimeline(b,move);});
 handle.addEventListener('pointercancel',reset);handle.addEventListener('lostpointercapture',reset);
}
