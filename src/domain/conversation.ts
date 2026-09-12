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
export type Clarification = {id:string;owner:string;subject:string;question:string;task_id:string|null;status:string;created:number;expires:number};
export type Summary = {content:string;covered_through:number;version:number;updated:number};
export type ContextChange =
 | {type:'clarification-create';clarification:Clarification}
 | {type:'clarification-close';owner:string;id:string;status:'applied'|'cancelled';now:number}
 | {type:'summary-update';owner:string;content:string;through:number;expectedVersion:number;now:number};
export type StandaloneReminderChange={type:'standalone-reminder';eventId?:string;owner:string;id:string;subject:string;message:string;due:number;created:number};
export type ReminderActionChange={type:'reminder-action';owner:string;id:string;expectedVersion:number;action:'acknowledge'|'cancel'};
