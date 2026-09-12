export type Deadline = {value:string;precision:'date'|'datetime'};
export type ConversationMutation = {
 type:'conversation-task'; owner:string; updateId:number; taskId:string; title:string|null;created:number;
 deadline:Deadline|null; expectedVersion:number|null;
 pendingId?:string;
};
export type PendingConversation = {id:string;kind:'clarify'|'confirm';draft:string;expires:number};
export type ConversationPendingChange={type:'conversation-pending';owner:string;pending:PendingConversation|null};
export type AppointmentChange={type:'conversation-appointment';owner:string;id:string;taskId:string;expectedVersion:number;due:number;updateId:number;created:number;pendingId?:string};
export type CompletionChange={type:'conversation-completion';owner:string;taskId:string;expectedVersion:number;operation:'complete'|'reopen';updateId:number;now:number;pendingId?:string};
