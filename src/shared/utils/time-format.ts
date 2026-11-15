/**
 * Pure bijective 12-hour <-> 24-hour time conversion utilities (REQ-AU-16).
 */

export type TimePeriod12h = 'am' | 'pm';

export interface TimeParts12h {
  hour: string;
  minute: string;
  period: TimePeriod12h | '';
}

export type From12HourPartsResult =
  | { ok: true; dueTime: string }
  | { ok: false; reason: 'empty' | 'incomplete' };

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMPTY_TIME_PARTS: TimeParts12h = { hour: '', minute: '', period: '' };

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Converts a canonical 24-hour `HH:mm` string into 12-hour selector parts.
 * Returns empty parts when `dueTime` is nullish, empty, or malformed.
 */
export function to12HourParts(dueTime: string | null | undefined): TimeParts12h {
  if (!dueTime) {
    return { ...EMPTY_TIME_PARTS };
  }

  const match = TIME_24H_REGEX.exec(dueTime.trim());
  if (!match) {
    return { ...EMPTY_TIME_PARTS };
  }

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period: TimePeriod12h = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return {
    hour: padTwoDigits(hour12),
    minute,
    period,
  };
}

/**
 * Converts 12-hour selector parts back into canonical 24-hour `HH:mm`.
 * Distinguishes completely unset parts (`reason: 'empty'`) from partial or invalid
 * selections (`reason: 'incomplete'`).
 */
export function from12HourParts(parts: TimeParts12h): From12HourPartsResult {
  const hourStr = parts.hour.trim();
  const minuteStr = parts.minute.trim();
  const period = parts.period;

  if (!hourStr && !minuteStr && !period) {
    return { ok: false, reason: 'empty' };
  }

  if (!hourStr || !minuteStr || (period !== 'am' && period !== 'pm')) {
    return { ok: false, reason: 'incomplete' };
  }

  if (!/^\d{1,2}$/.test(hourStr) || !/^\d{1,2}$/.test(minuteStr)) {
    return { ok: false, reason: 'incomplete' };
  }

  const hour12 = Number(hourStr);
  const minute = Number(minuteStr);

  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) {
    return { ok: false, reason: 'incomplete' };
  }

  let hour24 = hour12 % 12;
  if (period === 'pm') {
    hour24 += 12;
  }

  return {
    ok: true,
    dueTime: `${padTwoDigits(hour24)}:${padTwoDigits(minute)}`,
  };
}
