import { z } from 'zod';
import {
  dueDateSchema,
  isoDateTimeSchema,
  LIMITS,
  tagNameSchema,
} from '../../shared/schemas';

export const numericIdDtoSchema = z
  .number()
  .int()
  .positive()
  .refine((value) => Number.isSafeInteger(value), {
    message: 'El identificador numérico debe ser un entero seguro positivo.',
  });

export const apiTimeFormatDtoSchema = z.enum(['24H', '12H']);

export const backendDueTimeDtoSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'El formato de hora debe ser HH:mm o HH:mm:ss',
  });

export const userResponseDtoSchema = z.object({
  id: numericIdDtoSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(LIMITS.API_EMAIL_MAX)
    .email(),
  username: z
    .string()
    .trim()
    .min(LIMITS.USERNAME_MIN)
    .max(LIMITS.USERNAME_MAX)
    .regex(/^[A-Za-z0-9]+$/),
  displayName: z
    .string()
    .trim()
    .min(LIMITS.DISPLAY_NAME_MIN)
    .max(LIMITS.DISPLAY_NAME_MAX),
  timezone: z.string().trim().min(1),
  timeFormat: apiTimeFormatDtoSchema,
  createdAt: isoDateTimeSchema,
  remainingRecoveryCodes: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.RECOVERY_CODES_COUNT)
    .optional(),
});

export type UserResponseDto = z.infer<typeof userResponseDtoSchema>;

export const registerResponseDtoSchema = z.object({
  user: userResponseDtoSchema,
  recoveryCodes: z.array(z.string().min(1)),
  recoveryCodesNotice: z.string().min(1),
});

export type RegisterResponseDto = z.infer<typeof registerResponseDtoSchema>;

export const recoveryCodesResponseDtoSchema = z.object({
  recoveryCodes: z.array(z.string().min(1)),
  recoveryCodesNotice: z.string().min(1),
});

export type RecoveryCodesResponseDto = z.infer<typeof recoveryCodesResponseDtoSchema>;

export const messageResponseDtoSchema = z.object({
  message: z.string().min(1),
});

export type MessageResponseDto = z.infer<typeof messageResponseDtoSchema>;

export const groupResponseDtoSchema = z.object({
  id: numericIdDtoSchema,
  name: z
    .string()
    .trim()
    .min(LIMITS.GROUP_NAME_MIN)
    .max(LIMITS.GROUP_NAME_MAX),
  isPersonal: z.boolean(),
  creatorId: numericIdDtoSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.optional(),
});

export type GroupResponseDto = z.infer<typeof groupResponseDtoSchema>;

export const tagResponseDtoSchema = z.object({
  id: numericIdDtoSchema,
  groupId: numericIdDtoSchema,
  name: tagNameSchema,
  createdAt: isoDateTimeSchema.optional(),
});

export type TagResponseDto = z.infer<typeof tagResponseDtoSchema>;

export const taskResponseDtoSchema = z.object({
  id: numericIdDtoSchema,
  groupId: numericIdDtoSchema,
  assignedUserId: numericIdDtoSchema.nullable().optional(),
  title: z
    .string()
    .trim()
    .min(LIMITS.TASK_TITLE_MIN)
    .max(LIMITS.TASK_TITLE_MAX),
  description: z
    .string()
    .trim()
    .max(LIMITS.TASK_DESCRIPTION_MAX)
    .nullable()
    .optional(),
  completed: z.boolean(),
  completedAt: isoDateTimeSchema.nullable().optional(),
  overdue: z.boolean(),
  dueDate: dueDateSchema.nullable().optional(),
  dueTime: backendDueTimeDtoSchema.nullable().optional(),
  tags: z.array(tagResponseDtoSchema).default([]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.optional(),
});

export type TaskResponseDto = z.infer<typeof taskResponseDtoSchema>;

export const notificationResponseDtoSchema = z.object({
  id: numericIdDtoSchema,
  eventType: z.string().trim().min(1),
  content: z.string().min(1),
  read: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export type NotificationResponseDto = z.infer<typeof notificationResponseDtoSchema>;

export const unreadCountResponseDtoSchema = z.object({
  unreadCount: z.number().int().min(0),
});

export type UnreadCountResponseDto = z.infer<typeof unreadCountResponseDtoSchema>;

export const markAllReadResponseDtoSchema = z.object({
  updatedCount: z.number().int().min(0),
});

export type MarkAllReadResponseDto = z.infer<typeof markAllReadResponseDtoSchema>;

export const vapidPublicKeyResponseDtoSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});

export type VapidPublicKeyResponseDto = z.infer<typeof vapidPublicKeyResponseDtoSchema>;

export const pushSubscriptionResponseDtoSchema = z.object({
  id: numericIdDtoSchema,
  endpoint: z.string().min(1),
  createdAt: isoDateTimeSchema,
});

export type PushSubscriptionResponseDto = z.infer<typeof pushSubscriptionResponseDtoSchema>;

export function createKeysetPageSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    content: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasNext: z.boolean(),
    size: z.number().int().min(0),
  });
}

export const keysetPageGroupResponseDtoSchema = createKeysetPageSchema(groupResponseDtoSchema);
export const keysetPageTaskResponseDtoSchema = createKeysetPageSchema(taskResponseDtoSchema);
export const keysetPageTagResponseDtoSchema = createKeysetPageSchema(tagResponseDtoSchema);
export const keysetPageNotificationResponseDtoSchema = createKeysetPageSchema(
  notificationResponseDtoSchema,
);
