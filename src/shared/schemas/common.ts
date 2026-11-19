import { z } from 'zod';

export const idSchema = z.string().trim().min(1);

export const isoDateTimeSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?$/,
    { message: 'El formato de fecha y hora debe ser ISO-8601' },
  );

export const dueDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'El formato de fecha debe ser YYYY-MM-DD' });

export const dueTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'El formato de hora debe ser HH:mm' });
