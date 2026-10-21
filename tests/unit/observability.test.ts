import assert from 'node:assert/strict';
import test from 'node:test';
import {
  logChatTiming,
  logFailure,
  measureChatPhase,
  MiniAppTiming,
} from '../../src/adapters/observability.ts';

test('mini app timings expose only fixed phases, route and numbers in logs and Server-Timing', async (t) => {
  const lines: string[] = [];
  t.mock.method(console, 'info', (value: unknown) => lines.push(String(value)));
  let now = 0;
  const timing = new MiniAppTiming(() => now);
  const result = { secret: 'private-result' };
  assert.equal(
    await timing.measure('ledger_read', async () => {
      now += 12;
      return result;
    }),
    result,
  );
  const error = Error('private-token');
  await assert.rejects(
    timing.measure('commit', async () => {
      now += 7;
      throw error;
    }),
    (caught) => caught === error,
  );
  timing.record('auth', NaN);
  timing.record('auth', -1);
  timing.record('auth', 3600001);
  timing.record('private-owner' as any, 10);
  now = 22;
  const response = timing.finish(
    new Response('private-body', {
      status: 409,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    }),
    'cultivation',
  );
  assert.equal(await response.text(), 'private-body');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(
    response.headers.get('Server-Timing'),
    'total;dur=22.0, ledger_read;dur=12.0, commit;dur=7.0',
  );
  assert.deepEqual(JSON.parse(lines[0]!), {
    event: 'mini_app_timing',
    route: 'cultivation',
    status: 409,
    durationMs: 22,
    phases: { ledger_read: 12, commit: 7 },
  });
  assert.doesNotMatch(lines.join('') + response.headers.get('Server-Timing'), /private-/);
  const other = new MiniAppTiming(() => 0).finish(
    new Response(null, { status: 401 }),
    'private-route' as any,
  );
  assert.equal(other.status, 401);
  assert.equal(JSON.parse(lines[1]!).route, 'other');
});

test('a failing timing sink preserves successful responses and cannot trigger another mutation', async (t) => {
  t.mock.method(console, 'info', () => {
    throw Error('sink failed');
  });
  const timing = new MiniAppTiming(() => 0);
  let commits = 0;
  const response = await timing.measure('commit', async () => {
    commits++;
    return Response.json({ result: 'confirmed' });
  });
  assert.deepEqual(await timing.finish(response, 'cultivation').json(), { result: 'confirmed' });
  assert.equal(commits, 1);
});
test('failure logs expose only fixed events and allowlisted codes', () => {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (value: unknown) => lines.push(String(value));
  try {
    logFailure('mini_app', Error('password=secret token=private prompt=personal'));
    logFailure('scheduled_job', new TypeError('personal text'));
    logFailure('inbox_command', Error('AI_QUOTA'));
    assert.deepEqual(
      lines.map((line) => JSON.parse(line)),
      [
        { event: 'mini_app', code: 'UNEXPECTED_ERROR' },
        { event: 'scheduled_job', code: 'PROGRAM_ERROR' },
        { event: 'inbox_command', code: 'AI_QUOTA' },
      ],
    );
  } finally {
    console.warn = original;
  }
});

test('timing logs accept only bounded numeric usage and never serialize supplied content', (t) => {
  const lines: string[] = [];
  t.mock.method(console, 'info', (value: unknown) => lines.push(String(value)));
  const metadata = {
    step: 1,
    inputChars: 234,
    promptTokens: 200,
    outputTokens: 0,
    thinkingTokens: -1,
    cachedTokens: NaN,
    totalTokens: 1000000001,
    owner: 'private-owner',
    prompt: 'private-text',
    apiKey: 'private-key',
  };
  logChatTiming('model', 12.4, 'ok', metadata);
  assert.deepEqual(JSON.parse(lines[0]!), {
    event: 'chat_timing',
    phase: 'model',
    durationMs: 12,
    status: 'ok',
    step: 1,
    inputChars: 234,
    promptTokens: 200,
    outputTokens: 0,
  });
  assert.doesNotMatch(lines.join(''), /private-/);
});

test('phase measurement preserves results and original errors even if logging fails', async (t) => {
  const lines: string[] = [];
  t.mock.method(console, 'info', (value: unknown) => lines.push(String(value)));
  let now = 100;
  const value = { result: 'unchanged' };
  assert.equal(
    await measureChatPhase(
      'journal_start',
      async () => {
        now += 7;
        return value;
      },
      () => now,
      { step: 0 },
    ),
    value,
  );
  const error = Error('private-database-error');
  await assert.rejects(
    measureChatPhase(
      'command_commit',
      async () => {
        now += 9;
        throw error;
      },
      () => now,
    ),
    (caught) => caught === error,
  );
  assert.deepEqual(
    lines.map((line) => JSON.parse(line)),
    [
      { event: 'chat_timing', phase: 'journal_start', durationMs: 7, status: 'ok', step: 0 },
      { event: 'chat_timing', phase: 'command_commit', durationMs: 9, status: 'failed' },
    ],
  );
  t.mock.method(console, 'info', () => {
    throw Error('log sink failed');
  });
  assert.equal(
    await measureChatPhase(
      'command_commit',
      async () => value,
      () => now,
    ),
    value,
  );
  await assert.rejects(
    measureChatPhase(
      'command_commit',
      async () => {
        throw error;
      },
      () => now,
    ),
    (caught) => caught === error,
  );
});
