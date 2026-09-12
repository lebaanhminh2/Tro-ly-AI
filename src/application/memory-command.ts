import type {Input,Plan} from '../domain/work.ts';
import type {WorkReader} from '../ports/work-store.ts';
import {dayStart} from '../domain/session.ts';
export async function memoryCommand(i:Input,store:WorkReader,now:number):Promise<Plan|null>{
 const view=(text:string):Plan=>({view:{text,buttons:[]},changes:[]});
 const text=i.text??'';
 if(text==='/memory'||i.callback?.startsWith('memory-page:')){
  const raw=i.callback?.slice(12)??'0';if(!/^\d{1,7}$/.test(raw))return view('Trang không hợp lệ.');
  const offset=Number(raw),rows=await store.memories(i.owner,now,offset,9),memories=rows.slice(0,8);
  const buttons=memories.map(m=>[{text:'Quên: '+m.content,callback_data:`forget:${m.id}`}]);
  if(offset>0)buttons.push([{text:'Trang trước',callback_data:`memory-page:${Math.max(0,offset-8)}`}]);
  if(rows.length>8)buttons.push([{text:'Trang tiếp',callback_data:`memory-page:${offset+8}`}]);
  buttons.push([{text:'Trang chính',callback_data:'nav:home'}]);
  return {view:{text:memories.length?memories.map(m=>`${m.kind==='temporary'?'Hôm nay':'Đã nhớ'}: ${m.content}`).join('\n'):'Chưa lưu điều gì ở trang này. /remember nội dung để ghi nhớ; /mood nội dung cho hôm nay.',buttons},changes:[]};
 }
 if(text.startsWith('/remember ')||text.startsWith('/mood ')){
  const temporary=text.startsWith('/mood '),content=text.slice(temporary?6:10).trim();
  if(!content||content.length>300)return view('Nội dung cần từ 1 đến 300 ký tự.');
  return {...view('Đã lưu theo yêu cầu của cậu. Xem hoặc xóa ở /memory.'),changes:[{type:'remember',memory:{id:`m${i.updateId}`,owner:i.owner,content,kind:temporary?'temporary':'preference',source:`user-command:${i.updateId}`,created:now,expires:temporary?dayStart(now)+86400000:null}}]};
 }
 if(i.callback?.startsWith('forget:')){
  const id=i.callback.slice(7);
  if(!await store.memory(i.owner,id))return {view:{text:'Mục này đã được xóa hoặc không còn tồn tại.',buttons:[],silent:true},changes:[]};
  return {...view('Đã quên mục được chọn và xóa ngữ cảnh hội thoại cũ để không nhắc lại nó.'),changes:[{type:'forget',owner:i.owner,id}]};
 }
 if(text==='/forgetall'){
  const id=`mc${i.updateId}`;
  return {view:{text:'Xóa mọi ghi nhớ và lịch sử hội thoại? Xác nhận có hiệu lực 5 phút; task và nhắc vẫn giữ.',buttons:[[{text:'Xóa bộ nhớ',callback_data:`memory-yes:${id}`},{text:'Thôi',callback_data:`memory-no:${id}`}]]},changes:[{type:'memory-confirm',confirmation:{owner:i.owner,id,expires:now+300000,status:'pending'}}]};
 }
 if(i.callback?.startsWith('memory-yes:')||i.callback?.startsWith('memory-no:')){
  const id=i.callback.slice(i.callback.indexOf(':')+1),p=await store.memoryConfirmation(i.owner,id);
  if(!p||p.status!=='pending'||p.expires<=now)return view('Xác nhận đã cũ, hết hạn hoặc đã xử lý. Dùng /forgetall để tạo yêu cầu mới.');
  const accept=i.callback.startsWith('memory-yes:');
  return {...view(accept?'Đã xóa bộ nhớ và lịch sử của bot; không thu hồi được dữ liệu từng gửi cho bên ngoài.':'Đã hủy xóa bộ nhớ.'),changes:[{type:'memory-resolve',owner:i.owner,id,accept,now}]};
 }
 if(i.callback==='forget-all'||i.callback==='memory-cancel')return view('Nút cũ không còn hiệu lực. Dùng /forgetall để tạo yêu cầu mới.');
 if(text==='/ai off'||text==='/ai on')return {...view(text.endsWith('off')?'Đã tắt hội thoại AI. Task và nhắc vẫn hoạt động.':'Đã bật tùy chọn hội thoại; chỉ hoạt động khi máy chủ có kết nối AI được duyệt.'),changes:[{type:'ai-enabled',owner:i.owner,enabled:text.endsWith('on')}]};
 if(i.callback?.startsWith('focus:')){
  const task=await store.task(i.owner,i.callback.slice(6));
  if(!task)return view('Không tìm thấy việc.');
  return {...view(`Mình đang nói về “${task.title}”. Cậu nói tiếp nhé.`),changes:[{type:'focus',owner:i.owner,taskId:task.id,expires:now+900000},{type:'cancel',owner:i.owner}]};
 }
 return null;
}
