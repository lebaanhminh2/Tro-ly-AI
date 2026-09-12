import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationDeadline,parseConversation,directRequest,unsupportedSuccessClaim} from '../../experiments/ai-trial/conversation.ts';
import {runToolTurn} from '../../src/application/conversation-command.ts';
import type {ToolCall,ModelStep} from '../../src/ai/contracts.ts';

test('tool turn reads then writes once, commits before final response and survives final model failure',async()=>{
 const read:ToolCall={name:'find_tasks',args:{query:'bài',status:'active',cursor:0}};
 const write:ToolCall={name:'update_task',args:{task_id:'t',expected_version:1,patch:{status:'completed'}}};
 const step=(call:ToolCall):ModelStep=>({content:{role:'model',parts:[{functionCall:call,thoughtSignature:'keep'}]},calls:[call],text:''});
 const events:string[]=[];
 const text=await runToolTurn([{role:'user',parts:[{text:'Xong bài rồi'}]}],{
  model:async(n,contents,allow)=>{events.push(`model:${n}`);if(n===0)return step(read);if(n===1){assert.equal(contents.at(-1)!.role,'user');return step(write);}assert.equal(allow,false);throw Error('quota');},
  execute:async(_n,call)=>{events.push(call.name);return {result:{status:isRead(call)?'ok':'planned'},changes:isRead(call)?[]:[{type:'cancel',owner:'123'}],fallback:'Đã hoàn thành bài.'};},
  commit:async()=>{events.push('commit');return {status:'applied'};}
 });
 assert.equal(text,'Đã hoàn thành bài.');assert.deepEqual(events,['model:0','find_tasks','model:1','update_task','commit']);
 function isRead(call:ToolCall){return call.name==='find_tasks';}
});

test('tool turn rejects parallel writes before executing any mutation',async()=>{
 const calls:ToolCall[]=[{name:'create_task',args:{title:'a',deadline:null}},{name:'create_task',args:{title:'b',deadline:null}}];
 let executions=0;
 const result=await runToolTurn([{role:'user',parts:[{text:'test'}]}],{
  model:async()=>({content:{role:'model',parts:[]},calls,text:''}),
  execute:async()=>{executions++;throw Error('must not execute');},commit:async()=>{throw Error('must not commit');}
 });
 assert.equal(executions,0);assert.match(result,/nhiều thay đổi/);
});
test('conversation date precision preserves date-only and relative dates use Vietnam midnight',()=>{
 const now=Date.parse('2026-09-12T23:55:00+07:00');
 assert.deepEqual(conversationDeadline('ngày mai',now),{value:'2026-09-13',precision:'date'});
 assert.deepEqual(conversationDeadline('mai 9h',now),{value:'2026-09-13T09:00:00+07:00',precision:'datetime'});
 assert.equal(conversationDeadline('31/02/2027',now),null);
 assert.equal(conversationDeadline('mai 25h',now),null);
 assert.equal(conversationDeadline('hôm nay 9h',now),null);
 assert.equal(conversationDeadline('thứ sáu',now),null); // Unsupported ambiguity is not guessed.
});
test('typed intent rejects unknown execution fields and ungrounded or tentative requests',()=>{
 const text='Tớ có bài tiếng Anh, deadline ngày mai';
 const intent=parseConversation(JSON.stringify({kind:'capture',reply:'ok',title:'bài tiếng Anh',taskId:null,deadlineText:'ngày mai',evidence:text}));
 assert.equal(directRequest(text,intent),true);
 assert.equal(directRequest('Ví dụ: '+text,intent),false);
 assert.equal(directRequest('Đừng thêm. '+text,intent),false);
 assert.equal(directRequest('chào',intent),false);
 assert.throws(()=>parseConversation(JSON.stringify({...intent,execute:true})));
 assert.throws(()=>parseConversation(JSON.stringify({...intent,kind:'chat'})));
});

test('completion never treats unfinished or partial work as a completed task',()=>{
 for(const text of ['Tớ chưa làm xong bài tiếng Anh','Tớ xong một phần bài tiếng Anh','Xong buổi làm bài tiếng Anh','Xong rồi']){
  assert.equal(directRequest(text,{kind:'complete',reply:'unused',title:null,taskId:'t',deadlineText:null,evidence:text}),false);
 }
 const text='Tớ làm xong bài tiếng Anh rồi';
 assert.equal(directRequest(text,{kind:'complete',reply:'unused',title:null,taskId:'t',deadlineText:null,evidence:text}),true);
});
test('social reply guard catches common uncommitted success claims without blocking ordinary conversation',()=>{
 for(const reply of ['Tớ ghi bài này rồi nhé.','Đã thêm việc cho cậu.','Tớ đã dời lịch sang mai rồi.'])assert.equal(unsupportedSuccessClaim(reply),true);
 for(const reply of ['ừ, kể tớ nghe tiếp đi','Cậu làm xong rồi à?','Tớ chưa lưu gì cả.'])assert.equal(unsupportedSuccessClaim(reply),false);
});
