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

test('runtime declarations and validation reject retired game tools while keeping habit tools', async () => {
  const { TOOL_DECLARATIONS } = await import('../../src/ai/contracts.ts');
  const { validateTool } = await import('../../src/ai/policy.ts');
  type ToolCall = import('../../src/ai/contracts.ts').ToolCall;
  const names = TOOL_DECLARATIONS.map(tool => String(tool.name));
  assert.ok(names.includes('find_habits') && names.includes('habit_action'));
  for (const name of ['get_game', 'practice_action'])
    assert.throws(() => validateTool({ name, args: {} } as unknown as ToolCall, 0), /UNKNOWN_TOOL/);
  assert.ok(!names.includes('get_game') && !names.includes('practice_action'));
  validateTool({ name: 'find_habits', args: { query: '', status: 'active', cursor: 0 } }, 0);
});
