import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import Dropdown from 'react-bootstrap/Dropdown';
import Form from 'react-bootstrap/Form';
import type { Task, Tag } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';
import { resolveTaskTags } from '../../tags/utils';
import {
  formatDisplayDate,
  formatDisplayTime,
  isTaskOverdue,
} from '../../../shared/utils';

export interface TaskCardProps {
  task: Task;
  tags?: Tag[];
  onToggleComplete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onMove?: (task: Task) => void;
  onCopy?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onRemoveTag?: (task: Task, tag: Tag) => void;
  timeFormat?: '24h' | '12h';
  now?: Date;
  timeZone?: string;
}

export function TaskCard({
  task,
  tags = [],
  onToggleComplete,
  onEdit,
  onMove,
  onCopy,
  onDelete,
  onRemoveTag,
  timeFormat = '24h',
  now,
  timeZone,
}: TaskCardProps) {
  const overdue = task.completed
    ? false
    : typeof task.overdue === 'boolean'
      ? task.overdue
      : isTaskOverdue({
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          completed: task.completed,
          now,
          timeZone,
        });

  // Resolve tags by tagIds scoped to task's group
  const resolvedTags = resolveTaskTags(task.tagIds, tags, task.groupId);

  const visibleTags = resolvedTags.slice(0, 5);
  const overflowCount = resolvedTags.length - 5;

  const cardBorderClass = overdue ? 'border-danger' : '';
  const titleClass = task.completed
    ? 'text-decoration-line-through text-muted'
    : overdue
      ? 'text-danger fw-semibold'
      : 'fw-semibold text-dark';

  return (
    <Card className={`mb-3 shadow-sm ${cardBorderClass}`}>
      <Card.Body className="p-3">
        <div className="d-flex align-items-start justify-content-between gap-2">
          {/* Completion Checkbox & Title */}
          <div className="d-flex align-items-start gap-2 flex-grow-1">
            <Form.Check
              type="checkbox"
              id={`task-check-${task.id}`}
              className="mt-1"
              checked={task.completed}
              onChange={() => onToggleComplete?.(task.id)}
              aria-label={`Marcar tarea "${task.title}" como ${
                task.completed ? 'pendiente' : 'completada'
              }`}
            />
            <div className="flex-grow-1">
              <div className="d-flex align-items-center flex-wrap gap-2">
                <span className={titleClass}>{task.title}</span>
                {overdue && (
                  <Badge bg="danger" className="text-white">
                    {es.tasks.badgeOverdue}
                  </Badge>
                )}
              </div>

              {task.description && (
                <Card.Text className="text-muted small mt-1 mb-2">
                  {task.description}
                </Card.Text>
              )}

              {/* Due Date & Time info */}
              {task.dueDate && (
                <div className="small text-muted mb-2">
                  <span>📅 {formatDisplayDate(task.dueDate)}</span>
                  {task.dueTime && (
                    <span className="ms-2">
                      ⏰ {formatDisplayTime(task.dueTime, timeFormat)}
                    </span>
                  )}
                </div>
              )}

              {/* Tag Chips */}
              {resolvedTags.length > 0 && (
                <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                  {visibleTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      bg="secondary"
                      className="d-inline-flex align-items-center gap-1 py-1 px-2 fw-normal text-white"
                    >
                      <span>{tag.name}</span>
                      <button
                        type="button"
                        className="btn-close btn-close-white p-0 ms-1"
                        style={{ width: '0.5rem', height: '0.5rem' }}
                        aria-label={es.tasks.removeTagAria(tag.name)}
                        onClick={() => onRemoveTag?.(task, tag)}
                      />
                    </Badge>
                  ))}
                  {overflowCount > 0 && (
                    <Badge
                      bg="light"
                      text="dark"
                      className="border fw-normal"
                      aria-label={es.tasks.tagOverflowAria(overflowCount)}
                    >
                      {es.tasks.tagOverflow(overflowCount)}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Menu (Vertical Three Dots) */}
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              size="sm"
              className="p-1 text-secondary text-decoration-none border-0"
              aria-label={es.tasks.actionMenuAria}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>&#8942;</span>
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item
                as="button"
                onClick={() => onEdit?.(task)}
              >
                {es.tasks.actionEdit}
              </Dropdown.Item>
              <Dropdown.Item
                as="button"
                onClick={() => onMove?.(task)}
              >
                {es.tasks.actionMove}
              </Dropdown.Item>
              <Dropdown.Item
                as="button"
                onClick={() => onCopy?.(task)}
              >
                {es.tasks.actionCopy}
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                as="button"
                className="text-danger"
                onClick={() => onDelete?.(task)}
              >
                {es.tasks.actionDelete}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Card.Body>
    </Card>
  );
}
