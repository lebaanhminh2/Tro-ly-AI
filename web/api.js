// Prototype intentionally has no network/storage/auth. Reload restores the sample.
export function createDemo(){
 return {
  tab:'today',mode:'timeline',reminderFilter:'recurring',screenState:'ready',selected:new Set(),selecting:false,
  start:'04:30',sleep:'22:30',resting:false,
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
