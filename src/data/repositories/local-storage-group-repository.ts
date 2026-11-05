import { z } from 'zod';
import type { GroupRepository } from '../contracts/group-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { groupSchema, SEED_PERSONAL_GROUP, type Group } from '../../shared/schemas';
import {
  BusinessRuleViolationError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';

export class LocalStorageGroupRepository implements GroupRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  async getAll(): Promise<Group[]> {
    return Promise.resolve(
      this.storageAdapter.getItem(STORAGE_KEYS.GROUPS, z.array(groupSchema), []),
    );
  }

  async getById(id: string): Promise<Group | null> {
    const groups = await this.getAll();
    return groups.find((g) => g.id === id) ?? null;
  }

  async getIndividualGroups(): Promise<Group[]> {
    const groups = await this.getAll();
    return groups.filter((g) => g.type === 'individual');
  }

  async ensureSeedGroup(): Promise<Group> {
    const groups = await this.getAll();
    const personalGroup = groups.find(
      (g) => g.isPersonal || g.id === SEED_PERSONAL_GROUP.id,
    );

    if (personalGroup) {
      return personalGroup;
    }

    await this.save(SEED_PERSONAL_GROUP);
    return SEED_PERSONAL_GROUP;
  }

  async save(group: Group): Promise<void> {
    const parseResult = groupSchema.safeParse(group);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Group validation failed', issues);
    }

    const validatedGroup = parseResult.data;
    const groups = await this.getAll();
    const existingIndex = groups.findIndex((g) => g.id === validatedGroup.id);
    const updatedGroups = [...groups];

    if (existingIndex >= 0) {
      updatedGroups[existingIndex] = validatedGroup;
    } else {
      updatedGroups.push(validatedGroup);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.GROUPS, z.array(groupSchema), updatedGroups);
  }

  async delete(id: string): Promise<void> {
    const groups = await this.getAll();
    const existingGroup = groups.find((g) => g.id === id);

    if (!existingGroup) {
      throw new NotFoundError('Grupo', id);
    }

    if (existingGroup.isPersonal) {
      throw new BusinessRuleViolationError('El grupo Personal no puede ser eliminado');
    }

    const updatedGroups = groups.filter((g) => g.id !== id);
    this.storageAdapter.setItem(STORAGE_KEYS.GROUPS, z.array(groupSchema), updatedGroups);
  }
}
