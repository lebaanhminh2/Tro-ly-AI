import {toolResponse,type ModelContent,type ModelStep,type ToolCall} from '../ai/contracts.ts';
import {isReadTool} from '../ai/policy.ts';
import type {ToolOutcome} from './tool-executor.ts';

export type ToolTurnPorts={
 // Caller journals each model step and tool outcome; this loop never retries implicitly.
 model:(step:number,contents:ModelContent[],allowTools:boolean)=>Promise<ModelStep>;
 execute:(step:number,call:ToolCall)=>Promise<ToolOutcome>;
 commit:(step:number,call:ToolCall,outcome:ToolOutcome)=>Promise<Record<string,unknown>>;
 batch?:(calls:ToolCall[],message:string)=>Promise<string>;
};
export async function runToolTurn(initial:ModelContent[],ports:ToolTurnPorts):Promise<string>{
 const contents=[...initial];let reads=0,wrote=false,fallback='Hội thoại đang gián đoạn, tớ chưa thực hiện thay đổi nào.';
 for(let step=0;step<2;step++){
  let response:ModelStep;
  try{response=await ports.model(step,contents,!wrote);}catch(error){
   const code=error instanceof Error?error.message:'';
   if(code==='AI_QUOTA')return 'Tớ đã chạm giới hạn gọi AI do bot đặt cho hôm nay. Lời nhắc đã lưu vẫn chạy; khi có lượt trở lại mình trò chuyện tiếp nhé.';
   if(code==='AI_TRIAL_ENDED')return 'Đợt dùng thử AI đã hết thời hạn cấu hình. Các lời nhắc đã lưu vẫn chạy; cần mở lại thời hạn trước khi chat tiếp.';
   return fallback;
  }
  const replies=response.calls.filter(call=>call.name==='respond');
  if(replies.length>1)return 'Tớ chưa xử lý được lượt này, cậu nhắn lại giúp tớ nhé.';
  if(replies.length){
   const args=replies[0]!.args;
   if(Object.keys(args).length!==1||typeof args.message!=='string'||!args.message.trim()||args.message.length>4000)return fallback;
   const originalCalls=response.calls;
   const mapped=originalCalls.filter(call=>call.name!=='respond').map(call=>{
    const target=call.args.task_id;
    if(typeof target!=='string'||!/^@\d+$/.test(target))return call;
    const index=Number(target.slice(1));
    if(index>=originalCalls.length||originalCalls[index]!.name!=='create_task')return call;
    const shifted=originalCalls.slice(0,index).filter(c=>c.name!=='respond').length;
    return {...call,args:{...call.args,task_id:'@'+shifted}};
   });
   response={...response,text:args.message,calls:mapped};
  }
  if(!response.calls.length)return response.text;
  const writes=response.calls.filter(call=>!isReadTool(call.name));
  if(writes.length>1&&response.calls.length===writes.length&&ports.batch){
   try{return await ports.batch(writes,response.text);}catch{return 'Tớ chưa lưu được nhóm thay đổi này. Chưa thực hiện thêm; mình kiểm tra lại nhé.';}
  }
  // Mixed reads/writes require the read result first; never execute a guessed half.
  if(writes.length>1||(writes.length&&response.calls.length>1)||wrote)return wrote?fallback:'Cậu đang yêu cầu nhiều thay đổi. Mình xử lý từng việc để tránh làm nhầm nhé.';
  if(reads+response.calls.filter(call=>isReadTool(call.name)).length>2)return 'Tớ cần thu hẹp việc đang tìm. Cậu nói rõ tên hoặc khoảng ngày giúp tớ nhé.';
  contents.push(response.content);
  const results:Record<string,unknown>[]=replies.map(call=>toolResponse(call,{status:'deferred_until_read_result'}));
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
  if(wrote)return response.text.trim()||fallback;
  contents.push({role:'user',parts:results});
 }
 return fallback;
}
