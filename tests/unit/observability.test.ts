import assert from 'node:assert/strict';
import test from 'node:test';
import { logChatTiming, logFailure, measureChatPhase } from '../../src/adapters/observability.ts';
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
