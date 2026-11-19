import { z } from 'zod';
import type { NotificationRepository } from '../contracts/notification-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { ValidationError } from '../../shared/errors';
import { LIMITS, notificationSchema, type Notification } from '../../shared/schemas';

const notificationsArraySchema = z.array(notificationSchema);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class LocalStorageNotificationRepository implements NotificationRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  private readAll(): Notification[] {
    return this.storageAdapter.getItem(STORAGE_KEYS.NOTIFICATIONS, notificationsArraySchema, []);
  }

  private writeAll(notifications: Notification[]): void {
    this.storageAdapter.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      notificationsArraySchema,
      notifications,
    );
  }

  async getByUserId(userId: string): Promise<Notification[]> {
    const list = this.readAll()
      .filter((notification) => notification.userId === userId)
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
      );
    return Promise.resolve(list);
  }

  async save(notification: Notification): Promise<void> {
    const parseResult = notificationSchema.safeParse(notification);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      throw new ValidationError('Notification validation failed', issues);
    }

    const validated = parseResult.data;
    const all = this.readAll();
    const index = all.findIndex((item) => item.id === validated.id);
    if (index >= 0) {
      all[index] = validated;
    } else {
      all.push(validated);
    }
    this.writeAll(all);
    return Promise.resolve();
  }

  async markAsRead(userId: string, notificationId: string): Promise<Notification | null> {
    const all = this.readAll();
    const index = all.findIndex(
      (item) => item.userId === userId && item.id === notificationId,
    );
    if (index < 0) {
      return Promise.resolve(null);
    }

    const updated: Notification = {
      ...all[index]!,
      read: true,
    };
    all[index] = updated;
    this.writeAll(all);
    return Promise.resolve(updated);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const all = this.readAll();
    let updatedCount = 0;

    const next = all.map((item) => {
      if (item.userId === userId && !item.read) {
        updatedCount += 1;
        return { ...item, read: true };
      }
      return item;
    });

    if (updatedCount > 0) {
      this.writeAll(next);
    }
    return Promise.resolve(updatedCount);
  }

  async delete(userId: string, notificationId: string): Promise<boolean> {
    const all = this.readAll();
    const remaining = all.filter(
      (item) => !(item.userId === userId && item.id === notificationId),
    );
    if (remaining.length === all.length) {
      return Promise.resolve(false);
    }

    this.writeAll(remaining);
    return Promise.resolve(true);
  }

  async pruneExpired(userId: string, nowIso?: string): Promise<number> {
    const nowMs = nowIso ? Date.parse(nowIso) : Date.now();
    const retentionMs = LIMITS.NOTIFICATION_RETENTION_DAYS * MS_PER_DAY;
    const all = this.readAll();
    let prunedCount = 0;

    const remaining = all.filter((item) => {
      if (item.userId !== userId) {
        return true;
      }
      const ageMs = nowMs - Date.parse(item.createdAt);
      if (ageMs >= retentionMs) {
        prunedCount += 1;
        return false;
      }
      return true;
    });

    if (prunedCount > 0) {
      this.writeAll(remaining);
    }
    return Promise.resolve(prunedCount);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const remaining = this.readAll().filter((notification) => notification.userId !== userId);
    this.writeAll(remaining);
    return Promise.resolve();
  }
}
