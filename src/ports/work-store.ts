import type { Input, Task, Proposal, Selection, Plan } from '../domain/work.ts';
export type Clock = { now(): number };
export type Lease = { owner: string; token: string; input: Input; attempts: number;
  ui?:{card:import('../domain/ui.ts').Card;action:import('../domain/ui.ts').CardAction}; uiStale?:boolean; uiRecovered?:boolean };
export interface WorkReader {
  conversationTasks?(owner:string,text:string):Promise<Task[]>;
  sameTitleTasks?(owner:string,title:string):Promise<Task[]>;
  conversationPending?(owner:string,now:number):Promise<import('../domain/conversation.ts').PendingConversation|null>;
  runningSession(owner:string):Promise<import('../domain/session.ts').Session|null>;
  memory(owner:string,id:string):Promise<import('../domain/memory.ts').Memory|null>;
  memories(owner:string,now:number,offset?:number,limit?:number):Promise<import('../domain/memory.ts').Memory[]>;
  memoryConfirmation(owner:string,id:string):Promise<import('../domain/memory.ts').MemoryConfirmation|null>;
  history(owner:string,now:number):Promise<import('../domain/memory.ts').ConversationTurn[]>;
  focus(owner:string,now:number):Promise<string|null>;
  aiEnabled(owner:string):Promise<boolean>;
  sessions(owner:string,start:number,end:number):Promise<import('../domain/session.ts').Session[]>;
  session(owner:string,id:string):Promise<import('../domain/session.ts').Session|null>;
  sessionInput(owner:string):Promise<{task_id:string;expires:number}|null>;
  preferences(owner:string):Promise<import('../domain/session.ts').Preferences|null>;
  task(owner: string, id: string): Promise<Task | null>;
  tasks(owner: string, offset: number): Promise<Task[]>;
  proposal(owner: string, id: string): Promise<Proposal | null>;
  selection(owner: string): Promise<Selection | null>;
}
export interface WorkStore extends WorkReader {
  calendarResult?(lease:Lease,run:()=>Promise<import('../domain/work.ts').View|null>,clock:Clock):Promise<import('../domain/work.ts').View|null>;
  prepareUi?(lease:Lease,now:number):Promise<void>;
  accept(input: Input, now: number, delivery: boolean): Promise<boolean>;
  claim(owner: string, now: number): Promise<Lease | null>;
  commit(lease: Lease, plan: Plan, now: number): Promise<void>;
  release(lease: Lease): Promise<void>;
  pendingOwners(): Promise<string[]>;
  result(owner: string, updateId: number): Promise<ViewResult | null>;
}
export type ViewResult = { text: string; buttons: Plan['view']['buttons'] };
