import { CalendarError, object, string } from '../../domain/calendar.ts';
import type { Interval } from '../../domain/calendar.ts';
import type { CalendarProvider, TokenProvider, EventPage } from '../../ports/calendar.ts';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly', 'https://www.googleapis.com/auth/calendar.app.created'];
export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };
export class GoogleClient implements CalendarProvider, TokenProvider {
  private config: GoogleConfig;
  private transport: typeof fetch;
  constructor(config: GoogleConfig, transport: typeof fetch = fetch) {
    const url = new URL(config.redirectUri);
    if (url.protocol !== 'https:' || url.pathname !== '/oauth/google/callback' || url.search || url.hash || !config.clientId || !config.clientSecret) throw new CalendarError('INVALID_GOOGLE_CONFIG');
    this.config = config; this.transport = transport;
  }
  private async request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.transport(url, { ...init, redirect: 'error', signal: controller.signal });
      if (!response.ok) { await response.body?.cancel(); throw new CalendarError(`GOOGLE_HTTP_${response.status}`); }
      const text = await response.text();
      if (text.length > 2000000) throw new CalendarError('RESPONSE_TOO_LARGE');
      return object(JSON.parse(text));
    } catch (e) {
      if (e instanceof CalendarError) throw e;
      throw new CalendarError('GOOGLE_RESPONSE_UNKNOWN'); // Do not expose URL, credentials or provider body.
    } finally { clearTimeout(timer); }
  }
  authorize(state: string) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.redirectUri,
      response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state }).toString();
    return url.toString();
  }
  private tokenBody(grant: Record<string, string>) { return new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, ...grant }).toString(); }
  async exchange(code: string) {
    const data = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: this.tokenBody({ grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri }) });
    const granted = string(data.scope).split(' ');
    if (SCOPES.some(s => !granted.includes(s))) throw new CalendarError('MISSING_SCOPES');
    return string(data.refresh_token);
  }
  async refresh(refresh: string) {
    const data = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: this.tokenBody({ grant_type: 'refresh_token', refresh_token: refresh }) });
    return string(data.access_token);
  }
  async revoke(refresh: string) {
    // Revoke responses may be empty, unlike Calendar JSON APIs.
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.transport('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({token:refresh}).toString(), redirect: 'error', signal: controller.signal });
      if (!response.ok) throw new CalendarError('REVOCATION_UNCONFIRMED');
      await response.body?.cancel();
    } catch { throw new CalendarError('REVOCATION_UNCONFIRMED'); } finally { clearTimeout(timer); }
  }
  private api(token: string, path: string, method = 'GET', body?: unknown) {
    return this.request(`https://www.googleapis.com/calendar/v3/${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async calendars(token: string) {
    const result: {id:string;summary:string}[] = []; let page = '';
    for (let i = 0; i < 10; i++) {
      const data = await this.api(token, `users/me/calendarList?${new URLSearchParams({maxResults:'100',...(page?{pageToken:page}:{})})}`);
      if (!Array.isArray(data.items)) throw new CalendarError('INVALID_RESPONSE');
      for (const item of data.items) { const c=object(item); result.push({id:string(c.id),summary:typeof c.summary==='string'?c.summary.slice(0,160):'Calendar'}); }
      if (!data.nextPageToken) return result;
      page=string(data.nextPageToken);
    }
    throw new CalendarError('CALENDAR_PAGE_LIMIT');
  }
  async events(token: string, calendar: string, parameters: Record<string,string>): Promise<EventPage> {
    const data = await this.api(token, `calendars/${encodeURIComponent(calendar)}/events?${new URLSearchParams(parameters)}`);
    if (!Array.isArray(data.items)) throw new CalendarError('INVALID_RESPONSE');
    return {items:data.items,...(data.nextPageToken?{nextPageToken:string(data.nextPageToken)}:{}),...(data.nextSyncToken?{nextSyncToken:string(data.nextSyncToken)}:{}),...(data.timeZone?{timeZone:string(data.timeZone)}:{})};
  }
  async createCalendar(token: string) { return string((await this.api(token,'calendars','POST',{summary:'Assistant Plan',timeZone:'Asia/Ho_Chi_Minh'})).id); }
  async getEvent(token: string, calendar: string, id: string) {
    try { return await this.api(token,`calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(id)}`); }
    catch(e) { if(e instanceof CalendarError && e.message==='GOOGLE_HTTP_404')return null;throw e; }
  }
  insertEvent(token: string, calendar: string, id: string, interval: Interval, marker: string) {
    return this.api(token,`calendars/${encodeURIComponent(calendar)}/events?sendUpdates=none`,'POST',{
      id,summary:'Buổi làm việc',start:{dateTime:new Date(interval.start).toISOString()},end:{dateTime:new Date(interval.end).toISOString()},
      extendedProperties:{private:{assistantWrite:marker}},reminders:{useDefault:false}
    }); // Never accept attendees, HTML, arbitrary method or outside calendar from model/user payload.
  }
}
