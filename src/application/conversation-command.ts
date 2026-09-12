import {toolResponse,type ModelContent,type ModelStep,type ToolCall} from '../ai/contracts.ts';
import {isReadTool} from '../ai/policy.ts';
import type {ToolOutcome} from './tool-executor.ts';

export type ToolTurnPorts={
 // Caller journals each model step and tool outcome; this loop never retries implicitly.
 model:(step:number,contents:ModelContent[],allowTools:boolean)=>Promise<ModelStep>;
 execute:(step:number,call:ToolCall)=>Promise<ToolOutcome>;
 commit:(step:number,call:ToolCall,outcome:ToolOutcome)=>Promise<Record<string,unknown>>;
};
export async function runToolTurn(initial:ModelContent[],ports:ToolTurnPorts):Promise<string>{
 const contents=[...initial];let reads=0,wrote=false,fallback='Hội thoại đang gián đoạn, tớ chưa thực hiện thay đổi nào.';
 for(let step=0;step<3;step++){
  let response:ModelStep;
  try{response=await ports.model(step,contents,!wrote);}catch{return fallback;}
  if(!response.calls.length)return response.text;
  const writes=response.calls.filter(call=>!isReadTool(call.name));
  // Reject the whole group before any write; never silently execute only the first mutation.
  if(writes.length>1||(writes.length&&response.calls.length>1)||wrote)return wrote?fallback:'Cậu đang yêu cầu nhiều thay đổi. Mình xử lý từng việc để tránh làm nhầm nhé.';
  if(reads+response.calls.filter(call=>isReadTool(call.name)).length>2)return 'Tớ cần thu hẹp việc đang tìm. Cậu nói rõ tên hoặc khoảng ngày giúp tớ nhé.';
  contents.push(response.content);
  const results:Record<string,unknown>[]=[];
  for(const call of response.calls){
   if(isReadTool(call.name))reads++;
   let outcome:ToolOutcome;
   try{outcome=await ports.execute(step,call);}catch{
    results.push(toolResponse(call,{status:'rejected',reason:'invalid_or_unavailable_tool'}));continue;
   }
   if(isReadTool(call.name)){results.push(toolResponse(call,outcome.result));continue;}
   if(outcome.result.status==='applied'){
    // A persisted tool result from a previous attempt is not executed again.
    wrote=true;fallback=outcome.fallback;results.push(toolResponse(call,outcome.result));continue;
   }
   if(outcome.changes.length){
    let committed:Record<string,unknown>;
    try{committed=await ports.commit(step,call,outcome);}catch{
     return 'Tớ chưa xác nhận được kết quả lưu. Kiểm tra trạng thái trước khi thực hiện lại nhé.';
    }
    if(committed.status!=='applied')return 'Thay đổi chưa được xác nhận là đã lưu.';
    wrote=true;fallback=outcome.fallback;results.push(toolResponse(call,committed));
   }else{
    fallback=outcome.fallback;results.push(toolResponse(call,outcome.result));
    if(outcome.result.status==='needs_confirmation'){
     // Pending state must be persisted by the commit port before asking the user.
     try{await ports.commit(step,call,outcome);}catch{return 'Tớ chưa lưu được đề xuất để xác nhận. Chưa có thay đổi nào được thực hiện.';}
     return fallback;
    }
   }
  }
  contents.push({role:'user',parts:results});
 }
 return fallback;
}
