import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { MockStorage } from '../../mocks/mock-storage';
import {
  LocalStorageAdapter,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  STORAGE_NAMESPACE,
} from '@/data/storage';
import { ValidationError, CorruptedDataError, StorageQuotaError } from '@/shared/errors';

describe('LocalStorageAdapter (data/storage/local-storage-adapter)', () => {
  it('should define canonical STORAGE_KEYS with versioned tbt:v1: prefix', () => {
    expect(STORAGE_PREFIX).toBe('tbt:v1:');
    expect(STORAGE_NAMESPACE).toBe('tbt:v1:');
    expect(STORAGE_KEYS.USERS).toBe('tbt:v1:users');
    expect(STORAGE_KEYS.GROUPS).toBe('tbt:v1:groups');
    expect(STORAGE_KEYS.TASKS).toBe('tbt:v1:tasks');
    expect(STORAGE_KEYS.TAGS).toBe('tbt:v1:tags');
    expect(STORAGE_KEYS.NOTIFICATIONS).toBe('tbt:v1:notifications');
    expect(STORAGE_KEYS.SESSION).toBe('tbt:v1:session');
    expect(STORAGE_KEYS.RECOVERY_CODES).toBe('tbt:v1:recovery_codes');
  });

  it('should return fallback when key is absent in storage without triggering corrupted callback', () => {
    const mockStorage = new MockStorage();
    const onCorrupted = vi.fn();
    const adapter = new LocalStorageAdapter(mockStorage, { onCorruptedData: onCorrupted });

    const fallback: string[] = ['default'];
    const result = adapter.getItem('tbt:v1:tasks', z.array(z.string()), fallback);

    expect(result).toEqual(fallback);
    expect(onCorrupted).not.toHaveBeenCalled();
  });

  it('should store and retrieve data successfully across round-trip', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const schema = z.object({ id: z.string(), count: z.number() });

    const data = { id: 'item-1', count: 42 };
    adapter.setItem('tbt:v1:test', schema, data);

    const retrieved = adapter.getItem('tbt:v1:test', schema, { id: 'fallback', count: 0 });
    expect(retrieved).toEqual(data);
    expect(mockStorage.getItem('tbt:v1:test')).toBe(JSON.stringify(data));
  });

  it('should catch JSON parse syntax errors, report CorruptedDataError, and return fallback', () => {
    const mockStorage = new MockStorage();
    let recordedError: CorruptedDataError | null = null;
    const adapter = new LocalStorageAdapter(mockStorage, {
      onCorruptedData: (err) => {
        recordedError = err;
      },
    });

    mockStorage.setItem('tbt:v1:tasks', '{ invalid json syntax');
    const fallback: string[] = [];
    const result = adapter.getItem('tbt:v1:tasks', z.array(z.string()), fallback);

    expect(result).toEqual(fallback);
    expect(recordedError).not.toBeNull();
    const parseError = recordedError as unknown as CorruptedDataError;
    expect(parseError).toBeInstanceOf(CorruptedDataError);
    expect(parseError.storageKey).toBe('tbt:v1:tasks');
    expect(parseError.code).toBe('CORRUPTED_DATA');
  });

  it('should catch schema validation failures, report CorruptedDataError, and return fallback', () => {
    const mockStorage = new MockStorage();
    let recordedError: CorruptedDataError | null = null;
    const adapter = new LocalStorageAdapter(mockStorage, {
      onCorruptedData: (err) => {
        recordedError = err;
      },
    });

    const schema = z.object({ name: z.string().min(3) });
    // Injects payload that violates min(3) constraint
    mockStorage.setItem('tbt:v1:groups', JSON.stringify({ name: 'ab' }));

    const fallback = { name: 'fallback' };
    const result = adapter.getItem('tbt:v1:groups', schema, fallback);

    expect(result).toEqual(fallback);
    expect(recordedError).not.toBeNull();
    const schemaError = recordedError as unknown as CorruptedDataError;
    expect(schemaError).toBeInstanceOf(CorruptedDataError);
    expect(schemaError.storageKey).toBe('tbt:v1:groups');
    expect(schemaError.diagnostic).toBeDefined();
  });

  it('should validate value before setItem and throw ValidationError on violation', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const schema = z.object({ title: z.string().min(2) });

    // Violates min(2)
    expect(() => {
      adapter.setItem('tbt:v1:tasks', schema, { title: 'a' });
    }).toThrowError(ValidationError);

    expect(mockStorage.getItem('tbt:v1:tasks')).toBeNull();
  });

  it('should catch QuotaExceededError and throw StorageQuotaError', () => {
    const mockStorage = new MockStorage();
    mockStorage.setSimulateQuotaExceeded(true);
    const adapter = new LocalStorageAdapter(mockStorage);
    const schema = z.string();

    expect(() => {
      adapter.setItem('tbt:v1:test', schema, 'hello');
    }).toThrowError(StorageQuotaError);
  });

  it('should removeItem correctly', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);

    mockStorage.setItem('tbt:v1:tasks', JSON.stringify(['task-1']));
    adapter.removeItem('tbt:v1:tasks');
    expect(mockStorage.getItem('tbt:v1:tasks')).toBeNull();
  });

  it('should clear only namespaced keys with clearNamespace, leaving external keys untouched', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);

    mockStorage.setItem('tbt:v1:tasks', JSON.stringify(['task-1']));
    mockStorage.setItem('tbt:v1:groups', JSON.stringify(['grp-1']));
    mockStorage.setItem('theme_preference', 'dark');
    mockStorage.setItem('other_app_data', '123');

    adapter.clearNamespace();

    expect(mockStorage.getItem('tbt:v1:tasks')).toBeNull();
    expect(mockStorage.getItem('tbt:v1:groups')).toBeNull();
    expect(mockStorage.getItem('theme_preference')).toBe('dark');
    expect(mockStorage.getItem('other_app_data')).toBe('123');
  });
});
