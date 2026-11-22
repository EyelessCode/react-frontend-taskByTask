import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../hooks';
import { recoverFormSchema, type RecoverFormValues } from '../schemas';
import { es } from '../../../shared/i18n';

export interface RecoverPasswordPageProps {
  onSuccess?: () => void;
  onNavigateToLogin?: () => void;
}

export function RecoverPasswordPage({
  onSuccess,
  onNavigateToLogin,
}: RecoverPasswordPageProps) {
  const { recoverPassword, isSubmitting, authError, fieldErrors, clearAuthError } = useAuth();

  const form = useForm<RecoverFormValues>({
    resolver: zodResolver(recoverFormSchema),
    defaultValues: {
      email: '',
      recoveryCode: '',
      newPassword: '',
    },
  });

  const { setError } = form;

  useEffect(() => {
    const fields: Array<keyof RecoverFormValues> = ['email', 'recoveryCode', 'newPassword'];
    for (const field of fields) {
      const message = fieldErrors[field];
      if (message) {
        setError(field, { type: 'server', message });
      }
    }
  }, [fieldErrors, setError]);

  const handleSubmit = form.handleSubmit(async (values) => {
    clearAuthError();
    const ok = await recoverPassword(values);
    if (ok) {
      form.reset({ email: '', recoveryCode: '', newPassword: '' });
      onSuccess?.();
    }
  });

  return (
    <AuthLayout title={es.auth.recoverTitle} subtitle={es.auth.recoverSubtitle}>
      <Alert variant="info" className="small">
        {es.auth.recoverLimitationNote}
      </Alert>

      {authError && (
        <Alert variant="danger" role="alert" className="small">
          {authError}
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label htmlFor="recover-email-input">{es.auth.emailLabel}</Form.Label>
          <Form.Control
            id="recover-email-input"
            type="email"
            autoComplete="email"
            placeholder={es.auth.emailPlaceholder}
            {...form.register('email')}
            isInvalid={Boolean(form.formState.errors.email)}
            aria-invalid={Boolean(form.formState.errors.email)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.email?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="recover-code-input">{es.auth.recoveryCodeLabel}</Form.Label>
          <Form.Control
            id="recover-code-input"
            type="text"
            autoComplete="one-time-code"
            placeholder={es.auth.recoveryCodePlaceholder}
            {...form.register('recoveryCode')}
            isInvalid={Boolean(form.formState.errors.recoveryCode)}
            aria-invalid={Boolean(form.formState.errors.recoveryCode)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.recoveryCode?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="recover-newpassword-input">{es.auth.newPasswordLabel}</Form.Label>
          <Form.Control
            id="recover-newpassword-input"
            type="password"
            autoComplete="new-password"
            placeholder={es.auth.passwordPlaceholder}
            {...form.register('newPassword')}
            isInvalid={Boolean(form.formState.errors.newPassword)}
            aria-invalid={Boolean(form.formState.errors.newPassword)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.newPassword?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="d-grid mb-3">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {es.auth.recoverButton}
          </Button>
        </div>

        <div className="text-center small">
          <Button
            variant="link"
            size="sm"
            type="button"
            className="text-decoration-none p-0"
            onClick={() => {
              clearAuthError();
              onNavigateToLogin?.();
            }}
          >
            {es.auth.goToLogin}
          </Button>
        </div>
      </Form>
    </AuthLayout>
  );
}
