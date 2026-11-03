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
