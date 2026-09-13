export type Task = { id: string; owner: string; title: string; deadline: string | null; version: number;status?:'active'|'completed' };
export type Proposal = { id: string; owner: string; task_id: string; operation: 'capture' | 'deadline'; value: string;
  expected_version: number; expires: number; status: 'pending' | 'accepted' | 'rejected' };
export type Selection = { owner: string; task_id: string; version: number; expires: number };
export type Input = { updateId: number; owner: string; chat: number; text?: string; callback?: string; callbackId?: string; messageId?:number; replyToMessageId?:number; receivedAt?:number };
export type Button = { text: string; callback_data: string };
export type View = { intro?:string; dashboard?:'progress'|'achievements'; photo?:string; text: string; buttons: Button[][]; silent?:boolean };
export type Change = import('./conversation.ts').TaskRename | import('./progress.ts').ProgressChange | import('./event.ts').EventUpdate | import('./conversation.ts').ReminderActionChange | import('./event.ts').EventChange | import('./conversation.ts').StandaloneReminderChange | import('./conversation.ts').ContextChange | import('./conversation.ts').CompletionChange | import('./conversation.ts').AppointmentChange | import('./conversation.ts').ConversationPendingChange | import('./conversation.ts').ConversationMutation | import('./session.ts').SessionChange | import('./memory.ts').MemoryChange
  | { type: 'propose'; proposal: Proposal }
  | { type: 'resolve'; proposal: Proposal; accept: boolean }
  | { type: 'select'; selection: Selection }
  | { type: 'cancel'; owner: string };
export type Plan = { view: View; changes: Change[] };
export function confirmationAvailable(p: Proposal, task: Task | null, now: number, accept: boolean): boolean {
  if (p.status !== 'pending' || p.expires <= now) return false;
  if (!accept || p.operation === 'capture') return true;
  return !!task && task.owner === p.owner && task.version === p.expected_version && Date.parse(p.value) > now;
}
