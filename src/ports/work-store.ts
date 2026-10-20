import type { Input, Task, Proposal, Selection, Plan } from '../domain/work.ts';
// Structural transaction port; storage implementation supplies the statements.
export interface PreparedWrite {
  bind(...values: (string | number | null)[]): PreparedWrite;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export type Clock = { now(): number };
export type Lease = {
  pendingWrites?: PreparedWrite[];
  owner: string;
  token: string;
  input: Input;
  attempts: number;
  ui?: { card: import('../domain/ui.ts').Card; action: import('../domain/ui.ts').CardAction };
  uiStale?: boolean;
  uiRecovered?: boolean;
};
export interface WorkReader {
  habitCompanion?: import('./habit-companion.ts').HabitCompanion;
  taskFocus?(
    owner: string,
    now: number,
  ): Promise<{
    taskId: string | null;
    day: number;
    planGeneration: number;
    planVersion: number;
    startedAt: number;
    endsAt: number;
  } | null>;
  notificationState?(owner: string, now: number): Promise<{ reason: string; until: number | null }>;
  hasOpenSteps?(owner: string, taskId: string): Promise<boolean>;
  scheduleDialog?(owner: string, now: number, open: boolean): Promise<void>;
  prepareStep?(
    owner: string,
    requestId: string,
    args: {
      operation: string;
      taskId: string;
      stepId?: string;
      version: number;
      title?: string;
      complete?: boolean;
    },
    now: number,
  ): Promise<{ result: Record<string, unknown>; statements: PreparedWrite[] }>;
  isMorningReply?(owner: string, messageId: number | undefined, now: number): Promise<boolean>;
  scheduleContext?(owner: string, now: number): Promise<Record<string, unknown> | null>;
  prepareSchedule?(
    owner: string,
    now: number,
    version: number,
    free: import('../domain/availability.ts').TimeRange[],
    busy: import('../domain/availability.ts').TimeRange[],
    estimates: { id: string; minutes: number }[],
    requestId: string,
  ): Promise<{ plan: Record<string, unknown>; statements: PreparedWrite[] }>;

  reportSleep?(
    owner: string,
    now: number,
  ): Promise<{ applied: boolean; delta: number; demoted: boolean }>;
  progress?(owner: string, now?: number): Promise<import('../domain/progress.ts').ProgressData>;
  conversationProgress?(
    owner: string,
    now?: number,
  ): Promise<import('../domain/progress.ts').ProgressData>;
  workPage?(
    owner: string,
    filter: import('../domain/progress.ts').WorkFilter,
    offset: number,
    now: number,
  ): Promise<import('../domain/progress.ts').WorkPage>;
  boardSelection?(owner: string): Promise<import('../domain/progress.ts').BoardSelection>;

  priorityTasks?(owner: string): Promise<import('../domain/work.ts').Task[]>;
  unsummarized?(
    owner: string,
    now: number,
    after: number,
  ): Promise<import('../domain/memory.ts').ConversationTurn[]>;
  event?(owner: string, id: string): Promise<import('../domain/event.ts').LocalEvent | null>;
  events?(
    owner: string,
    from: number,
    to: number,
  ): Promise<import('../domain/event.ts').LocalEvent[]>;
  appointmentContext?(owner: string, now: number): Promise<Record<string, unknown>[]>;
  clarifications?(
    owner: string,
    now: number,
  ): Promise<import('../domain/conversation.ts').Clarification[]>;
  summary?(owner: string): Promise<import('../domain/conversation.ts').Summary | null>;

  findTasks?(
    owner: string,
    query: string,
    status: 'active' | 'completed' | 'all',
    cursor: number,
  ): Promise<{ tasks: Task[]; nextCursor: number | null }>;
  agenda?(
    owner: string,
    from: number,
    to: number,
    cursor: number,
  ): Promise<Record<string, unknown>>;
  completionUndo?(owner: string, taskId: string, version: number, now: number): Promise<boolean>;
  conversationTasks?(owner: string, text: string): Promise<Task[]>;
  sameTitleTasks?(owner: string, title: string): Promise<Task[]>;
  conversationPending?(
    owner: string,
    now: number,
  ): Promise<import('../domain/conversation.ts').PendingConversation | null>;
  runningSession(owner: string): Promise<import('../domain/session.ts').Session | null>;
  memory(owner: string, id: string): Promise<import('../domain/memory.ts').Memory | null>;
  memories(
    owner: string,
    now: number,
    offset?: number,
    limit?: number,
  ): Promise<import('../domain/memory.ts').Memory[]>;
  memoryConfirmation(
    owner: string,
    id: string,
  ): Promise<import('../domain/memory.ts').MemoryConfirmation | null>;
  history(owner: string, now: number): Promise<import('../domain/memory.ts').ConversationTurn[]>;
  focus(owner: string, now: number): Promise<string | null>;
  aiEnabled(owner: string): Promise<boolean>;
  sessions(
    owner: string,
    start: number,
    end: number,
  ): Promise<import('../domain/session.ts').Session[]>;
  session(owner: string, id: string): Promise<import('../domain/session.ts').Session | null>;
  sessionInput(owner: string): Promise<{ task_id: string; expires: number } | null>;
  preferences(owner: string): Promise<import('../domain/session.ts').Preferences | null>;
  task(owner: string, id: string): Promise<Task | null>;
  tasks(owner: string, offset: number): Promise<Task[]>;
  historyPage?(
    owner: string,
    offset?: number,
    limit?: number,
  ): Promise<{
    items: Record<string, unknown>[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  }>;
  archiveCompleted?(
    owner: string,
    now: number,
    retentionDays?: number,
    limit?: number,
  ): Promise<{ archived: number }>;
  proposal(owner: string, id: string): Promise<Proposal | null>;
  selection(owner: string): Promise<Selection | null>;
}
export interface WorkStore extends WorkReader {
  reportFailure?(error: unknown): void;
  prepareUi?(lease: Lease, now: number): Promise<void>;
  accept(input: Input, now: number, delivery: boolean): Promise<boolean>;
  claim(owner: string, now: number): Promise<Lease | null>;
  commit(lease: Lease, plan: Plan, now: number): Promise<void>;
  release(lease: Lease): Promise<void>;
  pendingOwners(): Promise<string[]>;
  result(owner: string, updateId: number): Promise<ViewResult | null>;
}
export type ViewResult = { text: string; buttons: Plan['view']['buttons'] };
