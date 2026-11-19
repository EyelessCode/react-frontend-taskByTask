import { z } from 'zod';
import { LIMITS } from './limits';
import { idSchema } from './common';
import { es } from '../i18n';

export const tagNameSchema = z
  .string()
  .trim()
  .min(LIMITS.TAG_NAME_MIN, es.validation.minLength('El nombre de la etiqueta', LIMITS.TAG_NAME_MIN))
  .max(LIMITS.TAG_NAME_MAX, es.validation.maxLength('El nombre de la etiqueta', LIMITS.TAG_NAME_MAX))
  .refine((val) => !val.includes(';') && !val.includes(','), {
    message: es.validation.invalidCharacters('; o ,'),
  });

export const tagSchema = z.object({
  id: idSchema,
  name: tagNameSchema,
  groupId: idSchema,
});

export interface Tag {
  id: string;
  name: string;
  groupId: string;
}
