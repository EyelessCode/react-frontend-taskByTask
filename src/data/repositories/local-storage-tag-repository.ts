import { z } from 'zod';
import type { TagRepository } from '../contracts/tag-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { tagNameSchema, tagSchema, type Tag } from '../../shared/schemas';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';

export class LocalStorageTagRepository implements TagRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  async getAll(): Promise<Tag[]> {
    return Promise.resolve(
      this.storageAdapter.getItem(STORAGE_KEYS.TAGS, z.array(tagSchema), []),
    );
  }

  async getById(id: string): Promise<Tag | null> {
    const tags = await this.getAll();
    return tags.find((t) => t.id === id) ?? null;
  }

  async getByGroupId(groupId: string): Promise<Tag[]> {
    const tags = await this.getAll();
    return tags.filter((t) => t.groupId === groupId);
  }

  async findByName(groupId: string, name: string): Promise<Tag | null> {
    const normalized = name.trim().toLowerCase();
    const tags = await this.getAll();
    return (
      tags.find(
        (t) => t.groupId === groupId && t.name.trim().toLowerCase() === normalized,
      ) ?? null
    );
  }

  async ensureTag(groupId: string, name: string): Promise<Tag> {
    const parseResult = tagNameSchema.safeParse(name);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Tag name validation failed', issues);
    }

    const normalizedName = parseResult.data;
    const existing = await this.findByName(groupId, normalizedName);
    if (existing) {
      return existing;
    }

    const generatedId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newTag: Tag = {
      id: generatedId,
      name: normalizedName,
      groupId,
    };

    await this.save(newTag);
    return newTag;
  }

  async save(tag: Tag): Promise<void> {
    const parseResult = tagSchema.safeParse(tag);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Tag validation failed', issues);
    }

    const validatedTag = parseResult.data;
    const tags = await this.getAll();
    const existingIndex = tags.findIndex((t) => t.id === validatedTag.id);
    const updatedTags = [...tags];

    if (existingIndex >= 0) {
      updatedTags[existingIndex] = validatedTag;
    } else {
      updatedTags.push(validatedTag);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.TAGS, z.array(tagSchema), updatedTags);
  }

  async delete(id: string): Promise<void> {
    const tags = await this.getAll();
    const existingIndex = tags.findIndex((t) => t.id === id);

    if (existingIndex < 0) {
      throw new NotFoundError('Etiqueta', id);
    }

    const updatedTags = tags.filter((t) => t.id !== id);
    this.storageAdapter.setItem(STORAGE_KEYS.TAGS, z.array(tagSchema), updatedTags);
  }

  async deleteFromGroup(tagId: string): Promise<void> {
    return this.delete(tagId);
  }

  async deleteByGroupId(groupId: string): Promise<void> {
    const tags = await this.getAll();
    const updatedTags = tags.filter((t) => t.groupId !== groupId);
    this.storageAdapter.setItem(STORAGE_KEYS.TAGS, z.array(tagSchema), updatedTags);
  }
}
