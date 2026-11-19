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
import { useAuthStore } from '../../auth/store';
import type { Task } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';
import {
  from12HourParts,
  to12HourParts,
  type TimeParts12h,
  type TimePeriod12h,
} from '../../../shared/utils';

const HOURS_12 = Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, '0'));
const EMPTY_TIME_PARTS: TimeParts12h = { hour: '', minute: '', period: '' };

export interface TaskFormModalProps {
  show: boolean;
  task?: Task | null;
  defaultGroupId?: string;
  timeFormat?: '24h' | '12h';
  onClose: () => void;
  onSuccess?: () => void;
  onTagMutated?: () => void;
}

export function TaskFormModal({
  show,
  task,
  defaultGroupId,
  timeFormat,
  onClose,
  onSuccess,
  onTagMutated,
}: TaskFormModalProps) {
  const storeTimeFormat = useAuthStore((state) => state.currentUser?.timeFormat ?? '24h');
  const activeTimeFormat = timeFormat ?? storeTimeFormat;
  const tagInputRef = useRef<TaskTagInputHandle>(null);
  const syncKey = show
    ? `${task?.id ?? 'new'}:${task?.dueTime ?? ''}:${activeTimeFormat}`
    : 'closed';
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  const [pendingRemovalTagName, setPendingRemovalTagName] = useState<string | null>(null);
  const [timeParts12h, setTimeParts12h] = useState<TimeParts12h>(() =>
    to12HourParts(task?.dueTime),
  );
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    setTimeParts12h(show ? to12HourParts(task?.dueTime) : EMPTY_TIME_PARTS);
  }
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
  const watchedDueTime = useWatch({ control: form.control, name: 'dueTime' });
  const watchedTagNames = useWatch({ control: form.control, name: 'tagNames' }) ?? [];
  const isTimeDisabled = !watchedDueDate || watchedDueDate.trim().length === 0;
  const hasAny12hPart = Boolean(
    timeParts12h.hour || timeParts12h.minute || timeParts12h.period,
  );
  const isClearTimeDisabled =
    isTimeDisabled || (activeTimeFormat === '12h' ? !hasAny12hPart : !watchedDueTime);

  const handleClearTime = () => {
    setTimeParts12h(EMPTY_TIME_PARTS);
    form.setValue('dueTime', '');
    form.clearErrors('dueTime');
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const commitResult = tagInputRef.current?.commitPendingInput();
    if (commitResult && !commitResult.ok) {
      return;
    }
    if (commitResult) {
      form.setValue('tagNames', commitResult.tags);
    }

    if (activeTimeFormat === '12h') {
      const converted = from12HourParts(timeParts12h);
      if (!converted.ok && converted.reason === 'incomplete') {
        form.setError('dueTime', {
          type: 'manual',
          message: es.auth.incompleteTimeError,
        });
        return;
      }
      form.setValue('dueTime', converted.ok ? converted.dueTime : '');
      form.clearErrors('dueTime');
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
                    {...form.register('dueDate', {
                      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                        if (!event.target.value.trim()) {
                          handleClearTime();
                        }
                      },
                    })}
                    isInvalid={Boolean(form.formState.errors.dueDate)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.dueDate?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col sm={6} xs={12}>
                <Form.Group className="mb-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <Form.Label htmlFor="task-duetime-input">
                      {es.tasks.dueTimeLabel}
                    </Form.Label>
                    <Button
                      variant="link"
                      size="sm"
                      type="button"
                      className="p-0 text-decoration-none small"
                      disabled={isClearTimeDisabled}
                      onClick={handleClearTime}
                    >
                      {es.auth.clearTimeLabel}
                    </Button>
                  </div>
                  {activeTimeFormat === '12h' ? (
                    <div className="d-flex gap-1 align-items-center">
                      <Form.Select
                        id="task-duetime-input"
                        aria-label={es.auth.timeHourAria}
                        size="sm"
                        disabled={isTimeDisabled}
                        value={timeParts12h.hour}
                        isInvalid={Boolean(form.formState.errors.dueTime)}
                        onChange={(e) => {
                          setTimeParts12h((prev) => ({ ...prev, hour: e.target.value }));
                          form.clearErrors('dueTime');
                        }}
                      >
                        <option value="">--</option>
                        {HOURS_12.map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Select
                        id="task-duetime-minute-select"
                        aria-label={es.auth.timeMinuteAria}
                        size="sm"
                        disabled={isTimeDisabled}
                        value={timeParts12h.minute}
                        isInvalid={Boolean(form.formState.errors.dueTime)}
                        onChange={(e) => {
                          setTimeParts12h((prev) => ({ ...prev, minute: e.target.value }));
                          form.clearErrors('dueTime');
                        }}
                      >
                        <option value="">--</option>
                        {MINUTES_60.map((minute) => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Select
                        id="task-duetime-period-select"
                        aria-label={es.auth.timePeriodAria}
                        size="sm"
                        disabled={isTimeDisabled}
                        value={timeParts12h.period}
                        isInvalid={Boolean(form.formState.errors.dueTime)}
                        onChange={(e) => {
                          setTimeParts12h((prev) => ({
                            ...prev,
                            period: e.target.value as TimePeriod12h | '',
                          }));
                          form.clearErrors('dueTime');
                        }}
                      >
                        <option value="">--</option>
                        <option value="am">a. m.</option>
                        <option value="pm">p. m.</option>
                      </Form.Select>
                    </div>
                  ) : (
                    <Form.Control
                      id="task-duetime-input"
                      type="time"
                      disabled={isTimeDisabled}
                      {...form.register('dueTime')}
                      isInvalid={Boolean(form.formState.errors.dueTime)}
                    />
                  )}
                  {form.formState.errors.dueTime && (
                    <div className="invalid-feedback d-block">
                      {form.formState.errors.dueTime.message}
                    </div>
                  )}
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
