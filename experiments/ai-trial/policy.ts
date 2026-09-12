import type {Draft,Reply,Turn} from './contracts.ts';
export type Entity = { id: string; ownerId: string; type: 'task' | 'session' };
// Supplied by a validated UI selection, not the LLM or fixture expectations.
export type SelectedScope = { operation: Draft['operation']; entityId: string | null; field: Draft['field'] };
export type PolicyContext = { userId: string; entities: Entity[]; selectedScope?: SelectedScope };
export type Decision = { kind: 'chat' | 'clarify' | 'proposal'; text: string; pending: Draft | null; reason: string };

export function decide(reply: Reply, turns: Turn[], context: PolicyContext): Decision {
  const clarify = (reason: string, text: string): Decision => ({ kind: 'clarify', text, pending: null, reason });
  if (!reply.draft) return { kind: reply.kind === 'clarify' ? 'clarify' : 'chat', text: reply.reply, pending: null, reason: 'NO_MUTATION' };
  const draft = reply.draft;
  const last = turns.at(-1);
  if (last?.role !== 'user' || !last.text.includes(draft.evidence))
    return clarify('STALE_EVIDENCE', 'Cậu muốn đổi thông tin nào lúc này?');
  if (draft.operation === 'capture_task') {
    // Exact title grounding only; still pending confirmation, never saves anything.
    if (!last.text.includes(draft.value)) return clarify('UNGROUNDED_TITLE', 'Cậu muốn ghi tên việc là gì?');
    return { kind: 'proposal', text: `Tớ ghi việc “${draft.value}” nhé?`, pending: draft, reason: 'CAPTURE_CONFIRMATION' };
  }
  const entity = context.entities.find(e => e.id === draft.entityId && e.ownerId === context.userId);
  const requiredType = draft.operation === 'reschedule_session' ? 'session' : 'task';
  if (!entity || entity.type !== requiredType)
    return clarify('INVALID_ENTITY_SCOPE', 'Cậu đang nói đến việc hay buổi làm nào?');
  const scope = context.selectedScope;
  if (!scope || scope.operation !== draft.operation || scope.entityId !== draft.entityId || scope.field !== draft.field)
    return clarify('SCOPE_NOT_CONFIRMED', 'Cậu muốn đổi hạn nộp, buổi làm hay thông tin khác của việc này?');
  // Dates, progress and estimates need typed domain validation not yet implemented.
  return clarify('VALUE_VALIDATION_NOT_IMPLEMENTED', 'Tớ chưa kiểm tra được thay đổi này nên chưa tạo đề xuất cập nhật nhé.');
}
