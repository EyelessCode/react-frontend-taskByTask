import type { SessionRepository } from '../contracts/session-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { ValidationError } from '../../shared/errors';
import { sessionSchema, type Session } from '../../shared/schemas';

const nullableSessionSchema = sessionSchema.nullable();

export class LocalStorageSessionRepository implements SessionRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  async get(): Promise<Session | null> {
    return Promise.resolve(this.storageAdapter.getItem(STORAGE_KEYS.SESSION, nullableSessionSchema, null));
  }

  async save(session: Session): Promise<void> {
    const parseResult = sessionSchema.safeParse(session);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Session validation failed', issues);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.SESSION, nullableSessionSchema, parseResult.data);
    return Promise.resolve();
  }

  async clear(): Promise<void> {
    this.storageAdapter.removeItem(STORAGE_KEYS.SESSION);
    return Promise.resolve();
  }
}
