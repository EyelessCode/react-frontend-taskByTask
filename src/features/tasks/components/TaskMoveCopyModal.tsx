import { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { useTaskMoveCopy } from '../hooks/use-task-move-copy';
import type { Task } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface TaskMoveCopyModalProps {
  show: boolean;
  mode: 'move' | 'copy';
  task?: Task | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TaskMoveCopyModal({
  show,
  mode,
  task,
  onClose,
  onSuccess,
}: TaskMoveCopyModalProps) {
  const {
    targetGroups,
    hasOtherGroups,
    groupsHasNext,
    isLoadingMoreGroups,
    loadMoreGroups,
    moveTask,
    copyTask,
  } = useTaskMoveCopy({
    task,
    mode,
    onSuccess,
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const effectiveGroupId =
    selectedGroupId && targetGroups.some((g) => g.id === selectedGroupId)
      ? selectedGroupId
      : targetGroups[0]?.id ?? '';

  const handleConfirm = async () => {
    if (!effectiveGroupId) return;

    if (mode === 'move') {
      await moveTask(effectiveGroupId);
    } else {
      await copyTask(effectiveGroupId);
    }
    onClose();
  };

  const title = mode === 'move' ? es.tasks.moveTitle : es.tasks.copyTitle;
  const confirmText =
    mode === 'move' ? es.tasks.confirmMove : es.tasks.confirmCopy;

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="fs-5">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!hasOtherGroups && !groupsHasNext && (
          <div className="alert alert-info py-2 px-3 small mb-0">
            {es.tasks.noOtherGroups}
          </div>
        )}
        {hasOtherGroups && (
          <Form.Group className="mb-2">
            <Form.Label htmlFor="destination-group-select">
              {es.tasks.selectGroupLabel}
            </Form.Label>
            <Form.Select
              id="destination-group-select"
              value={effectiveGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              {targetGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        )}
        {groupsHasNext && (
          <div className={hasOtherGroups ? 'mt-2' : ''}>
            <Button
              variant="outline-primary"
              size="sm"
              className="w-100"
              disabled={isLoadingMoreGroups}
              onClick={() => {
                void loadMoreGroups();
              }}
            >
              {isLoadingMoreGroups ? es.common.loadingMore : es.groups.loadMoreGroups}
            </Button>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {es.common.cancel}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!hasOtherGroups}
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
