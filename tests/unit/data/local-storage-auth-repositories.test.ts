import { beforeEach, describe, expect, it } from 'vitest';
import {
  LocalStorageGroupRepository,
  LocalStorageLoginLockoutRepository,
  LocalStorageNotificationRepository,
  LocalStorageRecoveryCodeRepository,
  LocalStorageSessionRepository,
  LocalStorageUserRepository,
} from '@/data/repositories';
import { LocalStorageAdapter, STORAGE_KEYS } from '@/data/storage';
import { BusinessRuleViolationError, ValidationError } from '@/shared/errors';
import { es } from '@/shared/i18n';
import type {
  LoginLockoutState,
  Notification,
  RecoveryCode,
  Session,
  User,
} from '@/shared/schemas';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'ana@example.com',
    username: overrides.username ?? 'ana123',
    displayName: overrides.displayName ?? 'Ana García',
    passwordHash: overrides.passwordHash ?? 'pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    timeZone: overrides.timeZone ?? 'America/Bogota',
    timeFormat: overrides.timeFormat ?? '24h',
    createdAt: overrides.createdAt ?? '2026-11-15T12:00:00.000Z',
  };
}

describe('Auth & Isolation LocalStorage Repositories', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
  });

  describe('LocalStorageUserRepository', () => {
    it('persists and retrieves users by id, normalized email, and case-insensitive username', async () => {
      const repo = new LocalStorageUserRepository(adapter);
      const user = makeUser({ id: 'u-1', email: 'Ana@Example.com', username: 'AnaUser1' });

      await repo.save(user);

      expect(await repo.getById('u-1')).toMatchObject({ email: 'ana@example.com', username: 'AnaUser1' });
      expect(await repo.getByEmail('  ANA@EXAMPLE.COM ')).toMatchObject({ id: 'u-1' });
      expect(await repo.getByUsername('  anauser1 ')).toMatchObject({ id: 'u-1' });
    });

    it('rejects plaintext password property via strict userSchema validation', async () => {
      const repo = new LocalStorageUserRepository(adapter);
      const unsafePayload = {
        ...makeUser(),
        password: 'plaintext-password',
      } as unknown as User;

      await expect(repo.save(unsafePayload)).rejects.toThrow(ValidationError);
    });

    it('enforces case-insensitive email and username uniqueness excluding self id', async () => {
      const repo = new LocalStorageUserRepository(adapter);
      const u1 = makeUser({ id: 'u-1', email: 'ana@example.com', username: 'Ana123' });
      const u2 = makeUser({ id: 'u-2', email: 'beto@example.com', username: 'Beto123' });
      await repo.save(u1);
      await repo.save(u2);

      // Updating own record with same email/username (different case) succeeds
      await expect(
        repo.save({ ...u1, email: 'ANA@example.com', username: 'ANA123', displayName: 'Ana G.' }),
      ).resolves.toBeUndefined();

      // Duplicate email on another id fails
      await expect(
        repo.save(makeUser({ id: 'u-3', email: 'ANA@example.com', username: 'Carlos1' })),
      ).rejects.toThrow(new BusinessRuleViolationError(es.auth.emailAlreadyExists));

      // Duplicate username on another id fails
      await expect(
        repo.save(makeUser({ id: 'u-3', email: 'carlos@example.com', username: 'beto123' })),
      ).rejects.toThrow(new BusinessRuleViolationError(es.auth.usernameAlreadyExists));
    });
  });

  describe('LocalStorageSessionRepository', () => {
    it('saves, reads, and clears active session with Zod validation', async () => {
      const repo = new LocalStorageSessionRepository(adapter);
      expect(await repo.get()).toBeNull();

      const session: Session = {
        userId: 'u-1',
        token: 'tok-123',
        createdAt: '2026-11-15T12:00:00.000Z',
        expiresAt: '2026-11-22T12:00:00.000Z',
      };
      await repo.save(session);
      expect(await repo.get()).toEqual(session);

      await repo.clear();
      expect(await repo.get()).toBeNull();
    });
  });

  describe('LocalStorageRecoveryCodeRepository', () => {
    it('replaces and deletes recovery codes scoped by userId while preserving other users', async () => {
      const repo = new LocalStorageRecoveryCodeRepository(adapter);
      const u1Code1: RecoveryCode = { id: 'c1', userId: 'u-1', code: 'AAAA1111', used: false, usedAt: null };
      const u2Code1: RecoveryCode = { id: 'c2', userId: 'u-2', code: 'BBBB2222', used: false, usedAt: null };

      await repo.replaceForUser('u-1', [u1Code1]);
      await repo.replaceForUser('u-2', [u2Code1]);

      const u1New: RecoveryCode = { id: 'c3', userId: 'u-1', code: 'CCCC3333', used: false, usedAt: null };
      await repo.replaceForUser('u-1', [u1New]);

      expect(await repo.getByUserId('u-1')).toEqual([u1New]);
      expect(await repo.getByUserId('u-2')).toEqual([u2Code1]);

      await repo.save({ ...u1New, used: true, usedAt: '2026-11-15T13:00:00.000Z' });
      expect(await repo.getByUserId('u-1')).toEqual([
        { ...u1New, used: true, usedAt: '2026-11-15T13:00:00.000Z' },
      ]);

      await repo.deleteByUserId('u-1');
      expect(await repo.getByUserId('u-1')).toEqual([]);
      expect(await repo.getByUserId('u-2')).toEqual([u2Code1]);
    });
  });

  describe('LocalStorageLoginLockoutRepository', () => {
    it('persists, looks up case-insensitively, and clears lockout state by normalized email', async () => {
      const repo = new LocalStorageLoginLockoutRepository(adapter);
      const state: LoginLockoutState = {
        normalizedEmail: 'ana@example.com',
        failedAttempts: 5,
        lockedUntil: '2026-11-15T12:05:00.000Z',
      };

      await repo.save(state);
      expect(await repo.getByEmail('  ANA@Example.com ')).toEqual(state);

      await repo.clearByEmail('ANA@EXAMPLE.COM');
      expect(await repo.getByEmail('ana@example.com')).toBeNull();
    });
  });

  describe('LocalStorageNotificationRepository', () => {
    it('reads and deletes notifications scoped to userId while preserving other users', async () => {
      const repo = new LocalStorageNotificationRepository(adapter);
      const items: Notification[] = [
        {
          id: 'n-1',
          userId: 'u-1',
          eventType: 'due_soon',
          content: 'Tarea próxima',
          read: false,
          createdAt: '2026-11-15T12:00:00.000Z',
        },
        {
          id: 'n-2',
          userId: 'u-2',
          eventType: 'due_soon',
          content: 'Otra tarea',
          read: false,
          createdAt: '2026-11-15T12:00:00.000Z',
        },
      ];
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(items));

      expect(await repo.getByUserId('u-1')).toHaveLength(1);
      await repo.deleteByUserId('u-1');
      expect(await repo.getByUserId('u-1')).toEqual([]);
      expect(await repo.getByUserId('u-2')).toHaveLength(1);
    });
  });

  describe('LocalStorageGroupRepository per-user isolation methods', () => {
    it('provisions a unique Personal group per user ignoring local-user seed and supports deleteAllByOwnerId', async () => {
      const repo = new LocalStorageGroupRepository(adapter);
      // Seed legacy local-user group
      await repo.ensureSeedGroup();

      const u1Personal = await repo.ensurePersonalGroupForUser('u-1', '2026-11-15T12:00:00.000Z');
      expect(u1Personal.isPersonal).toBe(true);
      expect(u1Personal.id).not.toBe('group-personal');
      expect(u1Personal.creatorId).toBe('u-1');
      expect(u1Personal.members).toEqual([
        { userId: 'u-1', role: 'creator', joinedAt: '2026-11-15T12:00:00.000Z' },
      ]);

      // Calling again returns the existing Personal group for u-1
      expect(await repo.ensurePersonalGroupForUser('u-1')).toEqual(u1Personal);

      // u-2 gets a separate Personal group
      const u2Personal = await repo.ensurePersonalGroupForUser('u-2', '2026-11-15T12:00:00.000Z');
      expect(u2Personal.id).not.toBe(u1Personal.id);

      expect(await repo.getAccessibleByUserId('u-1')).toEqual([u1Personal]);
      expect(await repo.getAccessibleByUserId('u-2')).toEqual([u2Personal]);

      // delete(id) still blocks Personal group deletion
      await expect(repo.delete(u1Personal.id)).rejects.toThrow(BusinessRuleViolationError);

      // deleteAllByOwnerId removes u-1 owned groups including Personal while preserving u-2 and seed
      const deletedIds = await repo.deleteAllByOwnerId('u-1');
      expect(deletedIds).toEqual([u1Personal.id]);
      expect(await repo.getAccessibleByUserId('u-1')).toEqual([]);
      expect(await repo.getAccessibleByUserId('u-2')).toEqual([u2Personal]);
    });
  });
});
