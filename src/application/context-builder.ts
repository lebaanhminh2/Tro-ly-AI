import type {WorkReader} from '../ports/work-store.ts';
type Turn={role:'user'|'model';text:string};
export async function buildContext(store:WorkReader,owner:string,text:string,now:number){
 const [focus,memories,history,summary,pending]=await Promise.all([store.focus(owner,now),store.memories(owner,now),store.history(owner,now),store.summary?.(owner)??null,store.clarifications?.(owner,now)??[]]);
 const [focused,mentioned]=await Promise.all([focus?store.task(owner,focus):Promise.resolve(null),store.conversationTasks?.(owner,text)??Promise.resolve([])]);
 const candidates=[...mentioned,...(focused?[focused]:[])];
 const active=store.findTasks?await store.findTasks(owner,'','active',0):null;
 const extra=active?.nextCursor!==null&&active?.nextCursor!==undefined?await store.findTasks!(owner,'','active',active.nextCursor):null;
 const tasks=[...new Map([...candidates,...(active?.tasks??await store.tasks(owner,0)),...(extra?.tasks??[])].map(t=>[t.id,t])).values()];
 const nextTaskCursor=extra?extra.nextCursor:active?.nextCursor??null;
 const [events,appointments,blocks]=await Promise.all([store.events?.(owner,now-86400000,now+7*86400000)??[],store.appointmentContext?.(owner,now)??[],store.sessions(owner,now-86400000,now+86400000)]);
 const turns:Turn[]=history.flatMap(h=>[{role:'user' as const,text:h.user_text},{role:'model' as const,text:h.assistant_text}]);
 turns.push({role:'user',text});
 const context=JSON.stringify({userId:owner,now:new Date(now).toISOString(),timezone:'Asia/Ho_Chi_Minh',focus,summary,clarifications:pending,events,appointments,blocks,nextTaskCursor,
 summary_request:history.filter(h=>h.command_id>(summary?.covered_through??-1)).length>=8?{through:history.at(-1)!.command_id,expected_version:summary?.version??0,source_turns:history.map(h=>({id:h.command_id,user:h.user_text,assistant:h.assistant_text}))}:null,
 tasks:tasks.map(t=>({id:t.id,title:t.title,deadline:t.deadline,version:t.version,status:t.status??'active'})),
 memories:memories.map(m=>({content:m.content,kind:m.kind,source:m.source,expires:m.expires}))});
 while(turns.length>1&&context.length+turns.reduce((n,t)=>n+t.text.length,0)>10000)turns.splice(0,2);
 if(context.length+text.length>28000)throw Error('CONTEXT_TOO_LARGE');
 return {turns,context,tasks};
}
