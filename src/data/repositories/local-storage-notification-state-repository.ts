import { z } from 'zod';
import type { NotificationStateRepository } from '../contracts/notification-state-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { ValidationError } from '../../shared/errors';
import { userNotificationStateSchema, type UserNotificationState } from '../../shared/schemas';

const notificationStatesArraySchema = z.array(userNotificationStateSchema);

export class LocalStorageNotificationStateRepository implements NotificationStateRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  private readAll(): UserNotificationState[] {
    return this.storageAdapter.getItem(
      STORAGE_KEYS.NOTIFICATION_STATE,
      notificationStatesArraySchema,
      [],
    );
  }

  private writeAll(states: UserNotificationState[]): void {
    this.storageAdapter.setItem(
      STORAGE_KEYS.NOTIFICATION_STATE,
      notificationStatesArraySchema,
      states,
    );
  }

  async getByUserId(userId: string): Promise<UserNotificationState> {
    const existing = this.readAll().find((state) => state.userId === userId);
    if (existing) {
      return Promise.resolve(existing);
    }
    return Promise.resolve({
      userId,
      permissionPromptLastShownAt: null,
      handledOccurrences: [],
    });
  }

  async save(state: UserNotificationState): Promise<void> {
    const parseResult = userNotificationStateSchema.safeParse(state);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      throw new ValidationError('User notification state validation failed', issues);
    }

    const validated = parseResult.data;
    const all = this.readAll();
    const index = all.findIndex((item) => item.userId === validated.userId);
    if (index >= 0) {
      all[index] = validated;
    } else {
      all.push(validated);
    }
    this.writeAll(all);
    return Promise.resolve();
  }

  async deleteByUserId(userId: string): Promise<void> {
    const remaining = this.readAll().filter((state) => state.userId !== userId);
    this.writeAll(remaining);
    return Promise.resolve();
  }
}
