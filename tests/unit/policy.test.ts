import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../../experiments/ai-trial/policy.ts';
import type { Reply } from '../../experiments/ai-trial/contracts.ts';

const text = 'dời buổi vẽ';
const draft: Reply = { kind: 'proposal', reply: 'Đã đổi', draft: {
  operation: 'reschedule_session', entityId: 's', field: 'session_time', value: 'mai',
  certainty: 'tentative', evidence: text
} };
test('policy rejects foreign ownership and wrong entity type before proposal', () => {
  for (const entity of [{ id: 's', ownerId: 'other', type: 'session' as const },
    { id: 's', ownerId: 'u', type: 'task' as const }]) {
    const decision = decide(draft, [{ role: 'user', text }], { userId: 'u', entities: [entity] });
    assert.equal(decision.pending, null);
    assert.equal(decision.reason, 'INVALID_ENTITY_SCOPE');
    assert.notEqual(decision.text, draft.reply);
  }
});
test('policy does not use prior turn evidence as current authorization', () => {
  const decision = decide(draft, [{ role: 'user', text: 'thôi không đổi nữa' }], { userId: 'u', entities: [] });
  assert.equal(decision.reason, 'STALE_EVIDENCE');
  assert.equal(decision.pending, null);
});
