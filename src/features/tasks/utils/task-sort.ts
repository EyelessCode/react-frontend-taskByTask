import type { Task } from '../../../shared/schemas';

export function compareTasks(a: Task, b: Task): number {
  const hasDueA = Boolean(a.dueDate);
  const hasDueB = Boolean(b.dueDate);

  if (hasDueA && hasDueB) {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate!.localeCompare(b.dueDate!);
    }
    const timeA = a.dueTime ?? '23:59:59.999';
    const timeB = b.dueTime ?? '23:59:59.999';
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
  }

  if (hasDueA !== hasDueB) {
    return hasDueA ? -1 : 1;
  }

  if (!hasDueA && !hasDueB) {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
  }

  return a.id.localeCompare(b.id);
}

export type TaskFilter = 'pendientes' | 'completadas' | 'todas';

export function sortTasksByFilter(tasks: Task[], filter: TaskFilter): Task[] {
  const pending = tasks.filter((t) => !t.completed).sort(compareTasks);
  const completed = tasks.filter((t) => t.completed).sort(compareTasks);

  if (filter === 'pendientes') return pending;
  if (filter === 'completadas') return completed;
  return [...pending, ...completed];
}
