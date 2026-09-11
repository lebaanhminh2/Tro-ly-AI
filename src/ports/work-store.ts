import type { Input, Task, Proposal, Selection, Plan } from '../domain/work.ts';
export type Clock = { now(): number };
export type Lease = { owner: string; token: string; input: Input; attempts: number };
export interface WorkReader {
  task(owner: string, id: string): Promise<Task | null>;
  tasks(owner: string, offset: number): Promise<Task[]>;
  proposal(owner: string, id: string): Promise<Proposal | null>;
  selection(owner: string): Promise<Selection | null>;
}
export interface WorkStore extends WorkReader {
  accept(input: Input, now: number, delivery: boolean): Promise<boolean>;
  claim(owner: string, now: number): Promise<Lease | null>;
  commit(lease: Lease, plan: Plan, now: number): Promise<void>;
  release(lease: Lease): Promise<void>;
  pendingOwners(): Promise<string[]>;
  result(owner: string, updateId: number): Promise<ViewResult | null>;
}
export type ViewResult = { text: string; buttons: Plan['view']['buttons'] };
