import type { Task } from '../../../shared/schemas';
import { sortTasksByFilter, type TaskFilter } from '../../tasks/utils/task-sort';

export interface TaskFilterCriteria {
  filter: TaskFilter;
  searchQuery?: string;
  groupId?: string;
}

/**
 * Pure function that filters and sorts tasks by combined criteria (REQ-GRP-13, REQ-GRP-17..21, RF-15, RF-25):
 * 1. groupId match (if provided)
 * 2. status filter ('pendientes' | 'completadas' | 'todas')
 * 3. title substring match (case-insensitive, trimmed)
 * 4. Deterministic sorting via sortTasksByFilter
 */
export function filterTasksByCriteria(tasks: Task[], criteria: TaskFilterCriteria): Task[] {
  let filtered = tasks;

  if (criteria.groupId) {
    filtered = filtered.filter((t) => t.groupId === criteria.groupId);
  }

  if (criteria.filter === 'pendientes') {
    filtered = filtered.filter((t) => !t.completed);
  } else if (criteria.filter === 'completadas') {
    filtered = filtered.filter((t) => t.completed);
  }

  if (criteria.searchQuery && criteria.searchQuery.trim().length > 0) {
    const q = criteria.searchQuery.trim().toLowerCase();
    filtered = filtered.filter((t) => t.title.toLowerCase().includes(q));
  }

  return sortTasksByFilter(filtered, criteria.filter);
}
