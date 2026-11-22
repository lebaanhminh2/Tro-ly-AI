// Use the server's wall clock anchored to a monotonic local clock. Changing the
// device's date cannot finish a timer or decide whether a reward is available.
export function firstStepClock(monotonic = () => performance.now()) {
  let anchor = null;
  return {
    sync(serverNow) {
      if (!Number.isSafeInteger(serverNow) || serverNow < 0) throw Error('INVALID_SERVER_TIME');
      anchor = { serverNow, at: monotonic() };
    },
    now() {
      return anchor ? anchor.serverNow + Math.max(0, monotonic() - anchor.at) : null;
    },
  };
}

export function readFirstStepIntent(value, owner) {
  if (
    !value ||
    value.owner !== owner ||
    !['start', 'claim', 'cancel', 'outside'].includes(value.operation) ||
    typeof value.occurrenceId !== 'string' ||
    typeof value.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(value.occurrenceId ?? '') ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(value.requestId ?? '')
  )
    return null;
  return {
    owner,
    operation: value.operation,
    occurrenceId: value.occurrenceId,
    requestId: value.requestId,
  };
}
