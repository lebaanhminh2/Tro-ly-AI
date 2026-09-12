import type { Database, Statement } from './database.ts';
import { query } from './database.ts';
import type { WorkStore, Lease, ViewResult } from '../../ports/work-store.ts';
import type { Input, Task, Proposal, Selection, Plan } from '../../domain/work.ts';
import type { Session,Preferences } from '../../domain/session.ts';
import { sessionStatements } from './session-store.ts';
import {memoryStatements} from './memory.ts';
import type {Memory,ConversationTurn} from '../../domain/memory.ts';
import {renderView} from '../../application/ui-renderer.ts';
import {D1UiStore} from './ui-store.ts';
import {conversationStatements} from './conversation-store.ts';

export class D1WorkStore implements WorkStore {
  private db: Database;
  constructor(db: Database, privateCards = false) { this.db = db; this.cardsEnabled=privateCards; }
  private cardsEnabled:boolean;
  async conversationTasks(owner:string,text:string){
    return (await query(this.db,`SELECT * FROM tasks WHERE owner=? AND instr(lower(?),lower(title))>0 ORDER BY length(title) DESC,created DESC LIMIT 20`,owner,text).all<Task>()).results;
  }
  async sameTitleTasks(owner:string,title:string){return (await query(this.db,'SELECT * FROM tasks WHERE owner=? AND title=? ORDER BY created LIMIT 2',owner,title).all<Task>()).results;}
  conversationPending(owner:string,now:number){return query(this.db,'SELECT id,kind,draft,expires FROM conversation_pending WHERE owner=? AND expires>?',owner,now).first<import('../../domain/conversation.ts').PendingConversation>();}
  async calendarResult(lease:Lease,run:()=>Promise<import('../../domain/work.ts').View|null>,clock:import('../../ports/work-store.ts').Clock){
    if(!this.cardsEnabled||(!lease.input.text?.startsWith('/calendar')&&!lease.input.callback?.startsWith('cal-')))return run();
    const receipt=await query(this.db,'SELECT state,view_json FROM ui_calendar_receipts WHERE owner=? AND update_id=?',lease.owner,lease.input.updateId).first<{state:string;view_json:string|null}>();
    if(receipt?.state==='done')return receipt.view_json?JSON.parse(receipt.view_json):null;
    if(receipt)return {text:'Lần xử lý Calendar trước bị gián đoạn; có thể thay đổi đã được lưu. Mở /calendar để kiểm tra. Tớ không tự thực hiện lại yêu cầu này.',buttons:[]};
    const started=await query(this.db,`INSERT OR IGNORE INTO ui_calendar_receipts(owner,update_id,state)
      SELECT ?,?,'started' WHERE EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?)`,
      lease.owner,lease.input.updateId,lease.owner,lease.token,clock.now()).run();
    if(!started.meta.changes)throw Error('CALENDAR_RECEIPT_NOT_CLAIMED');
    const view=await run();
    const normalized=view?renderView(view):null;
    const saved=await query(this.db,`UPDATE ui_calendar_receipts SET state='done',view_json=? WHERE owner=? AND update_id=? AND state='started'
      AND EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?)`,
      normalized?JSON.stringify(normalized):null,lease.owner,lease.input.updateId,lease.owner,lease.token,clock.now()).run();
    if(!saved.meta.changes)throw Error('CALENDAR_RECEIPT_LEASE_EXPIRED');
    return normalized;
  }
  async prepareUi(lease:Lease,now:number){
    if(!this.cardsEnabled)return;
    const input=lease.input;
    const ui=new D1UiStore(this.db);
    if(!input.callback){
      if(input.text&&!input.text.startsWith('/')){
        const pending=(await this.sessionInput(input.owner))??await this.selection(input.owner);
        if(pending&&pending.expires>now){
          const resolved=await ui.textInput(input.owner,input.chat,now);
          if(resolved)lease.ui=resolved;
        }
      }
      return;
    }
    const resolved=input.messageId?(input.callback!.startsWith('ui:')
      ?await ui.resolve(input.owner,input.chat,input.messageId,input.callback!,now)
      :await ui.adoptReminder(input.owner,input.chat,input.messageId,input.callback!,now)):null;
    if(!resolved){
      if(input.messageId)lease.uiRecovered=await ui.recoverOnInteraction(input.owner,input.chat,input.messageId,input.callback!,now);
      lease.uiStale=true;return;
    }
    if(/^(w:|due:|cancel-input$)/.test(resolved.action.action)){
      const flow=await query(this.db,'SELECT card_id FROM ui_text_inputs WHERE owner=? AND expires>?',input.owner,now).first<{card_id:string}>();
      if(!flow||flow.card_id!==resolved.card.id){lease.uiStale=true;return;}
    }
    lease.ui=resolved;
    lease.input={...input,callback:resolved.action.action};
  }
  runningSession(owner:string){return query(this.db,"SELECT * FROM sessions WHERE owner=? AND status='running' ORDER BY start_at LIMIT 1",owner).first<Session>();}
  memory(owner:string,id:string){return query(this.db,'SELECT * FROM memories WHERE owner=? AND id=?',owner,id).first<Memory>();}
  async memories(owner:string,now:number,offset=0,limit=30){
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>30)throw Error('INVALID_PAGE');
    return (await query(this.db,'SELECT * FROM memories WHERE owner=? AND (expires IS NULL OR expires>?) ORDER BY created DESC,id DESC LIMIT ? OFFSET ?',owner,now,limit,offset).all<Memory>()).results;
  }
  memoryConfirmation(owner:string,id:string){return query(this.db,'SELECT * FROM memory_confirmations WHERE owner=? AND id=?',owner,id).first<import('../../domain/memory.ts').MemoryConfirmation>();}
  async history(owner:string,now:number){return (await query(this.db,'SELECT * FROM conversation_turns WHERE owner=? AND expires>? ORDER BY command_id DESC LIMIT 4',owner,now).all<ConversationTurn>()).results.reverse();}
  async focus(owner:string,now:number){return (await query(this.db,'SELECT task_id FROM chat_focus WHERE owner=? AND expires>?',owner,now).first<{task_id:string}>())?.task_id??null;}
  async aiEnabled(owner:string){return (await query(this.db,'SELECT enabled FROM memory_settings WHERE owner=?',owner).first<{enabled:number}>())?.enabled!==0;}
  async sessions(owner:string,start:number,end:number){return (await query(this.db,"SELECT * FROM sessions WHERE owner=? AND start_at>=? AND start_at<? AND status!='draft' ORDER BY start_at LIMIT 30",owner,start,end).all<Session>()).results;}
  session(owner:string,id:string){return query(this.db,'SELECT * FROM sessions WHERE owner=? AND id=?',owner,id).first<Session>();}
  sessionInput(owner:string){return query(this.db,'SELECT task_id,expires FROM session_input WHERE owner=?',owner).first<{task_id:string;expires:number}>();}
  preferences(owner:string){return query(this.db,'SELECT * FROM reminder_preferences WHERE owner=?',owner).first<Preferences>();}
  task(owner: string, id: string) { return query(this.db, 'SELECT * FROM tasks WHERE owner=? AND id=?', owner, id).first<Task>(); }
  async tasks(owner: string, offset: number) { return (await query(this.db, 'SELECT * FROM tasks WHERE owner=? ORDER BY created,id LIMIT 10 OFFSET ?', owner, offset).all<Task>()).results; }
  proposal(owner: string, id: string) { return query(this.db, 'SELECT * FROM proposals WHERE owner=? AND id=?', owner, id).first<Proposal>(); }
  selection(owner: string) { return query(this.db, 'SELECT * FROM selections WHERE owner=?', owner).first<Selection>(); }
  async result(owner: string, id: number): Promise<ViewResult | null> {
    const row = await query(this.db, 'SELECT result FROM command_inbox WHERE owner=? AND update_id=? AND state=?', owner, id, 'done').first<{result: string | null}>();
    return row?.result ? JSON.parse(row.result) as ViewResult : null;
  }
  async accept(input: Input, now: number, delivery: boolean) {
    const response = await query(this.db, 'INSERT OR IGNORE INTO command_inbox(owner,update_id,payload,created,delivery) VALUES(?,?,?,?,?)',
      input.owner, input.updateId, JSON.stringify(input), now, delivery ? 1 : 0).run();
    await query(this.db,`UPDATE reminders SET status='cancelled' WHERE owner=? AND ordinal=2
      AND status IN ('pending','queued') AND EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending')
      AND EXISTS(SELECT 1 FROM outbox WHERE reminder_id=reminders.session_id||':'||reminders.generation||':1' AND state IN ('sent','sending','uncertain'))`,input.owner,input.owner,input.updateId).run();
    return response.meta.changes > 0;
  }
  async pendingOwners() { return (await query(this.db, "SELECT DISTINCT owner FROM command_inbox WHERE state='pending' LIMIT 4").all<{owner: string}>()).results.map(r => r.owner); }
  async claim(owner: string, now: number): Promise<Lease | null> {
    const token = crypto.randomUUID();
    const claim = await query(this.db, `INSERT INTO owner_leases(owner,token,expires) VALUES(?,?,?)
      ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE owner_leases.expires<=?`, owner, token, now + 30000, now).run();
    if (!claim.meta.changes) return null;
    const row = await query(this.db, "SELECT payload,attempts,update_id,created FROM command_inbox WHERE owner=? AND state='pending' ORDER BY update_id LIMIT 1", owner).first<{payload:string;attempts:number;update_id:number;created:number}>();
    if (!row) { await query(this.db, 'DELETE FROM owner_leases WHERE owner=? AND token=?', owner, token).run(); return null; }
    const counted = await query(this.db, `UPDATE command_inbox SET attempts=attempts+1 WHERE owner=? AND update_id=? AND state='pending'
      AND EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=?)`, owner,row.update_id,owner,token).run();
    if (!counted.meta.changes) return null;
    return { owner, token, input: {...JSON.parse(row.payload),receivedAt:row.created} as Input, attempts: row.attempts + 1 };
  }
  async release(lease: Lease) { await query(this.db, 'DELETE FROM owner_leases WHERE owner=? AND token=?', lease.owner, lease.token).run(); }
  async commit(lease: Lease, plan: Plan, now: number) {
    // Validate and normalize before constructing any database mutation.
    plan = {...plan, view: renderView(plan.view)};
    const { owner, input, token } = lease;
    const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
    const statements: Statement[] = [q(`INSERT INTO transaction_guard(valid) SELECT CASE WHEN
      EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?) AND
      EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending') THEN 1 ELSE 0 END`, owner, token, now, owner, input.updateId)];
    for (const change of plan.changes) {
      if(change.type==='conversation-appointment'){
        if(change.owner!==owner||change.due<=now)throw Error('INVALID_APPOINTMENT');
        if(change.pendingId)statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END',owner,change.pendingId,now));
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_receipts WHERE owner=? AND update_id=? AND state='ready') AND EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END",owner,change.updateId,owner,change.taskId,change.expectedVersion));
        statements.push(q("UPDATE task_appointments SET status='cancelled' WHERE owner=? AND task_id=? AND status='active'",owner,change.taskId));
        statements.push(q('INSERT INTO task_appointments(id,owner,task_id,due) VALUES(?,?,?,?)',change.id,owner,change.taskId,change.due));
        statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?",owner,change.updateId));
      }else if(change.type==='conversation-pending'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        if(change.pending)statements.push(q('INSERT INTO conversation_pending(owner,id,kind,draft,expires) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,kind=excluded.kind,draft=excluded.draft,expires=excluded.expires',owner,change.pending.id,change.pending.kind,change.pending.draft,change.pending.expires));
        else statements.push(q('DELETE FROM conversation_pending WHERE owner=?',owner));
      }else if(change.type==='conversation-task'){
        statements.push(...conversationStatements(this.db,owner,change));
      }else if(change.type==='remember'||change.type==='forget'||change.type==='focus'||change.type==='ai-enabled'||change.type==='memory-confirm'||change.type==='memory-resolve'){
        statements.push(...memoryStatements(this.db,owner,change));
      }else if (change.type==='session-input'||change.type==='session-create'||change.type==='session-action'||change.type==='preferences') {
        statements.push(...sessionStatements(this.db,owner,change));
      } else if (change.type === 'cancel') {
        if (change.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q('DELETE FROM selections WHERE owner=?', owner));
        statements.push(q('DELETE FROM session_input WHERE owner=?', owner));
      } else if (change.type === 'select') {
        statements.push(q('DELETE FROM session_input WHERE owner=?', owner));
        const s = change.selection;
        if (s.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE id=? AND owner=? AND version=?) THEN 1 ELSE 0 END', s.task_id, owner, s.version));
        statements.push(q(`INSERT INTO selections(owner,task_id,version,expires) VALUES(?,?,?,?) ON CONFLICT(owner)
          DO UPDATE SET task_id=excluded.task_id,version=excluded.version,expires=excluded.expires`, owner,s.task_id,s.version,s.expires));
      } else if (change.type === 'propose') {
        const p = change.proposal;
        if (p.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q('INSERT INTO proposals(id,owner,task_id,operation,value,expected_version,expires) VALUES(?,?,?,?,?,?,?)', p.id,owner,p.task_id,p.operation,p.value,p.expected_version,p.expires));
      } else {
        const p = change.proposal;
        if (p.owner !== owner) throw new Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM proposals WHERE id=? AND owner=? AND status='pending' AND expires>?) THEN 1 ELSE 0 END", p.id,owner,now));
        // Existing trigger validates version and applies task mutation within this batch.
        statements.push(q("UPDATE proposals SET status=? WHERE id=? AND owner=? AND status='pending'", change.accept ? 'accepted' : 'rejected',p.id,owner));
      }
    }
    const payload = JSON.stringify({ method: 'sendMessage', chat_id: input.chat, text: plan.view.text,
      ...(plan.view.buttons.length ? { reply_markup: { inline_keyboard: plan.view.buttons } } : {}) });
    if(input.text&&!input.text.startsWith('/')&&!plan.changes.some(c=>c.type==='forget'))statements.push(q('INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES(?,?,?,?,?,?)',owner,input.updateId,input.text,plan.view.text,now,now+7*86400000));
    if(this.cardsEnabled&&input.callbackId){
      statements.push(q('INSERT OR IGNORE INTO outbox(id,payload,available) VALUES(?,?,?)',`ack:${owner}:${input.updateId}`,
        JSON.stringify({method:'answerCallbackQuery',callback_query_id:input.callbackId,
          ...(lease.uiStale||plan.view.silent?{text:'Lựa chọn đã cũ hoặc đã xử lý. Mở lại danh sách nhé.'}:{})}),now));
    }
    const ui=new D1UiStore(this.db);
    let renderedCard:string|undefined;
    if(this.cardsEnabled&&lease.ui&&!lease.uiStale){
      renderedCard=lease.ui.card.id;
      // Text validation errors must leave the input flow active even if the view has no buttons.
      const pendingInput=await this.sessionInput(owner)??await this.selection(owner);
      const inputContinues=!!pendingInput&&!plan.changes.some(c=>c.type==='cancel'||c.type==='session-create');
      const nextView={...plan.view,silent:false};
      if(inputContinues&&!nextView.buttons.length)nextView.buttons=[[{text:'Hủy',callback_data:'cancel-input'}]];
      statements.push(...ui.update(lease.ui.card,lease.ui.action,nextView,nextView.buttons.length?'active':'completed',now));
    }else if(this.cardsEnabled&&!lease.uiStale&&plan.view.buttons.length){
      const created=ui.create(owner,input.chat,plan.view,now,now+900000);renderedCard=created.id;
      statements.push(...created.statements);
    }else if(!plan.view.silent&&!lease.uiStale)statements.push(q(`INSERT INTO outbox(id,payload,available) SELECT ?,?,? FROM command_inbox WHERE owner=? AND update_id=? AND delivery=1`,
      `reply:${owner}:${input.updateId}`,payload,now,owner,input.updateId));
    if(this.cardsEnabled&&!lease.uiStale){
      if(renderedCard){
        statements.push(q('DELETE FROM ui_text_inputs WHERE owner=?',owner));
        statements.push(q(`INSERT INTO ui_text_inputs(owner,card_id,expires) SELECT ?,?,MAX(expires) FROM
          (SELECT expires FROM session_input WHERE owner=? UNION ALL SELECT expires FROM selections WHERE owner=?)
          HAVING MAX(expires)>?`,owner,renderedCard,owner,owner,now));
      }else if(plan.changes.some(c=>c.type==='cancel'))statements.push(q('DELETE FROM ui_text_inputs WHERE owner=?',owner));
    }
    if(!this.cardsEnabled&&input.messageId&&input.callback&&(plan.changes.some(c=>c.type==='resolve'||c.type==='session-action'||c.type==='memory-resolve')||plan.view.silent)){
      // Only remove buttons on a card previously sent by this application to this owner.
      statements.push(q(`INSERT OR IGNORE INTO outbox(id,payload,available) SELECT ?,?,? WHERE EXISTS
        (SELECT 1 FROM outbox WHERE message_id=? AND state='sent' AND json_extract(payload,'$.chat_id')=? AND json_extract(payload,'$.method')='sendMessage')`,
        `clear:${owner}:${input.messageId}`,JSON.stringify({method:'editMessageReplyMarkup',chat_id:input.chat,message_id:input.messageId,reply_markup:{inline_keyboard:[]}}),now,input.messageId,input.chat));
    }
    statements.push(q("UPDATE command_inbox SET state='done',result=? WHERE owner=? AND update_id=?", JSON.stringify(plan.view),owner,input.updateId));
    statements.push(q('INSERT INTO command_audit(owner,update_id,change_count,applied) VALUES(?,?,?,?)',owner,input.updateId,plan.changes.length,now));
    statements.push(q('DELETE FROM transaction_guard'));
    statements.push(q('DELETE FROM owner_leases WHERE owner=? AND token=?',owner,token));
    await this.db.batch(statements);
  }
}
