import type {WorkReader} from '../ports/work-store.ts';
type Turn={role:'user'|'model';text:string};
export async function buildContext(store:WorkReader,owner:string,text:string,now:number){
 const [focus,memories,history]=await Promise.all([store.focus(owner,now),store.memories(owner,now),store.history(owner,now)]);
 const [focused,mentioned]=await Promise.all([focus?store.task(owner,focus):Promise.resolve(null),store.conversationTasks?.(owner,text)??Promise.resolve([])]);
 const candidates=[...mentioned,...(focused?[focused]:[])];
 const tasks=candidates.length?[...new Map(candidates.map(t=>[t.id,t])).values()]:await store.tasks(owner,0);
 const turns:Turn[]=history.flatMap(h=>[{role:'user' as const,text:h.user_text},{role:'model' as const,text:h.assistant_text}]);
 turns.push({role:'user',text});
 const context=JSON.stringify({userId:owner,now:new Date(now).toISOString(),timezone:'Asia/Ho_Chi_Minh',focus,
 tasks:tasks.map(t=>({id:t.id,title:t.title,deadline:t.deadline,version:t.version,status:t.status??'active'})),
 memories:memories.map(m=>({content:m.content,kind:m.kind,source:m.source,expires:m.expires}))});
 while(turns.length>1&&context.length+turns.reduce((n,t)=>n+t.text.length,0)>10000)turns.splice(0,2);
 if(context.length+text.length>14000)throw Error('CONTEXT_TOO_LARGE');
 return {turns,context,tasks};
}
