import { describe, it, expect } from 'vitest';
import type { Task } from '@/shared/schemas';
import {
  compareTasks,
  sortTasksByFilter,
  type TaskFilter,
} from '@/features/tasks/utils/task-sort';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Test task',
    groupId: overrides.groupId ?? 'grp-1',
    completed: overrides.completed ?? false,
    createdAt: overrides.createdAt ?? '2026-11-01T12:00:00.000Z',
    dueDate: overrides.dueDate,
    dueTime: overrides.dueTime,
    tagIds: overrides.tagIds ?? [],
  };
}

describe('Deterministic Task Sorting Utility (features/tasks/utils/task-sort)', () => {
  describe('compareTasks (REQ-TK-16, AC-TK-07)', () => {
    it('should order dated tasks ascending by dueDate', () => {
      const taskA = createTask({ id: 'a', dueDate: '2026-11-01' });
      const taskB = createTask({ id: 'b', dueDate: '2026-11-05' });

      expect(compareTasks(taskA, taskB)).toBeLessThan(0);
      expect(compareTasks(taskB, taskA)).toBeGreaterThan(0);
    });

    it('should order tasks on the same dueDate ascending by dueTime', () => {
      const morningTask = createTask({ id: 'morning', dueDate: '2026-11-02', dueTime: '08:30' });
      const afternoonTask = createTask({ id: 'afternoon', dueDate: '2026-11-02', dueTime: '14:00' });

      expect(compareTasks(morningTask, afternoonTask)).toBeLessThan(0);
      expect(compareTasks(afternoonTask, morningTask)).toBeGreaterThan(0);
    });

    it('should place untimed tasks after all timed tasks on the same dueDate', () => {
      const timedTask = createTask({ id: 'timed', dueDate: '2026-11-02', dueTime: '23:59' });
      const untimedTask = createTask({ id: 'untimed', dueDate: '2026-11-02', dueTime: null });

      // Timed task (even at 23:59) precedes untimed task (evaluated at 23:59:59.999)
      expect(compareTasks(timedTask, untimedTask)).toBeLessThan(0);
      expect(compareTasks(untimedTask, timedTask)).toBeGreaterThan(0);
    });

    it('should position all dated tasks before any undated tasks', () => {
      const datedFarFuture = createTask({ id: 'dated', dueDate: '2029-12-31' });
      const undatedOld = createTask({ id: 'undated', dueDate: null, createdAt: '2020-01-01T00:00:00.000Z' });

      expect(compareTasks(datedFarFuture, undatedOld)).toBeLessThan(0);
      expect(compareTasks(undatedOld, datedFarFuture)).toBeGreaterThan(0);
    });

    it('should order undated tasks ascending by createdAt (oldest first)', () => {
      const olderTask = createTask({
        id: 'older',
        dueDate: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const newerTask = createTask({
        id: 'newer',
        dueDate: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      });

      expect(compareTasks(olderTask, newerTask)).toBeLessThan(0);
      expect(compareTasks(newerTask, olderTask)).toBeGreaterThan(0);
    });

    it('should break ties deterministically using id ascending', () => {
      const task1 = createTask({ id: 'id-aaa', dueDate: '2026-11-02', dueTime: '10:00' });
      const task2 = createTask({ id: 'id-bbb', dueDate: '2026-11-02', dueTime: '10:00' });

      expect(compareTasks(task1, task2)).toBeLessThan(0);
      expect(compareTasks(task2, task1)).toBeGreaterThan(0);

      const undated1 = createTask({ id: 'undated-1', dueDate: null, createdAt: '2026-01-01T00:00:00.000Z' });
      const undated2 = createTask({ id: 'undated-2', dueDate: null, createdAt: '2026-01-01T00:00:00.000Z' });

      expect(compareTasks(undated1, undated2)).toBeLessThan(0);
      expect(compareTasks(undated2, undated1)).toBeGreaterThan(0);
    });
  });

  describe('sortTasksByFilter (REQ-TK-17, AC-TK-07)', () => {
    const taskTimedEarly = createTask({ id: '1', title: 'Timed Early', dueDate: '2026-11-02', dueTime: '09:00', completed: false });
    const taskTimedLate = createTask({ id: '2', title: 'Timed Late', dueDate: '2026-11-02', dueTime: '18:00', completed: false });
    const taskUntimed = createTask({ id: '3', title: 'Untimed', dueDate: '2026-11-02', dueTime: null, completed: false });
    const taskUndated = createTask({ id: '4', title: 'Undated', dueDate: null, createdAt: '2026-10-01T00:00:00.000Z', completed: false });

    const completedEarly = createTask({ id: '5', title: 'Done Early', dueDate: '2026-11-01', completed: true });
    const completedLate = createTask({ id: '6', title: 'Done Late', dueDate: '2026-11-03', completed: true });

    const mixedTasks = [
      completedLate,
      taskUntimed,
      taskTimedLate,
      completedEarly,
      taskUndated,
      taskTimedEarly,
    ];

    it('should filter only pending tasks and sort them when filter is "pendientes"', () => {
      const result = sortTasksByFilter(mixedTasks, 'pendientes');
      expect(result.map((t) => t.id)).toEqual(['1', '2', '3', '4']);
    });

    it('should filter only completed tasks and sort them when filter is "completadas"', () => {
      const result = sortTasksByFilter(mixedTasks, 'completadas');
      expect(result.map((t) => t.id)).toEqual(['5', '6']);
    });

    it('should return pending tasks first, followed by completed tasks at the bottom when filter is "todas"', () => {
      const result = sortTasksByFilter(mixedTasks, 'todas');
      // Pending tasks sorted: 1, 2, 3, 4
      // Completed tasks sorted: 5, 6
      expect(result.map((t) => t.id)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('should not mutate the input tasks array in place', () => {
      const originalCopy = [...mixedTasks];
      sortTasksByFilter(mixedTasks, 'todas');
      expect(mixedTasks).toEqual(originalCopy);
    });

    it('should handle empty input arrays gracefully', () => {
      const filters: TaskFilter[] = ['pendientes', 'completadas', 'todas'];
      filters.forEach((filter) => {
        expect(sortTasksByFilter([], filter)).toEqual([]);
      });
    });
  });
});
