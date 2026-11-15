import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import type { Group } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface GroupDeleteConfirmModalProps {
  show: boolean;
  group?: Group | null;
  onClose: () => void;
  onConfirm?: (group: Group) => void;
  isDeleting?: boolean;
}

export function GroupDeleteConfirmModal({
  show,
  group,
  onClose,
  onConfirm,
  isDeleting = false,
}: GroupDeleteConfirmModalProps) {
  const handleConfirm = () => {
    if (group) {
      onConfirm?.(group);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="fs-5 text-danger">
          {es.groups.deleteModalTitle}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {group && (
          <p className="mb-0 text-dark">
            {es.groups.deleteModalWarning(group.name)}
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
          {es.common.cancel}
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirm}
          disabled={isDeleting || !group}
        >
          {isDeleting ? es.common.loading : es.common.delete}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
