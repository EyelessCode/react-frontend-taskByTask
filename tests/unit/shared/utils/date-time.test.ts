import { describe, it, expect } from 'vitest';
import {
  formatDisplayDate,
  formatDisplayTime,
  isTaskOverdue,
  getReminderTriggerDate,
  getDueNotificationTriggerMs,
  formatIsoTimestamp,
  nowIsoUtc,
  detectBrowserTimeZone,
} from '@/shared/utils';

describe('Pure Date & Time Utilities (shared/utils/date-time)', () => {
  describe('formatDisplayDate (REQ-FD-14, REQ-FD-18)', () => {
    it('should format YYYY-MM-DD into dd/mm/aaaa strictly without UTC shift', () => {
      expect(formatDisplayDate('2026-11-15')).toBe('15/11/2026');
      expect(formatDisplayDate('2026-01-05')).toBe('05/01/2026');
      expect(formatDisplayDate('2026-12-31')).toBe('31/12/2026');
    });

    it('should return original string if format does not have 3 parts', () => {
      expect(formatDisplayDate('invalid')).toBe('invalid');
      expect(formatDisplayDate('')).toBe('');
    });
  });

  describe('formatDisplayTime (REQ-FD-14, REQ-FD-18, UI-07)', () => {
    it('should format time as 24h by default', () => {
      expect(formatDisplayTime('14:30')).toBe('14:30');
      expect(formatDisplayTime('09:05')).toBe('09:05');
      expect(formatDisplayTime('00:00')).toBe('00:00');
      expect(formatDisplayTime('23:59')).toBe('23:59');
    });

    it('should format time as 12h with Spanish period indicators when configured', () => {
      expect(formatDisplayTime('00:00', '12h')).toBe('12:00 a. m.');
      expect(formatDisplayTime('09:05', '12h')).toBe('09:05 a. m.');
      expect(formatDisplayTime('12:00', '12h')).toBe('12:00 p. m.');
      expect(formatDisplayTime('14:30', '12h')).toBe('02:30 p. m.');
      expect(formatDisplayTime('23:59', '12h')).toBe('11:59 p. m.');
    });
  });

  describe('isTaskOverdue (REQ-FD-15, RNF-14)', () => {
    it('should never consider completed tasks overdue, even if past due date', () => {
      const pastNow = new Date('2026-11-10T12:00:00.000Z');
      const overdue = isTaskOverdue({
        dueDate: '2026-11-01',
        dueTime: '10:00',
        completed: true,
        now: pastNow,
        timeZone: 'America/Bogota',
      });
      expect(overdue).toBe(false);
    });

    it('should never consider tasks without dueDate overdue', () => {
      const now = new Date('2026-11-10T12:00:00.000Z');
      expect(isTaskOverdue({ dueDate: null, now, timeZone: 'America/Bogota' })).toBe(false);
      expect(isTaskOverdue({ dueDate: undefined, now, timeZone: 'America/Bogota' })).toBe(false);
    });

    describe('with dueDate and dueTime', () => {
      const timeZone = 'America/Bogota'; // UTC-5
      const dueDate = '2026-11-02';
      const dueTime = '14:30'; // 14:30 Bogota = 19:30:00.000 UTC

      it('should return false before cutoff', () => {
        const before = new Date('2026-11-02T19:29:59.000Z');
        expect(isTaskOverdue({ dueDate, dueTime, now: before, timeZone })).toBe(false);
      });

      it('should return false exactly at cutoff', () => {
        const exactly = new Date('2026-11-02T19:30:00.000Z');
        expect(isTaskOverdue({ dueDate, dueTime, now: exactly, timeZone })).toBe(false);
      });

      it('should return true after cutoff', () => {
        const after = new Date('2026-11-02T19:30:01.000Z');
        expect(isTaskOverdue({ dueDate, dueTime, now: after, timeZone })).toBe(true);
      });
    });

    describe('with dueDate only (no dueTime: 23:59:59.999 local cutoff)', () => {
      const timeZone = 'America/Bogota'; // UTC-5
      const dueDate = '2026-11-02';
      // 2026-11-02 23:59:59.999 Bogota = 2026-11-03T04:59:59.999 UTC

      it('should NOT be overdue at 23:59:59 local time on that day', () => {
        const local235959 = new Date('2026-11-03T04:59:59.000Z');
        expect(isTaskOverdue({ dueDate, now: local235959, timeZone })).toBe(false);
      });

      it('should NOT be overdue exactly at 23:59:59.999 local time on that day', () => {
        const localEndDay = new Date('2026-11-03T04:59:59.999Z');
        expect(isTaskOverdue({ dueDate, now: localEndDay, timeZone })).toBe(false);
      });

      it('should be overdue at 00:00:00 of the next calendar day in user timezone', () => {
        const nextDayStart = new Date('2026-11-03T05:00:00.000Z');
        expect(isTaskOverdue({ dueDate, now: nextDayStart, timeZone })).toBe(true);
      });
    });

    describe('across diverse IANA timezones', () => {
      it('should evaluate cutoff correctly in Asia/Tokyo (UTC+9)', () => {
        // 2026-11-02 23:59:59.999 Tokyo = 2026-11-02T14:59:59.999Z
        const dueDate = '2026-11-02';
        const timeZone = 'Asia/Tokyo';

        const beforeTokyoCutoff = new Date('2026-11-02T14:59:59.000Z');
        expect(isTaskOverdue({ dueDate, now: beforeTokyoCutoff, timeZone })).toBe(false);

        // At 15:00:00 UTC, it is already Nov 3 00:00:00 in Tokyo
        const afterTokyoCutoff = new Date('2026-11-02T15:00:00.000Z');
        expect(isTaskOverdue({ dueDate, now: afterTokyoCutoff, timeZone })).toBe(true);
      });

      it('should evaluate cutoff correctly in UTC', () => {
        const dueDate = '2026-11-02';
        const timeZone = 'UTC';

        const beforeUtc = new Date('2026-11-02T23:59:59.999Z');
        expect(isTaskOverdue({ dueDate, now: beforeUtc, timeZone })).toBe(false);

        const afterUtc = new Date('2026-11-03T00:00:00.000Z');
        expect(isTaskOverdue({ dueDate, now: afterUtc, timeZone })).toBe(true);
      });
    });
  });

  describe('getReminderTriggerDate & getDueNotificationTriggerMs (REQ-FD-16, RF-28)', () => {
    it('should default date-only tasks to 09:00:00 local time in user timezone', () => {
      // 2026-11-02 09:00:00 Bogota (UTC-5) = 2026-11-02T14:00:00.000Z
      const trigger = getReminderTriggerDate({
        dueDate: '2026-11-02',
        timeZone: 'America/Bogota',
      });
      expect(trigger.toISOString()).toBe('2026-11-02T14:00:00.000Z');
    });

    it('should use specified dueTime when provided', () => {
      // 2026-11-02 16:30:00 Bogota (UTC-5) = 2026-11-02T21:30:00.000Z
      const trigger = getReminderTriggerDate({
        dueDate: '2026-11-02',
        dueTime: '16:30',
        timeZone: 'America/Bogota',
      });
      expect(trigger.toISOString()).toBe('2026-11-02T21:30:00.000Z');
    });

    it('should subtract fixed offsets accurately (15m, 30m, 1h, 6h, 1d)', () => {
      // Base: 2026-11-02 14:00:00 UTC (09:00 Bogota)
      const baseMs = new Date('2026-11-02T14:00:00.000Z').getTime();

      const r15m = getReminderTriggerDate({
        dueDate: '2026-11-02',
        offset: '15m',
        timeZone: 'America/Bogota',
      });
      expect(r15m.getTime()).toBe(baseMs - 15 * 60 * 1000);

      const r30m = getReminderTriggerDate({
        dueDate: '2026-11-02',
        offset: '30m',
        timeZone: 'America/Bogota',
      });
      expect(r30m.getTime()).toBe(baseMs - 30 * 60 * 1000);

      const r1h = getReminderTriggerDate({
        dueDate: '2026-11-02',
        offset: '1h',
        timeZone: 'America/Bogota',
      });
      expect(r1h.getTime()).toBe(baseMs - 60 * 60 * 1000);

      const r6h = getReminderTriggerDate({
        dueDate: '2026-11-02',
        offset: '6h',
        timeZone: 'America/Bogota',
      });
      expect(r6h.getTime()).toBe(baseMs - 6 * 60 * 60 * 1000);

      const r1d = getReminderTriggerDate({
        dueDate: '2026-11-02',
        offset: '1d',
        timeZone: 'America/Bogota',
      });
      expect(r1d.getTime()).toBe(baseMs - 24 * 60 * 60 * 1000);
    });

    it('should return milliseconds timestamp via getDueNotificationTriggerMs', () => {
      const ms = getDueNotificationTriggerMs({
        dueDate: '2026-11-02',
        timeZone: 'America/Bogota',
      });
      expect(ms).toBe(new Date('2026-11-02T14:00:00.000Z').getTime());
    });
  });

  describe('formatIsoTimestamp and nowIsoUtc', () => {
    it('should generate standard UTC ISO-8601 string', () => {
      const d = new Date('2026-11-02T15:30:45.123Z');
      expect(formatIsoTimestamp(d)).toBe('2026-11-02T15:30:45.123Z');
      expect(nowIsoUtc(d)).toBe('2026-11-02T15:30:45.123Z');
    });
  });

  describe('detectBrowserTimeZone', () => {
    it('should return a non-empty timezone string', () => {
      const tz = detectBrowserTimeZone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });
});
