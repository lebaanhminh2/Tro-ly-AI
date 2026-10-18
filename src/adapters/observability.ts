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
