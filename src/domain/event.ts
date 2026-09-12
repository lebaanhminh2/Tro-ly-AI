export type LocalEvent = {id:string;owner:string;title:string;start_at:number;end_at:number|null;status:'scheduled'|'cancelled';version:number};
export type EventChange = {type:'event-create';event:LocalEvent;reminderAt:number|null;reminderMessage:string};
export type EventUpdate={type:'event-update';owner:string;id:string;expectedVersion:number;cancelled:boolean;start:number;end:number|null};
