import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';

export const sessionSchema = z.object({
  userId: idSchema,
  token: z.string().min(1),
  expiresAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});

export interface Session {
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}
