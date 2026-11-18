import type { Notification } from '../../shared/schemas';

export interface NotificationRepository {
  getByUserId(userId: string): Promise<Notification[]>;
  save(notification: Notification): Promise<void>;
  markAsRead(userId: string, notificationId: string): Promise<Notification | null>;
  markAllAsRead(userId: string): Promise<number>;
  delete(userId: string, notificationId: string): Promise<boolean>;
  pruneExpired(userId: string, nowIso?: string): Promise<number>;
  deleteByUserId(userId: string): Promise<void>;
}
