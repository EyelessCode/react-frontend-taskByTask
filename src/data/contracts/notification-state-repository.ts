import type { UserNotificationState } from '../../shared/schemas';

export interface NotificationStateRepository {
  getByUserId(userId: string): Promise<UserNotificationState>;
  save(state: UserNotificationState): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
