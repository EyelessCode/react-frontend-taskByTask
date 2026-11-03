import type { z } from 'zod';

export interface StorageAdapter {
  getItem<T>(key: string, schema: z.ZodType<T>, fallback: T): T;
  setItem<T>(key: string, schema: z.ZodType<T>, value: T): void;
  removeItem(key: string): void;
  clear(): void;
  clearNamespace(prefix?: string): void;
}
