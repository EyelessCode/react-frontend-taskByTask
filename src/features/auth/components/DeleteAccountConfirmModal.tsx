import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import {
  currentPasswordConfirmSchema,
  type CurrentPasswordConfirmValues,
} from '../schemas';
import { es } from '../../../shared/i18n';

export interface DeleteAccountConfirmModalProps {
  show: boolean;
  isSubmitting?: boolean;
  serverError?: string | null;
  onClose: () => void;
  onConfirm: (values: CurrentPasswordConfirmValues) => Promise<boolean>;
}

/**
 * Destructive account deletion confirmation modal requiring current password (RF-05, UI-06).
 */
export function DeleteAccountConfirmModal({
  show,
  isSubmitting = false,
  serverError = null,
  onClose,
  onConfirm,
}: DeleteAccountConfirmModalProps) {
  const form = useForm<CurrentPasswordConfirmValues>({
    resolver: zodResolver(currentPasswordConfirmSchema),
    defaultValues: {
      currentPassword: '',
    },
  });

  useEffect(() => {
    if (!show) {
      form.reset({ currentPassword: '' });
    }
  }, [show, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const ok = await onConfirm(values);
    if (ok) {
      form.reset({ currentPassword: '' });
    }
  });

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5 text-danger">
            {es.auth.deleteAccountModalTitle}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Alert variant="danger" className="small">
            {es.auth.deleteAccountWarning}
          </Alert>

          {serverError && (
            <Alert variant="danger" role="alert" className="small">
              {serverError}
            </Alert>
          )}

          <Form.Group>
            <Form.Label htmlFor="delete-account-current-password">
              {es.auth.currentPasswordLabel}
            </Form.Label>
            <Form.Control
              id="delete-account-current-password"
              type="password"
              autoComplete="current-password"
              placeholder={es.auth.passwordPlaceholder}
              {...form.register('currentPassword')}
              isInvalid={Boolean(form.formState.errors.currentPassword)}
              aria-invalid={Boolean(form.formState.errors.currentPassword)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.currentPassword?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            {es.common.cancel}
          </Button>
          <Button variant="danger" size="sm" type="submit" disabled={isSubmitting}>
            {es.auth.deleteAccountConfirmButton}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
