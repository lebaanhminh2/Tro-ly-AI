import assert from 'node:assert/strict';
import test from 'node:test';
import { logFailure } from '../../src/adapters/observability.ts';
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
