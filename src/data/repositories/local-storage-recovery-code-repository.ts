import { z } from 'zod';
import type { RecoveryCodeRepository } from '../contracts/recovery-code-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { ValidationError } from '../../shared/errors';
import { recoveryCodeSchema, type RecoveryCode } from '../../shared/schemas';

const recoveryCodesArraySchema = z.array(recoveryCodeSchema);

export class LocalStorageRecoveryCodeRepository implements RecoveryCodeRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  private readAll(): RecoveryCode[] {
    return this.storageAdapter.getItem(STORAGE_KEYS.RECOVERY_CODES, recoveryCodesArraySchema, []);
  }

  async getByUserId(userId: string): Promise<RecoveryCode[]> {
    return Promise.resolve(this.readAll().filter((code) => code.userId === userId));
  }

  async replaceForUser(userId: string, codes: RecoveryCode[]): Promise<void> {
    const parseResult = recoveryCodesArraySchema.safeParse(codes);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Recovery codes validation failed', issues);
    }

    const others = this.readAll().filter((code) => code.userId !== userId);
    const updated = [...others, ...parseResult.data];
    this.storageAdapter.setItem(STORAGE_KEYS.RECOVERY_CODES, recoveryCodesArraySchema, updated);
    return Promise.resolve();
  }

  async save(code: RecoveryCode): Promise<void> {
    const parseResult = recoveryCodeSchema.safeParse(code);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Recovery code validation failed', issues);
    }

    const validated = parseResult.data;
    const all = this.readAll();
    const existingIndex = all.findIndex((c) => c.id === validated.id);
    const updated = [...all];
    if (existingIndex >= 0) {
      updated[existingIndex] = validated;
    } else {
      updated.push(validated);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.RECOVERY_CODES, recoveryCodesArraySchema, updated);
    return Promise.resolve();
  }

  async deleteByUserId(userId: string): Promise<void> {
    const remaining = this.readAll().filter((code) => code.userId !== userId);
    this.storageAdapter.setItem(STORAGE_KEYS.RECOVERY_CODES, recoveryCodesArraySchema, remaining);
    return Promise.resolve();
  }
}
