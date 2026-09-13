import type {Env} from '../config/env.ts';
import {verifyMiniApp} from '../adapters/telegram/mini-app-auth.ts';
import {HealthyStore} from '../adapters/d1/healthy-store.ts';
import {RecurrenceStore} from '../adapters/d1/recurrence-store.ts';
import {ScheduleStore} from '../adapters/d1/schedule-store.ts';
import {D1WorkStore} from '../adapters/d1/work-store.ts';
import {canAct} from '../domain/session.ts';
import {sessionStatements} from '../adapters/d1/session-store.ts';
import {query} from '../adapters/d1/database.ts';
import {breakthrough,drawReward,fuseCharm,useProtection,operatingDay,REALMS,LOOT,CHARMS,type Charm} from '../domain/healthy.ts';

const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
export async function miniAppApi(request:Request,env:Env,now=Date.now()):Promise<Response>{
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return json({error:'NOT_FOUND'},404);
 if(!['GET','POST'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
 const origin=request.headers.get('Origin');
 if(origin&&origin!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'FORBIDDEN'},403);
 let owner:string;
 try{owner=(await verifyMiniApp(request.headers.get('X-Telegram-Init-Data')??'',env.TELEGRAM_BOT_TOKEN??'',env.TELEGRAM_USER_ID,now)).owner;}
 catch{return json({error:'AUTH_REQUIRED',message:'Mở lại từ Telegram để tiếp tục.'},401);}
 try{
  const healthy=new HealthyStore(env.DB);
  if(request.method==='GET'&&url.pathname==='/api/bootstrap'){
   const work=new D1WorkStore(env.DB),rules=new RecurrenceStore(env.DB);
   const [account,tasks,reminders,settings,progress,sessions,events,day]=await Promise.all([
    healthy.read(owner),work.hierarchy(owner),rules.rules(owner),
    query(env.DB,'SELECT start_minutes,sleep_minutes,version FROM schedule_settings WHERE owner=?',owner).first(),work.progress(owner),work.sessions(owner,Math.floor((now+25200000)/86400000)*86400000-25200000,Math.floor((now+25200000)/86400000)*86400000-25200000+86400000),work.events(owner,Math.floor((now+25200000)/86400000)*86400000-25200000,Math.floor((now+25200000)/86400000)*86400000-25200000+86400000),new ScheduleStore(env.DB).ensureDay(owner,now)
   ]);
   const appointments=(await query(env.DB,"SELECT a.id,a.version,a.due,a.status,COALESCE(a.subject,t.title) AS title FROM task_appointments a LEFT JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner WHERE a.owner=? AND a.status='active' AND (a.task_id IS NULL OR t.deleted_at IS NULL) ORDER BY a.due LIMIT 200",owner).all<{id:string;version:number;due:number;status:string;title:string}>()).results;
   const combined=[...reminders,...appointments.map(a=>{const local=new Date(a.due+25200000).toISOString();return {id:a.id,origin:'appointment',title:a.title,version:a.version,kind:'once',times:[local.slice(11,16)],weekdays:[],startDate:local.slice(0,10),endDate:null,enabled:true};})];
   const rest=await new ScheduleStore(env.DB).restStatus(owner,now);
   return json({now,account,tasks,reminders:combined,settings,progress,sessions,events,day,rest,resting:rest.reason!=='active',realms:REALMS,loot:LOOT,charms:CHARMS,needsSetup:!settings});
  }
  if(request.method!=='POST'||!['/api/cultivation','/api/tasks','/api/settings','/api/reminders','/api/schedule','/api/reminder-instance','/api/tasks-delete','/api/session'].includes(url.pathname))return json({error:'NOT_FOUND'},404);
  // Read a bounded body, including chunked requests.
  const reader=request.body?.getReader();if(!reader)return json({error:'INVALID_REQUEST'},400);
  const decoder=new TextDecoder('utf-8',{fatal:true});let raw='',bytes=0;
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096){await reader.cancel();return json({error:'TOO_LARGE'},413);}raw+=decoder.decode(part.value,{stream:true});}
  raw+=decoder.decode();
  const input=JSON.parse(raw) as Record<string,unknown>;
  if(!input||Array.isArray(input)||typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.id))return json({error:'INVALID_REQUEST'},400);
  if(url.pathname==='/api/reminder-instance'){
   if(Object.keys(input).some(k=>!['id','ruleId','operation','due'].includes(k))||typeof input.ruleId!=='string'||!['skip','move'].includes(String(input.operation)))return json({error:'INVALID_REQUEST'},400);
   if(input.operation==='move'&&(!Number.isFinite(input.due)||Number(input.due)<=now||Number(input.due)>now+32*86400000))return json({error:'INVALID_REQUEST'},400);
   const next=await new RecurrenceStore(env.DB).next(owner,input.ruleId,now);
   const result=await healthy.mutate(owner,input.id,'reminder-instance',input,now,state=>{
    if(!next)throw Error('NO_NEXT_REMINDER');
    const statements=[
     query(env.DB,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id WHERE o.id=? AND o.owner=? AND o.rule_version=? AND o.status IN ('scheduled','queued') AND r.version=o.rule_version AND r.enabled=1 AND NOT EXISTS(SELECT 1 FROM outbox b WHERE b.id='recurring:'||o.id AND b.state IN('sending','sent','uncertain'))) THEN 1 ELSE 0 END",next.id,owner,next.rule_version),
     query(env.DB,"UPDATE outbox SET state='failed' WHERE id=? AND state='pending'",'recurring:'+next.id),
     query(env.DB,input.operation==='skip'?"UPDATE recurrence_occurrences SET status='cancelled' WHERE id=? AND owner=?":"UPDATE recurrence_occurrences SET status='scheduled',due=? WHERE id=? AND owner=?",...(input.operation==='skip'?[next.id,owner]:[Number(input.due),next.id,owner]))
    ];
    // A moved occurrence keeps its logical ID and rule slot; remove its unsent
    // cancelled delivery so the dispatcher may queue the new due time.
    if(input.operation==='move')statements.push(query(env.DB,"DELETE FROM outbox WHERE id=? AND state='failed' ",'recurring:'+next.id));
    return {state,result:{changed:true,slot:next.slot},statements};
   });
   return json({result});
  }
  if(url.pathname==='/api/tasks-delete'){
   if(Object.keys(input).some(k=>!['id','items','confirm'].includes(k))||input.confirm!==true||!Array.isArray(input.items)||input.items.some(t=>!t||typeof t!=='object'||Object.keys(t).some(k=>!['id','version'].includes(k))||typeof t.id!=='string'||!Number.isInteger(t.version)))return json({error:'INVALID_REQUEST'},400);
   return json({result:await new D1WorkStore(env.DB).deleteHierarchyGroup(owner,input.id,input.items,now)});
  }
  if(url.pathname==='/api/schedule'){
   if(Object.keys(input).some(k=>!['id','version','free','busy','estimates'].includes(k))||!Number.isInteger(input.version)||!Array.isArray(input.free)||!Array.isArray(input.busy)||!Array.isArray(input.estimates)||input.estimates.length>100)return json({error:'INVALID_REQUEST'},400);
   for(const r of [...input.free,...input.busy])if(!r||typeof r!=='object'||Object.keys(r).some(k=>!['start','end'].includes(k))||!Number.isFinite(r.start)||!Number.isFinite(r.end))return json({error:'INVALID_REQUEST'},400);
   const work=new D1WorkStore(env.DB);
   const tasks=[];
   for(const estimate of input.estimates){
    if(!estimate||typeof estimate!=='object'||Object.keys(estimate).some(k=>!['id','minutes'].includes(k))||typeof estimate.id!=='string'||!Number.isInteger(estimate.minutes))return json({error:'INVALID_REQUEST'},400);
    const task=await work.task(owner,estimate.id);
    if(!task||task.status==='completed')return json({error:'STALE_TASK'},409);
    tasks.push({id:task.id,status:'active' as const,deleted:false,deadline:task.deadline?Date.parse(task.deadline.length===10?task.deadline+'T23:59:59+07:00':task.deadline):null,remainingMinutes:estimate.minutes as number});
   }
   const prepared=await work.prepareSchedule(owner,now,Number(input.version),input.free,input.busy,tasks.map(t=>({id:t.id,minutes:t.remainingMinutes})),input.id);
   const result=await healthy.mutate(owner,input.id,'schedule',input,now,state=>({state,result:prepared.plan,statements:prepared.statements}));
   return json({result});
  }
  if(url.pathname==='/api/session'){
   if(Object.keys(input).some(k=>!['id','sessionId','version','action'].includes(k))||typeof input.sessionId!=='string'||!Number.isInteger(input.version)||!['start','pause','finish','skip','snooze'].includes(String(input.action)))return json({error:'INVALID_REQUEST'},400);
   const session=await new D1WorkStore(env.DB).session(owner,input.sessionId);
   const result=await healthy.mutate(owner,input.id,'session-action',input,now,state=>{
    if(!session||session.version!==input.version||!canAct(session,String(input.action),now))throw Error('SESSION_CHANGED');
    return {state,result:{updated:true},statements:sessionStatements(env.DB,owner,{type:'session-action',session,action:input.action as 'start'|'pause'|'finish'|'skip'|'snooze',now})};
   });
   return json({result});
  }
  if(url.pathname==='/api/settings'){
   if(Object.keys(input).some(k=>!['id','start','sleep','version'].includes(k))||typeof input.start!=='string'||typeof input.sleep!=='string'||!Number.isInteger(input.version))return json({error:'INVALID_REQUEST'},400);
   await new ScheduleStore(env.DB).configure(owner,input.start,input.sleep,Number(input.version),now,input.id);
   return json({saved:true});
  }
  if(url.pathname==='/api/reminders'){
   if(Object.keys(input).some(k=>!['id','rule'].includes(k))||!input.rule||typeof input.rule!=='object'||Array.isArray(input.rule))return json({error:'INVALID_REQUEST'},400);
   const rule=input.rule as Record<string,unknown>;
   if(Object.keys(rule).some(k=>!['id','origin','title','kind','times','weekdays','startDate','endDate','enabled','version'].includes(k))
    ||typeof rule.title!=='string'||typeof rule.kind!=='string'||typeof rule.startDate!=='string'
    ||!Array.isArray(rule.times)||rule.times.some(t=>typeof t!=='string')||!Array.isArray(rule.weekdays)||rule.weekdays.some(n=>!Number.isInteger(n))
    ||typeof rule.enabled!=='boolean'||!Number.isInteger(rule.version)||Number(rule.version)<0
    ||rule.endDate!==null&&typeof rule.endDate!=='string'||rule.id!==undefined&&typeof rule.id!=='string')return json({error:'INVALID_REQUEST'},400);
   if(rule.origin==='appointment'){
    if(typeof rule.id!=='string'||rule.kind!=='once'||rule.times.length!==1||!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(rule.times[0]))||!/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate))return json({error:'INVALID_REQUEST'},400);
    const due=Date.parse(rule.startDate+'T'+rule.times[0]+':00+07:00');
    if(!Number.isFinite(due)||rule.enabled&&due<=now||new Date(Date.parse(rule.startDate+'T00:00:00Z')).toISOString().slice(0,10)!==rule.startDate)return json({error:'INVALID_REQUEST'},400);
    const result=await healthy.mutate(owner,input.id,'edit-chat-reminder',input,now,state=>({state,result:{updated:true},statements:[
      query(env.DB,"INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_appointments WHERE owner=? AND id=? AND version=? AND status='active') THEN 1 ELSE 0 END",owner,rule.id as string,Number(rule.version)),
      ...(rule.enabled?[query(env.DB,"INSERT INTO task_appointments(id,owner,task_id,due,subject,message,event_id) SELECT ?,owner,task_id,?,?,?,event_id FROM task_appointments WHERE owner=? AND id=?",'edited_'+input.id,due,String(rule.title),String(rule.title)+' · đến giờ cậu hẹn rồi nhé.',owner,rule.id as string)]:[]),
      query(env.DB,"UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND id=?",owner,rule.id as string)
    ]}));
    return json({result});
   }
   if(rule.origin!==undefined)return json({error:'INVALID_REQUEST'},400);
   const id=typeof rule.id==='string'?rule.id:crypto.randomUUID();
   const normalized={id,owner,title:rule.title,kind:rule.kind as 'once'|'daily'|'weekdays',times:rule.times as string[],weekdays:rule.weekdays as number[],startDate:rule.startDate,endDate:rule.endDate as string|null,enabled:rule.enabled,version:Number(rule.version)+1};
   const result=await healthy.mutate(owner,input.id,'save-rule',input,now,state=>({state,result:{id},statements:new RecurrenceStore(env.DB).saveStatements(normalized,Number(rule.version),now)}));
   return json({result});
  }
  if(url.pathname==='/api/tasks'){
   if(Object.keys(input).some(k=>!['id','operation','taskId','stepId','version','title','deadline','complete','confirm'].includes(k)))return json({error:'INVALID_REQUEST'},400);
   for(const key of ['operation','taskId','stepId','title'])if(key in input&&typeof input[key]!=='string')return json({error:'INVALID_REQUEST'},400);
   if('deadline' in input&&input.deadline!==null&&typeof input.deadline!=='string'||'version' in input&&!Number.isInteger(input.version)||'confirm' in input&&typeof input.confirm!=='boolean')return json({error:'INVALID_REQUEST'},400);
   const {id,...args}=input;
   const result=await new D1WorkStore(env.DB).mutateHierarchy(owner,String(id),args as Parameters<D1WorkStore['mutateHierarchy']>[2],now);
   return json({result});
  }
  if(Object.keys(input).some(k=>!['id','operation','item'].includes(k)))return json({error:'INVALID_REQUEST'},400);
  const operation=input.operation;
  if(!['draw','fuse','protect','breakthrough'].includes(String(operation)))return json({error:'INVALID_OPERATION'},400);
  const settings=await query(env.DB,'SELECT start_minutes,sleep_minutes FROM schedule_settings WHERE owner=?',owner).first<{start_minutes:number;sleep_minutes:number|null}>();
  if(!settings||settings.sleep_minutes===null)return json({error:'SETUP_REQUIRED'},409);
  const activeDay=await new ScheduleStore(env.DB).ensureDay(owner,now);
  const day=activeDay?.day??operatingDay(now,settings.start_minutes),random=()=>crypto.getRandomValues(new Uint32Array(1))[0]!/4294967296;
  const item=input.item;
  if(operation==='protect'&&!['heart','peace'].includes(String(item)))return json({error:'INVALID_ITEM'},400);
  if(operation==='fuse'&&(!Object.hasOwn(CHARMS,String(item))||item==='supreme'))return json({error:'INVALID_ITEM'},400);
  if(operation==='breakthrough'&&item!==undefined&&item!==null&&!Object.hasOwn(CHARMS,String(item)))return json({error:'INVALID_ITEM'},400);
  const result=await healthy.mutate<Record<string,unknown>>(owner,input.id,String(operation),input,now,state=>{
   if(state.suspended)throw Error('ACCOUNT_SUSPENDED');
   if(operation==='draw'&&state.tickets<1)throw Error('NO_TICKETS');
   if(operation==='draw'){const r=drawReward(state,random());return {state:r.state,result:{reward:r.reward}};}
   if(operation==='fuse'){const r=fuseCharm(state,item as Charm,random());return {state:r.state,result:{success:r.success}};}
   if(operation==='protect')return {state:useProtection(state,item as 'heart'|'peace',day),result:{protected:true}};
   const r=breakthrough(state,day,now,item as Charm|null??null,random());return {state:r.state,result:{success:r.success,chance:r.chance}};
  });
  return json({result,account:await healthy.read(owner)});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  if(['NO_ACTIVE_DAY','NO_TICKETS','ACCOUNT_SUSPENDED','DRAW_UNAVAILABLE','FUSION_UNAVAILABLE','ITEM_UNAVAILABLE','BREAKTHROUGH_UNAVAILABLE','ALREADY_PROTECTED','REQUEST_ID_REUSED','STALE_TASK','CONFIRM_CHILDREN','CONFIRM_REOPEN_PARENT','CONFIRM_DELETE','STEP_NOT_FOUND','NO_NEXT_REMINDER','SESSION_CHANGED'].includes(code))return json({error:code},409);
  if(code.startsWith('INVALID_'))return json({error:'INVALID_REQUEST'},400);
  if(error instanceof SyntaxError)return json({error:'INVALID_REQUEST'},400);
  return json({error:'OPERATION_NOT_CONFIRMED',message:'Chưa xác nhận được kết quả. Kiểm tra lại trước khi thử hành động mới.'},503);
 }
}
