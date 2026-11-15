import { z } from 'zod';
import type { StorageAdapter } from '../contracts/storage-adapter';
import type { UserRepository } from '../contracts/user-repository';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import {
  BusinessRuleViolationError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors';
import { es } from '../../shared/i18n';
import { userSchema, type User } from '../../shared/schemas';

const usersArraySchema = z.array(userSchema);

export class LocalStorageUserRepository implements UserRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  async getAll(): Promise<User[]> {
    return Promise.resolve(this.storageAdapter.getItem(STORAGE_KEYS.USERS, usersArraySchema, []));
  }

  async getById(id: string): Promise<User | null> {
    const users = await this.getAll();
    return users.find((u) => u.id === id) ?? null;
  }

  async getByEmail(normalizedEmail: string): Promise<User | null> {
    const target = normalizedEmail.trim().toLowerCase();
    const users = await this.getAll();
    return users.find((u) => u.email.toLowerCase() === target) ?? null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const target = username.trim().toLowerCase();
    const users = await this.getAll();
    return users.find((u) => u.username.toLowerCase() === target) ?? null;
  }

  async save(user: User): Promise<void> {
    const parseResult = userSchema.safeParse(user);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('User validation failed', issues);
    }

    const validated = parseResult.data;
    const users = await this.getAll();

    const duplicateEmail = users.find(
      (u) => u.id !== validated.id && u.email.toLowerCase() === validated.email.toLowerCase(),
    );
    if (duplicateEmail) {
      throw new BusinessRuleViolationError(es.auth.emailAlreadyExists);
    }

    const duplicateUsername = users.find(
      (u) => u.id !== validated.id && u.username.toLowerCase() === validated.username.toLowerCase(),
    );
    if (duplicateUsername) {
      throw new BusinessRuleViolationError(es.auth.usernameAlreadyExists);
    }

    const existingIndex = users.findIndex((u) => u.id === validated.id);
    const updatedUsers = [...users];
    if (existingIndex >= 0) {
      updatedUsers[existingIndex] = validated;
    } else {
      updatedUsers.push(validated);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.USERS, usersArraySchema, updatedUsers);
  }

  async delete(id: string): Promise<void> {
    const users = await this.getAll();
    const exists = users.some((u) => u.id === id);
    if (!exists) {
      throw new NotFoundError('Usuario', id);
    }

    const updatedUsers = users.filter((u) => u.id !== id);
    this.storageAdapter.setItem(STORAGE_KEYS.USERS, usersArraySchema, updatedUsers);
  }
}
