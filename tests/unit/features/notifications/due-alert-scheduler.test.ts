import { describe, expect, it, vi } from 'vitest';
import {
  MAX_SAFE_TIMEOUT_MS,
  RETENTION_WINDOW_MS,
  buildOccurrenceKey,
  classifyDueTaskAlert,
  formatDueAlertContent,
  isTaskDueAlertRecipient,
  scheduleCappedTimeout,
} from '@/features/notifications/utils';
import type { HandledDueOccurrence, Task } from '@/shared/schemas';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Entregar proyecto',
    description: null,
    groupId: 'grp-1',
    tagIds: [],
    completed: false,
    createdAt: '2026-11-18T10:00:00.000Z',
    completedAt: null,
    dueDate: '2026-11-20',
    dueTime: null,
    assigneeId: null,
    subtasks: [],
    reminders: [],
    ...overrides,
  };
}

describe('Due-Alert Scheduler & Capped Timer Utilities (005-notifications, RF-28)', () => {
  const timeZone = 'America/Bogota'; // UTC-5

  describe('buildOccurrenceKey & isTaskDueAlertRecipient (REQ-NT-06, REQ-NT-10, RNF-20)', () => {
    it('builds canonical occurrence keys for timed and date-only tasks', () => {
      expect(buildOccurrenceKey('2026-11-20', '14:30')).toBe('2026-11-20|14:30');
      expect(buildOccurrenceKey('2026-11-20', null)).toBe('2026-11-20|date-only');
      expect(buildOccurrenceKey('2026-11-20', '  ')).toBe('2026-11-20|date-only');
    });

    it('checks recipient eligibility respecting assigneeId when set and accessibleGroupIds otherwise', () => {
      const accessible = new Set(['grp-1']);

      // Unassigned task in accessible group -> eligible
      expect(
        isTaskDueAlertRecipient(makeTask({ groupId: 'grp-1', assigneeId: null }), accessible, 'usr-1'),
      ).toBe(true);

      // Unassigned task in inaccessible group -> ineligible
      expect(
        isTaskDueAlertRecipient(
          makeTask({ groupId: 'grp-foreign', assigneeId: null }),
          accessible,
          'usr-1',
        ),
      ).toBe(false);

      // Assigned specifically to usr-1 in accessible group -> eligible
      expect(
        isTaskDueAlertRecipient(
          makeTask({ groupId: 'grp-1', assigneeId: 'usr-1' }),
          accessible,
          'usr-1',
        ),
      ).toBe(true);

      // Assigned to another member (RNF-20) -> ineligible for usr-1
      expect(
        isTaskDueAlertRecipient(
          makeTask({ groupId: 'grp-1', assigneeId: 'usr-2' }),
          accessible,
          'usr-1',
        ),
      ).toBe(false);
    });
  });

  describe('classifyDueTaskAlert decision matrix (REQ-NT-06..10, Section 4.2)', () => {
    it('returns none for completed, undated, or ineligible tasks', () => {
      const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
      expect(
        classifyDueTaskAlert({
          task: makeTask({ completed: true }),
          timeZone,
          nowMs,
          mode: 'save',
          handledOccurrences: [],
        }),
      ).toEqual({ action: 'none' });

      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: null }),
          timeZone,
          nowMs,
          mode: 'save',
          handledOccurrences: [],
        }),
      ).toEqual({ action: 'none' });

      expect(
        classifyDueTaskAlert({
          task: makeTask(),
          timeZone,
          nowMs,
          mode: 'save',
          handledOccurrences: [],
          isEligibleRecipient: false,
        }),
      ).toEqual({ action: 'none' });
    });

    it('schedules future timed and future date-only (09:00 local) tasks', () => {
      // 2026-11-18 08:00 Bogota = 13:00 UTC
      const nowMs = Date.parse('2026-11-18T13:00:00.000Z');

      // Date-only for today before 09:00 local -> schedules for 09:00 local today (14:00 UTC = +1h)
      const todayBeforeNine = classifyDueTaskAlert({
        task: makeTask({ dueDate: '2026-11-18', dueTime: null }),
        timeZone,
        nowMs,
        mode: 'save',
        handledOccurrences: [],
      });
      expect(todayBeforeNine).toEqual({
        action: 'schedule',
        occurrenceKey: '2026-11-18|date-only',
        triggerAtMs: Date.parse('2026-11-18T14:00:00.000Z'),
        delayMs: 3_600_000,
      });

      // Timed task for today 14:30 Bogota (19:30 UTC = +6.5h)
      const timedFuture = classifyDueTaskAlert({
        task: makeTask({ dueDate: '2026-11-18', dueTime: '14:30' }),
        timeZone,
        nowMs,
        mode: 'save',
        handledOccurrences: [],
      });
      expect(timedFuture).toEqual({
        action: 'schedule',
        occurrenceKey: '2026-11-18|14:30',
        triggerAtMs: Date.parse('2026-11-18T19:30:00.000Z'),
        delayMs: 6.5 * 3_600_000,
      });
    });

    it('triggers immediately when date-only task for today is saved at or after 09:00 local (REQ-NT-07(3))', () => {
      // 2026-11-18 09:00:00 Bogota = 14:00:00 UTC
      const atNineMs = Date.parse('2026-11-18T14:00:00.000Z');
      const afterNineMs = Date.parse('2026-11-18T18:30:00.000Z');

      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-18', dueTime: null }),
          timeZone,
          nowMs: atNineMs,
          mode: 'save',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'trigger-now',
        occurrenceKey: '2026-11-18|date-only',
        triggerAtMs: Date.parse('2026-11-18T14:00:00.000Z'),
      });

      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-18', dueTime: null }),
          timeZone,
          nowMs: afterNineMs,
          mode: 'save',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'trigger-now',
        occurrenceKey: '2026-11-18|date-only',
        triggerAtMs: Date.parse('2026-11-18T14:00:00.000Z'),
      });
    });

    it('suppresses past-due timed or strictly past-day date-only tasks on save (REQ-NT-08(2)-(3))', () => {
      // 2026-11-18 15:00 Bogota = 20:00 UTC
      const nowMs = Date.parse('2026-11-18T20:00:00.000Z');

      // Timed task earlier today (14:00 Bogota = 19:00 UTC <= nowMs)
      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-18', dueTime: '14:00' }),
          timeZone,
          nowMs,
          mode: 'save',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'suppress',
        occurrenceKey: '2026-11-18|14:00',
        triggerAtMs: Date.parse('2026-11-18T19:00:00.000Z'),
      });

      // Date-only task on a strictly past day ('2026-11-17')
      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-17', dueTime: null }),
          timeZone,
          nowMs,
          mode: 'save',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'suppress',
        occurrenceKey: '2026-11-17|date-only',
        triggerAtMs: Date.parse('2026-11-17T14:00:00.000Z'),
      });
    });

    it('fires catch-up on sync when unnotified task due instant passed < 30 days ago, and suppresses if >= 30 days old (REQ-NT-08(1))', () => {
      const nowMs = Date.parse('2026-11-18T20:00:00.000Z');

      // Missed yesterday (< 30 days)
      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-17', dueTime: '10:00' }),
          timeZone,
          nowMs,
          mode: 'sync',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'trigger-now',
        occurrenceKey: '2026-11-17|10:00',
        triggerAtMs: Date.parse('2026-11-17T15:00:00.000Z'),
      });

      // Missed > 30 days ago -> suppress without firing
      const oldTask = makeTask({ dueDate: '2026-10-01', dueTime: '09:00' });
      const oldTriggerMs = Date.parse('2026-10-01T14:00:00.000Z');
      expect(nowMs - oldTriggerMs).toBeGreaterThanOrEqual(RETENTION_WINDOW_MS);

      expect(
        classifyDueTaskAlert({
          task: oldTask,
          timeZone,
          nowMs,
          mode: 'sync',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'suppress',
        occurrenceKey: '2026-10-01|09:00',
        triggerAtMs: oldTriggerMs,
      });
    });

    it('reschedules future tasks on uncheck and suppresses past tasks on uncheck (REQ-NT-09(3))', () => {
      const nowMs = Date.parse('2026-11-18T15:00:00.000Z'); // 10:00 Bogota

      // Future due instant -> reschedule
      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-18', dueTime: '12:00' }),
          timeZone,
          nowMs,
          mode: 'uncheck',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'schedule',
        occurrenceKey: '2026-11-18|12:00',
        triggerAtMs: Date.parse('2026-11-18T17:00:00.000Z'),
        delayMs: 2 * 3_600_000,
      });

      // Past due instant (including today date-only after 09:00) -> suppress on uncheck
      expect(
        classifyDueTaskAlert({
          task: makeTask({ dueDate: '2026-11-18', dueTime: null }),
          timeZone,
          nowMs,
          mode: 'uncheck',
          handledOccurrences: [],
        }),
      ).toEqual({
        action: 'suppress',
        occurrenceKey: '2026-11-18|date-only',
        triggerAtMs: Date.parse('2026-11-18T14:00:00.000Z'),
      });
    });

    it('deduplicates already-notified or suppressed occurrences and re-evaluates when dueDate/dueTime changes (REQ-NT-10)', () => {
      const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
      const handled: HandledDueOccurrence[] = [
        {
          taskId: 'task-1',
          occurrenceKey: '2026-11-18|date-only',
          status: 'notified',
          recordedAt: '2026-11-18T14:00:00.000Z',
        },
        {
          taskId: 'task-2',
          occurrenceKey: '2026-11-10|10:00',
          status: 'suppressed',
          recordedAt: '2026-11-18T10:00:00.000Z',
        },
      ];

      // Same occurrenceKey -> already-handled
      expect(
        classifyDueTaskAlert({
          task: makeTask({ id: 'task-1', dueDate: '2026-11-18', dueTime: null }),
          timeZone,
          nowMs,
          mode: 'sync',
          handledOccurrences: handled,
        }),
      ).toEqual({
        action: 'already-handled',
        occurrenceKey: '2026-11-18|date-only',
      });

      // Suppressed past task stays already-handled on reload/sync
      expect(
        classifyDueTaskAlert({
          task: makeTask({ id: 'task-2', dueDate: '2026-11-10', dueTime: '10:00' }),
          timeZone,
          nowMs,
          mode: 'sync',
          handledOccurrences: handled,
        }),
      ).toEqual({
        action: 'already-handled',
        occurrenceKey: '2026-11-10|10:00',
      });

      // Edited to a new dueTime -> new occurrenceKey is scheduled!
      expect(
        classifyDueTaskAlert({
          task: makeTask({ id: 'task-1', dueDate: '2026-11-18', dueTime: '16:00' }),
          timeZone,
          nowMs,
          mode: 'save',
          handledOccurrences: handled,
        }),
      ).toEqual({
        action: 'schedule',
        occurrenceKey: '2026-11-18|16:00',
        triggerAtMs: Date.parse('2026-11-18T21:00:00.000Z'),
        delayMs: 9 * 3_600_000,
      });
    });
  });

  describe('formatDueAlertContent (REQ-NT-11, UI-07, RNF-14)', () => {
    it('formats date-only and timed due alerts in 24h and 12h Spanish formats', () => {
      const dateOnlyTask = makeTask({
        title: 'Pagar matrícula',
        dueDate: '2026-12-05',
        dueTime: null,
      });
      expect(formatDueAlertContent(dateOnlyTask, '24h')).toBe(
        'La tarea "Pagar matrícula" vence el 05/12/2026.',
      );
      expect(formatDueAlertContent(dateOnlyTask, '12h')).toBe(
        'La tarea "Pagar matrícula" vence el 05/12/2026.',
      );

      const timedTask = makeTask({
        title: 'Exposición final',
        dueDate: '2026-12-05',
        dueTime: '14:30',
      });
      expect(formatDueAlertContent(timedTask, '24h')).toBe(
        'La tarea "Exposición final" vence el 05/12/2026 a las 14:30.',
      );
      expect(formatDueAlertContent(timedTask, '12h')).toBe(
        'La tarea "Exposición final" vence el 05/12/2026 a las 02:30 p. m..',
      );
    });
  });

  describe('scheduleCappedTimeout (Section 3.2 multi-week 32-bit timer safety)', () => {
    it('chains timeouts exceeding MAX_SAFE_TIMEOUT_MS (2,147,483,647 ms) without premature firing and supports cancellation', () => {
      vi.useFakeTimers();
      try {
        let currentNow = 1_000_000;
        const totalDelay = MAX_SAFE_TIMEOUT_MS * 2 + 5_000;
        const targetMs = currentNow + totalDelay;
        const onDue = vi.fn();
        const scheduledDelays: number[] = [];

        const cancel = scheduleCappedTimeout(
          targetMs,
          () => currentNow,
          onDue,
          (cb, delay) => {
            scheduledDelays.push(delay);
            return setTimeout(cb, delay);
          },
          (handle) => clearTimeout(handle),
        );

        // First chunk is capped at MAX_SAFE_TIMEOUT_MS
        expect(scheduledDelays).toEqual([MAX_SAFE_TIMEOUT_MS]);
        expect(onDue).not.toHaveBeenCalled();

        // Advance first chunk
        currentNow += MAX_SAFE_TIMEOUT_MS;
        vi.advanceTimersByTime(MAX_SAFE_TIMEOUT_MS);
        expect(onDue).not.toHaveBeenCalled();
        expect(scheduledDelays).toEqual([MAX_SAFE_TIMEOUT_MS, MAX_SAFE_TIMEOUT_MS]);

        // Advance second chunk
        currentNow += MAX_SAFE_TIMEOUT_MS;
        vi.advanceTimersByTime(MAX_SAFE_TIMEOUT_MS);
        expect(onDue).not.toHaveBeenCalled();
        expect(scheduledDelays).toEqual([MAX_SAFE_TIMEOUT_MS, MAX_SAFE_TIMEOUT_MS, 5_000]);

        // Advance final 5_000 ms chunk -> fires onDue exactly once
        currentNow += 5_000;
        vi.advanceTimersByTime(5_000);
        expect(onDue).toHaveBeenCalledTimes(1);

        // Cancellation stops any pending chunk
        const onCancelledDue = vi.fn();
        const cancelSecond = scheduleCappedTimeout(
          currentNow + 60_000,
          () => currentNow,
          onCancelledDue,
        );
        cancelSecond();
        currentNow += 60_000;
        vi.advanceTimersByTime(60_000);
        expect(onCancelledDue).not.toHaveBeenCalled();
        cancel();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
