import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';

export const notificationSchema = z.object({
  id: idSchema,
  userId: idSchema,
  eventType: z.string().min(1),
  content: z.string().min(1),
  read: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export interface Notification {
  id: string;
  userId: string;
  eventType: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export const handledDueOccurrenceStatusSchema = z.enum(['notified', 'suppressed']);

export type HandledDueOccurrenceStatus = z.infer<typeof handledDueOccurrenceStatusSchema>;

export const handledDueOccurrenceSchema = z.object({
  taskId: idSchema,
  occurrenceKey: z.string().min(1),
  status: handledDueOccurrenceStatusSchema,
  recordedAt: isoDateTimeSchema,
});

export interface HandledDueOccurrence {
  taskId: string;
  occurrenceKey: string;
  status: HandledDueOccurrenceStatus;
  recordedAt: string;
}

export const userNotificationStateSchema = z.object({
  userId: idSchema,
  permissionPromptLastShownAt: isoDateTimeSchema.nullable().default(null),
  handledOccurrences: z.array(handledDueOccurrenceSchema).default([]),
});

export interface UserNotificationState {
  userId: string;
  permissionPromptLastShownAt: string | null;
  handledOccurrences: HandledDueOccurrence[];
}
