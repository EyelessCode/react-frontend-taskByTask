import { describe, it, expect } from 'vitest';
import type { Task } from '@/shared/schemas';
import {
  filterTasksByCriteria,
  type TaskFilterCriteria,
} from '@/features/groups/utils/filter-tasks';

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

describe('Multi-Criteria Task Filtering Utility (features/groups/utils/filter-tasks)', () => {
  const tasks: Task[] = [
    createTask({
      id: 'task-1',
      title: 'Estudiar para el examen de cálculo',
      groupId: 'grp-study',
      completed: false,
      dueDate: '2026-11-05',
      dueTime: '10:00',
      createdAt: '2026-11-01T10:00:00.000Z',
    }),
    createTask({
      id: 'task-2',
      title: 'Comprar libros de física',
      groupId: 'grp-study',
      completed: true,
      dueDate: '2026-11-03',
      createdAt: '2026-11-01T11:00:00.000Z',
    }),
    createTask({
      id: 'task-3',
      title: 'Preparar informe del examen final',
      groupId: 'grp-work',
      completed: false,
      dueDate: '2026-11-06',
      createdAt: '2026-11-01T12:00:00.000Z',
    }),
    createTask({
      id: 'task-4',
      title: 'Llamar al médico',
      groupId: 'grp-personal',
      completed: true,
      createdAt: '2026-11-01T13:00:00.000Z',
    }),
  ];

  describe('Filtering by groupId (REQ-GRP-13, REQ-GRP-20)', () => {
    it('should include only tasks belonging to the specified groupId', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
        groupId: 'grp-study',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result.map((t) => t.id)).toEqual(['task-1', 'task-2']);
      expect(result.every((t) => t.groupId === 'grp-study')).toBe(true);
    });

    it('should include tasks from all groups when groupId is undefined', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result).toHaveLength(4);
    });

    it('should return an empty array if no tasks belong to the requested groupId', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
        groupId: 'grp-empty',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result).toEqual([]);
    });
  });

  describe('Filtering by status (REQ-GRP-17)', () => {
    it('should include only incomplete tasks when filter is "pendientes"', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'pendientes',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result.map((t) => t.id)).toEqual(['task-1', 'task-3']);
      expect(result.every((t) => !t.completed)).toBe(true);
    });

    it('should include only completed tasks when filter is "completadas"', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'completadas',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result.map((t) => t.id)).toEqual(['task-2', 'task-4']);
      expect(result.every((t) => t.completed)).toBe(true);
    });

    it('should include both pending and completed tasks when filter is "todas"', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result).toHaveLength(4);
    });
  });

  describe('Substring search by title (REQ-GRP-18)', () => {
    it('should perform case-insensitive substring search', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
        searchQuery: 'EXAMEN',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result.map((t) => t.id)).toEqual(['task-1', 'task-3']);
    });

    it('should trim leading and trailing whitespace from the search query', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
        searchQuery: '   médico   ',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result.map((t) => t.id)).toEqual(['task-4']);
    });

    it('should return all matching status tasks when searchQuery is empty or whitespace only', () => {
      const criteriaEmpty: TaskFilterCriteria = {
        filter: 'pendientes',
        searchQuery: '',
      };
      const criteriaWhitespace: TaskFilterCriteria = {
        filter: 'pendientes',
        searchQuery: '   ',
      };

      const resultEmpty = filterTasksByCriteria(tasks, criteriaEmpty);
      const resultWhitespace = filterTasksByCriteria(tasks, criteriaWhitespace);

      expect(resultEmpty.map((t) => t.id)).toEqual(['task-1', 'task-3']);
      expect(resultWhitespace.map((t) => t.id)).toEqual(['task-1', 'task-3']);
    });

    it('should return empty array when no titles match the query', () => {
      const criteria: TaskFilterCriteria = {
        filter: 'todas',
        searchQuery: 'inexistente',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result).toEqual([]);
    });
  });

  describe('Combined Multi-Criteria (REQ-GRP-21)', () => {
    it('should filter by groupId, filter, and searchQuery simultaneously', () => {
      const criteria: TaskFilterCriteria = {
        groupId: 'grp-study',
        filter: 'pendientes',
        searchQuery: 'cálculo',
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result.map((t) => t.id)).toEqual(['task-1']);
    });

    it('should return empty if task matches groupId and status but not searchQuery', () => {
      const criteria: TaskFilterCriteria = {
        groupId: 'grp-study',
        filter: 'pendientes',
        searchQuery: 'física', // 'física' is in task-2, but task-2 is completed
      };

      const result = filterTasksByCriteria(tasks, criteria);

      expect(result).toEqual([]);
    });
  });

  describe('Deterministic task sorting (REQ-GRP-13, RF-15)', () => {
    it('should return tasks deterministically ordered via sortTasksByFilter', () => {
      const mixedTasks: Task[] = [
        createTask({ id: 'c1', title: 'C1', completed: true, dueDate: '2026-11-10' }),
        createTask({ id: 'p2', title: 'P2', completed: false, dueDate: '2026-11-08' }),
        createTask({ id: 'p1', title: 'P1', completed: false, dueDate: '2026-11-02' }),
        createTask({ id: 'c2', title: 'C2', completed: true, dueDate: '2026-11-04' }),
      ];

      const result = filterTasksByCriteria(mixedTasks, { filter: 'todas' });

      // In 'todas': all pending tasks first (sorted by dueDate), then completed tasks (sorted by dueDate)
      expect(result.map((t) => t.id)).toEqual(['p1', 'p2', 'c2', 'c1']);
    });

    it('should not mutate the input tasks array', () => {
      const input = [...tasks];
      const copy = [...tasks];

      filterTasksByCriteria(input, { filter: 'pendientes' });

      expect(input).toEqual(copy);
    });
  });
});
