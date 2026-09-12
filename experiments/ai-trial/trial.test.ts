import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PersistentBudget } from './try-ai.ts';
import { TrialFlow } from './trial-flow.ts';
import { deadlineValue } from '../../src/domain/time.ts';
import { cases, syntheticInput } from './ai-cases.ts';
import { decide } from './policy.ts';
import type { Reply } from './contracts.ts';
const chat = { kind: 'chat', reply: 'ừ, cậu kể tiếp đi', draft: null };

function capturedFlow(clock = () => Date.parse('2026-09-11T10:00:00+07:00')) {
  const flow = new TrialFlow(clock);
  const text = 'còn bài dựng hình';
  const result = flow.receive('u', text, { kind: 'proposal', reply: 'hạn khi nào?', draft: {
    operation: 'capture_task', entityId: null, field: 'title', value: 'bài dựng hình', certainty: 'confirmed', evidence: text } });
  assert.deepEqual(flow.snapshot('u'), []);
  flow.confirm('u', result.proposalId!);
  return { flow, capture: result.proposalId!, id: flow.snapshot('u')[0]!.id };
}
test('full offline capture, clarify, proposal, confirmation flow', () => {
  const { flow, id, capture } = capturedFlow();
  flow.confirm('u', capture);
  assert.equal(flow.snapshot('u').length, 1);
  flow.selectDeadline('u', id);
  assert.equal(flow.receive('u', 'mai 8h', chat as Reply).kind, 'clarify');
  const result = flow.receive('u', '12/09/2026 20:00', chat as Reply);
  assert.equal(result.kind, 'proposal');
  assert.equal(flow.snapshot('u')[0]!.deadline, null);
  flow.confirm('u', result.proposalId!);
  flow.confirm('u', result.proposalId!);
  assert.equal(flow.snapshot('u')[0]!.deadline, '2026-09-12T20:00:00+07:00');
  assert.equal(flow.snapshot('u')[0]!.version, 2);
});
test('stale parallel proposals, owner, expiry, rejection and selection cancellation', () => {
  let now = Date.parse('2026-09-11T10:00:00+07:00');
  const { flow, id } = capturedFlow(() => now);
  const propose = () => { flow.selectDeadline('u', id); return flow.receive('u', '13/09/2026 09:30', chat as Reply).proposalId!; };
  const first = propose();
  const second = propose();
  assert.throws(() => flow.confirm('other', first), /NOT_AVAILABLE/);
  assert.throws(() => flow.selectDeadline('other', id), /NOT_AVAILABLE/);
  flow.confirm('u', second);
  assert.throws(() => flow.confirm('u', first), /STALE/);
  const rejected = propose();
  flow.confirm('u', rejected, false);
  flow.confirm('u', rejected);
  assert.equal(flow.snapshot('u')[0]!.version, 2);
  const expired = propose(); now += 300000;
  assert.throws(() => flow.confirm('u', expired), /EXPIRED/);
  flow.selectDeadline('u', id); flow.cancelSelection('u');
  assert.equal(flow.receive('u', '13/09/2026 09:30', chat as Reply).kind, 'chat');
});
test('strict date validation rejects impossible, ambiguous and past dates', () => {
  for (const input of ['31/02/2026 20:00', '29/02/2025 12:00', '12/13/2026 09:00', '12/09/2026 24:00', '12/09/2026', 'mai', '12/09/2026 12:99'])
    assert.equal(deadlineValue(input), null);
  assert.equal(deadlineValue('29/02/2028 00:00'), '2028-02-29T00:00:00+07:00');
  const { flow, id } = capturedFlow(); flow.selectDeadline('u', id);
  assert.equal(flow.receive('u', '10/09/2026 09:00', chat as Reply).kind, 'clarify');
  assert.equal(flow.snapshot('u')[0]!.deadline, null);
});

test('CLI defaults to mock even with credentials; live requires explicit consent', () => {
  const env = { ...process.env, GEMINI_API_KEY: 'never-use-this-key', GEMINI_MODEL: 'invalid-network-test', GEMINI_FREE_TIER_VERIFIED: 'false' };
  const offline = spawnSync(process.execPath, ['experiments/ai-trial/try-ai.ts'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(offline.status, 0);
  assert.match(offline.stdout, /OFFLINE MOCK/);
  const live = spawnSync(process.execPath, ['experiments/ai-trial/try-ai.ts', '--live'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(live.status, 1);
  assert.match(live.stderr, /requires explicit/);
  assert.ok(!live.stderr.includes(env.GEMINI_API_KEY));
});

test('persistent campaign budget starts after prior request and survives instances', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'ai-budget-')), 'budget.json');
  assert.equal(new PersistentBudget(path, 3, 1).read().used, 1);
  assert.equal(new PersistentBudget(path, 3, 1).reserve().used, 2);
  assert.equal(new PersistentBudget(path, 3, 1).reserve().used, 3);
  assert.throws(() => new PersistentBudget(path, 3, 1).reserve(), /EXHAUSTED/);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).used, 3);
});

test('persistent budget fails closed on corrupt or inconsistent state', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'ai-budget-bad-')), 'budget.json');
  writeFileSync(path, '{bad json', 'utf8');
  assert.throws(() => new PersistentBudget(path).read());
  writeFileSync(path, JSON.stringify({ campaign: 'wrong', used: 1, limit: 7, updatedAt: '' }), 'utf8');
  assert.throws(() => new PersistentBudget(path).read());
});

for (const [id] of cases) {
  test(`${id}: fixtures have consistent references and explicit user ownership`, () => {
    const input = syntheticInput(id);
    const context = JSON.parse(input.context);
    for (const session of context.sessions) assert.ok(context.tasks.some((t: { id: string }) => t.id === session.taskId));
    for (const entity of input.entities) assert.equal(entity.ownerId, 'user-test');
    if (id === 'T01') assert.equal(input.entities.length, 0);
  });
}
const reschedule = (evidence: string): Reply => ({ kind: 'proposal', reply: 'Tớ đã dời lịch rồi', draft: {
  operation: 'reschedule_session', entityId: 'session-a', field: 'session_time', value: 'mai', certainty: 'tentative', evidence
} });
for (const message of ['đổi báo cáo môn A sang mai', 'mai làm hết', 'để hôm sau vậy']) {
  test(`unselected scope never promotes draft: ${message}`, () => {
    const input = syntheticInput('T03');
    const result = decide(reschedule(message), [{ role: 'user', text: message }], { userId: 'user-test', entities: input.entities });
    assert.equal(result.kind, 'clarify');
    assert.equal(result.pending, null);
    assert.ok(!result.text.includes('đã dời'));
  });
}
test('capture policy replaces unnecessary deadline question without claiming saved', () => {
  const input = syntheticInput('T01');
  const result = decide({ kind: 'proposal', reply: 'bao giờ nộp?', draft: { operation: 'capture_task', entityId: null,
    field: 'title', value: 'bài báo cáo môn A', certainty: 'confirmed', evidence: input.turns[0]!.text } }, input.turns,
  { userId: 'user-test', entities: [] });
  assert.equal(result.kind, 'proposal');
  assert.ok(!result.text.includes('bao giờ'));
});
test('wrong entity type, wrong owner, stale evidence and unvalidated value fail closed', () => {
  const input = syntheticInput('T03');
  const evidence = input.turns[0]!.text;
  for (const entities of [[{ id: 'session-a', type: 'task' as const, ownerId: 'user-test' }],
    [{ id: 'session-a', type: 'session' as const, ownerId: 'other' }]]) {
    assert.equal(decide(reschedule(evidence), input.turns, { userId: 'user-test', entities }).reason, 'INVALID_ENTITY_SCOPE');
  }
  assert.equal(decide(reschedule('old message'), input.turns, { userId: 'user-test', entities: input.entities }).reason, 'STALE_EVIDENCE');
  assert.equal(decide(reschedule(evidence), input.turns, { userId: 'user-test', entities: input.entities,
    selectedScope: { operation: 'reschedule_session', entityId: 'session-a', field: 'session_time' } }).reason, 'VALUE_VALIDATION_NOT_IMPLEMENTED');
});
test('budget refuses an existing process lock without changing state', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'ai-locked-')), 'budget.json');
  writeFileSync(`${path}.lock`, '', 'utf8');
  assert.throws(() => new PersistentBudget(path).reserve());
  assert.equal(new PersistentBudget(path).read().used, 1);
});
test('new live revision is disabled even if env claims consent and changes paths', () => {
  const run = spawnSync(process.execPath, ['experiments/ai-trial/try-ai.ts', '--live', '--confirm-synthetic-data'], {
    env: { ...process.env, GEMINI_API_KEY: 'fake', GEMINI_MODEL: 'fake', GEMINI_FREE_TIER_VERIFIED: 'true', TRIAL_BUDGET_PATH: 'elsewhere.json' },
    encoding: 'utf8', timeout: 5000
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /LIVE_CAMPAIGN_REQUIRES_NEW_APPROVAL/);
});
