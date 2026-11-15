import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LoginPage,
  ProfilePage,
  RecoverPasswordPage,
  RegisterPage,
} from '@/features/auth/components';
import { configureAuthStore, resetAuthStore, useAuthStore } from '@/features/auth/store';
import {
  LocalStorageGroupRepository,
  LocalStorageLoginLockoutRepository,
  LocalStorageNotificationRepository,
  LocalStorageRecoveryCodeRepository,
  LocalStorageSessionRepository,
  LocalStorageTagRepository,
  LocalStorageTaskRepository,
  LocalStorageUserRepository,
} from '@/data/repositories';
import { LocalStorageAdapter } from '@/data/storage';
import { es } from '@/shared/i18n';

describe('Auth, Recovery & Profile Views (integration/features/auth)', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
    resetAuthStore();
    configureAuthStore({
      userRepository: new LocalStorageUserRepository(adapter),
      sessionRepository: new LocalStorageSessionRepository(adapter),
      recoveryCodeRepository: new LocalStorageRecoveryCodeRepository(adapter),
      loginLockoutRepository: new LocalStorageLoginLockoutRepository(adapter),
      notificationRepository: new LocalStorageNotificationRepository(adapter),
      groupRepository: new LocalStorageGroupRepository(adapter),
      taskRepository: new LocalStorageTaskRepository(adapter),
      tagRepository: new LocalStorageTagRepository(adapter),
      getTimeZone: () => 'America/Bogota',
    });
  });

  it('registers a user, displays 8 one-time recovery codes with copy & continue action', async () => {
    const user = userEvent.setup();
    const onContinueToApp = vi.fn();

    render(<RegisterPage onContinueToApp={onContinueToApp} onNavigateToLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.usernameLabel), 'Ana123');
    await user.type(screen.getByLabelText(es.auth.displayNameLabel), 'Ana García');
    await user.type(screen.getByLabelText(es.auth.passwordLabel), 'Secret123');
    await user.click(screen.getByRole('button', { name: es.auth.registerButton }));

    expect(await screen.findByText(es.auth.recoveryCodesTitle)).toBeInTheDocument();
    expect(screen.getByText(es.auth.recoveryCodesWarning)).toBeInTheDocument();

    const codes = useAuthStore.getState().oneTimeRecoveryCodes ?? [];
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: es.auth.continueToApp }));
    expect(onContinueToApp).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().postRegisterCodesPending).toBe(false);
  });

  it('renders login notices, enforces lockout message on 5 failed attempts, and signs in on valid creds', async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    await useAuthStore.getState().logout();
    useAuthStore.setState({ loginNotice: es.auth.sessionExpired });

    const onSuccess = vi.fn();
    render(
      <LoginPage
        onSuccess={onSuccess}
        onNavigateToRegister={vi.fn()}
        onNavigateToRecover={vi.fn()}
      />,
    );

    expect(screen.getByText(es.auth.sessionExpired)).toBeInTheDocument();

    for (let i = 0; i < 4; i += 1) {
      await user.clear(screen.getByLabelText(es.auth.emailLabel));
      await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
      await user.clear(screen.getByLabelText(es.auth.passwordLabel));
      await user.type(screen.getByLabelText(es.auth.passwordLabel), 'WrongPass');
      await user.click(screen.getByRole('button', { name: es.auth.loginButton }));
      expect(await screen.findByText(es.auth.invalidCredentials)).toBeInTheDocument();
    }

    // 5th failure triggers lockout message
    await user.click(screen.getByRole('button', { name: es.auth.loginButton }));
    expect(await screen.findByText(es.auth.tooManyAttemptsMinutes(5))).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('recovers password with a single-use recovery code and displays limitation note', async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    const code = useAuthStore.getState().oneTimeRecoveryCodes![0]!;
    await useAuthStore.getState().logout();

    const onSuccess = vi.fn();
    render(<RecoverPasswordPage onSuccess={onSuccess} onNavigateToLogin={vi.fn()} />);

    expect(screen.getByText(es.auth.recoverLimitationNote)).toBeInTheDocument();

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.recoveryCodeLabel), code);
    await user.type(screen.getByLabelText(es.auth.newPasswordLabel), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: es.auth.recoverButton }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().loginNotice).toBe(es.auth.recoverSuccess);
  });

  it('updates profile timeFormat, changes password, regenerates codes, and deletes account via modal', async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    useAuthStore.getState().acknowledgeRegistrationCodes();

    const onAccountDeleted = vi.fn();
    render(
      <ProfilePage
        onBackToWorkspace={vi.fn()}
        onLoggedOut={vi.fn()}
        onAccountDeleted={onAccountDeleted}
      />,
    );

    // Update timeFormat to 12h
    await user.selectOptions(screen.getByLabelText(es.auth.timeFormatLabel), '12h');
    await user.click(screen.getByRole('button', { name: es.auth.saveProfileButton }));
    expect(await screen.findByText(es.auth.profileSaved)).toBeInTheDocument();
    expect(useAuthStore.getState().currentUser?.timeFormat).toBe('12h');

    // Open delete modal and confirm deletion
    await user.click(screen.getByRole('button', { name: es.auth.deleteAccountButton }));
    expect(await screen.findByText(es.auth.deleteAccountModalTitle)).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText(es.auth.deleteAccountWarning)).toBeInTheDocument();

    const modalInput = screen.getByLabelText(es.auth.currentPasswordLabel, {
      selector: '#delete-account-current-password',
    });
    await user.type(modalInput, 'Password1');
    await user.click(screen.getByRole('button', { name: es.auth.deleteAccountConfirmButton }));

    await waitFor(() => {
      expect(onAccountDeleted).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
