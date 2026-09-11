export type Memory = {id:string;owner:string;content:string;kind:'preference'|'temporary';source:string;created:number;expires:number|null};
export type ConversationTurn = {owner:string;command_id:number;user_text:string;assistant_text:string;created:number;expires:number};
export type MemoryConfirmation={owner:string;id:string;expires:number;status:'pending'|'accepted'|'rejected'};
export type MemoryChange = {type:'remember';memory:Memory}|{type:'forget';owner:string;id:string}|
 {type:'memory-confirm';confirmation:MemoryConfirmation}|{type:'memory-resolve';owner:string;id:string;accept:boolean;now:number}|
 {type:'focus';owner:string;taskId:string;expires:number}|{type:'ai-enabled';owner:string;enabled:boolean};
