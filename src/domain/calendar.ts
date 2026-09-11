export type Interval = { start: number; end: number };
export type CalendarRef = { id: string; owner: string; external_id: string; name: string; selected: number; managed: number; sync_token: string | null; synced_at: number | null; revision: number };
export type Connection = { owner: string; refresh_cipher: string | null; revision: number; status: string; managed_id: string | null };
export class CalendarError extends Error {
  constructor(code: string) { super(code); this.name = 'CalendarError'; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CalendarError('INVALID_RESPONSE');
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096) throw new CalendarError('INVALID_RESPONSE');
  return value;
}
function dateOnly(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CalendarError('INVALID_DATE');
  const n = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw new CalendarError('INVALID_DATE');
  return n;
}
// Resolve local midnight in the calendar's IANA timezone, including DST transitions.
export function localMidnight(date: string, zone: string): number {
  const target = dateOnly(date);
  let guess = target;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 5; i++) {
    const p = Object.fromEntries(format.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    const delta = target - local;
    if (!delta) return guess;
    guess += delta;
  }
  throw new CalendarError('UNSUPPORTED_LOCAL_MIDNIGHT');
}
export function eventInterval(raw: unknown, zone: string): Interval | null {
  const event = object(raw);
  if (event.status === 'cancelled' || event.transparency === 'transparent') return null;
  const start = object(event.start), end = object(event.end);
  if (typeof start.date === 'string' && typeof end.date === 'string') {
    const a = localMidnight(start.date, zone), b = localMidnight(end.date, zone);
    if (b <= a) throw new CalendarError('INVALID_EVENT_RANGE');
    return { start: a, end: b }; // Google's all-day end is exclusive.
  }
  const a = string(start.dateTime), b = string(end.dateTime);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(a) || !/(Z|[+-]\d{2}:\d{2})$/.test(b)) throw new CalendarError('MISSING_TIMEZONE');
  const x = Date.parse(a), y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y <= x) throw new CalendarError('INVALID_EVENT_RANGE');
  return { start: x, end: y };
}
export function overlaps(a: Interval, b: Interval, buffer = 0) { return a.start < b.end + buffer && a.end > b.start - buffer; }
export function slots(start: number, end: number, minutes: number, busy: Interval[], quietStart: number, quietEnd: number): Interval[] {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180 || end - start > 7 * 86400000) throw new CalendarError('INVALID_SLOT_SEARCH');
  const result: Interval[] = [];
  for (let t = Math.ceil(start / 900000) * 900000; t + minutes * 60000 <= end && result.length < 3; t += 900000) {
    const candidate = { start: t, end: t + minutes * 60000 };
    // Legacy quiet parameters are retained for callers, but never restrict a user's appointment.
    if (!busy.some(b => overlaps(candidate, b, 10 * 60000))) { result.push(candidate); t = candidate.end; }
  }
  return result;
}
