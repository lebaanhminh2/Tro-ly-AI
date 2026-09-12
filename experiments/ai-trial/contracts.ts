export type Turn = { role: 'user' | 'model'; text: string };
export type Draft = {
  operation: 'capture_task' | 'update_task' | 'reschedule_session';
  entityId: string | null;
  field: 'title' | 'deadline' | 'progress' | 'estimate' | 'subtasks' | 'status' | 'session_time';
  value: string;
  certainty: 'confirmed' | 'tentative' | 'unknown';
  evidence: string;
};
export type Reply = { kind: 'chat' | 'clarify' | 'proposal'; reply: string; draft: Draft | null };

const operations = ['capture_task', 'update_task', 'reschedule_session'];
const fields = ['title', 'deadline', 'progress', 'estimate', 'subtasks', 'status', 'session_time'];
export const REPLY_SCHEMA = {
  type: 'object', required: ['kind', 'reply', 'draft'], additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['chat', 'clarify', 'proposal'] },
    reply: { type: 'string' },
    draft: { anyOf: [
      { type: 'null' },
      { type: 'object', additionalProperties: false,
        required: ['operation', 'entityId', 'field', 'value', 'certainty', 'evidence'],
        properties: {
          operation: { type: 'string', enum: operations },
          entityId: { type: ['string', 'null'] },
          field: { type: 'string', enum: fields }, value: { type: 'string' },
          certainty: { type: 'string', enum: ['confirmed', 'tentative', 'unknown'] },
          evidence: { type: 'string' }
        }
      }
    ] }
  }
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid AI output');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some(k => !(k in value)))
    throw new Error('Invalid AI fields');
}
function shortText(value: unknown, max = 3000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

// Untrusted model draft, not a user-facing proposal until policy approves it.
// Structural validation is not a truth/authorization check. No mutation executor exists here.
export function parseReply(text: string, turns: Turn[], allowedIds: string[] = []): Reply {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Invalid AI JSON'); }
  const value = object(raw);
  keys(value, ['kind', 'reply', 'draft']);
  if (!['chat', 'clarify', 'proposal'].includes(String(value.kind)) || !shortText(value.reply))
    throw new Error('Invalid AI reply');
  if (value.kind !== 'proposal') {
    if (value.draft !== null) throw new Error('Unexpected draft');
  } else {
    const draft = object(value.draft);
    keys(draft, ['operation', 'entityId', 'field', 'value', 'certainty', 'evidence']);
    if (!operations.includes(String(draft.operation)) || !fields.includes(String(draft.field)) ||
        !['confirmed', 'tentative', 'unknown'].includes(String(draft.certainty)) ||
        !shortText(draft.value) || !shortText(draft.evidence) ||
        !turns.some(t => t.role === 'user' && t.text.includes(draft.evidence as string)))
      throw new Error('Invalid draft evidence or fields');
    if (draft.operation === 'capture_task') {
      if (draft.entityId !== null || draft.field !== 'title') throw new Error('Invalid capture');
    } else {
      if (typeof draft.entityId !== 'string' || !allowedIds.includes(draft.entityId))
        throw new Error('Unknown draft entity');
      if ((draft.operation === 'reschedule_session') !== (draft.field === 'session_time'))
        throw new Error('Invalid draft scope');
    }
  }
  return value as Reply;
}
