import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createAppRouter } from '@/app/router';
import { configureAuthStore, resetAuthStore, useAuthStore } from '@/features/auth/store';
import { configureGroupsStore, resetGroupsStore } from '@/features/groups/store';
import { configureTasksStore, resetTasksStore } from '@/features/tasks/store';
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
import { LocalStorageAdapter, STORAGE_KEYS } from '@/data/storage';
import { es } from '@/shared/i18n';

describe('Auth Routes & Navigation Guards (integration/features/auth/auth-routes)', () => {
  let adapter: LocalStorageAdapter;

  function setupStores() {
    adapter = new LocalStorageAdapter();
    const userRepository = new LocalStorageUserRepository(adapter);
    const sessionRepository = new LocalStorageSessionRepository(adapter);
    const recoveryCodeRepository = new LocalStorageRecoveryCodeRepository(adapter);
    const loginLockoutRepository = new LocalStorageLoginLockoutRepository(adapter);
    const notificationRepository = new LocalStorageNotificationRepository(adapter);
    const groupRepository = new LocalStorageGroupRepository(adapter);
    const taskRepository = new LocalStorageTaskRepository(adapter);
    const tagRepository = new LocalStorageTagRepository(adapter);

    resetAuthStore();
    configureAuthStore({
      userRepository,
      sessionRepository,
      recoveryCodeRepository,
      loginLockoutRepository,
      notificationRepository,
      groupRepository,
      taskRepository,
      tagRepository,
      getTimeZone: () => 'America/Bogota',
    });

    resetGroupsStore();
    configureGroupsStore({
      groupRepository,
      taskRepository,
      tagRepository,
      getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
    });

    resetTasksStore();
    configureTasksStore({
      groupRepository,
      taskRepository,
      tagRepository,
      getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
    });
  }

  beforeEach(() => {
    localStorage.clear();
    setupStores();
  });

  function renderAt(initialPath: string) {
    const history = createMemoryHistory({ initialEntries: [initialPath] });
    const router = createAppRouter(history);
    const utils = render(<RouterProvider router={router} />);
    return { router, history, ...utils };
  }

  it('redirects unauthenticated /, /profile, and unknown routes to /login', async () => {
    const { router } = renderAt('/');
    expect(await screen.findByRole('heading', { name: es.auth.loginTitle })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    await router.navigate({ to: '/profile' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    await router.navigate({ to: '/ruta-inexistente' as '/' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  it('renders /register and /recover for unauthenticated users', async () => {
    const { router } = renderAt('/register');
    expect(await screen.findByRole('heading', { name: es.auth.registerTitle })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');

    await router.navigate({ to: '/recover' });
    expect(await screen.findByRole('heading', { name: es.auth.recoverTitle })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/recover');
  });

  it('keeps /register active for one-time codes until acknowledged, then exits on reload or navigation', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderAt('/register');

    expect(await screen.findByRole('heading', { name: es.auth.registerTitle })).toBeInTheDocument();

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.usernameLabel), 'Ana123');
    await user.type(screen.getByLabelText(es.auth.displayNameLabel), 'Ana García');
    await user.type(screen.getByLabelText(es.auth.passwordLabel), 'Secret123');
    await user.click(screen.getByRole('button', { name: es.auth.registerButton }));

    expect(await screen.findByText(es.auth.recoveryCodesTitle)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/register');
    expect(useAuthStore.getState().postRegisterCodesPending).toBe(true);

    // Navigating to /profile exits one-time codes view and renders /profile
    await router.navigate({ to: '/profile' });
    expect(await screen.findByRole('heading', { name: es.auth.profileTitle })).toBeInTheDocument();
    expect(useAuthStore.getState().postRegisterCodesPending).toBe(false);

    // Simulate reload on /register while authenticated -> redirects to /
    unmount();
    setupStores();
    const reloaded = renderAt('/register');
    expect(await screen.findByText(`${es.auth.greetingPrefix} Ana García`)).toBeInTheDocument();
    expect(reloaded.router.state.location.pathname).toBe('/');
  });

  it('redirects authenticated /login, /recover, and unknown routes to /', async () => {
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    useAuthStore.getState().acknowledgeRegistrationCodes();

    const { router } = renderAt('/login');
    expect(await screen.findByText(`${es.auth.greetingPrefix} Ana García`)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    await router.navigate({ to: '/recover' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });

    await router.navigate({ to: '/desconocida' as '/' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('redirects to /login with sessionExpired notice when session expires mid-app', async () => {
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    useAuthStore.getState().acknowledgeRegistrationCodes();

    const { router } = renderAt('/');
    expect(await screen.findByText(`${es.auth.greetingPrefix} Ana García`)).toBeInTheDocument();

    // Expire session in storage
    const rawSession = localStorage.getItem(STORAGE_KEYS.SESSION);
    expect(rawSession).not.toBeNull();
    const session = JSON.parse(rawSession!) as {
      userId: string;
      token: string;
      createdAt: string;
      expiresAt: string;
    };
    localStorage.setItem(
      STORAGE_KEYS.SESSION,
      JSON.stringify({
        ...session,
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
    );

    const userId = await useAuthStore.getState().ensureActiveUserId();
    expect(userId).toBeNull();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(await screen.findByText(es.auth.sessionExpired)).toBeInTheDocument();
  });

  it('isolates workspaces across users and navigates to /login on logout and account deletion', async () => {
    const user = userEvent.setup();
    await useAuthStore.getState().register({
      email: 'usera@example.com',
      username: 'UserA1',
      displayName: 'Usuario A',
      password: 'Password1',
    });
    useAuthStore.getState().acknowledgeRegistrationCodes();

    const { router } = renderAt('/');
    expect(await screen.findByText(`${es.auth.greetingPrefix} Usuario A`)).toBeInTheDocument();

    // Create a group for User A
    await user.click(screen.getByRole('button', { name: new RegExp(es.groups.createGroupButton) }));
    await user.type(screen.getByLabelText(es.groups.nameLabel), 'Proyecto A');
    await user.click(screen.getByRole('button', { name: es.common.confirm }));
    expect((await screen.findAllByText('Proyecto A')).length).toBeGreaterThan(0);

    // Logout -> redirects to /login without sessionExpired notice
    await user.click(screen.getByRole('button', { name: es.auth.logoutButton }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(screen.queryByText(es.auth.sessionExpired)).not.toBeInTheDocument();

    // Register User B -> User B does not see Proyecto A
    await user.click(screen.getByRole('button', { name: es.auth.goToRegister }));
    await user.type(screen.getByLabelText(es.auth.emailLabel), 'userb@example.com');
    await user.type(screen.getByLabelText(es.auth.usernameLabel), 'UserB1');
    await user.type(screen.getByLabelText(es.auth.displayNameLabel), 'Usuario B');
    await user.type(screen.getByLabelText(es.auth.passwordLabel), 'Password1');
    await user.click(screen.getByRole('button', { name: es.auth.registerButton }));
    expect(await screen.findByText(es.auth.recoveryCodesTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: es.auth.continueToApp }));
    expect(await screen.findByText(`${es.auth.greetingPrefix} Usuario B`)).toBeInTheDocument();
    expect(screen.queryByText('Proyecto A')).not.toBeInTheDocument();

    // Navigate to /profile and delete User B's account
    await user.click(screen.getByRole('button', { name: es.auth.profileLink }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/profile');
    });
    await user.click(screen.getByRole('button', { name: es.auth.deleteAccountButton }));
    const modalInput = screen.getByLabelText(es.auth.currentPasswordLabel, {
      selector: '#delete-account-current-password',
    });
    await user.type(modalInput, 'Password1');
    await user.click(screen.getByRole('button', { name: es.auth.deleteAccountConfirmButton }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(await screen.findByText(es.auth.accountDeleted)).toBeInTheDocument();
    expect(screen.queryByText(es.auth.sessionExpired)).not.toBeInTheDocument();
  });
});
