import {statistics,achievementRules,type ProgressData,type WorkFilter} from '../domain/progress.ts';
import type {WorkReader} from '../ports/work-store.ts';
import type {Input,Plan,View} from '../domain/work.ts';

// Deterministic RGB PNG. Browser/Workers-native compression, no chart service or AI image call.
export async function progressPng(data:ProgressData,now:number):Promise<string>{
 const s=statistics(data,now),w=560,h=260,pixels=new Uint8Array(h*(1+w*3));
 for(let y=0;y<h;y++){const row=y*(1+w*3);for(let x=0;x<w;x++){const p=row+1+x*3;pixels[p]=246;pixels[p+1]=248;pixels[p+2]=252;}}
 const rect=(x:number,y:number,rw:number,rh:number,color:number[])=>{for(let yy=y;yy<Math.min(h,y+rh);yy++)for(let xx=x;xx<Math.min(w,x+rw);xx++){const p=yy*(1+w*3)+1+xx*3;pixels.set(color,p);}};
 const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
 const number=(value:string,x:number,y:number,scale=2)=>{for(const c of value){if(c==='/'){rect(x+2,y+5,2,3,[110,115,130]);x+=6;continue;}const glyph=digits[Number(c)];if(!glyph)continue;for(let n=0;n<15;n++)if(glyph[n]==='1')rect(x+(n%3)*scale,y+Math.floor(n/3)*scale,scale,scale,[64,70,89]);x+=4*scale;}};
 const max=Math.max(1,...s.bars.map(b=>b.count));
 s.bars.forEach((b,i)=>{const height=Math.round(b.count/max*125);rect(36+i*72,145-height,40,Math.max(2,height),[110,90,210]);number(String(b.count),42+i*72,Math.max(3,132-height));const day=new Date(b.day*86400000);number(String(day.getUTCDate()).padStart(2,'0')+'/'+String(day.getUTCMonth()+1).padStart(2,'0'),27+i*72,150,2);});
 s.calendar.forEach((d,i)=>rect(30+(i%7)*72,168+Math.floor(i/7)*20,40,13,d.active?[60,174,132]:[219,225,232]));
 const compressed=new Uint8Array(await new Response(new Blob([pixels]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 const crc=(bytes:Uint8Array)=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
 const chunk=(type:string,body:Uint8Array)=>{const out=new Uint8Array(12+body.length),dv=new DataView(out.buffer);dv.setUint32(0,body.length);out.set(new TextEncoder().encode(type),4);out.set(body,8);dv.setUint32(out.length-4,crc(out.subarray(4,out.length-4)));return out;};
 const header=new Uint8Array(13),dv=new DataView(header.buffer);dv.setUint32(0,w);dv.setUint32(4,h);header.set([8,2,0,0,0],8);
 const chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())];
 let binary='';for(const part of chunks)for(const byte of part)binary+=String.fromCharCode(byte);
 return btoa(binary);
}
export async function progressView(data:ProgressData,now:number,achievements=false):Promise<View>{
 const s=statistics(data,now),opened=new Set(data.achievements.map(a=>a.code));
 const text=achievements?'🏅 THÀNH TỰU\n'+achievementRules.map(r=>`${opened.has(r.code)?'✅':'🔒'} ${r.label}${opened.has(r.code)?' · Đã mở khóa':` · ${Math.min(s[r.kind],r.target)}/${r.target}`}`).join('\n'):
 `🌱 TIẾN BỘ CỦA CẬU\n✓ Hôm nay: ${s.today} · Tuần này: ${s.week}\n🔥 Chuỗi: ${s.streak} ngày · Kỷ lục: ${s.best}\n🎯 Đúng hạn tuần này: ${s.onTime}/${s.dated} việc có hạn\n\nCột: 7 ngày gần nhất, từ trái sang phải\n${s.bars.map(b=>b.count).join(' · ')}\nÔ xanh: ngày có tiến bộ trong 4 tuần (cũ → mới)\nChỉ tính dữ liệu ghi nhận từ khi bật thống kê.`;
 const view:View={dashboard:achievements?'achievements':'progress',text,buttons:[[{text:achievements?'Biểu đồ 🌱':'Thành tựu 🏅',callback_data:achievements?'progress:chart':'progress:achievements'}],[{text:'Công việc',callback_data:'board:active:0'}]]};
 try{view.photo=await progressPng(data,now);}catch{/* Useful text fallback if rendering fails. */}
 return view;
}
const filters:Record<WorkFilter,string>={active:'Đang làm',all:'Tất cả',today:'Hôm nay',overdue:'Quá hạn',upcoming:'Sắp tới',undated:'Chưa có hạn',completed:'Đã xong'};
export async function boardCommand(i:Input,store:WorkReader,now:number):Promise<Plan|null>{
 const cb=i.callback??'';
 if((cb.startsWith('progress:')||i.text==='/progress')&&store.progress){
  return {view:await progressView(await store.progress(i.owner),now,cb==='progress:achievements'),changes:[]};
 }
 if(!store.workPage||!store.boardSelection)return null;
 if(cb==='board-exit'){
  const selected=await store.boardSelection(i.owner);
  return {view:await boardView(i,store,now,'active',0,{items:[],revision:selected.revision+1,expires:0},false),
    changes:[{type:'board-select',owner:i.owner,items:[],expectedRevision:selected.revision,expires:0}]};
 }
 if(cb==='board-filters')return {view:{text:'Cậu muốn xem nhóm nào?',buttons:Object.entries(filters).map(([key,label])=>[{text:label,callback_data:'board:'+key+':0'}])},changes:[]};
 if(cb.startsWith('board-select:')){
  const [,id,raw,rawFilter='active',rawOffset='0']=cb.split(':'),revision=Number(raw);
  const selectedFilter=rawFilter as WorkFilter,selectedOffset=Number(rawOffset);
  if(!Object.hasOwn(filters,selectedFilter)||!Number.isSafeInteger(selectedOffset)||selectedOffset<0)return null;
  const selected=await store.boardSelection(i.owner);
  if(selected.revision!==revision)return {view:{text:'Lựa chọn đã đổi, mở lại danh sách nhé.',buttons:[[{text:'Mở lại',callback_data:'board:active:0'}]]},changes:[]};
  const task=await store.task(i.owner,id!);if(!task)return null;
  const items=selected.expires>now?[...selected.items]:[];
  const index=items.findIndex(t=>t.id===id);if(index>=0)items.splice(index,1);else if(items.length<50)items.push({id:task.id,title:task.title,version:task.version});
  const page=await boardView(i,store,now,selectedFilter,selectedOffset,{...selected,items,revision:revision+1,expires:now+900000},true);
  return {view:page,changes:[{type:'board-select',owner:i.owner,items,expectedRevision:revision,expires:now+900000}]};
 }
 if(cb==='board-review'||cb.startsWith('board-delete:')){
  const selected=await store.boardSelection(i.owner);
  if(!selected.items.length||selected.expires<=now)return {view:{text:'Chưa có lựa chọn hoặc đã hết hạn.',buttons:[[{text:'Công việc',callback_data:'board:active:0'}]]},changes:[]};
  if(cb.startsWith('board-delete:')){
   if(Number(cb.slice(13))!==selected.revision)return {view:{text:'Xác nhận đã cũ.',buttons:[]},changes:[]};
   const current=await Promise.all(selected.items.map(t=>store.task(i.owner,t.id)));
   if(current.some((task,index)=>!task||task.version!==selected.items[index]!.version)){
    return {view:{text:'Có việc đã thay đổi kể từ lúc chọn. Tớ chưa xóa gì; cậu chọn lại để kiểm tra nhé.',buttons:[[{text:'Chọn lại',callback_data:'board:active:0:select'}]]},
      changes:[{type:'board-select',owner:i.owner,items:[],expectedRevision:selected.revision,expires:0}]};
   }
   return {view:{text:`Đã đưa ${selected.items.length} việc vào thùng rác và hủy nhắc liên quan. Thành tích cũ vẫn giữ.`,buttons:[[{text:'Về danh sách',callback_data:'board:active:0'}]]},changes:[{type:'tasks-delete',owner:i.owner,items:selected.items,now,selectionRevision:selected.revision}]};
  }
  return {view:{text:'Xóa các việc này và hủy lời nhắc?\n'+selected.items.map(t=>'• '+t.title.slice(0,65)).join('\n'),buttons:[[{text:'Xác nhận xóa',callback_data:'board-delete:'+selected.revision},{text:'Quay lại',callback_data:'board:active:0:select'}]]},changes:[]};
 }
 if(cb.startsWith('board:')||i.text==='/tasks'){
  const [,rawFilter='active',rawOffset='0',mode]=cb.split(':');
  const filter=rawFilter as WorkFilter,offset=Number(rawOffset);
  if(!Object.hasOwn(filters,filter)||!Number.isSafeInteger(offset)||offset<0)return null;
  const selected=await store.boardSelection(i.owner);
  return {view:await boardView(i,store,now,filter,offset,selected,mode==='select'),changes:[]};
 }
 return null;
}
async function boardView(i:Input,store:WorkReader,now:number,filter:WorkFilter,offset:number,selection:import('../domain/progress.ts').BoardSelection,select:boolean):Promise<View>{
 const page=await store.workPage!(i.owner,filter,offset,now);
 const ids=new Set(selection.expires>now?selection.items.map(t=>t.id):[]);
 const format=(value:string|null)=>!value?'Chưa có hạn':value.length===10?value.split('-').reverse().join('/'):new Date(Date.parse(value)+25200000).toISOString().slice(0,16).replace('T',' ');
 const buttons:View['buttons']=page.items.map((t,index)=>[{text:select?`${ids.has(t.id)?'☑':'☐'} ${t.title}`:`Xem ${index+1}`,callback_data:select?`board-select:${t.id}:${selection.revision}:${filter}:${offset}`:`task:${t.id}`}]);
 const suffix=select?':select':'';
 const nav=[];if(offset>0)nav.push({text:'‹ Trước',callback_data:`board:${filter}:${Math.max(0,offset-5)}${suffix}`});if(offset+5<page.total)nav.push({text:'Sau ›',callback_data:`board:${filter}:${offset+5}${suffix}`});if(nav.length)buttons.push(nav);
 buttons.push(select?[{text:`Xem lại (${ids.size})`,callback_data:'board-review'},{text:'Thoát chọn',callback_data:'board-exit'}]:[{text:'Lọc',callback_data:'board-filters'},{text:'Chọn để xóa',callback_data:`board:${filter}:${offset}:select`}]);
 buttons.push([{text:'Tiến bộ 🌱',callback_data:'progress:chart'}]);
 return {text:`📋 ${filters[filter]} · ${page.total} việc · Trang ${Math.floor(offset/5)+1}/${Math.max(1,Math.ceil(page.total/5))}\n\n`+(page.items.map((t,index)=>`${index+1}. ${t.title}\n   ${format(t.deadline)}`).join('\n')||'Chưa có việc trong nhóm này.'),buttons};
}
