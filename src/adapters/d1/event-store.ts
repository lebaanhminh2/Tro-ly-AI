import {query,type Database} from './database.ts';
import type {LocalEvent,EventChange} from '../../domain/event.ts';
export async function localEvents(db:Database,owner:string,from:number,to:number){
 return (await query(db,"SELECT * FROM local_events WHERE owner=? AND status='scheduled' AND start_at>=? AND start_at<? ORDER BY start_at,id LIMIT 40",owner,from,to).all<LocalEvent>()).results;
}
export function eventStatements(db:Database,owner:string,change:EventChange,now:number){
 const e=change.event;
 if(e.owner!==owner||!e.title.trim()||e.start_at<=now||(e.end_at!==null&&e.end_at<=e.start_at))throw Error('INVALID_EVENT');
 const statements=[query(db,'INSERT INTO local_events(id,owner,title,start_at,end_at,status,version) VALUES(?,?,?,?,?,?,?)',e.id,owner,e.title,e.start_at,e.end_at,e.status,e.version)];
 if(change.reminderAt!==null){
  if(change.reminderAt<=now||change.reminderAt>e.start_at)throw Error('INVALID_EVENT_REMINDER');
  statements.push(query(db,'INSERT INTO task_appointments(id,owner,task_id,due,subject,message,event_id) VALUES(?,?,NULL,?,?,?,?)','event-reminder:'+e.id,owner,change.reminderAt,e.title,change.reminderMessage,e.id));
 }
 return statements;
}
