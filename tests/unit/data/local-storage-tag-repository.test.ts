import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorage } from '../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import { LocalStorageTagRepository } from '@/data/repositories/local-storage-tag-repository';
import type { Tag } from '@/shared/schemas';
import { NotFoundError, ValidationError } from '@/shared/errors';

describe('LocalStorageTagRepository (unit/data/local-storage-tag-repository)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let repository: LocalStorageTagRepository;

  const sampleTag: Tag = {
    id: 'tag-urgent',
    name: 'Urgente',
    groupId: 'grp-personal',
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    repository = new LocalStorageTagRepository(adapter);
  });

  it('should return empty array when no tags exist', async () => {
    const tags = await repository.getAll();
    expect(tags).toEqual([]);
  });

  it('should save a valid tag and retrieve it with getAll and getById', async () => {
    await repository.save(sampleTag);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(sampleTag);

    const fetched = await repository.getById('tag-urgent');
    expect(fetched).toEqual(sampleTag);
  });

  it('should return null when getById does not find the tag', async () => {
    const fetched = await repository.getById('non-existent');
    expect(fetched).toBeNull();
  });

  it('should update existing tag when saving with same ID', async () => {
    await repository.save(sampleTag);

    const updated: Tag = {
      ...sampleTag,
      name: 'Muy Urgente',
    };
    await repository.save(updated);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Muy Urgente');
  });

  it('should reject invalid tag with ValidationError upon save', async () => {
    const invalidTag = {
      ...sampleTag,
      name: 'invalido;con;puntos',
    };

    await expect(repository.save(invalidTag as Tag)).rejects.toThrowError(ValidationError);
  });

  it('should filter tags by groupId with getByGroupId', async () => {
    const tag1 = { id: 't1', name: 'Frontend', groupId: 'grp-work' };
    const tag2 = { id: 't2', name: 'Personal', groupId: 'grp-personal' };
    const tag3 = { id: 't3', name: 'Backend', groupId: 'grp-work' };

    await repository.save(tag1);
    await repository.save(tag2);
    await repository.save(tag3);

    const workTags = await repository.getByGroupId('grp-work');
    expect(workTags).toHaveLength(2);
    expect(workTags.map((t) => t.id)).toEqual(['t1', 't3']);

    const emptyTags = await repository.getByGroupId('grp-empty');
    expect(emptyTags).toEqual([]);
  });

  it('should find tag by name case-insensitively and trimmed with findByName', async () => {
    await repository.save(sampleTag);

    const matchLower = await repository.findByName('grp-personal', 'urgente');
    expect(matchLower).toEqual(sampleTag);

    const matchSpaced = await repository.findByName('grp-personal', '  URGENTE  ');
    expect(matchSpaced).toEqual(sampleTag);

    const otherGroup = await repository.findByName('grp-other', 'Urgente');
    expect(otherGroup).toBeNull();

    const notFound = await repository.findByName('grp-personal', 'Inexistente');
    expect(notFound).toBeNull();
  });

  it('should reuse existing tag when ensureTag is called with existing name', async () => {
    await repository.save(sampleTag);

    const result = await repository.ensureTag('grp-personal', '  URGENTE ');
    expect(result.id).toBe(sampleTag.id);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
  });

  it('should create new tag when ensureTag is called with new name', async () => {
    const newTag = await repository.ensureTag('grp-personal', 'Nueva Etiqueta');
    expect(newTag.name).toBe('Nueva Etiqueta');
    expect(newTag.groupId).toBe('grp-personal');
    expect(newTag.id).toBeDefined();

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(newTag.id);
  });

  it('should reject invalid tag name in ensureTag with ValidationError', async () => {
    await expect(repository.ensureTag('grp-personal', 'a,b')).rejects.toThrowError(
      ValidationError,
    );
  });

  it('should delete a tag by ID', async () => {
    await repository.save(sampleTag);

    await repository.delete('tag-urgent');
    const all = await repository.getAll();
    expect(all).toHaveLength(0);
  });

  it('should throw NotFoundError when attempting to delete a non-existent tag', async () => {
    await expect(repository.delete('does-not-exist')).rejects.toThrowError(NotFoundError);
  });

  it('should delete from group via deleteFromGroup', async () => {
    await repository.save(sampleTag);

    await repository.deleteFromGroup('tag-urgent');
    const all = await repository.getAll();
    expect(all).toHaveLength(0);
  });

  it('should throw NotFoundError in deleteFromGroup when tag does not exist', async () => {
    await expect(repository.deleteFromGroup('does-not-exist')).rejects.toThrowError(
      NotFoundError,
    );
  });
});
