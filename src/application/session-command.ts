import type { Input,Plan } from '../domain/work.ts';
import type { WorkReader } from '../ports/work-store.ts';
import { canAct, dayStart, sessionButtons } from '../domain/session.ts';
import type { Session,Preferences } from '../domain/session.ts';
import { deadlineValue } from '../domain/time.ts';

export async function sessionCommand(i:Input,store:WorkReader,now:number):Promise<Plan|null>{
  const view=(text:string,buttons:Plan['view']['buttons']=[]):Plan=>({view:{text,buttons},changes:[]});
  const cb=i.callback??'',text=cb==='rest'?'/rest':i.text??'';
  if(text==='/today'){
    const sessions=await store.sessions(i.owner,dayStart(now),dayStart(now)+86400000);
    const current=sessions.find(s=>s.status==='running')??sessions.find(s=>['planned','paused','unknown'].includes(s.status));
    const labels={draft:'Chưa chốt',planned:'Đã lên lịch',running:'Đang làm',paused:'Tạm dừng',completed:'Đã kết thúc buổi',skipped:'Đã bỏ buổi',unknown:'Chưa rõ kết quả'};
    const lines=await Promise.all(sessions.map(async s=>`${new Date(s.start_at+7*3600000).toISOString().slice(11,16)} · ${(await store.task(i.owner,s.task_id))?.title??'Công việc'} · ${s.minutes} phút · ${labels[s.status]}`));
    const result=view(sessions.length?lines.join('\n'):'Hôm nay chưa có buổi nào. Mở /tasks và chọn “Lên buổi”.',current?sessionButtons(current):[]);
    return result;
  }
  if(text==='/settings')return view('Giờ yên lặng: /quiet 22:00 07:00 (giờ Việt Nam). /rest để dừng nhắc hôm nay; /resume để mở lại. Mỗi lần hẹn tối đa 2 lượt nhắc; không có trần theo ngày.');
  if(text.startsWith('/quiet ')||text==='/rest'||text==='/resume'){
    const p:Preferences=await store.preferences(i.owner)??{owner:i.owner,quiet_start:1320,quiet_end:420,pause_until:0};
    if(text.startsWith('/quiet ')){
      const m=/^\/quiet ([01]\d|2[0-3]):([0-5]\d) ([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
      if(!m)return view('Dùng /quiet HH:mm HH:mm, ví dụ /quiet 22:00 07:00.');
      p.quiet_start=Number(m[1])*60+Number(m[2]);p.quiet_end=Number(m[3])*60+Number(m[4]);
    }else p.pause_until=text==='/rest'?dayStart(now)+86400000:0;
    return {...view(text==='/rest'?'Đã dừng nhắc tới hết hôm nay.':'Đã lưu cài đặt nhắc.'),changes:[{type:'preferences',preferences:p}]};
  }
  if(cb.startsWith('schedule:')){
    const task=await store.task(i.owner,cb.slice(9));if(!task)return view('Không tìm thấy việc.');
    return {...view(`Lên buổi “${task.title}”: nhập DD/MM/YYYY HH:mm | số phút (5–180). /cancel để hủy. Giờ yên lặng mặc định 22:00–07:00, đổi ở /settings.`),changes:[{type:'session-input',taskId:task.id,expires:now+900000}]};
  }
  if(cb.startsWith('s:')){
    const [,action,id,version]=cb.split(':');
    const s=await store.session(i.owner,id??'');
    if(!s||s.version!==Number(version)||!canAct(s,action??'',now))return view('Nút cũ hoặc thao tác không phù hợp. Mở /today để xem bản mới.');
    const allowed=['confirm','start','pause','finish','skip','snooze'] as const;
    const selected=allowed.find(a=>a===action)!;
    return {...view(selected==='finish'?'Đã kết thúc buổi; không tự đánh dấu task hoàn thành. Mở /today để xem.':'Đã cập nhật buổi. Mở /today để xem nút mới.'),changes:[{type:'session-action',session:s,action:selected,now}]};
  }
  if(text.startsWith('/')||cb)return null;
  const pending=await store.sessionInput(i.owner);
  if(!pending||pending.expires<=now)return null;
  const [rawDate,rawMinutes,...extra]=text.split('|').map(x=>x.trim());
  const parsed=deadlineValue(rawDate??''),minutes=Number(rawMinutes);
  if(!parsed||!Number.isInteger(minutes)||minutes<5||minutes>180||extra.length||Date.parse(parsed)<now)
    return view('Cần giờ tương lai và số phút: DD/MM/YYYY HH:mm | 25. /cancel để hủy.');
  const task=await store.task(i.owner,pending.task_id);if(!task)return view('Việc không còn tồn tại.');
  const s:Session={id:`b${i.updateId}`,owner:i.owner,task_id:task.id,start_at:Date.parse(parsed),minutes,status:'draft',version:1,generation:1,expires:now+300000,active_since:null,spent_ms:0};
  return {...view(`Buổi “${task.title}”: ${rawDate}, ${minutes} phút. Chốt nhé?`,sessionButtons(s)),changes:[{type:'session-create',session:s}]};
}
