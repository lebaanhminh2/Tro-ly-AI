// Prototype intentionally has no network/storage/auth. Reload restores the sample.
export function createDemo(){
 return {
  tab:'today',mode:'timeline',reminderFilter:'recurring',screenState:'ready',selected:new Set(),selecting:false,
  start:'04:30',sleep:'22:30',resting:false,
  cultivation:{qi:20,totalEarned:145,rank:1,highestRank:1,streak:3,tickets:3,rewardedTasks:[],failures:0,attemptDay:null,protectedUntil:0,inventory:{basic:3,middle:0,high:0,supreme:0,heart:1,peace:1,keepsake:0},active:{heart:false,peace:false},log:[]},
  tasks:[
   {code:24,title:'Báo cáo môn học',deadline:'2026-09-18',done:false,steps:[{code:'24.1',title:'Đọc yêu cầu',done:true},{code:'24.2',title:'Viết dàn ý',done:false},{code:'24.3',title:'Viết bản nháp',done:false}],nextStep:4},
   {code:25,title:'Bài tập xác suất',deadline:'2026-09-19',done:false,steps:[],nextStep:1},
   {code:26,title:'Ôn từ vựng tiếng Anh',deadline:'',done:false,steps:[],nextStep:1}
  ],
  nextTask:27,
  reminders:[
   {id:1,title:'Uống nước',kind:'daily',times:'09:00, 15:00',weekdays:[],start:'2026-09-13',end:'',enabled:true},
   {id:2,title:'Ôn từ vựng',kind:'weekdays',times:'19:00',weekdays:[1,3,5],start:'2026-09-13',end:'',enabled:true},
   {id:3,title:'Gọi cho mẹ',kind:'once',times:'18:30',weekdays:[],start:'2026-09-14',end:'',enabled:true}
  ],
  nextReminder:4
 };
}

// All balances below are disposable demo state, never production rewards.
export const realms=[
 {name:'Phàm Nhân',qi:0,days:0},{name:'Luyện Khí',qi:6,days:2},
 {name:'Trúc Cơ',qi:18,days:3},{name:'Kết Đan',qi:40,days:5},
 {name:'Nguyên Anh',qi:75,days:7},{name:'Hóa Thần',qi:120,days:8},
 {name:'Luyện Hư',qi:180,days:11},{name:'Hợp Thể',qi:260,days:14},
 {name:'Đại Thừa',qi:360,days:17},{name:'Độ Kiếp',qi:500,days:24},{name:'Chân Tiên',qi:1000,days:35},{name:'Kim Tiên',qi:2000,days:45}
];
export const loot=[
 {key:'qi1',label:'+1 tu vi',weight:40},{key:'qi2',label:'+2 tu vi',weight:15},
 {key:'basic',label:'Phá Cảnh Phù · Sơ cấp',weight:35},
 {key:'keepsake',label:'Tín vật Minh Anh',weight:6},
 {key:'heart',label:'Hộ Tâm Phù',weight:2},{key:'peace',label:'An Tâm Phù',weight:2}
];
export const talismans=[
 {key:'basic',name:'Sơ cấp',boost:5,next:'middle',chance:80},
 {key:'middle',name:'Trung cấp',boost:10,next:'high',chance:60},
 {key:'high',name:'Cao cấp',boost:15,next:'supreme',chance:40},
 {key:'supreme',name:'Cực phẩm',boost:20,next:null,chance:0}
];
export function demoDraw(c,random=Math.random){
 if(c.tickets<1)return null;
 const roll=random()*100;let threshold=0;
 const reward=loot.find(item=>{threshold+=item.weight;return roll<threshold;});
 if(!reward)return null;
 c.tickets--;
 if(reward.key.startsWith('qi')){const amount=reward.key==='qi1'?1:2;c.qi+=amount;c.totalEarned+=amount;}
 else c.inventory[reward.key]++;
 c.log.unshift('Quay thưởng: '+reward.label);return reward;
}
export function demoCompleteTask(c,code){
 if(c.rewardedTasks.includes(code))return false;
 c.rewardedTasks.push(code);c.tickets++;c.log.unshift('Hoàn thành #'+code+': +1 vé');return true;
}
export function demoFuse(c,key,random=Math.random){
 const rule=talismans.find(t=>t.key===key);
 if(!rule?.next||c.inventory[key]<3)return null;
 const success=random()*100<rule.chance;
 c.inventory[key]-=success?3:1;
 if(success)c.inventory[rule.next]++;
 c.log.unshift('Ghép '+rule.name+': '+(success?'thành công':'chưa thành, trả lại 2 lá'));return success;
}
export function demoBreakthrough(c,day,key=null,now=Date.now(),random=Math.random){
 const target=realms[c.rank+1],charm=talismans.find(t=>t.key===key);
 if(!target||c.attemptDay===day||c.qi<target.qi||c.streak<target.days)return null;
 if(key&&(!charm||c.inventory[key]<1))return null;
 const chance=Math.min(100,[70,85,100][Math.min(c.failures,2)]+(charm?.boost??0));
 c.attemptDay=day;if(charm)c.inventory[charm.key]--;
 const success=random()*100<chance;
 if(success){c.rank++;c.highestRank=Math.max(c.highestRank,c.rank);c.failures=0;c.protectedUntil=now+72*3600000;}
 else c.failures++;
 c.log.unshift(success?'Đột phá '+target.name+' · bảo vệ 72 giờ':'Đột phá chưa thành · giữ nguyên tu vi');
 return {success,chance};
}

const pendingRequests=new Map();
export function themePreference(){try{const value=localStorage.getItem('minh-anh-theme');return ['light','dark'].includes(value)?value:'auto';}catch{return 'auto';}}
export function applyTheme(preference=themePreference()){
 const automatic=globalThis.Telegram?.WebApp?.colorScheme??(globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light');
 document.documentElement.dataset.theme=preference==='auto'?automatic:preference;
}
export function setThemePreference(value){
 if(!['auto','light','dark'].includes(value))return;
 try{localStorage.setItem('minh-anh-theme',value);}catch{}
 applyTheme(value);
}
export async function connectLive(){
 if(!globalThis.Telegram?.WebApp){
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';
   script.onload=resolve;script.onerror=()=>reject(Error('Không tải được Telegram SDK.'));document.head.append(script);
  });
 }
 const app=globalThis.Telegram?.WebApp;
 if(!app?.initData)throw Error('Hãy mở ứng dụng từ nút trong Telegram, không mở đường dẫn trực tiếp.');
 const theme=()=>applyTheme();
 theme();app.onEvent?.('themeChanged',theme);
 app.ready();app.expand();
 return refreshLive();
}
async function liveRequest(path,body){
 const initData=globalThis.Telegram?.WebApp?.initData;
 if(!initData)throw Error('Mở lại từ Telegram để tiếp tục.');
 const key=body?path+JSON.stringify(body):null;
 let request=body;
 if(key){
  if(!pendingRequests.has(key))pendingRequests.set(key,{...body,id:crypto.randomUUID()});
  request=pendingRequests.get(key);
 }
 const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'X-Telegram-Init-Data':initData,'Content-Type':'application/json'},body:body?JSON.stringify(request):undefined,signal:AbortSignal.timeout(15000)});
 const result=await response.json();
 if(!response.ok){
  if(response.status<500&&key)pendingRequests.delete(key);
  const messages={AUTH_REQUIRED:'Phiên đã hết hạn. Đóng và mở lại từ Telegram nhé.',SETUP_REQUIRED:'Chọn giờ bắt đầu và giờ nghỉ trước nhé.',STALE_TASK:'Việc vừa thay đổi. Mở lại danh sách rồi thử lại.',CONFIRM_CHILDREN:'Task còn bước chưa xong. Hãy xác nhận hoàn thành cả nhóm.',CONFIRM_REOPEN_PARENT:'Cần xác nhận mở lại task cha.',DRAW_UNAVAILABLE:'Chưa thể quay lúc này.',NO_TICKETS:'Cậu chưa có vé. Hoàn thành một task lần đầu để nhận 1 vé.',ACCOUNT_SUSPENDED:'Tài khoản tạm ngưng do ba ngày không chat. Nhắn cho Minh Anh để hoạt động lại; đây không phải chế độ /ngu.',NO_ACTIVE_DAY:'Cậu đã lưu giờ sinh hoạt. Ngày hoạt động tiếp theo chưa bắt đầu; không cần thiết lập lại.',BREAKTHROUGH_UNAVAILABLE:'Chưa đủ điều kiện hoặc hôm nay đã thử đột phá.',FUSION_UNAVAILABLE:'Chưa đủ ba phù cùng cấp.',ITEM_UNAVAILABLE:'Vật phẩm chưa dùng được lúc này.',ALREADY_PROTECTED:'Hôm nay đã kích hoạt bảo vệ rồi.',NO_NEXT_REMINDER:'Không còn lần nhắc sắp tới để sửa.'};
  const timelineErrors={TIMELINE_CHANGED:'Lịch vừa thay đổi. Đóng hộp và mở lại lịch trước khi kéo nhé.',TIMELINE_BLOCKED:'Giờ đó đã qua, đang bận hoặc ngoài khung làm việc. Chưa đổi lịch.',TIMELINE_NO_ROOM:'Không đủ chỗ cho các việc phía sau. Chưa lưu lần kéo này; hãy điều chỉnh khoảng rảnh hoặc thời lượng.',TIMELINE_DEADLINE:'Cách xếp này vượt deadline. Chưa đổi lịch.',TIMELINE_UNDO_EXPIRED:'Đã hết thời gian hoàn tác. Cậu vẫn có thể chỉnh giờ trực tiếp.',INVALID_TIMELINE_MOVE:'Chọn giờ tương lai theo nấc 5 phút nhé.'};
  throw Error(result.message??timelineErrors[result.error]??messages[result.error]??'Chưa xác nhận được kết quả. Kiểm tra lại trước khi thao tác mới.');
 }
 return result;
}
export async function refreshLive(){
 const data=await liveRequest('bootstrap');
 const c=data.account.state;
 const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 return {
  live:true,loaded:true,resting:data.resting,rest:data.rest,needsSetup:data.needsSetup,serverNow:data.now,settingsVersion:data.settings?.version??0,
  start:clock(data.settings?.start_minutes??270),sleep:data.settings?.sleep_minutes===null||!data.settings?'':clock(data.settings.sleep_minutes),
  tasks:data.tasks.map(t=>({id:t.id,code:t.public_code,title:t.title,version:t.version,deadline:t.deadline??'',done:t.status==='completed',steps:t.steps.map(s=>({id:s.id,code:t.public_code+'.'+s.step_code,title:s.title,done:s.status==='completed',version:s.version}))})),
  reminders:data.reminders.map(r=>({...r,times:r.times.join(', '),start:r.startDate,end:r.endDate??''})),
  cultivation:{...c,totalEarned:c.earned,active:{heart:c.heartDay===data.day?.day,peace:c.peaceDay===data.day?.day},log:[],rewardedTasks:[]},
  day:data.day,timeline:data.timeline,loadedAt:Date.now(),progress:data.progress,sessions:data.sessions,events:data.events
 };
}
export async function liveMutation(path,input){const result=await liveRequest(path,input);const refreshed=await refreshLive();pendingRequests.delete(path+JSON.stringify(input));return {result,...refreshed};}
