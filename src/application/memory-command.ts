import type {Input,Plan} from '../domain/work.ts';
import type {WorkReader} from '../ports/work-store.ts';
import {dayStart} from '../domain/session.ts';
export async function memoryCommand(i:Input,store:WorkReader,now:number):Promise<Plan|null>{
 const view=(text:string):Plan=>({view:{text,buttons:[]},changes:[]});
 const text=i.text??'';
 if(text==='/memory'){
  const memories=await store.memories(i.owner,now);
  return {view:{text:memories.length?memories.map(m=>`${m.kind==='temporary'?'Hôm nay':'Đã nhớ'}: ${m.content}`).join('\n'):'Chưa lưu điều gì. /remember nội dung để ghi nhớ; /mood nội dung cho hôm nay.',buttons:memories.map(m=>[{text:'Quên: '+m.content.slice(0,30),callback_data:`forget:${m.id}`}])},changes:[]};
 }
 if(text.startsWith('/remember ')||text.startsWith('/mood ')){
  const temporary=text.startsWith('/mood '),content=text.slice(temporary?6:10).trim();
  if(!content||content.length>300)return view('Nội dung cần từ 1 đến 300 ký tự.');
  return {...view('Đã lưu theo yêu cầu của cậu. Xem hoặc xóa ở /memory.'),changes:[{type:'remember',memory:{id:`m${i.updateId}`,owner:i.owner,content,kind:temporary?'temporary':'preference',source:`user-command:${i.updateId}`,created:now,expires:temporary?dayStart(now)+86400000:null}}]};
 }
 if(i.callback?.startsWith('forget:'))return {...view('Đã quên mục được chọn và xóa ngữ cảnh hội thoại cũ để không nhắc lại nó.'),changes:[{type:'forget',owner:i.owner,id:i.callback.slice(7)}]};
 if(text==='/forgetall')return {view:{text:'Xóa mọi ghi nhớ và lịch sử hội thoại của bot? Task và lịch nhắc vẫn giữ nguyên.',buttons:[[{text:'Xóa bộ nhớ',callback_data:'forget-all'},{text:'Thôi',callback_data:'memory-cancel'}]]},changes:[]};
 if(i.callback==='forget-all')return {...view('Đã xóa bộ nhớ và lịch sử hội thoại của bot. Không thu hồi được dữ liệu từng gửi cho nhà cung cấp AI.'),changes:[{type:'forget',owner:i.owner,id:null}]};
 if(text==='/ai off'||text==='/ai on')return {...view(text.endsWith('off')?'Đã tắt hội thoại AI. Task và nhắc vẫn hoạt động.':'Đã bật tùy chọn hội thoại; chỉ hoạt động khi máy chủ có kết nối AI được duyệt.'),changes:[{type:'ai-enabled',owner:i.owner,enabled:text.endsWith('on')}]};
 if(i.callback?.startsWith('focus:')){
  const task=await store.task(i.owner,i.callback.slice(6));
  if(!task)return view('Không tìm thấy việc.');
  return {...view(`Mình đang nói về “${task.title}”. Cậu nói tiếp nhé.`),changes:[{type:'focus',owner:i.owner,taskId:task.id,expires:now+900000},{type:'cancel',owner:i.owner}]};
 }
 return null;
}
