import type { Interval } from '../domain/calendar.ts';
export type EventPage = { items: unknown[]; nextPageToken?: string; nextSyncToken?: string; timeZone?: string };
export interface CalendarProvider {
  calendars(token: string): Promise<{ id: string; summary: string }[]>;
  events(token: string, calendar: string, parameters: Record<string, string>): Promise<EventPage>;
  createCalendar(token: string): Promise<string>;
  getEvent(token: string, calendar: string, id: string): Promise<Record<string, unknown> | null>;
  insertEvent(token: string, calendar: string, id: string, interval: Interval, marker: string): Promise<Record<string, unknown>>;
}
export interface TokenProvider {
  authorize(state: string): string;
  exchange(code: string): Promise<string>;
  refresh(refresh: string): Promise<string>;
  revoke(refresh: string): Promise<void>;
}
export interface TokenVault { seal(owner: string, token: string): Promise<string>; open(owner: string, cipher: string): Promise<string>; }
export interface CalendarCommands {
  command(input: import('../domain/work.ts').Input, authority?: {token:string}): Promise<import('../domain/work.ts').View | null>;
}
