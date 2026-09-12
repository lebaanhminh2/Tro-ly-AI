import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationDeadline,parseConversation,directRequest,unsupportedSuccessClaim} from '../../src/domain/conversation.ts';
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
