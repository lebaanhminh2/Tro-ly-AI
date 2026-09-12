import {query, type Database, type Statement} from './database.ts';
import {renderView} from '../../application/ui-renderer.ts';
import {actionAvailable, type Card, type CardAction, type CardStatus} from '../../domain/ui.ts';
import type {View} from '../../domain/work.ts';
import {deliver} from '../telegram/api.ts';

type UiDelivery = {id: string; card_id: string; revision: number; state: string; attempts: number; claim_token: string | null};
export type CardDelivery = {job: UiDelivery; card: Card; token: string; payload: Record<string, unknown>};

// Statement builders are composed with business mutations in the caller's D1 batch.
// This module never commits business data on a callback's behalf.
export class D1UiStore {
  constructor(privateDb: Database) { this.db = privateDb; }
  private db: Database;
  async flush(owner:string,botToken:string,transport:typeof fetch,clock:()=>number){
    await this.recover(clock());
    const due=(await query(this.db,`SELECT c.id FROM ui_cards c JOIN ui_deliveries d ON d.card_id=c.id AND d.revision=c.revision
      WHERE c.owner=? AND d.state='pending' AND d.available<=? ORDER BY d.available,d.id LIMIT 4`,owner,clock()).all<{id:string}>()).results;
    for(const row of due){
      const delivery=await this.claim(owner,row.id,clock());if(!delivery)continue;
      const result=await deliver(botToken,delivery.payload,transport);
      if(result.reason==='EDIT_UNAVAILABLE')await this.replaceUnavailable(delivery,clock());
      else if(result.state==='pending')await this.retry(delivery,clock(),result.retryAfter??60);
      else await this.finish(delivery,result.state,clock(),result.messageId);
    }
  }
  private async retry(delivery:CardDelivery,now:number,seconds:number){
    await this.db.batch([
      query(this.db,`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ui_cards c JOIN ui_deliveries d ON d.card_id=c.id
        WHERE c.id=? AND c.owner=? AND c.lease_token=? AND c.lease_until>? AND d.id=? AND d.claim_token=? AND d.state='sending') THEN 1 ELSE 0 END`,
        delivery.card.id,delivery.card.owner,delivery.token,now,delivery.job.id,delivery.token),
      query(this.db,"UPDATE ui_deliveries SET state=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,available=? WHERE id=?",now+Math.min(86400,Math.max(1,seconds))*1000,delivery.job.id),
      query(this.db,'UPDATE ui_cards SET lease_token=NULL,lease_until=NULL WHERE id=?',delivery.card.id),
      query(this.db,'DELETE FROM transaction_guard')
    ]);
  }
  private async replaceUnavailable(delivery:CardDelivery,now:number){
    if(delivery.card.message_id===null)throw Error('NOT_AN_EDIT');
    const view=JSON.parse(delivery.card.view_json) as View;
    const actions=(await query(this.db,'SELECT token,action FROM ui_actions WHERE card_id=? AND revision=?',delivery.card.id,delivery.card.revision)
      .all<{token:string;action:string}>()).results;
    const lookup=new Map(actions.map(a=>[`ui:${a.token}`,a.action]));
    const restored={...view,buttons:view.buttons.map(row=>row.map(button=>{
      const action=lookup.get(button.callback_data);if(!action)throw Error('MISSING_CARD_ACTION');
      return {...button,callback_data:action};
    }))};
    const next=this.create(delivery.card.owner,delivery.card.chat_id,restored,now,Math.max(now+60000,delivery.card.expires));
    await this.db.batch([
      query(this.db,`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ui_cards c JOIN ui_deliveries d ON d.card_id=c.id
        WHERE c.id=? AND c.owner=? AND c.lease_token=? AND c.lease_until>? AND c.revision=? AND d.id=? AND d.state='sending' AND d.claim_token=?) THEN 1 ELSE 0 END`,
        delivery.card.id,delivery.card.owner,delivery.token,now,delivery.card.revision,delivery.job.id,delivery.token),
      query(this.db,"UPDATE ui_deliveries SET state='failed' WHERE id=?",delivery.job.id),
      query(this.db,"UPDATE ui_cards SET status='expired',lease_token=NULL,lease_until=NULL WHERE id=?",delivery.card.id),
      query(this.db,'UPDATE ui_actions SET consumed=1 WHERE card_id=?',delivery.card.id),
      ...next.statements,
      query(this.db,'DELETE FROM transaction_guard')
    ]);
  }
  card(owner: string, id: string) { return query(this.db, 'SELECT * FROM ui_cards WHERE owner=? AND id=?', owner, id).first<Card>(); }

  private encode(id: string, owner: string, revision: number, view: View) {
    const rendered = renderView(view);
    const actions: Statement[] = [];
    const buttons = rendered.buttons.map(row => row.map(button => {
      const token = crypto.randomUUID().replaceAll('-', '');
      actions.push(query(this.db, 'INSERT INTO ui_actions(token,card_id,owner,revision,action) VALUES(?,?,?,?,?)', token,id,owner,revision,button.callback_data));
      return {text: button.text, callback_data: `ui:${token}`};
    }));
    return {view: {...rendered, buttons}, actions};
  }

  create(owner: string, chat: number, view: View, now: number, expires: number) {
    if (!/^\d+$/.test(owner) || String(chat) !== owner || !Number.isSafeInteger(chat) || expires <= now) throw Error('INVALID_CARD_OWNER_OR_EXPIRY');
    const id = crypto.randomUUID(), encoded = this.encode(id,owner,1,view);
    return {id, statements: [
      query(this.db, "INSERT INTO ui_cards(id,owner,chat_id,revision,status,view_json,expires) VALUES(?,?,?,1,'active',?,?)", id,owner,chat,JSON.stringify(encoded.view),expires),
      ...encoded.actions,
      query(this.db, 'INSERT INTO ui_deliveries(id,card_id,revision,available) VALUES(?,?,1,?)', crypto.randomUUID(),id,now)
    ]};
  }

  async resolve(owner: string, chat: number, message: number, callback: string, now: number) {
    if (!/^ui:[a-f0-9]{32}$/.test(callback)) return null;
    const action = await query(this.db, 'SELECT * FROM ui_actions WHERE token=? AND owner=?',callback.slice(3),owner).first<CardAction>();
    if (!action) return null;
    const card = await this.card(owner,action.card_id);
    return card && actionAvailable(card,action,owner,chat,message,now) ? {card,action} : null;
  }

  async adoptReminder(owner:string,chat:number,message:number,callback:string,now:number){
    // Only a sent reminder from our outbox may enter this legacy bridge, once.
    const existing=await query(this.db,'SELECT * FROM ui_cards WHERE owner=? AND chat_id=? AND message_id=?',owner,chat,message).first<Card>();
    if(existing){
      // Resume a first adoption interrupted before business commit, not a later revision.
      if(existing.revision!==1)return null;
      const source=await query(this.db,`SELECT o.id FROM outbox o JOIN reminders r ON r.id=o.reminder_id
        JOIN sessions s ON s.id=r.session_id AND s.owner=r.owner
        WHERE o.state='sent' AND o.message_id=? AND r.owner=? AND r.generation=s.generation
        AND s.status='planned' AND json_extract(o.payload,'$.chat_id')=? LIMIT 1`,message,owner,chat).first();
      if(!source)return null;
      const action=await query(this.db,'SELECT * FROM ui_actions WHERE card_id=? AND owner=? AND revision=1 AND action=?',existing.id,owner,callback).first<CardAction>();
      return action&&actionAvailable(existing,action,owner,chat,message,now)?{card:existing,action}:null;
    }
    const row=await query(this.db,`SELECT o.payload FROM outbox o JOIN reminders r ON r.id=o.reminder_id
      JOIN sessions s ON s.id=r.session_id AND s.owner=r.owner
      WHERE o.state='sent' AND o.message_id=? AND r.owner=? AND r.generation=s.generation
      AND s.status='planned' AND json_extract(o.payload,'$.chat_id')=? LIMIT 1`,message,owner,chat).first<{payload:string}>();
    if(!row)return null;
    const payload=JSON.parse(row.payload) as {text:string;reply_markup?:{inline_keyboard?:View['buttons']}};
    const buttons=payload.reply_markup?.inline_keyboard??[];
    if(!buttons.flat().some(button=>button.callback_data===callback))return null;
    const created=this.create(owner,chat,{text:payload.text,buttons},now,now+900000);
    await this.db.batch([...created.statements,
      query(this.db,'UPDATE ui_cards SET message_id=?,rendered_revision=1 WHERE id=?',message,created.id),
      query(this.db,"UPDATE ui_deliveries SET state='sent' WHERE card_id=? AND revision=1",created.id)]);
    const action=await query(this.db,'SELECT * FROM ui_actions WHERE card_id=? AND owner=? AND action=?',created.id,owner,callback).first<CardAction>();
    const card=await this.card(owner,created.id);
    return action&&card?{card,action}:null;
  }

  update(card: Card, action: CardAction, view: View, status: CardStatus, now: number): Statement[] {
    if (action.card_id !== card.id || action.owner !== card.owner || action.revision !== card.revision) throw Error('CARD_ACTION_MISMATCH');
    const revision = card.revision + 1, encoded = this.encode(card.id,card.owner,revision,view);
    return [
      query(this.db, `INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(
        SELECT 1 FROM ui_cards c JOIN ui_actions a ON a.card_id=c.id
        WHERE c.id=? AND c.owner=? AND c.revision=? AND c.rendered_revision=c.revision
        AND c.status='active' AND c.expires>? AND a.token=? AND a.owner=c.owner AND a.revision=c.revision AND a.consumed=0)
        THEN 1 ELSE 0 END`,card.id,card.owner,card.revision,now,action.token),
      query(this.db,'UPDATE ui_actions SET consumed=1 WHERE card_id=? AND revision=?',card.id,card.revision),
      query(this.db,'UPDATE ui_cards SET revision=?,status=?,view_json=? WHERE id=? AND owner=?',revision,status,JSON.stringify(encoded.view),card.id,card.owner),
      ...encoded.actions,
      query(this.db,"UPDATE ui_deliveries SET state='superseded' WHERE card_id=? AND state='pending'",card.id),
      query(this.db,'INSERT INTO ui_deliveries(id,card_id,revision,available) VALUES(?,?,?,?)',crypto.randomUUID(),card.id,revision,now),
      query(this.db,'DELETE FROM transaction_guard')
    ];
  }

  async claim(owner: string, id: string, now: number): Promise<CardDelivery | null> {
    const token = crypto.randomUUID();
    const claimed = await query(this.db, `UPDATE ui_cards SET lease_token=?,lease_until=? WHERE id=? AND owner=?
      AND (lease_until IS NULL OR lease_until<=?) AND EXISTS(SELECT 1 FROM ui_deliveries j WHERE j.card_id=ui_cards.id
      AND j.revision=ui_cards.revision AND j.state='pending' AND j.available<=?)
      AND NOT EXISTS(SELECT 1 FROM ui_deliveries j WHERE j.card_id=ui_cards.id AND j.state IN ('sending','uncertain'))`,
      token,now+30000,id,owner,now,now).run();
    if (!claimed.meta.changes) return null;
    const card = (await this.card(owner,id))!;
    const job = await query(this.db,'SELECT * FROM ui_deliveries WHERE card_id=? AND revision=?',id,card.revision).first<UiDelivery>();
    if (!job) throw Error('MISSING_CARD_DELIVERY');
    const started = await query(this.db, `UPDATE ui_deliveries SET state='sending',attempts=attempts+1,claim_token=? WHERE id=? AND state='pending'
      AND EXISTS(SELECT 1 FROM ui_cards WHERE id=? AND lease_token=? AND revision=ui_deliveries.revision)`,token,job.id,id,token).run();
    if (!started.meta.changes) return null;
    const view = JSON.parse(card.view_json) as View;
    return {job,card,token,payload: {
      method: card.message_id === null ? 'sendMessage' : 'editMessageText', chat_id: card.chat_id,
      ...(card.message_id === null ? {} : {message_id: card.message_id}),text:view.text,reply_markup:{inline_keyboard:view.buttons}
    }};
  }

  async finish(delivery: CardDelivery, outcome: 'sent' | 'failed' | 'uncertain', now: number, messageId?: number) {
    if (outcome === 'sent' && (!Number.isSafeInteger(messageId) || messageId! <= 0
      || (delivery.card.message_id !== null && delivery.card.message_id !== messageId))) throw Error('INVALID_DELIVERY_MESSAGE');
    await this.db.batch([
      query(this.db, `INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM ui_cards c JOIN ui_deliveries j ON j.card_id=c.id
        WHERE c.id=? AND c.owner=? AND c.lease_token=? AND c.lease_until>? AND c.revision=? AND j.id=? AND j.state='sending' AND j.claim_token=?) THEN 1 ELSE 0 END`,
        delivery.card.id,delivery.card.owner,delivery.token,now,delivery.card.revision,delivery.job.id,delivery.token),
      query(this.db,'UPDATE ui_deliveries SET state=? WHERE id=?',outcome,delivery.job.id),
      ...(outcome === 'sent' ? [query(this.db,'UPDATE ui_cards SET rendered_revision=?,message_id=? WHERE id=?',delivery.card.revision,messageId!,delivery.card.id)] : []),
      query(this.db,'UPDATE ui_cards SET lease_token=NULL,lease_until=NULL WHERE id=?',delivery.card.id),
      query(this.db,'DELETE FROM transaction_guard')
    ]);
  }

  async recover(now: number) {
    // An expired HTTP request may still be in flight: block further edits instead of guessing.
    await query(this.db, `UPDATE ui_deliveries SET state='uncertain' WHERE state='sending' AND EXISTS
      (SELECT 1 FROM ui_cards c WHERE c.id=ui_deliveries.card_id AND c.lease_until<=?)`,now).run();
  }
}
