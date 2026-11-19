import { z } from 'zod';
import {
  dueDateSchema,
  dueTimeSchema,
  idSchema,
  LIMITS,
  tagNameSchema,
} from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(
        LIMITS.TASK_TITLE_MIN,
        es.validation.minLength('El título de la tarea', LIMITS.TASK_TITLE_MIN),
      )
      .max(
        LIMITS.TASK_TITLE_MAX,
        es.validation.maxLength('El título de la tarea', LIMITS.TASK_TITLE_MAX),
      ),
    description: z
      .string()
      .trim()
      .max(
        LIMITS.TASK_DESCRIPTION_MAX,
        es.validation.maxLength('La descripción', LIMITS.TASK_DESCRIPTION_MAX),
      )
      .nullish()
      .or(z.literal('')),
    dueDate: dueDateSchema.nullish().or(z.literal('')),
    dueTime: dueTimeSchema.nullish().or(z.literal('')),
    tagNames: z.array(tagNameSchema).default([]),
    groupId: idSchema,
  })
  .refine(
    (data) => {
      const hasDueTime = Boolean(data.dueTime && data.dueTime.trim().length > 0);
      const hasDueDate = Boolean(data.dueDate && data.dueDate.trim().length > 0);
      if (hasDueTime && !hasDueDate) {
        return false;
      }
      return true;
    },
    {
      message: 'Debes indicar una fecha de caducidad para poder especificar la hora',
      path: ['dueTime'],
    },
  );

export type TaskFormInput = z.input<typeof taskFormSchema>;
export type TaskFormData = z.output<typeof taskFormSchema>;
