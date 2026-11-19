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

export const loginLockoutSchema = z.object({
  normalizedEmail: z.string().trim().toLowerCase().email(),
  failedAttempts: z.number().int().min(0).max(5),
  lockedUntil: isoDateTimeSchema.nullable(),
});

export interface LoginLockoutState {
  normalizedEmail: string;
  failedAttempts: number;
  lockedUntil: string | null;
}
