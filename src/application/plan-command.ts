import {healthyCommand} from './healthy-command.ts';
import {scheduleEntry} from './schedule-command.ts';
import {boardCommand} from './progress-renderer.ts';
import { deadlineValue } from '../domain/time.ts';
import { confirmationAvailable } from '../domain/work.ts';
import type { Input, Plan, Proposal, Button } from '../domain/work.ts';
import type { WorkReader } from '../ports/work-store.ts';
import { sessionCommand } from './session-command.ts';
import {memoryCommand} from './memory-command.ts';
import {dayStart} from '../domain/session.ts';
export type ChatService = ((owner: string, text: string, tasks: Awaited<ReturnType<WorkReader['tasks']>>,input?:Input,store?:WorkReader,now?:number) => Promise<string|Plan>) & {
  forLease?:(lease:import('../ports/work-store.ts').Lease)=>ChatService;
};

function formatDeadline(value:string){
 if(value.length===10)return value.split('-').reverse().join('/');
 const time=Date.parse(value);
 return Number.isFinite(time)?new Date(time+7*3600000).toISOString().slice(0,16).replace('T',' '):value;
}
export async function planCommand(input: Input, store: WorkReader, now: number, chat?: ChatService): Promise<Plan> {
  const sleep=healthyCommand(input.text??'');
  if(sleep&&store.reportSleep){
    try{
      const result=await store.reportSleep(input.owner,now);
      let text=result.applied?'Tớ đã bật nghỉ rồi nhé. '+(result.delta>0?`+${result.delta} tu vi. `:result.delta<0?`${result.delta} tu vi. `:'')+'Ngủ ngon cậu 🌙':'Cậu đã báo nghỉ hôm nay rồi, tớ vẫn giữ chế độ nghỉ nhé.';
      if(sleep.message&&chat){
        let reply:Awaited<ReturnType<ChatService>>;
        try{reply=await chat(input.owner,sleep.message,[],input,store,now);}catch{return {view:{text:text+' Phần nhắn kèm chưa xử lý được; chế độ nghỉ đã bật.',buttons:[]},changes:[]};}
        if(typeof reply==='string')text+='\n'+reply;
        else return {...reply,view:{...reply.view,text:text+'\n'+reply.view.text}};
      }
      return {view:{text,buttons:[]},changes:[]};
    }catch(error){
      if(error instanceof Error&&error.message==='SETUP_REQUIRED')return {view:{text:'Cậu chọn giờ bắt đầu và giờ nghỉ trong ứng dụng trước nhé. Chưa ghi thưởng/phạt.',buttons:[]},changes:[]};
      throw error;
    }
  }
  const entry=scheduleEntry(input.text??'');
  if(entry?.kind==='open')return {view:{text:'Bấm nút “Mở ứng dụng” cạnh ô nhập tin nhắn để xem lịch, công việc và tu vi của cậu nhé.',buttons:[]},changes:[]};
  if(entry?.kind==='help')return {view:{text:'/kiemtra · Mở ứng dụng\n/ nội dung · Thêm/sửa việc hoặc đặt nhắc\n/lich · Cập nhật giờ rảnh/bận\n/ngu · Báo nghỉ, dừng nhắc chủ động\n/huy · Thoát phiên đang nhập',buttons:[]},changes:[]};
  if(entry?.kind==='cancel'){if(store.scheduleDialog)await store.scheduleDialog(input.owner,now,false);return {view:{text:'Đã thoát phiên nhập lịch.',buttons:[]},changes:[{type:'cancel',owner:input.owner}]};}
  if(entry?.kind==='action'){
    if(store.scheduleDialog)await store.scheduleDialog(input.owner,now,false);
    if(!chat)return {view:{text:'AI đang tắt; cậu vẫn quản lý trong ứng dụng được nhé.',buttons:[]},changes:[]};
    const result=await chat(input.owner,entry.message,[],input,store,now);
    return typeof result==='string'?{view:{text:result,buttons:[]},changes:[]}:result;
  }
  if(entry?.kind==='setup'){
    if(!chat)return {view:{text:'Phần trao đổi lịch cần bật AI. Cậu vẫn sửa lịch trong ứng dụng được nhé.',buttons:[]},changes:[]};
    if(store.scheduleDialog)try{await store.scheduleDialog(input.owner,now,true);}catch(error){const code=error instanceof Error?error.message:'';return {view:{text:code==='NO_ACTIVE_DAY'?'Giờ sinh hoạt của cậu đã lưu rồi. Hiện chưa bắt đầu ngày hoạt động tiếp theo nên chưa xếp lại hôm nay được; cậu không cần cài lại.':'Chọn giờ bắt đầu và giờ nghỉ trong ứng dụng trước nhé.',buttons:[]},changes:[]};}
    if(!entry.message)return {view:{text:'Hôm nay cậu bận những khoảng nào? Cậu trả lời ngay ở đây, tớ đối chiếu lịch đã lưu nhé. /huy để thoát.',buttons:[]},changes:[]};
    const result=await chat(input.owner,entry.message,[],input,store,now);
    return typeof result==='string'?{view:{text:result,buttons:[]},changes:[]}:result;
  }
  const board=await boardCommand(input,store,now);if(board){board.changes.push({type:'cancel',owner:input.owner});return board;}
  if(input.callback?.startsWith('tool-confirm:')&&chat){
    const result=await chat(input.owner,'',[],input,store,now);
    return typeof result==='string'?{view:{text:result,buttons:[]},changes:[]}:result;
  }
  // Normal chat always reaches the model, even after an old wizard was opened.
  if(chat&&input.text&&!input.text.startsWith('/')&&!input.callback){
    if(!await store.aiEnabled(input.owner))return {view:{text:'Hội thoại AI đang tắt; cậu có thể mở lại bằng /ai on.',buttons:[]},changes:[]};
    const result=await chat(input.owner,input.text,[],input,store,now);
    const plan=typeof result==='string'?{view:{text:result,buttons:[]},changes:[] as import('../domain/work.ts').Change[]}:result;
    plan.changes.push({type:'cancel',owner:input.owner});
    return plan;
  }
  const navigation:Record<string,string>={'nav:tasks':'/tasks','nav:today':'/today','nav:settings':'/settings','nav:memory':'/memory','nav:home':'/start','nav:resume':'/resume','nav:rest':'/rest'};
  if(input.callback&&navigation[input.callback]){
    const result=await planCommand({...input,text:navigation[input.callback],callback:undefined},store,now,chat);
    if(!result.changes.some(c=>c.type==='cancel'))result.changes.push({type:'cancel',owner:input.owner});
    return result;
  }
  if(input.callback?.startsWith('focus:')&&(!chat||!await store.aiEnabled(input.owner)))return {view:{text:'Hội thoại AI chưa bật. Cậu vẫn có thể quản lý việc và lên lịch nhé.',buttons:[]},changes:[]};
  const memoryPlan=await memoryCommand(input,store,now);if(memoryPlan)return memoryPlan;
  const sessionPlan=await sessionCommand(input,store,now);
  if(sessionPlan)return sessionPlan;
  const { owner, text = '', callback, updateId } = input;
  const view = (text: string, buttons: Button[][] = []): Plan => ({ view: { text, buttons }, changes: [] });
  const proposalCard = (proposal: Proposal, description: string): Plan => ({
    view: { text: description, buttons: [[{ text: 'Xác nhận', callback_data: `yes:${proposal.id}` }, { text: 'Thôi', callback_data: `no:${proposal.id}` }]] },
    changes: [{ type: 'propose', proposal }]
  });
  const newProposal = (value: string, taskId: string | null, version: number): Proposal => ({
    id: `p${owner}_${updateId}`, owner, task_id: taskId ?? `t${owner}_${updateId}`,
    operation: taskId ? 'deadline' : 'capture', value, expected_version: version, expires: now + 300000, status: 'pending'
  });
  if (callback?.startsWith('yes:') || callback?.startsWith('no:')) {
    const accept = callback.startsWith('yes:');
    const proposal = await store.proposal(owner, callback.slice(callback.indexOf(':') + 1));
    const task = proposal ? await store.task(owner, proposal.task_id) : null;
    if(proposal&&proposal.status!=='pending')return {view:{text:'Đã xử lý lựa chọn này.',buttons:[],silent:true},changes:[]};
    if (!proposal || !confirmationAvailable(proposal, task, now, accept))
      return view('Lựa chọn đã xử lý, hết hạn hoặc đã cũ. Dùng /tasks để xem bản mới nhé.');
    return { ...view(accept ? proposal.operation==='capture'?`Đã thêm “${proposal.value}”.`:'Đã cập nhật hạn của việc.' : 'Ừ, không đổi nhé.',
      accept?[[{text:'Xem việc',callback_data:`task:${proposal.task_id}`},{text:'Lên lịch',callback_data:`schedule:${proposal.task_id}`}]]:[[{text:'Công việc',callback_data:'nav:tasks'}]]), changes: [{ type: 'resolve', proposal, accept }] };
  }
  if (callback?.startsWith('deadline:')) {
    const task = await store.task(owner, callback.slice(9));
    if (!task) return view('Không tìm thấy việc này.');
    const previous=await store.selection(owner);
    const expires=Math.max(now+300000,(previous?.expires??0)+1);
    return { ...view(`Đặt hạn “${task.title}”: chọn ngày, hoặc nhập DD/MM/YYYY HH:mm theo giờ Việt Nam.`,[
      ...[0,1,2].map(days=>[{text:days===0?'Hôm nay':days===1?'Ngày mai':'Ngày kia',callback_data:`due:${expires}:day:${dayStart(now)+days*86400000}`}]),
      [{text:'Hủy',callback_data:'cancel-input'}]]),
      changes: [{ type: 'select', selection: { owner, task_id: task.id, version: task.version, expires } }] };
  }
  if(callback?.startsWith('due:')){
    const [,expiry,step,raw]=callback.split(':');
    const selection=await store.selection(owner),value=Number(raw);
    if(!selection||selection.expires<=now||String(selection.expires)!==expiry)return view('Lựa chọn hạn đã cũ. Mở lại việc nhé.');
    const task=await store.task(owner,selection.task_id);
    if(!task||task.version!==selection.version)return view('Việc đã thay đổi. Mở lại việc nhé.');
    if(step==='day'&&Number.isSafeInteger(value)&&value===dayStart(value)&&value>=dayStart(now)&&value<=dayStart(now)+7*86400000){
      const times=Array.from({length:24},(_,hour)=>value+hour*3600000).filter(time=>time>now);
      const buttons:Button[][]=[];
      for(let n=0;n<times.length;n+=4)buttons.push(times.slice(n,n+4).map(time=>({text:new Date(time+7*3600000).toISOString().slice(11,16),callback_data:`due:${expiry}:time:${time}`})));
      buttons.push([{text:'Chọn lại ngày',callback_data:`deadline:${task.id}`},{text:'Hủy',callback_data:'cancel-input'}]);
      return view('Chọn giờ hạn (giờ Việt Nam). Hoặc nhập DD/MM/YYYY HH:mm để chọn phút khác.',buttons);
    }
    if(step==='time'&&Number.isSafeInteger(value)&&value>now&&value<=now+8*86400000){
      const result=proposalCard(newProposal(new Date(value).toISOString(),task.id,task.version),`Hạn “${task.title}”: ${new Date(value+7*3600000).toISOString().slice(0,16).replace('T',' ')} (giờ Việt Nam). Xác nhận nhé?`);
      result.changes.push({type:'cancel',owner});return result;
    }
    return view('Giờ này không hợp lệ. Chọn lại ngày nhé.');
  }
  if (text === '/cancel') return { ...view('Đã hủy nhập ngày giờ.'), changes: [{ type: 'cancel', owner }] };
  if (text === '/start' || text === '/help') return view(`Tớ ở đây. Cậu có thể xem việc, lịch hôm nay hoặc cài đặt bên dưới.\n${chat?'Hội thoại tùy theo cài đặt AI của cậu.':'Hội thoại AI chưa bật trong bản thử này. Thêm việc bằng /add tên việc.'}`,
    [[{text:'Công việc',callback_data:'nav:tasks'},{text:'Hôm nay',callback_data:'nav:today'}],[{text:'Cài đặt',callback_data:'nav:settings'},{text:'Bộ nhớ',callback_data:'nav:memory'}]]);
  if(text==='/tasks'&&store.findTasks){
    const page=await store.findTasks(owner,'','active',0);
    const further=page.nextCursor!==null?await store.findTasks(owner,'','active',page.nextCursor):null;
    const active=[...page.tasks,...(further?.tasks??[])].sort((a,b)=>(a.deadline??'9999').localeCompare(b.deadline??'9999'));
    const top=store.priorityTasks?await store.priorityTasks(owner):active.slice(0,3);
    const lines=top.map((t,index)=>`${index+1}. ${t.title} — ${t.deadline?formatDeadline(t.deadline):'chưa đặt hạn'}`);
    return {...view(top.length?`Trước mắt cậu xem ${top.length} việc này nhé:\n${lines.join('\n')}`:'Chưa có việc đang làm. Cậu nhắn tên việc và hạn, tớ ghi cho nhé.',
      [...top.map(t=>[{text:t.title,callback_data:`task:${t.id}`}]),[{text:'Xem toàn bộ',callback_data:'board:all:0'}]]),changes:[{type:'cancel',owner}]};
  }
  if (text === '/tasks' || callback?.startsWith('page:')) {
    const rawOffset = callback?.slice(5) ?? '0';
    if (!/^\d{1,7}$/.test(rawOffset)) return view('Trang không hợp lệ.');
    const offset = Number(rawOffset), tasks = await store.tasks(owner, offset);
    const buttons = tasks.map((t,index) => [{ text: `${index+1}. ${t.title}`, callback_data: `task:${t.id}` }]);
    if (offset > 0) buttons.push([{ text: 'Trang trước', callback_data: `page:${Math.max(0, offset - 10)}` }]);
    if (tasks.length === 10 && (await store.tasks(owner,offset+10)).length) buttons.push([{ text: 'Trang tiếp', callback_data: `page:${offset + 10}` }]);
    buttons.push([{text:'Trang chính',callback_data:'nav:home'}]);
    return {...view(tasks.length ? tasks.map(t => `${t.status==='completed'?'✓ ':''}${t.title} — ${t.deadline ?? 'chưa có hạn'}`).join('\n') : offset===0?'Chưa có việc nào. Gửi /add tên việc để thêm nhé.':'Chưa có việc ở trang này.', buttons),changes:[{type:'cancel',owner}]};
  }
  if(callback?.startsWith('task:')){
    const task=await store.task(owner,callback.slice(5));
    if(!task)return view('Không tìm thấy việc này.');
    const buttons:Button[][]=[[{text:'Đặt hạn',callback_data:`deadline:${task.id}`},{text:'Lên lịch',callback_data:`schedule:${task.id}`}]];
    if(chat&&await store.aiEnabled(owner))buttons.push([{text:'Sửa bằng chat',callback_data:`focus:${task.id}`}]);
    buttons.push([{text:'Danh sách việc',callback_data:'page:0'}]);
    return {...view(`${task.title}\n${task.status==='completed'?'Đã hoàn thành\n':''}Hạn: ${task.deadline??'Chưa đặt'}`,task.status==='completed'?[[{text:'Danh sách việc',callback_data:'page:0'}]]:buttons),changes:[{type:'cancel',owner}]};
  }
  if (callback) return view('Nút không còn hợp lệ.');
  if (text.startsWith('/add ')) {
    const title = text.slice(5).trim();
    if (!title || title.length > 160) return view('Tên việc cần từ 1 đến 160 ký tự.');
    const result = proposalCard(newProposal(title, null, 0), `Ghi việc “${title}” nhé?`);
    result.changes.push({ type: 'cancel', owner }); // New command exits old input mode.
    return result;
  }
  const selection = await store.selection(owner);
  if (selection && selection.expires > now) {
    const value = deadlineValue(text);
    if (!value || Date.parse(value) <= now) return view('Cần ngày giờ tương lai dạng DD/MM/YYYY HH:mm. /cancel để hủy hoặc chuyển sang việc khác.');
    const task = await store.task(owner, selection.task_id);
    if (!task || task.version !== selection.version) return { ...view('Việc đã thay đổi. Mở /tasks và chọn lại nhé.'), changes: [{ type: 'cancel', owner }] };
    const result = proposalCard(newProposal(value, task.id, task.version), `Hạn “${task.title}”: ${task.deadline ?? 'chưa biết'} → ${value}. Đổi nhé?`);
    result.changes.push({ type: 'cancel', owner });
    return result;
  }
  if (chat) {
    if(!await store.aiEnabled(owner))return view('Hội thoại AI đã tắt. /ai on để mở lại; task và nhắc vẫn dùng được.');
    try { const result=await chat(owner,text,await store.tasks(owner,0),input,store,now);return typeof result==='string'?view(result):result; }
    catch { return view('Hội thoại đang gián đoạn. /add và /tasks vẫn dùng được nhé.'); }
  }
  return view('Hội thoại AI chưa bật. Cậu dùng /add tên việc hoặc /tasks nhé.');
}
