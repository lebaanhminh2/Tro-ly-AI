import { parseReply } from './contracts.ts';
import type { Reply, Turn } from './contracts.ts';
import { decide } from './policy.ts';

export type Task = { id: string; ownerId: string; title: string; deadline: string | null; version: number };
type Proposal = { id: string; ownerId: string; taskId: string; version: number; expiresAt: number;
  status: 'pending' | 'accepted' | 'rejected'; change: { title: string } | { deadline: string }; };
export type FlowResult = { kind: 'clarify' | 'proposal' | 'saved' | 'chat'; text: string; proposalId?: string };

// Deliberately narrow format: DD/MM/YYYY HH:mm, UTC+7. Never use Date.parse on natural language.
export function deadlineValue(raw: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [day, month, year, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (year < 2000 || year > 2100 || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00+07:00`;
}

// In-memory synthetic workflow, not a database/Calendar implementation.
export class TrialFlow {
  private tasks = new Map<string, Task>();
  private proposals = new Map<string, Proposal>();
  private selections = new Map<string, string>();
  private counter = 0;
  private now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }
  snapshot(userId: string): Task[] { return [...this.tasks.values()].filter(t => t.ownerId === userId).map(t => ({ ...t })); }
  selectDeadline(userId: string, taskId: string): void {
    this.owned(userId, taskId);
    this.selections.set(userId, taskId);
  }
  cancelSelection(userId: string): void { this.selections.delete(userId); }
  private owned(userId: string, taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task || task.ownerId !== userId) throw new Error('TASK_NOT_AVAILABLE');
    return task;
  }
  private propose(userId: string, taskId: string, version: number, change: Proposal['change']): FlowResult {
    const id = `proposal-${++this.counter}`;
    this.proposals.set(id, { id, ownerId: userId, taskId, version, change,
      expiresAt: this.now() + 300000, status: 'pending' });
    const text = 'title' in change ? `Ghi việc “${change.title}” nhé?` :
      `Hạn nộp “${this.owned(userId, taskId).title}”: ${this.owned(userId, taskId).deadline ?? 'chưa biết'} → ${change.deadline}. Xác nhận đổi nhé?`;
    return { kind: 'proposal', proposalId: id, text };
  }
  receive(userId: string, text: string, model: Reply): FlowResult {
    const turns: Turn[] = [{ role: 'user', text }];
    const selected = this.selections.get(userId);
    // A typed/UI selection establishes scope, not an LLM assertion.
    if (selected) {
      const task = this.owned(userId, selected);
      const value = deadlineValue(text);
      if (!value) return { kind: 'clarify', text: 'Cậu ghi ngày và giờ theo DD/MM/YYYY HH:mm nhé (giờ Việt Nam). Có thể hủy nếu không muốn đổi nữa.' };
      if (Date.parse(value) <= this.now()) return { kind: 'clarify', text: 'Mốc này đã qua rồi, cậu kiểm tra lại ngày giờ nhé.' };
      this.selections.delete(userId);
      return this.propose(userId, task.id, task.version, { deadline: value });
    }
    const entities = this.snapshot(userId).map(t => ({ id: t.id, ownerId: t.ownerId, type: 'task' as const }));
    const reply = parseReply(JSON.stringify(model), turns, entities.map(e => e.id));
    const decision = decide(reply, turns, { userId, entities });
    if (decision.pending?.operation === 'capture_task')
      return this.propose(userId, `task-${++this.counter}`, 0, { title: decision.pending.value });
    return { kind: decision.kind === 'proposal' ? 'clarify' : decision.kind, text: decision.text };
  }
  confirm(userId: string, proposalId: string, accept = true): FlowResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.ownerId !== userId) throw new Error('PROPOSAL_NOT_AVAILABLE');
    if (proposal.status !== 'pending') return { kind: 'chat', text: 'Lựa chọn này đã được xử lý rồi.' };
    if (this.now() >= proposal.expiresAt) throw new Error('PROPOSAL_EXPIRED');
    if (!accept) { proposal.status = 'rejected'; return { kind: 'chat', text: 'Ừ, không đổi nhé.' }; }
    if ('title' in proposal.change) {
      this.tasks.set(proposal.taskId, { id: proposal.taskId, ownerId: userId, title: proposal.change.title, deadline: null, version: 1 });
    } else {
      const task = this.owned(userId, proposal.taskId);
      if (task.version !== proposal.version) throw new Error('STALE_PROPOSAL');
      if (Date.parse(proposal.change.deadline) <= this.now()) throw new Error('DEADLINE_IN_PAST');
      this.tasks.set(task.id, { ...task, deadline: proposal.change.deadline, version: task.version + 1 });
    }
    proposal.status = 'accepted';
    return { kind: 'saved', text: 'Đã cập nhật dữ liệu thử.' };
  }
}
