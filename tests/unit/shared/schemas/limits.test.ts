import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  FORBIDDEN_TAG_CHARACTERS,
  REMINDER_OFFSETS,
  GROUP_ROLES,
  rawPasswordSchema,
  userSchema,
  localUserSchema,
  isoDateTimeSchema,
  recoveryCodeSchema,
  sessionSchema,
  loginLockoutSchema,
  groupSchema,
  groupMemberSchema,
  SEED_PERSONAL_GROUP,
  taskSchema,
  subtaskSchema,
  reminderSchema,
  tagSchema,
  tagNameSchema,
  notificationSchema,
  handledDueOccurrenceStatusSchema,
  handledDueOccurrenceSchema,
  userNotificationStateSchema,
  invitationSchema,
  type HandledDueOccurrence,
  type UserNotificationState,
  type User,
  type Group,
  type Task,
  type Tag,
  type Subtask,
  type Reminder,
  type Notification,
  type Session,
  type LoginLockoutState,
  type RecoveryCode,
  type Invitation,
} from '@/shared/schemas';
import { es } from '@/shared/i18n';
import { STORAGE_KEYS } from '@/data/storage';

describe('Appendix B Canonical Limits and Schemas', () => {
  describe('LIMITS numeric constants', () => {
    it('should match exact Appendix B numerical specifications', () => {
      expect(LIMITS.TASK_TITLE_MIN).toBe(2);
      expect(LIMITS.TASK_TITLE_MAX).toBe(100);
      expect(LIMITS.TASK_DESCRIPTION_MAX).toBe(750);
      expect(LIMITS.TASK_DESC_MAX).toBe(750);
      expect(LIMITS.SUBTASK_TITLE_MIN).toBe(1);
      expect(LIMITS.SUBTASK_TITLE_MAX).toBe(50);
      expect(LIMITS.SUBTASKS_MAX_COUNT).toBe(25);
      expect(LIMITS.SUBTASKS_MAX_PER_TASK).toBe(25);
      expect(LIMITS.TAG_NAME_MIN).toBe(1);
      expect(LIMITS.TAG_NAME_MAX).toBe(30);
      expect(LIMITS.GROUP_NAME_MIN).toBe(3);
      expect(LIMITS.GROUP_NAME_MAX).toBe(30);
      expect(LIMITS.USERNAME_MIN).toBe(3);
      expect(LIMITS.USERNAME_MAX).toBe(30);
      expect(LIMITS.DISPLAY_NAME_MIN).toBe(2);
      expect(LIMITS.DISPLAY_NAME_MAX).toBe(50);
      expect(LIMITS.PASSWORD_MIN).toBe(6);
      expect(LIMITS.PASSWORD_MAX).toBe(30);
      expect(LIMITS.USER_EMAIL_MAX).toBe(254);
      expect(LIMITS.GROUP_MEMBERS_MAX).toBe(5);
      expect(LIMITS.REMINDERS_MAX_COUNT).toBe(5);
      expect(LIMITS.REMINDERS_MAX_PER_TASK).toBe(5);
      expect(LIMITS.RECOVERY_CODES_COUNT).toBe(8);
      expect(LIMITS.RECOVERY_CODE_LENGTH).toBe(8);
      expect(LIMITS.SESSION_DURATION_DAYS).toBe(7);
      expect(LIMITS.INVITATION_EXPIRATION_HOURS).toBe(24);
      expect(LIMITS.NOTIFICATION_RETENTION_DAYS).toBe(30);
      expect(LIMITS.API_EMAIL_MAX).toBe(255);
      expect(LIMITS.KEYSET_PAGE_LIMIT_DEFAULT).toBe(20);
      expect(LIMITS.KEYSET_PAGE_LIMIT_MAX).toBe(50);

      expect(FORBIDDEN_TAG_CHARACTERS).toEqual([';', ',']);
      expect(REMINDER_OFFSETS).toEqual(['15m', '30m', '1h', '6h', '1d']);
      expect(GROUP_ROLES).toEqual(['creator', 'gestor', 'visitante']);
    });

    it('should validate ISO-8601 timestamps with up to 9 fractional digits and timezone offsets', () => {
      expect(isoDateTimeSchema.safeParse('2026-11-02T12:00:00Z').success).toBe(true);
      expect(isoDateTimeSchema.safeParse('2026-11-02T12:00:00.123Z').success).toBe(true);
      expect(isoDateTimeSchema.safeParse('2026-11-02T12:00:00.123456789Z').success).toBe(true);
      expect(isoDateTimeSchema.safeParse('2026-11-02T12:00:00+02:00').success).toBe(true);
      expect(isoDateTimeSchema.safeParse('2026-11-02T12:00:00.123456-05:00').success).toBe(true);
      expect(isoDateTimeSchema.safeParse('2026-11-02 12:00:00Z').success).toBe(false);
    });
  });

  describe('Tag validation (RF-22)', () => {
    it('should accept valid tag names within boundaries', () => {
      expect(tagNameSchema.parse('a')).toBe('a');
      expect(tagNameSchema.parse('a'.repeat(30))).toBe('a'.repeat(30));
    });

    it('should trim whitespace around tag name', () => {
      expect(tagNameSchema.parse('  estudio  ')).toBe('estudio');
    });

    it('should reject tag names outside boundaries', () => {
      const minRes = tagNameSchema.safeParse('');
      expect(minRes.success).toBe(false);

      const maxRes = tagNameSchema.safeParse('a'.repeat(31));
      expect(maxRes.success).toBe(false);
      if (!maxRes.success) {
        expect(maxRes.error.issues[0].message).toBe(
          es.validation.maxLength('El nombre de la etiqueta', 30),
        );
      }
    });

    it('should strictly reject tags containing semicolon or comma', () => {
      const semiRes = tagNameSchema.safeParse('tag;uno');
      expect(semiRes.success).toBe(false);

      const commaRes = tagNameSchema.safeParse('tag,dos');
      expect(commaRes.success).toBe(false);
    });

    it('should validate complete Tag entity', () => {
      const tag: Tag = {
        id: 'tag-1',
        name: 'urgente',
        groupId: 'grp-1',
      };
      const result = tagSchema.safeParse(tag);
      expect(result.success).toBe(true);
    });
  });

  describe('User and Auth validation (RNF-05, AC-FD-03)', () => {
    it('should validate rawPasswordSchema boundaries (6..30 chars)', () => {
      expect(rawPasswordSchema.safeParse('12345').success).toBe(false);
      expect(rawPasswordSchema.safeParse('123456').success).toBe(true);
      expect(rawPasswordSchema.safeParse('a'.repeat(30)).success).toBe(true);
      expect(rawPasswordSchema.safeParse('a'.repeat(31)).success).toBe(false);
    });

    it('should validate email format and max length', () => {
      const validUser: User = {
        id: 'usr-1',
        email: 'user@example.com',
        username: 'user123',
        displayName: 'User Name',
        passwordHash: 'hashed_password_string',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      const valid = userSchema.safeParse(validUser);
      expect(valid.success).toBe(true);

      const invalidEmail = userSchema.safeParse({
        id: 'usr-1',
        email: 'not-an-email',
        username: 'user123',
        displayName: 'User Name',
        passwordHash: 'hashed_password_string',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        createdAt: '2026-11-02T12:00:00.000Z',
      });
      expect(invalidEmail.success).toBe(false);
    });

    it('should enforce alphanumeric username and reject spaces or symbols', () => {
      const valid = userSchema.safeParse({
        id: 'usr-1',
        email: 'user@example.com',
        username: 'validUser123',
        displayName: 'User Name',
        passwordHash: 'hash',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        createdAt: '2026-11-02T12:00:00.000Z',
      });
      expect(valid.success).toBe(true);

      const withSpaces = userSchema.safeParse({
        id: 'usr-1',
        email: 'user@example.com',
        username: 'user name',
        displayName: 'User Name',
        passwordHash: 'hash',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        createdAt: '2026-11-02T12:00:00.000Z',
      });
      expect(withSpaces.success).toBe(false);
    });

    it('should allow optional passwordHash and remainingRecoveryCodes on userSchema while localUserSchema requires passwordHash and both reject plaintext password', () => {
      const apiUser = {
        id: 'usr-1',
        email: `${'a'.repeat(243)}@example.com`,
        username: 'validUser123',
        displayName: 'User Name',
        timeZone: 'America/Bogota',
        timeFormat: '24h' as const,
        remainingRecoveryCodes: 8,
        createdAt: '2026-11-02T12:00:00.123456789Z',
      };
      expect(apiUser.email.length).toBe(255);
      expect(userSchema.safeParse(apiUser).success).toBe(true);
      expect(localUserSchema.safeParse(apiUser).success).toBe(false);

      expect(
        userSchema.safeParse({ ...apiUser, remainingRecoveryCodes: -1 }).success,
      ).toBe(false);
      expect(
        userSchema.safeParse({ ...apiUser, remainingRecoveryCodes: 9 }).success,
      ).toBe(false);

      const withPlaintext = userSchema.safeParse({
        id: 'usr-1',
        email: 'user@example.com',
        username: 'validUser123',
        displayName: 'User Name',
        password: 'plaintext_password_here',
        passwordHash: 'hash',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        createdAt: '2026-11-02T12:00:00.000Z',
      });
      expect(withPlaintext.success).toBe(false);

      const localWithPlaintext = localUserSchema.safeParse({
        id: 'usr-1',
        email: 'user@example.com',
        username: 'validUser123',
        displayName: 'User Name',
        password: 'plaintext_password_here',
        passwordHash: 'hash',
        timeZone: 'America/Bogota',
        timeFormat: '24h',
        createdAt: '2026-11-02T12:00:00.000Z',
      });
      expect(localWithPlaintext.success).toBe(false);
    });

    it('should validate RecoveryCode schema with 8-character token', () => {
      const code: RecoveryCode = {
        id: 'rc-1',
        userId: 'usr-1',
        code: 'A1B2C3D4',
        used: false,
      };
      expect(recoveryCodeSchema.safeParse(code).success).toBe(true);

      expect(recoveryCodeSchema.safeParse({ ...code, code: '123' }).success).toBe(false);
    });

    it('should validate Session schema', () => {
      const session: Session = {
        userId: 'usr-1',
        token: 'token-xyz',
        expiresAt: '2026-11-09T12:00:00.000Z',
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      expect(sessionSchema.safeParse(session).success).toBe(true);
    });

    it('should validate LoginLockoutState schema and enforce 0..5 attempt bounds (RNF-06)', () => {
      const validUnlocked: LoginLockoutState = {
        normalizedEmail: 'user@example.com',
        failedAttempts: 3,
        lockedUntil: null,
      };
      expect(loginLockoutSchema.safeParse(validUnlocked).success).toBe(true);

      const validLocked: LoginLockoutState = {
        normalizedEmail: 'USER@EXAMPLE.COM',
        failedAttempts: 5,
        lockedUntil: '2026-11-15T12:05:00.000Z',
      };
      const parsedLocked = loginLockoutSchema.parse(validLocked);
      expect(parsedLocked.normalizedEmail).toBe('user@example.com');

      expect(
        loginLockoutSchema.safeParse({ ...validUnlocked, failedAttempts: -1 }).success,
      ).toBe(false);
      expect(
        loginLockoutSchema.safeParse({ ...validUnlocked, failedAttempts: 6 }).success,
      ).toBe(false);
      expect(
        loginLockoutSchema.safeParse({ ...validUnlocked, normalizedEmail: 'not-an-email' }).success,
      ).toBe(false);
      expect(
        loginLockoutSchema.safeParse({ ...validUnlocked, lockedUntil: 'invalid-date' }).success,
      ).toBe(false);
    });

    it('should expose WebCrypto subtle in Vitest jsdom environment', () => {
      expect(typeof globalThis.crypto?.subtle?.importKey).toBe('function');
    });
  });

  describe('Group validation (RNF-20)', () => {
    it('should enforce creatorId, isPersonal, type, and members array (1..5)', () => {
      const group: Group = {
        id: 'grp-1',
        name: 'Personal',
        creatorId: 'usr-1',
        isPersonal: true,
        type: 'individual',
        members: [{ userId: 'usr-1', role: 'creator', joinedAt: '2026-11-02T12:00:00.000Z' }],
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      expect(groupSchema.safeParse(group).success).toBe(true);
    });

    it('should reject groups with empty name (< 3 chars) or > 30 chars', () => {
      const base = {
        id: 'grp-1',
        creatorId: 'usr-1',
        isPersonal: false,
        type: 'individual' as const,
        members: [{ userId: 'usr-1', role: 'creator' as const, joinedAt: '2026-11-02T12:00:00.000Z' }],
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      expect(groupSchema.safeParse({ ...base, name: 'ab' }).success).toBe(false);
      expect(groupSchema.safeParse({ ...base, name: 'a'.repeat(31) }).success).toBe(false);
    });

    it('should reject groups exceeding maximum 5 members', () => {
      const members = Array.from({ length: 6 }, (_, i) => ({
        userId: `usr-${i}`,
        role: 'visitante' as const,
        joinedAt: '2026-11-02T12:00:00.000Z',
      }));
      const group = {
        id: 'grp-1',
        name: 'Trabajo',
        creatorId: 'usr-0',
        isPersonal: false,
        type: 'compartido' as const,
        members,
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      expect(groupSchema.safeParse(group).success).toBe(false);
    });

    it('should validate individual GroupMember schema', () => {
      expect(
        groupMemberSchema.safeParse({
          userId: 'usr-1',
          role: 'gestor',
          joinedAt: '2026-11-02T12:00:00.000Z',
        }).success,
      ).toBe(true);
    });

    it('should validate canonical SEED_PERSONAL_GROUP constant', () => {
      const result = groupSchema.safeParse(SEED_PERSONAL_GROUP);
      expect(result.success).toBe(true);
      expect(SEED_PERSONAL_GROUP.id).toBe('group-personal');
      expect(SEED_PERSONAL_GROUP.name).toBe('Personal');
      expect(SEED_PERSONAL_GROUP.isPersonal).toBe(true);
      expect(SEED_PERSONAL_GROUP.type).toBe('individual');
      expect(SEED_PERSONAL_GROUP.creatorId).toBe('local-user');
      expect(SEED_PERSONAL_GROUP.members).toHaveLength(1);
      expect(SEED_PERSONAL_GROUP.members[0].role).toBe('creator');
    });
  });

  describe('Task and Subtask validation (RNF-20)', () => {
    it('should validate minimal valid Task', () => {
      const task: Task = {
        id: 'tsk-1',
        title: 'Estudiar para examen',
        groupId: 'grp-1',
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      expect(taskSchema.safeParse(task).success).toBe(true);
    });

    it('should validate Task with tagIds array', () => {
      const task: Task = {
        id: 'tsk-tags',
        title: 'Tarea con etiquetas',
        groupId: 'grp-1',
        tagIds: ['tag-1', 'tag-2'],
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      const result = taskSchema.safeParse(task);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tagIds).toEqual(['tag-1', 'tag-2']);
      }
    });

    it('should validate complete Task with dates, assigneeId, subtasks, and reminders', () => {
      const subtask: Subtask = {
        id: 'sub-1',
        taskId: 'tsk-1',
        title: 'Capítulo 1',
        completed: true,
      };
      const reminder: Reminder = {
        id: 'rem-1',
        taskId: 'tsk-1',
        offset: '1h',
      };
      const task: Task = {
        id: 'tsk-1',
        title: 'Estudiar para examen',
        description: 'Capítulos 1 al 5 del libro guía',
        groupId: 'grp-1',
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
        dueDate: '2026-11-15',
        dueTime: '14:30',
        assigneeId: null,
        overdue: true,
        subtasks: [subtask],
        reminders: [reminder],
      };
      expect(taskSchema.safeParse(task).success).toBe(true);
    });

    it('should validate dueDate format (YYYY-MM-DD) and dueTime format (HH:mm)', () => {
      const base = {
        id: 'tsk-1',
        title: 'Tarea válida',
        groupId: 'grp-1',
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
      };

      expect(taskSchema.safeParse({ ...base, dueDate: '2026/11/15' }).success).toBe(false);
      expect(taskSchema.safeParse({ ...base, dueDate: '15-11-2026' }).success).toBe(false);
      expect(taskSchema.safeParse({ ...base, dueDate: '2026-11-15' }).success).toBe(true);

      expect(taskSchema.safeParse({ ...base, dueTime: '25:00' }).success).toBe(false);
      expect(taskSchema.safeParse({ ...base, dueTime: '14:60' }).success).toBe(false);
      expect(taskSchema.safeParse({ ...base, dueTime: '09:30' }).success).toBe(true);
    });

    it('should enforce subtasks max capacity (25) and title length (1..50)', () => {
      expect(
        subtaskSchema.safeParse({ id: 's-1', taskId: 't-1', title: '', completed: false }).success,
      ).toBe(false);
      expect(
        subtaskSchema.safeParse({ id: 's-1', taskId: 't-1', title: 'a'.repeat(51), completed: false })
          .success,
      ).toBe(false);

      const subtasks = Array.from({ length: 26 }, (_, i) => ({
        id: `s-${i}`,
        taskId: 't-1',
        title: `Subtask ${i}`,
        completed: false,
      }));
      const task = {
        id: 'tsk-1',
        title: 'Tarea con demasiadas subtareas',
        groupId: 'grp-1',
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
        subtasks,
      };
      expect(taskSchema.safeParse(task).success).toBe(false);
    });

    it('should enforce reminders max capacity (5) and allowed offsets', () => {
      expect(
        reminderSchema.safeParse({ id: 'r-1', taskId: 't-1', offset: '2h' }).success,
      ).toBe(false);
      expect(
        reminderSchema.safeParse({ id: 'r-1', taskId: 't-1', offset: '30m' }).success,
      ).toBe(true);

      const reminders = Array.from({ length: 6 }, (_, i) => ({
        id: `r-${i}`,
        taskId: 't-1',
        offset: '15m' as const,
      }));
      const task = {
        id: 'tsk-1',
        title: 'Tarea con demasiados recordatorios',
        groupId: 'grp-1',
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
        reminders,
      };
      expect(taskSchema.safeParse(task).success).toBe(false);
    });
  });

  describe('Notification and Invitation validation', () => {
    it('should validate Notification schema', () => {
      const notif: Notification = {
        id: 'ntf-1',
        userId: 'usr-1',
        eventType: 'due_date',
        content: 'La tarea vence pronto',
        read: false,
        createdAt: '2026-11-02T12:00:00.000Z',
      };
      expect(notificationSchema.safeParse(notif).success).toBe(true);
    });

    it('should keep 30-day notification retention limit (RF-29, Appendix B)', () => {
      expect(LIMITS.NOTIFICATION_RETENTION_DAYS).toBe(30);
    });

    it('should expose additive versioned notification state storage key (RNF-19)', () => {
      expect(STORAGE_KEYS.NOTIFICATION_STATE).toBe('tbt:v1:notification_state');
      expect(STORAGE_KEYS.NOTIFICATIONS).toBe('tbt:v1:notifications');
    });

    it('should validate handled due occurrence records (RF-28 deduplication)', () => {
      expect(handledDueOccurrenceStatusSchema.safeParse('notified').success).toBe(true);
      expect(handledDueOccurrenceStatusSchema.safeParse('suppressed').success).toBe(true);
      expect(handledDueOccurrenceStatusSchema.safeParse('pending').success).toBe(false);

      const occurrence: HandledDueOccurrence = {
        taskId: 'task-1',
        occurrenceKey: '2026-12-25|14:30',
        status: 'notified',
        recordedAt: '2026-12-25T19:30:00.000Z',
      };
      expect(handledDueOccurrenceSchema.safeParse(occurrence).success).toBe(true);

      expect(
        handledDueOccurrenceSchema.safeParse({ ...occurrence, occurrenceKey: '' }).success,
      ).toBe(false);
      expect(handledDueOccurrenceSchema.safeParse({ ...occurrence, taskId: '' }).success).toBe(
        false,
      );
      expect(
        handledDueOccurrenceSchema.safeParse({ ...occurrence, status: 'fired' }).success,
      ).toBe(false);
      expect(
        handledDueOccurrenceSchema.safeParse({ ...occurrence, recordedAt: 'not-a-date' }).success,
      ).toBe(false);
    });

    it('should validate per-user notification state with defaults (RF-27 cooldown, RF-28 dedup)', () => {
      const parsedMinimal = userNotificationStateSchema.safeParse({ userId: 'usr-1' });
      expect(parsedMinimal.success).toBe(true);
      if (parsedMinimal.success) {
        expect(parsedMinimal.data).toEqual({
          userId: 'usr-1',
          permissionPromptLastShownAt: null,
          handledOccurrences: [],
        });
      }

      const fullState: UserNotificationState = {
        userId: 'usr-1',
        permissionPromptLastShownAt: '2026-11-18T10:00:00.000Z',
        handledOccurrences: [
          {
            taskId: 'task-1',
            occurrenceKey: '2026-12-25|date-only',
            status: 'suppressed',
            recordedAt: '2026-11-18T10:00:00.000Z',
          },
        ],
      };
      expect(userNotificationStateSchema.safeParse(fullState).success).toBe(true);

      expect(userNotificationStateSchema.safeParse({ userId: '' }).success).toBe(false);
      expect(
        userNotificationStateSchema.safeParse({
          ...fullState,
          permissionPromptLastShownAt: 'yesterday',
        }).success,
      ).toBe(false);
      expect(
        userNotificationStateSchema.safeParse({
          ...fullState,
          handledOccurrences: [{ taskId: 'task-1' }],
        }).success,
      ).toBe(false);
    });

    it('should validate Invitation schema', () => {
      const inv: Invitation = {
        id: 'inv-1',
        groupId: 'grp-1',
        invitedEmailOrUsername: 'peer@example.com',
        role: 'gestor',
        status: 'pending',
        createdAt: '2026-11-02T12:00:00.000Z',
        expiresAt: '2026-11-03T12:00:00.000Z',
      };
      expect(invitationSchema.safeParse(inv).success).toBe(true);
    });
  });
});
