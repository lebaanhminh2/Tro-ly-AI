import type { Input,Plan } from '../domain/work.ts';
import type { WorkReader } from '../ports/work-store.ts';
import { canAct, dayStart, sessionButtons } from '../domain/session.ts';
import type { Session,Preferences } from '../domain/session.ts';
import { deadlineValue } from '../domain/time.ts';

export async function sessionCommand(i:Input,store:WorkReader,now:number):Promise<Plan|null>{
  const view=(text:string,buttons:Plan['view']['buttons']=[]):Plan=>({view:{text,buttons},changes:[]});
  const cb=i.callback??'',text=cb==='rest'?'/rest':i.text??'';
  if(text==='/today'||cb.startsWith('today-page:')){
    const offset=cb.startsWith('today-page:')?Number(cb.slice(11)):0;
    if(!Number.isSafeInteger(offset)||offset<0||offset>1000)return view('Trang không hợp lệ.');
    const all=await store.sessions(i.owner,dayStart(now),dayStart(now)+86400000),sessions=all.slice(offset,offset+3);
    const events=offset===0?await store.events?.(i.owner,dayStart(now),dayStart(now)+86400000)??[]:[];
    const labels={draft:'Chưa chốt',planned:'Đã lên lịch',running:'Đang làm',paused:'Tạm dừng',completed:'Đã kết thúc buổi',skipped:'Đã bỏ buổi',unknown:'Chưa rõ kết quả'};
    const lines=await Promise.all(sessions.map(async s=>`${new Date(s.start_at+7*3600000).toISOString().slice(11,16)} · ${(await store.task(i.owner,s.task_id))?.title??'Công việc'} · ${s.minutes} phút · ${labels[s.status]}`));
    const result=view((sessions.length||events.length)?[...events.slice(0,3).map(e=>`${new Date(e.start_at+7*3600000).toISOString().slice(11,16)} · ${e.title}`),...lines].slice(0,3).join('\n'):'Hôm nay chưa có buổi nào. Cậu nói giờ rảnh để tớ giúp xếp việc nhé.',sessions.map((s,index)=>[{text:`${index+1}. ${new Date(s.start_at+7*3600000).toISOString().slice(11,16)} · Xem buổi`,callback_data:`session:${s.id}`} ]));
    if(offset>0)result.view.buttons.push([{text:'Trang trước',callback_data:`today-page:${Math.max(0,offset-3)}`}]);
    if(all.length>offset+3)result.view.buttons.push([{text:'Trang tiếp',callback_data:`today-page:${offset+8}`}]);
    if(!sessions.length)result.view.buttons.push([{text:'Công việc',callback_data:'nav:tasks'}]);
    result.changes.push({type:'cancel',owner:i.owner});
    return result;
  }
  if(cb.startsWith('session:')){
    const s=await store.session(i.owner,cb.slice(8));
    if(!s)return view('Buổi này không còn. Mở /today để xem lại.');
    const task=await store.task(i.owner,s.task_id);
    const labels={draft:'Chưa chốt',planned:'Đã lên lịch',running:'Đang làm',paused:'Tạm dừng',completed:'Đã kết thúc',skipped:'Đã bỏ buổi',unknown:'Chưa rõ kết quả'};
    return view(`${task?.title??'Công việc'} · ${s.minutes} phút\n${labels[s.status]}\n${new Date(s.start_at+7*3600000).toISOString().slice(0,16).replace('T',' ')} (giờ Việt Nam)`,[...sessionButtons(s),[{text:'Hôm nay',callback_data:'nav:today'}]]);
  }
  if(text==='/settings')return view('Nhắc theo giờ cậu hẹn, không chặn giờ yên lặng. Nghỉ hôm nay dừng nhắc tới hết ngày; mở lại không gửi bù các nhắc đã hủy. Mỗi lần hẹn tối đa 2 lượt nhắc, không giới hạn theo ngày.',
    [[{text:'Nghỉ hôm nay',callback_data:'nav:rest'},{text:'Mở lại nhắc',callback_data:'nav:resume'}],[{text:'Bộ nhớ',callback_data:'nav:memory'},{text:'Trang chính',callback_data:'nav:home'}]]);
  if(text==='/quiet'||text.startsWith('/quiet '))return view('Đã bỏ giờ yên lặng. Dùng /rest nếu muốn dừng nhắc hôm nay.');
  if(text==='/rest'||text==='/resume'){
    const p:Preferences=await store.preferences(i.owner)??{owner:i.owner,quiet_start:1320,quiet_end:420,pause_until:0};
    p.pause_until=text==='/rest'?dayStart(now)+86400000:0;
    return {...view(text==='/rest'?'Đã dừng nhắc tới hết hôm nay.':'Đã mở nhắc lại. Không gửi bù các nhắc đã hủy; cậu có thể hẹn lại buổi cần nhắc.',[[{text:'Cài đặt',callback_data:'nav:settings'},{text:'Hôm nay',callback_data:'nav:today'}]]),changes:[{type:'preferences',preferences:p},{type:'cancel',owner:i.owner}]};
  }
  if(cb.startsWith('schedule:')){
    const task=await store.task(i.owner,cb.slice(9));if(!task)return view('Không tìm thấy việc.');
    if(task.status==='completed')return view('Việc này đã hoàn thành. Mở lại việc trước khi lên buổi mới nhé.');
    const previous=await store.sessionInput(i.owner);
    const expires=Math.max(now+900000,(previous?.expires??0)+1);
    const buttons=[0,1,2].map((days)=>[{text:days===0?'Hôm nay':days===1?'Ngày mai':'Ngày kia',callback_data:`w:${expires}:day:${dayStart(now)+days*86400000}`}]);
    buttons.push([{text:'Nhập ngày giờ khác',callback_data:`w:${expires}:manual:0`}]);
    buttons.push([{text:'Hủy',callback_data:'cancel-input'}]);
    return {...view(`Lên lịch “${task.title}”\nCậu muốn làm ngày nào?`,buttons),changes:[{type:'session-input',taskId:task.id,expires}]};
  }
  if(cb==='cancel-input')return {...view('Đã hủy nhập lịch.'),changes:[{type:'cancel',owner:i.owner}]};
  if(cb.startsWith('w:')){
    const [,rawExpiry,step,rawValue,rawMinutes]=cb.split(':');
    const pending=await store.sessionInput(i.owner);
    if(!pending||pending.expires<=now||String(pending.expires)!==rawExpiry)return view('Lựa chọn lịch đã cũ. Chọn việc để lên lịch lại nhé.');
    const task=await store.task(i.owner,pending.task_id);if(!task)return view('Việc không còn tồn tại.');
    if(task.status==='completed')return {...view('Việc đã hoàn thành, tớ hủy bước lên lịch đang dở nhé.'),changes:[{type:'cancel',owner:i.owner}]};
    const back={text:'Chọn lại ngày',callback_data:`schedule:${task.id}`};
    const cancel={text:'Hủy',callback_data:'cancel-input'};
    const value=Number(rawValue);
    if(step==='manual'){
      const sample=new Date(now+3600000+7*3600000).toISOString();
      return view(`Nhập ngày giờ và số phút, ví dụ:\n${sample.slice(8,10)}/${sample.slice(5,7)}/${sample.slice(0,4)} ${sample.slice(11,16)} | 25\nGiờ Việt Nam.`,[[back,cancel]]);
    }
    if(step==='day'&&Number.isSafeInteger(value)&&value===dayStart(value)&&value>=dayStart(now)&&value<=dayStart(now)+7*86400000){
      const buttons:Plan['view']['buttons']=[];
      const choices=Array.from({length:24},(_,hour)=>value+hour*3600000).filter(time=>time>now);
      for(let index=0;index<choices.length;index+=4)buttons.push(choices.slice(index,index+4).map(time=>({text:new Date(time+7*3600000).toISOString().slice(11,16),callback_data:`w:${rawExpiry}:time:${time}`})));
      buttons.push([{text:'Giờ khác (nhập tay)',callback_data:`w:${rawExpiry}:manual:0`}],[back,cancel]);
      return view(`Chọn giờ bắt đầu · ${new Date(value+7*3600000).toISOString().slice(0,10)}\nGiờ Việt Nam.`,buttons);
    }
    if(step==='time'&&Number.isSafeInteger(value)&&value>now&&value<=now+8*86400000){
      return view('Dành bao nhiêu phút cho buổi này?',[[15,25,45].map(minutes=>({text:`${minutes} phút`,callback_data:`w:${rawExpiry}:duration:${value}:${minutes}`})),[back,cancel]]);
    }
    if(step==='duration'&&Number.isSafeInteger(value)&&value>now&&value<=now+8*86400000&&['15','25','45'].includes(rawMinutes??'')){
      const p=await store.preferences(i.owner);
      if(p&&p.pause_until>value)return view('Cậu đã dừng nhắc đến hết hôm nay. /resume để mở nhắc, hoặc chọn ngày khác.',[[back,cancel]]);
      const s:Session={id:`b${i.updateId}`,owner:i.owner,task_id:task.id,start_at:value,minutes:Number(rawMinutes),status:'draft',version:1,generation:1,expires:now+300000,active_since:null,spent_ms:0};
      return {...view(`“${task.title}”\n${new Date(value+7*3600000).toISOString().slice(0,16).replace('T',' ')} · ${s.minutes} phút (giờ Việt Nam)\nChốt buổi này nhé?`,sessionButtons(s)),changes:[{type:'session-create',session:s}]};
    }
    return view('Giờ này không còn hợp lệ. Chọn lại nhé.',[[back,cancel]]);
  }
  if(cb.startsWith('s:')){
    const [,action,id,version]=cb.split(':');
    const s=await store.session(i.owner,id??'');
    if(!s||s.version!==Number(version)||!canAct(s,action??'',now))return {view:{text:'Nút cũ hoặc thao tác không phù hợp. Mở /today để xem bản mới.',buttons:[],silent:true},changes:[]};
    const allowed=['confirm','start','pause','finish','skip','snooze'] as const;
    const selected=allowed.find(a=>a===action)!;
    if(selected==='confirm'||selected==='snooze'){
      const preferences=await store.preferences(i.owner);
      if((preferences?.pause_until??0)>(selected==='snooze'?now+900000:s.start_at))
        return view('Cậu đang dừng nhắc. /resume để mở lại trước khi chốt giờ này, hoặc chọn ngày khác.');
    }
    if(selected==='start'){
      const other=await store.runningSession(i.owner);
      if(other)return view('Cậu đang có một buổi chạy. Tạm dừng hoặc kết thúc buổi đó trước nhé.',sessionButtons(other));
    }
    const status=selected==='confirm'||selected==='snooze'?'planned':selected==='start'?'running':selected==='pause'?'paused':selected==='finish'?'completed':'skipped';
    const updated:Session={...s,status,version:s.version+1,start_at:selected==='snooze'?now+900000:s.start_at};
    const title=(await store.task(i.owner,s.task_id))?.title??'Công việc';
    const labels={confirm:'Đã chốt buổi',snooze:'Đã dời buổi',start:'Đang làm',pause:'Đã tạm dừng',finish:'Đã kết thúc buổi (chưa đánh dấu xong việc)',skip:'Đã bỏ buổi'};
    return {...view(`${labels[selected]}: “${title}”\n${new Date(updated.start_at+7*3600000).toISOString().slice(0,16).replace('T',' ')} · ${s.minutes} phút (giờ Việt Nam)`,sessionButtons(updated)),changes:[{type:'session-action',session:s,action:selected,now}]};
  }
  if(text.startsWith('/')||cb)return null;
  const pending=await store.sessionInput(i.owner);
  if(!pending||pending.expires<=now)return null;
  const [rawDate,rawMinutes,...extra]=text.split('|').map(x=>x.trim());
  const parsed=deadlineValue(rawDate??''),minutes=Number(rawMinutes);
  if(!parsed||!Number.isInteger(minutes)||minutes<5||minutes>180||extra.length||Date.parse(parsed)<now)
    return view('Cần giờ tương lai và số phút: DD/MM/YYYY HH:mm | 25. /cancel để hủy.');
  const task=await store.task(i.owner,pending.task_id);if(!task)return view('Việc không còn tồn tại.');
  if(task.status==='completed')return {...view('Việc đã hoàn thành, tớ hủy bước lên lịch đang dở nhé.'),changes:[{type:'cancel',owner:i.owner}]};
  const s:Session={id:`b${i.updateId}`,owner:i.owner,task_id:task.id,start_at:Date.parse(parsed),minutes,status:'draft',version:1,generation:1,expires:now+300000,active_since:null,spent_ms:0};
  return {...view(`Buổi “${task.title}”: ${rawDate}, ${minutes} phút. Chốt nhé?`,sessionButtons(s)),changes:[{type:'session-create',session:s}]};
}
