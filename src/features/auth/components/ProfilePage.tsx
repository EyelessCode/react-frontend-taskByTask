import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import { useAuth } from '../hooks';
import {
  changePasswordFormSchema,
  currentPasswordConfirmSchema,
  profileFormSchema,
  type ChangePasswordFormValues,
  type CurrentPasswordConfirmValues,
  type ProfileFormValues,
} from '../schemas';
import { OneTimeRecoveryCodesCard } from './OneTimeRecoveryCodesCard';
import { DeleteAccountConfirmModal } from './DeleteAccountConfirmModal';
import { es } from '../../../shared/i18n';

export interface ProfilePageProps {
  onBackToWorkspace?: () => void;
  onLoggedOut?: () => void;
  onAccountDeleted?: () => void;
}

export function ProfilePage({
  onBackToWorkspace,
  onLoggedOut,
  onAccountDeleted,
}: ProfilePageProps) {
  const {
    currentUser,
    isSubmitting,
    authError,
    oneTimeRecoveryCodes,
    updateProfile,
    changePassword,
    regenerateRecoveryCodes,
    deleteAccount,
    dismissOneTimeRecoveryCodes,
    logout,
    clearAuthError,
  } = useAuth();

  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: currentUser?.displayName ?? '',
      username: currentUser?.username ?? '',
      email: currentUser?.email ?? '',
      timeFormat: currentUser?.timeFormat ?? '24h',
    },
  });

  useEffect(() => {
    if (currentUser) {
      profileForm.reset({
        displayName: currentUser.displayName,
        username: currentUser.username,
        email: currentUser.email,
        timeFormat: currentUser.timeFormat,
      });
    }
  }, [currentUser, profileForm]);

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });

  const regenForm = useForm<CurrentPasswordConfirmValues>({
    resolver: zodResolver(currentPasswordConfirmSchema),
    defaultValues: {
      currentPassword: '',
    },
  });

  const handleProfileSubmit = profileForm.handleSubmit(async (values) => {
    clearAuthError();
    setProfileSuccess(false);
    const ok = await updateProfile(values);
    if (ok) {
      setProfileSuccess(true);
    }
  });

  const handlePasswordSubmit = passwordForm.handleSubmit(async (values) => {
    clearAuthError();
    setPasswordSuccess(false);
    const ok = await changePassword(values);
    if (ok) {
      passwordForm.reset({ currentPassword: '', newPassword: '' });
      setPasswordSuccess(true);
    }
  });

  const handleRegenerateSubmit = regenForm.handleSubmit(async (values) => {
    clearAuthError();
    const ok = await regenerateRecoveryCodes(values);
    if (ok) {
      regenForm.reset({ currentPassword: '' });
    }
  });

  const handleConfirmDelete = async (values: CurrentPasswordConfirmValues): Promise<boolean> => {
    clearAuthError();
    const ok = await deleteAccount(values);
    if (ok) {
      setShowDeleteModal(false);
      onAccountDeleted?.();
    }
    return ok;
  };

  return (
    <Container className="py-4" style={{ maxWidth: '720px' }}>
      <header className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h1 className="h3 fw-bold mb-0 text-primary">{es.auth.profileTitle}</h1>
        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            type="button"
            onClick={() => {
              dismissOneTimeRecoveryCodes();
              clearAuthError();
              onBackToWorkspace?.();
            }}
          >
            {es.auth.backToWorkspace}
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            type="button"
            onClick={async () => {
              await logout();
              onLoggedOut?.();
            }}
          >
            {es.auth.logoutButton}
          </Button>
        </div>
      </header>

      <main className="d-flex flex-column gap-4">
        {authError && !showDeleteModal && (
          <Alert variant="danger" role="alert" className="mb-0 small">
            {authError}
          </Alert>
        )}

        {/* Profile & Preferences */}
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h2 className="h5 fw-semibold mb-3">{es.auth.profileSectionTitle}</h2>
            {profileSuccess && (
              <Alert variant="success" role="status" className="small">
                {es.auth.profileSaved}
              </Alert>
            )}

            <Form onSubmit={handleProfileSubmit} noValidate>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-displayname-input">
                  {es.auth.displayNameLabel}
                </Form.Label>
                <Form.Control
                  id="profile-displayname-input"
                  type="text"
                  {...profileForm.register('displayName')}
                  isInvalid={Boolean(profileForm.formState.errors.displayName)}
                  aria-invalid={Boolean(profileForm.formState.errors.displayName)}
                />
                <Form.Control.Feedback type="invalid">
                  {profileForm.formState.errors.displayName?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-username-input">
                  {es.auth.usernameLabel}
                </Form.Label>
                <Form.Control
                  id="profile-username-input"
                  type="text"
                  {...profileForm.register('username')}
                  isInvalid={Boolean(profileForm.formState.errors.username)}
                  aria-invalid={Boolean(profileForm.formState.errors.username)}
                />
                <Form.Control.Feedback type="invalid">
                  {profileForm.formState.errors.username?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-email-input">{es.auth.emailLabel}</Form.Label>
                <Form.Control
                  id="profile-email-input"
                  type="email"
                  {...profileForm.register('email')}
                  isInvalid={Boolean(profileForm.formState.errors.email)}
                  aria-invalid={Boolean(profileForm.formState.errors.email)}
                />
                <Form.Control.Feedback type="invalid">
                  {profileForm.formState.errors.email?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-timeformat-select">
                  {es.auth.timeFormatLabel}
                </Form.Label>
                <Form.Select
                  id="profile-timeformat-select"
                  {...profileForm.register('timeFormat')}
                >
                  <option value="24h">{es.auth.timeFormat24h}</option>
                  <option value="12h">{es.auth.timeFormat12h}</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-timezone-input">
                  {es.auth.timeZoneLabel}
                </Form.Label>
                <Form.Control
                  id="profile-timezone-input"
                  type="text"
                  readOnly
                  value={currentUser?.timeZone ?? 'UTC'}
                />
                <Form.Text className="text-muted">{es.auth.timeZoneHint}</Form.Text>
              </Form.Group>

              <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                {es.auth.saveProfileButton}
              </Button>
            </Form>
          </Card.Body>
        </Card>

        {/* Change Password */}
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h2 className="h5 fw-semibold mb-3">{es.auth.passwordSectionTitle}</h2>
            {passwordSuccess && (
              <Alert variant="success" role="status" className="small">
                {es.auth.passwordChanged}
              </Alert>
            )}

            <Form onSubmit={handlePasswordSubmit} noValidate>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-current-password-input">
                  {es.auth.currentPasswordLabel}
                </Form.Label>
                <Form.Control
                  id="profile-current-password-input"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                  isInvalid={Boolean(passwordForm.formState.errors.currentPassword)}
                  aria-invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                />
                <Form.Control.Feedback type="invalid">
                  {passwordForm.formState.errors.currentPassword?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-new-password-input">
                  {es.auth.newPasswordLabel}
                </Form.Label>
                <Form.Control
                  id="profile-new-password-input"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                  isInvalid={Boolean(passwordForm.formState.errors.newPassword)}
                  aria-invalid={Boolean(passwordForm.formState.errors.newPassword)}
                />
                <Form.Control.Feedback type="invalid">
                  {passwordForm.formState.errors.newPassword?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                {es.auth.changePasswordButton}
              </Button>
            </Form>
          </Card.Body>
        </Card>

        {/* Regenerate Recovery Codes */}
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h2 className="h5 fw-semibold mb-2">{es.auth.regenerateSectionTitle}</h2>
            <p className="text-muted small mb-3">{es.auth.regenerateDescription}</p>

            <Form onSubmit={handleRegenerateSubmit} noValidate className="mb-3">
              <Form.Group className="mb-3">
                <Form.Label htmlFor="profile-regen-password-input">
                  {es.auth.currentPasswordLabel}
                </Form.Label>
                <Form.Control
                  id="profile-regen-password-input"
                  type="password"
                  autoComplete="current-password"
                  {...regenForm.register('currentPassword')}
                  isInvalid={Boolean(regenForm.formState.errors.currentPassword)}
                  aria-invalid={Boolean(regenForm.formState.errors.currentPassword)}
                />
                <Form.Control.Feedback type="invalid">
                  {regenForm.formState.errors.currentPassword?.message}
                </Form.Control.Feedback>
              </Form.Group>

              <Button variant="outline-primary" size="sm" type="submit" disabled={isSubmitting}>
                {es.auth.regenerateButton}
              </Button>
            </Form>

            {oneTimeRecoveryCodes && (
              <OneTimeRecoveryCodesCard
                codes={oneTimeRecoveryCodes}
                title={es.auth.regeneratedCodesTitle}
                continueLabel={es.common.close}
                onContinue={dismissOneTimeRecoveryCodes}
              />
            )}
          </Card.Body>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-sm border-danger">
          <Card.Body className="p-4">
            <h2 className="h5 fw-semibold text-danger mb-2">{es.auth.dangerZoneTitle}</h2>
            <p className="text-muted small mb-3">{es.auth.deleteAccountWarning}</p>
            <Button
              variant="outline-danger"
              size="sm"
              type="button"
              onClick={() => {
                clearAuthError();
                setShowDeleteModal(true);
              }}
            >
              {es.auth.deleteAccountButton}
            </Button>
          </Card.Body>
        </Card>
      </main>

      <DeleteAccountConfirmModal
        show={showDeleteModal}
        isSubmitting={isSubmitting}
        serverError={showDeleteModal ? authError : null}
        onClose={() => {
          clearAuthError();
          setShowDeleteModal(false);
        }}
        onConfirm={handleConfirmDelete}
      />
    </Container>
  );
}
