import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Button from 'react-bootstrap/Button';
import type { TaskFilter } from '../utils/task-sort';
import { es } from '../../../shared/i18n';

export interface TaskFilterTabsProps {
  activeFilter?: TaskFilter;
  counts?: { pending: number; completed: number; all: number };
  onFilterChange?: (filter: TaskFilter) => void;
}

export function TaskFilterTabs({
  activeFilter = 'pendientes',
  counts = { pending: 0, completed: 0, all: 0 },
  onFilterChange,
}: TaskFilterTabsProps) {
  const tabs: Array<{ key: TaskFilter; label: string; count: number }> = [
    {
      key: 'pendientes',
      label: es.tasks.filterPending,
      count: counts.pending,
    },
    {
      key: 'completadas',
      label: es.tasks.filterCompleted,
      count: counts.completed,
    },
    {
      key: 'todas',
      label: es.tasks.filterAll,
      count: counts.all,
    },
  ];

  return (
    <ButtonGroup className="w-100 my-2" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.key;
        return (
          <Button
            key={tab.key}
            variant={isActive ? 'primary' : 'outline-primary'}
            size="sm"
            className="py-2"
            onClick={() => onFilterChange?.(tab.key)}
            aria-selected={isActive}
            role="tab"
          >
            {`${tab.label} (${tab.count})`}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
