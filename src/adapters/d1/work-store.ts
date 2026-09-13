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
import {progressData,workPage,boardSelection,progressStatements} from './progress-store.ts';
import {ScheduleStore} from './schedule-store.ts';
import {HealthyStore} from './healthy-store.ts';
import {localEvents,eventStatements} from './event-store.ts';
import {conversationStatements} from './conversation-store.ts';

export class D1WorkStore implements WorkStore {
  private db: Database;
  constructor(db: Database, privateCards = false) { this.db = db; this.cardsEnabled=privateCards; }
  private cardsEnabled:boolean;
  reportSleep(owner:string,now:number){return new ScheduleStore(this.db).reportSleep(owner,now);}
  async hierarchy(owner:string){
    const tasks=(await query(this.db,"SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL ORDER BY status,deadline IS NULL,deadline,public_code LIMIT 200",owner).all<Task&{public_code:number}>()).results;
    const steps=(await query(this.db,"SELECT s.* FROM task_steps s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner=? AND s.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY s.step_code",owner).all<{id:string;task_id:string;step_code:number;title:string;status:string;version:number}>()).results;
    return tasks.map(task=>({...task,steps:steps.filter(step=>step.task_id===task.id)}));
  }
  async mutateHierarchy(owner:string,requestId:string,input:{operation:string;taskId?:string;stepId?:string;version?:number;title?:string;deadline?:string|null;complete?:boolean;confirm?:boolean},now:number){
    const operation=input.operation;
    if(!['create','edit','complete','delete','add_step','step_status','edit_step','delete_step'].includes(operation))throw Error('INVALID_OPERATION');
    if(['create','edit','add_step','edit_step'].includes(operation)&&(!input.title?.trim()||input.title.length>160))throw Error('INVALID_TITLE');
    if(input.deadline!==undefined&&input.deadline!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline))throw Error('INVALID_DEADLINE');
    if(input.deadline){const parsed=Date.parse(input.deadline+'T00:00:00Z');if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==input.deadline)throw Error('INVALID_DEADLINE');}
    if(operation==='complete'||operation==='step_status'){if(typeof input.complete!=='boolean')throw Error('INVALID_STATUS');}
    const q=(sql:string,...args:(string|number|null)[])=>query(this.db,sql,...args);
    const task=operation==='create'?null:await this.task(owner,input.taskId??'');
    // Receipt replay is checked by HealthyStore before invoking this closure.
    const existingAward=task?await q('SELECT task_id FROM task_ticket_awards WHERE owner=? AND task_id=?',owner,task.id).first():null;
    const children=task?(await q('SELECT * FROM task_steps WHERE owner=? AND task_id=? AND deleted_at IS NULL',owner,task.id).all<{id:string;status:string;version:number}>()).results:[];
    const id=crypto.randomUUID();
    return new HealthyStore(this.db).mutate<Record<string,unknown>>(owner,requestId,'task:'+operation,input,now,state=>{
      const statements:Statement[]=[];
      if(operation==='create'){
        statements.push(q('INSERT INTO tasks(id,owner,title,deadline,deadline_precision,created) VALUES(?,?,?,?,?,?)',id,owner,input.title!.trim(),input.deadline??null,input.deadline?'date':null,now));
        return {state,result:{id},statements};
      }
      if(!task||task.version!==input.version)throw Error('STALE_TASK');
      statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END',owner,task.id,input.version!));
      if(operation==='edit'){
        statements.push(q('UPDATE tasks SET title=?,deadline=?,version=version+1 WHERE owner=? AND id=?',input.title!.trim(),input.deadline===undefined?task.deadline:input.deadline,owner,task.id));
      }else if(operation==='complete'){
        if(input.complete&&children.some(s=>s.status!=='completed')&&!input.confirm)throw Error('CONFIRM_CHILDREN');
        statements.push(q('UPDATE tasks SET status=?,version=version+1 WHERE owner=? AND id=?',input.complete?'completed':'active',owner,task.id));
        if(input.complete){
          statements.push(q("UPDATE task_steps SET status='completed',completed_at=COALESCE(completed_at,?),version=version+1 WHERE owner=? AND task_id=? AND deleted_at IS NULL AND status='active'",now,owner,task.id));
          statements.push(q('UPDATE task_completions SET completed_at=? WHERE owner=? AND task_id=?',now,owner,task.id));
          statements.push(q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND task_id=? AND status='active'",owner,task.id));
          statements.push(q("UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN(SELECT id FROM sessions WHERE owner=? AND task_id=?) AND status IN('pending','queued')",owner,owner,task.id));
          statements.push(q("UPDATE sessions SET status=CASE WHEN status IN('running','paused') THEN 'completed' ELSE 'skipped' END,spent_ms=spent_ms+CASE WHEN active_since IS NULL THEN 0 ELSE MAX(0,?-active_since) END,active_since=NULL,version=version+1 WHERE owner=? AND task_id=? AND status NOT IN('completed','skipped')",now,owner,task.id));
          if(!existingAward&&!state.suspended){
            statements.push(q('INSERT INTO task_ticket_awards(owner,task_id,created) VALUES(?,?,?)',owner,task.id,now));
            return {state:{...state,tickets:state.tickets+1},result:{id:task.id,ticket:1},statements};
          }
        }
      }else if(operation==='delete'){
        if(!input.confirm)throw Error('CONFIRM_DELETE');
        statements.push(q('UPDATE tasks SET deleted_at=?,version=version+1 WHERE owner=? AND id=?',now,owner,task.id));
        statements.push(q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND task_id=? AND status='active'",owner,task.id));
        statements.push(q("UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN(SELECT id FROM sessions WHERE owner=? AND task_id=?) AND status IN('pending','queued')",owner,owner,task.id));
        statements.push(q("UPDATE sessions SET status='skipped',version=version+1,active_since=NULL WHERE owner=? AND task_id=? AND status NOT IN('completed','skipped')",owner,task.id));
      }else if(operation==='add_step'){
        if(task.status==='completed'&&!input.confirm)throw Error('CONFIRM_REOPEN_PARENT');
        statements.push(q('INSERT INTO task_steps(id,owner,task_id,step_code,title,created) SELECT ?,?,?,COALESCE(MAX(step_code),0)+1,?,? FROM task_steps WHERE task_id=?',id,owner,task.id,input.title!.trim(),now,task.id));
        statements.push(q("UPDATE tasks SET status='active',version=version+1 WHERE owner=? AND id=?",owner,task.id));
      }else{
        const step=children.find(s=>s.id===input.stepId);if(!step)throw Error('STEP_NOT_FOUND');
        if(operation==='step_status'){
          if(!input.complete&&task.status==='completed'&&!input.confirm)throw Error('CONFIRM_REOPEN_PARENT');
          statements.push(q('UPDATE task_steps SET status=?,completed_at=?,version=version+1 WHERE owner=? AND id=?',input.complete?'completed':'active',input.complete?now:null,owner,step.id));
          statements.push(q('UPDATE tasks SET status=?,version=version+1 WHERE owner=? AND id=?',input.complete?task.status??'active':'active',owner,task.id));
        }else if(operation==='edit_step'){
          statements.push(q('UPDATE task_steps SET title=?,version=version+1 WHERE owner=? AND id=?',input.title!.trim(),owner,step.id));
          statements.push(q('UPDATE tasks SET version=version+1 WHERE owner=? AND id=?',owner,task.id));
        }else{
          if(!input.confirm)throw Error('CONFIRM_DELETE');
          statements.push(q('UPDATE task_steps SET deleted_at=?,version=version+1 WHERE owner=? AND id=?',now,owner,step.id));
          statements.push(q('UPDATE tasks SET version=version+1 WHERE owner=? AND id=?',owner,task.id));
        }
      }
      return {state,result:{id:task.id},statements};
    });
  }
  progress(owner:string){return progressData(this.db,owner);}
  workPage(owner:string,filter:import('../../domain/progress.ts').WorkFilter,offset:number,now:number){return workPage(this.db,owner,filter,offset,now);}
  boardSelection(owner:string){return boardSelection(this.db,owner);}
  async priorityTasks(owner:string){
    return (await query(this.db,"SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND status='active' ORDER BY deadline IS NULL, CASE WHEN deadline_precision='date' THEN julianday(deadline||'T00:00:00+07:00') ELSE julianday(deadline) END,created,id LIMIT 3",owner).all<Task>()).results;
  }
  async findTasks(owner:string,text:string,status:'active'|'completed'|'all',cursor:number){
    if(text.length>160||!Number.isSafeInteger(cursor)||cursor<0||cursor>10000||!['active','completed','all'].includes(status))throw Error('INVALID_QUERY');
    const rows=(await query(this.db,`SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND (?='all' OR status=?)
      AND (?='' OR instr(lower(title),lower(?))>0) ORDER BY created,id LIMIT 11 OFFSET ?`,owner,status,status,text,text,cursor).all<Task>()).results;
    return {tasks:rows.slice(0,10),nextCursor:rows.length>10?cursor+10:null};
  }
  async agenda(owner:string,from:number,to:number,cursor:number){
    if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>31*86400000||!Number.isSafeInteger(cursor)||cursor<0||cursor>10000)throw Error('INVALID_AGENDA_RANGE');
    const rows=(await query(this.db,`SELECT * FROM (
      SELECT 'session' AS kind,s.id,t.title,s.start_at AS at,s.status FROM sessions s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner=? AND s.start_at>=? AND s.start_at<? AND s.status!='draft'
      UNION ALL SELECT 'reminder',a.id,COALESCE(a.subject,t.title),a.due,a.status FROM task_appointments a LEFT JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner WHERE a.owner=? AND a.due>=? AND a.due<? AND a.status='active'
      UNION ALL SELECT 'event',id,title,start_at,status FROM local_events WHERE owner=? AND status='scheduled'
      UNION ALL SELECT 'deadline',id,title,CAST((julianday(CASE WHEN deadline_precision='date' THEN deadline||'T00:00:00+07:00' ELSE deadline END)-2440587.5)*86400000 AS INTEGER),status FROM tasks WHERE owner=? AND deleted_at IS NULL AND status='active' AND deadline IS NOT NULL
    ) WHERE at>=? AND at<? ORDER BY at,kind,id LIMIT 11 OFFSET ?`,owner,from,to,owner,from,to,owner,owner,from,to,cursor).all<Record<string,unknown>>()).results;
    return {items:rows.slice(0,10),nextCursor:rows.length>10?cursor+10:null,source:'local',timezone:'Asia/Ho_Chi_Minh'};
  }
  async completionUndo(owner:string,taskId:string,version:number,now:number){return !!await query(this.db,'SELECT task_id FROM task_completion_undo WHERE owner=? AND task_id=? AND expected_version=? AND expires>?',owner,taskId,version,now).first();}
  async conversationTasks(owner:string,text:string){
    return (await query(this.db,`SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND instr(lower(?),lower(title))>0 ORDER BY length(title) DESC,created DESC LIMIT 20`,owner,text).all<Task>()).results;
  }
  async sameTitleTasks(owner:string,title:string){return (await query(this.db,'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND title=? ORDER BY created LIMIT 2',owner,title).all<Task>()).results;}
  conversationPending(owner:string,now:number){return query(this.db,'SELECT id,kind,draft,expires FROM conversation_pending WHERE owner=? AND expires>?',owner,now).first<import('../../domain/conversation.ts').PendingConversation>();}
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
  event(owner:string,id:string){return query(this.db,'SELECT * FROM local_events WHERE owner=? AND id=?',owner,id).first<import('../../domain/event.ts').LocalEvent>();}
  events(owner:string,from:number,to:number){return localEvents(this.db,owner,from,to);}
  async appointmentContext(owner:string,now:number){
   return (await query(this.db,"SELECT a.id,a.task_id,a.event_id,COALESCE(a.subject,t.title) AS subject,a.due,a.responded,a.version,o.message_id,o.state AS delivery_state FROM task_appointments a LEFT JOIN tasks t ON t.id=a.task_id AND t.owner=a.owner LEFT JOIN outbox o ON o.reminder_id='appointment:'||a.id||':1' WHERE a.owner=? AND a.status='active' AND a.due>? AND a.due<? ORDER BY a.due LIMIT 40",owner,now-3600000,now+7*86400000).all<Record<string,unknown>>()).results;
  }
  async clarifications(owner:string,now:number){
    return (await query(this.db,"SELECT * FROM conversation_clarifications WHERE owner=? AND status='waiting' AND expires>? ORDER BY created,id LIMIT 12",owner,now).all<import('../../domain/conversation.ts').Clarification>()).results;
  }
  summary(owner:string){return query(this.db,'SELECT content,covered_through,version,updated FROM conversation_summaries WHERE owner=?',owner).first<import('../../domain/conversation.ts').Summary>();}
  runningSession(owner:string){return query(this.db,"SELECT * FROM sessions WHERE owner=? AND status='running' ORDER BY start_at LIMIT 1",owner).first<Session>();}
  memory(owner:string,id:string){return query(this.db,'SELECT * FROM memories WHERE owner=? AND id=?',owner,id).first<Memory>();}
  async memories(owner:string,now:number,offset=0,limit=30){
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>30)throw Error('INVALID_PAGE');
    return (await query(this.db,'SELECT * FROM memories WHERE owner=? AND (expires IS NULL OR expires>?) ORDER BY created DESC,id DESC LIMIT ? OFFSET ?',owner,now,limit,offset).all<Memory>()).results;
  }
  memoryConfirmation(owner:string,id:string){return query(this.db,'SELECT * FROM memory_confirmations WHERE owner=? AND id=?',owner,id).first<import('../../domain/memory.ts').MemoryConfirmation>();}
  async unsummarized(owner:string,now:number,after:number){
    return (await query(this.db,'SELECT * FROM conversation_turns WHERE owner=? AND expires>? AND command_id>? ORDER BY command_id LIMIT 40',owner,now,after).all<ConversationTurn>()).results;
  }
  async history(owner:string,now:number){return (await query(this.db,'SELECT * FROM conversation_turns WHERE owner=? AND expires>? ORDER BY command_id DESC LIMIT 12',owner,now).all<ConversationTurn>()).results.reverse();}
  async focus(owner:string,now:number){return (await query(this.db,'SELECT task_id FROM chat_focus WHERE owner=? AND expires>?',owner,now).first<{task_id:string}>())?.task_id??null;}
  async aiEnabled(owner:string){return (await query(this.db,'SELECT enabled FROM memory_settings WHERE owner=?',owner).first<{enabled:number}>())?.enabled!==0;}
  async sessions(owner:string,start:number,end:number){return (await query(this.db,"SELECT * FROM sessions WHERE owner=? AND start_at>=? AND start_at<? AND status!='draft' ORDER BY start_at LIMIT 30",owner,start,end).all<Session>()).results;}
  session(owner:string,id:string){return query(this.db,'SELECT * FROM sessions WHERE owner=? AND id=?',owner,id).first<Session>();}
  sessionInput(owner:string){return query(this.db,'SELECT task_id,expires FROM session_input WHERE owner=?',owner).first<{task_id:string;expires:number}>();}
  preferences(owner:string){return query(this.db,'SELECT * FROM reminder_preferences WHERE owner=?',owner).first<Preferences>();}
  task(owner: string, id: string) { return query(this.db, 'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL AND id=?', owner, id).first<Task>(); }
  async tasks(owner: string, offset: number) { return (await query(this.db, 'SELECT * FROM tasks WHERE owner=? AND deleted_at IS NULL ORDER BY created,id LIMIT 10 OFFSET ?', owner, offset).all<Task>()).results; }
  proposal(owner: string, id: string) { return query(this.db, 'SELECT * FROM proposals WHERE owner=? AND id=?', owner, id).first<Proposal>(); }
  selection(owner: string) { return query(this.db, 'SELECT * FROM selections WHERE owner=?', owner).first<Selection>(); }
  async result(owner: string, id: number): Promise<ViewResult | null> {
    const row = await query(this.db, 'SELECT result FROM command_inbox WHERE owner=? AND update_id=? AND state=?', owner, id, 'done').first<{result: string | null}>();
    return row?.result ? JSON.parse(row.result) as ViewResult : null;
  }
  async accept(input: Input, now: number, delivery: boolean) {
    const response = await query(this.db, 'INSERT OR IGNORE INTO command_inbox(owner,update_id,payload,created,delivery) VALUES(?,?,?,?,?)',
      input.owner, input.updateId, JSON.stringify(input), now, delivery ? 1 : 0).run();
    if(response.meta.changes>0&&input.replyToMessageId)await query(this.db,`UPDATE reminders SET status='cancelled' WHERE owner=? AND ordinal=2
      AND status IN ('pending','queued') AND EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending')
      AND EXISTS(SELECT 1 FROM outbox WHERE reminder_id IN (reminders.session_id||':'||reminders.generation||':1',reminders.session_id||':'||reminders.generation||':2') AND state='sent' AND message_id=?)`,input.owner,input.owner,input.updateId,input.replyToMessageId).run();
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
  mutationStatements(owner:string,changes:Plan['changes'],now:number,native=false):Statement[]{
    const q=(sql:string,...args:(string|number|null)[])=>query(this.db,sql,...args);
    const statements:Statement[]=[];
    for (const change of changes) {
      if(change.type==='task-rename'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END',owner,change.taskId,change.expectedVersion));
        statements.push(q('UPDATE tasks SET title=?,version=version+1 WHERE owner=? AND id=?',change.title,owner,change.taskId));
      }else if(change.type==='progress-record'||change.type==='board-select'||change.type==='tasks-delete'){
        statements.push(...progressStatements(this.db,owner,change));
      }else if(change.type==='event-update'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM local_events WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END",owner,change.id,change.expectedVersion));
        statements.push(q("UPDATE local_events SET start_at=?,end_at=?,status=?,version=version+1 WHERE owner=? AND id=?",change.start,change.end,change.cancelled?'cancelled':'scheduled',owner,change.id));
        statements.push(q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND event_id=? AND status='active'",owner,change.id));
      }else if(change.type==='reminder-action'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_appointments WHERE id=? AND owner=? AND version=? AND status='active') THEN 1 ELSE 0 END",change.id,owner,change.expectedVersion));
        statements.push(change.action==='cancel'?q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE id=? AND owner=?",change.id,owner):q("UPDATE task_appointments SET responded=1,version=version+1 WHERE id=? AND owner=?",change.id,owner));
      }else if(change.type==='event-create'){
        statements.push(...eventStatements(this.db,owner,change,now));
      }else if(change.type==='standalone-reminder'){
        if(change.owner!==owner||change.due<=now)throw Error('INVALID_REMINDER');
        statements.push(q("INSERT INTO task_appointments(id,owner,task_id,due,subject,message,event_id) VALUES(?,?,NULL,?,?,?,?)",change.id,owner,change.due,change.subject,change.message,change.eventId??null));
      }else if(change.type==='clarification-create'){
        const c=change.clarification;if(c.owner!==owner)throw Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO conversation_clarifications(id,owner,subject,question,task_id,created,expires) VALUES(?,?,?,?,?,?,?)",c.id,owner,c.subject,c.question,c.task_id,c.created,c.expires));
      }else if(change.type==='clarification-close'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_clarifications WHERE id=? AND owner=? AND status='waiting' AND expires>?) THEN 1 ELSE 0 END",change.id,owner,change.now));
        statements.push(q("UPDATE conversation_clarifications SET status=? WHERE id=? AND owner=?",change.status,change.id,owner));
      }else if(change.type==='summary-update'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        statements.push(q("INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM conversation_summaries WHERE owner=?),0)=? THEN 1 ELSE 0 END",owner,change.expectedVersion));
        statements.push(q("INSERT INTO conversation_summaries(owner,content,covered_through,updated) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET content=excluded.content,covered_through=excluded.covered_through,version=version+1,updated=excluded.updated",owner,change.content,change.through,change.now));
      }else if(change.type==='conversation-completion'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        if(change.pendingId)statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END',owner,change.pendingId,now));
        statements.push(q(`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ${native?'tool_steps':'conversation_receipts'} WHERE owner=? AND update_id=? AND ${native?"kind='write' AND state='done'":"state='ready'"}) AND EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND status=?) THEN 1 ELSE 0 END`,owner,change.updateId,owner,change.taskId,change.expectedVersion,change.operation==='complete'?'active':'completed'));
        if(change.operation==='reopen')statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_completion_undo WHERE owner=? AND task_id=? AND expected_version=? AND expires>?) THEN 1 ELSE 0 END',owner,change.taskId,change.expectedVersion,now));
        statements.push(q('UPDATE tasks SET status=?,version=version+1 WHERE owner=? AND id=?',change.operation==='complete'?'completed':'active',owner,change.taskId));
        if(change.operation==='complete'){
          statements.push(q('UPDATE task_completions SET completed_at=? WHERE owner=? AND task_id=?',now,owner,change.taskId));
          statements.push(q('INSERT INTO task_completion_undo(owner,task_id,expected_version,expires) VALUES(?,?,?,?) ON CONFLICT(owner,task_id) DO UPDATE SET expected_version=excluded.expected_version,expires=excluded.expires',owner,change.taskId,change.expectedVersion+1,now+900000));
          statements.push(q("UPDATE task_appointments SET status='cancelled' WHERE owner=? AND task_id=? AND status='active'",owner,change.taskId));
          statements.push(q("UPDATE reminders SET status='cancelled' WHERE owner=? AND status IN ('pending','queued') AND session_id IN (SELECT id FROM sessions WHERE owner=? AND task_id=?)",owner,owner,change.taskId));
          statements.push(q("UPDATE sessions SET status=CASE WHEN status IN ('running','paused') THEN 'completed' ELSE 'skipped' END,spent_ms=spent_ms+CASE WHEN active_since IS NULL THEN 0 ELSE MAX(0,?-active_since) END,active_since=NULL,version=version+1 WHERE owner=? AND task_id=? AND status NOT IN ('completed','skipped')",now,owner,change.taskId));
        }else statements.push(q('DELETE FROM task_completion_undo WHERE owner=? AND task_id=?',owner,change.taskId));
        if(!native)statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?",owner,change.updateId));
      }else if(change.type==='conversation-appointment'){
        if(change.owner!==owner||change.due<=now)throw Error('INVALID_APPOINTMENT');
        if(change.pendingId)statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM conversation_pending WHERE owner=? AND id=? AND expires>?) THEN 1 ELSE 0 END',owner,change.pendingId,now));
        statements.push(q(`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ${native?'tool_steps':'conversation_receipts'} WHERE owner=? AND update_id=? AND ${native?"kind='write' AND state='done'":"state='ready'"}) AND EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END`,owner,change.updateId,owner,change.taskId,change.expectedVersion));
        statements.push(q("UPDATE task_appointments SET status='cancelled' WHERE owner=? AND task_id=? AND status='active'",owner,change.taskId));
        statements.push(q('INSERT INTO task_appointments(id,owner,task_id,due) VALUES(?,?,?,?)',change.id,owner,change.taskId,change.due));
        if(!native)statements.push(q("UPDATE conversation_receipts SET state='applied' WHERE owner=? AND update_id=?",owner,change.updateId));
      }else if(change.type==='conversation-pending'){
        if(change.owner!==owner)throw Error('OWNER_MISMATCH');
        if(change.pending)statements.push(q('INSERT INTO conversation_pending(owner,id,kind,draft,expires) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,kind=excluded.kind,draft=excluded.draft,expires=excluded.expires',owner,change.pending.id,change.pending.kind,change.pending.draft,change.pending.expires));
        else statements.push(q('DELETE FROM conversation_pending WHERE owner=?',owner));
      }else if(change.type==='conversation-task'){
        statements.push(...conversationStatements(this.db,owner,change,native));
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
    return statements;
  }
  async commit(lease: Lease, plan: Plan, now: number) {
    // Validate and normalize before constructing any database mutation.
    plan = {...plan, view: renderView(plan.view)};
    const { owner, input, token } = lease;
    const q = (sql: string, ...args: (string | number | null)[]) => query(this.db, sql, ...args);
    const statements: Statement[] = [q(`INSERT INTO transaction_guard(valid) SELECT CASE WHEN
      EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?) AND
      EXISTS(SELECT 1 FROM command_inbox WHERE owner=? AND update_id=? AND state='pending') THEN 1 ELSE 0 END`, owner, token, now, owner, input.updateId)];
    statements.push(...(lease.pendingWrites??[]));
    statements.push(...this.mutationStatements(owner,plan.changes,now));
    const payload = JSON.stringify({ method: 'sendMessage', chat_id: input.chat, text: plan.view.text,
      ...(plan.view.buttons.length ? { reply_markup: { inline_keyboard: plan.view.buttons } } : {}) });
    if(input.text&&!input.text.startsWith('/')&&!plan.changes.some(c=>c.type==='forget'))statements.push(q('INSERT INTO conversation_turns(owner,command_id,user_text,assistant_text,created,expires) VALUES(?,?,?,?,?,?)',owner,input.updateId,input.text,plan.view.text,now,now+30*86400000));
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
    }else if(this.cardsEnabled&&!lease.uiStale&&(plan.view.buttons.length||plan.view.photo)){
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
