import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { AuthLayout } from './AuthLayout';
import { OneTimeRecoveryCodesCard } from './OneTimeRecoveryCodesCard';
import { useAuth } from '../hooks';
import { registerFormSchema, type RegisterFormValues } from '../schemas';
import { es } from '../../../shared/i18n';

export interface RegisterPageProps {
  onContinueToApp?: () => void;
  onNavigateToLogin?: () => void;
}

export function RegisterPage({ onContinueToApp, onNavigateToLogin }: RegisterPageProps) {
  const {
    register: registerAccount,
    isSubmitting,
    authError,
    oneTimeRecoveryCodes,
    postRegisterCodesPending,
    acknowledgeRegistrationCodes,
    clearAuthError,
  } = useAuth();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      username: '',
      displayName: '',
      password: '',
    },
  });

  if (postRegisterCodesPending && oneTimeRecoveryCodes) {
    return (
      <AuthLayout title={es.auth.recoveryCodesTitle}>
        <OneTimeRecoveryCodesCard
          codes={oneTimeRecoveryCodes}
          onContinue={() => {
            acknowledgeRegistrationCodes();
            onContinueToApp?.();
          }}
        />
      </AuthLayout>
    );
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    clearAuthError();
    const ok = await registerAccount(values);
    if (ok) {
      form.setValue('password', '');
    }
  });

  return (
    <AuthLayout title={es.auth.registerTitle} subtitle={es.auth.registerSubtitle}>
      {authError && (
        <Alert variant="danger" role="alert" className="small">
          {authError}
        </Alert>
      )}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label htmlFor="register-email-input">{es.auth.emailLabel}</Form.Label>
          <Form.Control
            id="register-email-input"
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
          <Form.Label htmlFor="register-username-input">{es.auth.usernameLabel}</Form.Label>
          <Form.Control
            id="register-username-input"
            type="text"
            autoComplete="username"
            placeholder={es.auth.usernamePlaceholder}
            {...form.register('username')}
            isInvalid={Boolean(form.formState.errors.username)}
            aria-invalid={Boolean(form.formState.errors.username)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.username?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="register-displayname-input">{es.auth.displayNameLabel}</Form.Label>
          <Form.Control
            id="register-displayname-input"
            type="text"
            autoComplete="name"
            placeholder={es.auth.displayNamePlaceholder}
            {...form.register('displayName')}
            isInvalid={Boolean(form.formState.errors.displayName)}
            aria-invalid={Boolean(form.formState.errors.displayName)}
          />
          <Form.Control.Feedback type="invalid">
            {form.formState.errors.displayName?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="register-password-input">{es.auth.passwordLabel}</Form.Label>
          <Form.Control
            id="register-password-input"
            type="password"
            autoComplete="new-password"
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
            {es.auth.registerButton}
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
