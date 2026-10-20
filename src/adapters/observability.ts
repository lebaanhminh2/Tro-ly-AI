type FailureEvent =
  'mini_app' | 'browser_auth' | 'telegram_webhook' | 'scheduled_job' | 'inbox_command';
const codes = new Set([
  'REQUEST_ID_REUSED',
  'PLAN_CHANGED',
  'STALE_TASK',
  'HABIT_CHANGED',
  'HABIT_DAY_CLOSED',
  'AI_QUOTA',
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMIT',
  'COMMAND_REDACTED',
]);
// Never serialize the error, stack, request, account ID, prompt or tool payload.
export function logFailure(event: FailureEvent, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const code = codes.has(message)
    ? message
    : error instanceof TypeError
      ? 'PROGRAM_ERROR'
      : 'UNEXPECTED_ERROR';
  console.warn(JSON.stringify({ event, code }));
}

type ChatPhase =
  | 'inbox_accept'
  | 'reminder_reply'
  | 'schedule_activity'
  | 'webhook_prepare'
  | 'context_prepare'
  | 'context_data'
  | 'pending_read'
  | 'task_hierarchy'
  | 'schedule_context'
  | 'model_prepare'
  | 'model'
  | 'journal_lookup'
  | 'journal_context'
  | 'journal_start'
  | 'journal_finish'
  | 'journal_failure'
  | 'journal_reply'
  | 'command_commit'
  | 'reply_delivery'
  | 'webhook_total';

type ChatMetrics = {
  step?: number;
  inputChars?: number;
  promptTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
};

export async function measureChatPhase<T>(
  phase: ChatPhase,
  run: () => Promise<T>,
  clock: () => number = () => Date.now(),
  metrics: ChatMetrics = {},
): Promise<T> {
  const started = clock();
  let status: 'ok' | 'failed' = 'failed';
  try {
    const result = await run();
    status = 'ok';
    return result;
  } finally {
    logChatTiming(phase, clock() - started, status, metrics);
  }
}

// Operational numbers only. Never spread caller metadata into a log entry.
export function logChatTiming(
  phase: ChatPhase,
  durationMs: number,
  status: 'ok' | 'failed',
  metrics: ChatMetrics = {},
) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const step =
    Number.isInteger(metrics.step) && metrics.step! >= 0 && metrics.step! <= 2
      ? metrics.step
      : undefined;
  const inputChars =
    Number.isSafeInteger(metrics.inputChars) &&
    metrics.inputChars! >= 0 &&
    metrics.inputChars! <= 100000
      ? metrics.inputChars
      : undefined;
  const tokens: Partial<ChatMetrics> = {};
  for (const key of [
    'promptTokens',
    'outputTokens',
    'thinkingTokens',
    'cachedTokens',
    'totalTokens',
  ] as const) {
    const value = metrics[key];
    if (Number.isSafeInteger(value) && value! >= 0 && value! <= 1000000000) tokens[key] = value;
  }
  try {
    console.info(
      JSON.stringify({
        event: 'chat_timing',
        phase,
        durationMs: Math.round(durationMs),
        status,
        ...(step === undefined ? {} : { step }),
        ...(inputChars === undefined ? {} : { inputChars }),
        ...tokens,
      }),
    );
  } catch {
    // Diagnostic output must never turn a successful commit into a retry.
  }
}
