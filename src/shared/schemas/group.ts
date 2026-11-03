import { z } from 'zod';
import { LIMITS, GROUP_ROLES } from './limits';
import { idSchema, isoDateTimeSchema } from './common';
import { es } from '../i18n';

export const groupRoleSchema = z.enum(GROUP_ROLES);
export type GroupRole = z.infer<typeof groupRoleSchema>;

export const groupMemberSchema = z.object({
  userId: idSchema,
  role: groupRoleSchema,
  joinedAt: isoDateTimeSchema,
});

export interface GroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: string;
}

export const groupSchema = z.object({
  id: idSchema,
  name: z
    .string()
    .trim()
    .min(LIMITS.GROUP_NAME_MIN, es.validation.minLength('El nombre del grupo', LIMITS.GROUP_NAME_MIN))
    .max(LIMITS.GROUP_NAME_MAX, es.validation.maxLength('El nombre del grupo', LIMITS.GROUP_NAME_MAX)),
  creatorId: idSchema,
  isPersonal: z.boolean(),
  type: z.enum(['individual', 'compartido']),
  members: z.array(groupMemberSchema).min(1).max(LIMITS.GROUP_MEMBERS_MAX),
  createdAt: isoDateTimeSchema,
});

export interface Group {
  id: string;
  name: string;
  creatorId: string;
  isPersonal: boolean;
  type: 'individual' | 'compartido';
  members: GroupMember[];
  createdAt: string;
}
