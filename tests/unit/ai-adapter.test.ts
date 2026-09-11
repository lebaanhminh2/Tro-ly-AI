import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReply } from '../../src/ai/contracts.ts';
import { GeminiTrial } from '../../src/ai/gemini.ts';

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


