import { LIMITS, type Notification } from '../../shared/schemas';
import type {
  KeysetPage,
  ListNotificationsQuery,
  NotificationsApiRepository,
  PushSubscriptionResult,
  RegisterPushSubscriptionApiInput,
  VapidPublicKeyResult,
} from '../contracts';
import { mapNotificationFromDto, parseNumericId } from './dto-mappers';
import {
  keysetPageNotificationResponseDtoSchema,
  markAllReadResponseDtoSchema,
  notificationResponseDtoSchema,
  pushSubscriptionResponseDtoSchema,
  unreadCountResponseDtoSchema,
  vapidPublicKeyResponseDtoSchema,
} from './dto-schemas';
import type { ApiHttpClient } from './http-client';

export class HttpNotificationsApiRepository implements NotificationsApiRepository {
  private readonly httpClient: ApiHttpClient;

  constructor(httpClient: ApiHttpClient) {
    this.httpClient = httpClient;
  }

  async listNotifications(
    userId: string,
    query?: ListNotificationsQuery,
  ): Promise<KeysetPage<Notification>> {
    const page = await this.httpClient.requestJson({
      method: 'GET',
      path: '/api/v1/notifications',
      query: {
        cursor: query?.cursor ?? undefined,
        limit: query?.limit ?? LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
        unreadOnly: query?.unreadOnly,
      },
      responseSchema: keysetPageNotificationResponseDtoSchema,
    });

    return {
      content: page.content.map((dto) => mapNotificationFromDto(dto, userId)),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
      size: page.size,
    };
  }

  async getUnreadCount(): Promise<number> {
    const dto = await this.httpClient.requestJson({
      method: 'GET',
      path: '/api/v1/notifications/unread-count',
      responseSchema: unreadCountResponseDtoSchema,
    });
    return dto.unreadCount;
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const numericId = parseNumericId(notificationId, 'Notificación');
    const dto = await this.httpClient.requestJson({
      method: 'PATCH',
      path: `/api/v1/notifications/${numericId}/read`,
      responseSchema: notificationResponseDtoSchema,
    });
    return mapNotificationFromDto(dto, userId);
  }

  async markAllAsRead(): Promise<number> {
    const dto = await this.httpClient.requestJson({
      method: 'PATCH',
      path: '/api/v1/notifications/read-all',
      responseSchema: markAllReadResponseDtoSchema,
    });
    return dto.updatedCount;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const numericId = parseNumericId(notificationId, 'Notificación');
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: `/api/v1/notifications/${numericId}`,
    });
  }

  async getVapidPublicKey(): Promise<VapidPublicKeyResult> {
    const dto = await this.httpClient.requestJson({
      method: 'GET',
      path: '/api/v1/notifications/push/vapid-public-key',
      responseSchema: vapidPublicKeyResponseDtoSchema,
    });
    return {
      enabled: dto.enabled,
      publicKey: dto.publicKey,
    };
  }

  async registerPushSubscription(
    input: RegisterPushSubscriptionApiInput,
  ): Promise<PushSubscriptionResult> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/notifications/push/subscriptions',
      body: {
        endpoint: input.endpoint,
        keys: {
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
      },
      responseSchema: pushSubscriptionResponseDtoSchema,
    });
    return {
      id: String(dto.id),
      endpoint: dto.endpoint,
      createdAt: dto.createdAt,
    };
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: '/api/v1/notifications/push/subscriptions',
      query: { endpoint },
    });
  }

  async deletePushSubscriptionById(subscriptionId: string): Promise<void> {
    const numericId = parseNumericId(subscriptionId, 'Suscripción');
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: `/api/v1/notifications/push/subscriptions/${numericId}`,
    });
  }
}
