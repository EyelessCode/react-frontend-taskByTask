import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import { useGroupForm } from '../hooks/use-group-form';
import type { Group } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface GroupFormModalProps {
  show: boolean;
  group?: Group | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GroupFormModal({
  show,
  group,
  onClose,
  onSuccess,
}: GroupFormModalProps) {
  const { form, isEdit, onSubmit, apiError } = useGroupForm({
    group,
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Form onSubmit={onSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="fs-5">
            {isEdit ? es.groups.renameModalTitle : es.groups.createModalTitle}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {apiError && (
            <Alert variant="danger" role="alert" className="py-2 small">
              {apiError}
            </Alert>
          )}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="group-name-input">
              {es.groups.nameLabel}
            </Form.Label>
            <Form.Control
              id="group-name-input"
              type="text"
              placeholder={es.groups.namePlaceholder}
              {...form.register('name')}
              isInvalid={Boolean(form.formState.errors.name)}
              autoFocus
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.name?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>
            {es.common.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {es.common.confirm}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
