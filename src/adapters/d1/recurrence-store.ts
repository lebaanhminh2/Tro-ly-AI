import {query,type Database} from './database.ts';
import {occurrences,type RecurrenceRule,validateRule} from '../../domain/recurrence.ts';
type RuleRow={id:string;owner:string;title:string;kind:RecurrenceRule['kind'];times_json:string;weekdays_json:string;start_date:string;end_date:string|null;enabled:number;version:number};
export class RecurrenceStore{
 private db:Database;
 constructor(db:Database){this.db=db;}
 async rules(owner:string){
  const rows=await query(this.db,'SELECT * FROM recurrence_rules WHERE owner=? ORDER BY created,id LIMIT 100',owner).all<RuleRow>();
  return rows.results.map(r=>({id:r.id,owner:r.owner,title:r.title,kind:r.kind,times:JSON.parse(r.times_json) as string[],weekdays:JSON.parse(r.weekdays_json) as number[],startDate:r.start_date,endDate:r.end_date,enabled:!!r.enabled,version:r.version}));
 }
 saveStatements(rule:RecurrenceRule,expectedVersion:number,now:number){
  validateRule(rule);
  if(rule.version!==expectedVersion+1)throw Error('INVALID_RULE_VERSION');
  return [
   query(this.db,'INSERT INTO transaction_guard SELECT CASE WHEN (?=0 AND NOT EXISTS(SELECT 1 FROM recurrence_rules WHERE id=?)) OR EXISTS(SELECT 1 FROM recurrence_rules WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END',expectedVersion,rule.id,rule.owner,rule.id,expectedVersion),
   query(this.db,'INSERT INTO recurrence_rules(id,owner,title,kind,times_json,weekdays_json,start_date,end_date,enabled,version,created) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,kind=excluded.kind,times_json=excluded.times_json,weekdays_json=excluded.weekdays_json,start_date=excluded.start_date,end_date=excluded.end_date,enabled=excluded.enabled,version=excluded.version WHERE recurrence_rules.owner=excluded.owner',rule.id,rule.owner,rule.title,rule.kind,JSON.stringify(rule.times),JSON.stringify(rule.weekdays),rule.startDate,rule.endDate,Number(rule.enabled),rule.version,now),
   query(this.db,"UPDATE recurrence_occurrences SET status='cancelled' WHERE owner=? AND rule_id=? AND status IN ('scheduled','queued')",rule.owner,rule.id),
   query(this.db,'DELETE FROM transaction_guard')
  ];
 }
 async save(rule:RecurrenceRule,expectedVersion:number,now:number){await this.db.batch(this.saveStatements(rule,expectedVersion,now));}
 async materialize(owner:string,from:number,to:number){
  const rules=await this.rules(owner);
  for(const rule of rules){
   const items=occurrences(rule,from,to);
   // Batch small groups for D1; deterministic keys preserve skipped/moved instances.
   for(let i=0;i<items.length;i+=25){
    await this.db.batch(items.slice(i,i+25).map(o=>query(this.db,
     "INSERT OR IGNORE INTO recurrence_occurrences(id,rule_id,owner,rule_version,slot,due) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM recurrence_rules WHERE id=? AND owner=? AND enabled=1 AND version=?)",
     o.id,o.ruleId,o.owner,o.version,o.slot,o.due,o.ruleId,o.owner,o.version)));
   }
  }
 }
 async queueDue(owner:string,now:number,resting:boolean){
  // A short look-back tolerates cron jitter; old occurrences become missed,
  // never an accumulated notification debt after downtime.
  await this.materialize(owner,now-3600000,now+86400000);
  await query(this.db,"UPDATE recurrence_occurrences SET status='missed' WHERE owner=? AND status='scheduled' AND due<?",owner,now-3600000).run();
  const rows=(await query(this.db,"SELECT o.id,o.due,o.rule_id,o.rule_version,r.title FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id AND r.owner=o.owner WHERE o.owner=? AND o.status='scheduled' AND o.due<=? AND r.enabled=1 AND r.version=o.rule_version ORDER BY o.due LIMIT 20",owner,now).all<{id:string;due:number;rule_id:string;rule_version:number;title:string}>()).results;
  for(const row of rows){
   if(resting){await query(this.db,"UPDATE recurrence_occurrences SET status='skipped_rest' WHERE id=? AND owner=? AND status='scheduled'",row.id,owner).run();continue;}
   const deliveryId='recurring:'+row.id;
   await this.db.batch([
    query(this.db,"INSERT OR IGNORE INTO outbox(id,payload,available,reminder_id) SELECT ?,?,?,? FROM recurrence_occurrences o JOIN recurrence_rules r ON r.id=o.rule_id WHERE o.id=? AND o.owner=? AND o.status='scheduled' AND r.enabled=1 AND r.version=o.rule_version",deliveryId,JSON.stringify({method:'sendMessage',chat_id:Number(owner),text:row.title+' · đến giờ cậu hẹn rồi nhé.'}),now,deliveryId,row.id,owner),
    query(this.db,"UPDATE recurrence_occurrences SET status='queued' WHERE id=? AND owner=? AND status='scheduled' AND EXISTS(SELECT 1 FROM outbox WHERE id=?)",row.id,owner,deliveryId)
   ]);
  }
 }
 async skip(owner:string,id:string,version:number){
  const result=await query(this.db,"UPDATE recurrence_occurrences SET status='cancelled' WHERE owner=? AND id=? AND rule_version=? AND status IN ('scheduled','queued')",owner,id,version).run();
  return result.meta.changes>0;
 }
}
