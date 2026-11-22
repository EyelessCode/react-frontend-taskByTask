import { z } from 'zod';
import { LIMITS } from './limits';
import { idSchema, isoDateTimeSchema } from './common';
import { es } from '../i18n';

export const rawPasswordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN, es.validation.minLength('La contraseña', LIMITS.PASSWORD_MIN))
  .max(LIMITS.PASSWORD_MAX, es.validation.maxLength('La contraseña', LIMITS.PASSWORD_MAX));

export const userSchema = z
  .object({
    id: idSchema,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(LIMITS.API_EMAIL_MAX, es.validation.maxLength('El correo electrónico', LIMITS.API_EMAIL_MAX))
      .email(es.validation.invalidEmail),
    username: z
      .string()
      .trim()
      .min(LIMITS.USERNAME_MIN, es.validation.minLength('El nombre de usuario', LIMITS.USERNAME_MIN))
      .max(LIMITS.USERNAME_MAX, es.validation.maxLength('El nombre de usuario', LIMITS.USERNAME_MAX))
      .regex(/^[A-Za-z0-9]+$/, es.validation.invalidUsername),
    displayName: z
      .string()
      .trim()
      .min(LIMITS.DISPLAY_NAME_MIN, es.validation.minLength('El nombre para mostrar', LIMITS.DISPLAY_NAME_MIN))
      .max(LIMITS.DISPLAY_NAME_MAX, es.validation.maxLength('El nombre para mostrar', LIMITS.DISPLAY_NAME_MAX)),
    passwordHash: z.string().min(1, es.validation.required('passwordHash')).optional(),
    timeZone: z.string().min(1, es.validation.required('timeZone')),
    timeFormat: z.enum(['24h', '12h']),
    remainingRecoveryCodes: z
      .number()
      .int()
      .min(0)
      .max(LIMITS.RECOVERY_CODES_COUNT)
      .optional(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const localUserSchema = userSchema
  .extend({
    passwordHash: z.string().min(1, es.validation.required('passwordHash')),
  })
  .strict();

export type LocalUser = z.infer<typeof localUserSchema>;

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash?: string;
  timeZone: string;
  timeFormat: '24h' | '12h';
  remainingRecoveryCodes?: number;
  createdAt: string;
}

export const recoveryCodeSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    code: z.string().length(LIMITS.RECOVERY_CODE_LENGTH),
    used: z.boolean(),
    usedAt: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export interface RecoveryCode {
  id: string;
  userId: string;
  code: string;
  used: boolean;
  usedAt?: string | null;
}
