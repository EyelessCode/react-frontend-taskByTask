import { describe, expect, it } from 'vitest';
import {
  changePasswordFormSchema,
  currentPasswordConfirmSchema,
  loginFormSchema,
  profileFormSchema,
  recoverFormSchema,
  registerFormSchema,
} from '@/features/auth/schemas/auth-form-schemas';
import { es } from '@/shared/i18n';

describe('auth form Zod schemas', () => {
  describe('loginFormSchema', () => {
    it('requires non-empty email and password without enforcing 6..30 length on password', () => {
      const empty = loginFormSchema.safeParse({ email: '   ', password: '' });
      expect(empty.success).toBe(false);
      if (!empty.success) {
        const messages = empty.error.issues.map((i) => i.message);
        expect(messages).toContain(es.auth.emailRequired);
        expect(messages).toContain(es.auth.passwordRequiredOnLogin);
      }

      const shortOrWhitespacePw = loginFormSchema.safeParse({
        email: '  Ana@Example.com ',
        password: '   ',
      });
      expect(shortOrWhitespacePw.success).toBe(true);
      if (shortOrWhitespacePw.success) {
        expect(shortOrWhitespacePw.data.email).toBe('ana@example.com');
        expect(shortOrWhitespacePw.data.password).toBe('   ');
      }
    });
  });

  describe('registerFormSchema', () => {
    it('validates email, alphanumeric username, displayName, and untrimmed 6..30 password', () => {
      const valid = registerFormSchema.safeParse({
        email: '  Ana@Example.com ',
        username: ' Ana123 ',
        displayName: ' Ana García ',
        password: '  pass12  ',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe('ana@example.com');
        expect(valid.data.username).toBe('Ana123');
        expect(valid.data.displayName).toBe('Ana García');
        expect(valid.data.password).toBe('  pass12  ');
      }

      const invalid = registerFormSchema.safeParse({
        email: 'not-an-email',
        username: 'ana_123',
        displayName: 'A',
        password: '123',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('recoverFormSchema', () => {
    it('validates email, 8-char alphanumeric recoveryCode, and untrimmed newPassword', () => {
      const emptyCode = recoverFormSchema.safeParse({
        email: 'ana@example.com',
        recoveryCode: '   ',
        newPassword: 'newPassword1',
      });
      expect(emptyCode.success).toBe(false);
      if (!emptyCode.success) {
        expect(emptyCode.error.issues[0]?.message).toBe(es.auth.recoveryCodeRequired);
      }

      const badLength = recoverFormSchema.safeParse({
        email: 'ana@example.com',
        recoveryCode: 'ABC123',
        newPassword: 'newPassword1',
      });
      expect(badLength.success).toBe(false);
      if (!badLength.success) {
        expect(badLength.error.issues[0]?.message).toBe(es.auth.recoveryCodeLengthError);
      }

      const badChars = recoverFormSchema.safeParse({
        email: 'ana@example.com',
        recoveryCode: 'ABCD-123',
        newPassword: 'newPassword1',
      });
      expect(badChars.success).toBe(false);
      if (!badChars.success) {
        expect(badChars.error.issues[0]?.message).toBe(es.auth.recoveryCodeFormatError);
      }

      const valid = recoverFormSchema.safeParse({
        email: 'ANA@example.com',
        recoveryCode: ' ab12cd34 ',
        newPassword: '  newPass1 ',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.recoveryCode).toBe('AB12CD34');
        expect(valid.data.newPassword).toBe('  newPass1 ');
      }
    });
  });

  describe('profileFormSchema, changePasswordFormSchema, and currentPasswordConfirmSchema', () => {
    it('validates profile fields and timeFormat enum', () => {
      const valid = profileFormSchema.safeParse({
        email: 'ana@example.com',
        username: 'ana123',
        displayName: 'Ana',
        timeFormat: '12h',
      });
      expect(valid.success).toBe(true);
    });

    it('requires currentPassword without trimming on changePassword and confirmation schemas', () => {
      const emptyChange = changePasswordFormSchema.safeParse({
        currentPassword: '',
        newPassword: 'newPassword1',
      });
      expect(emptyChange.success).toBe(false);
      if (!emptyChange.success) {
        expect(emptyChange.error.issues[0]?.message).toBe(es.auth.currentPasswordRequired);
      }

      const whitespaceConfirm = currentPasswordConfirmSchema.safeParse({
        currentPassword: '   ',
      });
      expect(whitespaceConfirm.success).toBe(true);
      if (whitespaceConfirm.success) {
        expect(whitespaceConfirm.data.currentPassword).toBe('   ');
      }
    });
  });
});
