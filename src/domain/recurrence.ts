import {DAY_MS,minutes} from './healthy.ts';
export type RecurrenceRule={id:string;owner:string;title:string;kind:'once'|'daily'|'weekdays';times:string[];weekdays:number[];startDate:string;endDate:string|null;enabled:boolean;version:number};
export type Occurrence={id:string;ruleId:string;owner:string;version:number;slot:string;due:number};
function date(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('INVALID_RECURRENCE_DATE');
 const n=Date.parse(value+'T00:00:00Z');
 if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==value)throw Error('INVALID_RECURRENCE_DATE');
 return n;
}
export function validateRule(rule:RecurrenceRule){
 if(!rule.id||rule.id.length>100||!/^\d+$/.test(rule.owner)||!rule.title.trim()||rule.title.length>160||!Number.isInteger(rule.version)||rule.version<1)throw Error('INVALID_RULE');
 if(!['once','daily','weekdays'].includes(rule.kind)||rule.times.length<1||rule.times.length>8||new Set(rule.times).size!==rule.times.length)throw Error('INVALID_REPEAT');
 rule.times.forEach(minutes);
 const start=date(rule.startDate);
 if(rule.endDate!==null&&date(rule.endDate)<start)throw Error('INVALID_RULE_END');
 if(rule.kind==='weekdays'&&(!rule.weekdays.length||rule.weekdays.some(n=>!Number.isInteger(n)||n<1||n>7)||new Set(rule.weekdays).size!==rule.weekdays.length))throw Error('INVALID_WEEKDAYS');
}
export function occurrences(rule:RecurrenceRule,from:number,to:number):Occurrence[]{
 validateRule(rule);
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>32*DAY_MS)throw Error('INVALID_OCCURRENCE_WINDOW');
 if(!rule.enabled)return [];
 const result:Occurrence[]=[];
 const first=Math.floor((from+7*3600000)/DAY_MS),last=Math.floor((to+7*3600000)/DAY_MS);
 for(let day=first;day<=last;day++){
  const current=new Date(day*DAY_MS),ymd=current.toISOString().slice(0,10);
  if(ymd<rule.startDate||rule.endDate!==null&&ymd>rule.endDate||rule.kind==='once'&&ymd!==rule.startDate)continue;
  const weekday=current.getUTCDay()||7;
  if(rule.kind==='weekdays'&&!rule.weekdays.includes(weekday))continue;
  for(const time of rule.times){
   const due=day*DAY_MS-7*3600000+minutes(time)*60000;
   if(due<from||due>=to)continue;
   const slot=ymd+'T'+time;
   result.push({id:rule.id+':'+rule.version+':'+slot,ruleId:rule.id,owner:rule.owner,version:rule.version,slot,due});
  }
 }
 return result.sort((a,b)=>a.due-b.due||a.id.localeCompare(b.id));
}
