type FailureEvent =
  'mini_app' | 'browser_auth' | 'telegram_webhook' | 'scheduled_job' | 'inbox_command';
const miniAppPhases = new Set(['auth', 'ledger_read', 'draw_context', 'draw_prepare', 'commit']);
type MiniAppPhase = 'auth' | 'ledger_read' | 'draw_context' | 'draw_prepare' | 'commit';
const miniAppRoutes = new Set(['cultivation', 'bootstrap', 'linh-thu', 'other']);

// Request-local timings contain only fixed labels and bounded numbers.
export class MiniAppTiming {
  private readonly clock: () => number;
  private readonly started: number;
  private readonly phases = new Map<MiniAppPhase, number>();
  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
    this.started = clock();
  }
  record(phase: MiniAppPhase, durationMs: number) {
    if (
      !miniAppPhases.has(phase) ||
      !Number.isFinite(durationMs) ||
      durationMs < 0 ||
      durationMs > 3600000
    )
      return;
    this.phases.set(phase, Math.min(3600000, (this.phases.get(phase) ?? 0) + durationMs));
  }
  async measure<T>(phase: MiniAppPhase, run: () => Promise<T>): Promise<T> {
    const started = this.clock();
    try {
      return await run();
    } finally {
      this.record(phase, this.clock() - started);
    }
  }
  finish(response: Response, route: 'cultivation' | 'bootstrap' | 'linh-thu' | 'other'): Response {
    const elapsed = this.clock() - this.started;
    const durationMs = Number.isFinite(elapsed) ? Math.min(3600000, Math.max(0, elapsed)) : 0;
    const phases = Object.fromEntries(
      [...this.phases].map(([phase, ms]) => [phase, Math.round(ms)]),
    );
    const headers = new Headers(response.headers);
    headers.set(
      'Server-Timing',
      [['total', durationMs], ...this.phases]
        .map(([phase, ms]) => `${phase};dur=${Number(ms).toFixed(1)}`)
        .join(', '),
    );
    try {
      console.info(
        JSON.stringify({
          event: 'mini_app_timing',
          route: miniAppRoutes.has(route) ? route : 'other',
          status: response.status,
          durationMs: Math.round(durationMs),
          phases,
        }),
      );
    } catch {
      // Logging cannot change a committed result or cause a retry.
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
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
