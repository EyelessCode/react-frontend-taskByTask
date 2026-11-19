import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { useTasksStore } from '../store';
import type { Task } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface TaskDeleteConfirmModalProps {
  show: boolean;
  task?: Task | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TaskDeleteConfirmModal({
  show,
  task,
  onClose,
  onSuccess,
}: TaskDeleteConfirmModalProps) {
  const deleteTask = useTasksStore((state) => state.deleteTask);

  const handleConfirm = async () => {
    if (task) {
      await deleteTask(task.id);
      onSuccess?.();
    }
    onClose();
  };

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="fs-5 text-danger">
          {es.tasks.deleteTitle}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="mb-2">{es.tasks.deleteMessage}</p>
        {task && (
          <p className="fw-semibold text-danger mb-0 small">
            {task.title}
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {es.tasks.cancelDelete}
        </Button>
        <Button variant="danger" size="sm" onClick={handleConfirm}>
          {es.tasks.confirmDelete}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
