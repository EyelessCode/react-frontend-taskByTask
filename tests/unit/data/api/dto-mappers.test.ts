import { describe, expect, it } from 'vitest';
import {
  createKeysetPageSchema,
  groupResponseDtoSchema,
  markAllReadResponseDtoSchema,
  messageResponseDtoSchema,
  notificationResponseDtoSchema,
  pushSubscriptionResponseDtoSchema,
  recoveryCodesResponseDtoSchema,
  registerResponseDtoSchema,
  tagResponseDtoSchema,
  taskResponseDtoSchema,
  unreadCountResponseDtoSchema,
  userResponseDtoSchema,
  vapidPublicKeyResponseDtoSchema,
} from '@/data/api/dto-schemas';
import {
  mapGroupFromDto,
  mapNotificationFromDto,
  mapTagFromDto,
  mapTaskFilterToApiStatus,
  mapTaskFromDto,
  mapTaskWithTagsFromDto,
  mapTimeFormatFromDto,
  mapTimeFormatToDto,
  mapUserFromDto,
  normalizeBackendDueTime,
  parseNumericId,
} from '@/data/api/dto-mappers';
import { ValidationError } from '@/shared/errors';

describe('OpenAPI DTO Schemas & Domain Mappers (T3)', () => {
  describe('parseNumericId', () => {
    it('parses valid positive integer string IDs', () => {
      expect(parseNumericId('1')).toBe(1);
      expect(parseNumericId(' 42 ')).toBe(42);
      expect(parseNumericId('9007199254740991')).toBe(9007199254740991);
    });

    it('rejects empty, non-numeric, negative, zero, decimal, and unsafe integer IDs', () => {
      for (const bad of ['', '   ', '0', '-5', '1.5', 'abc', '42abc', '9007199254740993']) {
        expect(() => parseNumericId(bad, 'tarea')).toThrow(ValidationError);
      }
    });
  });

  describe('UserResponse schema & mapper', () => {
    it('validates UserResponse including 255-char email, nanosecond timestamps, and remainingRecoveryCodes', () => {
      const longEmail = `${'a'.repeat(243)}@example.com`;
      expect(longEmail.length).toBe(255);

      const dto = userResponseDtoSchema.parse({
        id: 7,
        email: longEmail,
        username: 'AnaDev2026',
        displayName: 'Ana García',
        timezone: 'America/Lima',
        timeFormat: '12H',
        createdAt: '2026-11-20T14:30:00.123456789Z',
        remainingRecoveryCodes: 6,
      });

      const user = mapUserFromDto(dto);
      expect(user).toEqual({
        id: '7',
        email: longEmail,
        username: 'AnaDev2026',
        displayName: 'Ana García',
        timeZone: 'America/Lima',
        timeFormat: '12h',
        remainingRecoveryCodes: 6,
        createdAt: '2026-11-20T14:30:00.123456789Z',
      });
      expect(user.passwordHash).toBeUndefined();
    });

    it('maps timeFormat bidirectionally between domain and DTO', () => {
      expect(mapTimeFormatFromDto('24H')).toBe('24h');
      expect(mapTimeFormatFromDto('12H')).toBe('12h');
      expect(mapTimeFormatToDto('24h')).toBe('24H');
      expect(mapTimeFormatToDto('12h')).toBe('12H');
    });

    it('rejects malformed UserResponse payloads', () => {
      expect(
        userResponseDtoSchema.safeParse({
          id: 0,
          email: 'bad-email',
          username: 'a',
          displayName: 'A',
          timezone: '',
          timeFormat: '10H',
          createdAt: 'invalid',
        }).success,
      ).toBe(false);
    });
  });

  describe('Auth response DTO schemas', () => {
    it('validates RegisterResponse, RecoveryCodesResponse, and MessageResponse', () => {
      const register = registerResponseDtoSchema.parse({
        user: {
          id: 1,
          email: 'ana@example.com',
          username: 'Ana123',
          displayName: 'Ana García',
          timezone: 'UTC',
          timeFormat: '24H',
          createdAt: '2026-11-20T10:00:00Z',
          remainingRecoveryCodes: 8,
        },
        recoveryCodes: ['A1B2-C3D4', 'E5F6-G7H8'],
        recoveryCodesNotice: 'Guarda estos códigos en un lugar seguro.',
      });
      expect(register.recoveryCodes).toHaveLength(2);

      expect(
        recoveryCodesResponseDtoSchema.parse({
          recoveryCodes: ['1111-2222'],
          recoveryCodesNotice: 'Aviso',
        }).recoveryCodes,
      ).toEqual(['1111-2222']);

      expect(messageResponseDtoSchema.parse({ message: 'Listo' }).message).toBe('Listo');
    });
  });

  describe('GroupResponse schema & RNF-20 mapper', () => {
    it('maps GroupResponse to individual Group with single creator member', () => {
      const dto = groupResponseDtoSchema.parse({
        id: 1,
        name: 'Personal',
        isPersonal: true,
        creatorId: 10,
        createdAt: '2026-11-20T09:00:00.123Z',
        updatedAt: '2026-11-20T09:00:00.123Z',
      });

      expect(mapGroupFromDto(dto)).toEqual({
        id: '1',
        name: 'Personal',
        creatorId: '10',
        isPersonal: true,
        type: 'individual',
        members: [
          {
            userId: '10',
            role: 'creator',
            joinedAt: '2026-11-20T09:00:00.123Z',
          },
        ],
        createdAt: '2026-11-20T09:00:00.123Z',
      });
    });

    it('rejects GroupResponse with invalid name length or non-positive IDs', () => {
      expect(
        groupResponseDtoSchema.safeParse({
          id: -1,
          name: 'ab',
          isPersonal: false,
          creatorId: 1,
          createdAt: '2026-11-20T09:00:00Z',
        }).success,
      ).toBe(false);
    });
  });

  describe('TagResponse & TaskResponse schemas & mappers', () => {
    it('maps TagResponse to domain Tag', () => {
      const dto = tagResponseDtoSchema.parse({
        id: 10,
        groupId: 2,
        name: 'urgente',
        createdAt: '2026-11-20T09:00:00Z',
      });
      expect(mapTagFromDto(dto)).toEqual({
        id: '10',
        groupId: '2',
        name: 'urgente',
      });
    });

    it('normalizes HH:mm:ss and HH:mm dueTime values', () => {
      expect(normalizeBackendDueTime('14:30:00')).toBe('14:30');
      expect(normalizeBackendDueTime('09:05')).toBe('09:05');
      expect(normalizeBackendDueTime(null)).toBeNull();
      expect(normalizeBackendDueTime(undefined)).toBeNull();
    });

    it('maps TaskResponse with assignedUserId, overdue, HH:mm:ss dueTime, and embedded tags', () => {
      const dto = taskResponseDtoSchema.parse({
        id: 42,
        groupId: 1,
        assignedUserId: 99,
        title: 'Entregar reporte mensual',
        description: null,
        completed: false,
        completedAt: null,
        overdue: true,
        dueDate: '2026-11-18',
        dueTime: '14:30:00',
        tags: [
          { id: 10, groupId: 1, name: 'urgente', createdAt: '2026-11-18T10:00:00Z' },
          { id: 11, groupId: 1, name: 'trabajo' },
        ],
        createdAt: '2026-11-18T08:00:00.500Z',
        updatedAt: '2026-11-18T08:00:00.500Z',
      });

      const task = mapTaskFromDto(dto);
      expect(task).toEqual({
        id: '42',
        groupId: '1',
        assigneeId: '99',
        title: 'Entregar reporte mensual',
        description: null,
        completed: false,
        completedAt: null,
        overdue: true,
        dueDate: '2026-11-18',
        dueTime: '14:30',
        tagIds: ['10', '11'],
        createdAt: '2026-11-18T08:00:00.500Z',
      });

      const withTags = mapTaskWithTagsFromDto(dto);
      expect(withTags.task).toEqual(task);
      expect(withTags.tags).toEqual([
        { id: '10', groupId: '1', name: 'urgente' },
        { id: '11', groupId: '1', name: 'trabajo' },
      ]);
    });

    it('maps TaskFilter values to ApiTaskStatus', () => {
      expect(mapTaskFilterToApiStatus('pendientes')).toBe('PENDING');
      expect(mapTaskFilterToApiStatus('completadas')).toBe('COMPLETED');
      expect(mapTaskFilterToApiStatus('todas')).toBe('ALL');
    });

    it('rejects malformed TaskResponse dueTime or missing required fields', () => {
      expect(
        taskResponseDtoSchema.safeParse({
          id: 1,
          groupId: 1,
          title: 'X',
          completed: false,
          overdue: false,
          dueTime: '25:99:00',
          createdAt: '2026-11-20T09:00:00Z',
        }).success,
      ).toBe(false);
    });
  });

  describe('Notification, KeysetPage & Web Push DTO schemas & mappers', () => {
    it('accepts any non-empty eventType on NotificationResponse (RNF-20) and maps with userId', () => {
      const dto = notificationResponseDtoSchema.parse({
        id: 12,
        eventType: 'FUTURE_COLLAB_INVITATION',
        content: 'Tienes una nueva alerta.',
        read: false,
        createdAt: '2026-11-20T12:00:00.123456Z',
      });

      expect(mapNotificationFromDto(dto, '7')).toEqual({
        id: '12',
        userId: '7',
        eventType: 'FUTURE_COLLAB_INVITATION',
        content: 'Tienes una nueva alerta.',
        read: false,
        createdAt: '2026-11-20T12:00:00.123456Z',
      });

      expect(
        notificationResponseDtoSchema.safeParse({
          id: 12,
          eventType: '   ',
          content: 'Algo',
          read: false,
          createdAt: '2026-11-20T12:00:00Z',
        }).success,
      ).toBe(false);
    });

    it('validates KeysetPage<T>, UnreadCountResponse, MarkAllReadResponse, VapidPublicKeyResponse, and PushSubscriptionResponse', () => {
      const pageSchema = createKeysetPageSchema(groupResponseDtoSchema);
      const page = pageSchema.parse({
        content: [
          {
            id: 1,
            name: 'Personal',
            isPersonal: true,
            creatorId: 1,
            createdAt: '2026-11-20T09:00:00Z',
          },
        ],
        nextCursor: 'cursor_abc',
        hasNext: true,
        size: 1,
      });
      expect(page.hasNext).toBe(true);
      expect(page.nextCursor).toBe('cursor_abc');

      expect(unreadCountResponseDtoSchema.parse({ unreadCount: 3 }).unreadCount).toBe(3);
      expect(markAllReadResponseDtoSchema.parse({ updatedCount: 4 }).updatedCount).toBe(4);
      expect(
        vapidPublicKeyResponseDtoSchema.parse({ enabled: false, publicKey: null }),
      ).toEqual({ enabled: false, publicKey: null });
      expect(
        vapidPublicKeyResponseDtoSchema.parse({ enabled: true, publicKey: 'BEl62iUYg...' }),
      ).toEqual({ enabled: true, publicKey: 'BEl62iUYg...' });
      expect(
        pushSubscriptionResponseDtoSchema.parse({
          id: 5,
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
          createdAt: '2026-11-20T09:00:00Z',
        }).id,
      ).toBe(5);
    });
  });
});
