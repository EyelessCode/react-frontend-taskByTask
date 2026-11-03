import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  BusinessRuleViolationError,
  CorruptedDataError,
  StorageQuotaError,
  type ValidationFieldIssue,
} from '@/shared/errors';
import { es } from '@/shared/i18n';

describe('Controlled Domain Errors (shared/errors)', () => {
  describe('AppError base class', () => {
    class TestAppError extends AppError {
      constructor(message: string, options?: ErrorOptions) {
        super(message, 'TEST_ERROR', options);
      }
    }

    it('should correctly set name, code, message, and cause', () => {
      const cause = new Error('Original cause');
      const error = new TestAppError('Something went wrong', { cause });

      expect(error.name).toBe('TestAppError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.cause).toBe(cause);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should have code VALIDATION_ERROR and inherit from AppError', () => {
      const error = new ValidationError('Datos inválidos');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Datos inválidos');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should support structured field issues', () => {
      const issues: ValidationFieldIssue[] = [
        { path: 'title', message: es.validation.required('Título') },
        { path: 'description', message: es.validation.maxLength('Descripción', 750) },
      ];
      const error = new ValidationError(issues);

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.issues).toEqual(issues);
      expect(error.fieldPath).toBe('title');
      expect(error.message).toBe(issues[0].message);
    });

    it('should accept custom message alongside issues', () => {
      const issues: ValidationFieldIssue[] = [
        { path: 'email', message: es.validation.invalidEmail },
      ];
      const error = new ValidationError('Falló la validación del usuario', issues);

      expect(error.message).toBe('Falló la validación del usuario');
      expect(error.issues).toEqual(issues);
      expect(error.fieldPath).toBe('email');
    });
  });

  describe('NotFoundError', () => {
    it('should format message with entityName using localized Spanish text', () => {
      const error = new NotFoundError('Tarea');
      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.entityName).toBe('Tarea');
      expect(error.entityId).toBeUndefined();
      expect(error.message).toBe(es.errors.notFound('Tarea'));
      expect(error instanceof AppError).toBe(true);
    });

    it('should include entityId when provided', () => {
      const error = new NotFoundError('Grupo', 'grp-123');
      expect(error.entityName).toBe('Grupo');
      expect(error.entityId).toBe('grp-123');
      expect(error.message).toContain('Grupo');
      expect(error.message).toContain('grp-123');
    });
  });

  describe('BusinessRuleViolationError', () => {
    it('should format message with rule using localized Spanish text', () => {
      const ruleText = 'no se puede eliminar el grupo Personal';
      const error = new BusinessRuleViolationError(ruleText);

      expect(error.name).toBe('BusinessRuleViolationError');
      expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(error.rule).toBe(ruleText);
      expect(error.message).toBe(es.errors.businessRule(ruleText));
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('CorruptedDataError', () => {
    it('should store storageKey, cause, and localized Spanish message', () => {
      const cause = new SyntaxError('Unexpected token');
      const error = new CorruptedDataError('tbt:v1:tasks', 'JSON parsing failed', { cause });

      expect(error.name).toBe('CorruptedDataError');
      expect(error.code).toBe('CORRUPTED_DATA');
      expect(error.storageKey).toBe('tbt:v1:tasks');
      expect(error.diagnostic).toBe('JSON parsing failed');
      expect(error.cause).toBe(cause);
      expect(error.message).toBe(es.errors.corruptedData);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('StorageQuotaError', () => {
    it('should have code STORAGE_QUOTA_EXCEEDED and default Spanish message', () => {
      const cause = new DOMException('QuotaExceededError');
      const error = new StorageQuotaError(undefined, { cause });

      expect(error.name).toBe('StorageQuotaError');
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(error.message).toBe(es.errors.storageQuota);
      expect(error.cause).toBe(cause);
      expect(error instanceof AppError).toBe(true);
    });
  });
});
