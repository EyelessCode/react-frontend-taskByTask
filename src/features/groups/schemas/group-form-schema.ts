import { z } from 'zod';
import { LIMITS } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

/**
 * Validation schema for creating and renaming individual groups (REQ-GRP-01, REQ-GRP-04, REQ-GRP-07).
 * - Enforces length between 3 and 30 characters inclusive (LIMITS.GROUP_NAME_MIN..MAX).
 * - Automatically trims leading and trailing whitespaces before length evaluation (REQ-GRP-04b).
 * - Centralizes Spanish validation messages in es.ts.
 */
export const groupFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      LIMITS.GROUP_NAME_MIN,
      es.validation.minLength(es.groups.nameLabel, LIMITS.GROUP_NAME_MIN),
    )
    .max(
      LIMITS.GROUP_NAME_MAX,
      es.validation.maxLength(es.groups.nameLabel, LIMITS.GROUP_NAME_MAX),
    ),
});

export type GroupFormInput = z.infer<typeof groupFormSchema>;
