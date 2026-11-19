import { beforeEach, describe, expect, it } from 'vitest';
import {
  LocalStorageNotificationRepository,
  LocalStorageNotificationStateRepository,
} from '@/data/repositories';
import { LocalStorageAdapter, STORAGE_KEYS } from '@/data/storage';
import { ValidationError } from '@/shared/errors';
import { LIMITS, type Notification, type UserNotificationState } from '@/shared/schemas';

describe('LocalStorageNotificationRepository & LocalStorageNotificationStateRepository (005-notifications)', () => {
  let adapter: LocalStorageAdapter;
  let notificationRepo: LocalStorageNotificationRepository;
  let stateRepo: LocalStorageNotificationStateRepository;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
    notificationRepo = new LocalStorageNotificationRepository(adapter);
    stateRepo = new LocalStorageNotificationStateRepository(adapter);
  });

  describe('LocalStorageNotificationRepository (RF-29, RNF-07, RNF-10)', () => {
    it('saves, upserts, and returns notifications sorted newest first with deterministic tie-breaker and strict userId isolation', async () => {
      const n1: Notification = {
        id: 'ntf-a',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Primera alerta',
        read: false,
        createdAt: '2026-11-18T09:00:00.000Z',
      };
      const n2: Notification = {
        id: 'ntf-b',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Segunda alerta (misma marca de tiempo)',
        read: false,
        createdAt: '2026-11-18T10:00:00.000Z',
      };
      const n3: Notification = {
        id: 'ntf-c',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Tercera alerta (misma marca de tiempo)',
        read: false,
        createdAt: '2026-11-18T10:00:00.000Z',
      };
      const otherUserNotif: Notification = {
        id: 'ntf-other',
        userId: 'usr-2',
        eventType: 'due_date',
        content: 'Alerta ajena',
        read: false,
        createdAt: '2026-11-18T11:00:00.000Z',
      };

      await notificationRepo.save(n1);
      await notificationRepo.save(n2);
      await notificationRepo.save(n3);
      await notificationRepo.save(otherUserNotif);

      const user1List = await notificationRepo.getByUserId('usr-1');
      expect(user1List.map((n) => n.id)).toEqual(['ntf-c', 'ntf-b', 'ntf-a']);

      // Upsert existing notification by id
      await notificationRepo.save({ ...n1, content: 'Primera alerta actualizada', read: true });
      const afterUpsert = await notificationRepo.getByUserId('usr-1');
      expect(afterUpsert).toHaveLength(3);
      expect(afterUpsert.find((n) => n.id === 'ntf-a')?.content).toBe('Primera alerta actualizada');
      expect(afterUpsert.find((n) => n.id === 'ntf-a')?.read).toBe(true);

      // User 2 strictly isolated
      const user2List = await notificationRepo.getByUserId('usr-2');
      expect(user2List.map((n) => n.id)).toEqual(['ntf-other']);
    });

    it('rejects invalid notification payloads via Zod validation', async () => {
      await expect(
        notificationRepo.save({
          id: '',
          userId: 'usr-1',
          eventType: 'due_date',
          content: '',
          read: false,
          createdAt: 'not-iso',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('marks individual and all notifications as read strictly scoped to userId', async () => {
      await notificationRepo.save({
        id: 'ntf-1',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Alerta 1',
        read: false,
        createdAt: '2026-11-18T09:00:00.000Z',
      });
      await notificationRepo.save({
        id: 'ntf-2',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Alerta 2',
        read: false,
        createdAt: '2026-11-18T10:00:00.000Z',
      });
      await notificationRepo.save({
        id: 'ntf-other',
        userId: 'usr-2',
        eventType: 'due_date',
        content: 'Alerta Usuario 2',
        read: false,
        createdAt: '2026-11-18T11:00:00.000Z',
      });

      // Cannot mark another user's notification as read
      expect(await notificationRepo.markAsRead('usr-1', 'ntf-other')).toBeNull();
      expect((await notificationRepo.getByUserId('usr-2'))[0]?.read).toBe(false);

      // Mark single notification as read
      const updated = await notificationRepo.markAsRead('usr-1', 'ntf-1');
      expect(updated?.read).toBe(true);

      // Mark all remaining unread for usr-1 -> only ntf-2 transitions (count = 1)
      const count = await notificationRepo.markAllAsRead('usr-1');
      expect(count).toBe(1);
      expect(await notificationRepo.markAllAsRead('usr-1')).toBe(0);

      // usr-2 remains unread
      expect((await notificationRepo.getByUserId('usr-2'))[0]?.read).toBe(false);
    });

    it('deletes individual notifications scoped to userId', async () => {
      await notificationRepo.save({
        id: 'ntf-1',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Alerta 1',
        read: false,
        createdAt: '2026-11-18T09:00:00.000Z',
      });
      await notificationRepo.save({
        id: 'ntf-other',
        userId: 'usr-2',
        eventType: 'due_date',
        content: 'Alerta 2',
        read: false,
        createdAt: '2026-11-18T09:00:00.000Z',
      });

      expect(await notificationRepo.delete('usr-1', 'ntf-other')).toBe(false);
      expect(await notificationRepo.delete('usr-1', 'non-existent')).toBe(false);
      expect(await notificationRepo.delete('usr-1', 'ntf-1')).toBe(true);

      expect(await notificationRepo.getByUserId('usr-1')).toEqual([]);
      expect(await notificationRepo.getByUserId('usr-2')).toHaveLength(1);
    });

    it('prunes notifications >= 30 days old for the target user while keeping < 30 days and other users', async () => {
      const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
      const retentionMs = LIMITS.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      const justUnder30d = new Date(nowMs - retentionMs + 1).toISOString();
      const exact30d = new Date(nowMs - retentionMs).toISOString();
      const over30d = new Date(nowMs - retentionMs - 86_400_000).toISOString();

      await notificationRepo.save({
        id: 'ntf-keep',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Reciente (< 30 días)',
        read: false,
        createdAt: justUnder30d,
      });
      await notificationRepo.save({
        id: 'ntf-exact-30d',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Exactamente 30 días',
        read: true,
        createdAt: exact30d,
      });
      await notificationRepo.save({
        id: 'ntf-over-30d',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'Más de 30 días',
        read: false,
        createdAt: over30d,
      });
      await notificationRepo.save({
        id: 'ntf-other-old',
        userId: 'usr-2',
        eventType: 'due_date',
        content: 'Antigua de otro usuario',
        read: false,
        createdAt: over30d,
      });

      const prunedCount = await notificationRepo.pruneExpired(
        'usr-1',
        new Date(nowMs).toISOString(),
      );
      expect(prunedCount).toBe(2);

      const remainingUser1 = await notificationRepo.getByUserId('usr-1');
      expect(remainingUser1.map((n) => n.id)).toEqual(['ntf-keep']);

      // usr-2's old notification was not touched by usr-1's prune
      const remainingUser2 = await notificationRepo.getByUserId('usr-2');
      expect(remainingUser2.map((n) => n.id)).toEqual(['ntf-other-old']);
    });
  });

  describe('LocalStorageNotificationStateRepository (RF-27, RF-28, RNF-07, RNF-10)', () => {
    it('returns clean default state when user has no persisted notification state', async () => {
      const state = await stateRepo.getByUserId('usr-new');
      expect(state).toEqual({
        userId: 'usr-new',
        permissionPromptLastShownAt: null,
        handledOccurrences: [],
      });
    });

    it('persists, updates, isolates by userId, and deletes state under STORAGE_KEYS.NOTIFICATION_STATE', async () => {
      const state1: UserNotificationState = {
        userId: 'usr-1',
        permissionPromptLastShownAt: '2026-11-18T08:00:00.000Z',
        handledOccurrences: [
          {
            taskId: 'task-1',
            occurrenceKey: '2026-11-18|date-only',
            status: 'notified',
            recordedAt: '2026-11-18T14:00:00.000Z',
          },
        ],
      };
      const state2: UserNotificationState = {
        userId: 'usr-2',
        permissionPromptLastShownAt: null,
        handledOccurrences: [
          {
            taskId: 'task-9',
            occurrenceKey: '2026-11-01|10:00',
            status: 'suppressed',
            recordedAt: '2026-11-18T10:00:00.000Z',
          },
        ],
      };

      await stateRepo.save(state1);
      await stateRepo.save(state2);

      expect(localStorage.getItem(STORAGE_KEYS.NOTIFICATION_STATE)).toBeTruthy();
      expect(await stateRepo.getByUserId('usr-1')).toEqual(state1);
      expect(await stateRepo.getByUserId('usr-2')).toEqual(state2);

      // Update usr-1 state
      const updatedState1: UserNotificationState = {
        ...state1,
        permissionPromptLastShownAt: '2026-11-18T16:30:00.000Z',
      };
      await stateRepo.save(updatedState1);
      expect(await stateRepo.getByUserId('usr-1')).toEqual(updatedState1);
      expect(await stateRepo.getByUserId('usr-2')).toEqual(state2);

      // Delete usr-1 state on account deletion
      await stateRepo.deleteByUserId('usr-1');
      expect(await stateRepo.getByUserId('usr-1')).toEqual({
        userId: 'usr-1',
        permissionPromptLastShownAt: null,
        handledOccurrences: [],
      });
      expect(await stateRepo.getByUserId('usr-2')).toEqual(state2);
    });

    it('rejects malformed notification state payloads with ValidationError', async () => {
      await expect(
        stateRepo.save({
          userId: '',
          permissionPromptLastShownAt: 'invalid-date',
          handledOccurrences: [],
        }),
      ).rejects.toThrow(ValidationError);
    });
  });
});
