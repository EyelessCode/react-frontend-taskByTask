import { describe, it, expect } from 'vitest';
import { taskFormSchema } from '@/features/tasks/schemas/task-form-schema';

describe('taskFormSchema (unit/features/tasks/task-form-schema)', () => {
  const minimalValid = {
    title: 'Tarea básica',
    groupId: 'grp-personal',
  };

  it('should validate minimal payload successfully', () => {
    const result = taskFormSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Tarea básica');
      expect(result.data.groupId).toBe('grp-personal');
      expect(result.data.tagNames).toEqual([]);
    }
  });

  it('should validate complete valid payload successfully', () => {
    const fullPayload = {
      title: 'Completar informe de arquitectura',
      description: 'Revisar diagramas y flujos de datos antes de enviar.',
      dueDate: '2026-11-15',
      dueTime: '18:30',
      tagNames: ['Universidad', 'Arquitectura'],
      groupId: 'grp-study',
    };

    const result = taskFormSchema.safeParse(fullPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBe('2026-11-15');
      expect(result.data.dueTime).toBe('18:30');
      expect(result.data.tagNames).toEqual(['Universidad', 'Arquitectura']);
    }
  });

  describe('title bounds (2..100 characters)', () => {
    it('should reject title shorter than 2 characters', () => {
      const result = taskFormSchema.safeParse({ ...minimalValid, title: 'a' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
      }
    });

    it('should reject empty or whitespace-only title', () => {
      const result = taskFormSchema.safeParse({ ...minimalValid, title: '    ' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
      }
    });

    it('should accept title of exactly 2 characters', () => {
      const result = taskFormSchema.safeParse({ ...minimalValid, title: 'Ok' });
      expect(result.success).toBe(true);
    });

    it('should accept title of exactly 100 characters', () => {
      const title100 = 'a'.repeat(100);
      const result = taskFormSchema.safeParse({ ...minimalValid, title: title100 });
      expect(result.success).toBe(true);
    });

    it('should reject title longer than 100 characters', () => {
      const title101 = 'a'.repeat(101);
      const result = taskFormSchema.safeParse({ ...minimalValid, title: title101 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
      }
    });
  });

  describe('description bounds (max 750 characters)', () => {
    it('should allow undefined, null, or empty string description', () => {
      expect(taskFormSchema.safeParse({ ...minimalValid, description: undefined }).success).toBe(true);
      expect(taskFormSchema.safeParse({ ...minimalValid, description: null }).success).toBe(true);
      expect(taskFormSchema.safeParse({ ...minimalValid, description: '' }).success).toBe(true);
    });

    it('should accept description up to 750 characters', () => {
      const desc750 = 'x'.repeat(750);
      const result = taskFormSchema.safeParse({ ...minimalValid, description: desc750 });
      expect(result.success).toBe(true);
    });

    it('should reject description longer than 750 characters', () => {
      const desc751 = 'x'.repeat(751);
      const result = taskFormSchema.safeParse({ ...minimalValid, description: desc751 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('description');
      }
    });
  });

  describe('due date and due time rules (REQ-TK-04)', () => {
    it('should accept valid dueDate without dueTime', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        dueDate: '2026-11-20',
      });
      expect(result.success).toBe(true);
    });

    it('should allow empty string dueDate and dueTime', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        dueDate: '',
        dueTime: '',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid dueDate format', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        dueDate: '20-11-2026',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('dueDate');
      }
    });

    it('should reject invalid dueTime format', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        dueDate: '2026-11-20',
        dueTime: '25:00',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('dueTime');
      }
    });

    it('should reject dueTime without dueDate (REQ-TK-04)', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        dueTime: '14:00',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('dueTime');
        expect(result.error.issues[0].message).toBe(
          'Debes indicar una fecha de caducidad para poder especificar la hora',
        );
      }
    });

    it('should reject dueTime when dueDate is empty string (REQ-TK-04)', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        dueDate: '',
        dueTime: '14:00',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('dueTime');
        expect(result.error.issues[0].message).toBe(
          'Debes indicar una fecha de caducidad para poder especificar la hora',
        );
      }
    });
  });

  describe('tagNames array validation', () => {
    it('should accept valid tag names', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        tagNames: ['Trabajo', 'Personal', 'Importante'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject tag name containing semicolon', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        tagNames: ['trabajo;estudio'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject tag name containing comma', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        tagNames: ['trabajo,estudio'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject tag name longer than 30 characters', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        tagNames: ['a'.repeat(31)],
      });
      expect(result.success).toBe(false);
    });

    it('should reject tag name with empty string', () => {
      const result = taskFormSchema.safeParse({
        ...minimalValid,
        tagNames: [''],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('groupId validation', () => {
    it('should reject missing or empty groupId', () => {
      const resultNoGroup = taskFormSchema.safeParse({ title: 'Sin grupo' });
      expect(resultNoGroup.success).toBe(false);

      const resultEmptyGroup = taskFormSchema.safeParse({
        title: 'Grupo vacío',
        groupId: '',
      });
      expect(resultEmptyGroup.success).toBe(false);
    });
  });
});
