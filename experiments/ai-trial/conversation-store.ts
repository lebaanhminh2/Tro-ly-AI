import {ConversationStore as NativeStore} from '../../src/adapters/d1/conversation-store.ts';
import {query,type Database} from '../../src/adapters/d1/database.ts';
import {parseConversation,type ConversationIntent} from './conversation.ts';
export class ConversationStore extends NativeStore {
 private legacyDb:Database;
 constructor(db:Database){super(db);this.legacyDb=db;}
 async infer(owner:string,updateId:number,now:number,generate:()=>Promise<ConversationIntent>,metadata?:{model:string;promptVersion:string;source:'model'|'continuation'}){
  if(metadata&&(!/^[\w.-]{1,100}$/.test(metadata.model)||!/^[\w.-]{1,100}$/.test(metadata.promptVersion)))throw Error('INVALID_INFERENCE_METADATA');
  const row=await query(this.legacyDb,'SELECT state,envelope FROM conversation_receipts WHERE owner=? AND update_id=?',owner,updateId).first<{state:string;envelope:string|null}>();
  if(row?.state==='ready'&&row.envelope)return parseConversation(row.envelope);
  if(row)throw Error('INFERENCE_ALREADY_ATTEMPTED');
  const accepted=await query(this.legacyDb,"INSERT OR IGNORE INTO conversation_receipts(owner,update_id,state,created,model,prompt_version,inference_source) VALUES(?,?,'started',?,?,?,?)",owner,updateId,now,metadata?.model??null,metadata?.promptVersion??null,metadata?.source??null).run();
  if(!accepted.meta.changes)throw Error('INFERENCE_ALREADY_ATTEMPTED');
  const started=Date.now();
  try{
   const value=parseConversation(JSON.stringify(await generate()));
   await query(this.legacyDb,"UPDATE conversation_receipts SET state='ready',envelope=?,inference_ms=? WHERE owner=? AND update_id=? AND state='started'",JSON.stringify(value),Math.max(0,Date.now()-started),owner,updateId).run();
   return value;
  }catch{
   await query(this.legacyDb,"UPDATE conversation_receipts SET state='failed',inference_ms=? WHERE owner=? AND update_id=? AND state='started'",Math.max(0,Date.now()-started),owner,updateId).run();
   throw Error('INFERENCE_UNAVAILABLE');
  }
 }
}
