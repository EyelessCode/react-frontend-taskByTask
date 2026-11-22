import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../hooks';
import { loginFormSchema, type LoginFormValues } from '../schemas';
import { es } from '../../../shared/i18n';

export interface LoginPageProps {
  onSuccess?: () => void;
  onNavigateToRegister?: () => void;
  onNavigateToRecover?: () => void;
}

export function LoginPage({
  onSuccess,
  onNavigateToRegister,
  onNavigateToRecover,
}: LoginPageProps) {
  const {
    login,
    isSubmitting,
    authError,
    fieldErrors,
    loginNotice,
    clearAuthError,
    clearLoginNotice,
  } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { setError } = form;

  useEffect(() => {
    const fields: Array<keyof LoginFormValues> = ['email', 'password'];
    for (const field of fields) {
      const message = fieldErrors[field];
      if (message) {
        setError(field, { type: 'server', message });
      }
    }
  }, [fieldErrors, setError]);

  const handleSubmit = form.handleSubmit(async (values) => {
    clearAuthError();
    clearLoginNotice();
    const ok = await login(values);
    if (ok) {
      form.setValue('password', '');
      onSuccess?.();
    }
  });

  return (
    <AuthLayout title={es.auth.loginTitle} subtitle={es.auth.loginSubtitle}>
      {loginNotice && (
        <Alert variant="info" role="status" className="small">
          {loginNotice}
        </Alert>
      )}
      {authError && (
        <Alert variant="danger" role="alert" className="small">
          {authError}
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label htmlFor="login-email-input">{es.auth.emailLabel}</Form.Label>
          <Form.Control
            id="login-email-input"
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
          <Form.Label htmlFor="login-password-input">{es.auth.passwordLabel}</Form.Label>
          <Form.Control
            id="login-password-input"
            type="password"
            autoComplete="current-password"
            placeholder={es.auth.passwordPlaceholder}
            {...form.register('password')}
            isInvalid={Boolean(form.formState.errors.password)}
            aria-invalid={Boolean(form.formState.errors.password)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.password?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="d-grid mb-3">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {es.auth.loginButton}
          </Button>
        </div>

        <div className="d-flex flex-column gap-1 text-center small">
          <Button
            variant="link"
            size="sm"
            type="button"
            className="text-decoration-none p-0"
            onClick={() => {
              clearAuthError();
              onNavigateToRecover?.();
            }}
          >
            {es.auth.goToRecover}
          </Button>
          <Button
            variant="link"
            size="sm"
            type="button"
            className="text-decoration-none p-0"
            onClick={() => {
              clearAuthError();
              onNavigateToRegister?.();
            }}
          >
            {es.auth.goToRegister}
          </Button>
        </div>
      </Form>
    </AuthLayout>
  );
}
