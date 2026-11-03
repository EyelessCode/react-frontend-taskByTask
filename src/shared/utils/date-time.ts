import type { ReminderOffset } from '../schemas';

export const REMINDER_OFFSET_MS: Record<ReminderOffset, number> = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export const nowIsoUtc = formatIsoTimestamp;

export function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

export function formatDisplayTime(
  timeStr: string,
  format: '24h' | '12h' = '24h',
): string {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (Number.isNaN(hours)) return timeStr;

  if (format === '24h') {
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  const period = hours >= 12 ? 'p. m.' : 'a. m.';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hours12).padStart(2, '0')}:${minutes} ${period}`;
}

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getTzParts(date: Date, timeZone: string): TzParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = parseInt(part.value, 10);
    }
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour === 24 ? 0 : (parts.hour ?? 0),
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

export function parseZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  for (let i = 0; i < 4; i++) {
    const parts = getTzParts(new Date(utcGuess), timeZone);
    const guessInTz = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      ms,
    );
    const diff = guessInTz - Date.UTC(year, month - 1, day, hour, minute, second, ms);
    if (diff === 0) break;
    utcGuess -= diff;
  }
  return new Date(utcGuess);
}

export interface IsTaskOverdueParams {
  dueDate?: string | null;
  dueTime?: string | null;
  completed?: boolean;
  timeZone?: string;
  now?: Date;
}

export function isTaskOverdue(params: IsTaskOverdueParams): boolean {
  if (params.completed) {
    return false;
  }

  if (!params.dueDate) {
    return false;
  }

  const parts = params.dueDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return false;
  }
  const [year, month, day] = parts;

  const now = params.now ?? new Date();
  const timeZone = params.timeZone ?? detectBrowserTimeZone();

  if (params.dueTime) {
    const timeParts = params.dueTime.split(':').map(Number);
    const hour = timeParts[0] ?? 0;
    const minute = timeParts[1] ?? 0;
    const cutoff = parseZonedDate(year, month, day, hour, minute, 0, 0, timeZone);
    return now.getTime() > cutoff.getTime();
  }

  // Date-only: overdue only after 23:59:59.999 local time
  const cutoff = parseZonedDate(year, month, day, 23, 59, 59, 999, timeZone);
  return now.getTime() > cutoff.getTime();
}

export interface ReminderTriggerParams {
  dueDate: string;
  dueTime?: string | null;
  offset?: ReminderOffset;
  timeZone?: string;
}

export function getReminderTriggerDate(params: ReminderTriggerParams): Date {
  const timeZone = params.timeZone ?? detectBrowserTimeZone();
  const [year, month, day] = params.dueDate.split('-').map(Number);

  let hour = 9;
  let minute = 0;
  const second = 0;
  const ms = 0;

  if (params.dueTime) {
    const [h, m] = params.dueTime.split(':').map(Number);
    hour = h;
    minute = m;
  }

  const baseDate = parseZonedDate(year, month, day, hour, minute, second, ms, timeZone);

  if (!params.offset) {
    return baseDate;
  }

  const offsetMs = REMINDER_OFFSET_MS[params.offset] ?? 0;
  return new Date(baseDate.getTime() - offsetMs);
}

export function getDueNotificationTriggerMs(params: ReminderTriggerParams): number {
  return getReminderTriggerDate(params).getTime();
}
