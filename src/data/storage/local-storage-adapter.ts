import type { z } from 'zod';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_PREFIX } from './keys';
import {
  CorruptedDataError,
  StorageQuotaError,
  ValidationError,
  type ValidationFieldIssue,
} from '../../shared/errors';

export interface LocalStorageAdapterOptions {
  onCorruptedData?: (error: CorruptedDataError) => void;
  prefix?: string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: Storage;
  private readonly onCorruptedData?: (error: CorruptedDataError) => void;
  private readonly prefix: string;

  constructor(
    storage?: Storage,
    options?: LocalStorageAdapterOptions,
  ) {
    if (storage) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      // In-memory fallback if neither window nor storage is available
      const memoryStore = new Map<string, string>();
      this.storage = {
        get length() {
          return memoryStore.size;
        },
        clear() {
          memoryStore.clear();
        },
        getItem(k: string) {
          return memoryStore.get(k) ?? null;
        },
        key(i: number) {
          return Array.from(memoryStore.keys())[i] ?? null;
        },
        removeItem(k: string) {
          memoryStore.delete(k);
        },
        setItem(k: string, v: string) {
          memoryStore.set(k, String(v));
        },
      } as unknown as Storage;
    }

    this.onCorruptedData = options?.onCorruptedData;
    this.prefix = options?.prefix ?? STORAGE_PREFIX;
  }

  getItem<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
    let raw: string | null;
    try {
      raw = this.storage.getItem(key);
    } catch (err) {
      const corrupted = new CorruptedDataError(
        key,
        'Error accessing localStorage',
        { cause: err as Error },
      );
      this.onCorruptedData?.(corrupted);
      return fallback;
    }

    if (raw === null || raw === undefined) {
      return fallback;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      const corrupted = new CorruptedDataError(
        key,
        'Syntactic JSON parse failure',
        { cause: err as Error },
      );
      this.onCorruptedData?.(corrupted);
      return fallback;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const diagnostic = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');

      const corrupted = new CorruptedDataError(
        key,
        diagnostic,
        { cause: result.error },
      );
      this.onCorruptedData?.(corrupted);
      return fallback;
    }

    return result.data;
  }

  setItem<T>(key: string, schema: z.ZodType<T>, value: T): void {
    const validationResult = schema.safeParse(value);
    if (!validationResult.success) {
      const issues: ValidationFieldIssue[] = validationResult.error.issues.map(
        (iss) => ({
          path: iss.path.join('.'),
          message: iss.message,
          code: iss.code,
        }),
      );
      throw new ValidationError(
        'Validation failed before persisting entity',
        issues,
      );
    }

    const serialized = JSON.stringify(validationResult.data);
    try {
      this.storage.setItem(key, serialized);
    } catch (err: unknown) {
      if (
        (err instanceof DOMException &&
          (err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            err.code === 22 ||
            err.code === 1014)) ||
        (err instanceof Error && err.name === 'QuotaExceededError')
      ) {
        throw new StorageQuotaError(undefined, { cause: err as Error });
      }
      throw err;
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // Ignored
    }
  }

  clear(): void {
    this.clearNamespace(this.prefix);
  }

  clearNamespace(prefix: string = this.prefix): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      this.storage.removeItem(k);
    }
  }
}
