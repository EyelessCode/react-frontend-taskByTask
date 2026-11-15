import { create } from 'zustand';
import type {
  GroupRepository,
  LoginLockoutRepository,
  NotificationRepository,
  RecoveryCodeRepository,
  SessionRepository,
  TagRepository,
  TaskRepository,
  UserRepository,
} from '../../../data/contracts';
import {
  LocalStorageGroupRepository,
  LocalStorageLoginLockoutRepository,
  LocalStorageNotificationRepository,
  LocalStorageRecoveryCodeRepository,
  LocalStorageSessionRepository,
  LocalStorageTagRepository,
  LocalStorageTaskRepository,
  LocalStorageUserRepository,
} from '../../../data/repositories';
import { BusinessRuleViolationError } from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import { LIMITS, type Session, type User } from '../../../shared/schemas';
import {
  changePasswordFormSchema,
  currentPasswordConfirmSchema,
  loginFormSchema,
  profileFormSchema,
  recoverFormSchema,
  registerFormSchema,
  type ChangePasswordFormValues,
  type CurrentPasswordConfirmValues,
  type LoginFormValues,
  type ProfileFormValues,
  type RecoverFormValues,
  type RegisterFormValues,
} from '../schemas';
import {
  buildRecoveryCodeRecords,
  evaluateNextLockoutState,
  formatLockoutMessage,
  generateRecoveryCodes,
  getLockoutRemainingMs,
  hashPassword,
  isLockedOut,
  normalizeEmail,
  normalizeRecoveryCode,
  verifyPassword,
  type CryptoProvider,
} from '../utils';

export type AuthSessionEndReason = 'logout' | 'expired' | 'orphan' | 'deleted';

type AuthSessionEndListener = (reason: AuthSessionEndReason) => void;

const sessionEndListeners = new Set<AuthSessionEndListener>();

/**
 * Registers a listener notified whenever an authenticated session terminates
 * (explicit logout, expired session, orphaned session, or account deletion).
 */
export function subscribeAuthSessionEnd(listener: AuthSessionEndListener): () => void {
  sessionEndListeners.add(listener);
  return () => {
    sessionEndListeners.delete(listener);
  };
}

function emitSessionEnd(reason: AuthSessionEndReason): void {
  for (const listener of sessionEndListeners) {
    listener(reason);
  }
}

export interface ValidateSessionResult {
  authenticated: boolean;
  userId: string | null;
  reason?: 'none' | 'expired' | 'orphan';
}

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isSubmitting: boolean;
  authError: string | null;
  loginNotice: string | null;
  oneTimeRecoveryCodes: string[] | null;
  postRegisterCodesPending: boolean;
}

export interface AuthActions {
  validateSession: () => Promise<ValidateSessionResult>;
  ensureActiveUserId: () => Promise<string | null>;
  register: (values: RegisterFormValues) => Promise<boolean>;
  login: (values: LoginFormValues) => Promise<boolean>;
  logout: () => Promise<void>;
  recoverPassword: (values: RecoverFormValues) => Promise<boolean>;
  updateProfile: (values: ProfileFormValues) => Promise<boolean>;
  changePassword: (values: ChangePasswordFormValues) => Promise<boolean>;
  regenerateRecoveryCodes: (values: CurrentPasswordConfirmValues) => Promise<boolean>;
  deleteAccount: (values: CurrentPasswordConfirmValues) => Promise<boolean>;
  acknowledgeRegistrationCodes: () => void;
  dismissOneTimeRecoveryCodes: () => void;
  clearAuthError: () => void;
  clearLoginNotice: () => void;
}

export type AuthStore = AuthState & AuthActions;

export interface AuthStoreDependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  recoveryCodeRepository: RecoveryCodeRepository;
  loginLockoutRepository: LoginLockoutRepository;
  notificationRepository: NotificationRepository;
  groupRepository: GroupRepository;
  taskRepository: TaskRepository;
  tagRepository: TagRepository;
  now: () => number;
  createId: () => string;
  createToken: () => string;
  getTimeZone: () => string;
  cryptoProvider?: CryptoProvider;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function createDefaultDependencies(): AuthStoreDependencies {
  return {
    userRepository: new LocalStorageUserRepository(),
    sessionRepository: new LocalStorageSessionRepository(),
    recoveryCodeRepository: new LocalStorageRecoveryCodeRepository(),
    loginLockoutRepository: new LocalStorageLoginLockoutRepository(),
    notificationRepository: new LocalStorageNotificationRepository(),
    groupRepository: new LocalStorageGroupRepository(),
    taskRepository: new LocalStorageTaskRepository(),
    tagRepository: new LocalStorageTagRepository(),
    now: () => Date.now(),
    createId: () => globalThis.crypto.randomUUID(),
    createToken: () => globalThis.crypto.randomUUID(),
    getTimeZone: detectBrowserTimeZone,
  };
}

let deps: AuthStoreDependencies = createDefaultDependencies();

export function configureAuthStore(overrides: Partial<AuthStoreDependencies>): void {
  deps = { ...deps, ...overrides };
}

const initialAuthState: AuthState = {
  currentUser: null,
  isAuthenticated: false,
  isInitialized: false,
  isSubmitting: false,
  authError: null,
  loginNotice: null,
  oneTimeRecoveryCodes: null,
  postRegisterCodesPending: false,
};

function createSessionRecord(userId: string, nowMs: number): Session {
  return {
    userId,
    token: deps.createToken(),
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + LIMITS.SESSION_DURATION_DAYS * MS_PER_DAY).toISOString(),
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...initialAuthState,

  validateSession: async (): Promise<ValidateSessionResult> => {
    const session = await deps.sessionRepository.get();
    if (!session) {
      set({
        currentUser: null,
        isAuthenticated: false,
        isInitialized: true,
        oneTimeRecoveryCodes: null,
        postRegisterCodesPending: false,
      });
      return { authenticated: false, userId: null, reason: 'none' };
    }

    if (deps.now() >= Date.parse(session.expiresAt)) {
      await deps.sessionRepository.clear();
      set({
        currentUser: null,
        isAuthenticated: false,
        isInitialized: true,
        oneTimeRecoveryCodes: null,
        postRegisterCodesPending: false,
        loginNotice: es.auth.sessionExpired,
      });
      emitSessionEnd('expired');
      return { authenticated: false, userId: null, reason: 'expired' };
    }

    const user = await deps.userRepository.getById(session.userId);
    if (!user) {
      await deps.sessionRepository.clear();
      set({
        currentUser: null,
        isAuthenticated: false,
        isInitialized: true,
        oneTimeRecoveryCodes: null,
        postRegisterCodesPending: false,
        loginNotice: null,
      });
      emitSessionEnd('orphan');
      return { authenticated: false, userId: null, reason: 'orphan' };
    }

    set({
      currentUser: user,
      isAuthenticated: true,
      isInitialized: true,
    });
    return { authenticated: true, userId: user.id };
  },

  ensureActiveUserId: async (): Promise<string | null> => {
    const result = await get().validateSession();
    return result.userId;
  },

  register: async (values: RegisterFormValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const parsed = registerFormSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const data = parsed.data;
    if (await deps.userRepository.getByEmail(data.email)) {
      set({ isSubmitting: false, authError: es.auth.emailAlreadyExists });
      return false;
    }

    if (await deps.userRepository.getByUsername(data.username)) {
      set({ isSubmitting: false, authError: es.auth.usernameAlreadyExists });
      return false;
    }

    const nowMs = deps.now();
    const nowIso = new Date(nowMs).toISOString();
    const passwordHash = await hashPassword(data.password, deps.cryptoProvider);

    const newUser: User = {
      id: deps.createId(),
      email: data.email,
      username: data.username,
      displayName: data.displayName,
      passwordHash,
      timeZone: deps.getTimeZone(),
      timeFormat: '24h',
      createdAt: nowIso,
    };

    try {
      await deps.userRepository.save(newUser);
    } catch (error) {
      const message =
        error instanceof BusinessRuleViolationError ? error.message : es.errors.unexpected;
      set({ isSubmitting: false, authError: message });
      return false;
    }

    const plainCodes = generateRecoveryCodes(LIMITS.RECOVERY_CODES_COUNT, deps.cryptoProvider);
    const codeRecords = buildRecoveryCodeRecords(newUser.id, plainCodes, deps.createId);
    await deps.recoveryCodeRepository.replaceForUser(newUser.id, codeRecords);
    await deps.groupRepository.ensurePersonalGroupForUser(newUser.id, nowIso);
    await deps.sessionRepository.save(createSessionRecord(newUser.id, nowMs));

    set({
      currentUser: newUser,
      isAuthenticated: true,
      isInitialized: true,
      isSubmitting: false,
      authError: null,
      loginNotice: null,
      oneTimeRecoveryCodes: plainCodes,
      postRegisterCodesPending: true,
    });
    return true;
  },

  login: async (values: LoginFormValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const parsed = loginFormSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const nowMs = deps.now();
    const normalizedEmail = normalizeEmail(parsed.data.email);
    const lockoutState = await deps.loginLockoutRepository.getByEmail(normalizedEmail);

    if (isLockedOut(lockoutState, nowMs)) {
      const remainingMs = getLockoutRemainingMs(lockoutState, nowMs);
      set({
        isSubmitting: false,
        authError: formatLockoutMessage(remainingMs),
      });
      return false;
    }

    const user = await deps.userRepository.getByEmail(normalizedEmail);
    const passwordMatches = user
      ? await verifyPassword(parsed.data.password, user.passwordHash, deps.cryptoProvider)
      : false;

    if (!user || !passwordMatches) {
      const nextLockout = evaluateNextLockoutState(normalizedEmail, lockoutState, nowMs);
      await deps.loginLockoutRepository.save(nextLockout);
      const remainingMs = getLockoutRemainingMs(nextLockout, nowMs);

      set({
        isSubmitting: false,
        authError: remainingMs > 0 ? formatLockoutMessage(remainingMs) : es.auth.invalidCredentials,
      });
      return false;
    }

    const updatedUser: User = {
      ...user,
      timeZone: deps.getTimeZone(),
    };
    await deps.userRepository.save(updatedUser);
    await deps.loginLockoutRepository.clearByEmail(normalizedEmail);
    await deps.sessionRepository.save(createSessionRecord(updatedUser.id, nowMs));

    set({
      currentUser: updatedUser,
      isAuthenticated: true,
      isInitialized: true,
      isSubmitting: false,
      authError: null,
      loginNotice: null,
      oneTimeRecoveryCodes: null,
      postRegisterCodesPending: false,
    });
    return true;
  },

  logout: async (): Promise<void> => {
    await deps.sessionRepository.clear();
    set({
      currentUser: null,
      isAuthenticated: false,
      isInitialized: true,
      authError: null,
      loginNotice: null,
      oneTimeRecoveryCodes: null,
      postRegisterCodesPending: false,
    });
    emitSessionEnd('logout');
  },

  recoverPassword: async (values: RecoverFormValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const parsed = recoverFormSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const user = await deps.userRepository.getByEmail(normalizedEmail);
    if (!user) {
      set({ isSubmitting: false, authError: es.auth.invalidRecoveryRequest });
      return false;
    }

    const codes = await deps.recoveryCodeRepository.getByUserId(user.id);
    const normalizedCode = normalizeRecoveryCode(parsed.data.recoveryCode);
    const matchingCode = codes.find((code) => !code.used && code.code === normalizedCode);

    if (!matchingCode) {
      set({ isSubmitting: false, authError: es.auth.invalidRecoveryRequest });
      return false;
    }

    const nowIso = new Date(deps.now()).toISOString();
    await deps.recoveryCodeRepository.save({
      ...matchingCode,
      used: true,
      usedAt: nowIso,
    });

    const newHash = await hashPassword(parsed.data.newPassword, deps.cryptoProvider);
    await deps.userRepository.save({
      ...user,
      passwordHash: newHash,
    });
    await deps.loginLockoutRepository.clearByEmail(normalizedEmail);

    set({
      isSubmitting: false,
      authError: null,
      loginNotice: es.auth.recoverSuccess,
    });
    return true;
  },

  updateProfile: async (values: ProfileFormValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const activeUserId = await get().ensureActiveUserId();
    if (!activeUserId) {
      set({ isSubmitting: false });
      return false;
    }

    const parsed = profileFormSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const existingUser = await deps.userRepository.getById(activeUserId);
    if (!existingUser) {
      set({ isSubmitting: false });
      return false;
    }

    const previousEmail = normalizeEmail(existingUser.email);
    const updatedUser: User = {
      ...existingUser,
      email: parsed.data.email,
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      timeFormat: parsed.data.timeFormat,
    };

    try {
      await deps.userRepository.save(updatedUser);
    } catch (error) {
      const message =
        error instanceof BusinessRuleViolationError ? error.message : es.errors.unexpected;
      set({ isSubmitting: false, authError: message });
      return false;
    }

    if (normalizeEmail(updatedUser.email) !== previousEmail) {
      await deps.loginLockoutRepository.clearByEmail(previousEmail);
    }

    set({
      currentUser: updatedUser,
      isSubmitting: false,
      authError: null,
    });
    return true;
  },

  changePassword: async (values: ChangePasswordFormValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const activeUserId = await get().ensureActiveUserId();
    if (!activeUserId) {
      set({ isSubmitting: false });
      return false;
    }

    const parsed = changePasswordFormSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const user = await deps.userRepository.getById(activeUserId);
    if (!user) {
      set({ isSubmitting: false });
      return false;
    }

    const matches = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
      deps.cryptoProvider,
    );
    if (!matches) {
      set({ isSubmitting: false, authError: es.auth.invalidCurrentPassword });
      return false;
    }

    const newHash = await hashPassword(parsed.data.newPassword, deps.cryptoProvider);
    const updatedUser: User = {
      ...user,
      passwordHash: newHash,
    };
    await deps.userRepository.save(updatedUser);

    const activeSession = await deps.sessionRepository.get();
    if (activeSession) {
      await deps.sessionRepository.save({
        ...activeSession,
        token: deps.createToken(),
      });
    }

    set({
      currentUser: updatedUser,
      isSubmitting: false,
      authError: null,
    });
    return true;
  },

  regenerateRecoveryCodes: async (values: CurrentPasswordConfirmValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const activeUserId = await get().ensureActiveUserId();
    if (!activeUserId) {
      set({ isSubmitting: false });
      return false;
    }

    const parsed = currentPasswordConfirmSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const user = await deps.userRepository.getById(activeUserId);
    if (!user) {
      set({ isSubmitting: false });
      return false;
    }

    const matches = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
      deps.cryptoProvider,
    );
    if (!matches) {
      set({ isSubmitting: false, authError: es.auth.invalidCurrentPassword });
      return false;
    }

    const plainCodes = generateRecoveryCodes(LIMITS.RECOVERY_CODES_COUNT, deps.cryptoProvider);
    const records = buildRecoveryCodeRecords(user.id, plainCodes, deps.createId);
    await deps.recoveryCodeRepository.replaceForUser(user.id, records);

    set({
      isSubmitting: false,
      authError: null,
      oneTimeRecoveryCodes: plainCodes,
    });
    return true;
  },

  deleteAccount: async (values: CurrentPasswordConfirmValues): Promise<boolean> => {
    set({ isSubmitting: true, authError: null });

    const activeUserId = await get().ensureActiveUserId();
    if (!activeUserId) {
      set({ isSubmitting: false });
      return false;
    }

    const parsed = currentPasswordConfirmSchema.safeParse(values);
    if (!parsed.success) {
      set({
        isSubmitting: false,
        authError: parsed.error.issues[0]?.message ?? es.errors.unexpected,
      });
      return false;
    }

    const user = await deps.userRepository.getById(activeUserId);
    if (!user) {
      set({ isSubmitting: false });
      return false;
    }

    const matches = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
      deps.cryptoProvider,
    );
    if (!matches) {
      set({ isSubmitting: false, authError: es.auth.invalidCurrentPassword });
      return false;
    }

    const deletedGroupIds = await deps.groupRepository.deleteAllByOwnerId(user.id);
    for (const groupId of deletedGroupIds) {
      await deps.taskRepository.deleteByGroupId(groupId);
      await deps.tagRepository.deleteByGroupId(groupId);
    }

    await deps.recoveryCodeRepository.deleteByUserId(user.id);
    await deps.notificationRepository.deleteByUserId(user.id);
    await deps.loginLockoutRepository.clearByEmail(user.email);
    await deps.userRepository.delete(user.id);
    await deps.sessionRepository.clear();

    set({
      currentUser: null,
      isAuthenticated: false,
      isInitialized: true,
      isSubmitting: false,
      authError: null,
      loginNotice: es.auth.accountDeleted,
      oneTimeRecoveryCodes: null,
      postRegisterCodesPending: false,
    });
    emitSessionEnd('deleted');
    return true;
  },

  acknowledgeRegistrationCodes: () => {
    set({
      oneTimeRecoveryCodes: null,
      postRegisterCodesPending: false,
    });
  },

  dismissOneTimeRecoveryCodes: () => {
    set({
      oneTimeRecoveryCodes: null,
    });
  },

  clearAuthError: () => {
    set({ authError: null });
  },

  clearLoginNotice: () => {
    set({ loginNotice: null });
  },
}));

export function resetAuthStore(): void {
  deps = createDefaultDependencies();
  useAuthStore.setState({ ...initialAuthState });
}
