import type { GeminiTrial } from './gemini.ts';
import type { Task as StoredTask } from '../../src/domain/work.ts';
import { decide } from './policy.ts';
import {buildContext} from '../../src/application/context-builder.ts';
import type {ChatService} from '../../src/application/plan-command.ts';

export type Chat = (owner: string, text: string, tasks: StoredTask[]) => Promise<string>;
// Dependency injected for offline tests. No key discovery, no default network client.
// Not enabled in production entrypoint until live/data approval and persistent quota exist.
export function trialChat(client: Pick<GeminiTrial, 'generate'>): Chat {
  return async (owner, text, tasks) => {
    const turns = [{ role: 'user' as const, text }];
    const result = await client.generate(turns, JSON.stringify({ userId: owner, tasks }), tasks.map(t => t.id));
    const decision = decide(result.output, turns, { userId: owner,
      entities: tasks.map(t => ({ id: t.id, ownerId: t.owner, type: 'task' as const })) });
    if (decision.pending) return 'Để ghi hoặc sửa việc, cậu dùng /add hoặc /tasks nhé. Chưa có thay đổi nào được lưu từ câu chat này.';
    return decision.text;
  };
}

// Inject a project/model quota reservation; never load keys automatically.
export function contextualChat(client:Pick<GeminiTrial,'generate'>,reserve:(key:string,now:number)=>Promise<boolean>):ChatService{
 return async(owner,text,_tasks,input,store,now)=>{
  if(!input||!store||now===undefined)throw Error('MISSING_CHAT_CONTEXT');
  const built=await buildContext(store,owner,text,now);
  if(!await reserve(`${owner}:${input.updateId}`,now))return 'Lượt hội thoại đang tạm giới hạn. /tasks và các nút vẫn dùng được nhé.';
  const {output}=await client.generate(built.turns,built.context,built.tasks.map(t=>t.id));
  if(output.draft?.operation==='capture_task'&&text.includes(output.draft.value)&&output.draft.value.length<=160){
   const id=`p${owner}_${input.updateId}`;
   return {view:{text:`Ghi việc “${output.draft.value}” nhé?`,buttons:[[{text:'Xác nhận',callback_data:`yes:${id}`},{text:'Thôi',callback_data:`no:${id}`}]]},
    changes:[{type:'propose',proposal:{id,owner,task_id:`t${owner}_${input.updateId}`,operation:'capture',value:output.draft.value,expected_version:0,expires:now+300000,status:'pending'}}]};
  }
  const decision=decide(output,[{role:'user',text}],{userId:owner,entities:built.tasks.map(t=>({id:t.id,ownerId:owner,type:'task' as const}))});
  if(output.draft?.operation==='update_task')return {view:{text:'Cậu chọn việc và thông tin muốn sửa bằng nút nhé; chưa có thay đổi nào được lưu.',buttons:built.tasks.map(t=>[{text:`Hạn: ${t.title}`,callback_data:`deadline:${t.id}`}])},changes:[]};
  return decision.text;
 };
}
