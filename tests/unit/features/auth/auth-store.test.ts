import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureAuthStore,
  resetAuthStore,
  subscribeAuthSessionEnd,
  useAuthStore,
  type AuthSessionEndReason,
} from '@/features/auth/store';
import {
  LocalStorageGroupRepository,
  LocalStorageLoginLockoutRepository,
  LocalStorageNotificationRepository,
  LocalStorageNotificationStateRepository,
  LocalStorageRecoveryCodeRepository,
  LocalStorageSessionRepository,
  LocalStorageTagRepository,
  LocalStorageTaskRepository,
  LocalStorageUserRepository,
} from '@/data/repositories';
import { LocalStorageAdapter, STORAGE_KEYS } from '@/data/storage';
import { es } from '@/shared/i18n';
import { LIMITS } from '@/shared/schemas';

describe('useAuthStore', () => {
  let currentNowMs: number;
  let idCounter: number;
  let tokenCounter: number;
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    currentNowMs = Date.parse('2026-11-15T12:00:00.000Z');
    idCounter = 0;
    tokenCounter = 0;
    adapter = new LocalStorageAdapter();

    resetAuthStore();
    configureAuthStore({
      userRepository: new LocalStorageUserRepository(adapter),
      sessionRepository: new LocalStorageSessionRepository(adapter),
      recoveryCodeRepository: new LocalStorageRecoveryCodeRepository(adapter),
      loginLockoutRepository: new LocalStorageLoginLockoutRepository(adapter),
      notificationRepository: new LocalStorageNotificationRepository(adapter),
      notificationStateRepository: new LocalStorageNotificationStateRepository(adapter),
      groupRepository: new LocalStorageGroupRepository(adapter),
      taskRepository: new LocalStorageTaskRepository(adapter),
      tagRepository: new LocalStorageTagRepository(adapter),
      now: () => currentNowMs,
      createId: () => {
        idCounter += 1;
        return `id-${idCounter}`;
      },
      createToken: () => {
        tokenCounter += 1;
        return `token-${tokenCounter}`;
      },
      getTimeZone: () => 'America/Bogota',
    });
  });

  it('registers a new user with PBKDF2 hash, 7-day session, Personal group, and 8 one-time recovery codes', async () => {
    const ok = await useAuthStore.getState().register({
      email: 'Ana@Example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: '  Secret123  ',
    });

    expect(ok).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.currentUser?.email).toBe('ana@example.com');
    expect(state.currentUser?.timeFormat).toBe('24h');
    expect(state.currentUser?.timeZone).toBe('America/Bogota');
    expect(state.currentUser?.passwordHash.startsWith('pbkdf2_sha256$100000$')).toBe(true);
    expect(state.postRegisterCodesPending).toBe(true);
    expect(state.oneTimeRecoveryCodes).toHaveLength(LIMITS.RECOVERY_CODES_COUNT);

    // No plaintext password stored
    expect(localStorage.getItem(STORAGE_KEYS.USERS)).not.toContain('Secret123');

    // Personal group provisioned for user
    const groupRepo = new LocalStorageGroupRepository(adapter);
    const userGroups = await groupRepo.getAccessibleByUserId(state.currentUser!.id);
    expect(userGroups).toHaveLength(1);
    expect(userGroups[0]?.isPersonal).toBe(true);

    // Acknowledging wipes transient codes
    useAuthStore.getState().acknowledgeRegistrationCodes();
    expect(useAuthStore.getState().oneTimeRecoveryCodes).toBeNull();
    expect(useAuthStore.getState().postRegisterCodesPending).toBe(false);
  });

  it('logs in, refreshes timeZone, enforces 5-attempt/5-minute lockout, and clears lockout on success', async () => {
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    await useAuthStore.getState().logout();

    // Format error does NOT increment lockout
    const invalidFormat = await useAuthStore.getState().login({
      email: 'not-an-email',
      password: 'x',
    });
    expect(invalidFormat).toBe(false);
    const lockoutRepo = new LocalStorageLoginLockoutRepository(adapter);
    expect(await lockoutRepo.getByEmail('not-an-email')).toBeNull();

    // 4 failed attempts -> invalidCredentials
    for (let i = 1; i <= 4; i += 1) {
      const attempt = await useAuthStore.getState().login({
        email: 'ANA@example.com',
        password: 'wrong',
      });
      expect(attempt).toBe(false);
      expect(useAuthStore.getState().authError).toBe(es.auth.invalidCredentials);
    }

    // 5th failed attempt -> 5-minute lockout
    const fifth = await useAuthStore.getState().login({
      email: 'ana@example.com',
      password: 'wrong',
    });
    expect(fifth).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.tooManyAttemptsMinutes(5));

    // Even valid password fails during active lockout
    const duringCooldown = await useAuthStore.getState().login({
      email: 'ana@example.com',
      password: 'Password1',
    });
    expect(duringCooldown).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.tooManyAttemptsMinutes(5));

    // Advance past 5 minutes -> succeeds and refreshes timeZone + clears lockout
    currentNowMs += 5 * 60 * 1000 + 1000;
    configureAuthStore({ getTimeZone: () => 'Europe/Madrid' });
    const success = await useAuthStore.getState().login({
      email: 'ana@example.com',
      password: 'Password1',
    });
    expect(success).toBe(true);
    expect(useAuthStore.getState().currentUser?.timeZone).toBe('Europe/Madrid');
    expect(await lockoutRepo.getByEmail('ana@example.com')).toBeNull();
  });

  it('handles 7-day session expiry vs orphan session and emits subscribeAuthSessionEnd', async () => {
    const events: AuthSessionEndReason[] = [];
    const unsubscribe = subscribeAuthSessionEnd((reason) => events.push(reason));

    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });

    // Advance 7 days -> expired
    currentNowMs += LIMITS.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
    const expiredResult = await useAuthStore.getState().validateSession();
    expect(expiredResult).toEqual({ authenticated: false, userId: null, reason: 'expired' });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().loginNotice).toBe(es.auth.sessionExpired);
    expect(events).toEqual(['expired']);

    // Orphan session -> no sessionExpired notice
    const sessionRepo = new LocalStorageSessionRepository(adapter);
    await sessionRepo.save({
      userId: 'non-existent-user',
      token: 'tok-orphan',
      createdAt: new Date(currentNowMs).toISOString(),
      expiresAt: new Date(currentNowMs + 60_000).toISOString(),
    });
    const orphanResult = await useAuthStore.getState().validateSession();
    expect(orphanResult).toEqual({ authenticated: false, userId: null, reason: 'orphan' });
    expect(useAuthStore.getState().loginNotice).toBeNull();
    expect(events).toEqual(['expired', 'orphan']);

    unsubscribe();
  });

  it('recovers password with single-use code, clears lockout, and allows password reuse', async () => {
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    const code = useAuthStore.getState().oneTimeRecoveryCodes![0]!;
    await useAuthStore.getState().logout();

    // Lock out user first
    for (let i = 0; i < 5; i += 1) {
      await useAuthStore.getState().login({ email: 'ana@example.com', password: 'wrong' });
    }

    // Wrong code -> generic error
    const badRecover = await useAuthStore.getState().recoverPassword({
      email: 'ana@example.com',
      recoveryCode: 'ZZZZ9999',
      newPassword: 'Password1',
    });
    expect(badRecover).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.invalidRecoveryRequest);

    // Valid code (lowercase input normalized, reusing Password1 allowed)
    const ok = await useAuthStore.getState().recoverPassword({
      email: 'ana@example.com',
      recoveryCode: code.toLowerCase(),
      newPassword: 'Password1',
    });
    expect(ok).toBe(true);
    expect(useAuthStore.getState().loginNotice).toBe(es.auth.recoverSuccess);

    // Reusing same code fails
    const reuseCode = await useAuthStore.getState().recoverPassword({
      email: 'ana@example.com',
      recoveryCode: code,
      newPassword: 'Password2',
    });
    expect(reuseCode).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.invalidRecoveryRequest);

    // Can login immediately because lockout was cleared
    expect(
      await useAuthStore.getState().login({ email: 'ana@example.com', password: 'Password1' }),
    ).toBe(true);
  });

  it('updates profile, cleans old email lockout, changes password with token rotation, and regenerates codes', async () => {
    await useAuthStore.getState().register({
      email: 'ana@example.com',
      username: 'Ana123',
      displayName: 'Ana García',
      password: 'Password1',
    });
    useAuthStore.getState().acknowledgeRegistrationCodes();

    // Seed lockout on old email
    const lockoutRepo = new LocalStorageLoginLockoutRepository(adapter);
    await lockoutRepo.save({
      normalizedEmail: 'ana@example.com',
      failedAttempts: 2,
      lockedUntil: null,
    });

    const profileOk = await useAuthStore.getState().updateProfile({
      email: 'ana.new@example.com',
      username: 'AnaNew1',
      displayName: 'Ana G.',
      timeFormat: '12h',
    });
    expect(profileOk).toBe(true);
    expect(useAuthStore.getState().currentUser?.timeFormat).toBe('12h');
    expect(await lockoutRepo.getByEmail('ana@example.com')).toBeNull();

    // Wrong currentPassword -> invalidCurrentPassword & no login lockout increment
    const wrongPw = await useAuthStore.getState().changePassword({
      currentPassword: 'WrongPassword',
      newPassword: 'NewPassword1',
    });
    expect(wrongPw).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.invalidCurrentPassword);
    expect(await lockoutRepo.getByEmail('ana.new@example.com')).toBeNull();

    // Valid password change rotates session token preserving expiresAt
    const sessionRepo = new LocalStorageSessionRepository(adapter);
    const beforeSession = await sessionRepo.get();
    const changeOk = await useAuthStore.getState().changePassword({
      currentPassword: 'Password1',
      newPassword: 'NewPassword1',
    });
    expect(changeOk).toBe(true);
    const afterSession = await sessionRepo.get();
    expect(afterSession?.token).not.toBe(beforeSession?.token);
    expect(afterSession?.expiresAt).toBe(beforeSession?.expiresAt);

    // Regenerate recovery codes
    const regenOk = await useAuthStore.getState().regenerateRecoveryCodes({
      currentPassword: 'NewPassword1',
    });
    expect(regenOk).toBe(true);
    expect(useAuthStore.getState().oneTimeRecoveryCodes).toHaveLength(LIMITS.RECOVERY_CODES_COUNT);
  });

  it('cascades account deletion for active user while preserving other users data', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSessionEnd(listener);

    // Create user 1
    await useAuthStore.getState().register({
      email: 'user1@example.com',
      username: 'UserOne1',
      displayName: 'User One',
      password: 'Password1',
    });
    const user1Id = useAuthStore.getState().currentUser!.id;
    await useAuthStore.getState().logout();

    // Create user 2 and add a task/tag in their Personal group
    await useAuthStore.getState().register({
      email: 'user2@example.com',
      username: 'UserTwo2',
      displayName: 'User Two',
      password: 'Password2',
    });
    const user2Id = useAuthStore.getState().currentUser!.id;
    const groupRepo = new LocalStorageGroupRepository(adapter);
    const taskRepo = new LocalStorageTaskRepository(adapter);
    const tagRepo = new LocalStorageTagRepository(adapter);
    const u2Groups = await groupRepo.getAccessibleByUserId(user2Id);
    const u2PersonalId = u2Groups[0]!.id;
    const u2Tag = await tagRepo.ensureTag(u2PersonalId, 'urgente');
    const notifStateRepo = new LocalStorageNotificationStateRepository(adapter);
    await notifStateRepo.save({
      userId: user1Id,
      permissionPromptLastShownAt: '2026-11-15T10:00:00.000Z',
      handledOccurrences: [],
    });
    await notifStateRepo.save({
      userId: user2Id,
      permissionPromptLastShownAt: '2026-11-15T11:00:00.000Z',
      handledOccurrences: [
        {
          taskId: 'task-u2',
          occurrenceKey: '2026-11-20|date-only',
          status: 'notified',
          recordedAt: '2026-11-15T11:00:00.000Z',
        },
      ],
    });
    await taskRepo.save({
      id: 'task-u2',
      title: 'Tarea de User 2',
      description: '',
      dueDate: null,
      dueTime: null,
      completed: false,
      completedAt: null,
      groupId: u2PersonalId,
      tagIds: [u2Tag.id],
      subtasks: [],
      reminders: [],
      createdAt: '2026-11-15T12:00:00.000Z',
    });

    // Wrong current password rejects deletion
    const wrongDelete = await useAuthStore.getState().deleteAccount({ currentPassword: 'wrong' });
    expect(wrongDelete).toBe(false);
    expect(useAuthStore.getState().authError).toBe(es.auth.invalidCurrentPassword);

    // Valid deletion removes user 2 data and preserves user 1 data
    const deleted = await useAuthStore.getState().deleteAccount({ currentPassword: 'Password2' });
    expect(deleted).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().loginNotice).toBe(es.auth.accountDeleted);
    expect(listener).toHaveBeenLastCalledWith('deleted');

    const userRepo = new LocalStorageUserRepository(adapter);
    expect(await userRepo.getById(user2Id)).toBeNull();
    expect(await userRepo.getById(user1Id)).not.toBeNull();
    expect(await groupRepo.getAccessibleByUserId(user2Id)).toEqual([]);
    expect(await groupRepo.getAccessibleByUserId(user1Id)).toHaveLength(1);
    expect(await taskRepo.getByGroupId(u2PersonalId)).toEqual([]);
    expect(await tagRepo.getByGroupId(u2PersonalId)).toEqual([]);
    expect((await notifStateRepo.getByUserId(user2Id)).permissionPromptLastShownAt).toBeNull();
    expect((await notifStateRepo.getByUserId(user2Id)).handledOccurrences).toEqual([]);
    expect((await notifStateRepo.getByUserId(user1Id)).permissionPromptLastShownAt).toBe(
      '2026-11-15T10:00:00.000Z',
    );

    unsubscribe();
  });
});
