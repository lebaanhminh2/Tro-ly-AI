import type {
  HabitDefinition,
  HabitDayOutcome,
  HabitRecord,
  HabitRevision,
} from '../domain/habits.ts';
import type { TimeRange } from '../domain/availability.ts';

export type HabitDay = { day: number; startAt: number; endAt: number };
export type HabitPageOptions = {
  archiveOffset?: number;
  search?: { text: string; cursor: number; status: 'active' | 'all' };
};
export type HabitLog = { value: number; note: string; version: number; updatedAt: number };
export type HabitView = {
  habit: HabitRecord;
  definition: HabitDefinition;
  pending: HabitRevision | null;
  log: HabitLog;
  preview: HabitDayOutcome | null;
  reminderTime: string | null;
  slot: { startAt: number; minutes: number; version: number } | null;
};
export type HabitSnapshot = {
  day: HabitDay;
  habit: HabitRecord | null;
  log: HabitLog;
  activeCount: number;
  schedule?: { free: TimeRange[]; occupied: TimeRange[] };
};
export type HabitChange =
  | { kind: 'create'; habitId: string; definition: HabitDefinition; reminderTime?: string | null }
  | {
      kind: 'revision';
      habitId: string;
      version: number;
      revision: HabitRevision;
      reminderTime?: string | null;
    }
  | { kind: 'archive'; habitId: string; version: number; from: number | null }
  | {
      kind: 'slot';
      habitId: string;
      version: number;
      startAt: number | null;
      minutes: number | null;
    }
  | {
      kind: 'log';
      habitId: string;
      habitVersion: number;
      logVersion: number;
      value: number;
      note: string;
    };
export type HabitSaved = {
  saved: true;
  habitId: string;
  day: number;
  version: number;
  effectiveFrom?: number;
  ticketAwarded?: 0 | 1 | 3;
};
export type HabitHistoryRow = {
  habitId: string;
  day: number;
  name: string;
  definition: HabitDefinition;
  value: number;
  note: string;
  status: 'achieved' | 'missed' | 'neutral' | 'processing';
  reason: string;
  successes: number;
  misses: number;
};
export type HabitReport = {
  from: number;
  to: number;
  successes: number;
  misses: number;
  neutral: number;
  rate: number | null;
  days: { day: number; successes: number; misses: number; neutral: number }[];
  byHabit: {
    habitId: string;
    name: string;
    successes: number;
    misses: number;
    neutral: number;
    rate: number | null;
    days: {
      day: number;
      status: 'achieved' | 'missed' | 'neutral';
      successes: number;
      misses: number;
    }[];
  }[];
  totals: {
    habitId: string;
    name: string;
    metric: string;
    unit: string;
    value: number;
    loggedDays: number;
  }[];
};
export interface HabitStore {
  today(
    owner: string,
    now: number,
    archived?: boolean,
    readOnly?: boolean,
    page?: HabitPageOptions,
  ): Promise<{
    day: HabitDay;
    habits: HabitView[];
    archivePage?: { offset: number; nextCursor: number | null };
    searchPage?: { total: number; nextCursor: number | null };
  }>;
  mutate(
    owner: string,
    requestId: string,
    input: Record<string, unknown>,
    now: number,
    apply: (snapshot: HabitSnapshot) => { change: HabitChange; result: HabitSaved },
  ): Promise<HabitSaved>;
  history(
    owner: string,
    from: number,
    to: number,
    habitId: string | null,
    before: string | null,
    limit: number,
    status?: string,
  ): Promise<{ rows: HabitHistoryRow[]; next: string | null }>;
  report(owner: string, from: number, to: number, habitId: string | null): Promise<HabitReport>;
  settle(
    owner: string,
    now: number,
    limit?: number,
  ): Promise<{ processed: number; pending: boolean }>;
}
