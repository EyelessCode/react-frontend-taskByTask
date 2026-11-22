import { z } from 'zod';
import { es } from '../../../shared/i18n';
import { LIMITS, rawPasswordSchema } from '../../../shared/schemas';
import {
  normalizeRecoveryCodeForLocalStorage,
  validateRecoveryCodeFormat,
} from '../utils';

/**
 * Zod form validation schemas for auth, recovery, profile, and account deletion flows.
 * Passwords are always preserved without trimming.
 */

const emailFieldSchema = z
  .string()
  .trim()
  .min(1, es.auth.emailRequired)
  .max(LIMITS.USER_EMAIL_MAX, es.validation.maxLength('El correo electrónico', LIMITS.USER_EMAIL_MAX))
  .email(es.validation.invalidEmail)
  .toLowerCase();

const usernameFieldSchema = z
  .string()
  .trim()
  .min(LIMITS.USERNAME_MIN, es.validation.minLength('El nombre de usuario', LIMITS.USERNAME_MIN))
  .max(LIMITS.USERNAME_MAX, es.validation.maxLength('El nombre de usuario', LIMITS.USERNAME_MAX))
  .regex(/^[A-Za-z0-9]+$/, es.validation.invalidUsername);

const displayNameFieldSchema = z
  .string()
  .trim()
  .min(LIMITS.DISPLAY_NAME_MIN, es.validation.minLength('El nombre para mostrar', LIMITS.DISPLAY_NAME_MIN))
  .max(LIMITS.DISPLAY_NAME_MAX, es.validation.maxLength('El nombre para mostrar', LIMITS.DISPLAY_NAME_MAX));

const recoveryCodeFieldSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const validation = validateRecoveryCodeFormat(value);
    if (!validation.ok) {
      ctx.addIssue({
        code: 'custom',
        message: validation.error,
      });
    }
  })
  .transform((value) => normalizeRecoveryCodeForLocalStorage(value));

export const loginFormSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, es.auth.passwordRequiredOnLogin),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z.object({
  email: emailFieldSchema,
  username: usernameFieldSchema,
  displayName: displayNameFieldSchema,
  password: rawPasswordSchema,
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const recoverFormSchema = z.object({
  email: emailFieldSchema,
  recoveryCode: recoveryCodeFieldSchema,
  newPassword: rawPasswordSchema,
});

export type RecoverFormValues = z.infer<typeof recoverFormSchema>;

export const profileFormSchema = z.object({
  email: emailFieldSchema,
  username: usernameFieldSchema,
  displayName: displayNameFieldSchema,
  timeFormat: z.enum(['24h', '12h']),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, es.auth.currentPasswordRequired),
  newPassword: rawPasswordSchema,
});

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

export const currentPasswordConfirmSchema = z.object({
  currentPassword: z.string().min(1, es.auth.currentPasswordRequired),
});

export type CurrentPasswordConfirmValues = z.infer<typeof currentPasswordConfirmSchema>;
