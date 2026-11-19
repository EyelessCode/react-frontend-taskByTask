import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';

export const invitationSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  invitedEmailOrUsername: z.string().trim().min(1),
  role: z.enum(['gestor', 'visitante']),
  status: z.enum(['pending', 'accepted', 'declined', 'expired']),
  createdAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
});

export interface Invitation {
  id: string;
  groupId: string;
  invitedEmailOrUsername: string;
  role: 'gestor' | 'visitante';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}
