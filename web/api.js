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
 {name:'Nguyên Anh',qi:75,days:7},{name:'Hóa Thần',qi:120,days:10},
 {name:'Luyện Hư',qi:180,days:14},{name:'Hợp Thể',qi:260,days:18},
 {name:'Đại Thừa',qi:360,days:21},{name:'Độ Kiếp',qi:500,days:30}
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
