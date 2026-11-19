import { describe, expect, it } from 'vitest';
import {
  from12HourParts,
  to12HourParts,
  type TimeParts12h,
} from '@/shared/utils/time-format';

describe('time-format utilities (12h <-> 24h)', () => {
  describe('to12HourParts', () => {
    it('returns empty parts for null, undefined, empty string, or invalid time strings', () => {
      const empty: TimeParts12h = { hour: '', minute: '', period: '' };

      expect(to12HourParts(null)).toEqual(empty);
      expect(to12HourParts(undefined)).toEqual(empty);
      expect(to12HourParts('')).toEqual(empty);
      expect(to12HourParts('   ')).toEqual(empty);
      expect(to12HourParts('24:00')).toEqual(empty);
      expect(to12HourParts('12:60')).toEqual(empty);
      expect(to12HourParts('9:30')).toEqual(empty);
      expect(to12HourParts('invalid')).toEqual(empty);
    });

    it('converts midnight 00:mm to 12:mm am', () => {
      expect(to12HourParts('00:00')).toEqual({ hour: '12', minute: '00', period: 'am' });
      expect(to12HourParts('00:45')).toEqual({ hour: '12', minute: '45', period: 'am' });
    });

    it('converts morning 01:mm..11:mm to 01:mm..11:mm am', () => {
      expect(to12HourParts('01:05')).toEqual({ hour: '01', minute: '05', period: 'am' });
      expect(to12HourParts('09:15')).toEqual({ hour: '09', minute: '15', period: 'am' });
      expect(to12HourParts('11:59')).toEqual({ hour: '11', minute: '59', period: 'am' });
    });

    it('converts noon 12:mm to 12:mm pm', () => {
      expect(to12HourParts('12:00')).toEqual({ hour: '12', minute: '00', period: 'pm' });
      expect(to12HourParts('12:30')).toEqual({ hour: '12', minute: '30', period: 'pm' });
    });

    it('converts afternoon/evening 13:mm..23:mm to 01:mm..11:mm pm', () => {
      expect(to12HourParts('13:30')).toEqual({ hour: '01', minute: '30', period: 'pm' });
      expect(to12HourParts('18:05')).toEqual({ hour: '06', minute: '05', period: 'pm' });
      expect(to12HourParts('23:59')).toEqual({ hour: '11', minute: '59', period: 'pm' });
    });
  });

  describe('from12HourParts', () => {
    it('returns reason "empty" when all three parts are unset', () => {
      expect(from12HourParts({ hour: '', minute: '', period: '' })).toEqual({
        ok: false,
        reason: 'empty',
      });
    });

    it('returns reason "incomplete" when one or two parts are selected while another is unset', () => {
      expect(from12HourParts({ hour: '09', minute: '', period: '' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '', minute: '30', period: '' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '', minute: '', period: 'am' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '09', minute: '30', period: '' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '09', minute: '', period: 'pm' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '', minute: '15', period: 'am' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
    });

    it('returns reason "incomplete" for out-of-range hour or minute values', () => {
      expect(from12HourParts({ hour: '00', minute: '00', period: 'am' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '13', minute: '00', period: 'pm' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(from12HourParts({ hour: '10', minute: '60', period: 'am' })).toEqual({
        ok: false,
        reason: 'incomplete',
      });
    });

    it('converts 12:mm am to 00:mm and 12:mm pm to 12:mm', () => {
      expect(from12HourParts({ hour: '12', minute: '00', period: 'am' })).toEqual({
        ok: true,
        dueTime: '00:00',
      });
      expect(from12HourParts({ hour: '12', minute: '45', period: 'am' })).toEqual({
        ok: true,
        dueTime: '00:45',
      });
      expect(from12HourParts({ hour: '12', minute: '00', period: 'pm' })).toEqual({
        ok: true,
        dueTime: '12:00',
      });
      expect(from12HourParts({ hour: '12', minute: '59', period: 'pm' })).toEqual({
        ok: true,
        dueTime: '12:59',
      });
    });

    it('converts 01..11 am and pm to 24h HH:mm', () => {
      expect(from12HourParts({ hour: '09', minute: '15', period: 'am' })).toEqual({
        ok: true,
        dueTime: '09:15',
      });
      expect(from12HourParts({ hour: '01', minute: '30', period: 'pm' })).toEqual({
        ok: true,
        dueTime: '13:30',
      });
      expect(from12HourParts({ hour: '11', minute: '59', period: 'pm' })).toEqual({
        ok: true,
        dueTime: '23:59',
      });
    });

    it('performs bijective round-trip for every hour of the day', () => {
      for (let h = 0; h < 24; h += 1) {
        for (const m of [0, 7, 30, 59]) {
          const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const parts = to12HourParts(hhmm);
          const roundTrip = from12HourParts(parts);
          expect(roundTrip).toEqual({ ok: true, dueTime: hhmm });
        }
      }
    });
  });
});
