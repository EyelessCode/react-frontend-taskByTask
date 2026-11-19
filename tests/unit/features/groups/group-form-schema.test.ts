import { describe, it, expect } from 'vitest';
import { LIMITS } from '@/shared/schemas';
import { es } from '@/shared/i18n';
import {
  groupFormSchema,
  type GroupFormInput,
} from '@/features/groups/schemas/group-form-schema';

describe('Group Form Validation Schema (features/groups/schemas/group-form-schema)', () => {
  describe('Valid inputs (REQ-GRP-01, REQ-GRP-04, REQ-GRP-04b, AC-GRP-01)', () => {
    it('should validate a valid group name successfully', () => {
      const payload: GroupFormInput = { name: 'Universidad' };
      const result = groupFormSchema.safeParse(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Universidad');
      }
    });

    it('should automatically trim leading and trailing whitespace (REQ-GRP-04b)', () => {
      const result = groupFormSchema.safeParse({ name: '   Estudio   ' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Estudio');
      }
    });

    it('should allow boundary minimum length of exactly 3 characters', () => {
      const result = groupFormSchema.safeParse({ name: 'Abc' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Abc');
      }
    });

    it('should allow boundary maximum length of exactly 30 characters', () => {
      const name30 = 'A'.repeat(30);
      const result = groupFormSchema.safeParse({ name: name30 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(name30);
      }
    });

    it('should allow names containing interior spaces and special characters', () => {
      const result = groupFormSchema.safeParse({ name: 'Proyecto Final - Redes' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Proyecto Final - Redes');
      }
    });
  });

  describe('Minimum length validation (REQ-GRP-04, AC-GRP-02)', () => {
    const expectedMinError = es.validation.minLength(es.groups.nameLabel, LIMITS.GROUP_NAME_MIN);

    it('should reject names shorter than 3 characters with localized error message', () => {
      const result = groupFormSchema.safeParse({ name: 'ab' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedMinError);
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should reject names that have < 3 characters after trimming', () => {
      const result = groupFormSchema.safeParse({ name: '  ab  ' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedMinError);
      }
    });

    it('should reject empty string', () => {
      const result = groupFormSchema.safeParse({ name: '' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedMinError);
      }
    });

    it('should reject whitespace-only string', () => {
      const result = groupFormSchema.safeParse({ name: '     ' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedMinError);
      }
    });
  });

  describe('Maximum length validation (REQ-GRP-04, AC-GRP-02)', () => {
    const expectedMaxError = es.validation.maxLength(es.groups.nameLabel, LIMITS.GROUP_NAME_MAX);

    it('should reject names exceeding 30 characters with localized error message', () => {
      const name31 = 'A'.repeat(31);
      const result = groupFormSchema.safeParse({ name: name31 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedMaxError);
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should reject names exceeding 30 characters after trimming', () => {
      const name31WithSpaces = `  ${'A'.repeat(31)}  `;
      const result = groupFormSchema.safeParse({ name: name31WithSpaces });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(expectedMaxError);
      }
    });
  });

  describe('Type validation', () => {
    it('should reject non-string or missing name field', () => {
      expect(groupFormSchema.safeParse({}).success).toBe(false);
      expect(groupFormSchema.safeParse({ name: 123 }).success).toBe(false);
      expect(groupFormSchema.safeParse({ name: null }).success).toBe(false);
    });
  });
});
