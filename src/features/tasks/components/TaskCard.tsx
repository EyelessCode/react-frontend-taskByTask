import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import Dropdown from 'react-bootstrap/Dropdown';
import Form from 'react-bootstrap/Form';
import type { Task, Tag } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';
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
  timeFormat = '24h',
  now,
  timeZone,
}: TaskCardProps) {
  const overdue = isTaskOverdue({
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    completed: task.completed,
    now,
    timeZone,
  });

  // Resolve tags by tagIds
  const resolvedTags = (task.tagIds ?? [])
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));

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
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {visibleTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      bg="secondary"
                      className="fw-normal text-white"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {overflowCount > 0 && (
                    <Badge bg="light" text="dark" className="border fw-normal">
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
