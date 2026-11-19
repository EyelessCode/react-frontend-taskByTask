import { es } from '../../../shared/i18n';
import type { HandledDueOccurrence, Task } from '../../../shared/schemas';
import {
  formatDisplayDate,
  formatDisplayTime,
  getDueNotificationTriggerMs,
  getZonedCalendarDate,
  isPastLocalNineAm,
} from '../../../shared/utils';
import { MAX_SAFE_TIMEOUT_MS, RETENTION_WINDOW_MS } from './notification-constants';

export type DueAlertEvaluationMode = 'save' | 'uncheck' | 'sync';

export type DueAlertClassification =
  | { action: 'none' }
  | { action: 'already-handled'; occurrenceKey: string }
  | { action: 'trigger-now'; occurrenceKey: string; triggerAtMs: number }
  | { action: 'schedule'; occurrenceKey: string; triggerAtMs: number; delayMs: number }
  | { action: 'suppress'; occurrenceKey: string; triggerAtMs: number };

export interface ClassifyDueTaskAlertParams {
  task: Task;
  timeZone: string;
  nowMs: number;
  mode: DueAlertEvaluationMode;
  handledOccurrences: HandledDueOccurrence[];
  isEligibleRecipient?: boolean;
}

export function buildOccurrenceKey(dueDate: string, dueTime?: string | null): string {
  const normalizedTime = dueTime?.trim() || 'date-only';
  return `${dueDate.trim()}|${normalizedTime}`;
}

export function isTaskDueAlertRecipient(
  task: Task,
  accessibleGroupIds: Set<string>,
  userId: string,
): boolean {
  if (!accessibleGroupIds.has(task.groupId)) {
    return false;
  }
  if (task.assigneeId !== null && task.assigneeId !== undefined) {
    return task.assigneeId === userId;
  }
  return true;
}

export function classifyDueTaskAlert(
  params: ClassifyDueTaskAlertParams,
): DueAlertClassification {
  const {
    task,
    timeZone,
    nowMs,
    mode,
    handledOccurrences,
    isEligibleRecipient = true,
  } = params;

  if (!isEligibleRecipient || task.completed || !task.dueDate) {
    return { action: 'none' };
  }

  const occurrenceKey = buildOccurrenceKey(task.dueDate, task.dueTime);
  const existingHandled = handledOccurrences.find(
    (entry) => entry.taskId === task.id && entry.occurrenceKey === occurrenceKey,
  );

  if (existingHandled) {
    if (
      existingHandled.status === 'notified' ||
      (existingHandled.status === 'suppressed' && mode !== 'uncheck')
    ) {
      return { action: 'already-handled', occurrenceKey };
    }
  }

  const triggerAtMs = getDueNotificationTriggerMs({
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    timeZone,
  });

  if (mode === 'save') {
    const nowDate = new Date(nowMs);
    const todayStr = getZonedCalendarDate(nowDate, timeZone);
    const hasDueTime = Boolean(task.dueTime && task.dueTime.trim().length > 0);

    if (!hasDueTime && task.dueDate === todayStr && isPastLocalNineAm(nowDate, timeZone)) {
      return {
        action: 'trigger-now',
        occurrenceKey,
        triggerAtMs,
      };
    }

    if (triggerAtMs <= nowMs) {
      return {
        action: 'suppress',
        occurrenceKey,
        triggerAtMs,
      };
    }

    return {
      action: 'schedule',
      occurrenceKey,
      triggerAtMs,
      delayMs: triggerAtMs - nowMs,
    };
  }

  if (mode === 'uncheck') {
    if (triggerAtMs > nowMs) {
      return {
        action: 'schedule',
        occurrenceKey,
        triggerAtMs,
        delayMs: triggerAtMs - nowMs,
      };
    }
    return {
      action: 'suppress',
      occurrenceKey,
      triggerAtMs,
    };
  }

  // mode === 'sync'
  if (triggerAtMs <= nowMs) {
    if (nowMs - triggerAtMs < RETENTION_WINDOW_MS) {
      return {
        action: 'trigger-now',
        occurrenceKey,
        triggerAtMs,
      };
    }
    return {
      action: 'suppress',
      occurrenceKey,
      triggerAtMs,
    };
  }

  return {
    action: 'schedule',
    occurrenceKey,
    triggerAtMs,
    delayMs: triggerAtMs - nowMs,
  };
}

export function formatDueAlertContent(
  task: Pick<Task, 'title' | 'dueDate' | 'dueTime'>,
  timeFormat: '24h' | '12h' = '24h',
): string {
  const formattedDate = task.dueDate ? formatDisplayDate(task.dueDate) : '';
  const rawTime = task.dueTime?.trim();
  if (rawTime) {
    const formattedTime = formatDisplayTime(rawTime, timeFormat);
    return es.notifications.dueAlertWithTime(task.title, formattedDate, formattedTime);
  }
  return es.notifications.dueAlertDateOnly(task.title, formattedDate);
}

export type SetTimerFn = (
  callback: () => void,
  delayMs: number,
) => ReturnType<typeof setTimeout>;

export type ClearTimerFn = (handle: ReturnType<typeof setTimeout>) => void;

export function scheduleCappedTimeout(
  targetMs: number,
  now: () => number,
  onDue: () => void,
  setTimer: SetTimerFn = (cb, delay) => setTimeout(cb, delay),
  clearTimer: ClearTimerFn = (handle) => clearTimeout(handle),
): () => void {
  let cancelled = false;
  let currentHandle: ReturnType<typeof setTimeout> | null = null;

  function scheduleNextChunk(): void {
    if (cancelled) {
      return;
    }
    const remaining = targetMs - now();
    if (remaining <= 0) {
      onDue();
      return;
    }
    const chunkMs = Math.min(remaining, MAX_SAFE_TIMEOUT_MS);
    currentHandle = setTimer(() => {
      currentHandle = null;
      if (!cancelled) {
        scheduleNextChunk();
      }
    }, chunkMs);
  }

  scheduleNextChunk();

  return () => {
    cancelled = true;
    if (currentHandle !== null) {
      clearTimer(currentHandle);
      currentHandle = null;
    }
  };
}
