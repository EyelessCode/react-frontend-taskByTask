import { z } from 'zod';
import type { LoginLockoutRepository } from '../contracts/login-lockout-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { ValidationError } from '../../shared/errors';
import { loginLockoutSchema, type LoginLockoutState } from '../../shared/schemas';

const lockoutsArraySchema = z.array(loginLockoutSchema);

export class LocalStorageLoginLockoutRepository implements LoginLockoutRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  private readAll(): LoginLockoutState[] {
    return this.storageAdapter.getItem(STORAGE_KEYS.LOGIN_LOCKOUTS, lockoutsArraySchema, []);
  }

  async getByEmail(normalizedEmail: string): Promise<LoginLockoutState | null> {
    const target = normalizedEmail.trim().toLowerCase();
    const found = this.readAll().find((state) => state.normalizedEmail === target) ?? null;
    return Promise.resolve(found);
  }

  async save(state: LoginLockoutState): Promise<void> {
    const parseResult = loginLockoutSchema.safeParse(state);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Login lockout validation failed', issues);
    }

    const validated = parseResult.data;
    const all = this.readAll();
    const existingIndex = all.findIndex((item) => item.normalizedEmail === validated.normalizedEmail);
    const updated = [...all];
    if (existingIndex >= 0) {
      updated[existingIndex] = validated;
    } else {
      updated.push(validated);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.LOGIN_LOCKOUTS, lockoutsArraySchema, updated);
    return Promise.resolve();
  }

  async clearByEmail(normalizedEmail: string): Promise<void> {
    const target = normalizedEmail.trim().toLowerCase();
    const remaining = this.readAll().filter((state) => state.normalizedEmail !== target);
    this.storageAdapter.setItem(STORAGE_KEYS.LOGIN_LOCKOUTS, lockoutsArraySchema, remaining);
    return Promise.resolve();
  }
}
