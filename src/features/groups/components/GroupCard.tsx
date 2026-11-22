import Badge from 'react-bootstrap/Badge';
import Dropdown from 'react-bootstrap/Dropdown';
import Button from 'react-bootstrap/Button';
import { TaskCard } from '../../tasks/components/TaskCard';
import type { Group, Task, Tag } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface GroupCardProps {
  group: Group;
  tasks: Task[];
  tags?: Tag[];
  hasMoreTasks?: boolean;
  isLoadingMoreTasks?: boolean;
  onLoadMoreTasks?: (groupId: string) => void;
  onAddTask?: (groupId: string) => void;
  onRenameGroup?: (group: Group) => void;
  onDeleteGroup?: (group: Group) => void;
  onToggleComplete?: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
  onMoveTask?: (task: Task) => void;
  onCopyTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onRemoveTag?: (task: Task, tag: Tag) => void;
  timeFormat?: '24h' | '12h';
  now?: Date;
  timeZone?: string;
}

export function GroupCard({
  group,
  tasks,
  tags = [],
  hasMoreTasks = false,
  isLoadingMoreTasks = false,
  onLoadMoreTasks,
  onAddTask,
  onRenameGroup,
  onDeleteGroup,
  onToggleComplete,
  onEditTask,
  onMoveTask,
  onCopyTask,
  onDeleteTask,
  onRemoveTag,
  timeFormat = '24h',
  now,
  timeZone,
}: GroupCardProps) {
  return (
    <div className="group-card bg-white border rounded shadow-sm h-100 p-3 d-flex flex-column">
      {/* Group Header */}
      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h2 className="fs-5 fw-bold mb-0 text-dark">
            {group.name}
          </h2>
            {group.isPersonal && (
              <Badge bg="primary">
                {es.groups.personalBadge}
              </Badge>
            )}
            <Badge bg="secondary">
              {hasMoreTasks
                ? es.groups.taskCountAtLeast(tasks.length)
                : es.groups.taskCount(tasks.length)}
            </Badge>
          </div>

          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              size="sm"
              className="text-secondary p-0 border-0 shadow-none text-decoration-none"
              aria-label={es.groups.groupMenuAria}
            >
              <span aria-hidden="true" className="fs-5 lh-1">⋮</span>
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item onClick={() => onRenameGroup?.(group)}>
                {es.groups.actionRename}
              </Dropdown.Item>
              {!group.isPersonal && (
                <Dropdown.Item
                  className="text-danger"
                  onClick={() => onDeleteGroup?.(group)}
                >
                  {es.groups.actionDelete}
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>

        {/* Task List Container */}
        <div className="task-list d-flex flex-column gap-2 flex-grow-1">
          {tasks.length === 0 ? (
            <div className="text-muted small text-center py-4 my-auto">
              <div>{es.groups.emptyGroupTasks}</div>
              <div className="text-secondary small mt-1">{es.tasks.emptyPending}</div>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                tags={tags}
                onToggleComplete={onToggleComplete}
                onEdit={onEditTask}
                onMove={onMoveTask}
                onCopy={onCopyTask}
                onDelete={onDeleteTask}
                onRemoveTag={onRemoveTag}
                timeFormat={timeFormat}
                now={now}
                timeZone={timeZone}
              />
            ))
          )}
        </div>

        {hasMoreTasks && onLoadMoreTasks && (
          <Button
            variant="outline-secondary"
            size="sm"
            className="w-100 mt-2"
            disabled={isLoadingMoreTasks}
            aria-label={`${es.tasks.loadMoreTasks} (${group.name})`}
            onClick={() => onLoadMoreTasks(group.id)}
          >
            {isLoadingMoreTasks ? es.common.loadingMore : es.tasks.loadMoreTasks}
          </Button>
        )}

        {/* Inline Add Task Button */}
        <Button
          variant="outline-primary"
          size="sm"
          className="w-100 mt-3"
          onClick={() => onAddTask?.(group.id)}
        >
          + {es.groups.addTaskToGroup}
        </Button>
      </div>
    );
  }
