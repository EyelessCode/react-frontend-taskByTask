import type { Task, Tag } from '../../../shared/schemas';
import type { TaskFilter } from '../utils/task-sort';
import { TaskCard } from './TaskCard';
import { es } from '../../../shared/i18n';

export interface TaskListProps {
  tasks?: Task[];
  tags?: Tag[];
  filter?: TaskFilter;
  onToggleComplete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onMove?: (task: Task) => void;
  onCopy?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onRemoveTag?: (task: Task, tag: Tag) => void;
  timeFormat?: '24h' | '12h';
}

export function TaskList({
  tasks = [],
  tags = [],
  filter = 'pendientes',
  onToggleComplete,
  onEdit,
  onMove,
  onCopy,
  onDelete,
  onRemoveTag,
  timeFormat = '24h',
}: TaskListProps) {
  if (tasks.length === 0) {
    let emptyMessage: string = es.tasks.emptyAll;
    if (filter === 'pendientes') {
      emptyMessage = es.tasks.emptyPending;
    } else if (filter === 'completadas') {
      emptyMessage = es.tasks.emptyCompleted;
    }

    return (
      <div className="text-center py-5 text-muted bg-light rounded-3 border my-3">
        <p className="mb-0 fs-6">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="task-list my-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          tags={tags}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onMove={onMove}
          onCopy={onCopy}
          onDelete={onDelete}
          onRemoveTag={onRemoveTag}
          timeFormat={timeFormat}
        />
      ))}
    </div>
  );
}
