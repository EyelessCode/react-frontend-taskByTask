import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorage } from '../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import { LocalStorageGroupRepository } from '@/data/repositories/local-storage-group-repository';
import { SEED_PERSONAL_GROUP, type Group } from '@/shared/schemas';
import { BusinessRuleViolationError, NotFoundError, ValidationError } from '@/shared/errors';

describe('LocalStorageGroupRepository (unit/data/local-storage-group-repository)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let repository: LocalStorageGroupRepository;

  const sampleGroup: Group = {
    id: 'grp-work',
    name: 'Trabajo',
    creatorId: 'local-user',
    isPersonal: false,
    type: 'individual',
    members: [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-01T10:00:00.000Z',
      },
    ],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    repository = new LocalStorageGroupRepository(adapter);
  });

  it('should return empty array when no groups exist', async () => {
    const groups = await repository.getAll();
    expect(groups).toEqual([]);
  });

  it('should save a new group and retrieve it by id and in getAll', async () => {
    await repository.save(sampleGroup);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(sampleGroup);

    const fetched = await repository.getById('grp-work');
    expect(fetched).toEqual(sampleGroup);
  });

  it('should return null when getById does not find the group', async () => {
    const fetched = await repository.getById('non-existent');
    expect(fetched).toBeNull();
  });

  it('should update existing group when saving with the same ID', async () => {
    await repository.save(sampleGroup);

    const updated: Group = {
      ...sampleGroup,
      name: 'Trabajo Remoto',
    };
    await repository.save(updated);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Trabajo Remoto');
  });

  it('should reject invalid group with ValidationError upon save', async () => {
    const invalidGroup = {
      ...sampleGroup,
      name: 'ab', // < 3 chars
    };

    await expect(repository.save(invalidGroup as Group)).rejects.toThrowError(ValidationError);
  });

  it('should filter only individual groups with getIndividualGroups', async () => {
    const individual1 = { ...sampleGroup, id: 'grp-1', type: 'individual' as const };
    const compartido = { ...sampleGroup, id: 'grp-2', type: 'compartido' as const };
    const individual2 = { ...sampleGroup, id: 'grp-3', type: 'individual' as const };

    await repository.save(individual1);
    await repository.save(compartido);
    await repository.save(individual2);

    const individualGroups = await repository.getIndividualGroups();
    expect(individualGroups).toHaveLength(2);
    expect(individualGroups.map((g) => g.id)).toEqual(['grp-1', 'grp-3']);
  });

  it('should auto-seed SEED_PERSONAL_GROUP when ensureSeedGroup is called on empty storage', async () => {
    const seeded = await repository.ensureSeedGroup();
    expect(seeded).toEqual(SEED_PERSONAL_GROUP);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(SEED_PERSONAL_GROUP);
  });

  it('should return existing personal group on ensureSeedGroup without duplicating', async () => {
    await repository.save(SEED_PERSONAL_GROUP);

    const ensured = await repository.ensureSeedGroup();
    expect(ensured.id).toBe(SEED_PERSONAL_GROUP.id);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
  });

  it('should delete a non-personal group by ID', async () => {
    await repository.save(sampleGroup);

    await repository.delete('grp-work');
    const all = await repository.getAll();
    expect(all).toHaveLength(0);
  });

  it('should throw BusinessRuleViolationError when attempting to delete personal group', async () => {
    await repository.save(SEED_PERSONAL_GROUP);

    await expect(repository.delete(SEED_PERSONAL_GROUP.id)).rejects.toThrowError(
      BusinessRuleViolationError,
    );
  });

  it('should throw BusinessRuleViolationError if group has isPersonal true regardless of custom name or ID', async () => {
    const customPersonal: Group = {
      ...sampleGroup,
      id: 'custom-personal-id',
      name: 'Mi Espacio Personal',
      isPersonal: true,
    };
    await repository.save(customPersonal);

    await expect(repository.delete('custom-personal-id')).rejects.toThrowError(
      BusinessRuleViolationError,
    );
  });

  it('should throw NotFoundError when attempting to delete a non-existent group', async () => {
    await expect(repository.delete('does-not-exist')).rejects.toThrowError(NotFoundError);
  });
});
