// Shared visual identity for the achievement flame and Today focus card.
export const flameLevels=[{min:0,key:'ember',name:'Tàn Hỏa',color:'#726a82'},{min:1,key:'seed',name:'Hỏa Chủng',color:'#ae7137'},{min:3,key:'spirit',name:'Linh Hỏa',color:'#bd5d39'},{min:7,key:'scarlet',name:'Xích Viêm',color:'#b04451'},{min:14,key:'heaven',name:'Thiên Hỏa',color:'#8050a9'},{min:30,key:'true',name:'Chân Hỏa',color:'#9a6b17'}];
export const flameLevel=streak=>flameLevels.slice().reverse().find(level=>Number(streak??0)>=level.min)??flameLevels[0];
// Prototype intentionally has no network/storage/auth. Reload restores the sample.
export function createDemo(){
 return {
  tab:'today',mode:'timeline',reminderFilter:'all',screenState:'ready',selected:new Set(),selecting:false,
  historyOffset:0,historyHasMore:false,historyLoading:false,
  start:'04:30',sleep:'22:30',autoPlanDelayMinutes:180,resting:false,
  cultivation:{qi:20,totalEarned:145,rank:1,highestRank:1,streak:3,tickets:3,checkin:null,rewardedTasks:[],failures:0,attemptDay:null,protectedUntil:0,inventory:{basic:3,middle:0,high:0,supreme:0,heart:1,peace:1,keepsake:0},active:{heart:false,peace:false},log:[]},
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

const DAY_MS=86400000;
export const breakthroughPenalties=[3,5,8,10,12,15,18,20,22,25,30];
// Demo fallback only; authenticated views use the published server calendar.
export const dailyRewards=[
 {qi:1},{tickets:1},{qi:2},{tickets:1},{qi:2},{tickets:1},{tickets:2,items:{basic:3}},
 {qi:2},{tickets:1},{qi:3},{tickets:1},{qi:2},{tickets:1},{items:{middle:3}},
 {qi:2},{tickets:1},{qi:3},{tickets:1},{qi:2},{tickets:1},{items:{high:3}},
 {qi:3},{tickets:1},{qi:2},{tickets:1},{qi:3},{tickets:1},{qi:3},{tickets:2},
 {qi:30,tickets:5,items:{supreme:1}}
].map((reward,index)=>({day:index+1,qi:0,tickets:0,items:{},...reward,milestone:[7,14,21,30].includes(index+1)}));
export function checkinProgress(c,now=Date.now(),rewards=dailyRewards){
 const calendarDay=Math.floor((now+7*3600000)/DAY_MS),saved=c.checkin;
 const expired=!!saved&&calendarDay>=saved.cycleStartDay+32,current=expired?null:saved,count=current?.count??0;
 const claimedToday=current?.lastDay===calendarDay,daysLeft=current?Math.max(0,current.cycleStartDay+32-calendarDay):32;
 return {calendarDay,cycleStartDay:current?.cycleStartDay??null,count,claimedToday,expired,
  canClaim:count<30&&!claimedToday&&(!current||calendarDay>=current.lastDay),daysLeft,
  missedDays:Math.max(0,(current?Math.max(0,calendarDay-current.cycleStartDay):0)-(count-(claimedToday?1:0))),
  canComplete:count+daysLeft-(claimedToday?1:0)>=30,
  endsAt:current?(current.cycleStartDay+32)*DAY_MS-7*3600000:null,rewardDay:count<30?count+1:null,rewards};
}
export function dailyRewardLabel(reward){
 if(!reward)return '';
 const labels=[];
 if(reward.qi)labels.push(reward.qi+' tu vi');
 if(reward.tickets)labels.push(reward.tickets+' vé quay');
 const names={basic:'Phá Cảnh Phù · Sơ cấp',middle:'Phá Cảnh Phù · Trung cấp',high:'Phá Cảnh Phù · Cao cấp',supreme:'Phá Cảnh Phù · Cực phẩm'};
 for(const [key,amount] of Object.entries(reward.items??{}))labels.push(amount+' '+(names[key]??key));
 return labels.join(' + ');
}
export function demoCheckin(c,now=Date.now()){
 const progress=checkinProgress(c,now);if(!progress.canClaim)return null;
 const reward=progress.rewards[progress.count];
 c.checkin={cycleStartDay:progress.cycleStartDay??progress.calendarDay,count:reward.day,lastDay:progress.calendarDay};
 c.qi+=reward.qi;c.totalEarned+=reward.qi;c.tickets+=reward.tickets;
 for(const [item,amount] of Object.entries(reward.items))c.inventory[item]+=amount;
 c.log.unshift('Điểm danh ngày '+reward.day+': '+dailyRewardLabel(reward));return reward;
}
export function taskBuckets(tasks,day,start='04:30'){
 const [hour,minute]=String(start).split(':').map(Number),startMinutes=hour*60+minute;
 const completionDay=at=>Math.floor((at+7*3600000-startMinutes*60000)/DAY_MS);
 const active=[],completedToday=[],history=[];
 for(const task of tasks){
  if(!task.done)active.push(task);
  else if(Number.isFinite(task.completedAt)&&Number.isInteger(day)&&completionDay(task.completedAt)===day)completedToday.push(task);
  else history.push(task);
 }
 return {active,completedToday,history};
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
 const penalty=success?0:Math.min(c.qi,breakthroughPenalties[c.rank]);
 if(!success){c.failures++;c.qi-=penalty;}
 c.log.unshift(success?'Đột phá '+target.name+' · bảo vệ 72 giờ':'Đột phá chưa thành · −'+penalty+' tu vi');
 return {success,chance,penalty};
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
 if(!globalThis.Telegram?.WebApp&&location.hash.includes('tgWebAppData')){
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';
   script.onload=resolve;script.onerror=()=>reject(Error('Không tải được Telegram SDK.'));document.head.append(script);
  });
 }
 const app=globalThis.Telegram?.WebApp;
 const theme=()=>applyTheme();
 theme();
 if(app?.initData){app.onEvent?.('themeChanged',theme);app.ready();app.expand();}
 return refreshLive();
}
export async function browserAuthRequest(action){
 const response=await fetch('/api/browser-auth/'+action,{method:'POST',credentials:'same-origin',headers:{'X-Minh-Anh-Request':'1'},signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!response.ok){const error=Error(data.message??(data.error==='LOGIN_EXPIRED'?'Mã đã hết hạn. Tạo mã mới nhé.':'Chưa đăng nhập được. Cậu thử lại nhé.'));error.code=data.error;throw error;}
 if(action==='logout')pendingRequests.clear();
 return data;
}
async function liveRequest(path,body){
 const initData=globalThis.Telegram?.WebApp?.initData;
 const key=body?path+JSON.stringify(body):null;
 let request=body;
 if(key){
  if(!pendingRequests.has(key))pendingRequests.set(key,{...body,id:crypto.randomUUID()});
  request=pendingRequests.get(key);
 }
 const response=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:{...(initData?{'X-Telegram-Init-Data':initData}:{'X-Minh-Anh-Request':'1'}),'Content-Type':'application/json'},body:body?JSON.stringify(request):undefined,signal:AbortSignal.timeout(15000)});
 const result=await response.json();
 if(!response.ok){
  if(response.status<500&&key)pendingRequests.delete(key);
  const messages={AUTH_REQUIRED:'Phiên đã hết hạn. Đóng và mở lại từ Telegram nhé.',SETUP_REQUIRED:'Chọn giờ bắt đầu và giờ nghỉ trước nhé.',STALE_TASK:'Việc vừa thay đổi. Mở lại danh sách rồi thử lại.',TASK_NOT_AVAILABLE:'Task này không còn phù hợp để thêm vào hôm nay.',NO_ACTIVE_TASK_WINDOW:'Khung làm việc này vừa kết thúc hoặc lịch đã thay đổi rồi nhé.',PLAN_CHANGED:'Kế hoạch vừa thay đổi. Mở lại rồi chỉnh trên bản mới nhé.',CONFIRM_CHILDREN:'Task còn bước chưa xong. Hãy xác nhận hoàn thành cả nhóm.',CONFIRM_REOPEN_PARENT:'Cần xác nhận mở lại task cha.',DRAW_UNAVAILABLE:'Chưa thể quay lúc này.',NO_TICKETS:'Cậu chưa có vé. Hoàn thành task hoặc điểm danh để nhận vé nhé.',ACCOUNT_SUSPENDED:'Tài khoản tạm ngưng do ba ngày không chat. Nhắn cho Minh Anh để hoạt động lại; đây không phải chế độ /ngu.',NO_ACTIVE_DAY:'Cậu đã lưu giờ sinh hoạt. Ngày hoạt động tiếp theo chưa bắt đầu; không cần thiết lập lại.',BREAKTHROUGH_UNAVAILABLE:'Chưa đủ điều kiện hoặc hôm nay đã thử đột phá.',FUSION_UNAVAILABLE:'Chưa đủ ba phù cùng cấp.',ITEM_UNAVAILABLE:'Vật phẩm chưa dùng được lúc này.',ALREADY_PROTECTED:'Hôm nay đã kích hoạt bảo vệ rồi.',NO_NEXT_REMINDER:'Không còn lần nhắc sắp tới để sửa.'};
  const timelineErrors={TIMELINE_CHANGED:'Lịch vừa thay đổi. Đóng hộp và mở lại lịch trước khi kéo nhé.',TIMELINE_BLOCKED:'Giờ đó đã qua, đang bận hoặc ngoài khung làm việc. Chưa đổi lịch.',TIMELINE_NO_ROOM:'Không đủ chỗ cho các việc phía sau. Chưa lưu lần kéo này; hãy điều chỉnh khoảng rảnh hoặc thời lượng.',TIMELINE_DEADLINE:'Cách xếp này vượt deadline. Chưa đổi lịch.',TIMELINE_UNDO_EXPIRED:'Đã hết thời gian hoàn tác. Cậu vẫn có thể chỉnh giờ trực tiếp.',INVALID_TIMELINE_MOVE:'Chọn giờ tương lai theo nấc 5 phút nhé.'};
  const checkinErrors={ALREADY_CHECKED_IN:'Cậu đã nhận quà hôm nay rồi. Hẹn cậu ngày mai nhé.',CHECKIN_COMPLETE:'Đã nhận đủ 30 phần quà. Chu kỳ tiếp theo bắt đầu sau khi đủ 32 ngày.'};
  const error=Error(result.message??checkinErrors[result.error]??timelineErrors[result.error]??messages[result.error]??'Chưa xác nhận được kết quả. Kiểm tra lại trước khi thao tác mới.');error.code=result.error;throw error;
 }
 return result;
}
function mapTask(t,completions=new Map()){
 const completedAt=t.completed_at??t.completedAt??completions.get(t.id)??null;
 return {id:t.id,code:t.public_code??t.code,title:t.title,note:t.note??'',version:t.version,deadline:t.deadline??'',done:t.status==='completed'||t.done===true,completedAt,archivedAt:t.archived_at??null,actualMinutes:Number(t.actual_minutes??t.actualMinutes??0),remainingMinutes:t.remaining_minutes??t.remainingMinutes??null,steps:(t.steps??[]).map(s=>({id:s.id,code:s.code??((t.public_code??t.code)+'.'+s.step_code),title:s.title,done:s.status==='completed'||s.done===true,version:s.version}))};
}
export async function historyPage(offset=0){
 const response=await liveRequest('history?offset='+Math.max(0,Math.floor(offset)));
 const page=response.result??{};
 return {items:(page.items??[]).map(item=>mapTask(item)),offset:Number(page.offset??offset),limit:Number(page.limit??20),total:Number(page.total??0),hasMore:!!page.hasMore};
}
export async function refreshLive(){
 const data=await liveRequest('bootstrap');
 const c=data.account.state;
 const completions=new Map(data.progress.completions.map(item=>[item.task_id,item.completed_at]));
 const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 let history={items:[],offset:0,limit:20,total:0,hasMore:false};
 try{history=await historyPage(0);}catch{/* Older deployments may not expose the paged history endpoint yet. */}
 const baseTasks=data.tasks.map(t=>mapTask(t,completions));
 for(const item of history.items)if(!baseTasks.some(task=>task.id===item.id))baseTasks.push(item);
 return {
  live:true,loaded:true,checkin:data.checkin,breakthroughPenalties:data.breakthroughPenalties,resting:data.resting,rest:data.rest,needsSetup:data.needsSetup,serverNow:data.now,settingsVersion:data.settings?.version??0,
  start:clock(data.settings?.start_minutes??270),sleep:data.settings?.sleep_minutes===null||!data.settings?'':clock(data.settings.sleep_minutes),autoPlanDelayMinutes:Number(data.settings?.auto_plan_delay_minutes??180),
  tasks:baseTasks,historyOffset:history.offset+history.items.length,historyHasMore:history.hasMore,historyTotal:history.total,historyLoading:false,
  reminders:data.reminders.map(r=>({...r,times:r.times.join(', '),start:r.startDate,end:r.endDate??''})),
  cultivation:{...c,totalEarned:c.earned,active:{heart:c.heartDay===data.day?.day,peace:c.peaceDay===data.day?.day},log:[],rewardedTasks:[]},
  day:data.day,operatingDay:data.day?.day??null,dailyPlan:data.dailyPlan,taskFocus:data.taskFocus??null,taskFocusTarget:data.taskFocusTarget??null,timeline:data.timeline,loadedAt:Date.now(),progress:data.progress,sessions:data.sessions,events:data.events
 };
}
export async function liveMutation(path,input){const result=await liveRequest(path,input);const refreshed=await refreshLive();pendingRequests.delete(path+JSON.stringify(input));return {result,...refreshed};}
