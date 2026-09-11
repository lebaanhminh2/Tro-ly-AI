import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseReply } from '../src/ai/contracts.ts';
import { GeminiTrial } from '../src/ai/gemini.ts';
import { PersistentBudget } from '../scripts/try-ai.ts';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide } from '../src/ai/policy.ts';
import { cases, syntheticInput } from './ai-cases.ts';
import type { Reply } from '../src/ai/contracts.ts';
import { TrialFlow, deadlineValue } from '../src/ai/trial-flow.ts';

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

const turns = [{ role: 'user' as const, text: 'đổi hạn môn A sang mai' }];
const chat = { kind: 'chat', reply: 'ừ, cậu kể tiếp đi', draft: null };
const envelope = (text = JSON.stringify(chat), reason = 'STOP') => new Response(JSON.stringify({
  candidates: [{ finishReason: reason, content: { parts: [{ text }] } }],
  usageMetadata: { promptTokenCount: 100, totalTokenCount: 130 }
}));
const make = (transport: typeof fetch, extras = {}) => new GeminiTrial({ apiKey: 'secret-test-key', model: 'test-model', transport, ...extras });

test('valid chat and pending proposal; no execution field accepted', () => {
  assert.deepEqual(parseReply(JSON.stringify(chat), turns), chat);
  const proposal = { kind: 'proposal', reply: 'đổi hạn môn A nhé?', draft: {
    operation: 'update_task', entityId: 'task-a', field: 'deadline', value: 'mai', certainty: 'tentative', evidence: 'đổi hạn môn A sang mai'
  } };
  assert.equal(parseReply(JSON.stringify(proposal), turns, ['task-a']).kind, 'proposal');
  assert.throws(() => parseReply(JSON.stringify({ ...chat, execute: true }), turns));
  assert.throws(() => parseReply(JSON.stringify(proposal), turns));
  proposal.draft.evidence = 'bịa';
  assert.throws(() => parseReply(JSON.stringify(proposal), turns, ['task-a']));
});

for (const input of ['oops', 'null', '[]', '{}', JSON.stringify({ ...chat, reply: '' }), JSON.stringify({ ...chat, kind: 'execute' }), JSON.stringify({ ...chat, draft: {} })]) {
  test(`reject malformed/unsafe shape: ${input}`, () => assert.throws(() => parseReply(input, turns)));
}

test('request uses fixed host, header secret, schema, persona; metrics use provider counts', async () => {
  const client = make(async (url, options) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
    assert.ok(!String(url).includes('secret'));
    assert.equal(new Headers(options?.headers).get('x-goog-api-key'), 'secret-test-key');
    const body = JSON.parse(String(options?.body));
    assert.ok(body.systemInstruction.parts[0].text.includes('không'));
    assert.ok(body.generationConfig.responseJsonSchema);
    assert.equal(body.contents[0].role, 'user');
    return envelope();
  });
  const result = await client.generate(turns, 'synthetic');
  assert.deepEqual(result.output, chat);
  assert.equal(result.metrics.tokens.totalTokenCount, 130);
  assert.equal(client.requestsUsed, 1);
});

for (const status of [400, 401, 403, 404, 429, 500, 503]) {
  test(`HTTP ${status}: sanitized error, no automatic retry`, async () => {
    let calls = 0;
    const client = make(async () => { calls++; return new Response('secret-test-key', { status }); });
    await assert.rejects(client.generate(turns, ''), { message: status === 429 ? 'PROVIDER_RATE_LIMIT' : `PROVIDER_HTTP_${status}` });
    assert.equal(calls, 1);
    assert.equal(client.requestsUsed, 1);
  });
}
test('timeout aborts request without leaking underlying error', async () => {
  const client = make(async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('secret-test-key')), { once: true });
  }), { timeoutMs: 5 });
  await assert.rejects(client.generate(turns, ''), { message: 'PROVIDER_TIMEOUT' });
});
test('network and invalid provider JSON are sanitized', async () => {
  for (const transport of [async () => { throw new Error('secret-test-key'); }, async () => new Response('secret-test-key')]) {
    await assert.rejects(make(transport).generate(turns, ''), { message: 'PROVIDER_TRANSPORT_OR_RESPONSE_ERROR' });
  }
});
test('blocked, truncated and invalid model outputs fail closed', async () => {
  await assert.rejects(make(async () => envelope('', 'MAX_TOKENS')).generate(turns, ''), { message: 'INCOMPLETE_OR_BLOCKED_RESPONSE' });
  await assert.rejects(make(async () => envelope('not JSON')).generate(turns, ''), { message: 'INVALID_MODEL_OUTPUT' });
});
test('budget and rolling rate enforced before network; clock rollover works', async () => {
  let now = 0;
  const client = make(async () => envelope(), { now: () => now, maxRequests: 5 });
  for (let n = 0; n < 4; n++) await client.generate(turns, '');
  await assert.rejects(client.generate(turns, ''), { message: 'LOCAL_RATE_LIMIT_WAIT' });
  now = 60000;
  await client.generate(turns, '');
  await assert.rejects(client.generate(turns, ''), { message: 'TRIAL_BUDGET_EXHAUSTED' });
  assert.equal(client.requestsUsed, 5);
});
test('invalid input/config rejected without network', async () => {
  assert.throws(() => make(async () => envelope(), { model: '../bad' }));
  assert.throws(() => make(async () => envelope(), { maxRequests: 31 }));
  const client = make(async () => { assert.fail('network must not run'); });
  await assert.rejects(client.generate([], ''), { message: 'INVALID_INPUT' });
  await assert.rejects(client.generate(turns, 'x'.repeat(24001)), { message: 'INVALID_INPUT' });
  assert.equal(client.requestsUsed, 0);
});

test('proposal checks operation/field scope and evidence from USER only', () => {
  const proposal = { kind: 'proposal', reply: 'đề xuất thôi nhé', draft: {
    operation: 'reschedule_session', entityId: 'session-a', field: 'deadline',
    value: 'mai', certainty: 'tentative', evidence: turns[0]!.text
  } };
  assert.throws(() => parseReply(JSON.stringify(proposal), turns, ['session-a']));
  proposal.draft.field = 'session_time';
  assert.equal(parseReply(JSON.stringify(proposal), turns, ['session-a']).kind, 'proposal');
  assert.throws(() => parseReply(JSON.stringify(proposal), [{ role: 'model', text: turns[0]!.text }], ['session-a']));
  proposal.draft.operation = 'delete_everything';
  assert.throws(() => parseReply(JSON.stringify(proposal), turns, ['session-a']));
});

test('CLI defaults to mock even with credentials; live requires explicit consent', () => {
  const env = { ...process.env, GEMINI_API_KEY: 'never-use-this-key', GEMINI_MODEL: 'invalid-network-test', GEMINI_FREE_TIER_VERIFIED: 'false' };
  const offline = spawnSync(process.execPath, ['scripts/try-ai.ts'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(offline.status, 0);
  assert.match(offline.stdout, /OFFLINE MOCK/);
  const live = spawnSync(process.execPath, ['scripts/try-ai.ts', '--live'], { env, encoding: 'utf8', timeout: 5000 });
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
  const run = spawnSync(process.execPath, ['scripts/try-ai.ts', '--live', '--confirm-synthetic-data'], {
    env: { ...process.env, GEMINI_API_KEY: 'fake', GEMINI_MODEL: 'fake', GEMINI_FREE_TIER_VERIFIED: 'true', TRIAL_BUDGET_PATH: 'elsewhere.json' },
    encoding: 'utf8', timeout: 5000
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /LIVE_CAMPAIGN_REQUIRES_NEW_APPROVAL/);
});
