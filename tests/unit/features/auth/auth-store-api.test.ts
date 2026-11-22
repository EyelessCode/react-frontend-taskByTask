import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthApiClient } from '@/data/contracts';
import {
  configureAuthStore,
  subscribeAuthSessionEnd,
  useAuthStore,
  type AuthSessionEndReason,
} from '@/features/auth/store';
import {
  ApiProblemError,
  RateLimitError,
  UnauthorizedError,
} from '@/shared/errors';
import { es } from '@/shared/i18n';
import type { User } from '@/shared/schemas';

const baseUser: User = {
  id: '1',
  email: 'ana@example.com',
  username: 'Ana123',
  displayName: 'Ana García',
  timeZone: 'America/Lima',
  timeFormat: '24h',
  remainingRecoveryCodes: 8,
  createdAt: '2026-11-20T10:00:00Z',
};

function createMockAuthApi(): AuthApiClient {
  return {
    getMe: vi.fn<AuthApiClient['getMe']>(),
    register: vi.fn<AuthApiClient['register']>(),
    login: vi.fn<AuthApiClient['login']>(),
    logout: vi.fn<AuthApiClient['logout']>(),
    recoverPassword: vi.fn<AuthApiClient['recoverPassword']>(),
    updateProfile: vi.fn<AuthApiClient['updateProfile']>(),
    changePassword: vi.fn<AuthApiClient['changePassword']>(),
    regenerateRecoveryCodes: vi.fn<AuthApiClient['regenerateRecoveryCodes']>(),
    deleteAccount: vi.fn<AuthApiClient['deleteAccount']>(),
    invalidateCsrf: vi.fn<AuthApiClient['invalidateCsrf']>(),
  };
}

describe('useAuthStore in API mode (REQ-BI-06..14, REQ-BI-22)', () => {
  let mockAuthApi: AuthApiClient;
  let getPushEndpoint: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
  let unsubscribeLocalPush: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    mockAuthApi = createMockAuthApi();
    getPushEndpoint = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
    unsubscribeLocalPush = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    configureAuthStore({
      mode: 'api',
      authApi: mockAuthApi,
      getTimeZone: () => 'America/Lima',
      getPushEndpoint,
      unsubscribeLocalPush,
    });

    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      isInitialized: false,
      isSubmitting: false,
      authError: null,
      fieldErrors: {},
      loginNotice: null,
      oneTimeRecoveryCodes: null,
      oneTimeRecoveryCodesNotice: null,
      postRegisterCodesPending: false,
    });
  });

  afterEach(() => {
    configureAuthStore({
      mode: undefined,
      authApi: undefined,
      getPushEndpoint: undefined,
      unsubscribeLocalPush: undefined,
    });
  });

  it('handles cold-start 401 silently without sessionExpired, and hydrates authenticated user on 200 without redundant round-trips', async () => {
    vi.mocked(mockAuthApi.getMe).mockRejectedValueOnce(new UnauthorizedError('No autenticado'));

    const cold = await useAuthStore.getState().validateSession();
    expect(cold).toEqual({ authenticated: false, userId: null, reason: 'none' });
    expect(useAuthStore.getState().isInitialized).toBe(true);
    expect(useAuthStore.getState().loginNotice).toBeNull();
    expect(mockAuthApi.getMe).toHaveBeenCalledWith('session-probe');

    vi.mocked(mockAuthApi.getMe).mockResolvedValueOnce(baseUser);
    const warm = await useAuthStore.getState().validateSession();
    expect(warm).toEqual({ authenticated: true, userId: '1' });
    expect(useAuthStore.getState().currentUser).toEqual(baseUser);

    // Subsequent transition avoids redundant /users/me call when already hydrated
    const cached = await useAuthStore.getState().validateSession();
    expect(cached).toEqual({ authenticated: true, userId: '1' });
    expect(mockAuthApi.getMe).toHaveBeenCalledTimes(2);
  });

  it('handles mid-session 401 expiry via local push unsubscribe, state cleanup, CSRF invalidation, and sessionExpired notice', async () => {
    useAuthStore.setState({
      currentUser: baseUser,
      isAuthenticated: true,
      isInitialized: true,
    });

    const reasons: AuthSessionEndReason[] = [];
    const unsubscribeListener = subscribeAuthSessionEnd((reason) => reasons.push(reason));

    await useAuthStore.getState().handleMidSessionUnauthorized();
    unsubscribeListener();

    expect(unsubscribeLocalPush).toHaveBeenCalledTimes(1);
    expect(mockAuthApi.invalidateCsrf).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().loginNotice).toBe(es.auth.sessionExpired);
    expect(reasons).toEqual(['expired']);
  });

  it('registers user with browser timezone, hydrates one-time recovery codes + notice, and maps 400 invalidParams', async () => {
    vi.mocked(mockAuthApi.register).mockRejectedValueOnce(
      new ApiProblemError('Datos inválidos', {
        status: 400,
        detail: 'Corrige los errores.',
        invalidParams: [{ name: 'username', reason: 'Ya existe este usuario.' }],
      }),
    );

    const failed = await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password123',
    });
    expect(failed).toBe(false);
    expect(useAuthStore.getState().authError).toBe('Corrige los errores.');
    expect(useAuthStore.getState().fieldErrors).toEqual({
      username: 'Ya existe este usuario.',
    });

    vi.mocked(mockAuthApi.register).mockResolvedValueOnce({
      user: baseUser,
      recoveryCodes: ['A1B2-C3D4', 'E5F6-G7H8'],
      recoveryCodesNotice: 'Guarda estos 8 códigos.',
    });

    const ok = await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password123',
    });
    expect(ok).toBe(true);
    expect(mockAuthApi.register).toHaveBeenLastCalledWith({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password123',
      timezone: 'America/Lima',
    });
    expect(useAuthStore.getState().oneTimeRecoveryCodes).toEqual(['A1B2-C3D4', 'E5F6-G7H8']);
    expect(useAuthStore.getState().oneTimeRecoveryCodesNotice).toBe('Guarda estos 8 códigos.');
    expect(useAuthStore.getState().postRegisterCodesPending).toBe(true);
  });

  it('signs in with timezone sync and handles 401/429 without setting sessionExpired', async () => {
    vi.mocked(mockAuthApi.login).mockRejectedValueOnce(
      new UnauthorizedError(es.auth.invalidCredentials),
    );

    expect(
      await useAuthStore.getState().login({ email: 'ana@example.com', password: 'wrong' }),
    ).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.invalidCredentials);
    expect(useAuthStore.getState().loginNotice).toBeNull();

    vi.mocked(mockAuthApi.login).mockRejectedValueOnce(
      new RateLimitError(es.auth.tooManyAttemptsSeconds(40), 40),
    );
    expect(
      await useAuthStore.getState().login({ email: 'ana@example.com', password: 'wrong' }),
    ).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.tooManyAttemptsSeconds(40));

    vi.mocked(mockAuthApi.login).mockResolvedValueOnce(baseUser);
    expect(
      await useAuthStore.getState().login({ email: 'ana@example.com', password: 'Secret123' }),
    ).toBe(true);
    expect(mockAuthApi.login).toHaveBeenLastCalledWith({
      email: 'ana@example.com',
      password: 'Secret123',
      timezone: 'America/Lima',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('recovers password normalizing code to XXXX-XXXX and surfaces 429 neutral cooldown', async () => {
    vi.mocked(mockAuthApi.recoverPassword).mockRejectedValueOnce(
      new RateLimitError(es.errors.rateLimitedMinutes(2), 120),
    );

    expect(
      await useAuthStore.getState().recoverPassword({
        email: 'ana@example.com',
        recoveryCode: 'a1b2c3d4',
        newPassword: 'NewPassword1',
      }),
    ).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.errors.rateLimitedMinutes(2));

    vi.mocked(mockAuthApi.recoverPassword).mockResolvedValueOnce('Contraseña restablecida.');
    expect(
      await useAuthStore.getState().recoverPassword({
        email: 'ana@example.com',
        recoveryCode: 'a1b2c3d4',
        newPassword: 'NewPassword1',
      }),
    ).toBe(true);

    expect(mockAuthApi.recoverPassword).toHaveBeenLastCalledWith({
      email: 'ana@example.com',
      recoveryCode: 'A1B2-C3D4',
      newPassword: 'NewPassword1',
    });
    expect(useAuthStore.getState().loginNotice).toBe('Contraseña restablecida.');
  });

  it('updates profile, changes password, regenerates codes updating remainingRecoveryCodes, logs out with push endpoint, and deletes account with { password }', async () => {
    useAuthStore.setState({
      currentUser: baseUser,
      isAuthenticated: true,
      isInitialized: true,
    });

    vi.mocked(mockAuthApi.updateProfile).mockResolvedValueOnce({
      ...baseUser,
      displayName: 'Ana G.',
      timeFormat: '12h',
    });
    expect(
      await useAuthStore.getState().updateProfile({
        email: 'ana@example.com',
        username: 'Ana123',
        displayName: 'Ana G.',
        timeFormat: '12h',
      }),
    ).toBe(true);
    expect(mockAuthApi.updateProfile).toHaveBeenCalledWith({
      displayName: 'Ana G.',
      username: 'Ana123',
      email: 'ana@example.com',
      timeFormat: '12h',
    });
    expect(useAuthStore.getState().currentUser?.timeFormat).toBe('12h');

    vi.mocked(mockAuthApi.changePassword).mockResolvedValueOnce('Contraseña actualizada.');
    expect(
      await useAuthStore.getState().changePassword({
        currentPassword: 'Password123',
        newPassword: 'NewPassword1',
      }),
    ).toBe(true);

    vi.mocked(mockAuthApi.regenerateRecoveryCodes).mockResolvedValueOnce({
      recoveryCodes: Array.from({ length: 8 }, (_, idx) => `1111-222${idx}`),
      recoveryCodesNotice: 'Guarda tus nuevos códigos.',
    });
    useAuthStore.setState({
      currentUser: { ...baseUser, remainingRecoveryCodes: 2 },
    });
    expect(
      await useAuthStore.getState().regenerateRecoveryCodes({
        currentPassword: 'NewPassword1',
      }),
    ).toBe(true);
    expect(useAuthStore.getState().oneTimeRecoveryCodes).toHaveLength(8);
    expect(useAuthStore.getState().oneTimeRecoveryCodesNotice).toBe('Guarda tus nuevos códigos.');
    expect(useAuthStore.getState().currentUser?.remainingRecoveryCodes).toBe(8);

    // Logout with push endpoint + local unsubscribe, even if logout returns 401
    getPushEndpoint.mockResolvedValueOnce('https://push.example/sub-1');
    vi.mocked(mockAuthApi.logout).mockRejectedValueOnce(new UnauthorizedError('Expired'));
    const reasons: AuthSessionEndReason[] = [];
    const unsub = subscribeAuthSessionEnd((reason) => reasons.push(reason));

    await useAuthStore.getState().logout();
    expect(mockAuthApi.logout).toHaveBeenCalledWith('https://push.example/sub-1');
    expect(unsubscribeLocalPush).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().loginNotice).toBeNull();

    // Re-authenticate & delete account with { password }
    useAuthStore.setState({
      currentUser: baseUser,
      isAuthenticated: true,
      isInitialized: true,
    });
    vi.mocked(mockAuthApi.deleteAccount).mockResolvedValueOnce(undefined);
    expect(
      await useAuthStore.getState().deleteAccount({ currentPassword: 'NewPassword1' }),
    ).toBe(true);
    unsub();

    expect(mockAuthApi.deleteAccount).toHaveBeenCalledWith({ password: 'NewPassword1' });
    expect(unsubscribeLocalPush).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().loginNotice).toBe(es.auth.accountDeleted);
    expect(reasons).toEqual(['logout', 'deleted']);
  });
});
