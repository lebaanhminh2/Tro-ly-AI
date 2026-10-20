import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReply } from '../../experiments/ai-trial/contracts.ts';
import { GeminiTrial } from '../../experiments/ai-trial/gemini.ts';
import {Gemini} from '../../src/ai/gemini.ts';
import {modelStep,toolResponse} from '../../src/ai/contracts.ts';
import {validateTool} from '../../src/ai/policy.ts';

test('native usage metrics are optional, numeric and do not change request or model parts',async()=>{
 const content={role:'model',parts:[{thoughtSignature:'keep-signature',text:'Same reply'}]};
 const usageCases:[unknown,Record<string,number>][]=[
  [undefined,{}], [null,{}], ['private-metadata',{}], [[],{}],
  [{promptTokenCount:120,candidatesTokenCount:30,thoughtsTokenCount:10,cachedContentTokenCount:0,totalTokenCount:160,privateField:'private-metadata'},
   {promptTokens:120,outputTokens:30,thinkingTokens:10,cachedTokens:0,totalTokens:160}],
  [{promptTokenCount:'120',candidatesTokenCount:-1,thoughtsTokenCount:0.5,cachedContentTokenCount:1000000001,totalTokenCount:null},{}],
 ];
 const requests:unknown[]=[];
 for(const [usage,expected] of usageCases){
  const client=new Gemini({apiKey:'fake',model:'test-model',transport:async(_url,init)=>{
   requests.push(JSON.parse(String(init?.body)));
   return Response.json({candidates:[{finishReason:'STOP',content}],usageMetadata:usage});
  }});
  const result=await client.generateTools([{role:'user',parts:[{text:'Same input'}]}]);
  assert.deepEqual(result.metrics.tokens,expected);
  assert.deepEqual(result.output.content,content);
  assert.equal(result.output.text,'Same reply');
 }
 for(const request of requests)assert.deepEqual(request,requests[0]);
});

test('native adapter bounds failures and never logs or follows credentials on redirect',async()=>{
 for(const status of [302,400,401,403,404,408,429,500,503]){
  let calls=0;
  const client=new Gemini({apiKey:'private-test',model:'test-model',transport:async(_url,init)=>{
   calls++;assert.equal(init?.redirect,'manual');return new Response('private-test',{status,headers:{location:'https://not-called.invalid'}});
  }});
  await assert.rejects(client.generateTools([{role:'user',parts:[{text:'hi'}]}]),{message:status===429?'PROVIDER_RATE_LIMIT':`PROVIDER_HTTP_${status}`});
  assert.equal(calls,1);
 }
 const timed=new Gemini({apiKey:'private-test',model:'test-model',timeoutMs:5,transport:async(_url,init)=>new Promise((_resolve,reject)=>{
  init?.signal?.addEventListener('abort',()=>reject(Error('private-test')),{once:true});
 })});
 await assert.rejects(timed.generateTools([{role:'user',parts:[{text:'hi'}]}]),{message:'PROVIDER_TIMEOUT'});
});

test('native adapter distinguishes invalid output from transport failure without exposing provider details',async()=>{
 const user={role:'user' as const,parts:[{text:'hi'}]};
 const cases:[()=>Response,string][]=[
  [()=>new Response('private-test: invalid JSON'),'PROVIDER_INVALID_RESPONSE'],
  [()=>Response.json({candidates:[]}), 'PROVIDER_INVALID_RESPONSE'],
  [()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{role:'model',parts:[{text:'unfinished'}]}}]}),'PROVIDER_INVALID_RESPONSE'],
  [()=>Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{functionCall:{name:'run_sql',args:{sql:'private-test'}}}]}}]}),'PROVIDER_INVALID_RESPONSE'],
  [()=>new Response('x'.repeat(200001)), 'PROVIDER_RESPONSE_TOO_LARGE'],
  [()=>{throw Error('private-test: network details');},'PROVIDER_TRANSPORT_ERROR'],
 ];
 for(const [respond,code] of cases){
  let calls=0;
  const client=new Gemini({apiKey:'private-test',model:'test-model',transport:async()=>{calls++;return respond();}});
  await assert.rejects(client.generateTools([user]),{message:code});
  assert.equal(calls,1,'Failures never trigger a hidden model retry');
 }
});

test('native adapter accepts a 9.25s response within budget and rejects a result arriving after abort',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let complete!:(response:Response)=>void;
 let signal:AbortSignal|undefined;
 const client=new Gemini({apiKey:'private-test',model:'test-model',timeoutMs:20000,transport:async(_url,options)=>{
  signal=options?.signal??undefined;
  // Deliberately ignore abort, as a non-compliant transport might do.
  return new Promise<Response>(resolve=>{complete=resolve;});
 }});
 const response=()=>Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'hello'}]}}]});
 const first=client.generateTools([{role:'user',parts:[{text:'hi'}]}]);
 t.mock.timers.tick(9250);
 assert.equal(signal?.aborted,false);
 complete(response());
 assert.equal((await first).output.text,'hello');
 const late=client.generateTools([{role:'user',parts:[{text:'hi again'}]}]);
 t.mock.timers.tick(20000);
 assert.equal(signal?.aborted,true);
 complete(response());
 await assert.rejects(late,{message:'PROVIDER_TIMEOUT'});
});

test('native function calling preserves signature and call ID across tool response without JSON-output mode',async()=>{
 const content={role:'model' as const,parts:[{thoughtSignature:'opaque-signature',functionCall:{id:'call-1',name:'create_task',args:{title:'rửa bát',deadline:{value:'2026-09-12T19:00:00+07:00',precision:'datetime'}}}}]};
 const inputs:{role:'user'|'model';parts:Record<string,unknown>[]}[][]=[];let calls=0;
 const client=new Gemini({apiKey:'fake',model:'test-model',transport:async(_url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));inputs.push(body.contents);
  assert.ok(body.tools[0].functionDeclarations.some((t:{name:string})=>t.name==='create_task'));
  assert.equal(body.generationConfig.responseMimeType,undefined);
  return Response.json({candidates:[{finishReason:'STOP',content:calls===1?content:{role:'model',parts:[{text:'Tớ ghi rồi nhé.'}]}}]});
 }});
 const user={role:'user' as const,parts:[{text:'Thêm cho tớ việc rửa bát deadline 7h tối nay nhé'}]};
 const first=await client.generateTools([user],'Synthetic system');
 const call=first.output.calls[0]!;validateTool(call,Date.parse('2026-09-12T08:00:00+07:00'));
 assert.equal(first.output.content.parts[0]!.thoughtSignature,'opaque-signature');
 const response=toolResponse(call,{status:'applied',task_id:'t1'});
 assert.deepEqual(response,{functionResponse:{id:'call-1',name:'create_task',response:{status:'applied',task_id:'t1'}}});
 const final=await client.generateTools([user,first.output.content,{role:'user',parts:[response]}],'Synthetic system',false);
 assert.deepEqual(inputs[1]![1],content);assert.equal(final.output.text,'Tớ ghi rồi nhé.');
});

test('tools validate typed fields instead of requiring a natural-language phrase',()=>{
 const now=Date.parse('2026-09-12T08:00:00+07:00');
 assert.doesNotThrow(()=>validateTool({name:'create_task',args:{title:'Rửa bát',deadline:{value:'2026-09-12T19:00:00+07:00',precision:'datetime'}}},now));
 assert.doesNotThrow(()=>validateTool({name:'create_task',args:{title:'Việc chỉ có ngày',deadline:{value:'2026-09-13',precision:'date'}}},now));
 assert.throws(()=>validateTool({name:'create_task',args:{title:'test',deadline:null,owner:'other'}},now),/INVALID_TOOL_FIELDS/);
 assert.throws(()=>validateTool({name:'create_task',args:{title:'test',deadline:{value:'2026-02-30',precision:'date'}}},now),/INVALID_DATE/);
 assert.throws(()=>validateTool({name:'create_task',args:{title:'test',deadline:{value:'2026-09-12T24:00:00Z',precision:'datetime'}}},now),/INVALID_TIME/);
 assert.throws(()=>validateTool({name:'update_task',args:{task_id:'t',expected_version:1,patch:{owner:'other'}}},now),/INVALID_TOOL_FIELDS/);
 assert.throws(()=>validateTool({name:'set_reminder',args:{task_id:'t',expected_version:1,at:'2026-09-11T19:00:00+07:00'}},now),/REMINDER_IN_PAST/);
 assert.throws(()=>modelStep({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{functionCall:{name:'run_sql',args:{sql:'DROP TABLE tasks'}}}]}}]}),/UNKNOWN_TOOL/);
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
