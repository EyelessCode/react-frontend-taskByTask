import { z } from 'zod';
import type { NotificationRepository } from '../contracts/notification-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { notificationSchema, type Notification } from '../../shared/schemas';

const notificationsArraySchema = z.array(notificationSchema);

export class LocalStorageNotificationRepository implements NotificationRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  private readAll(): Notification[] {
    return this.storageAdapter.getItem(STORAGE_KEYS.NOTIFICATIONS, notificationsArraySchema, []);
  }

  async getByUserId(userId: string): Promise<Notification[]> {
    return Promise.resolve(this.readAll().filter((notification) => notification.userId === userId));
  }

  async deleteByUserId(userId: string): Promise<void> {
    const remaining = this.readAll().filter((notification) => notification.userId !== userId);
    this.storageAdapter.setItem(STORAGE_KEYS.NOTIFICATIONS, notificationsArraySchema, remaining);
    return Promise.resolve();
  }
}
