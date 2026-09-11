export type Memory = {id:string;owner:string;content:string;kind:'preference'|'temporary';source:string;created:number;expires:number|null};
export type ConversationTurn = {owner:string;command_id:number;user_text:string;assistant_text:string;created:number;expires:number};
export type MemoryChange = {type:'remember';memory:Memory}|{type:'forget';owner:string;id:string|null}|
 {type:'focus';owner:string;taskId:string;expires:number}|{type:'ai-enabled';owner:string;enabled:boolean};
