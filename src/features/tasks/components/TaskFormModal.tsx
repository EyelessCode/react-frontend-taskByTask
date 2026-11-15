import { useRef, useState, type FormEvent } from 'react';
import { useWatch } from 'react-hook-form';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useTaskForm } from '../hooks/use-task-form';
import { useTasksStore } from '../store';
import { TaskTagInput, type TaskTagInputHandle } from './TaskTagInput';
import { TaskTagRemovalModal } from './TaskTagRemovalModal';
import { findMatchingGroupTag, normalizeTagName } from '../../tags/utils';
import type { Task } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface TaskFormModalProps {
  show: boolean;
  task?: Task | null;
  defaultGroupId?: string;
  onClose: () => void;
  onSuccess?: () => void;
  onTagMutated?: () => void;
}

export function TaskFormModal({
  show,
  task,
  defaultGroupId,
  onClose,
  onSuccess,
  onTagMutated,
}: TaskFormModalProps) {
  const tagInputRef = useRef<TaskTagInputHandle>(null);
  const [pendingRemovalTagName, setPendingRemovalTagName] = useState<string | null>(null);
  const removeTagFromTask = useTasksStore((state) => state.removeTagFromTask);
  const deleteTagFromGroup = useTasksStore((state) => state.deleteTagFromGroup);

  const { form, isEdit, onSubmit, groupTags, persistedTagNames } = useTaskForm({
    task,
    defaultGroupId,
    show,
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  const watchedDueDate = useWatch({ control: form.control, name: 'dueDate' });
  const watchedTagNames = useWatch({ control: form.control, name: 'tagNames' }) ?? [];
  const isTimeDisabled = !watchedDueDate || watchedDueDate.trim().length === 0;

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const commitResult = tagInputRef.current?.commitPendingInput();
    if (commitResult && !commitResult.ok) {
      return;
    }
    if (commitResult) {
      form.setValue('tagNames', commitResult.tags);
    }
    void onSubmit(e);
  };

  const removePendingTagFromForm = (targetName: string) => {
    const normalizedTarget = normalizeTagName(targetName);
    const current = form.getValues('tagNames') ?? [];
    form.setValue(
      'tagNames',
      current.filter((name) => normalizeTagName(name) !== normalizedTarget),
    );
  };

  const handleCloseRemovalModal = () => {
    setPendingRemovalTagName(null);
  };

  const handleConfirmRemoveOnlyFromTask = async () => {
    if (!pendingRemovalTagName) return;
    const tagName = pendingRemovalTagName;
    const targetTag = findMatchingGroupTag(tagName, groupTags);
    if (task && targetTag) {
      await removeTagFromTask(task.id, targetTag.id);
    }
    removePendingTagFromForm(tagName);
    setPendingRemovalTagName(null);
    onTagMutated?.();
  };

  const handleConfirmRemoveFromGroup = async () => {
    if (!pendingRemovalTagName) return;
    const tagName = pendingRemovalTagName;
    const targetTag = findMatchingGroupTag(tagName, groupTags);
    if (targetTag) {
      await deleteTagFromGroup(targetTag.id);
    }
    removePendingTagFromForm(tagName);
    setPendingRemovalTagName(null);
    onTagMutated?.();
  };

  return (
    <>
      <Modal show={show} onHide={onClose} centered backdrop="static">
        <Form onSubmit={handleFormSubmit} noValidate>
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
              <Form.Label htmlFor="task-tags-input">{es.tasks.tagsLabel}</Form.Label>
              <TaskTagInput
                inputId="task-tags-input"
                ref={tagInputRef}
                value={watchedTagNames}
                onChange={(tags) => form.setValue('tagNames', tags)}
                availableTags={groupTags}
                persistedTagNames={isEdit ? persistedTagNames : []}
                onRemoveRequest={
                  isEdit ? (tagName) => setPendingRemovalTagName(tagName) : undefined
                }
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

      <TaskTagRemovalModal
        show={Boolean(pendingRemovalTagName)}
        tagName={pendingRemovalTagName}
        onClose={handleCloseRemovalModal}
        onExited={() => tagInputRef.current?.focusInput()}
        onRemoveOnlyFromTask={() => {
          void handleConfirmRemoveOnlyFromTask();
        }}
        onRemoveFromGroup={() => {
          void handleConfirmRemoveFromGroup();
        }}
      />
    </>
  );
}
