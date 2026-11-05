import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { es } from '../../../shared/i18n';

export interface TaskTagRemovalModalProps {
  show: boolean;
  tagName: string | null;
  onClose: () => void;
  onRemoveOnlyFromTask: () => void;
  onRemoveFromGroup: () => void;
}

export function TaskTagRemovalModal({
  show,
  tagName,
  onClose,
  onRemoveOnlyFromTask,
  onRemoveFromGroup,
}: TaskTagRemovalModalProps) {
  const resolvedTagName = tagName ?? '';

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">{es.tasks.removeTagTitle}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">{es.tasks.removeTagPrompt(resolvedTagName)}</p>
      </Modal.Body>
      <Modal.Footer className="d-flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {es.common.cancel}
        </Button>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => {
            onRemoveOnlyFromTask();
            onClose();
          }}
        >
          {es.tasks.removeOnlyFromTask}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            onRemoveFromGroup();
            onClose();
          }}
        >
          {es.tasks.removeFromGroup}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
