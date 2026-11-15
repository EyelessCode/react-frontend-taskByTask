import type { Notification } from '../../shared/schemas';

export interface NotificationRepository {
  getByUserId(userId: string): Promise<Notification[]>;
  deleteByUserId(userId: string): Promise<void>;
}
