import { z } from 'zod';
import { LIMITS, REMINDER_OFFSETS } from './limits';
import { idSchema, isoDateTimeSchema, dueDateSchema, dueTimeSchema } from './common';
import { es } from '../i18n';

export const subtaskSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  title: z
    .string()
    .trim()
    .min(LIMITS.SUBTASK_TITLE_MIN, es.validation.minLength('El título de la subtarea', LIMITS.SUBTASK_TITLE_MIN))
    .max(LIMITS.SUBTASK_TITLE_MAX, es.validation.maxLength('El título de la subtarea', LIMITS.SUBTASK_TITLE_MAX)),
  completed: z.boolean(),
  order: z.number().int().optional(),
});

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  order?: number;
}

export const reminderOffsetSchema = z.enum(REMINDER_OFFSETS);
export type ReminderOffset = z.infer<typeof reminderOffsetSchema>;

export const reminderSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  offset: reminderOffsetSchema,
});

export interface Reminder {
  id: string;
  taskId: string;
  offset: ReminderOffset;
}

export const taskSchema = z.object({
  id: idSchema,
  title: z
    .string()
    .trim()
    .min(LIMITS.TASK_TITLE_MIN, es.validation.minLength('El título de la tarea', LIMITS.TASK_TITLE_MIN))
    .max(LIMITS.TASK_TITLE_MAX, es.validation.maxLength('El título de la tarea', LIMITS.TASK_TITLE_MAX)),
  description: z
    .string()
    .trim()
    .max(LIMITS.TASK_DESCRIPTION_MAX, es.validation.maxLength('La descripción', LIMITS.TASK_DESCRIPTION_MAX))
    .nullable()
    .optional(),
  groupId: idSchema,
  tagIds: z.array(idSchema).default([]).optional(),
  completed: z.boolean(),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable().optional(),
  dueDate: dueDateSchema.nullable().optional(),
  dueTime: dueTimeSchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  subtasks: z.array(subtaskSchema).max(LIMITS.SUBTASKS_MAX_COUNT).optional(),
  reminders: z.array(reminderSchema).max(LIMITS.REMINDERS_MAX_COUNT).optional(),
});

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  groupId: string;
  tagIds?: string[];
  completed: boolean;
  createdAt: string;
  completedAt?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  assigneeId?: string | null;
  subtasks?: Subtask[];
  reminders?: Reminder[];
}
