import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useTaskForm } from '../hooks/use-task-form';
import { TaskTagInput } from './TaskTagInput';
import type { Task } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface TaskFormModalProps {
  show: boolean;
  task?: Task | null;
  defaultGroupId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TaskFormModal({
  show,
  task,
  defaultGroupId,
  onClose,
  onSuccess,
}: TaskFormModalProps) {
  const { form, isEdit, onSubmit, groupTags } = useTaskForm({
    task,
    defaultGroupId,
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  const watchedDueDate = form.watch('dueDate');
  const watchedTagNames = form.watch('tagNames') ?? [];
  const isTimeDisabled = !watchedDueDate || watchedDueDate.trim().length === 0;

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Form onSubmit={onSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="fs-5">
            {isEdit ? es.tasks.editTitle : es.tasks.createTitle}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Title */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="task-title-input">
              {es.tasks.titleLabel}
            </Form.Label>
            <Form.Control
              id="task-title-input"
              type="text"
              placeholder={es.tasks.titlePlaceholder}
              {...form.register('title')}
              isInvalid={Boolean(form.formState.errors.title)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.title?.message}
            </Form.Control.Feedback>
          </Form.Group>

          {/* Description */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="task-desc-input">
              {es.tasks.descLabel}
            </Form.Label>
            <Form.Control
              id="task-desc-input"
              as="textarea"
              rows={3}
              placeholder={es.tasks.descPlaceholder}
              {...form.register('description')}
              isInvalid={Boolean(form.formState.errors.description)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.description?.message}
            </Form.Control.Feedback>
          </Form.Group>

          {/* Due Date & Time */}
          <Row>
            <Col sm={6} xs={12}>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="task-duedate-input">
                  {es.tasks.dueDateLabel}
                </Form.Label>
                <Form.Control
                  id="task-duedate-input"
                  type="date"
                  {...form.register('dueDate')}
                  isInvalid={Boolean(form.formState.errors.dueDate)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.dueDate?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col sm={6} xs={12}>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="task-duetime-input">
                  {es.tasks.dueTimeLabel}
                </Form.Label>
                <Form.Control
                  id="task-duetime-input"
                  type="time"
                  disabled={isTimeDisabled}
                  {...form.register('dueTime')}
                  isInvalid={Boolean(form.formState.errors.dueTime)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.dueTime?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* Tags */}
          <Form.Group className="mb-2">
            <Form.Label>{es.tasks.tagsLabel}</Form.Label>
            <TaskTagInput
              value={watchedTagNames}
              onChange={(tags) => form.setValue('tagNames', tags)}
              availableTags={groupTags}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {es.common.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {es.common.save}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
